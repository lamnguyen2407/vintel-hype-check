import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { ZodError } from "zod";

import { buildFallbackResult } from "@/lib/fallback-judge";
import { getQuestionById } from "@/lib/game-config";
import {
  enforceHypeAlignment,
  hypeAlignmentComment,
} from "@/lib/hype-alignment";
import { buildJudgeInput, JUDGE_SYSTEM_PROMPT } from "@/lib/judge-prompt";
import {
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

  return { round, questionId, players, winner, mode: "openai" };
}

export async function GET() {
  return Response.json({
    configured: Boolean(process.env.OPENAI_API_KEY),
    judgeModel: process.env.OPENAI_MODEL ?? "gpt-6-astra",
    transcriptionModel: process.env.OPENAI_TRANSCRIBE_MODEL ?? "gpt-4o-transcribe",
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
    if (!process.env.OPENAI_API_KEY || forceFallback) {
      return Response.json(
        buildFallbackResult(
          payload.round,
          payload.questionId,
          payload.entries,
          forceFallback
            ? "The backup judge was requested for this round."
            : "OPENAI_API_KEY is not configured, so the backup judge scored this round.",
        ),
      );
    }

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await client.responses.parse({
      model: process.env.OPENAI_MODEL ?? "gpt-6-astra",
      input: [
        { role: "system", content: JUDGE_SYSTEM_PROMPT },
        { role: "user", content: buildJudgeInput(question, payload.entries) },
      ],
      text: { format: zodTextFormat(judgeModelSchema, "hype_check_scores") },
    });

    if (!response.output_parsed) throw new Error("The judge returned no structured score.");
    return Response.json(finalizeScores(payload.round, payload.questionId, response.output_parsed, payload.entries));
  } catch (error) {
    if (error instanceof ZodError) {
      return Response.json({ error: "The match data is invalid.", details: error.issues }, { status: 400 });
    }

    console.error("Judge API failed:", error);
    return Response.json(
      { error: "The AI judge is temporarily unavailable. Try the backup judge." },
      { status: 502 },
    );
  }
}
