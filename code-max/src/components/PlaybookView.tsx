"use client";

import { BookOpen, Check, Pencil, Plus, Sparkles, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { deletePlaybookEntry, extractLessons, savePlaybookEntry } from "@/app/actions";
import { NICHES, nicheLabel } from "@/lib/niches";
import type { PlaybookEntry } from "@/lib/types";
import { Markdown } from "./Markdown";
import { EmptyState, Modal, useToast } from "./ui";

export function PlaybookView({ entries, feedback }: { entries: PlaybookEntry[]; feedback: Array<{ id: string; feedback_texto: string | null; criado_em: string }> }) {
  const [raw, setRaw] = useState("");
  const [nicho, setNicho] = useState("");
  const [busy, setBusy] = useState(false);
  const [edit, setEdit] = useState<Partial<PlaybookEntry> | null>(null);
  const router = useRouter();
  const toast = useToast();

  async function run(fn: () => Promise<{ ok: boolean; error?: string }>, title: string) {
    const r = await fn();
    toast(r.ok ? { title } : { title: "Não deu certo", body: r.error });
    if (r.ok) router.refresh();
    return r.ok;
  }

  const pending = entries.filter((e) => !e.aprovado);
  const approved = entries.filter((e) => e.aprovado);

  return (
    <>
      <header className="top">
        <div className="top-title">
          <span className="eyebrow">Playbook</span>
          <h1>O que a Ordeliry aprendeu com as suas vendas</h1>
          <p className="sub">Só entradas aprovadas entram no contexto da Ordeliry.</p>
        </div>
        <button className="btn btn-ghost" type="button" onClick={() => setEdit({ titulo: "", conteudo: "", nicho: null, aprovado: true })}>
          <Plus size={16} /> Escrever entrada
        </button>
      </header>

      <div className="grid">
        <section className="card span-5" style={{ alignSelf: "start" }}>
          <header className="card-h">
            <div>
              <h2 className="card-t">Extrair lições</h2>
              <p>Cole uma conversa (ganha ou perdida) ou a transcrição de um vídeo/ligação.</p>
            </div>
          </header>
          <div style={{ display: "grid", gap: 10 }}>
            <textarea value={raw} onChange={(e) => setRaw(e.target.value)} style={{ minHeight: 200 }} aria-label="Conversa ou transcrição" />
            <select value={nicho} onChange={(e) => setNicho(e.target.value)} aria-label="Nicho">
              <option value="">Qualquer nicho</option>
              {NICHES.map((n) => (
                <option key={n.key} value={n.key}>
                  {n.label}
                </option>
              ))}
            </select>
            <button
              className="btn btn-lime"
              type="button"
              disabled={busy || raw.trim().length < 40}
              onClick={async () => {
                setBusy(true);
                if (await run(() => extractLessons(raw, nicho || null), "Lições extraídas. Revise e aprove.")) setRaw("");
                setBusy(false);
              }}
            >
              <Sparkles size={16} /> {busy ? "Analisando…" : "Extrair com a Ordeliry"}
            </button>
            <p className="muted" style={{ margin: 0, fontSize: 12.5 }}>Para prints, transcreva primeiro em Conversas e cole o texto aqui.</p>
          </div>
          {!!feedback.length && (
            <>
              <h3 className="card-t" style={{ marginTop: 20, fontSize: 14 }}>
                O que faltou nas respostas (👎)
              </h3>
              {feedback.map((f) => (
                <div key={f.id} className="list-row">
                  <small>{f.feedback_texto}</small>
                </div>
              ))}
            </>
          )}
        </section>

        <section className="span-7 stack" style={{ gridTemplateColumns: "minmax(0,1fr)" }}>
          {!!pending.length && (
            <div className="card">
              <h2 className="card-t">Aguardando aprovação</h2>
              {pending.map((e) => (
                <Entry key={e.id} e={e} onEdit={() => setEdit(e)} onApprove={() => run(() => savePlaybookEntry({ ...e, aprovado: true }), "Aprovado")} onDelete={() => run(() => deletePlaybookEntry(e.id), "Removido")} />
              ))}
            </div>
          )}
          <div className="card">
            <h2 className="card-t">Aprovadas</h2>
            {approved.length ? (
              approved.map((e) => <Entry key={e.id} e={e} onEdit={() => setEdit(e)} onDelete={() => confirm("Remover esta entrada?") && run(() => deletePlaybookEntry(e.id), "Removido")} />)
            ) : (
              <EmptyState icon={<BookOpen size={22} />} title="Playbook vazio" />
            )}
          </div>
        </section>
      </div>

      <Modal
        open={!!edit}
        onClose={() => setEdit(null)}
        title={edit?.id ? "Editar entrada" : "Nova entrada"}
        wide
        actions={
          <button
            className="btn btn-lime"
            type="button"
            onClick={async () => edit && (await run(() => savePlaybookEntry({ id: edit.id, titulo: edit.titulo ?? "", conteudo: edit.conteudo ?? "", nicho: edit.nicho ?? null, aprovado: edit.aprovado ?? true }), "Salvo")) && setEdit(null)}
          >
            Salvar
          </button>
        }
      >
        {edit && (
          <div style={{ display: "grid", gap: 10 }}>
            <input type="text" value={edit.titulo ?? ""} onChange={(e) => setEdit({ ...edit, titulo: e.target.value })} placeholder="Título" aria-label="Título" />
            <select value={edit.nicho ?? ""} onChange={(e) => setEdit({ ...edit, nicho: e.target.value || null })} aria-label="Nicho">
              <option value="">Qualquer nicho</option>
              {NICHES.map((n) => (
                <option key={n.key} value={n.key}>
                  {n.label}
                </option>
              ))}
            </select>
            <textarea value={edit.conteudo ?? ""} onChange={(e) => setEdit({ ...edit, conteudo: e.target.value })} style={{ minHeight: 300 }} aria-label="Conteúdo" />
          </div>
        )}
      </Modal>
    </>
  );
}

function Entry({ e, onEdit, onApprove, onDelete }: { e: PlaybookEntry; onEdit: () => void; onApprove?: () => void; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ borderTop: "1px solid var(--line)", padding: "12px 0" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <button type="button" onClick={() => setOpen((v) => !v)} style={{ textAlign: "left", flex: 1, minWidth: 0 }} aria-expanded={open}>
          <b>{e.titulo}</b>
          <small className="muted" style={{ display: "block" }}>
            {e.nicho ? nicheLabel(e.nicho) : "Qualquer nicho"} · {e.fonte}
          </small>
        </button>
        <div className="page-actions">
          {onApprove && (
            <button className="btn btn-sm btn-lime" type="button" onClick={onApprove}>
              <Check size={14} /> Aprovar
            </button>
          )}
          <button className="btn btn-sm btn-ghost" type="button" aria-label="Editar" onClick={onEdit}>
            <Pencil size={14} />
          </button>
          <button className="btn btn-sm btn-ghost" type="button" aria-label="Remover" onClick={onDelete}>
            <Trash2 size={14} />
          </button>
        </div>
      </div>
      {open && (
        <div className="bubble assistant" style={{ maxWidth: "100%", marginTop: 10 }}>
          <Markdown text={e.conteudo} />
        </div>
      )}
    </div>
  );
}
