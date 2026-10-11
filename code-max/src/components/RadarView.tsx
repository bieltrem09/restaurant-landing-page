"use client";

import { Ban, BookmarkPlus, FileText, Radar as RadarIcon, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { markDoNotContact, saveLead } from "@/app/actions";
import { relativeTime } from "@/lib/dates";
import { initials, money } from "@/lib/format";
import { NICHES, nicheLabel } from "@/lib/niches";
import { classifyWebsite } from "@/lib/score";
import { useApp } from "./app-context";
import { EmptyState, ScoreRing, TierChip, useToast } from "./ui";

type SignalRow = { chave: string; valor_json: unknown; pontos: number };
type ResultLead = {
  id: string;
  nome: string;
  nicho: string;
  bairro: string | null;
  cidade: string | null;
  lat: number | null;
  lng: number | null;
  distancia_km: number | null;
  website: string | null;
  rating: number | null;
  rating_count: number | null;
  score: number;
  faixa: "quente" | "morno" | "frio";
  status: string;
  enriquecimento: string;
  ultimo_contato_em: string | null;
  instagram: string | null;
  services: { nome: string; preco_implantacao: number; mensalidade: number } | null;
  lead_signals: SignalRow[];
};
type SearchRow = { id: string; nicho: string; cidade: string; bairro: string | null; raio_km: number; total_resultados: number; criada_em: string; status: string; lat?: number | null; lng?: number | null };
type Estimate = { min: number; max: number; cache: boolean; usadas: number; limite: number; saldo: number; permitido: boolean };

const FILTERS = [
  { key: "sem_site", label: "Sem site" },
  { key: "rede_social", label: "Só rede social" },
  { key: "fraco", label: "Site fraco" },
  { key: "marketplace", label: "Marketplace" },
  { key: "nota45", label: "Nota 4,5+" },
] as const;
type FilterKey = (typeof FILTERS)[number]["key"];

function chips(l: ResultLead) {
  const out: Array<{ t: string; kind: "bad" | "good" | "neu" }> = [];
  const site = classifyWebsite(l.website);
  if (site === "nenhum") out.push({ t: "Sem site", kind: "bad" });
  if (site === "rede_social") out.push({ t: "Só rede social", kind: "bad" });
  if (site === "marketplace") out.push({ t: "Marketplace", kind: "bad" });
  const ps = l.lead_signals.find((s) => s.chave === "pagespeed")?.valor_json as { performance?: number } | null;
  if (ps?.performance != null && ps.performance < 70) out.push({ t: `PageSpeed ${ps.performance}`, kind: "bad" });
  if (l.lead_signals.find((s) => s.chave === "site_online" && (s.valor_json as { online?: boolean })?.online === false)) out.push({ t: "Site fora do ar", kind: "bad" });
  if (l.lead_signals.find((s) => s.chave === "viewport" && s.valor_json === false)) out.push({ t: "Não responsivo", kind: "bad" });
  if (l.rating != null && l.rating >= 4.5) out.push({ t: `★ ${String(l.rating).replace(".", ",")}`, kind: "good" });
  if (l.rating_count != null && l.rating_count >= 150) out.push({ t: `${l.rating_count} avaliações`, kind: "good" });
  if (l.instagram) out.push({ t: l.instagram, kind: "neu" });
  return out;
}

function matches(l: ResultLead, f: FilterKey) {
  const site = classifyWebsite(l.website);
  if (f === "sem_site") return site === "nenhum";
  if (f === "rede_social") return site === "rede_social";
  if (f === "marketplace") return site === "marketplace";
  if (f === "nota45") return (l.rating ?? 0) >= 4.5;
  const ps = l.lead_signals.find((s) => s.chave === "pagespeed")?.valor_json as { performance?: number } | null;
  return site === "proprio" && l.lead_signals.some((s) => s.pontos > 0 && ["pagespeed", "viewport", "https", "copyright", "whatsapp_button", "site_online"].includes(s.chave)) || (ps?.performance ?? 100) < 50;
}

export function RadarView({ profile, recent }: { profile: { nichos_alvo: string[]; regioes_alvo: Array<{ cidade: string; bairros: string[] }>; cidade_base: string }; recent: SearchRow[] }) {
  const { openLead } = useApp();
  const toast = useToast();
  const router = useRouter();
  const [form, setForm] = useState({
    nicho: profile.nichos_alvo[0] ?? "pizzaria",
    cidade: profile.regioes_alvo[0]?.cidade ?? profile.cidade_base ?? "",
    bairro: profile.regioes_alvo[0]?.bairros[0] ?? "",
    raioKm: 3,
  });
  const [est, setEst] = useState<Estimate | null>(null);
  const [searchId, setSearchId] = useState<string | null>(recent[0]?.id ?? null);
  const [search, setSearch] = useState<SearchRow | null>(null);
  const [leads, setLeads] = useState<ResultLead[]>([]);
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState<{ feitos: number; total: number } | null>(null);
  const [filters, setFilters] = useState<Set<FilterKey>>(new Set());
  const [minScore, setMinScore] = useState(0);
  const [sort, setSort] = useState<"score" | "distancia" | "potencial">("score");
  const [showContacted, setShowContacted] = useState(false);
  const enriching = useRef(false);

  // Estimativa de chamadas antes de rodar.
  useEffect(() => {
    if (form.cidade.trim().length < 2) return;
    const t = setTimeout(async () => {
      const r = await fetch("/api/radar/estimate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, bairro: form.bairro || null }) });
      setEst(r.ok ? await r.json() : null);
    }, 400);
    return () => clearTimeout(t);
  }, [form]);

  const loadResults = useCallback(async (id: string) => {
    const r = await fetch(`/api/radar/results?searchId=${id}`);
    if (!r.ok) return null;
    const d = await r.json();
    setSearch(d.search);
    setLeads(d.leads);
    return d as { search: SearchRow; leads: ResultLead[] };
  }, []);

  // Enriquecimento: o navegador aciona o worker em lotes enquanto a busca está aberta.
  const enrichLoop = useCallback(
    async (id: string) => {
      if (enriching.current) return;
      enriching.current = true;
      try {
        for (let i = 0; i < 80; i++) {
          const r = await fetch("/api/radar/enrich", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ searchId: id }) });
          if (!r.ok) break;
          const p = await r.json();
          setProgress({ feitos: p.feitos, total: p.total });
          await loadResults(id);
          if (p.concluido || (!p.processed && p.feitos >= p.total)) break;
          if (!p.processed) await new Promise((res) => setTimeout(res, 3000));
        }
      } finally {
        enriching.current = false;
        setProgress(null);
        router.refresh();
      }
    },
    [loadResults, router],
  );

  useEffect(() => {
    if (!searchId) return;
    let alive = true;
    fetch(`/api/radar/results?searchId=${searchId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { search: SearchRow; leads: ResultLead[] } | null) => {
        if (!alive || !d) return;
        setSearch(d.search);
        setLeads(d.leads);
        if (d.leads.some((l) => l.enriquecimento === "pendente" || l.enriquecimento === "rodando")) void enrichLoop(searchId);
      });
    return () => {
      alive = false;
    };
  }, [searchId, enrichLoop]);

  async function run(e: React.FormEvent) {
    e.preventDefault();
    setScanning(true);
    const r = await fetch("/api/radar/search", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, bairro: form.bairro || null }) });
    const d = await r.json();
    setScanning(false);
    if (!r.ok) return toast({ title: "A busca não rodou", body: d.error });
    toast({ title: `${d.total} empresas encontradas`, body: d.cache ? "Resultado do cache (0 chamadas)." : `${d.calls} chamadas ao Google Places.` });
    setSearchId(d.searchId);
  }

  const [mountedAt] = useState(() => Date.now());
  const visible = useMemo(() => {
    const thirty = mountedAt - 30 * 86_400_000;
    let list = leads.filter((l) => l.status !== "descartado");
    if (!showContacted) list = list.filter((l) => !l.ultimo_contato_em || new Date(l.ultimo_contato_em).getTime() < thirty);
    for (const f of filters) list = list.filter((l) => matches(l, f));
    list = list.filter((l) => l.score >= minScore);
    const pot = (l: ResultLead) => (l.services ? Number(l.services.preco_implantacao) + Number(l.services.mensalidade) * 12 : 0);
    return [...list].sort((a, b) => (sort === "score" ? b.score - a.score : sort === "distancia" ? (a.distancia_km ?? 99) - (b.distancia_km ?? 99) : pot(b) - pot(a)));
  }, [leads, filters, minScore, sort, showContacted, mountedAt]);

  const hot = leads.filter((l) => l.faixa === "quente").length;
  const raio = Number(search?.raio_km ?? form.raioKm);
  const center = search?.lat != null && search?.lng != null ? { lat: search.lat, lng: search.lng } : null;

  async function act(fn: () => Promise<{ ok: boolean; error?: string }>, title: string) {
    const r = await fn();
    toast(r.ok ? { title } : { title: "Não deu certo", body: r.error });
    if (r.ok && searchId) {
      void loadResults(searchId);
      router.refresh();
    }
  }

  return (
    <>
      <header className="top">
        <div className="top-title">
          <span className="eyebrow">Radar de Leads</span>
          <h1>
            Empresas reais com <em>mais chance de fechar</em>
          </h1>
          <p className="sub">Dados públicos do Google Places, enriquecidos com PageSpeed e análise do site. Cada ponto do score tem fonte e data.</p>
        </div>
      </header>

      <div className="radar-wrap">
        <div className="radar-side">
          <form className="card rform" onSubmit={run}>
            <div className="field">
              <label htmlFor="r-nicho">Nicho</label>
              <select id="r-nicho" value={form.nicho} onChange={(e) => setForm({ ...form, nicho: e.target.value })}>
                {NICHES.map((n) => (
                  <option key={n.key} value={n.key}>
                    {n.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="two">
              <div className="field">
                <label htmlFor="r-cid">Cidade</label>
                <input id="r-cid" type="text" required value={form.cidade} onChange={(e) => setForm({ ...form, cidade: e.target.value })} />
              </div>
              <div className="field">
                <label htmlFor="r-bai">Bairro</label>
                <input id="r-bai" type="text" value={form.bairro} onChange={(e) => setForm({ ...form, bairro: e.target.value })} />
              </div>
            </div>
            <div className="field">
              <label htmlFor="r-raio">
                Raio <output>{form.raioKm} km</output>
              </label>
              <input id="r-raio" type="range" min={1} max={20} value={form.raioKm} onChange={(e) => setForm({ ...form, raioKm: Number(e.target.value) })} />
            </div>
            <p className="muted" style={{ margin: 0, fontSize: 12.5 }} aria-live="polite">
              {est && form.cidade.trim().length >= 2
                ? est.cache
                  ? "Já buscado nos últimos 30 dias: 0 chamadas (cache)."
                  : `Estimativa: ${est.min} a ${est.max} chamadas · saldo ${est.saldo} de ${est.limite} no mês.`
                : "Informe a cidade para ver a estimativa de chamadas."}
            </p>
            <button className="btn btn-lime" type="submit" disabled={scanning || (est ? !est.permitido : false)}>
              <Search size={16} /> {scanning ? "Buscando…" : "Escanear"}
            </button>
            {est && !est.permitido && <p style={{ margin: 0, color: "var(--bad)", fontSize: 12.5 }}>Limite mensal atingido. Ajuste em Ajustes.</p>}
          </form>

          <div className="card radar-card">
            <span className="eyebrow">{search ? `${nicheLabel(search.nicho)} · ${[search.bairro, search.cidade].filter(Boolean).join(", ")}` : "Radar"}</span>
            <div className={`scope${scanning || progress ? " scanning" : ""}`} style={{ marginTop: 12 }} role="img" aria-label={`Mapa radar com ${leads.length} empresas`}>
              <svg className="scope-grid" viewBox="0 0 100 100" aria-hidden>
                <circle cx="50" cy="50" r="16" />
                <circle cx="50" cy="50" r="32" />
                <circle cx="50" cy="50" r="48" />
                <line x1="50" y1="2" x2="50" y2="98" />
                <line x1="2" y1="50" x2="98" y2="50" />
              </svg>
              <div className="sweep" />
              <div className="me" />
              {center &&
                leads.map((l, i) => {
                  if (l.lat == null || l.lng == null) return null;
                  const dx = ((l.lng - center.lng) * 111.32 * Math.cos((center.lat * Math.PI) / 180)) / raio;
                  const dy = ((l.lat - center.lat) * 110.57) / raio;
                  const x = 50 + Math.max(-1, Math.min(1, dx)) * 46;
                  const y = 50 - Math.max(-1, Math.min(1, dy)) * 46;
                  const cls = l.faixa === "quente" ? "hot" : l.faixa === "morno" ? "warm" : "";
                  const off = !visible.includes(l);
                  return (
                    <button
                      key={l.id}
                      type="button"
                      className={`rdot ${cls}${off ? " off" : ""}`}
                      data-name={l.nome}
                      aria-label={`${l.nome}, score ${l.score}`}
                      style={{ left: `${x}%`, top: `${y}%`, ["--dl" as string]: `${i * 30}ms` }}
                      onClick={() => openLead(l.id)}
                    />
                  );
                })}
              <span className="scope-km">{raio} km</span>
            </div>
            <div className="rstats">
              <div>
                <span className="num">{leads.length}</span>
                <small>empresas</small>
              </div>
              <div>
                <span className="num" style={{ color: "var(--lime)" }}>{hot}</span>
                <small>quentes</small>
              </div>
              <div>
                <span className="num">{progress ? `${progress.feitos}/${progress.total}` : leads.filter((l) => l.enriquecimento === "feito").length}</span>
                <small>{progress ? "enriquecendo" : "analisadas"}</small>
              </div>
            </div>
          </div>

          {!!recent.length && (
            <div className="card">
              <span className="card-t">Buscas recentes</span>
              {recent.map((s) => (
                <button key={s.id} type="button" className="list-row" style={{ width: "100%", textAlign: "left" }} onClick={() => setSearchId(s.id)} aria-pressed={s.id === searchId}>
                  <div>
                    <b>
                      {nicheLabel(s.nicho)} · {[s.bairro, s.cidade].filter(Boolean).join(", ")}
                    </b>
                    <small>
                      {s.total_resultados} resultados · {s.raio_km} km · há {relativeTime(s.criada_em)}
                    </small>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <section aria-label="Resultados">
          <div className="results-h">
            <p>
              <b>{visible.length}</b> de {leads.length} empresas
            </p>
            <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} aria-label="Ordenar">
              <option value="score">Maior score</option>
              <option value="distancia">Mais perto</option>
              <option value="potencial">Maior potencial</option>
            </select>
          </div>
          <div className="toggles" style={{ marginBottom: 14 }}>
            {FILTERS.map((f) => (
              <button key={f.key} type="button" className="tog" aria-pressed={filters.has(f.key)} onClick={() => setFilters((s) => { const n = new Set(s); if (n.has(f.key)) n.delete(f.key); else n.add(f.key); return n; })}>
                {f.label}
              </button>
            ))}
            <label className="tog" style={{ gap: 8 }}>
              Score ≥ <input type="number" min={0} max={100} step={10} value={minScore} onChange={(e) => setMinScore(Number(e.target.value))} style={{ width: 60, height: 28 }} aria-label="Score mínimo" />
            </label>
            <button type="button" className="tog" aria-pressed={showContacted} onClick={() => setShowContacted((v) => !v)}>
              Incluir contatados (30 dias)
            </button>
          </div>

          {scanning ? (
            <div className="results">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="sk" />
              ))}
            </div>
          ) : !leads.length ? (
            <div className="card">
              <EmptyState icon={<RadarIcon size={22} />} title="Nenhuma busca ainda">
                Escolha um nicho, uma cidade e um raio e clique em Escanear. As empresas vêm do Google Places, com link do Maps para conferir.
              </EmptyState>
            </div>
          ) : (
            <div className="results">
              {visible.map((l) => {
                const potencial = l.services ? Number(l.services.preco_implantacao) + Number(l.services.mensalidade) * 12 : null;
                return (
                  <article key={l.id} className="card lc">
                    <div className="lc-top">
                      <span className="av" style={{ ["--c" as string]: l.faixa === "quente" ? "var(--hot)" : l.faixa === "morno" ? "var(--warn)" : "var(--ink-3)" }}>{initials(l.nome)}</span>
                      <div style={{ minWidth: 0 }}>
                        <h3>{l.nome}</h3>
                        <p>
                          {l.bairro ?? l.cidade ?? "—"}
                          {l.distancia_km != null && ` · ${String(l.distancia_km).replace(".", ",")} km`}
                        </p>
                      </div>
                      {l.enriquecimento === "feito" ? <ScoreRing score={l.score} faixa={l.faixa} /> : <span className="unverified">{l.enriquecimento === "erro" ? "erro" : "analisando"}</span>}
                    </div>
                    <div className="sigs">
                      {l.enriquecimento === "feito" && <TierChip faixa={l.faixa} />}
                      {chips(l).map((c) => (
                        <span key={c.t} className={`sig ${c.kind}`}>
                          {c.t}
                        </span>
                      ))}
                      {l.status === "salvo" && <span className="sig neu">no pipeline</span>}
                    </div>
                    <div className="lc-foot">
                      <div>
                        {l.services ? (
                          <>
                            <small>{l.services.nome}</small>
                            <b>{money(potencial)}</b>
                            <small>potencial em 12 meses</small>
                          </>
                        ) : (
                          <small>Sem pacote no catálogo para este nicho</small>
                        )}
                      </div>
                      <div className="lc-act">
                        <button className="btn btn-sm btn-ghost" type="button" onClick={() => openLead(l.id)}>
                          <FileText size={14} /> Diagnóstico
                        </button>
                        {l.status !== "salvo" && l.status !== "cliente" && (
                          <button className="btn btn-sm btn-lime" type="button" onClick={() => act(() => saveLead(l.id), "Salvo no pipeline")} aria-label={`Salvar ${l.nome} no pipeline`}>
                            <BookmarkPlus size={14} />
                          </button>
                        )}
                        <button className="btn btn-sm btn-ghost" type="button" aria-label={`Não contatar ${l.nome}`} title="Não contatar" onClick={() => confirm(`Marcar ${l.nome} como "não contatar"?`) && act(() => markDoNotContact(l.id), "Não será mais contatado")}>
                          <Ban size={14} />
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
