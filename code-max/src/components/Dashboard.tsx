"use client";

import { CheckCircle2, Eye, Inbox, Radar, Receipt, Repeat, Sparkles, Target, Trophy, Wallet } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { DashboardData } from "@/lib/dashboard-data";
import { formatDateTimeSP, relativeTime } from "@/lib/dates";
import { money, moneyShort, pct } from "@/lib/format";
import { nicheLabel } from "@/lib/niches";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useApp } from "./app-context";
import { CountUp, Delta, EmptyState, Seg } from "./ui";

const NICHE_COLORS = ["var(--n1)", "var(--n2)", "var(--n3)", "var(--n4)", "var(--n5)", "var(--ink-3)"];
const fmtMoney = (v: number) => money(v);
const fmtInt = (v: number) => Math.round(v).toLocaleString("pt-BR");
const fmtPct = (v: number) => pct(v, 1);

type Feed = DashboardData["activity"][number];

function RevenueTooltip({ active, payload, compare }: { active?: boolean; payload?: Array<{ payload: DashboardData["series"][number] }>; compare: boolean }) {
  if (!active || !payload?.length) return null;
  const b = payload[0].payload;
  return (
    <div className="tip on" style={{ position: "static", transform: "none" }}>
      <div className="t-l">{b.label}</div>
      {b.futuro ? (
        <>
          <div className="t-v">{money(b.projecao ?? 0)}</div>
          <div className="t-p">projeção (média dos últimos 30 dias)</div>
        </>
      ) : (
        <>
          <div className="t-v">{money(b.atual ?? 0)}</div>
          <div className="t-p">
            {b.pagamentos} pagamento{b.pagamentos === 1 ? "" : "s"}
            {compare && b.anterior !== null ? ` · anterior ${money(b.anterior)}` : ""}
          </div>
        </>
      )}
    </div>
  );
}

