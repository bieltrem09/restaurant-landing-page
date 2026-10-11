"use client";

import { Store } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

type Mode = "entrar" | "criar" | "esqueci";

/** Traduz os erros do Supabase Auth para algo que o vendedor entenda e saiba resolver. */
function explain(e: { message: string; code?: string }): string {
  const m = e.message.toLowerCase();
  if (e.code === "email_not_confirmed" || m.includes("email not confirmed")) return "Você ainda não confirmou o e-mail. Abra o link que enviamos (veja também o spam) ou reenvie abaixo.";
  if (e.code === "invalid_credentials" || m.includes("invalid login credentials")) return "E-mail ou senha incorretos. Se ainda não tem conta, clique em “Criar conta”.";
  if (e.code === "user_already_exists" || m.includes("already registered")) return "Este e-mail já tem conta. Use “Entrar” ou “Esqueci a senha”.";
  if (e.code === "weak_password" || m.includes("password should")) return "Senha fraca. Use pelo menos 8 caracteres, misturando letras e números.";
  if (m.includes("provider is not enabled") || m.includes("unsupported provider")) return "O login com Google ainda não foi ativado no Supabase (Authentication → Providers → Google). Por enquanto, use e-mail e senha.";
  if (e.code === "email_address_invalid" || m.includes("is invalid")) return "Este e-mail não é válido. Confira se está escrito certo (ex.: @gmail.com).";
  if (e.code === "over_email_send_rate_limit" || m.includes("rate limit")) return "Muitas tentativas seguidas: o Supabase limitou o envio de e-mails. Espere cerca de 1 hora ou peça para desativar a confirmação por e-mail.";
  if (m.includes("signups not allowed")) return "Cadastro de novos usuários desativado no Supabase.";
  return e.message;
}

const DOMAIN_TYPOS: Record<string, string> = {
  "gmal.com": "gmail.com", "gmial.com": "gmail.com", "gmai.com": "gmail.com", "gamil.com": "gmail.com", "gmail.co": "gmail.com", "gmail.con": "gmail.com", "gnail.com": "gmail.com",
  "hotmal.com": "hotmail.com", "hotmai.com": "hotmail.com", "hotmail.con": "hotmail.com", "outlok.com": "outlook.com", "outloo.com": "outlook.com",
  "yaho.com": "yahoo.com", "yahoo.con": "yahoo.com", "yahoo.com.b": "yahoo.com.br", "icloud.con": "icloud.com",
};

