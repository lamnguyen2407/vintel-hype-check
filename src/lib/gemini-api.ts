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
  fallbackModels?: string[];
  prompt: string;
  systemPrompt?: string;
  audio?: { mimeType: string; data: string };
  responseJsonSchema?: Record<string, unknown>;
  temperature?: number;
};

export type GeminiGenerationResult = {
  text: string;
  model: string;
};

class GeminiApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "GeminiApiError";
    this.status = status;
  }
}

const DEFAULT_FALLBACK_MODELS = ["gemini-2.5-flash", "gemini-2.5-flash-lite"];

export function getGeminiModelChain(primaryModel: string) {
  const configuredFallbacks = process.env.GEMINI_FALLBACK_MODELS
    ?.split(",")
    .map((model) => model.trim())
    .filter(Boolean);

  return [...new Set([primaryModel, ...(configuredFallbacks?.length ? configuredFallbacks : DEFAULT_FALLBACK_MODELS)])];
}

function isRetryable(error: unknown) {
  if (!(error instanceof GeminiApiError)) return true;
  return error.status === 429 || error.status >= 500;
}

function wait(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export async function generateGeminiContent({
  apiKey,
  model,
  fallbackModels = [],
  prompt,
  systemPrompt,
  audio,
  responseJsonSchema,
  temperature = 0.2,
}: GenerateGeminiOptions): Promise<GeminiGenerationResult> {
  const parts: GeminiPart[] = [{ text: prompt }];
  if (audio) parts.push({ inlineData: audio });

  const models = [...new Set([model, ...fallbackModels])];
  let lastError: unknown = new Error("No Gemini model was available.");

  for (const [modelIndex, candidateModel] of models.entries()) {
    const attempts = modelIndex === 0 ? 2 : 1;

    for (let attempt = 0; attempt < attempts; attempt += 1) {
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(candidateModel)}:generateContent`,
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
            signal: AbortSignal.timeout(20_000),
          },
        );

        const payload = (await response.json()) as GeminiResponse;
        if (!response.ok) {
          throw new GeminiApiError(
            payload.error?.message || `Gemini API returned ${response.status}.`,
            response.status,
          );
        }

        const text = payload.candidates?.[0]?.content?.parts
          ?.map((part) => part.text ?? "")
          .join("")
          .trim();

        if (!text) throw new Error("Gemini returned no text.");
        return { text, model: candidateModel };
      } catch (error) {
        lastError = error;
        if (error instanceof GeminiApiError && (error.status === 401 || error.status === 403)) {
          throw error;
        }
        const canRetryCurrentModel = attempt + 1 < attempts && isRetryable(error);
        if (canRetryCurrentModel) await wait(450 * (attempt + 1));
        else break;
      }
    }
  }

  throw lastError;
}
