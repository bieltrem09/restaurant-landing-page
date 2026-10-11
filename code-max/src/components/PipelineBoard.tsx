"use client";

import { ArrowRight, Eye, FileSignature, Kanban, Trophy, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createProposal, moveStage, registerWin } from "@/app/actions";
import { relativeTime } from "@/lib/dates";
import { money, moneyShort } from "@/lib/format";
import { nicheLabel } from "@/lib/niches";
import { LOSS_REASONS, STAGES, STAGE_LABEL, dealValue, nextStage, type Stage } from "@/lib/pipeline";
import type { Service } from "@/lib/types";
import { useApp } from "./app-context";
import { EmptyState, Modal, confetti, useCopy, useToast } from "./ui";

type DealRow = {
  id: string;
  lead_id: string;
  etapa: Stage;
  valor_implantacao: number;
  mensalidade: number;
  entrou_na_etapa_em: string;
  proximo_followup_em: string | null;
  criado_em: string;
  service_id: string | null;
  vistos: number;
  leads: { nome: string; nicho: string; score: number; faixa: "quente" | "morno" | "frio"; ultimo_contato_em: string | null } | null;
};

const COLS: Stage[] = [...STAGES];
const DOT: Record<Stage, string> = { novo: "var(--ink-3)", contato: "var(--n1)", exemplo: "var(--n3)", proposta: "var(--n5)", negociacao: "var(--warn)", ganho: "var(--hot)", perdido: "var(--bad)" };

function toLocalInput(d: Date) {
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16);
}

