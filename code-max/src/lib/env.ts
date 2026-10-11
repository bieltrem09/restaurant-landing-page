import "server-only";
import { z } from "zod";

const schema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  GOOGLE_MAPS_API_KEY: z.string().optional(),
  PAGESPEED_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().default("claude-sonnet-5-5"),
  APP_URL: z.string().url().default("http://localhost:3000"),
  CRON_SECRET: z.string().optional(),
  PLACES_MONTHLY_CALL_LIMIT: z.coerce.number().int().positive().default(2000),
});

let cached: z.infer<typeof schema> | null = null;

/** Lê e valida as variáveis de ambiente do servidor (só na primeira chamada). */
export function env() {
  if (!cached) cached = schema.parse(process.env);
  return cached;
}

export function appUrl(): string {
  return (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
}
