"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { relativeTime } from "@/lib/dates";
import { OrdeliryChat } from "./OrdeliryChat";

type Thread = { id: string; titulo: string; modo: string; lead_id: string | null; atualizado_em: string; leads: { nome: string } | null };

export function OrdeliryPage({ threads, initialThread }: { threads: Thread[]; initialThread: string | null }) {
  const [current, setCurrent] = useState<string | null>(initialThread);
  // `selected` define qual conversa o chat monta; uma conversa nova criada no meio do streaming não remonta o chat.
  const [selected, setSelected] = useState<{ id: string | null; n: number }>({ id: initialThread, n: 0 });
  const pick = (id: string | null) => (setCurrent(id), setSelected((s) => ({ id, n: s.n + 1 })));
  const router = useRouter();
  const thread = threads.find((t) => t.id === selected.id) ?? null;
  return (
    <>
      <header className="top">
        <div className="top-title">
          <span className="eyebrow">Ordeliry</span>
          <h1>
            Sua especialista em <em>vendas consultivas</em>
          </h1>
        </div>
      </header>
      <div className="grid">
        <aside className="card span-4" style={{ alignSelf: "start", maxHeight: "calc(100dvh - 200px)", overflowY: "auto" }}>
          <button className="btn btn-lime" type="button" style={{ width: "100%" }} onClick={() => pick(null)}>
            <Plus size={16} /> Nova conversa
          </button>
          <div style={{ marginTop: 10 }}>
            {threads.map((t) => (
              <button key={t.id} type="button" className="list-row" style={{ width: "100%", textAlign: "left" }} aria-pressed={t.id === current} onClick={() => pick(t.id)}>
                <div style={{ minWidth: 0 }}>
                  <b style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.titulo}</b>
                  <small>
                    {t.leads?.nome ?? "Conversa geral"} · há {relativeTime(t.atualizado_em)}
                  </small>
                </div>
              </button>
            ))}
            {!threads.length && <p className="muted">Nenhuma conversa ainda.</p>}
          </div>
        </aside>
        <section className="card span-8">
          <OrdeliryChat key={selected.n} threadId={selected.id} leadId={thread?.lead_id} leadNome={thread?.leads?.nome} onThread={(id) => (setCurrent(id), router.refresh())} />
        </section>
      </div>
    </>
  );
}
