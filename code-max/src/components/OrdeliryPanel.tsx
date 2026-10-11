"use client";

import { Sparkles, X } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import type { OrdeliryOpen } from "./app-context";
import { OrdeliryChat } from "./OrdeliryChat";

/** Painel lateral da Ordeliry, acessível de qualquer tela (Ctrl/⌘ + J) e da ficha do lead. */
export function OrdeliryPanel({ open, onClose }: { open: OrdeliryOpen | null; onClose: () => void }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <>
      <div className={`scrim${open ? " on" : ""}`} onClick={onClose} aria-hidden style={{ zIndex: 76 }} />
      <aside className={`drawer${open ? " open" : ""}`} aria-label="Ordeliry" aria-hidden={!open} style={{ zIndex: 80, width: "min(620px, 100%)" }}>
        <div className="dr-top">
          <span className="eyebrow" style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Sparkles size={14} /> Ordeliry{open?.leadNome ? ` · ${open.leadNome}` : ""}
          </span>
          <div style={{ display: "flex", gap: 6 }}>
            <Link className="btn btn-sm btn-ghost" href="/ordeliry" onClick={onClose}>
              Histórico
            </Link>
            <button className="icon-btn" type="button" aria-label="Fechar" onClick={onClose}>
              <X size={18} />
            </button>
          </div>
        </div>
        {open && (
          <OrdeliryChat
            key={`${open.leadId ?? "geral"}-${open.mode ?? "auto"}-${open.prefill ?? ""}`}
            compact
            leadId={open.leadId}
            leadNome={open.leadNome}
            initialMode={open.mode}
            prefill={open.prefill}
          />
        )}
      </aside>
    </>
  );
}
