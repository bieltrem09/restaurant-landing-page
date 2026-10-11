import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { missingEnv, OPTIONAL_ENV } from "@/lib/config";

export const metadata: Metadata = { title: "Configuração", robots: { index: false } };
export const dynamic = "force-dynamic";

/** Mostra só os NOMES das variáveis que faltam, nunca valores. */
export default async function Configuracao({ searchParams }: PageProps<"/configuracao">) {
  const sp = await searchParams;
  const faltando = missingEnv();
  if (sp.banco === "1" && !faltando.length)
    return (
      <div className="auth-wrap">
        <div className="auth-card" style={{ width: "min(560px, 100%)" }}>
          <span className="eyebrow">Code Max · configuração</span>
          <h1 style={{ font: "650 24px/1.15 var(--f-display)", letterSpacing: "-.02em", margin: 0 }}>Falta criar as tabelas do banco</h1>
          <p style={{ margin: 0, color: "var(--ink-2)" }}>
            O Supabase está conectado, mas as tabelas do Code Max ainda não existem. No painel do Supabase, abra <b>SQL Editor</b>, cole todo o conteúdo do arquivo{" "}
            <code>code-max/supabase/migrations/0001_init.sql</code> e clique em <b>Run</b>. Depois recarregue esta página.
          </p>
          <Link className="btn btn-lime" href="/">
            Já rodei, tentar de novo
          </Link>
        </div>
      </div>
    );
  if (!faltando.length) redirect("/login");
  const opcionais = OPTIONAL_ENV.filter((k) => !process.env[k]);
  return (
    <div className="auth-wrap">
      <div className="auth-card" style={{ width: "min(560px, 100%)" }}>
        <span className="eyebrow">Code Max · configuração</span>
        <h1 style={{ font: "650 24px/1.15 var(--f-display)", letterSpacing: "-.02em", margin: 0 }}>Falta conectar o banco de dados</h1>
        <p style={{ margin: 0, color: "var(--ink-2)" }}>
          O site está no ar, mas ainda não tem as chaves do Supabase. Cadastre estas variáveis na Vercel (Settings → Environment Variables) e faça um novo deploy:
        </p>
        <ul style={{ margin: 0, paddingLeft: 18, fontFamily: "var(--f-mono)", fontSize: 13 }}>
          {faltando.map((k) => (
            <li key={k}>{k}</li>
          ))}
        </ul>
        {!!opcionais.length && (
          <>
            <p style={{ margin: 0, color: "var(--ink-2)" }}>Também faltam (necessárias para o Radar, a Ordeliry e os links públicos):</p>
            <ul style={{ margin: 0, paddingLeft: 18, fontFamily: "var(--f-mono)", fontSize: 13, color: "var(--ink-3)" }}>
              {opcionais.map((k) => (
                <li key={k}>{k}</li>
              ))}
            </ul>
          </>
        )}
        <p style={{ margin: 0, color: "var(--ink-3)", fontSize: 13 }}>
          Antes, rode o arquivo <code>supabase/migrations/0001_init.sql</code> no SQL Editor do seu projeto Supabase.
        </p>
      </div>
    </div>
  );
}
