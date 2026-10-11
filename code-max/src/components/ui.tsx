"use client";

import { animate, useInView, useReducedMotion } from "motion/react";
import { ArrowDownRight, ArrowUpRight, Check, X } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

// ---------------------------------------------------------------- toasts
type Toast = { id: number; title: string; body?: string; icon?: ReactNode };
const ToastCtx = createContext<(t: Omit<Toast, "id">) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [list, setList] = useState<Toast[]>([]);
  const push = useCallback((t: Omit<Toast, "id">) => {
    const id = Date.now() + Math.random();
    setList((l) => [...l.slice(-3), { ...t, id }]);
    setTimeout(() => setList((l) => l.filter((x) => x.id !== id)), 4200);
  }, []);
  return (
    <ToastCtx value={push}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {list.map((t) => (
          <div className="toast" key={t.id}>
            <span className="ti">{t.icon ?? <Check size={16} />}</span>
            <div>
              <b>{t.title}</b>
              {t.body && <small>{t.body}</small>}
            </div>
          </div>
        ))}
      </div>
    </ToastCtx>
  );
}

export const useToast = () => useContext(ToastCtx);

// ---------------------------------------------------------------- números que contam
export function CountUp({ value, format, className }: { value: number; format: (v: number) => string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const reduce = useReducedMotion();
  const prev = useRef(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (reduce || !inView) {
      el.textContent = format(value);
      return;
    }
    const c = animate(prev.current, value, { duration: 1.1, ease: [0.2, 0.8, 0.2, 1], onUpdate: (v) => (el.textContent = format(v)) });
    prev.current = value;
    return () => c.stop();
  }, [value, inView, reduce, format]);
  return (
    <span ref={ref} className={className}>
      {format(reduce ? value : 0)}
    </span>
  );
}

// ---------------------------------------------------------------- delta
export function Delta({ value, suffix = "%", points = false }: { value: number | null | undefined; suffix?: string; points?: boolean }) {
  if (value === null || value === undefined || Number.isNaN(value)) return <span className="delta" style={{ background: "var(--surface-2)", color: "var(--ink-3)" }}>sem base</span>;
  const up = value >= 0;
  return (
    <span className={`delta ${up ? "up" : "down"}`}>
      {up ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
      {Math.abs(value).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}
      {points ? " p.p." : suffix}
    </span>
  );
}

// ---------------------------------------------------------------- anel de score
export function ScoreRing({ score, size = 44, stroke = 4, faixa }: { score: number; size?: number; stroke?: number; faixa?: "quente" | "morno" | "frio" }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const color = faixa === "quente" ? "var(--hot)" : faixa === "morno" ? "var(--warn)" : "var(--ink-3)";
  return (
    <span className="ring" style={{ width: size, height: size }} aria-label={`Score ${score} de 100`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--track)" strokeWidth={stroke} />
        <circle
          className="ring-fg"
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${(score / 100) * c} ${c}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          pathLength={c}
        />
      </svg>
      <b style={{ fontSize: size > 60 ? 26 : 13 }}>{score}</b>
    </span>
  );
}

export function TierChip({ faixa }: { faixa: "quente" | "morno" | "frio" }) {
  const cls = faixa === "quente" ? "hot" : faixa === "morno" ? "warm" : "cold";
  return <span className={`tierchip ${cls}`}>{faixa}</span>;
}

// ---------------------------------------------------------------- segment control com indicador deslizante
export function Seg<T extends string>({ options, value, onChange, label }: { options: Array<{ value: T; label: string }>; value: T; onChange: (v: T) => void; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [thumb, setThumb] = useState({ x: 0, w: 0 });
  useEffect(() => {
    const el = ref.current?.querySelector<HTMLButtonElement>(`button[data-v="${value}"]`);
    if (el) setThumb({ x: el.offsetLeft, w: el.offsetWidth });
  }, [value, options.length]);
  return (
    <div className="seg" role="tablist" aria-label={label} ref={ref}>
      <span className="seg-thumb" style={{ transform: `translateX(${thumb.x}px)`, width: thumb.w }} />
      {options.map((o) => (
        <button key={o.value} role="tab" type="button" data-v={o.value} aria-selected={o.value === value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- modal
export function Modal({ open, onClose, title, children, actions, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; actions?: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <div className="modal-wrap" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title} style={wide ? { width: "min(760px, 100%)" } : undefined}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
          <h2>{title}</h2>
          <button className="icon-btn" type="button" aria-label="Fechar" onClick={onClose} style={{ width: 36, height: 36, minHeight: 36 }}>
            <X size={16} />
          </button>
        </div>
        <div style={{ marginTop: 12 }}>{children}</div>
        {actions && <div className="modal-actions">{actions}</div>}
      </div>
    </div>,
    document.body,
  );
}

// ---------------------------------------------------------------- estado vazio
export function EmptyState({ icon, title, children, action }: { icon: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty-state">
      <span className="ei">{icon}</span>
      <b>{title}</b>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

export function Unverified() {
  return <span className="unverified">não verificado</span>;
}

// ---------------------------------------------------------------- confete
export async function confetti() {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const { default: c } = await import("canvas-confetti");
  const lime = getComputedStyle(document.documentElement).getPropertyValue("--lime").trim() || "#9BE22D";
  c({ particleCount: 140, spread: 80, origin: { y: 0.7 }, colors: [lime, "#ffffff", "#141811"] });
}

/** Copiar para a área de transferência com feedback. */
export function useCopy() {
  const toast = useToast();
  return useCallback(
    async (text: string, title = "Copiado") => {
      try {
        await navigator.clipboard.writeText(text);
        toast({ title });
      } catch {
        toast({ title: "Não foi possível copiar", body: "Selecione o texto e copie manualmente." });
      }
    },
    [toast],
  );
}