export function PipelineBoard({ deals: initial, services, totals, now }: { deals: DealRow[]; services: Service[]; totals: { emAberto: number; ponderada: number; ganhosMes: number; ganhosMesQtd: number; cicloMedioDias: number | null }; now: string }) {
  const [deals, setDeals] = useState(initial);
  const [over, setOver] = useState<Stage | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [landed, setLanded] = useState<string | null>(null);
  const [win, setWin] = useState<DealRow | null>(null);
  const [lose, setLose] = useState<DealRow | null>(null);
  const [proposal, setProposal] = useState<DealRow | null>(null);
  const { openLead } = useApp();
  const toast = useToast();
  const copy = useCopy();
  const router = useRouter();

  const [prevInitial, setPrevInitial] = useState(initial);
  if (prevInitial !== initial) {
    setPrevInitial(initial);
    setDeals(initial);
  }

  async function move(d: DealRow, to: Stage) {
    if (d.etapa === to) return;
    if (to === "ganho") return setWin(d);
    if (to === "perdido") return setLose(d);
    const prev = deals;
    setDeals((l) => l.map((x) => (x.id === d.id ? { ...x, etapa: to, entrou_na_etapa_em: new Date().toISOString() } : x)));
    setLanded(d.id);
    const r = await moveStage(d.id, to);
    if (!r.ok) {
      setDeals(prev);
      toast({ title: "Não deu certo", body: r.error });
    } else router.refresh();
  }

  const nowD = new Date(now);
  return (
    <>
      <header className="top">
        <div className="top-title">
          <span className="eyebrow">Pipeline</span>
          <h1>Do primeiro contato ao contrato</h1>
        </div>
      </header>

      <div className="pstats">
        <div className="card pstat">
          <small>Em aberto (implantação + 12 meses)</small>
          <span className="num">{money(totals.emAberto)}</span>
        </div>
        <div className="card pstat">
          <small>Previsão ponderada</small>
          <span className="num">{money(totals.ponderada)}</span>
        </div>
        <div className="card pstat">
          <small>Ganhos no mês</small>
          <span className="num">{money(totals.ganhosMes)}</span>
          <small>{totals.ganhosMesQtd} contrato(s)</small>
        </div>
        <div className="card pstat">
          <small>Ciclo médio de venda</small>
          <span className="num">{totals.cicloMedioDias === null ? "—" : `${totals.cicloMedioDias.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} dias`}</span>
          <small>{totals.cicloMedioDias === null ? "Calculado a partir do primeiro ganho" : "do cadastro ao ganho"}</small>
        </div>
      </div>

      {!deals.length ? (
        <div className="card">
          <EmptyState icon={<Kanban size={22} />} title="Pipeline vazio" action={<Link className="btn btn-lime" href="/radar">Abrir o Radar</Link>}>
            Salve leads do Radar para começar. Cada lead salvo entra em “Novo”.
          </EmptyState>
        </div>
      ) : (
        <div className="board" aria-label="Quadro do pipeline">
          {COLS.map((col) => {
            const list = deals.filter((d) => d.etapa === col);
            const sum = list.reduce((s, d) => s + dealValue({ valor_implantacao: Number(d.valor_implantacao), mensalidade: Number(d.mensalidade) }), 0);
            return (
              <section
                key={col}
                className={`col${over === col ? " over" : ""}${col === "ganho" ? " won" : ""}`}
                aria-label={STAGE_LABEL[col]}
                onDragOver={(e) => (e.preventDefault(), setOver(col))}
                onDragLeave={() => setOver((o) => (o === col ? null : o))}
                onDrop={(e) => {
                  e.preventDefault();
                  setOver(null);
                  const d = deals.find((x) => x.id === e.dataTransfer.getData("text/plain"));
                  if (d) void move(d, col);
                }}
              >
                <div className="col-h">
                  <i style={{ background: DOT[col] }} />
                  {STAGE_LABEL[col]}
                  <span className="cnt">{list.length}</span>
                  <span className="sum">{sum ? moneyShort(sum) : ""}</span>
                </div>
                {list.map((d) => {
                  const dias = Math.floor((nowD.getTime() - new Date(d.entrou_na_etapa_em).getTime()) / 86_400_000);
                  const overdue = d.proximo_followup_em && new Date(d.proximo_followup_em) < nowD && col !== "ganho" && col !== "perdido";
                  const nx = nextStage(col);
                  return (
                    <article
                      key={d.id}
                      className={`deal${dragId === d.id ? " dragging" : ""}${landed === d.id ? " land" : ""}`}
                      draggable
                      onDragStart={(e) => (e.dataTransfer.setData("text/plain", d.id), setDragId(d.id))}
                      onDragEnd={() => setDragId(null)}
                      style={overdue ? { borderColor: "var(--bad)", boxShadow: "0 0 0 1px var(--bad)" } : undefined}
                    >
                      <div className="deal-top">
                        <span className="tag" style={{ ["--c" as string]: "var(--n1)" }}>{nicheLabel(d.leads?.nicho ?? "")}</span>
                        <span className={`mini ${d.leads?.faixa === "quente" ? "hot" : d.leads?.faixa === "morno" ? "warm" : "cold"}`}>{d.leads?.score ?? 0}</span>
                      </div>
                      <button type="button" onClick={() => openLead(d.lead_id)} style={{ textAlign: "left" }}>
                        <h4>{d.leads?.nome}</h4>
                      </button>
                      <p>
                        {dias} dia(s) na etapa · {d.leads?.ultimo_contato_em ? `contato há ${relativeTime(d.leads.ultimo_contato_em)}` : "sem contato"}
                      </p>
                      {overdue && <p style={{ color: "var(--bad)", fontWeight: 600 }}>Follow-up atrasado</p>}
                      <div className="deal-foot">
                        <b>{Number(d.mensalidade) ? `${money(Number(d.valor_implantacao))} + ${money(Number(d.mensalidade))}/m` : money(Number(d.valor_implantacao))}</b>
                        <span style={{ display: "flex", gap: 4, alignItems: "center" }}>
                          {d.vistos > 0 && (
                            <span className="sig good" title="Aberturas rastreadas">
                              <Eye size={11} /> Visto {d.vistos}x
                            </span>
                          )}
                          {col !== "ganho" && col !== "perdido" && (
                            <>
                              <button className="adv" type="button" title="Gerar proposta" aria-label={`Gerar proposta para ${d.leads?.nome}`} onClick={() => setProposal(d)}>
                                <FileSignature size={14} />
                              </button>
                              <button className="adv" type="button" title="Perdido" aria-label={`Marcar ${d.leads?.nome} como perdido`} onClick={() => setLose(d)}>
                                <X size={14} />
                              </button>
                            </>
                          )}
                          {nx && (
                            <button className="adv" type="button" title={`Avançar para ${STAGE_LABEL[nx]}`} aria-label={`Avançar ${d.leads?.nome} para ${STAGE_LABEL[nx]}`} onClick={() => move(d, nx)}>
                              {nx === "ganho" ? <Trophy size={14} /> : <ArrowRight size={14} />}
                            </button>
                          )}
                        </span>
                      </div>
                    </article>
                  );
                })}
                {!list.length && <div className="col-empty">Arraste um card para cá</div>}
              </section>
            );
          })}
        </div>
      )}

      <WinModal
        deal={win}
        onClose={() => setWin(null)}
        onDone={async () => {
          setWin(null);
          await confetti();
          toast({ title: "Contrato fechado!", body: "Cliente, projeto e pagamento registrados.", icon: <Trophy size={16} /> });
          router.refresh();
        }}
      />
      <LoseModal deal={lose} onClose={() => setLose(null)} onDone={() => (setLose(null), router.refresh())} />
      <Modal open={!!proposal} onClose={() => setProposal(null)} title="Gerar proposta">
        {services.length ? (
          <div>
            <p className="muted" style={{ marginTop: 0 }}>Escolha o pacote do catálogo. Valores e prazos vêm dele.</p>
            {services.map((s) => (
              <button
                key={s.id}
                type="button"
                className="list-row"
                style={{ width: "100%", textAlign: "left" }}
                onClick={async () => {
                  if (!proposal) return;
                  const r = await createProposal(proposal.id, s.id);
                  setProposal(null);
                  if (r.ok && r.data) {
                    await copy(r.data.url, "Link da proposta copiado");
                    router.refresh();
                  } else if (!r.ok) toast({ title: "Não deu certo", body: r.error });
                }}
              >
                <div>
                  <b>{s.nome}</b>
                  <small>
                    {money(Number(s.preco_implantacao))} + {money(Number(s.mensalidade))}/mês · {s.prazo_dias} dias
                  </small>
                </div>
                <ArrowRight size={16} />
              </button>
            ))}
          </div>
        ) : (
          <p>
            Cadastre um serviço em <Link href="/ajustes">Ajustes</Link> para gerar propostas.
          </p>
        )}
      </Modal>
    </>
  );
}

