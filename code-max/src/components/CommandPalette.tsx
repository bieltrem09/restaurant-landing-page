"use client";

import { BookOpen, Kanban, LayoutGrid, MessageCircle, Radar, Search, Settings, Sparkles, User, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { nicheLabel } from "@/lib/niches";
import { useApp } from "./app-context";

type Item = { key: string; group: string; label: string; hint?: string; icon: ReactNode; run: () => void };

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const { openLead, openOrdeliry } = useApp();
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const [leads, setLeads] = useState<Array<{ id: string; nome: string; nicho: string; bairro: string | null; score: number }>>([]);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setQ("");
    setSel(0);
    setTimeout(() => input.current?.focus(), 10);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      fetch(`/api/leads?q=${encodeURIComponent(q)}`, { signal: ctrl.signal })
        .then((r) => (r.ok ? r.json() : { leads: [] }))
        .then((d) => setLeads(d.leads ?? []))
        .catch(() => {});
    }, 150);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q, open]);

  const items = useMemo<Item[]>(() => {
    const go = (href: string) => () => {
      router.push(href);
      onClose();
    };
    const pages: Item[] = [
      { key: "p/", group: "Ir para", label: "Visão geral", icon: <LayoutGrid size={16} />, run: go("/") },
      { key: "p/radar", group: "Ir para", label: "Radar de Leads", icon: <Radar size={16} />, run: go("/radar") },
      { key: "p/pipeline", group: "Ir para", label: "Pipeline", icon: <Kanban size={16} />, run: go("/pipeline") },
      { key: "p/conversas", group: "Ir para", label: "Conversas", icon: <MessageCircle size={16} />, run: go("/conversas") },
      { key: "p/clientes", group: "Ir para", label: "Clientes e financeiro", icon: <Users size={16} />, run: go("/clientes") },
      { key: "p/playbook", group: "Ir para", label: "Playbook", icon: <BookOpen size={16} />, run: go("/playbook") },
      { key: "p/ajustes", group: "Ir para", label: "Ajustes", icon: <Settings size={16} />, run: go("/ajustes") },
      { key: "a/ordeliry", group: "Ações", label: "Conversar com a Ordeliry", hint: "Ctrl J", icon: <Sparkles size={16} />, run: () => (openOrdeliry(), onClose()) },
    ];
    const ql = q.toLowerCase();
    const leadItems: Item[] = leads.map((l) => ({
      key: `l/${l.id}`,
      group: "Leads",
      label: l.nome,
      hint: `${nicheLabel(l.nicho)} · score ${l.score}`,
      icon: <User size={16} />,
      run: () => (openLead(l.id), onClose()),
    }));
    return [...pages.filter((p) => !ql || p.label.toLowerCase().includes(ql)), ...leadItems];
  }, [q, leads, router, onClose, openLead, openOrdeliry]);

  if (!open) return null;
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") onClose();
    if (e.key === "ArrowDown") (e.preventDefault(), setSel((s) => Math.min(items.length - 1, s + 1)));
    if (e.key === "ArrowUp") (e.preventDefault(), setSel((s) => Math.max(0, s - 1)));
    if (e.key === "Enter") items[sel]?.run();
  };
  let lastGroup = "";
  return (
    <div className="pal-wrap" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="pal" role="dialog" aria-modal="true" aria-label="Buscar">
        <div className="pal-in">
          <Search size={18} />
          <input ref={input} type="text" value={q} onChange={(e) => (setQ(e.target.value), setSel(0))} onKeyDown={onKey} placeholder="Buscar telas e leads…" aria-label="Buscar" />
        </div>
        <div className="pal-list" role="listbox">
          {items.map((it, i) => {
            const head = it.group !== lastGroup ? <div className="pal-g">{it.group}</div> : null;
            lastGroup = it.group;
            return (
              <div key={it.key}>
                {head}
                <button type="button" role="option" aria-selected={i === sel} className={`pal-it${i === sel ? " sel" : ""}`} onMouseEnter={() => setSel(i)} onClick={it.run}>
                  {it.icon}
                  {it.label}
                  {it.hint && <small>{it.hint}</small>}
                </button>
              </div>
            );
          })}
          {!items.length && <div className="empty">Nada encontrado.</div>}
        </div>
      </div>
    </div>
  );
}
