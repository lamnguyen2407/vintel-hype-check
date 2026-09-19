import type { ScoreMetric } from "@/types/game";

export type HypeAlignment = "supportive" | "mixed" | "hostile" | "off-target";

const praiseTerms = [
  "best", "great", "greatest", "good", "amazing", "awesome", "brilliant",
  "excellent", "outstanding", "legendary", "unmatched", "unbeatable",
  "number one", "love", "proud", "genius", "talented", "incredible",
  "cool", "powerful", "impressive", "funniest", "top club",
  "tuyệt vời", "tuyệt nhất", "tốt nhất", "giỏi", "đỉnh", "số một",
  "xuất sắc", "xịn", "thông minh", "bá đạo", "yêu", "tự hào", "vô đối",
  "huyền thoại", "chất", "mạnh", "ấn tượng", "siêu đỉnh",
];

const attackTerms = [
  "worst", "bad", "boring", "terrible", "awful", "useless", "stupid",
  "dumb", "hate", "sucks", "weak", "mediocre", "trash", "cringe",
  "no talent", "not good", "not smart", "overrated", "disappointing",
  "tệ", "tồi", "dở", "chán", "ngu", "ghét", "phế", "rác", "yếu",
  "kém", "vô dụng", "không giỏi", "không tốt", "chả giỏi", "ảo tưởng",
  "không có gì hay", "chả có gì hay", "không đáng tham gia", "chả ra gì",
  "nhạt", "dở nhất",
];

const clubTerms = [
  "vintelligence", "vintel", "vinuni", "vinuniversity", "club", "clb",
];

const positiveNegations = [
  "not bad", "not boring", "not terrible", "không tệ", "không tồi",
  "chẳng tệ", "không hề chán", "không phải tệ", "chẳng hề tệ",
];

const limitsByAlignment: Record<Exclude<HypeAlignment, "supportive">, number[]> = {
  hostile: [0, 4, 3, 0],
  "off-target": [7, 6, 4, 0],
  mixed: [12, 8, 8, 4],
};

function countTerms(text: string, terms: string[]) {
  return terms.reduce((count, term) => {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(`(?:^|[^\\p{L}\\p{N}])${escaped}(?=$|[^\\p{L}\\p{N}])`, "u");
    return count + (pattern.test(text) ? 1 : 0);
  }, 0);
}

export function classifyHypeAnswer(transcript: string): HypeAlignment {
  const normalized = transcript.toLocaleLowerCase("vi-VN").replace(/\s+/g, " ").trim();
  const wordCount = normalized.match(/[\p{L}\p{N}]+/gu)?.length ?? 0;
  if (wordCount < 3) return "off-target";

  let scoringText = normalized;
  let positiveHits = 0;
  for (const phrase of positiveNegations) {
    if (scoringText.includes(phrase)) {
      positiveHits += 1;
      scoringText = scoringText.replaceAll(phrase, " positive ");
    }
  }

  positiveHits += countTerms(scoringText, praiseTerms);
  const attackHits = countTerms(scoringText, attackTerms);
  const clubHits = countTerms(scoringText, clubTerms);

  if (attackHits > 0 && positiveHits === 0) return "hostile";
  if (attackHits >= positiveHits && attackHits > 0) return "mixed";
  if (attackHits > 0) return "mixed";
  if (positiveHits === 0 && clubHits === 0) return "off-target";
  return "supportive";
}

export function enforceHypeAlignment(metrics: ScoreMetric[], transcript: string) {
  const alignment = classifyHypeAnswer(transcript);
  if (alignment === "supportive") return { alignment, metrics };

  const limits = limitsByAlignment[alignment];
  return {
    alignment,
    metrics: metrics.map((metric, index) => ({
      ...metric,
      score: Math.min(metric.score, limits[index] ?? 0),
    })),
  };
}

export function hypeAlignmentComment(alignment: HypeAlignment) {
  if (alignment === "hostile") return "That was an anti-hype speech. Funny or not, attacking the club cannot win the praise round.";
  if (alignment === "mixed") return "Some praise appeared, but the criticism cancelled the hype. Commit to the compliment next time.";
  if (alignment === "off-target") return "The judge could not find a clear Vintelligence compliment, so the hype score stayed low.";
  return null;
}
