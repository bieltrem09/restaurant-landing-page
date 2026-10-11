"use client";

import { ClipboardPaste, FileText, ImagePlus, MessageCircle, Mic, Phone, Send, Sparkles } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { addInteraction, saveTranscription } from "@/app/actions";
import { formatDateTimeSP } from "@/lib/dates";
import { nicheLabel } from "@/lib/niches";
import type { Interaction } from "@/lib/types";
import { useApp } from "./app-context";
import { EmptyState, Seg, useToast } from "./ui";

type LeadOpt = { id: string; nome: string; nicho: string; ultimo_contato_em: string | null };
type Transcribed = { quem: "vendedor" | "cliente"; autor: string; hora: string; texto: string };

const TIPO_LABEL: Record<Interaction["tipo"], string> = {
  mensagem_enviada: "Enviada",
  mensagem_recebida: "Recebida",
  ligacao: "Ligação",
  audio: "Áudio",
  nota: "Nota",
};

async function toB64(f: File) {
  const bytes = new Uint8Array(await f.arrayBuffer());
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return { media_type: (["image/png", "image/jpeg", "image/webp"].includes(f.type) ? f.type : "image/png") as "image/png", data: btoa(bin) };
}

export function ConversationsView({ leads, leadId, interactions }: { leads: LeadOpt[]; leadId: string | null; interactions: Interaction[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const toast = useToast();
  const { openOrdeliry, profile } = useApp();
  const [tab, setTab] = useState<"digitar" | "colar" | "prints">("digitar");
  const [tipo, setTipo] = useState<Interaction["tipo"]>("mensagem_enviada");
  const [texto, setTexto] = useState("");
  const [raw, setRaw] = useState("");
  const [preview, setPreview] = useState<{ autores: string[]; total: number } | null>(null);
  const [vendedor, setVendedor] = useState("");
  const [trans, setTrans] = useState<{ mensagens: Transcribed[]; data_visivel: string; observacoes: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const files = useRef<HTMLInputElement>(null);
  const lead = leads.find((l) => l.id === leadId);

  if (!leads.length)
    return (
      <>
        <header className="top">
          <div className="top-title">
            <span className="eyebrow">Conversas</span>
            <h1>Histórico por lead</h1>
          </div>
        </header>
        <div className="card">
          <EmptyState icon={<MessageCircle size={22} />} title="Nenhum lead no pipeline">
            Salve um lead pelo Radar para registrar as conversas com ele.
          </EmptyState>
        </div>
      </>
    );

  async function importExport(confirmar: boolean) {
    if (!leadId) return;
    setBusy(true);
    const r = await fetch("/api/conversations/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ leadId, raw, vendedor: vendedor || undefined, confirmar }) });
    const d = await r.json();
    setBusy(false);
    if (!r.ok) return toast({ title: "Não deu certo", body: d.error });
    if (!confirmar) {
      setPreview({ autores: d.autores, total: d.total });
      setVendedor(d.autores.find((a: string) => profile.nome && a.toLowerCase().includes(profile.nome.split(" ")[0].toLowerCase())) ?? d.autores[0] ?? "");
    } else {
      toast({ title: `${d.salvas} mensagens importadas` });
      setRaw("");
      setPreview(null);
      router.refresh();
    }
  }

  async function readPrints(list: FileList | null) {
    if (!list?.length) return;
    setBusy(true);
    const images = await Promise.all(Array.from(list).slice(0, 8).map(toB64));
    const r = await fetch("/api/ordeliry/vision", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ images }) });
    const d = await r.json();
    setBusy(false);
    if (!r.ok) return toast({ title: "Não deu certo", body: d.error });
    setTrans(d);
  }

  return (
    <>
      <header className="top">
        <div className="top-title">
          <span className="eyebrow">Conversas</span>
          <h1>{lead ? lead.nome : "Histórico por lead"}</h1>
          {lead && <p className="sub">{nicheLabel(lead.nicho)}</p>}
        </div>
        <div className="top-actions">
          <select value={leadId ?? ""} onChange={(e) => router.push(`${pathname}?lead=${e.target.value}`)} aria-label="Escolher lead" style={{ width: "auto", minWidth: 220 }}>
            {leads.map((l) => (
              <option key={l.id} value={l.id}>
                {l.nome}
              </option>
            ))}
          </select>
          {lead && (
            <button className="btn btn-lime" type="button" onClick={() => openOrdeliry({ leadId: lead.id, leadNome: lead.nome, mode: "analisar", prefill: "Analise a conversa registrada com este lead." })}>
              <Sparkles size={16} /> Analisar com a Ordeliry
            </button>
          )}
        </div>
      </header>

      <div className="grid">
        <section className="card span-7">
          <header className="card-h">
            <span className="card-t">Linha do tempo</span>
          </header>
          {interactions.length ? (
            <div className="timeline">
              {interactions.map((i) => (
                <div key={i.id} className={`tl${i.tipo === "mensagem_enviada" ? " out" : ""}`}>
                  <span className="fico">{i.tipo === "ligacao" ? <Phone size={14} /> : i.tipo === "audio" ? <Mic size={14} /> : i.tipo === "nota" ? <FileText size={14} /> : <MessageCircle size={14} />}</span>
                  <div>
                    <div className="tm">
                      <span>{formatDateTimeSP(i.ocorreu_em)}</span>
                      <span>{TIPO_LABEL[i.tipo]}</span>
                      {i.autor && <span>{i.autor}</span>}
                      <span>via {i.origem}</span>
                    </div>
                    <div className="tb">{i.texto}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="muted">Nada registrado com este lead ainda.</p>
          )}
        </section>

        <section className="card span-5" style={{ alignSelf: "start" }}>
          <header className="card-h">
            <span className="card-t">Registrar</span>
            <Seg
              label="Forma de registro"
              value={tab}
              onChange={setTab}
              options={[
                { value: "digitar", label: "Digitar" },
                { value: "colar", label: "Colar export" },
                { value: "prints", label: "Prints" },
              ]}
            />
          </header>

          {tab === "digitar" && (
            <form
              style={{ display: "grid", gap: 10 }}
              onSubmit={async (e) => {
                e.preventDefault();
                if (!leadId) return;
                const r = await addInteraction({ leadId, tipo, texto });
                if (r.ok) {
                  setTexto("");
                  toast({ title: "Registrado" });
                  router.refresh();
                } else toast({ title: "Não deu certo", body: r.error });
              }}
            >
              <div className="toggles">
                {(Object.keys(TIPO_LABEL) as Interaction["tipo"][]).map((t) => (
                  <button key={t} type="button" className="tog" aria-pressed={tipo === t} onClick={() => setTipo(t)}>
                    {TIPO_LABEL[t]}
                  </button>
                ))}
              </div>
              <textarea value={texto} onChange={(e) => setTexto(e.target.value)} placeholder={tipo === "audio" ? "Resumo escrito do áudio…" : tipo === "ligacao" ? "Resumo da ligação…" : "Mensagem ou anotação…"} aria-label="Texto" required />
              <button className="btn btn-lime" type="submit">
                <Send size={16} /> Registrar
              </button>
            </form>
          )}

          {tab === "colar" && (
            <div style={{ display: "grid", gap: 10 }}>
              <p className="muted" style={{ margin: 0, fontSize: 13 }}>
                No WhatsApp: abra a conversa › Mais › Exportar conversa › Sem mídia. Cole o texto aqui (formato <code>dd/mm/aaaa hh:mm - Nome: mensagem</code>).
              </p>
              <textarea value={raw} onChange={(e) => (setRaw(e.target.value), setPreview(null))} style={{ minHeight: 180, fontFamily: "var(--f-mono)", fontSize: 12 }} aria-label="Conversa exportada" />
              {preview && (
                <div className="field">
                  <label>{preview.total} mensagens. Quem é você nesta conversa?</label>
                  <div className="toggles">
                    {preview.autores.map((a) => (
                      <button key={a} type="button" className="tog" aria-pressed={vendedor === a} onClick={() => setVendedor(a)}>
                        {a}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <button className="btn btn-lime" type="button" disabled={busy || !raw.trim()} onClick={() => importExport(!!preview)}>
                <ClipboardPaste size={16} /> {preview ? "Importar" : "Ler conversa"}
              </button>
            </div>
          )}

          {tab === "prints" && (
            <div style={{ display: "grid", gap: 10 }}>
              <p className="muted" style={{ margin: 0, fontSize: 13 }}>A Ordeliry lê os prints, identifica quem falou e transcreve. Você revisa antes de salvar.</p>
              <input ref={files} type="file" accept="image/png,image/jpeg,image/webp" multiple hidden onChange={(e) => readPrints(e.target.files)} />
              <button className="btn btn-ghost" type="button" disabled={busy} onClick={() => files.current?.click()}>
                <ImagePlus size={16} /> {busy ? "Lendo prints…" : "Escolher prints"}
              </button>
              {trans && (
                <>
                  {trans.observacoes && <p className="unverified" style={{ whiteSpace: "normal" }}>{trans.observacoes}</p>}
                  <div className="timeline">
                    {trans.mensagens.map((m, i) => (
                      <div key={i} className={`tl${m.quem === "vendedor" ? " out" : ""}`}>
                        <button
                          type="button"
                          className="fico"
                          title="Trocar quem falou"
                          aria-label="Trocar quem falou"
                          onClick={() => setTrans({ ...trans, mensagens: trans.mensagens.map((x, j) => (j === i ? { ...x, quem: x.quem === "vendedor" ? "cliente" : "vendedor" } : x)) })}
                        >
                          <MessageCircle size={14} />
                        </button>
                        <div>
                          <div className="tm">
                            {m.quem === "vendedor" ? "Você" : m.autor} · {m.hora || "sem hora"}
                          </div>
                          <textarea
                            value={m.texto}
                            onChange={(e) => setTrans({ ...trans, mensagens: trans.mensagens.map((x, j) => (j === i ? { ...x, texto: e.target.value } : x)) })}
                            style={{ minHeight: 60 }}
                            aria-label={`Mensagem ${i + 1}`}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                  <button
                    className="btn btn-lime"
                    type="button"
                    onClick={async () => {
                      if (!leadId) return;
                      const r = await saveTranscription(leadId, trans.mensagens, trans.data_visivel);
                      if (r.ok) {
                        toast({ title: `${r.data?.salvas ?? 0} mensagens salvas` });
                        setTrans(null);
                        router.refresh();
                      } else toast({ title: "Não deu certo", body: r.error });
                    }}
                  >
                    Salvar transcrição
                  </button>
                </>
              )}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
