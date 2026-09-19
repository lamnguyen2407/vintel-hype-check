import { z } from "zod";

export const judgeRequestSchema = z.object({
  round: z.number().int().min(1).max(9),
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

export const judgeModelSchema = z.object({
  players: z
    .array(
      z.object({
        id: z.enum(["A", "B"]),
        creativity: z.number().int().min(0).max(30),
        eloquence: z.number().int().min(0).max(25),
        specificity: z.number().int().min(0).max(25),
        flattery: z.number().int().min(0).max(20),
        comment: z.string().min(1).max(180),
      }),
    )
    .length(2)
    .refine((players) => new Set(players.map((player) => player.id)).size === 2, {
      message: "Scores must contain one Player A and one Player B.",
    }),
});

export type JudgeRequest = z.infer<typeof judgeRequestSchema>;
export type JudgeModelOutput = z.infer<typeof judgeModelSchema>;
