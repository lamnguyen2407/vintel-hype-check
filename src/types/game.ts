export type PlayerId = "A" | "B";

export type LanguageCode = "vi-VN" | "en-US";

export type GamePhase =
  | "setup"
  | "ready"
  | "countdown"
  | "speaking"
  | "transcribing"
  | "review"
  | "judging"
  | "round-result"
  | "final-result";

export type ScoreMetric = {
  key: "criterion1" | "criterion2" | "criterion3" | "criterion4";
  label: string;
  score: number;
  max: number;
};

export type ScoreBreakdown = {
  id: PlayerId;
  metrics: ScoreMetric[];
  total: number;
  comment: string;
};

export type Player = {
  id: PlayerId;
  name: string;
  language: LanguageCode;
  transcripts: string[];
  roundResults: ScoreBreakdown[];
};

export type JudgeMode = "gemini" | "fallback";

export type JudgeResponse = {
  round: number;
  questionId: string;
  players: ScoreBreakdown[];
  winner: PlayerId | "tie";
  mode: JudgeMode;
  warning?: string;
};

export type JudgeEntry = {
  id: PlayerId;
  text: string;
};
