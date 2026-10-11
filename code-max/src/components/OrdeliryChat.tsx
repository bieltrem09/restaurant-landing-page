"use client";

import { Check, Copy, ImagePlus, MessageCircle, Pencil, Send, Sparkles, ThumbsDown, ThumbsUp, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { addInteraction } from "@/app/actions";
import { waLink } from "@/lib/format";
import { NICHES } from "@/lib/niches";
import { MODES, type Mode } from "@/lib/ordeliry/context";
import { Markdown, splitMessages } from "./Markdown";
import { useCopy, useToast } from "./ui";

type Pending = { id: string; name: string; input: Record<string, unknown>; descricao: string };
type ChatMsg = { key: string; role: "user" | "assistant"; text: string; id?: string; feedback?: number | null; images?: number; pending?: Pending[]; streaming?: boolean; notice?: string };

type StoredBlock = { type: string; text?: string; content?: unknown };

function toChat(rows: Array<{ id: string; role: string; conteudo: StoredBlock[]; feedback: number | null }>): ChatMsg[] {
  const out: ChatMsg[] = [];
  for (const r of rows) {
    const blocks = Array.isArray(r.conteudo) ? r.conteudo : [];
    const text = blocks.filter((b) => b.type === "text").map((b) => b.text ?? "").join("\n").replace(/^\[Modo: [^\]]+\]\n/, "");
    const images = blocks.filter((b) => b.type === "image").length;
    if (!text && !images) continue;
    out.push({ key: r.id, id: r.id, role: r.role as ChatMsg["role"], text, images, feedback: r.feedback });
  }
  return out;
}

async function fileToBase64(f: File): Promise<{ media_type: "image/png" | "image/jpeg" | "image/webp" | "image/gif"; data: string }> {
  const buf = await f.arrayBuffer();
  let bin = "";
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  const type = (["image/png", "image/jpeg", "image/webp", "image/gif"].includes(f.type) ? f.type : "image/png") as "image/png";
  return { media_type: type, data: btoa(bin) };
}

function MessageCard({ intent, body, phone, leadId }: { intent: string; body: string; phone?: string | null; leadId?: string | null }) {
  const [text, setText] = useState(body);
  const [editing, setEditing] = useState(false);
  const [askSent, setAskSent] = useState(false);
  const copy = useCopy();
  const toast = useToast();
  return (
    <div className="msg-card">
      {intent && <span className="intent">{intent}</span>}
      {editing ? <textarea value={text} onChange={(e) => setText(e.target.value)} aria-label="Editar mensagem" /> : <div className="body">{text}</div>}
      <div className="acts">
        <button className="btn btn-sm btn-ghost" type="button" onClick={() => copy(text, "Mensagem copiada")}>
          <Copy size={14} /> Copiar
        </button>
        <a className="btn btn-sm btn-lime" href={waLink(phone, text)} target="_blank" rel="noreferrer" onClick={() => leadId && setAskSent(true)}>
          <MessageCircle size={14} /> Abrir no WhatsApp
        </a>
        <button className="btn btn-sm btn-ghost" type="button" onClick={() => setEditing((v) => !v)}>
          {editing ? <Check size={14} /> : <Pencil size={14} />} {editing ? "Pronto" : "Editar"}
        </button>
        {askSent && leadId && (
          <button
            className="btn btn-sm btn-dark"
            type="button"
            onClick={async () => {
              const r = await addInteraction({ leadId, tipo: "mensagem_enviada", texto: text, origem: "ordeliry" });
              setAskSent(false);
              toast(r.ok ? { title: "Registrada como enviada" } : { title: "Erro", body: r.error });
            }}
          >
            <Check size={14} /> Marcar como enviada
          </button>
        )}
      </div>
    </div>
  );
}

function Feedback({ id, initial }: { id: string; initial?: number | null }) {
  const [v, setV] = useState<number | null>(initial ?? null);
  const [ask, setAsk] = useState(false);
  const [txt, setTxt] = useState("");
  const send = async (value: 1 | -1, texto?: string) => {
    setV(value);
    await fetch("/api/ordeliry/feedback", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messageId: id, value, texto }) });
  };
  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", marginTop: 8 }}>
      <button className="btn btn-sm btn-ghost" type="button" aria-pressed={v === 1} aria-label="Resposta útil" onClick={() => send(1)} style={v === 1 ? { background: "var(--good-soft)", color: "var(--good)" } : undefined}>
        <ThumbsUp size={14} />
      </button>
      <button className="btn btn-sm btn-ghost" type="button" aria-pressed={v === -1} aria-label="Resposta não ajudou" onClick={() => (setAsk(true), send(-1))} style={v === -1 ? { background: "var(--bad-soft)", color: "var(--bad)" } : undefined}>
        <ThumbsDown size={14} />
      </button>
      {ask && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void send(-1, txt);
            setAsk(false);
          }}
          style={{ display: "flex", gap: 6, flex: 1, minWidth: 220 }}
        >
          <input type="text" value={txt} onChange={(e) => setTxt(e.target.value)} placeholder="O que faltou?" aria-label="O que faltou?" style={{ height: 36 }} />
          <button className="btn btn-sm btn-dark" type="submit">
            Enviar
          </button>
        </form>
      )}
    </div>
  );
}

