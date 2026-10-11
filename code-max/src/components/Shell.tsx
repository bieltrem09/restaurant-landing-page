"use client";

import {
  BookOpen,
  Kanban,
  LayoutGrid,
  LogOut,
  Menu,
  MessageCircle,
  Moon,
  Radar,
  Search,
  Settings,
  Sparkles,
  Store,
  Sun,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { saveSettings } from "@/app/actions";
import { supabaseBrowser } from "@/lib/supabase/client";
import { moneyShort } from "@/lib/format";
import { initials } from "@/lib/format";
import { AppContext, type OrdeliryOpen } from "./app-context";
import { CommandPalette } from "./CommandPalette";
import { LeadDrawer } from "./LeadDrawer";
import { OrdeliryPanel } from "./OrdeliryPanel";
import { ToastProvider } from "./ui";

type NavItem = { href: string; label: string; icon: ReactNode; badge?: number };

export type ShellProps = {
  children: ReactNode;
  profile: { nome: string; estudio: string; whatsapp: string; tema: "system" | "light" | "dark" };
  goal: { meta: number; recebido: number; mesLabel: string };
  badges: { radar: number; pipeline: number };
};

export function Shell({ children, profile, goal, badges }: ShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const navRef = useRef<HTMLElement>(null);
  const [pill, setPill] = useState<{ y: number; on: boolean }>({ y: 0, on: false });
  const [menuOpen, setMenuOpen] = useState(false);
  const [leadId, setLeadId] = useState<string | null>(null);
  const [ordeliry, setOrdeliry] = useState<OrdeliryOpen | null>(null);
  const [palette, setPalette] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark" | null>(null);

  const groups: Array<{ label: string; items: NavItem[] }> = [
    {
      label: "Comercial",
      items: [
        { href: "/", label: "Visão geral", icon: <LayoutGrid size={18} /> },
        { href: "/radar", label: "Radar de Leads", icon: <Radar size={18} />, badge: badges.radar },
        { href: "/pipeline", label: "Pipeline", icon: <Kanban size={18} />, badge: badges.pipeline },
        { href: "/conversas", label: "Conversas", icon: <MessageCircle size={18} /> },
        { href: "/ordeliry", label: "Ordeliry", icon: <Sparkles size={18} /> },
      ],
    },
    {
      label: "Operação",
      items: [
        { href: "/clientes", label: "Clientes e financeiro", icon: <Users size={18} /> },
        { href: "/playbook", label: "Playbook", icon: <BookOpen size={18} /> },
        { href: "/ajustes", label: "Ajustes", icon: <Settings size={18} /> },
      ],
    },
  ];
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  // Pílula que desliza até o item ativo.
  useLayoutEffect(() => {
    const el = navRef.current?.querySelector<HTMLAnchorElement>("a.active");
    if (el) setPill({ y: el.offsetTop, on: true });
    else setPill((p) => ({ ...p, on: false }));
  }, [pathname]);

  useEffect(() => setMenuOpen(false), [pathname]);

  // Tema: salvo por usuário (perfil) e espelhado no navegador para não piscar.
  useEffect(() => {
    const t = profile.tema === "system" ? null : profile.tema;
    const local = (() => {
      try {
        return localStorage.getItem("cm-theme");
      } catch {
        return null;
      }
    })();
    const eff = (local === "light" || local === "dark" ? local : t) as "light" | "dark" | null;
    setTheme(eff);
    if (eff) document.documentElement.dataset.theme = eff;
    // Cookie de exclusão: o próprio vendedor não conta como visita nos sites rastreados.
    document.cookie = "cm_excluir=1; path=/; max-age=31536000; SameSite=None; Secure";
  }, [profile.tema]);

  const toggleTheme = () => {
    const current = theme ?? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    const next = current === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("cm-theme", next);
    } catch {}
    void saveSettings({ tema: next });
  };

  const openLead = useCallback((id: string) => setLeadId(id), []);
  const openOrdeliry = useCallback((o?: OrdeliryOpen) => setOrdeliry(o ?? {}), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPalette((v) => !v);
      }
      if (mod && e.key.toLowerCase() === "j") {
        e.preventDefault();
        setOrdeliry((v) => (v ? null : { leadId }));
      }
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [leadId]);

  async function logout() {
    await supabaseBrowser().auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const pct = goal.meta > 0 ? Math.min(100, (goal.recebido / goal.meta) * 100) : 0;
  const isDark = theme === "dark";

  return (
    <ToastProvider>
      <AppContext value={{ openLead, openOrdeliry, profile }}>
        <a className="skip" href="#conteudo">
          Pular para o conteúdo
        </a>
        <div className="app">
          <aside className={`side${menuOpen ? " open" : ""}`} aria-label="Menu principal">
            <div className="brand">
              <span className="brand-mark">
                <Store size={20} />
              </span>
              <div>
                Code Max<small>CRM para quem vende sites</small>
              </div>
            </div>
            <button className="side-search" type="button" onClick={() => setPalette(true)}>
              <Search size={18} />
              <span>Buscar…</span>
              <kbd>Ctrl K</kbd>
            </button>
            <nav className="nav" ref={navRef}>
              <span className="nav-pill" aria-hidden style={{ transform: `translateY(${pill.y}px)`, opacity: pill.on ? 1 : 0 }} />
              {groups.map((g) => (
                <div key={g.label} style={{ display: "contents" }}>
                  <div className="nav-label">{g.label}</div>
                  {g.items.map((it) => (
                    <Link key={it.href} href={it.href} className={isActive(it.href) ? "active" : undefined} aria-current={isActive(it.href) ? "page" : undefined}>
                      {it.icon}
                      {it.label}
                      {!!it.badge && <span className="badge">{it.badge}</span>}
                    </Link>
                  ))}
                </div>
              ))}
            </nav>
            <div className="side-goal">
              <span className="eyebrow">Meta de {goal.mesLabel}</span>
              {goal.meta > 0 ? (
                <>
                  <div>
                    <span className="num">{moneyShort(goal.recebido)}</span>{" "}
                    <span style={{ color: "var(--side-mute)", fontSize: 12 }}>de {moneyShort(goal.meta)}</span>
                  </div>
                  <div className="pbar">
                    <i style={{ transform: `scaleX(${pct / 100})` }} />
                  </div>
                  <p>{pct >= 100 ? "Meta batida. Parabéns!" : `Faltam ${moneyShort(goal.meta - goal.recebido)} este mês.`}</p>
                </>
              ) : (
                <p>
                  Defina sua meta mensal em <Link href="/ajustes">Ajustes</Link>.
                </p>
              )}
            </div>
            <div className="side-user">
              <span className="avatar">{initials(profile.estudio || profile.nome || "CM")}</span>
              <div style={{ minWidth: 0, flex: 1 }}>
                <b>{profile.estudio || profile.nome || "Seu estúdio"}</b>
                <span>{profile.nome}</span>
              </div>
              <button className="icon-btn" type="button" onClick={logout} aria-label="Sair" style={{ background: "var(--side-2)", borderColor: "var(--side-line)", color: "var(--side-mute)", width: 36, height: 36, minHeight: 36 }}>
                <LogOut size={16} />
              </button>
            </div>
          </aside>
          <div className={`side-scrim${menuOpen ? " on" : ""}`} onClick={() => setMenuOpen(false)} aria-hidden />

          <main className="main" id="conteudo">
            <div className="top-actions" style={{ justifyContent: "space-between", marginBottom: 8 }}>
              <button className="icon-btn menu-btn" type="button" aria-label="Abrir menu" onClick={() => setMenuOpen(true)}>
                <Menu size={18} />
              </button>
              <span style={{ flex: 1 }} />
              <button className="live-pill" type="button" onClick={() => setOrdeliry({ leadId })} aria-label="Abrir Ordeliry (Ctrl J)">
                <Sparkles size={16} />
                <span className="lbl">Ordeliry</span>
                <kbd style={{ borderColor: "var(--line)", color: "var(--ink-3)" }}>Ctrl J</kbd>
              </button>
              <button className="icon-btn" type="button" aria-label={isDark ? "Usar tema claro" : "Usar tema escuro"} onClick={toggleTheme}>
                {isDark ? <Sun size={18} /> : <Moon size={18} />}
              </button>
            </div>
            {children}
          </main>
        </div>
        <LeadDrawer id={leadId} onClose={() => setLeadId(null)} />
        <OrdeliryPanel open={ordeliry} onClose={() => setOrdeliry(null)} />
        <CommandPalette open={palette} onClose={() => setPalette(false)} />
      </AppContext>
    </ToastProvider>
  );
}
