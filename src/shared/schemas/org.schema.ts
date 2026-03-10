import { z } from "zod";

export const createOrgSchema = z.object({
  name: z.string().min(1).max(255),
  country: z.string().min(2).max(3).default("CO"),
  currency: z.string().min(3).max(3).default("COP"),
});

export type CreateOrgInput = z.infer<typeof createOrgSchema>;
