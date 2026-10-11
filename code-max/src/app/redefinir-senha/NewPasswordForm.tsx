"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

export function NewPasswordForm() {
  const router = useRouter();
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <div className="auth-wrap">
      <form
        className="auth-card"
        onSubmit={async (e) => {
          e.preventDefault();
          if (pw !== pw2) return setMsg("As senhas não são iguais.");
          setBusy(true);
          const { error } = await supabaseBrowser().auth.updateUser({ password: pw });
          setBusy(false);
          if (error) return setMsg(error.message.toLowerCase().includes("session") ? "O link expirou. Peça um novo em “Esqueci a senha”." : error.message);
          router.push("/");
          router.refresh();
        }}
      >
        <h1 style={{ font: "650 24px/1.15 var(--f-display)", letterSpacing: "-.02em" }}>Criar nova senha</h1>
        <div className="field">
          <label htmlFor="np">Nova senha</label>
          <input id="np" type="password" autoComplete="new-password" minLength={8} required value={pw} onChange={(e) => setPw(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="np2">Repita a senha</label>
          <input id="np2" type="password" autoComplete="new-password" minLength={8} required value={pw2} onChange={(e) => setPw2(e.target.value)} />
        </div>
        {msg && <p role="alert" style={{ margin: 0, color: "var(--bad)", fontSize: 13 }}>{msg}</p>}
        <button className="btn btn-lime" type="submit" disabled={busy}>
          Salvar senha
        </button>
      </form>
    </div>
  );
}