export function OrdeliryChat({
  leadId,
  leadNome,
  threadId: initialThread,
  initialMode = "auto",
  prefill,
  onThread,
  compact,
}: {
  leadId?: string | null;
  leadNome?: string;
  threadId?: string | null;
  initialMode?: Mode;
  prefill?: string;
  onThread?: (id: string) => void;
  compact?: boolean;
}) {
  const [threadId, setThreadId] = useState<string | null>(initialThread ?? null);
  const [mode, setMode] = useState<Mode>(initialMode);
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const [text, setText] = useState(prefill ?? "");
  const [images, setImages] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [phone, setPhone] = useState<string | null>(null);
  const [sim, setSim] = useState({ nicho: "pizzaria", dificuldade: "media" as "facil" | "media" | "dificil" });
  const scroll = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const toast = useToast();

  useEffect(() => setThreadId(initialThread ?? null), [initialThread]);
  useEffect(() => setMode(initialMode), [initialMode]);
  useEffect(() => {
    if (prefill) setText(prefill);
  }, [prefill]);

  useEffect(() => {
    if (!leadId) return setPhone(null);
    fetch(`/api/leads/${leadId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((l) => setPhone(l?.telefone_internacional ?? l?.telefone ?? null))
      .catch(() => {});
  }, [leadId]);

  useEffect(() => {
    if (!threadId) return setMsgs([]);
    if (busy) return;
    fetch(`/api/ordeliry/threads?id=${threadId}`)
      .then((r) => r.json())
      .then((d) => setMsgs(toChat(d.messages ?? [])))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId]);

  useEffect(() => {
    scroll.current?.scrollTo({ top: scroll.current.scrollHeight, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }, [msgs]);

  const send = useCallback(
    async (opts: { text?: string; decisions?: Array<{ tool_use_id: string; approve: boolean }> }) => {
      if (busy) return;
      const imgs = await Promise.all(images.map(fileToBase64));
      const userText = opts.text?.trim() ?? "";
      if (!userText && !imgs.length && !opts.decisions?.length) return;
      setBusy(true);
      setStatus(null);
      const assistantKey = `a${Date.now()}`;
      setMsgs((m) => [
        ...m.map((x) => ({ ...x, pending: undefined })),
        ...(userText || imgs.length ? [{ key: `u${Date.now()}`, role: "user" as const, text: userText, images: imgs.length }] : []),
        { key: assistantKey, role: "assistant", text: "", streaming: true },
      ]);
      setText("");
      setImages([]);
      const patch = (fn: (m: ChatMsg) => ChatMsg) => setMsgs((list) => list.map((x) => (x.key === assistantKey ? fn(x) : x)));
      try {
        const res = await fetch("/api/ordeliry/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ threadId, leadId: leadId ?? null, mode, text: userText || null, images: imgs, decisions: opts.decisions, simulador: mode === "simulador" ? sim : undefined }),
        });
        if (!res.ok || !res.body) {
          const e = await res.json().catch(() => ({ error: "Falha ao falar com a Ordeliry." }));
          throw new Error(e.error);
        }
        const reader = res.body.getReader();
        const dec = new TextDecoder();
        let buf = "";
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          let nl: number;
          while ((nl = buf.indexOf("\n")) >= 0) {
            const line = buf.slice(0, nl);
            buf = buf.slice(nl + 1);
            if (!line.trim()) continue;
            const ev = JSON.parse(line);
            if (ev.type === "thread" && ev.id !== threadId) {
              setThreadId(ev.id);
              onThread?.(ev.id);
            } else if (ev.type === "text") patch((m) => ({ ...m, text: m.text + ev.delta }));
            else if (ev.type === "tool_status") setStatus(ev.name === "get_lead" || ev.name === "get_conversation" || ev.name === "search_leads" ? "Consultando o CRM…" : "Preparando uma ação…");
            else if (ev.type === "message") patch((m) => ({ ...m, id: ev.id }));
            else if (ev.type === "pending") patch((m) => ({ ...m, pending: ev.actions }));
            else if (ev.type === "action_done") toast({ title: "Ação executada", body: ev.result });
            else if (ev.type === "notice") patch((m) => ({ ...m, notice: ev.message }));
            else if (ev.type === "error") patch((m) => ({ ...m, notice: ev.message }));
          }
        }
      } catch (e) {
        patch((m) => ({ ...m, notice: e instanceof Error ? e.message : "Erro" }));
      } finally {
        patch((m) => ({ ...m, streaming: false }));
        setStatus(null);
        setBusy(false);
      }
    },
    [busy, images, threadId, leadId, mode, sim, onThread, toast],
  );

  const placeholder =
    mode === "responder"
      ? "Cole aqui o que o cliente respondeu…"
      : mode === "analisar"
        ? "Cole a conversa inteira (ou anexe prints)…"
        : mode === "simulador"
          ? "Comece a abordagem como se fosse o cliente real. Escreva “fim do treino” para receber a nota."
          : leadNome
            ? `Pergunte sobre ${leadNome}…`
            : "Peça uma abordagem, cole a resposta do cliente, analise uma conversa…";

  return (
    <div className="chat" style={compact ? { height: "calc(100dvh - 150px)", minHeight: 0 } : undefined}>
      <div className="modes" role="tablist" aria-label="Modo da Ordeliry">
        {(Object.keys(MODES) as Mode[]).map((m) => (
          <button key={m} type="button" role="tab" className="tog" aria-selected={mode === m} onClick={() => setMode(m)}>
            {MODES[m]}
          </button>
        ))}
        {mode === "simulador" && (
          <div style={{ display: "flex", gap: 6, width: "100%" }}>
            <select value={sim.nicho} onChange={(e) => setSim((s) => ({ ...s, nicho: e.target.value }))} aria-label="Nicho do treino" style={{ height: 36 }}>
              {NICHES.map((n) => (
                <option key={n.key} value={n.key}>
                  {n.label}
                </option>
              ))}
            </select>
            <select value={sim.dificuldade} onChange={(e) => setSim((s) => ({ ...s, dificuldade: e.target.value as typeof s.dificuldade }))} aria-label="Dificuldade" style={{ height: 36 }}>
              <option value="facil">Fácil</option>
              <option value="media">Média</option>
              <option value="dificil">Difícil</option>
            </select>
          </div>
        )}
      </div>

      <div className="chat-scroll" ref={scroll} aria-live="polite">
        {!msgs.length && (
          <div className="empty-state">
            <span className="ei">
              <Sparkles size={22} />
            </span>
            <b>{leadNome ? `Ordeliry sobre ${leadNome}` : "Ordeliry"}</b>
            <p>Ela conhece seus leads, as conversas registradas e o seu catálogo. Só cita preço e prazo que estão no catálogo; quando falta informação, pergunta a você.</p>
          </div>
        )}
        {msgs.map((m) =>
          m.role === "user" ? (
            <div key={m.key} className="bubble user">
              {m.text}
              {!!m.images && <div style={{ opacity: 0.7, fontSize: 12, marginTop: 4 }}>{m.images} print(s) anexado(s)</div>}
            </div>
          ) : (
            <div key={m.key} className="bubble assistant">
              {splitMessages(m.text).map((s, i) =>
                s.kind === "text" ? <Markdown key={i} text={s.text} /> : <MessageCard key={i} intent={s.intent} body={s.body} phone={phone} leadId={leadId} />,
              )}
              {m.streaming && !m.text && (
                <span className="typing" aria-label="Ordeliry escrevendo">
                  <i />
                  <i style={{ animationDelay: ".2s" }} />
                  <i style={{ animationDelay: ".4s" }} />
                </span>
              )}
              {m.streaming && status && <div className="muted" style={{ fontSize: 12 }}>{status}</div>}
              {m.pending?.map((p) => (
                <div key={p.id} className="tool-card">
                  <b>Confirmar ação no CRM</b>
                  <div style={{ margin: "4px 0 10px" }}>{p.descricao}</div>
                  {p.name === "create_followup" && <div className="msg" style={{ marginBottom: 10 }}>{String(p.input.mensagem ?? "")}</div>}
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <button className="btn btn-sm btn-lime" type="button" disabled={busy} onClick={() => send({ decisions: m.pending!.map((x) => ({ tool_use_id: x.id, approve: x.id === p.id })) })}>
                      <Check size={14} /> Confirmar
                    </button>
                    <button className="btn btn-sm btn-ghost" type="button" disabled={busy} onClick={() => send({ decisions: m.pending!.map((x) => ({ tool_use_id: x.id, approve: false })) })}>
                      <X size={14} /> Recusar
                    </button>
                  </div>
                </div>
              ))}
              {m.notice && <div className="unverified" style={{ display: "inline-block", marginTop: 6, whiteSpace: "normal" }}>{m.notice}</div>}
              {!m.streaming && m.id && m.text && <Feedback id={m.id} initial={m.feedback} />}
            </div>
          ),
        )}
      </div>

      <form
        className="chat-input"
        onSubmit={(e) => {
          e.preventDefault();
          void send({ text });
        }}
      >
        <div style={{ display: "grid", gap: 6 }}>
          {!!images.length && (
            <div className="sigs">
              {images.map((f, i) => (
                <span key={i} className="sig neu">
                  {f.name}
                  <button type="button" aria-label={`Remover ${f.name}`} onClick={() => setImages((l) => l.filter((_, j) => j !== i))}>
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
          )}
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send({ text });
              }
            }}
            placeholder={placeholder}
            aria-label="Mensagem para a Ordeliry"
          />
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp" multiple hidden onChange={(e) => setImages((l) => [...l, ...Array.from(e.target.files ?? [])].slice(0, 6))} />
          <button className="icon-btn" type="button" aria-label="Anexar prints" onClick={() => fileInput.current?.click()}>
            <ImagePlus size={18} />
          </button>
          <button className="btn btn-lime" type="submit" disabled={busy} aria-label="Enviar">
            <Send size={16} />
          </button>
        </div>
      </form>
    </div>
  );
}
