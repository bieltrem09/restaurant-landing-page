import { z } from "zod";
import { NICHE_BY_KEY } from "@/lib/niches";

export const searchSchema = z.object({
  nicho: z.string().refine((k) => k in NICHE_BY_KEY, "nicho desconhecido"),
  cidade: z.string().trim().min(2, "informe a cidade").max(80),
  bairro: z.string().trim().max(80).optional().nullable(),
  lat: z.number().min(-90).max(90).optional().nullable(),
  lng: z.number().min(-180).max(180).optional().nullable(),
  raioKm: z.number().min(1).max(20),
});
export type SearchInput = z.infer<typeof searchSchema>;