function WinModal({ deal, onClose, onDone }: { deal: DealRow | null; onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState({ valor_implantacao: "0", mensalidade: "0", dia: "", pagoValor: "", forma: "pix" as "pix" | "boleto" | "cartao" | "dinheiro", pagoEm: toLocalInput(new Date()) });
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const [prevDeal, setPrevDeal] = useState<DealRow | null>(null);
  if (deal && deal !== prevDeal) {
    setPrevDeal(deal);
    setF((x) => ({ ...x, valor_implantacao: String(deal.valor_implantacao), mensalidade: String(deal.mensalidade), pagoValor: String(Number(deal.valor_implantacao) || Number(deal.mensalidade) || "") }));
  }
  return (
    <Modal
      open={!!deal}
      onClose={onClose}
      title={`Ganhou ${deal?.leads?.nome ?? ""}?`}
      actions={
        <button
          className="btn btn-lime"
          type="button"
          disabled={busy}
          onClick={async () => {
            if (!deal) return;
            setBusy(true);
            const r = await registerWin({
              dealId: deal.id,
              valor_implantacao: Number(f.valor_implantacao),
              mensalidade: Number(f.mensalidade),
              dia_vencimento: f.dia ? Number(f.dia) : null,
              pagamento: Number(f.pagoValor) > 0 ? { valor: Number(f.pagoValor), forma: f.forma, pago_em: new Date(f.pagoEm).toISOString() } : null,
            });
            setBusy(false);
            if (r.ok) onDone();
            else toast({ title: "Não deu certo", body: r.error });
          }}
        >
          <Trophy size={16} /> Registrar contrato
        </button>
      }
    >
      <div className="form-grid">
        <div className="field">
          <label htmlFor="w-imp">Implantação (R$)</label>
          <input id="w-imp" type="number" min={0} step="0.01" value={f.valor_implantacao} onChange={(e) => setF({ ...f, valor_implantacao: e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor="w-men">Mensalidade (R$)</label>
          <input id="w-men" type="number" min={0} step="0.01" value={f.mensalidade} onChange={(e) => setF({ ...f, mensalidade: e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor="w-dia">Dia de vencimento</label>
          <input id="w-dia" type="number" min={1} max={28} value={f.dia} onChange={(e) => setF({ ...f, dia: e.target.value })} placeholder="ex.: 10" />
        </div>
        <div className="field full">
          <label>Primeiro pagamento</label>
          <span className="hint">É daqui que sai o faturamento do painel. Deixe o valor vazio se ainda não recebeu.</span>
        </div>
        <div className="field">
          <label htmlFor="w-val">Valor recebido (R$)</label>
          <input id="w-val" type="number" min={0} step="0.01" value={f.pagoValor} onChange={(e) => setF({ ...f, pagoValor: e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor="w-forma">Forma</label>
          <select id="w-forma" value={f.forma} onChange={(e) => setF({ ...f, forma: e.target.value as typeof f.forma })}>
            <option value="pix">Pix</option>
            <option value="boleto">Boleto</option>
            <option value="cartao">Cartão</option>
            <option value="dinheiro">Dinheiro</option>
          </select>
        </div>
        <div className="field full">
          <label htmlFor="w-data">Data do pagamento</label>
          <input id="w-data" type="datetime-local" value={f.pagoEm} onChange={(e) => setF({ ...f, pagoEm: e.target.value })} />
        </div>
      </div>
    </Modal>
  );
}

function LoseModal({ deal, onClose, onDone }: { deal: DealRow | null; onClose: () => void; onDone: () => void }) {
  const [motivo, setMotivo] = useState<string>("");
  const [texto, setTexto] = useState("");
  const toast = useToast();
  return (
    <Modal
      open={!!deal}
      onClose={onClose}
      title="Por que perdeu?"
      actions={
        <button
          className="btn btn-dark"
          type="button"
          disabled={!motivo}
          onClick={async () => {
            if (!deal) return;
            const r = await moveStage(deal.id, "perdido", motivo, texto || undefined);
            if (r.ok) {
              setMotivo("");
              setTexto("");
              onDone();
            } else toast({ title: "Não deu certo", body: r.error });
          }}
        >
          Marcar como perdido
        </button>
      }
    >
      <div className="toggles">
        {Object.entries(LOSS_REASONS).map(([k, v]) => (
          <button key={k} type="button" className="tog" aria-pressed={motivo === k} onClick={() => setMotivo(k)}>
            {v}
          </button>
        ))}
      </div>
      <div className="field" style={{ marginTop: 12 }}>
        <label htmlFor="l-txt">Detalhe (opcional)</label>
        <textarea id="l-txt" value={texto} onChange={(e) => setTexto(e.target.value)} />
      </div>
    </Modal>
  );
}
