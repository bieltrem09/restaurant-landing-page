"use client";

import { Check, ExternalLink, Sparkles, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { addPayment, toggleSubscription, updateProject } from "@/app/actions";
import { subscriptionStatus } from "@/lib/billing";
import { formatDateSP } from "@/lib/dates";
import { initials, money } from "@/lib/format";
import { nicheLabel } from "@/lib/niches";
import { useApp } from "./app-context";
import { EmptyState, Modal, Seg, useToast } from "./ui";

type Client = { id: string; nome: string; nicho: string; telefone: string | null; lead_id: string | null; criado_em: string };
type Project = { id: string; client_id: string; titulo: string; status: string; progresso: number; entrega_prevista: string | null; url_site: string | null };
type Sub = { id: string; client_id: string; descricao: string; valor: number; dia_vencimento: number; ativa: boolean; inicio: string };
type Payment = { id: string; client_id: string; subscription_id: string | null; valor: number; forma: string; pago_em: string; referencia: string | null };

const STATUS: Record<string, { label: string; cls: string }> = {
  briefing: { label: "Briefing", cls: "briefing" },
  design: { label: "Em design", cls: "design" },
  desenvolvimento: { label: "Em desenvolvimento", cls: "dev" },
  aprovacao: { label: "Aprovação do cliente", cls: "review" },
  no_ar: { label: "No ar", cls: "live" },
  manutencao: { label: "Manutenção", cls: "maint" },
};
const FORMA: Record<string, string> = { pix: "Pix", boleto: "Boleto", cartao: "Cartão", dinheiro: "Dinheiro" };

export function ClientsView({ clients, projects, subs, payments, now }: { clients: Client[]; projects: Project[]; subs: Sub[]; payments: Payment[]; now: string }) {
  const [tab, setTab] = useState<"projetos" | "mensalidades" | "pagamentos">("projetos");
  const [editing, setEditing] = useState<Project | null>(null);
  const [paying, setPaying] = useState<{ clientId: string; subscriptionId?: string; valor?: number } | null>(null);
  const router = useRouter();
  const toast = useToast();
  const { openOrdeliry } = useApp();
  const nowD = new Date(now);
  const byId = new Map(clients.map((c) => [c.id, c]));

  async function run(fn: () => Promise<{ ok: boolean; error?: string }>, title: string) {
    const r = await fn();
    toast(r.ok ? { title } : { title: "Não deu certo", body: r.error });
    if (r.ok) router.refresh();
    return r.ok;
  }

  const vencidas = subs.filter((s) => subscriptionStatus({ ...s, valor: Number(s.valor) }, payments, nowD).status === "vencida");

  return (
    <>
      <header className="top">
        <div className="top-title">
          <span className="eyebrow">Clientes e financeiro</span>
          <h1>Projetos entregues e o que entra no caixa</h1>
          {!!vencidas.length && <p className="sub" style={{ color: "var(--bad)" }}>{vencidas.length} mensalidade(s) vencida(s).</p>}
        </div>
        <Seg
          label="Seção"
          value={tab}
          onChange={setTab}
          options={[
            { value: "projetos", label: "Projetos" },
            { value: "mensalidades", label: "Mensalidades" },
            { value: "pagamentos", label: "Pagamentos" },
          ]}
        />
      </header>

      {!clients.length ? (
        <div className="card">
          <EmptyState icon={<Users size={22} />} title="Nenhum cliente ainda">
            Quando um negócio entra em Ganho no Pipeline, o cliente e o projeto aparecem aqui automaticamente.
          </EmptyState>
        </div>
      ) : (
        <div className="card">
          {tab === "projetos" && (
            <div className="tbl-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Cliente</th>
                    <th>Status</th>
                    <th>Progresso</th>
                    <th>Entrega</th>
                    <th>Site</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {projects.map((p, i) => {
                    const c = byId.get(p.client_id);
                    return (
                      <tr key={p.id}>
                        <td>
                          <div className="cl">
                            <span className="av" style={{ ["--c" as string]: "var(--n4)" }}>{initials(c?.nome ?? "?")}</span>
                            <div>
                              <b>{c?.nome}</b>
                              <small>{p.titulo}</small>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className={`st ${STATUS[p.status]?.cls}`}>{STATUS[p.status]?.label}</span>
                        </td>
                        <td>
                          <div className="prog">
                            <div className="t">
                              <i className={p.progresso >= 100 ? "full" : ""} style={{ width: `${p.progresso}%`, ["--d" as string]: i }} />
                            </div>
                            <span>{p.progresso}%</span>
                          </div>
                        </td>
                        <td>{p.entrega_prevista ? formatDateSP(`${p.entrega_prevista}T12:00:00-03:00`) : "—"}</td>
                        <td>
                          {p.url_site ? (
                            <a href={p.url_site} target="_blank" rel="noreferrer" className="link-btn">
                              <ExternalLink size={14} /> abrir
                            </a>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td>
                          <button className="btn btn-sm btn-ghost" type="button" onClick={() => setEditing(p)}>
                            Atualizar
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {tab === "mensalidades" && (
            <div className="tbl-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Cliente</th>
                    <th>Valor</th>
                    <th>Vencimento</th>
                    <th>Situação</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {subs.map((s) => {
                    const c = byId.get(s.client_id);
                    const st = subscriptionStatus({ ...s, valor: Number(s.valor) }, payments, nowD);
                    return (
                      <tr key={s.id}>
                        <td>
                          <b>{c?.nome}</b>
                          <br />
                          <small className="muted">{nicheLabel(c?.nicho ?? "")}</small>
                        </td>
                        <td>{money(Number(s.valor), true)}</td>
                        <td>dia {s.dia_vencimento}</td>
                        <td>
                          <span className={`st ${st.status === "paga" ? "live" : st.status === "vencida" ? "review" : "briefing"}`} style={st.status === "vencida" ? { background: "var(--bad-soft)", color: "var(--bad)" } : undefined}>
                            {st.status === "paga" ? "Paga" : st.status === "vencida" ? "Vencida" : st.status === "inativa" ? "Inativa" : "A vencer"}
                          </span>
                        </td>
                        <td>
                          <div className="page-actions">
                            {s.ativa && st.status !== "paga" && (
                              <button
                                className="btn btn-sm btn-lime"
                                type="button"
                                onClick={() => run(() => addPayment({ clientId: s.client_id, subscriptionId: s.id, valor: Number(s.valor), forma: "pix", pago_em: new Date().toISOString(), referencia: "Mensalidade" }), "Marcado como pago")}
                              >
                                <Check size={14} /> Marcar como pago
                              </button>
                            )}
                            {st.status === "vencida" && (
                              <button
                                className="btn btn-sm btn-ghost"
                                type="button"
                                onClick={() =>
                                  openOrdeliry({
                                    leadId: c?.lead_id,
                                    leadNome: c?.nome,
                                    prefill: `Escreva uma mensagem de cobrança gentil para ${c?.nome}: mensalidade de ${money(Number(s.valor), true)} venceu no dia ${s.dia_vencimento}. Sem tom de ameaça; ofereça o Pix e pergunte se está tudo certo com o site.`,
                                  })
                                }
                              >
                                <Sparkles size={14} /> Cobrança gentil
                              </button>
                            )}
                            <button className="btn btn-sm btn-ghost" type="button" onClick={() => run(() => toggleSubscription(s.id, !s.ativa), s.ativa ? "Assinatura pausada" : "Assinatura reativada")}>
                              {s.ativa ? "Pausar" : "Reativar"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {!subs.length && (
                    <tr>
                      <td colSpan={5} className="muted">
                        Nenhuma mensalidade cadastrada.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {tab === "pagamentos" && (
            <>
              <div className="page-actions" style={{ marginBottom: 12 }}>
                <select aria-label="Cliente do pagamento" onChange={(e) => e.target.value && setPaying({ clientId: e.target.value })} value="">
                  <option value="">Registrar pagamento de…</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome}
                    </option>
                  ))}
                </select>
              </div>
              <div className="tbl-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Data</th>
                      <th>Cliente</th>
                      <th>Referência</th>
                      <th>Forma</th>
                      <th style={{ textAlign: "right" }}>Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((p) => (
                      <tr key={p.id}>
                        <td className="mono">{formatDateSP(p.pago_em)}</td>
                        <td>{byId.get(p.client_id)?.nome}</td>
                        <td>{p.referencia ?? "—"}</td>
                        <td>{FORMA[p.forma]}</td>
                        <td className="mono" style={{ textAlign: "right" }}>
                          {money(Number(p.valor), true)}
                        </td>
                      </tr>
                    ))}
                    {!payments.length && (
                      <tr>
                        <td colSpan={5} className="muted">
                          Nenhum pagamento registrado.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      <ProjectModal project={editing} onClose={() => setEditing(null)} onSave={async (d) => (await run(() => updateProject(d as Parameters<typeof updateProject>[0]), "Projeto atualizado")) && setEditing(null)} />
      <PaymentModal target={paying} onClose={() => setPaying(null)} onSave={async (d) => (await run(() => addPayment(d), "Pagamento registrado")) && setPaying(null)} />
    </>
  );
}

function ProjectModal({ project, onClose, onSave }: { project: Project | null; onClose: () => void; onSave: (d: { id: string; status: string; progresso: number; entrega_prevista: string | null; url_site: string }) => void }) {
  const [f, setF] = useState({ status: "briefing", progresso: 0, entrega: "", url: "" });
  const [last, setLast] = useState<string | null>(null);
  if (project && project.id !== last) {
    setLast(project.id);
    setF({ status: project.status, progresso: project.progresso, entrega: project.entrega_prevista ?? "", url: project.url_site ?? "" });
  }
  return (
    <Modal
      open={!!project}
      onClose={onClose}
      title="Atualizar projeto"
      actions={
        <button className="btn btn-lime" type="button" onClick={() => project && onSave({ id: project.id, status: f.status, progresso: f.progresso, entrega_prevista: f.entrega || null, url_site: f.url })}>
          Salvar
        </button>
      }
    >
      <div className="form-grid">
        <div className="field full">
          <label htmlFor="pj-st">Status</label>
          <select id="pj-st" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>
            {Object.entries(STATUS).map(([k, v]) => (
              <option key={k} value={k}>
                {v.label}
              </option>
            ))}
          </select>
        </div>
        <div className="field full">
          <label htmlFor="pj-pr">
            Progresso <output>{f.progresso}%</output>
          </label>
          <input id="pj-pr" type="range" min={0} max={100} step={5} value={f.progresso} onChange={(e) => setF({ ...f, progresso: Number(e.target.value) })} />
        </div>
        <div className="field">
          <label htmlFor="pj-en">Entrega prevista</label>
          <input id="pj-en" type="date" value={f.entrega} onChange={(e) => setF({ ...f, entrega: e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor="pj-url">URL do site</label>
          <input id="pj-url" type="url" value={f.url} onChange={(e) => setF({ ...f, url: e.target.value })} />
        </div>
      </div>
    </Modal>
  );
}

function PaymentModal({ target, onClose, onSave }: { target: { clientId: string } | null; onClose: () => void; onSave: (d: { clientId: string; valor: number; forma: "pix" | "boleto" | "cartao" | "dinheiro"; pago_em: string; referencia?: string }) => void }) {
  const [f, setF] = useState({ valor: "", forma: "pix" as "pix" | "boleto" | "cartao" | "dinheiro", data: new Date().toISOString().slice(0, 10), ref: "" });
  return (
    <Modal
      open={!!target}
      onClose={onClose}
      title="Registrar pagamento"
      actions={
        <button className="btn btn-lime" type="button" onClick={() => target && onSave({ clientId: target.clientId, valor: Number(f.valor), forma: f.forma, pago_em: `${f.data}T12:00:00-03:00`, referencia: f.ref || undefined })}>
          Registrar
        </button>
      }
    >
      <div className="form-grid">
        <div className="field">
          <label htmlFor="pg-v">Valor (R$)</label>
          <input id="pg-v" type="number" min={0} step="0.01" value={f.valor} onChange={(e) => setF({ ...f, valor: e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor="pg-f">Forma</label>
          <select id="pg-f" value={f.forma} onChange={(e) => setF({ ...f, forma: e.target.value as typeof f.forma })}>
            {Object.entries(FORMA).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="pg-d">Data</label>
          <input id="pg-d" type="date" value={f.data} onChange={(e) => setF({ ...f, data: e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor="pg-r">Referência</label>
          <input id="pg-r" type="text" value={f.ref} onChange={(e) => setF({ ...f, ref: e.target.value })} placeholder="Implantação, mensalidade…" />
        </div>
      </div>
    </Modal>
  );
}
