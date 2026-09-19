export type PlayerId = "A" | "B";

export type LanguageCode = "vi-VN" | "en-US";

export type GamePhase =
  | "setup"
  | "ready"
  | "countdown"
  | "speaking"
  | "review"
  | "judging"
  | "round-result"
  | "final-result";

export type Player = {
  id: PlayerId;
  name: string;
  language: LanguageCode;
  transcripts: string[];
  roundScores: number[];
};

export type ScoreBreakdown = {
  id: PlayerId;
  creativity: number;
  eloquence: number;
  specificity: number;
  flattery: number;
  total: number;
  comment: string;
};

export type JudgeMode = "openai" | "fallback";

export type JudgeResponse = {
  round: number;
  players: ScoreBreakdown[];
  winner: PlayerId | "tie";
  mode: JudgeMode;
  warning?: string;
};

export type JudgeEntry = {
  id: PlayerId;
  text: string;
};
