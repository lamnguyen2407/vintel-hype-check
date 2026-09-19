export type RubricCriterion = {
  key: "criterion1" | "criterion2" | "criterion3" | "criterion4";
  label: string;
  max: number;
  description: string;
};

export type RoundQuestion = {
  id: string;
  round: 1 | 2 | 3;
  type: "knowledge" | "hype";
  label: string;
  prompt: string;
  helper: string;
  rubric: RubricCriterion[];
};

const ROUND_ONE_RUBRIC: RubricCriterion[] = [
  { key: "criterion1", label: "AI understanding", max: 35, description: "Technically correct understanding of the AI concept in the question." },
  { key: "criterion2", label: "Practical reasoning", max: 30, description: "Explains how or why the idea works instead of only naming it." },
  { key: "criterion3", label: "Clarity", max: 20, description: "Easy to follow, direct, and understandable to a general audience." },
  { key: "criterion4", label: "Example quality", max: 15, description: "Uses a concrete, relevant, and useful example." },
];

const ROUND_TWO_RUBRIC: RubricCriterion[] = [
  { key: "criterion1", label: "ML understanding", max: 35, description: "Technically correct explanation of machine learning." },
  { key: "criterion2", label: "Explanation", max: 30, description: "Communicates the core mechanism rather than repeating buzzwords." },
  { key: "criterion3", label: "Clarity", max: 20, description: "Simple, well structured, and appropriate for the audience." },
  { key: "criterion4", label: "Creativity", max: 15, description: "Uses an original analogy or memorable way to explain the idea." },
];

const HYPE_RUBRIC: RubricCriterion[] = [
  { key: "criterion1", label: "Humor", max: 35, description: "Actually funny, playful, and entertaining rather than merely positive." },
  { key: "criterion2", label: "Originality", max: 25, description: "Unexpected comparisons, punchlines, and creative exaggeration." },
  { key: "criterion3", label: "Club relevance", max: 20, description: "Specific connection to Vintelligence, VinUniversity, AI, data, or club life." },
  { key: "criterion4", label: "Shameless hype", max: 20, description: "Bold, outrageous, memorable flattery delivered with commitment." },
];

export const ROUND_QUESTIONS: RoundQuestion[] = [
  {
    id: "ai-everyday-problem",
    round: 1,
    type: "knowledge",
    label: "AI IN REAL LIFE",
    prompt: "What is one everyday problem AI can solve, and how would it solve it?",
    helper: "Give one concrete example and explain the basic idea.",
    rubric: ROUND_ONE_RUBRIC,
  },
  {
    id: "ai-smartphone",
    round: 1,
    type: "knowledge",
    label: "AI IN YOUR POCKET",
    prompt: "Where do you see AI on a smartphone, and what does it do for the user?",
    helper: "Choose one feature and explain why AI is useful there.",
    rubric: ROUND_ONE_RUBRIC,
  },
  {
    id: "ai-good-assistant",
    round: 1,
    type: "knowledge",
    label: "SMART ASSISTANTS",
    prompt: "What makes an AI assistant helpful instead of annoying?",
    helper: "Name the quality and explain it with an example.",
    rubric: ROUND_ONE_RUBRIC,
  },
  {
    id: "ml-ten-year-old",
    round: 2,
    type: "knowledge",
    label: "EXPLAIN ML",
    prompt: "How would you explain machine learning to a ten-year-old?",
    helper: "Keep it simple, correct, and memorable.",
    rubric: ROUND_TWO_RUBRIC,
  },
  {
    id: "ml-training-data",
    round: 2,
    type: "knowledge",
    label: "LEARNING FROM DATA",
    prompt: "Why does good training data matter for a machine learning model?",
    helper: "Explain what can happen when the examples are poor.",
    rubric: ROUND_TWO_RUBRIC,
  },
  {
    id: "ml-dog-cat",
    round: 2,
    type: "knowledge",
    label: "TEACH THE MACHINE",
    prompt: "How could you teach a computer to tell cats from dogs?",
    helper: "Describe the data and the learning process in simple terms.",
    rubric: ROUND_TWO_RUBRIC,
  },
  {
    id: "vintel-hype",
    round: 3,
    type: "hype",
    label: "THE SHAMELESS ROUND",
    prompt: "Convince us Vintelligence is the greatest club in the universe.",
    helper: "The funnier, wilder, and more shameless the flattery, the better.",
    rubric: HYPE_RUBRIC,
  },
];

export function getQuestionById(id: string, round?: number) {
  return ROUND_QUESTIONS.find((question) => question.id === id && (round === undefined || question.round === round));
}

export function questionsForRound(round: 1 | 2 | 3) {
  return ROUND_QUESTIONS.filter((question) => question.round === round);
}

export function createQuestionSet() {
  const pick = (round: 1 | 2) => {
    const choices = questionsForRound(round);
    return choices[Math.floor(Math.random() * choices.length)].id;
  };

  return [pick(1), pick(2), "vintel-hype"];
}