/** Sugere a correção quando o domínio parece digitado errado (ex.: gmal.com → gmail.com). */
export function emailTypo(email: string): string | null {
  const [user, domain] = email.trim().toLowerCase().split("@");
  if (!user || !domain) return null;
  const fix = DOMAIN_TYPOS[domain];
  return fix ? `${user}@${fix}` : null;
}

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [mode, setMode] = useState<Mode>("entrar");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(params.get("erro"));
  const [ok, setOk] = useState<string | null>(null);
  const [unconfirmed, setUnconfirmed] = useState(false);
  const [busy, setBusy] = useState(false);

  const callback = (next?: string) => `${location.origin}/auth/callback${next ? `?next=${encodeURIComponent(next)}` : ""}`;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    setOk(null);
    setUnconfirmed(false);
    const sb = supabaseBrowser();
    const mail = email.trim().toLowerCase();
    const typo = emailTypo(mail);
    if (typo) {
      setBusy(false);
      setEmail(typo);
      return setMsg(`Parece que o e-mail estava errado. Corrigimos para ${typo} — confira e clique de novo.`);
    }
    try {
      if (mode === "esqueci") {
        const { error } = await sb.auth.resetPasswordForEmail(mail, { redirectTo: callback("/redefinir-senha") });
        if (error) return setMsg(explain(error));
        return setOk("Se existir conta com este e-mail, enviamos um link para criar uma nova senha.");
      }
      if (mode === "criar") {
        const { data, error } = await sb.auth.signUp({ email: mail, password, options: { emailRedirectTo: callback() } });
        if (error) return setMsg(explain(error));
        // Supabase devolve usuário sem identidades quando o e-mail já existe.
        if (data.user && data.user.identities?.length === 0) return setMsg("Este e-mail já tem conta. Use “Entrar” ou “Esqueci a senha”.");
        if (!data.session) {
          setUnconfirmed(true);
          return setOk(`Conta criada. Enviamos um link de confirmação para ${mail}. Abra o e-mail (veja também o spam) e depois entre aqui.`);
        }
      } else {
        const { error } = await sb.auth.signInWithPassword({ email: mail, password });
        if (error) {
          if (error.code === "email_not_confirmed" || error.message.toLowerCase().includes("not confirmed")) setUnconfirmed(true);
          return setMsg(explain(error));
        }
      }
      router.push("/");
      router.refresh();
    } catch {
      setMsg("Não foi possível falar com o servidor de login. Confira sua conexão e tente de novo.");
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    setMsg(null);
    setBusy(true);
    const { data, error } = await supabaseBrowser().auth.signInWithOAuth({ provider: "google", options: { redirectTo: callback(), skipBrowserRedirect: true } });
    if (error || !data?.url) {
      setBusy(false);
      return setMsg(error ? explain(error) : "Não foi possível abrir o login do Google.");
    }
    location.assign(data.url);
  }

  async function resend() {
    setBusy(true);
    const { error } = await supabaseBrowser().auth.resend({ type: "signup", email: email.trim().toLowerCase(), options: { emailRedirectTo: callback() } });
    setBusy(false);
    if (error) setMsg(explain(error));
    else {
      setMsg(null);
      setOk("Reenviamos o link de confirmação. Veja sua caixa de entrada e o spam.");
    }
  }

  const title = mode === "entrar" ? "Entrar" : mode === "criar" ? "Criar conta" : "Esqueci a senha";

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
        <h1 style={{ font: "650 24px/1.15 var(--f-display)", letterSpacing: "-.02em" }}>{title}</h1>

        {mode !== "esqueci" && (
          <>
            <button className="btn btn-ghost" type="button" onClick={google} disabled={busy}>
              <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
                <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.3-.4-3.5z" />
                <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
                <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
                <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.3-.4-3.5z" />
              </svg>
              Continuar com Google
            </button>
            <div className="muted" style={{ textAlign: "center", fontSize: 12 }}>ou com e-mail</div>
          </>
        )}

        <div className="field">
          <label htmlFor="email">E-mail</label>
          <input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        {mode !== "esqueci" && (
          <div className="field">
            <label htmlFor="senha">
              Senha
              {mode === "entrar" && (
                <button className="link-btn" type="button" style={{ padding: 0 }} onClick={() => (setMode("esqueci"), setMsg(null), setOk(null))}>
                  Esqueci a senha
                </button>
              )}
            </label>
            <input id="senha" type="password" autoComplete={mode === "entrar" ? "current-password" : "new-password"} minLength={mode === "criar" ? 8 : 6} required value={password} onChange={(e) => setPassword(e.target.value)} />
            {mode === "criar" && <span className="hint">Mínimo de 8 caracteres.</span>}
          </div>
        )}

        {msg && (
          <p role="alert" style={{ margin: 0, color: "var(--bad)", fontSize: 13 }}>
            {msg}
          </p>
        )}
        {ok && (
          <p role="status" style={{ margin: 0, color: "var(--good)", fontSize: 13 }}>
            {ok}
          </p>
        )}
        {unconfirmed && email && (
          <button className="link-btn" type="button" onClick={resend} disabled={busy} style={{ justifySelf: "start", padding: 0 }}>
            Reenviar e-mail de confirmação
          </button>
        )}

        <button className="btn btn-lime" type="submit" disabled={busy}>
          {busy ? "Aguarde…" : mode === "esqueci" ? "Enviar link" : title}
        </button>

        <button
          className="link-btn"
          type="button"
          onClick={() => {
            setMode(mode === "entrar" ? "criar" : "entrar");
            setMsg(null);
            setOk(null);
          }}
          style={{ justifySelf: "center" }}
        >
          {mode === "entrar" ? "Ainda não tem conta? Criar conta" : "Já tem conta? Entrar"}
        </button>
        <Link href="/privacidade" className="muted" style={{ fontSize: 12, justifySelf: "center" }}>
          Privacidade e LGPD
        </Link>
      </form>
    </div>
  );
}
