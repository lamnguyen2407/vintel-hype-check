import type {
  JudgeEntry,
  JudgeResponse,
  PlayerId,
  ScoreBreakdown,
} from "@/types/game";

const clubTerms = [
  "vintelligence",
  "vinuni",
  "vinuniversity",
  "clb",
  "club",
  "data",
  "dữ liệu",
  "ai",
  "trí tuệ nhân tạo",
  "machine learning",
  "khoa học",
  "nghiên cứu",
  "công nghệ",
  "innovation",
];

const imageryTerms = [
  "như",
  "tựa",
  "hơn cả",
  "vũ trụ",
  "ngôi sao",
  "mặt trời",
  "tương lai",
  "phép màu",
  "đỉnh cao",
  "bộ não",
  "trái tim",
  "dream",
  "future",
  "star",
  "universe",
  "brain",
];

const flatteryTerms = [
  "tuyệt vời",
  "xuất sắc",
  "đỉnh",
  "xịn",
  "số một",
  "vô đối",
  "không thể thay thế",
  "best",
  "amazing",
  "brilliant",
  "legendary",
  "incredible",
  "world-class",
];

function clamp(value: number, maximum: number) {
  return Math.max(0, Math.min(maximum, Math.round(value)));
}

function countMatches(text: string, terms: string[]) {
  return terms.reduce((count, term) => count + (text.includes(term) ? 1 : 0), 0);
}

function stableJitter(text: string) {
  let hash = 0;
  for (const character of text) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  }
  return hash % 3;
}

function scoreEntry(entry: JudgeEntry): ScoreBreakdown {
  const normalized = entry.text.toLocaleLowerCase("vi-VN").trim();
  const words = normalized.match(/[\p{L}\p{N}]+/gu) ?? [];
  const uniqueWords = new Set(words);
  const wordCount = words.length;
  const substance = Math.min(1, wordCount / 24);
  const uniqueRatio = wordCount ? uniqueWords.size / wordCount : 0;
  const clubHits = countMatches(normalized, clubTerms);
  const imageryHits = countMatches(normalized, imageryTerms);
  const flatteryHits = countMatches(normalized, flatteryTerms);
  const punctuationVariety = new Set(normalized.match(/[!?.,;:]/g) ?? []).size;
  const jitter = stableJitter(normalized);

  const creativity = clamp(
    substance * 12 + uniqueRatio * 10 + imageryHits * 3 + jitter,
    30,
  );
  const eloquence = clamp(
    substance * 12 + uniqueRatio * 8 + punctuationVariety * 1.5,
    25,
  );
  const specificity = clamp(substance * 7 + clubHits * 5, 25);
  const flattery = clamp(substance * 7 + flatteryHits * 3 + imageryHits, 20);
  const total = creativity + eloquence + specificity + flattery;

  let comment = "The judge is still waiting for a pitch with real conviction.";
  if (total >= 82) comment = "World-class hype — sharp enough to earn an instant club invitation.";
  else if (total >= 68) comment = "Specific, confident, and dramatic enough to make the model blush.";
  else if (total >= 50) comment = "Good instincts. One stronger image or punchline would make it land.";
  else if (total >= 28) comment = "The signal is there, but this pitch needs more evidence and energy.";

  return {
    id: entry.id,
    creativity,
    eloquence,
    specificity,
    flattery,
    total,
    comment,
  };
}

export function buildFallbackResult(
  round: number,
  entries: JudgeEntry[],
  warning?: string,
): JudgeResponse {
  const players = entries.map(scoreEntry).sort((a, b) => a.id.localeCompare(b.id));
  const playerA = players.find((player) => player.id === "A");
  const playerB = players.find((player) => player.id === "B");

  let winner: PlayerId | "tie" = "tie";
  if (playerA && playerB) {
    if (playerA.total > playerB.total) winner = "A";
    if (playerB.total > playerA.total) winner = "B";
  }

  return {
    round,
    players,
    winner,
    mode: "fallback",
    warning,
  };
}
