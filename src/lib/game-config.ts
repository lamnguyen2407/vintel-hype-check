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
  { key: "criterion4", label: "Positive hype", max: 20, description: "Clearly praises Vintelligence with bold, outrageous, memorable flattery. Criticism earns zero here." },
];

export const ROUND_QUESTIONS: RoundQuestion[] = [
  {
    id: "ai-everyday-problem",
    round: 1,
    type: "knowledge",
    label: "AI IN REAL LIFE",
    prompt: "Where is AI used in everyday life?",
    helper: "Choose one familiar use.",
    rubric: ROUND_ONE_RUBRIC,
  },
  {
    id: "ai-smartphone",
    round: 1,
    type: "knowledge",
    label: "AI IN YOUR POCKET",
    prompt: "How does face unlock recognize you?",
    helper: "Explain the basic idea simply.",
    rubric: ROUND_ONE_RUBRIC,
  },
  {
    id: "ai-good-assistant",
    round: 1,
    type: "knowledge",
    label: "SMART ASSISTANTS",
    prompt: "What makes an AI assistant helpful instead of annoying?",
    helper: "Focus on one quality.",
    rubric: ROUND_ONE_RUBRIC,
  },
  {
    id: "ai-definition",
    round: 1,
    type: "knowledge",
    label: "AI BASICS",
    prompt: "What is artificial intelligence?",
    helper: "Explain it in plain language.",
    rubric: ROUND_ONE_RUBRIC,
  },
  {
    id: "ai-needs-data",
    round: 1,
    type: "knowledge",
    label: "DATA FUEL",
    prompt: "Why does AI need data?",
    helper: "Describe what the data provides.",
    rubric: ROUND_ONE_RUBRIC,
  },
  {
    id: "ai-mistakes",
    round: 1,
    type: "knowledge",
    label: "AI ERRORS",
    prompt: "Why can AI make mistakes?",
    helper: "Give one clear reason.",
    rubric: ROUND_ONE_RUBRIC,
  },
  {
    id: "ai-generative",
    round: 1,
    type: "knowledge",
    label: "GENERATIVE AI",
    prompt: "What does generative AI create?",
    helper: "Use a familiar example.",
    rubric: ROUND_ONE_RUBRIC,
  },
  {
    id: "ai-image",
    round: 1,
    type: "knowledge",
    label: "COMPUTER VISION",
    prompt: "How does AI recognize an image?",
    helper: "Keep the process simple.",
    rubric: ROUND_ONE_RUBRIC,
  },
  {
    id: "ai-students",
    round: 1,
    type: "knowledge",
    label: "AI FOR LEARNING",
    prompt: "How can AI help students?",
    helper: "Choose one useful application.",
    rubric: ROUND_ONE_RUBRIC,
  },
  {
    id: "ai-healthcare",
    round: 1,
    type: "knowledge",
    label: "AI IN HEALTHCARE",
    prompt: "How can AI help doctors?",
    helper: "Choose one useful application.",
    rubric: ROUND_ONE_RUBRIC,
  },
  {
    id: "ai-risk",
    round: 1,
    type: "knowledge",
    label: "RESPONSIBLE AI",
    prompt: "What is one risk of AI?",
    helper: "Explain one real concern.",
    rubric: ROUND_ONE_RUBRIC,
  },
  {
    id: "ai-recommendations",
    round: 1,
    type: "knowledge",
    label: "SMART RECOMMENDATIONS",
    prompt: "How does AI recommend videos?",
    helper: "Describe what it learns from.",
    rubric: ROUND_ONE_RUBRIC,
  },
  {
    id: "ml-ten-year-old",
    round: 2,
    type: "knowledge",
    label: "EXPLAIN ML",
    prompt: "How would you explain machine learning to a ten-year-old?",
    helper: "Use simple language.",
    rubric: ROUND_TWO_RUBRIC,
  },
  {
    id: "ml-training-data",
    round: 2,
    type: "knowledge",
    label: "LEARNING FROM DATA",
    prompt: "Why does good training data matter for a machine learning model?",
    helper: "Focus on data quality.",
    rubric: ROUND_TWO_RUBRIC,
  },
  {
    id: "ml-dog-cat",
    round: 2,
    type: "knowledge",
    label: "TEACH THE MACHINE",
    prompt: "How could you teach a computer to tell cats from dogs?",
    helper: "Describe the learning idea simply.",
    rubric: ROUND_TWO_RUBRIC,
  },
  {
    id: "ml-definition",
    round: 2,
    type: "knowledge",
    label: "ML BASICS",
    prompt: "What is machine learning?",
    helper: "Explain it without jargon.",
    rubric: ROUND_TWO_RUBRIC,
  },
  {
    id: "ml-training-data-definition",
    round: 2,
    type: "knowledge",
    label: "TRAINING DATA",
    prompt: "What is training data?",
    helper: "Define it in one clear idea.",
    rubric: ROUND_TWO_RUBRIC,
  },
  {
    id: "ml-model",
    round: 2,
    type: "knowledge",
    label: "THE MODEL",
    prompt: "What is a machine-learning model?",
    helper: "Explain what it has learned.",
    rubric: ROUND_TWO_RUBRIC,
  },
  {
    id: "ml-spam",
    round: 2,
    type: "knowledge",
    label: "SPAM FILTER",
    prompt: "How does a spam filter learn?",
    helper: "Think about labeled examples.",
    rubric: ROUND_TWO_RUBRIC,
  },
  {
    id: "ml-supervised",
    round: 2,
    type: "knowledge",
    label: "SUPERVISED LEARNING",
    prompt: "What is supervised learning?",
    helper: "Explain the role of labels.",
    rubric: ROUND_TWO_RUBRIC,
  },
  {
    id: "ml-testing",
    round: 2,
    type: "knowledge",
    label: "MODEL TESTING",
    prompt: "Why do models need test data?",
    helper: "Focus on fair evaluation.",
    rubric: ROUND_TWO_RUBRIC,
  },
  {
    id: "ml-overfitting",
    round: 2,
    type: "knowledge",
    label: "OVERFITTING",
    prompt: "What is overfitting?",
    helper: "Use a simple explanation.",
    rubric: ROUND_TWO_RUBRIC,
  },
  {
    id: "ml-features",
    round: 2,
    type: "knowledge",
    label: "MODEL INPUTS",
    prompt: "What is a feature in machine learning?",
    helper: "Use one concrete example.",
    rubric: ROUND_TWO_RUBRIC,
  },
  {
    id: "ml-bias",
    round: 2,
    type: "knowledge",
    label: "DATA BIAS",
    prompt: "Why is biased data harmful?",
    helper: "Focus on model decisions.",
    rubric: ROUND_TWO_RUBRIC,
  },
  {
    id: "ml-prediction",
    round: 2,
    type: "knowledge",
    label: "PREDICTION",
    prompt: "How does a model make predictions?",
    helper: "Explain the learned-pattern idea.",
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
