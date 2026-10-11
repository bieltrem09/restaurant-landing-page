/** Variáveis obrigatórias para o app funcionar. Usado sem "server-only" porque o proxy também lê. */
export const REQUIRED_ENV = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"] as const;
/** A service role é usada só em links públicos, rastreamento, cache do Radar e cron. */
export const OPTIONAL_ENV = ["SUPABASE_SERVICE_ROLE_KEY", "GOOGLE_MAPS_API_KEY", "PAGESPEED_API_KEY", "ANTHROPIC_API_KEY", "APP_URL", "CRON_SECRET"] as const;

export function missingEnv(): string[] {
  return REQUIRED_ENV.filter((k) => !process.env[k]);
}

/**
 * Login desligado por enquanto (modo de um único dono). Para religar, defina CODE_MAX_LOGIN=on na Vercel
 * e remova as políticas "_sem_login" do banco (ver supabase/migrations/0003_modo_sem_login.sql).
 */
export const AUTH_ENABLED = process.env.CODE_MAX_LOGIN === "on";

/** Dono fixo do modo sem login (mesmo UUID da função public.app_owner_id() no banco). */
export const OWNER_ID = "7c0de000-0000-4000-8000-000000000001";
