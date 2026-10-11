"use client";

import { Store } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

export function LoginForm() {
  const router = useRouter();
  const [mode, setMode] = useState<"entrar" | "criar">("entrar");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const sb = supabaseBrowser();
    const r =
      mode === "entrar"
        ? await sb.auth.signInWithPassword({ email, password })
        : await sb.auth.signUp({ email, password, options: { emailRedirectTo: `${location.origin}/auth/callback` } });
    setBusy(false);
    if (r.error) return setMsg(r.error.message === "Invalid login credentials" ? "E-mail ou senha incorretos." : r.error.message);
    if (mode === "criar" && !r.data.session) return setMsg("Enviamos um link de confirmação para o seu e-mail.");
    router.push("/");
    router.refresh();
  }

  async function google() {
    await supabaseBrowser().auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${location.origin}/auth/callback` } });
  }

  return (
    <div className="auth-wrap">
      <form className="auth-card" onSubmit={submit}>
        <div className="brand" style={{ color: "var(--ink)" }}>
          <span className="brand-mark">
            <Store size={20} />
          </span>
          <div>
            Code Max<small style={{ color: "var(--ink-3)" }}>CRM para quem vende sites</small>
          </div>
        </div>
        <h1 style={{ font: "650 24px/1.15 var(--f-display)", letterSpacing: "-.02em" }}>{mode === "entrar" ? "Entrar" : "Criar conta"}</h1>
        <div className="field">
          <label htmlFor="email">E-mail</label>
          <input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="senha">Senha</label>
          <input id="senha" type="password" autoComplete={mode === "entrar" ? "current-password" : "new-password"} minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        {msg && <p role="alert" style={{ margin: 0, color: "var(--ink-2)", fontSize: 13 }}>{msg}</p>}
        <button className="btn btn-lime" type="submit" disabled={busy}>
          {mode === "entrar" ? "Entrar" : "Criar conta"}
        </button>
        <button className="btn btn-ghost" type="button" onClick={google}>
          Continuar com Google
        </button>
        <button className="link-btn" type="button" onClick={() => setMode(mode === "entrar" ? "criar" : "entrar")} style={{ justifySelf: "center" }}>
          {mode === "entrar" ? "Ainda não tem conta? Criar conta" : "Já tem conta? Entrar"}
        </button>
        <Link href="/privacidade" className="muted" style={{ fontSize: 12, justifySelf: "center" }}>
          Privacidade e LGPD
        </Link>
      </form>
    </div>
  );
}
