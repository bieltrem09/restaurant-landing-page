import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

/** Volta do Google, da confirmação de e-mail e do link de redefinir senha. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const next = url.searchParams.get("next");
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
  const providerError = url.searchParams.get("error_description");

  const fail = (msg: string) => NextResponse.redirect(new URL(`/login?erro=${encodeURIComponent(msg)}`, url.origin));
  if (providerError) return fail(providerError);

  const sb = await supabaseServer();
  if (code) {
    const { error } = await sb.auth.exchangeCodeForSession(code);
    if (error) return fail("O link expirou ou já foi usado. Entre de novo ou peça um novo link.");
  } else if (tokenHash && type) {
    const { error } = await sb.auth.verifyOtp({ token_hash: tokenHash, type });
    if (error) return fail("O link expirou ou já foi usado. Peça um novo link.");
  } else {
    return fail("Link inválido.");
  }
  return NextResponse.redirect(new URL(safeNext, url.origin));
}
