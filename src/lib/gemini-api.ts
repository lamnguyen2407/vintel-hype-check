type GeminiPart =
  | { text: string }
  | { inlineData: { mimeType: string; data: string } };

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
  error?: { message?: string; status?: string };
};

type GenerateGeminiOptions = {
  apiKey: string;
  model: string;
  prompt: string;
  systemPrompt?: string;
  audio?: { mimeType: string; data: string };
  responseJsonSchema?: Record<string, unknown>;
  temperature?: number;
};

export async function generateGeminiContent({
  apiKey,
  model,
  prompt,
  systemPrompt,
  audio,
  responseJsonSchema,
  temperature = 0.2,
}: GenerateGeminiOptions) {
  const parts: GeminiPart[] = [{ text: prompt }];
  if (audio) parts.push({ inlineData: audio });

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        contents: [{ role: "user", parts }],
        ...(systemPrompt
          ? { systemInstruction: { parts: [{ text: systemPrompt }] } }
          : {}),
        generationConfig: {
          temperature,
          ...(responseJsonSchema
            ? {
                responseMimeType: "application/json",
                responseJsonSchema,
              }
            : {}),
        },
      }),
      signal: AbortSignal.timeout(25_000),
    },
  );

  const payload = (await response.json()) as GeminiResponse;
  if (!response.ok) {
    throw new Error(payload.error?.message || `Gemini API returned ${response.status}.`);
  }

  const text = payload.candidates?.[0]?.content?.parts
    ?.map((part) => part.text ?? "")
    .join("")
    .trim();

  if (!text) throw new Error("Gemini returned no text.");
  return text;
}
