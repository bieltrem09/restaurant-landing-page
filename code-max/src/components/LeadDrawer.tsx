"use client";

import {
  AlertTriangle,
  Ban,
  BookmarkPlus,
  Check,
  Copy,
  ExternalLink,
  Eye,
  FileText,
  Globe,
  Link2,
  MapPin,
  Phone,
  Shield,
  Smartphone,
  Sparkles,
  Star,
  X,
  Zap,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { addTask, createExampleTracker, generateDiagnosis, markDoNotContact, saveLead, toggleTask } from "@/app/actions";
import type { LeadDetail } from "@/lib/data";
import { formatDateSP, formatDateTimeSP, relativeTime } from "@/lib/dates";
import { initials, money, waLink } from "@/lib/format";
import { nicheLabel } from "@/lib/niches";
import { STAGE_LABEL } from "@/lib/pipeline";
import { WEIGHT_LABELS, WEIGHT_SIGNAL, computeScore, classifyWebsite, type WeightKey } from "@/lib/score";
import { useApp } from "./app-context";
import { Modal, ScoreRing, TierChip, Unverified, useCopy, useToast } from "./ui";

const SIGNAL_SOURCE: Record<string, string> = {
  google_places: "Google Places",
  pagespeed_insights: "PageSpeed Insights",
  requisicao_http: "Requisição ao site",
  html_do_site: "HTML do site",
  configuracao: "Configuração de nichos",
};

function evidenceText(chave: string, v: unknown): string {
  if (v === null || v === undefined) return "não verificado";
  const o = v as Record<string, unknown>;
  switch (chave) {
    case "website":
      return o.websiteUri ? `${o.websiteUri} (${o.classificacao})` : "Sem site no perfil do Google";
    case "pagespeed":
      return `Performance ${o.performance ?? "?"}/100 · SEO ${o.seo ?? "?"}/100 · LCP ${o.lcpMs ? `${(Number(o.lcpMs) / 1000).toFixed(1)}s` : "?"}`;
    case "viewport":
      return v ? "Auditoria de viewport passou" : "Auditoria de viewport falhou";
    case "https":
      return v ? "HTTPS válido" : "Sem HTTPS válido";
    case "site_online":
      return o.online ? `Online (HTTP ${o.status})` : `Fora do ar (${o.erro ?? o.status ?? "erro"})`;
    case "copyright":
      return `© ${v}`;
    case "whatsapp_button":
      return v ? "Tem link de WhatsApp" : "Nenhum link de WhatsApp no HTML";
    case "instagram":
      return String(v);
    case "rating":
      return `Nota ${String(v).replace(".", ",")}`;
    case "rating_count":
      return `${v} avaliações`;
    case "nicho":
      return `${nicheLabel(String(o.nicho))} · ticket ${o.ticket ?? "?"}`;
    default:
      return JSON.stringify(v);
  }
}

function Gauge({ label, value, icon, collected }: { label: string; value: number | null; icon: React.ReactNode; collected?: string }) {
  const color = value === null ? "var(--ink-3)" : value >= 90 ? "var(--good)" : value >= 50 ? "var(--warn)" : "var(--bad)";
  const c = 2 * Math.PI * 22;
  return (
    <div className="gauge" title={collected ? `Coletado em ${formatDateTimeSP(collected)}` : undefined}>
      <span className="ring" style={{ width: 56, height: 56 }}>
        <svg width={56} height={56} aria-hidden>
          <circle cx={28} cy={28} r={22} fill="none" stroke="var(--track)" strokeWidth={5} />
          {value !== null && <circle className="ring-fg" cx={28} cy={28} r={22} fill="none" stroke={color} strokeWidth={5} strokeLinecap="round" strokeDasharray={`${(value / 100) * c} ${c}`} transform="rotate(-90 28 28)" />}
        </svg>
        <b style={{ color }}>{value ?? "—"}</b>
      </span>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
        {icon}
        {label}
      </span>
      {value === null && <Unverified />}
    </div>
  );
}

export function LeadDrawer({ id, onClose }: { id: string | null; onClose: () => void }) {
  const [lead, setLead] = useState<LeadDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [evidence, setEvidence] = useState<WeightKey | null>(null);
  const [exampleOpen, setExampleOpen] = useState(false);
  const [exampleUrl, setExampleUrl] = useState("");
  const [snippet, setSnippet] = useState<string | null>(null);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskWhen, setTaskWhen] = useState("");
  const { openOrdeliry } = useApp();
  const toast = useToast();
  const copy = useCopy();
  const router = useRouter();

  const load = useCallback(async (leadId: string) => {
    setLoading(true);
    const r = await fetch(`/api/leads/${leadId}`);
    setLead(r.ok ? await r.json() : null);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (id) void load(id);
    else {
      setLead(null);
      setSnippet(null);
    }
  }, [id, load]);

  useEffect(() => {
    if (!id) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [id, onClose]);

  const sig = (chave: string) => lead?.signals.find((s) => s.chave === chave);
  const sv = (chave: string) => sig(chave)?.valor_json as Record<string, unknown> | boolean | number | null | undefined;
  const ps = sv("pagespeed") as { performance?: number; seo?: number } | null | undefined;
  const site = classifyWebsite(lead?.website);

  // Decomposição: recalcula as partes a partir dos sinais salvos para mostrar a evidência de cada ponto.
  const parts = lead
    ? computeScore({
        nicho: lead.nicho,
        rating: lead.rating,
        ratingCount: lead.rating_count,
        site,
        siteOnline: (sv("site_online") as { online?: boolean } | null)?.online ?? (site === "proprio" ? null : undefined),
        pagespeedPerformance: ps?.performance ?? null,
        viewportOk: (sv("viewport") as boolean | null) ?? null,
        https: (sv("https") as boolean | null) ?? null,
        copyrightYear: (sv("copyright") as number | null) ?? null,
        whatsappButton: (sv("whatsapp_button") as boolean | null) ?? null,
        instagram: lead.instagram,
      }).parts
    : [];
  const maxPart = Math.max(1, ...parts.map((p) => p.pontos));

  async function act(fn: () => Promise<{ ok: boolean; error?: string }>, okTitle: string) {
    const r = await fn();
    if (r.ok) {
      toast({ title: okTitle });
      if (id) void load(id);
      router.refresh();
    } else toast({ title: "Não deu certo", body: r.error });
  }

  const phone = lead?.telefone_internacional ?? lead?.telefone;
  const ev = evidence ? sig(WEIGHT_SIGNAL[evidence]) : null;

  return (
    <>
      <div className={`scrim${id ? " on" : ""}`} onClick={onClose} aria-hidden />
      <aside className={`drawer${id ? " open" : ""}`} aria-label="Ficha do lead" aria-hidden={!id}>
        <div className="dr-top">
          <span className="eyebrow">Ficha do lead</span>
          <button className="icon-btn" type="button" aria-label="Fechar ficha" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        {loading && !lead && <div className="sk" />}
        {lead && (
          <>
            <div className="dr-hero">
              <span className="av" style={{ ["--c" as string]: "var(--n1)" }}>{initials(lead.nome)}</span>
              <div style={{ minWidth: 0 }}>
                <h2>{lead.nome}</h2>
                <p>
                  {nicheLabel(lead.nicho)} · {lead.bairro ?? lead.cidade ?? "local não verificado"}
                  {lead.distancia_km !== null && ` · ${String(lead.distancia_km).replace(".", ",")} km`}
                </p>
              </div>
            </div>
            <div className="dr-contact">
              {phone ? (
                <span>
                  <Phone size={14} />
                  {lead.telefone}
                </span>
              ) : (
                <span>
                  <Phone size={14} />
                  <Unverified />
                </span>
              )}
              {lead.endereco && (
                <span>
                  <MapPin size={14} />
                  {lead.endereco}
                </span>
              )}
              {lead.maps_url && (
                <a className="btn btn-sm btn-ghost" href={lead.maps_url} target="_blank" rel="noreferrer">
                  <ExternalLink size={14} /> Google Maps
                </a>
              )}
              {lead.website && (
                <a className="btn btn-sm btn-ghost" href={lead.website} target="_blank" rel="noreferrer">
                  <Globe size={14} /> Site atual
                </a>
              )}
            </div>

            <section className="dr-sec" style={{ ["--d" as string]: 1 }}>
              <div className="score-hero">
                <ScoreRing score={lead.score} size={84} stroke={7} faixa={lead.faixa} />
                <div>
                  <TierChip faixa={lead.faixa} />
                  <p>
                    {lead.enriquecimento === "feito"
                      ? `Coletado em ${lead.ultima_coleta ? formatDateTimeSP(lead.ultima_coleta) : "—"}. Clique em cada ponto para ver a evidência.`
                      : lead.enriquecimento === "erro"
                        ? "Não foi possível coletar todos os sinais deste lead."
                        : "Coletando sinais…"}
                  </p>
                </div>
              </div>
              <div className="parts">
                {parts.map((p, i) => (
                  <button key={p.key} type="button" className="part" style={{ ["--d" as string]: i, textAlign: "left" }} onClick={() => setEvidence(p.key)}>
                    <span>{p.label}</span>
                    <span className="t">
                      <i style={{ width: `${(p.pontos / maxPart) * 100}%`, background: p.kind === "forca" ? "var(--good)" : undefined }} />
                    </span>
                    <b>+{p.pontos}</b>
                  </button>
                ))}
                {!parts.length && <p className="muted" style={{ margin: 0 }}>Nenhum sinal pontuou ainda.</p>}
              </div>
            </section>

            <section className="dr-sec" style={{ ["--d" as string]: 2 }}>
              <h3>
                <Globe size={16} /> Presença digital hoje
              </h3>
              {site === "proprio" ? (
                <div className="gauges">
                  <Gauge label="Velocidade" value={ps?.performance ?? null} icon={<Zap size={12} />} collected={sig("pagespeed")?.coletado_em} />
                  <Gauge label="Celular" value={sv("viewport") === true ? 100 : sv("viewport") === false ? 0 : null} icon={<Smartphone size={12} />} collected={sig("viewport")?.coletado_em} />
                  <Gauge label="SEO" value={ps?.seo ?? null} icon={<Eye size={12} />} collected={sig("pagespeed")?.coletado_em} />
                  <Gauge label="Segurança" value={sv("https") === true ? 100 : sv("https") === false ? 0 : null} icon={<Shield size={12} />} collected={sig("https")?.coletado_em} />
                </div>
              ) : (
                <div className="nosite">
                  <AlertTriangle />
                  <div>
                    <b>{site === "nenhum" ? "Sem site no Google" : site === "rede_social" ? "Usa rede social como site" : "Depende de marketplace / cardápio de terceiros"}</b>
                    <p>Fonte: Google Places, coletado em {lead.ultima_coleta ? formatDateSP(lead.ultima_coleta) : "—"}.</p>
                  </div>
                </div>
              )}
              <div className="facts">
                <div>
                  <span className="num">{lead.rating !== null ? String(lead.rating).replace(".", ",") : "—"}</span>
                  <small>
                    <Star size={11} /> nota no Google
                  </small>
                </div>
                <div>
                  <span className="num">{lead.rating_count ?? "—"}</span>
                  <small>avaliações</small>
                </div>
                <div>
                  <span className="num" style={{ fontSize: 14 }}>{lead.instagram ?? "—"}</span>
                  <small>Instagram</small>
                </div>
              </div>
            </section>

            <section className="dr-sec" style={{ ["--d" as string]: 3 }}>
              <h3>Pacote sugerido</h3>
              {lead.pacote ? (
                <div className="pkg">
                  <div>
                    <h4>{lead.pacote.nome}</h4>
                    <small className="muted">Prazo {lead.pacote.prazo_dias} dias</small>
                  </div>
                  <div className="price">
                    <span className="num">{money(Number(lead.pacote.preco_implantacao))}</span>
                    <small>+ {money(Number(lead.pacote.mensalidade))}/mês</small>
                  </div>
                  {!!lead.pacote.inclui.length && (
                    <ul>
                      {lead.pacote.inclui.map((x) => (
                        <li key={x}>
                          <Check />
                          {x}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : (
                <p className="muted" style={{ margin: 0 }}>Nenhum serviço do catálogo atende este nicho. Cadastre em Ajustes.</p>
              )}
            </section>

            <section className="dr-sec" style={{ ["--d" as string]: 4 }}>
              <h3>
                <Eye size={16} /> Presença ao vivo
              </h3>
              <p className="muted" style={{ margin: "0 0 10px", fontSize: 13 }}>
                {lead.views.total ? `Visto ${lead.views.total}x · última abertura há ${relativeTime(lead.views.ultimo!)}` : "Nenhuma abertura registrada ainda."}
              </p>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <button className="btn btn-sm btn-ghost" type="button" onClick={() => act(async () => {
                  const r = await generateDiagnosis(lead.id);
                  if (r.ok && r.data) await copy(r.data.url, "Link do diagnóstico copiado");
                  return r;
                }, "Diagnóstico pronto")}>
                  <FileText size={14} /> Gerar diagnóstico
                </button>
                <button className="btn btn-sm btn-ghost" type="button" onClick={() => setExampleOpen(true)}>
                  <Link2 size={14} /> Rastrear site de exemplo
                </button>
              </div>
              {!!lead.trackers.length && (
                <div className="sigs" style={{ marginTop: 10 }}>
                  {lead.trackers.map((t) => (
                    <button key={t.id} type="button" className="sig neu" onClick={() => copy(t.url ?? t.token, "Link copiado")}>
                      <Copy size={11} /> {t.tipo} {lead.views.porTipo[t.tipo] ? `· ${lead.views.porTipo[t.tipo]}x` : ""}
                    </button>
                  ))}
                </div>
              )}
            </section>

            <section className="dr-sec" style={{ ["--d" as string]: 5 }}>
              <h3>Conversas</h3>
              {lead.deal && (
                <p className="muted" style={{ margin: "0 0 10px", fontSize: 13 }}>
                  Etapa: <b>{STAGE_LABEL[lead.deal.etapa]}</b>
                  {lead.ultimo_contato_em && ` · último contato há ${relativeTime(lead.ultimo_contato_em)}`}
                </p>
              )}
              {lead.interactions.length ? (
                <div className="timeline">
                  {lead.interactions.slice(-6).map((i) => (
                    <div key={i.id} className={`tl${i.tipo === "mensagem_enviada" ? " out" : ""}`}>
                      <span className="fico">{i.tipo === "nota" ? <FileText size={14} /> : i.tipo === "ligacao" ? <Phone size={14} /> : <Sparkles size={14} />}</span>
                      <div>
                        <div className="tm">
                          {formatDateTimeSP(i.ocorreu_em)} · {i.tipo.replace("_", " ")}
                        </div>
                        <div className="tb">{i.texto}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="muted" style={{ margin: 0, fontSize: 13 }}>Nenhuma conversa registrada. Registre em Conversas.</p>
              )}
            </section>

            <section className="dr-sec" style={{ ["--d" as string]: 6 }}>
              <h3>Tarefas</h3>
              {lead.tasks.map((t) => (
                <label key={t.id} className="ag" style={{ gridTemplateColumns: "auto 1fr" }}>
                  <input type="checkbox" checked={t.feita} onChange={(e) => act(() => toggleTask(t.id, e.target.checked), e.target.checked ? "Tarefa concluída" : "Tarefa reaberta")} />
                  <span>
                    <b>{t.titulo}</b>
                    <small>{formatDateTimeSP(t.vence_em)}</small>
                  </span>
                </label>
              ))}
              <form
                className="form-grid"
                style={{ marginTop: 8 }}
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!taskTitle || !taskWhen) return;
                  void act(() => addTask(lead.id, taskTitle, taskWhen), "Tarefa criada");
                  setTaskTitle("");
                }}
              >
                <input type="text" value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} placeholder="Nova tarefa" aria-label="Título da tarefa" />
                <input type="datetime-local" value={taskWhen} onChange={(e) => setTaskWhen(e.target.value)} aria-label="Quando" />
                <button className="btn btn-sm btn-ghost full" type="submit">
                  Adicionar tarefa
                </button>
              </form>
            </section>

            <div className="dr-foot">
              {lead.status === "nao_contatar" ? (
                <span className="unverified" style={{ margin: "auto" }}>Marcado como não contatar</span>
              ) : (
                <>
                  {!lead.deal && (
                    <button className="btn btn-ghost" type="button" onClick={() => act(() => saveLead(lead.id), "Salvo no pipeline")}>
                      <BookmarkPlus size={16} /> Salvar
                    </button>
                  )}
                  <button className="btn btn-lime" type="button" onClick={() => openOrdeliry({ leadId: lead.id, leadNome: lead.nome, mode: lead.interactions.length ? "auto" : "abordagem" })}>
                    <Sparkles size={16} /> Conversar com a Ordeliry
                  </button>
                  {phone && (
                    <a className="btn btn-ghost" href={waLink(phone, "")} target="_blank" rel="noreferrer" aria-label="Abrir WhatsApp">
                      <Phone size={16} />
                    </a>
                  )}
                  <button
                    className="btn btn-ghost"
                    type="button"
                    aria-label="Marcar como não contatar"
                    title="Não contatar"
                    onClick={() => confirm(`Marcar ${lead.nome} como "não contatar"? Ele não aparecerá mais nas buscas.`) && act(() => markDoNotContact(lead.id), "Marcado como não contatar")}
                    style={{ flex: "none" }}
                  >
                    <Ban size={16} />
                  </button>
                </>
              )}
            </div>
          </>
        )}
      </aside>

      <Modal open={!!evidence} onClose={() => setEvidence(null)} title={evidence ? WEIGHT_LABELS[evidence] : ""}>
        {ev ? (
          <div className="list-row" style={{ gridTemplateColumns: "1fr" }}>
            <div>
              <b>{evidenceText(ev.chave, ev.valor_json)}</b>
              <small>
                Fonte: {SIGNAL_SOURCE[ev.fonte] ?? ev.fonte} · coletado em {formatDateTimeSP(ev.coletado_em)}
              </small>
            </div>
          </div>
        ) : (
          <p className="muted">Sem evidência registrada para este ponto.</p>
        )}
      </Modal>

      <Modal
        open={exampleOpen}
        onClose={() => (setExampleOpen(false), setSnippet(null))}
        title="Rastrear site de exemplo"
        actions={
          !snippet && (
            <button
              className="btn btn-lime"
              type="button"
              onClick={async () => {
                if (!lead) return;
                const r = await createExampleTracker(lead.id, exampleUrl);
                if (r.ok && r.data) setSnippet(r.data.snippet);
                else if (!r.ok) toast({ title: "Não deu certo", body: r.error });
              }}
            >
              Gerar script
            </button>
          )
        }
      >
        {snippet ? (
          <div style={{ display: "grid", gap: 10 }}>
            <p className="muted" style={{ margin: 0 }}>
              Cole antes do <code>&lt;/body&gt;</code> do site de exemplo. Para não contar suas próprias visitas, abra uma vez com <code>?cm_excluir=1</code> no fim do endereço.
            </p>
            <div className="msg" style={{ fontFamily: "var(--f-mono)", fontSize: 12 }}>{snippet}</div>
            <button className="btn btn-ghost" type="button" onClick={() => copy(snippet, "Script copiado")}>
              <Copy size={16} /> Copiar script
            </button>
          </div>
        ) : (
          <div className="field">
            <label htmlFor="ex-url">Endereço do site de exemplo</label>
            <input id="ex-url" type="url" value={exampleUrl} onChange={(e) => setExampleUrl(e.target.value)} placeholder="https://cheff-gourmet.vercel.app" />
          </div>
        )}
      </Modal>
    </>
  );
}
