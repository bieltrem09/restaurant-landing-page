"use client";

import { Pencil, Plus, RotateCcw, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { deletePortfolio, deleteService, removeDoNotContact, saveProfile, saveSettings, upsertPortfolio, upsertService } from "@/app/actions";
import { money } from "@/lib/format";
import { NICHES, nicheLabel } from "@/lib/niches";
import { DEFAULT_WEIGHTS, WEIGHT_LABELS, type WeightKey } from "@/lib/score";
import type { PortfolioItem, Profile, Service } from "@/lib/types";
import { Modal, useToast } from "./ui";

function useAction() {
  const toast = useToast();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return {
    busy,
    run: async (fn: () => Promise<{ ok: boolean; error?: string }>, okTitle: string) => {
      setBusy(true);
      const r = await fn();
      setBusy(false);
      if (r.ok) {
        toast({ title: okTitle });
        router.refresh();
      } else toast({ title: "Não deu certo", body: r.error });
      return r.ok;
    },
  };
}

// ---------------------------------------------------------------- perfil
export function ProfileForm({ profile, onSaved }: { profile: Profile; onSaved?: () => void }) {
  const [f, setF] = useState({ nome: profile.nome, estudio: profile.estudio, whatsapp: profile.whatsapp, cidade_base: profile.cidade_base });
  const { busy, run } = useAction();
  return (
    <form
      className="form-grid"
      onSubmit={async (e) => {
        e.preventDefault();
        if (await run(() => saveProfile(f), "Perfil salvo")) onSaved?.();
      }}
    >
      <div className="field">
        <label htmlFor="p-nome">Nome que aparece nas mensagens</label>
        <input id="p-nome" type="text" required value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} />
      </div>
      <div className="field">
        <label htmlFor="p-est">Nome do estúdio</label>
        <input id="p-est" type="text" value={f.estudio} onChange={(e) => setF({ ...f, estudio: e.target.value })} />
      </div>
      <div className="field">
        <label htmlFor="p-wa">Seu WhatsApp</label>
        <input id="p-wa" type="tel" value={f.whatsapp} onChange={(e) => setF({ ...f, whatsapp: e.target.value })} placeholder="(11) 98765-4321" />
      </div>
      <div className="field">
        <label htmlFor="p-cid">Cidade base</label>
        <input id="p-cid" type="text" value={f.cidade_base} onChange={(e) => setF({ ...f, cidade_base: e.target.value })} />
      </div>
      <div className="full">
        <button className="btn btn-lime" type="submit" disabled={busy}>
          Salvar perfil
        </button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------- catálogo
const emptyService = { nome: "", nichos: [] as string[], descricao: "", inclui: "", nao_inclui: "", preco_implantacao: "0", mensalidade: "0", prazo_dias: "7", ativo: true };

export function ServicesEditor({ services }: { services: Service[] }) {
  const [edit, setEdit] = useState<(typeof emptyService & { id?: string }) | null>(null);
  const { busy, run } = useAction();
  const toggleNiche = (k: string) => edit && setEdit({ ...edit, nichos: edit.nichos.includes(k) ? edit.nichos.filter((x) => x !== k) : [...edit.nichos, k] });
  return (
    <div>
      {services.length ? (
        services.map((s) => (
          <div className="list-row" key={s.id}>
            <div>
              <b>
                {s.nome} {!s.ativo && <span className="unverified">inativo</span>}
              </b>
              <small>
                {money(Number(s.preco_implantacao))} de implantação + {money(Number(s.mensalidade))}/mês · {s.prazo_dias} dias ·{" "}
                {s.nichos.length ? s.nichos.map(nicheLabel).join(", ") : "todos os nichos"}
              </small>
            </div>
            <div className="page-actions">
              <button
                className="btn btn-sm btn-ghost"
                type="button"
                aria-label={`Editar ${s.nome}`}
                onClick={() =>
                  setEdit({
                    id: s.id,
                    nome: s.nome,
                    nichos: s.nichos,
                    descricao: s.descricao,
                    inclui: s.inclui.join("\n"),
                    nao_inclui: s.nao_inclui.join("\n"),
                    preco_implantacao: String(s.preco_implantacao),
                    mensalidade: String(s.mensalidade),
                    prazo_dias: String(s.prazo_dias),
                    ativo: s.ativo,
                  })
                }
              >
                <Pencil size={14} />
              </button>
              <button className="btn btn-sm btn-ghost" type="button" aria-label={`Excluir ${s.nome}`} onClick={() => confirm(`Excluir “${s.nome}”?`) && run(() => deleteService(s.id), "Serviço excluído")}>
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))
      ) : (
        <p className="muted">Nenhum serviço ainda. Sem catálogo, a Ordeliry não cita preços: ela pergunta a você.</p>
      )}
      <button className="btn btn-ghost" type="button" onClick={() => setEdit({ ...emptyService })} style={{ marginTop: 12 }}>
        <Plus size={16} /> Adicionar serviço
      </button>

      <Modal
        open={!!edit}
        onClose={() => setEdit(null)}
        title={edit?.id ? "Editar serviço" : "Novo serviço"}
        wide
        actions={
          <button
            className="btn btn-lime"
            type="button"
            disabled={busy}
            onClick={async () => {
              if (!edit) return;
              const ok = await run(
                () =>
                  upsertService({
                    ...edit,
                    inclui: edit.inclui.split("\n").map((x) => x.trim()).filter(Boolean),
                    nao_inclui: edit.nao_inclui.split("\n").map((x) => x.trim()).filter(Boolean),
                  }),
                "Serviço salvo",
              );
              if (ok) setEdit(null);
            }}
          >
            Salvar serviço
          </button>
        }
      >
        {edit && (
          <div className="form-grid">
            <div className="field full">
              <label htmlFor="s-nome">Nome</label>
              <input id="s-nome" type="text" value={edit.nome} onChange={(e) => setEdit({ ...edit, nome: e.target.value })} placeholder="Cardápio digital com QR code" />
            </div>
            <div className="field">
              <label htmlFor="s-imp">Implantação (R$)</label>
              <input id="s-imp" type="number" min={0} step="0.01" value={edit.preco_implantacao} onChange={(e) => setEdit({ ...edit, preco_implantacao: e.target.value })} />
            </div>
            <div className="field">
              <label htmlFor="s-men">Mensalidade (R$)</label>
              <input id="s-men" type="number" min={0} step="0.01" value={edit.mensalidade} onChange={(e) => setEdit({ ...edit, mensalidade: e.target.value })} />
            </div>
            <div className="field">
              <label htmlFor="s-prazo">Prazo de entrega (dias)</label>
              <input id="s-prazo" type="number" min={1} value={edit.prazo_dias} onChange={(e) => setEdit({ ...edit, prazo_dias: e.target.value })} />
            </div>
            <label className="switch" style={{ alignSelf: "end", minHeight: 44 }}>
              <input type="checkbox" checked={edit.ativo} onChange={(e) => setEdit({ ...edit, ativo: e.target.checked })} />
              <span />
              Ativo
            </label>
            <div className="field full">
              <label>Para quem é (nichos)</label>
              <div className="toggles">
                {NICHES.map((n) => (
                  <button key={n.key} type="button" className="tog" aria-pressed={edit.nichos.includes(n.key)} onClick={() => toggleNiche(n.key)}>
                    {n.label}
                  </button>
                ))}
              </div>
              <span className="hint">Nenhum marcado = serve para todos.</span>
            </div>
            <div className="field full">
              <label htmlFor="s-desc">Descrição</label>
              <textarea id="s-desc" value={edit.descricao} onChange={(e) => setEdit({ ...edit, descricao: e.target.value })} />
            </div>
            <div className="field">
              <label htmlFor="s-inc">O que inclui (um por linha)</label>
              <textarea id="s-inc" value={edit.inclui} onChange={(e) => setEdit({ ...edit, inclui: e.target.value })} placeholder={"QR code para as mesas\nAlterações sem custo extra"} />
            </div>
            <div className="field">
              <label htmlFor="s-ninc">O que NÃO inclui (um por linha)</label>
              <textarea id="s-ninc" value={edit.nao_inclui} onChange={(e) => setEdit({ ...edit, nao_inclui: e.target.value })} placeholder={"Fotos profissionais\nDomínio próprio"} />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

// ---------------------------------------------------------------- portfólio
export function PortfolioEditor({ items }: { items: PortfolioItem[] }) {
  const [f, setF] = useState({ titulo: "", url: "", nicho: "" });
  const { busy, run } = useAction();
  return (
    <div>
      {items.map((p) => (
        <div className="list-row" key={p.id}>
          <div>
            <b>{p.titulo}</b>
            <small>
              {p.nicho ? nicheLabel(p.nicho) : "sem nicho"} ·{" "}
              <a href={p.url} target="_blank" rel="noreferrer">
                {p.url}
              </a>
            </small>
          </div>
          <button className="btn btn-sm btn-ghost" type="button" aria-label={`Remover ${p.titulo}`} onClick={() => run(() => deletePortfolio(p.id), "Removido")}>
            <Trash2 size={14} />
          </button>
        </div>
      ))}
      <form
        className="form-grid"
        style={{ marginTop: 12 }}
        onSubmit={async (e) => {
          e.preventDefault();
          if (await run(() => upsertPortfolio(f), "Adicionado ao portfólio")) setF({ titulo: "", url: "", nicho: "" });
        }}
      >
        <input type="text" required placeholder="Título (ex.: Quartzo by Mivita)" aria-label="Título" value={f.titulo} onChange={(e) => setF({ ...f, titulo: e.target.value })} />
        <input type="url" required placeholder="https://…" aria-label="URL" value={f.url} onChange={(e) => setF({ ...f, url: e.target.value })} />
        <select aria-label="Nicho" value={f.nicho} onChange={(e) => setF({ ...f, nicho: e.target.value })}>
          <option value="">Nicho…</option>
          {NICHES.map((n) => (
            <option key={n.key} value={n.key}>
              {n.label}
            </option>
          ))}
        </select>
        <button className="btn btn-ghost" type="submit" disabled={busy}>
          <Plus size={16} /> Adicionar site entregue
        </button>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------- nichos e regiões
export function TargetsEditor({ profile, onSaved }: { profile: Profile; onSaved?: () => void }) {
  const [nichos, setNichos] = useState<string[]>(profile.nichos_alvo);
  const [regioes, setRegioes] = useState(profile.regioes_alvo.map((r) => `${r.cidade}${r.bairros.length ? `: ${r.bairros.join(", ")}` : ""}`).join("\n"));
  const { busy, run } = useAction();
  return (
    <form
      style={{ display: "grid", gap: 14 }}
      onSubmit={async (e) => {
        e.preventDefault();
        const regioes_alvo = regioes
          .split("\n")
          .map((l) => l.trim())
          .filter(Boolean)
          .map((l) => {
            const [cidade, bairros = ""] = l.split(":");
            return { cidade: cidade.trim(), bairros: bairros.split(",").map((b) => b.trim()).filter(Boolean) };
          });
        if (await run(() => saveSettings({ nichos_alvo: nichos, regioes_alvo }), "Alvos salvos")) onSaved?.();
      }}
    >
      <div className="field">
        <label>Nichos para prospectar</label>
        <div className="toggles">
          {NICHES.map((n) => (
            <button key={n.key} type="button" className="tog" aria-pressed={nichos.includes(n.key)} onClick={() => setNichos((l) => (l.includes(n.key) ? l.filter((x) => x !== n.key) : [...l, n.key]))}>
              {n.label}
            </button>
          ))}
        </div>
      </div>
      <div className="field">
        <label htmlFor="t-reg">Cidades e bairros (uma cidade por linha)</label>
        <textarea id="t-reg" value={regioes} onChange={(e) => setRegioes(e.target.value)} placeholder={"São Paulo: Pinheiros, Vila Mariana\nSanto André"} />
      </div>
      <div>
        <button className="btn btn-lime" type="submit" disabled={busy}>
          Salvar alvos
        </button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------- metas
export function GoalsEditor({ profile, onSaved }: { profile: Profile; onSaved?: () => void }) {
  const [meta, setMeta] = useState(String(profile.meta_mensal || ""));
  const [contratos, setContratos] = useState(String(profile.meta_contratos || ""));
  const { busy, run } = useAction();
  return (
    <form
      className="form-grid"
      onSubmit={async (e) => {
        e.preventDefault();
        if (await run(() => saveSettings({ meta_mensal: Number(meta || 0), meta_contratos: Number(contratos || 0) }), "Metas salvas")) onSaved?.();
      }}
    >
      <div className="field">
        <label htmlFor="g-meta">Meta mensal de faturamento (R$)</label>
        <input id="g-meta" type="number" min={0} step="100" value={meta} onChange={(e) => setMeta(e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="g-con">Contratos desejados por mês</label>
        <input id="g-con" type="number" min={0} value={contratos} onChange={(e) => setContratos(e.target.value)} />
      </div>
      <div className="full">
        <button className="btn btn-lime" type="submit" disabled={busy}>
          Salvar metas
        </button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------- ajustes avançados
export function OrdeliryPrefs({ profile }: { profile: Profile }) {
  const [tom, setTom] = useState(profile.tom);
  const [h, setH] = useState(profile.horario_comercial);
  const { busy, run } = useAction();
  const dias = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  return (
    <form
      style={{ display: "grid", gap: 14 }}
      onSubmit={(e) => {
        e.preventDefault();
        void run(() => saveSettings({ tom, horario_comercial: h }), "Preferências salvas");
      }}
    >
      <div className="field">
        <label>Tom da Ordeliry</label>
        <div className="toggles">
          {(["formal", "equilibrado", "descontraido"] as const).map((t) => (
            <button key={t} type="button" className="tog" aria-pressed={tom === t} onClick={() => setTom(t)}>
              {t === "formal" ? "Mais formal" : t === "equilibrado" ? "Equilibrado" : "Mais descontraído"}
            </button>
          ))}
        </div>
      </div>
      <div className="form-grid">
        <div className="field">
          <label htmlFor="h-ini">Início do expediente</label>
          <input id="h-ini" type="text" pattern="\d{2}:\d{2}" value={h.inicio} onChange={(e) => setH({ ...h, inicio: e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor="h-fim">Fim do expediente</label>
          <input id="h-fim" type="text" pattern="\d{2}:\d{2}" value={h.fim} onChange={(e) => setH({ ...h, fim: e.target.value })} />
        </div>
      </div>
      <div className="toggles">
        {dias.map((d, i) => (
          <button key={d} type="button" className="tog" aria-pressed={h.dias.includes(i)} onClick={() => setH({ ...h, dias: h.dias.includes(i) ? h.dias.filter((x) => x !== i) : [...h.dias, i].sort() })}>
            {d}
          </button>
        ))}
      </div>
      <div>
        <button className="btn btn-lime" type="submit" disabled={busy}>
          Salvar preferências
        </button>
      </div>
    </form>
  );
}

export function WeightsEditor({ profile }: { profile: Profile }) {
  const [w, setW] = useState<Record<WeightKey, number>>({ ...DEFAULT_WEIGHTS, ...(profile.score_pesos ?? {}) } as Record<WeightKey, number>);
  const { busy, run } = useAction();
  return (
    <form
      style={{ display: "grid", gap: 10 }}
      onSubmit={(e) => {
        e.preventDefault();
        void run(() => saveSettings({ score_pesos: w }), "Pesos salvos. Vale para os próximos enriquecimentos.");
      }}
    >
      {(Object.keys(DEFAULT_WEIGHTS) as WeightKey[]).map((k) => (
        <div className="field" key={k}>
          <label htmlFor={`w-${k}`}>
            {WEIGHT_LABELS[k]} <output>+{w[k]}</output>
          </label>
          <input id={`w-${k}`} type="range" min={0} max={60} value={w[k]} onChange={(e) => setW({ ...w, [k]: Number(e.target.value) })} />
        </div>
      ))}
      <div className="page-actions">
        <button className="btn btn-lime" type="submit" disabled={busy}>
          Salvar pesos
        </button>
        <button className="btn btn-ghost" type="button" onClick={() => (setW({ ...DEFAULT_WEIGHTS }), void run(() => saveSettings({ score_pesos: null }), "Pesos padrão restaurados"))}>
          <RotateCcw size={16} /> Restaurar padrão
        </button>
      </div>
    </form>
  );
}

export function PlacesLimitEditor({ profile, usadas, padrao }: { profile: Profile; usadas: number; padrao: number }) {
  const [v, setV] = useState(String(profile.places_limite_mensal ?? padrao));
  const { busy, run } = useAction();
  return (
    <form
      className="form-grid"
      onSubmit={(e) => {
        e.preventDefault();
        void run(() => saveSettings({ places_limite_mensal: Number(v) }), "Limite salvo");
      }}
    >
      <div className="field">
        <label htmlFor="pl">Limite mensal de chamadas ao Google Places</label>
        <input id="pl" type="number" min={0} value={v} onChange={(e) => setV(e.target.value)} />
        <span className="hint">Usadas este mês: {usadas}. Cada busca usa de 1 a 4 chamadas (resultados ficam em cache por 30 dias).</span>
      </div>
      <div style={{ alignSelf: "end" }}>
        <button className="btn btn-lime" type="submit" disabled={busy}>
          Salvar limite
        </button>
      </div>
    </form>
  );
}

export function DncList({ items }: { items: Array<{ id: string; nome: string | null; telefone: string | null; motivo: string | null; criado_em: string }> }) {
  const { run } = useAction();
  if (!items.length) return <p className="muted">Ninguém na lista. Marque pela ficha do lead quando alguém pedir para não ser contatado.</p>;
  return (
    <div>
      {items.map((d) => (
        <div className="list-row" key={d.id}>
          <div>
            <b>{d.nome ?? d.telefone ?? "Empresa"}</b>
            <small>
              {d.telefone ?? "sem telefone"} · desde {new Date(d.criado_em).toLocaleDateString("pt-BR")}
              {d.motivo ? ` · ${d.motivo}` : ""}
            </small>
          </div>
          <button className="btn btn-sm btn-ghost" type="button" onClick={() => confirm("Remover da lista de não contatar?") && run(() => removeDoNotContact(d.id), "Removido da lista")}>
            Remover
          </button>
        </div>
      ))}
    </div>
  );
}