export function Dashboard({ data, compare, from, to }: { data: DashboardData; compare: boolean; from?: string; to?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { openLead, openOrdeliry } = useApp();
  const [feed, setFeed] = useState<Feed[]>(data.activity);
  const [custom, setCustom] = useState({ from: from ?? "", to: to ?? "" });
  const [newIds, setNewIds] = useState<Set<number>>(new Set());

  // Novo carregamento do servidor substitui o feed local.
  const [prevActivity, setPrevActivity] = useState(data.activity);
  if (prevActivity !== data.activity) {
    setPrevActivity(data.activity);
    setFeed(data.activity);
  }

  // Feed e presença em tempo real (Supabase Realtime; RLS filtra pelo usuário).
  useEffect(() => {
    const sb = supabaseBrowser();
    const ch = sb
      .channel("feed")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "activity" }, (p) => {
        const row = p.new as Feed;
        setFeed((f) => [row, ...f].slice(0, 15));
        setNewIds((s) => new Set(s).add(row.id));
        if (row.tipo === "presenca") router.refresh();
      })
      .subscribe();
    return () => {
      void sb.removeChannel(ch);
    };
  }, [router]);

  const setParam = (k: string, v: string | null) => {
    const p = new URLSearchParams(params.toString());
    if (v === null) p.delete(k);
    else p.set(k, v);
    router.push(`${pathname}?${p.toString()}`, { scroll: false });
  };

  const k = data.kpis;
  const series = data.series.map((b) => ({ ...b, atualV: b.atual ?? 0, projV: b.projecao ?? 0, antV: compare ? (b.anterior ?? 0) : 0 }));
  const total = data.kpis.faturamento.valor;
  const ring = 2 * Math.PI * 50;
  const nicheTotal = data.porNicho.reduce((s, n) => s + n.valor, 0);

  return (
    <>
      <header className="top">
        <div className="top-title">
          <span className="eyebrow">Visão geral</span>
          <h1>{data.headline}</h1>
        </div>
        <div className="rev-controls">
          <Seg
            label="Período"
            value={data.period}
            onChange={(v) => setParam("period", v)}
            options={[
              { value: "dia", label: "Dia" },
              { value: "semana", label: "Semana" },
              { value: "mes", label: "Mês" },
              { value: "ano", label: "Ano" },
              { value: "custom", label: "Intervalo" },
            ]}
          />
          <label className="switch">
            <input type="checkbox" checked={compare} onChange={(e) => setParam("compare", e.target.checked ? null : "0")} />
            <span />
            Comparar com anterior
          </label>
        </div>
      </header>
      {params.get("period") === "custom" && (
        <form
          className="card"
          style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "end", marginBottom: 16 }}
          onSubmit={(e) => {
            e.preventDefault();
            const p = new URLSearchParams(params.toString());
            p.set("from", custom.from);
            p.set("to", custom.to);
            router.push(`${pathname}?${p}`);
          }}
        >
          <div className="field">
            <label htmlFor="cf">De</label>
            <input id="cf" type="date" required value={custom.from} onChange={(e) => setCustom({ ...custom, from: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="ct">Até</label>
            <input id="ct" type="date" required value={custom.to} onChange={(e) => setCustom({ ...custom, to: e.target.value })} />
          </div>
          <button className="btn btn-dark" type="submit">
            Aplicar
          </button>
        </form>
      )}

      <div className="grid play">
        <div className="kpis span-12" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 190px), 1fr))" }}>
          <article className="card kpi hero rise" style={{ ["--d" as string]: 0 }}>
            <div className="kpi-top">
              <span>Faturamento recebido</span>
              <span className="kpi-ico">
                <Wallet size={18} />
              </span>
            </div>
            <CountUp className="num" value={k.faturamento.valor} format={fmtMoney} />
            <div className="kpi-foot">{compare && <Delta value={k.faturamento.delta} />}</div>
          </article>
          <article className="card kpi rise" style={{ ["--d" as string]: 1 }}>
            <div className="kpi-top">
              <span>Contratos fechados</span>
              <span className="kpi-ico">
                <CheckCircle2 size={18} />
              </span>
            </div>
            <CountUp className="num" value={k.contratos.valor} format={fmtInt} />
            <div className="kpi-foot">{compare && <Delta value={k.contratos.delta} />}</div>
          </article>
          <article className="card kpi rise" style={{ ["--d" as string]: 2 }}>
            <div className="kpi-top">
              <span>Ticket médio</span>
              <span className="kpi-ico">
                <Receipt size={18} />
              </span>
            </div>
            {k.ticketMedio.valor === null ? <span className="num">—</span> : <CountUp className="num" value={k.ticketMedio.valor} format={fmtMoney} />}
            <div className="kpi-foot">{compare && <Delta value={k.ticketMedio.delta} />}</div>
          </article>
          <article className="card kpi rise" style={{ ["--d" as string]: 3 }}>
            <div className="kpi-top">
              <span>Conversão</span>
              <span className="kpi-ico">
                <Target size={18} />
              </span>
            </div>
            {k.conversao.valor === null ? <span className="num">—</span> : <CountUp className="num" value={k.conversao.valor} format={fmtPct} />}
            <div className="kpi-foot">
              {compare && <Delta value={k.conversao.delta} points />}
              <span>contratos ÷ abordados</span>
            </div>
          </article>
          <article className="card kpi rise" style={{ ["--d" as string]: 4 }}>
            <div className="kpi-top">
              <span>MRR</span>
              <span className="kpi-ico">
                <Repeat size={18} />
              </span>
            </div>
            <CountUp className="num" value={k.mrr.valor} format={fmtMoney} />
            <div className="kpi-foot">mensalidades ativas</div>
          </article>
        </div>

        <article className="card span-8 rise rev-card" style={{ ["--d" as string]: 5 }}>
          <header className="card-h">
            <div>
              <span className="eyebrow">Faturamento no período</span>
              <div className="rev-total">
                <span className="num">{money(total)}</span>
                {compare && <Delta value={k.faturamento.delta} />}
              </div>
            </div>
          </header>
          {data.temDados ? (
            <>
              <div style={{ height: 290 }} role="img" aria-label={`Gráfico de faturamento: total ${money(total)}`}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={series} barGap={3} margin={{ left: 0, right: 4, top: 8 }}>
                    <defs>
                      <pattern id="proj" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                        <rect width="8" height="8" fill="var(--lime-soft)" />
                        <rect width="4" height="8" fill="color-mix(in srgb, var(--lime) 55%, transparent)" />
                      </pattern>
                    </defs>
                    <CartesianGrid vertical={false} strokeDasharray="3 4" />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} interval="preserveStartEnd" />
                    <YAxis tickLine={false} axisLine={false} width={56} tickFormatter={(v: number) => (v >= 1000 ? `${(v / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}k` : String(v))} />
                    <Tooltip cursor={{ fill: "var(--lime-soft)", radius: 10 }} content={<RevenueTooltip compare={compare} />} />
                    {compare && <Bar dataKey="antV" fill="color-mix(in srgb, var(--ink) 22%, transparent)" radius={[99, 99, 99, 99]} maxBarSize={8} isAnimationActive />}
                    <Bar dataKey="atualV" stackId="a" radius={[99, 99, 99, 99]} maxBarSize={26} isAnimationActive animationDuration={900}>
                      {series.map((b, i) => (
                        <Cell key={i} fill={b.agora ? "var(--ink)" : "var(--lime)"} />
                      ))}
                    </Bar>
                    <Bar dataKey="projV" stackId="a" fill="url(#proj)" radius={[99, 99, 99, 99]} maxBarSize={26} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="legend">
                <span>
                  <i style={{ background: "var(--lime)" }} />
                  Recebido
                </span>
                {compare && (
                  <span>
                    <i style={{ background: "color-mix(in srgb, var(--ink) 22%, transparent)" }} />
                    Período anterior
                  </span>
                )}
                <span>
                  <i style={{ background: "url(#proj)", border: "1.5px solid var(--lime)" }} />
                  Projeção
                </span>
              </div>
            </>
          ) : (
            <EmptyState icon={<Wallet size={22} />} title="Nenhum pagamento registrado ainda" action={<Link className="btn btn-lime" href="/radar"><Radar size={16} /> Encontrar leads</Link>}>
              O faturamento vem dos pagamentos que você registra ao ganhar um negócio ou em Clientes e financeiro. Nada aqui é estimado.
            </EmptyState>
          )}
        </article>

        <div className="stack span-4">
          <article className="card rise" style={{ ["--d" as string]: 6 }}>
            <header className="card-h">
              <div>
                <span className="card-t">Meta do mês</span>
              </div>
            </header>
            {data.meta.meta > 0 ? (
              <div className="goal-row">
                <div className="goal-ring">
                  <svg viewBox="0 0 116 116" aria-hidden>
                    <circle cx="58" cy="58" r="50" fill="none" stroke="var(--track)" strokeWidth="10" />
                    <circle className="arc" cx="58" cy="58" r="50" fill="none" stroke="var(--lime)" strokeWidth="10" strokeLinecap="round" strokeDasharray={`${(data.meta.pct / 100) * ring} ${ring}`} transform="rotate(-90 58 58)" />
                  </svg>
                  <div className="c">
                    <div>
                      <span className="num">{Math.round(data.meta.pct)}%</span>
                      <small>da meta</small>
                    </div>
                  </div>
                </div>
                <div className="goal-meta">
                  <b>{money(data.meta.falta)}</b>
                  <span>faltam de {money(data.meta.meta)}</span>
                  <span>
                    {data.meta.falta === 0
                      ? "Meta batida."
                      : data.meta.contratosPorSemana !== null
                        ? `${data.meta.contratosPorSemana} contrato(s) por semana no ticket médio atual`
                        : "Feche o primeiro contrato para calcular o ritmo."}
                  </span>
                  {data.metaContratos.meta > 0 && (
                    <span>
                      Contratos: {data.metaContratos.feitos} de {data.metaContratos.meta}
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <p className="muted" style={{ margin: 0 }}>
                Defina a meta em <Link href="/ajustes">Ajustes</Link>.
              </p>
            )}
          </article>

          <article className="card live rise" style={{ ["--d" as string]: 7 }}>
            <header className="card-h">
              <div>
                <span className="eyebrow">
                  <span className="pulse" style={{ display: "inline-block", marginRight: 6 }} />
                  Presença ao vivo
                </span>
                <p>Quem abriu seus exemplos, diagnósticos e propostas na última hora</p>
              </div>
            </header>
            {data.presence.length ? (
              <div className="reading">
                {data.presence.map((p) => (
                  <button key={p.id} type="button" onClick={() => openLead(p.lead_id)} style={{ textAlign: "left" }}>
                    <div>
                      <Eye size={16} className="ico" />
                      <span>
                        <b>{p.nome}</b>
                        <small>abriu {p.tipo === "exemplo" ? "o site de exemplo" : p.tipo === "diagnostico" ? "o diagnóstico" : "a proposta"}</small>
                      </span>
                      <small>{relativeTime(p.ocorreu_em)}</small>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <p style={{ margin: 0, color: "var(--side-mute)", fontSize: 13 }}>Ninguém agora. Gere um diagnóstico ou rastreie um site de exemplo pela ficha do lead.</p>
            )}
          </article>
        </div>

        <article className="card span-4 rise" style={{ ["--d" as string]: 8 }}>
          <header className="card-h">
            <span className="card-t">Funil do mês</span>
          </header>
          <div className="fun">
            {data.funil.map((s, i) => (
              <div className="fun-row" key={s.key}>
                <span>
                  {s.label}
                  {s.maiorQueda && <span className="sig bad" style={{ marginLeft: 6 }}>maior queda</span>}
                </span>
                <b>
                  {s.valor} {s.conversao !== null && <span className="fun-cv">· {pct(s.conversao)}</span>}
                </b>
                <div className="fun-bar">
                  <i style={{ width: `${data.funil[0].valor ? (s.valor / data.funil[0].valor) * 100 : 0}%`, ["--d" as string]: i }} />
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="card span-4 rise" style={{ ["--d" as string]: 9 }}>
          <header className="card-h">
            <span className="card-t">Receita por nicho</span>
          </header>
          {data.porNicho.length ? (
            <div className="donut-row">
              <div className="donut" role="img" aria-label="Receita por nicho">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={data.porNicho} dataKey="valor" nameKey="nicho" innerRadius={50} outerRadius={68} paddingAngle={2} stroke="none">
                      {data.porNicho.map((_, i) => (
                        <Cell key={i} fill={NICHE_COLORS[i % NICHE_COLORS.length]} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="c">
                  <div>
                    <span className="num">{moneyShort(nicheTotal)}</span>
                    <small>no período</small>
                  </div>
                </div>
              </div>
              <div className="dleg">
                {data.porNicho.map((n, i) => (
                  <div key={n.nicho}>
                    <i style={{ background: NICHE_COLORS[i % NICHE_COLORS.length] }} />
                    <span>{nicheLabel(n.nicho)}</span>
                    <b>{pct((n.valor / nicheTotal) * 100)}</b>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="muted" style={{ margin: 0 }}>Sem receita no período.</p>
          )}
        </article>

        <article className="card span-4 rise" style={{ ["--d" as string]: 10 }}>
          <header className="card-h">
            <div>
              <span className="card-t">Follow-ups de hoje</span>
              <p>{data.atrasados ? `${data.atrasados} atrasado(s)` : "Nada atrasado"}</p>
            </div>
          </header>
          {data.followups.length ? (
            data.followups.slice(0, 7).map((f) => {
              const late = new Date(f.vence_em) < new Date(new Date(data.now).setHours(0, 0, 0, 0));
              return (
                <div key={`${f.kind}-${f.id}`} className="ag" style={{ gridTemplateColumns: "minmax(0,1fr) auto", cursor: "default" }}>
                  <button type="button" onClick={() => f.lead_id && openLead(f.lead_id)} style={{ textAlign: "left", minWidth: 0 }}>
                    <b>{f.lead?.nome ?? f.titulo}</b>
                    <small style={late ? { color: "var(--bad)" } : undefined}>
                      {late ? "Atrasado · " : ""}
                      {formatDateTimeSP(f.vence_em)}
                    </small>
                  </button>
                  <button
                    className="btn btn-sm btn-ghost"
                    type="button"
                    onClick={() => openOrdeliry({ leadId: f.lead_id, leadNome: f.lead?.nome, mode: "followup", prefill: "Gere o próximo follow-up para este lead." })}
                    aria-label={`Gerar mensagem para ${f.lead?.nome ?? "lead"}`}
                  >
                    <Sparkles size={14} /> Gerar
                  </button>
                </div>
              );
            })
          ) : (
            <p className="muted" style={{ margin: 0 }}>Nenhum follow-up para hoje.</p>
          )}
        </article>

        <article className="card span-12 rise" style={{ ["--d" as string]: 11 }}>
          <header className="card-h">
            <span className="card-t">Atividade</span>
          </header>
          {feed.length ? (
            <div className="feed">
              {feed.map((a) => (
                <div key={a.id} className={`fi${a.tipo === "ganho" ? " won" : ""}${newIds.has(a.id) ? " new" : ""}`}>
                  <span className="fico">{a.tipo === "ganho" ? <Trophy size={16} /> : a.tipo === "presenca" ? <Eye size={16} /> : a.tipo === "busca" ? <Radar size={16} /> : <Inbox size={16} />}</span>
                  <button type="button" style={{ textAlign: "left" }} onClick={() => a.lead_id && openLead(a.lead_id)}>
                    {a.texto}
                  </button>
                  <time dateTime={a.ocorreu_em}>{relativeTime(a.ocorreu_em)}</time>
                </div>
              ))}
            </div>
          ) : (
            <p className="muted" style={{ margin: 0 }}>Sua atividade aparece aqui em tempo real.</p>
          )}
        </article>
      </div>
    </>
  );
}
