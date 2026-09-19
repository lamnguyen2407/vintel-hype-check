import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { ZodError } from "zod";

import { buildFallbackResult } from "@/lib/fallback-judge";
import { buildJudgeInput, JUDGE_SYSTEM_PROMPT } from "@/lib/judge-prompt";
import {
  judgeModelSchema,
  judgeRequestSchema,
  type JudgeModelOutput,
} from "@/lib/judge-schema";
import type { JudgeResponse, PlayerId, ScoreBreakdown } from "@/types/game";

export const runtime = "nodejs";

function finalizeScores(
  round: number,
  output: JudgeModelOutput,
): JudgeResponse {
  const players: ScoreBreakdown[] = output.players
    .map((player) => ({
      ...player,
      total:
        player.creativity +
        player.eloquence +
        player.specificity +
        player.flattery,
    }))
    .sort((a, b) => a.id.localeCompare(b.id));

  const playerA = players.find((player) => player.id === "A");
  const playerB = players.find((player) => player.id === "B");
  let winner: PlayerId | "tie" = "tie";

  if (playerA && playerB) {
    if (playerA.total > playerB.total) winner = "A";
    if (playerB.total > playerA.total) winner = "B";
  }

  return { round, players, winner, mode: "openai" };
}

export async function GET() {
  return Response.json({
    configured: Boolean(process.env.OPENAI_API_KEY),
    model: process.env.OPENAI_MODEL ?? "gpt-6-astra",
  });
}

export async function POST(request: Request) {
  try {
    const payload = judgeRequestSchema.parse(await request.json());
    const forceFallback = new URL(request.url).searchParams.get("fallback") === "1";

    if (!process.env.OPENAI_API_KEY || forceFallback) {
      return Response.json(
        buildFallbackResult(
          payload.round,
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
        {
          role: "user",
          content: buildJudgeInput(payload.round, payload.entries),
        },
      ],
      text: {
        format: zodTextFormat(judgeModelSchema, "club_compliment_scores"),
      },
    });

    if (!response.output_parsed) {
      throw new Error("The judge returned no structured score.");
    }

    return Response.json(finalizeScores(payload.round, response.output_parsed));
  } catch (error) {
    if (error instanceof ZodError) {
      return Response.json(
        { error: "The match data is invalid.", details: error.issues },
        { status: 400 },
      );
    }

    console.error("Judge API failed:", error);
    return Response.json(
      { error: "The AI judge is temporarily unavailable. Try the backup judge." },
      { status: 502 },
    );
  }
}
