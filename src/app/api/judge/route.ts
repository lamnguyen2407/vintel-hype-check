import { ZodError } from "zod";

import { buildFallbackResult } from "@/lib/fallback-judge";
import { generateGeminiContent, getGeminiModelChain } from "@/lib/gemini-api";
import { getQuestionById } from "@/lib/game-config";
import {
  enforceHypeAlignment,
  hypeAlignmentComment,
} from "@/lib/hype-alignment";
import { buildJudgeInput, JUDGE_SYSTEM_PROMPT } from "@/lib/judge-prompt";
import {
  judgeJsonSchema,
  judgeModelSchema,
  judgeRequestSchema,
  type JudgeModelOutput,
} from "@/lib/judge-schema";
import type { JudgeEntry, JudgeResponse, PlayerId, ScoreBreakdown } from "@/types/game";

export const runtime = "nodejs";

function finalizeScores(
  round: number,
  questionId: string,
  output: JudgeModelOutput,
  entries: JudgeEntry[],
): JudgeResponse {
  const question = getQuestionById(questionId, round);
  if (!question) throw new Error("Unknown round question.");

  const players: ScoreBreakdown[] = output.players
    .map((player) => {
      let metrics = question.rubric.map((criterion) => ({
        key: criterion.key,
        label: criterion.label,
        score: Math.min(criterion.max, Math.max(0, player[criterion.key])),
        max: criterion.max,
      }));
      let comment = player.comment;
      if (question.type === "hype") {
        const transcript = entries.find((entry) => entry.id === player.id)?.text ?? "";
        const calibrated = enforceHypeAlignment(metrics, transcript);
        metrics = calibrated.metrics;
        comment = hypeAlignmentComment(calibrated.alignment) ?? comment;
      }
      return {
        id: player.id,
        metrics,
        total: metrics.reduce((sum, metric) => sum + metric.score, 0),
        comment,
      };
    })
    .sort((a, b) => a.id.localeCompare(b.id));

  const playerA = players.find((player) => player.id === "A");
  const playerB = players.find((player) => player.id === "B");
  let winner: PlayerId | "tie" = "tie";

  if (playerA && playerB) {
    if (playerA.total > playerB.total) winner = "A";
    if (playerB.total > playerA.total) winner = "B";
  }

  return { round, questionId, players, winner, mode: "gemini" };
}

export async function GET() {
  return Response.json({
    configured: Boolean(process.env.GEMINI_API_KEY),
    judgeModel: process.env.GEMINI_JUDGE_MODEL ?? "gemini-2.5-flash",
    transcriptionModel: process.env.GEMINI_TRANSCRIBE_MODEL ?? "gemini-2.5-flash",
  });
}

export async function POST(request: Request) {
  try {
    const payload = judgeRequestSchema.parse(await request.json());
    const question = getQuestionById(payload.questionId, payload.round);
    if (!question) {
      return Response.json({ error: "The selected question is not valid for this round." }, { status: 400 });
    }

    const forceFallback = new URL(request.url).searchParams.get("fallback") === "1";
    if (!process.env.GEMINI_API_KEY || forceFallback) {
      return Response.json(
        buildFallbackResult(
          payload.round,
          payload.questionId,
          payload.entries,
          forceFallback
            ? "The backup judge was requested for this round."
            : "GEMINI_API_KEY is not configured, so the backup judge scored this round.",
        ),
      );
    }

    try {
      const primaryModel = process.env.GEMINI_JUDGE_MODEL ?? "gemini-2.5-flash";
      const [model, ...fallbackModels] = getGeminiModelChain(primaryModel);
      const result = await generateGeminiContent({
        apiKey: process.env.GEMINI_API_KEY,
        model,
        fallbackModels,
        systemPrompt: JUDGE_SYSTEM_PROMPT,
        prompt: buildJudgeInput(question, payload.entries),
        responseJsonSchema: judgeJsonSchema,
        temperature: 0.15,
      });
      const output = judgeModelSchema.parse(JSON.parse(result.text));
      return Response.json(finalizeScores(payload.round, payload.questionId, output, payload.entries));
    } catch (error) {
      console.error("Judge API failed; using automatic backup:", error);
      return Response.json(
        buildFallbackResult(
          payload.round,
          payload.questionId,
          payload.entries,
          "Gemini was temporarily busy, so the backup judge scored this round automatically.",
        ),
      );
    }
  } catch (error) {
    if (error instanceof ZodError) {
      return Response.json({ error: "The match data is invalid.", details: error.issues }, { status: 400 });
    }

    console.error("Judge API failed:", error);
    return Response.json(
      { error: "The AI judge could not process this round." },
      { status: 500 },
    );
  }
}
