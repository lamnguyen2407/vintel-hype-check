import OpenAI from "openai";

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
  if (!process.env.OPENAI_API_KEY) {
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
      ? "Bản ghi có thể nói tiếng Việt xen tiếng Anh về AI và machine learning. Tên riêng quan trọng: Vintelligence, Vintel, VinUniversity, VinUni, Data Science and AI Club. Giữ nguyên chính xác các tên riêng này."
      : "The recording discusses AI and machine learning. Important proper nouns: Vintelligence, Vintel, VinUniversity, VinUni, Data Science and AI Club. Spell these names exactly.";

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const transcription = await client.audio.transcriptions.create({
      file: audio,
      model: process.env.OPENAI_TRANSCRIBE_MODEL ?? "gpt-4o-transcribe",
      language,
      prompt: vocabularyPrompt,
      response_format: "json",
      chunking_strategy: "auto",
      temperature: 0,
    });

    const text = normalizeClubVocabulary(transcription.text);
    if (!text) return Response.json({ error: "No speech was detected." }, { status: 422 });
    return Response.json({ text, model: process.env.OPENAI_TRANSCRIBE_MODEL ?? "gpt-4o-transcribe" });
  } catch (error) {
    console.error("Transcription API failed:", error);
    return Response.json({ error: "Advanced transcription failed. The live transcript is still available." }, { status: 502 });
  }
}
