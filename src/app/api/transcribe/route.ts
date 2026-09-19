import { generateGeminiContent, getGeminiModelChain } from "@/lib/gemini-api";

export const runtime = "nodejs";

const MAX_AUDIO_BYTES = 12 * 1024 * 1024;

function normalizeClubVocabulary(text: string) {
  return text
    .replace(/\b(?:vin|vint|vent)\s+intelligence\b/gi, "Vintelligence")
    .replace(/\bvintellig(?:ence|ience|ents)\b/gi, "Vintelligence")
    .replace(/\bintelligience\b/gi, "Vintelligence")
    .replace(/\bintelligence\s+(club|clb)\b/gi, "Vintelligence $1")
    .replace(/\bvin\s+university\b/gi, "VinUniversity")
    .replace(/\bvin\s*uni\b/gi, "VinUni")
    .replace(/\s+/g, " ")
    .trim();
}

export async function POST(request: Request) {
  if (!process.env.GEMINI_API_KEY) {
    return Response.json({ error: "Advanced transcription is not configured." }, { status: 503 });
  }

  try {
    const form = await request.formData();
    const audio = form.get("audio");
    const language = form.get("language") === "en-US" ? "en" : "vi";

    if (!(audio instanceof File) || audio.size === 0) {
      return Response.json({ error: "No audio recording was received." }, { status: 400 });
    }
    if (audio.size > MAX_AUDIO_BYTES) {
      return Response.json({ error: "The audio recording is too large." }, { status: 413 });
    }

    const vocabularyPrompt = language === "vi"
      ? "Transcribe this recording faithfully in Vietnamese, preserving any English AI terms. Return only the transcript, with no labels or commentary. Important names: Vintelligence, Vintel, VinUniversity, VinUni, Data Science and AI Club. Spell these names exactly. Ignore background music and unrelated voices."
      : "Transcribe this recording faithfully in English. Return only the transcript, with no labels or commentary. Important names: Vintelligence, Vintel, VinUniversity, VinUni, Data Science and AI Club. Spell these names exactly. Ignore background music and unrelated voices.";

    const primaryModel = process.env.GEMINI_TRANSCRIBE_MODEL ?? "gemini-2.5-flash";
    const [model, ...fallbackModels] = getGeminiModelChain(primaryModel);
    const result = await generateGeminiContent({
      apiKey: process.env.GEMINI_API_KEY,
      model,
      fallbackModels,
      prompt: vocabularyPrompt,
      audio: {
        mimeType: audio.type || "audio/webm",
        data: Buffer.from(await audio.arrayBuffer()).toString("base64"),
      },
      temperature: 0,
    });

    const normalizedText = normalizeClubVocabulary(result.text);
    if (!normalizedText) return Response.json({ error: "No speech was detected." }, { status: 422 });
    return Response.json({ text: normalizedText, model: result.model });
  } catch (error) {
    console.error("Transcription API failed:", error);
    return Response.json({ error: "Advanced transcription failed. The live transcript is still available." }, { status: 502 });
  }
}
