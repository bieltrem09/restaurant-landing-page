import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { missingEnv } from "@/lib/config";

const PUBLIC = [/^\/login/, /^\/auth\//, /^\/d\//, /^\/p\//, /^\/privacidade/, /^\/t\.js/, /^\/api\/track/, /^\/api\/cron\//];

/** Renova a sessão do Supabase e manda quem não está logado para /login. */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const path = request.nextUrl.pathname;
  // Sem Supabase configurado, mostra a tela de configuração em vez de quebrar com erro 500.
  if (missingEnv().length) {
    if (path === "/configuracao" || path === "/privacidade" || path === "/t.js") return response;
    if (path.startsWith("/api/")) return NextResponse.json({ error: "Code Max ainda não configurado." }, { status: 503 });
    const to = request.nextUrl.clone();
    to.pathname = "/configuracao";
    to.search = "";
    return NextResponse.redirect(to);
  }
  if (!url || !key) return response;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list, headers) => {
        list.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers ?? {}).forEach(([k, v]) => response.headers.set(k, v));
      },
    },
  });
  const { data } = await supabase.auth.getUser();
  if (!data.user && !PUBLIC.some((r) => r.test(path))) {
    if (path.startsWith("/api/")) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    const to = request.nextUrl.clone();
    to.pathname = "/login";
    to.search = "";
    return NextResponse.redirect(to);
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
