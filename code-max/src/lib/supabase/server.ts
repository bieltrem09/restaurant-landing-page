import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { AUTH_ENABLED, OWNER_ID } from "../config";

/** Cliente com a sessão do usuário (RLS aplicada). */
export async function supabaseServer() {
  const store = await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          // Chamado de um Server Component: o proxy renova a sessão.
        }
      },
    },
  });
}

/** Cliente service role: ignora RLS. Só para rotas públicas (rastreamento, páginas /d e /p), cron e workers. */
export function supabaseAdmin() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    // Sem login, as políticas "_sem_login" dão ao anon acesso às linhas do dono: dá para seguir sem a service role.
    if (!AUTH_ENABLED) return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
    throw new Error("SUPABASE_SERVICE_ROLE_KEY não configurada na Vercel.");
  }
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export type AppUser = { id: string; email?: string | null };

export const getUser = cache(async (): Promise<AppUser | null> => {
  if (!AUTH_ENABLED) return { id: OWNER_ID, email: null };
  const sb = await supabaseServer();
  const { data } = await sb.auth.getUser();
  return data.user;
});

/** Usuário logado ou redireciona para /login. */
export async function requireUser() {
  const user = await getUser();
  if (!user) redirect("/login");
  return user;
}
