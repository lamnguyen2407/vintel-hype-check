import { generateGeminiContent, getGeminiModelChain } from "@/lib/gemini-api";

export const runtime = "nodejs";

const MAX_AUDIO_BYTES = 12 * 1024 * 1024;

function normalizeClubVocabulary(text: string) {
  return text
    .replace(/\b(?:vin|vint|vent)\s+intelligence\b/gi, "Vintelligence")
    .replace(/\bvintellig(?:ence|ience|ents)\b/gi, "Vintelligence")
    .replace(/\bintelligience\b/gi, "Vintelligence")
    .replace(/\bintelligence\s+(club|clb)\b/gi, "Vintelligence $1")
    .replace(/\bvin\s*tel\b/gi, "Vintel")
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
    const question = String(form.get("question") ?? "").slice(0, 300);
    const liveTranscript = String(form.get("liveTranscript") ?? "").slice(0, 1_200);

    if (!(audio instanceof File) || audio.size === 0) {
      return Response.json({ error: "No audio recording was received." }, { status: 400 });
    }
    if (audio.size > MAX_AUDIO_BYTES) {
      return Response.json({ error: "The audio recording is too large." }, { status: 413 });
    }

    const languageInstruction = language === "vi"
      ? "The participant is answering mainly in Vietnamese. Preserve English AI/ML terms naturally."
      : "The participant is answering mainly in English.";
    const context = question ? `The on-screen question is: ${JSON.stringify(question)}.` : "";
    const browserHint = liveTranscript
      ? `A noisy browser-generated draft is included only as a phonetic hint and may be wrong: ${JSON.stringify(liveTranscript)}.`
      : "";
    const vocabularyPrompt = [
      "Produce a verbatim transcript of ONLY the foreground participant speaking closest to the microphone.",
      "This was recorded at a very noisy club fair. Aggressively ignore music, announcements, applause, room echo, crowd chatter, and every background or overlapping voice.",
      "When voices overlap, follow the loudest and clearest near-field voice; never merge words from bystanders into the answer.",
      languageInstruction,
      context,
      browserHint,
      "Use the question and draft only to resolve genuinely ambiguous sounds. Never invent, complete, improve, summarize, or answer for the participant.",
      "Important vocabulary: Vintelligence, Vintel, VinUniversity, VinUni, Data Science and AI Club, DSAI, Datathon, artificial intelligence, machine learning.",
      "Spell those names exactly when they are spoken. Keep playful slang and absurd hype exactly as said.",
      "Return only the transcript with normal punctuation. No speaker labels, timestamps, notes, alternatives, or commentary.",
    ].filter(Boolean).join("\n");

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
