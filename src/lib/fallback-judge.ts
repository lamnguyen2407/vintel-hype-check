import { getQuestionById } from "@/lib/game-config";
import {
  enforceHypeAlignment,
  hypeAlignmentComment,
} from "@/lib/hype-alignment";
import type {
  JudgeEntry,
  JudgeResponse,
  PlayerId,
  ScoreBreakdown,
} from "@/types/game";

const aiTerms = [
  "ai", "artificial intelligence", "trí tuệ nhân tạo", "model", "mô hình",
  "data", "dữ liệu", "learn", "học", "pattern", "mẫu", "predict", "dự đoán",
  "image", "hình ảnh", "voice", "giọng nói", "recommend", "gợi ý",
];

const reasoningTerms = [
  "because", "so that", "which means", "for example", "such as", "therefore",
  "bởi vì", "để", "nghĩa là", "ví dụ", "chẳng hạn", "do đó",
];

const clubTerms = [
  "vintelligence", "vintel", "vinuni", "vinuniversity", "club", "clb",
  "data science", "khoa học dữ liệu", "ai", "machine learning", "datathon",
];

const humorTerms = [
  "universe", "galaxy", "god", "legend", "legendary", "superhero", "rocket",
  "vũ trụ", "thiên hà", "thần", "huyền thoại", "siêu anh hùng", "tên lửa",
  "even chatgpt", "chatgpt", "plot twist", "breaking news", "thở", "crush",
];

const hypeTerms = [
  "best", "greatest", "amazing", "awesome", "brilliant", "legendary",
  "unmatched", "unbeatable", "number one", "genius", "incredible",
  "world class", "top tier", "greatest ever", "most powerful",
  "tuyệt vời", "tuyệt nhất", "tốt nhất", "đỉnh", "số một", "xuất sắc",
  "xịn", "bá đạo", "vô đối", "huyền thoại", "siêu đỉnh", "đẳng cấp",
  "to nhất", "oai nhất", "tâm huyết", "thiên tài", "đỉnh nhất",
];

const absurdityTerms = [
  "universe", "galaxy", "solar system", "planet", "god", "superhero",
  "rocket", "alien", "black hole", "save the world", "break the internet",
  "vũ trụ", "thiên hà", "hệ mặt trời", "hành tinh", "thần", "siêu anh hùng",
  "tên lửa", "người ngoài hành tinh", "hố đen", "cứu thế giới", "bộ óc",
  "chatgpt cũng", "ai cũng phải", "mặt trời cũng", "nasa", "elon musk",
];

function clamp(value: number, maximum: number) {
  return Math.max(0, Math.min(maximum, Math.round(value)));
}

function countMatches(text: string, terms: string[]) {
  return terms.reduce((count, term) => count + (text.includes(term) ? 1 : 0), 0);
}

function stableJitter(text: string) {
  let hash = 0;
  for (const character of text) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return hash % 3;
}

function scoreEntry(entry: JudgeEntry, questionId: string): ScoreBreakdown {
  const question = getQuestionById(questionId);
  if (!question) throw new Error("Unknown round question.");

  const normalized = entry.text.toLocaleLowerCase("vi-VN").trim();
  const words = normalized.match(/[\p{L}\p{N}]+/gu) ?? [];
  const wordCount = words.length;
  const uniqueRatio = wordCount ? new Set(words).size / wordCount : 0;
  const substance = Math.min(1, wordCount / 28);
  const aiHits = countMatches(normalized, aiTerms);
  const reasoningHits = countMatches(normalized, reasoningTerms);
  const clubHits = countMatches(normalized, clubTerms);
  const humorHits = countMatches(normalized, humorTerms);
  const hypeHits = countMatches(normalized, hypeTerms);
  const absurdityHits = countMatches(normalized, absurdityTerms);
  const jitter = stableJitter(normalized);
  const [first, second, third, fourth] = question.rubric;

  let rawScores: number[];
  if (question.type === "hype") {
    const hypeIntensity = Math.min(1, hypeHits / 4);
    const playfulEnergy = Math.min(1, (humorHits + absurdityHits) / 3);
    rawScores = [
      7 + hypeIntensity * 16 + playfulEnergy * 5 + substance * 3 + Math.min(clubHits, 2),
      playfulEnergy * 20 + hypeIntensity * 5 + uniqueRatio * 3 + jitter,
      playfulEnergy * 16 + hypeIntensity * 4 + substance * 2 + jitter,
      Math.min(clubHits, 2) * 4 + substance * 2,
    ];
  } else {
    rawScores = [
      substance * 13 + aiHits * 4 + reasoningHits * 2,
      substance * 12 + reasoningHits * 5 + aiHits * 2,
      substance * 11 + uniqueRatio * 8 + reasoningHits * 2,
      substance * 5 + reasoningHits * 4 + Math.min(aiHits, 2) * 2 + jitter,
    ];
  }

  if (wordCount < 4) rawScores = rawScores.map((score) => Math.min(score, 3));
  const criteria = [first, second, third, fourth];
  let metrics = criteria.map((criterion, index) => ({
    key: criterion.key,
    label: criterion.label,
    score: clamp(rawScores[index], criterion.max),
    max: criterion.max,
  }));
  let alignmentComment: string | null = null;
  if (question.type === "hype") {
    const calibrated = enforceHypeAlignment(metrics, entry.text);
    metrics = calibrated.metrics;
    alignmentComment = hypeAlignmentComment(calibrated.alignment);
  }
  const total = metrics.reduce((sum, metric) => sum + metric.score, 0);

  let comment = "The signal did not make it through — give us a clearer answer next time.";
  if (alignmentComment) {
    comment = alignmentComment;
  } else if (question.type === "hype") {
    if (total >= 82) comment = "Shameless, ridiculous, and cosmically effective. Vintelligence’s ego has officially left the solar system.";
    else if (total >= 62) comment = "Glorious nonsense with real hype energy. Push the exaggeration one galaxy further next time.";
    else if (total >= 38) comment = "The praise landed. Now turn off the logic and make the flattery completely unhinged.";
  } else {
    if (total >= 82) comment = "Accurate, concrete, and cleanly explained — exactly how to make a technical idea feel simple.";
    else if (total >= 62) comment = "The core idea is right; one more concrete detail would make the explanation stronger.";
    else if (total >= 38) comment = "There is a useful idea here, but it needs clearer reasoning and a real example.";
  }

  return { id: entry.id, metrics, total, comment };
}

export function buildFallbackResult(
  round: number,
  questionId: string,
  entries: JudgeEntry[],
  warning?: string,
): JudgeResponse {
  const players = entries
    .map((entry) => scoreEntry(entry, questionId))
    .sort((a, b) => a.id.localeCompare(b.id));
  const playerA = players.find((player) => player.id === "A");
  const playerB = players.find((player) => player.id === "B");

  let winner: PlayerId | "tie" = "tie";
  if (playerA && playerB) {
    if (playerA.total > playerB.total) winner = "A";
    if (playerB.total > playerA.total) winner = "B";
  }

  return { round, questionId, players, winner, mode: "fallback", warning };
}
