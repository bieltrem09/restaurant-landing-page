/** Variáveis obrigatórias para o app funcionar. Usado sem "server-only" porque o proxy também lê. */
export const REQUIRED_ENV = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"] as const;
export const OPTIONAL_ENV = ["GOOGLE_MAPS_API_KEY", "PAGESPEED_API_KEY", "ANTHROPIC_API_KEY", "APP_URL", "CRON_SECRET"] as const;

export function missingEnv(): string[] {
  return REQUIRED_ENV.filter((k) => !process.env[k]);
}
