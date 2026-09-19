import { z } from "zod";

export const judgeRequestSchema = z.object({
  round: z.number().int().min(1).max(3),
  questionId: z.string().trim().min(1).max(80),
  entries: z
    .array(
      z.object({
        id: z.enum(["A", "B"]),
        text: z.string().trim().max(1_200),
      }),
    )
    .length(2)
    .refine((entries) => new Set(entries.map((entry) => entry.id)).size === 2, {
      message: "Entries must contain one Player A and one Player B.",
    }),
});

const playerScoreSchema = z.object({
  id: z.enum(["A", "B"]),
  criterion1: z.number().int().min(0).max(100),
  criterion2: z.number().int().min(0).max(100),
  criterion3: z.number().int().min(0).max(100),
  criterion4: z.number().int().min(0).max(100),
  comment: z.string().min(1).max(220),
});

export const judgeModelSchema = z.object({
  players: z
    .array(playerScoreSchema)
    .length(2)
    .refine((players) => new Set(players.map((player) => player.id)).size === 2, {
      message: "Scores must contain one Player A and one Player B.",
    }),
});

export type JudgeRequest = z.infer<typeof judgeRequestSchema>;
export type JudgeModelOutput = z.infer<typeof judgeModelSchema>;
