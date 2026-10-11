/**
 * Datas no fuso America/Sao_Paulo. Brasil não tem horário de verão desde 2019,
 * mas calculamos o offset pelo Intl para não depender disso.
 */
export const TZ = "America/Sao_Paulo";

type Parts = { y: number; m: number; d: number; hh: number; mm: number; ss: number; dow: number };

const fmt = new Intl.DateTimeFormat("en-US", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  weekday: "short",
  hourCycle: "h23",
});

const DOW: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

export function spParts(date: Date): Parts {
  const p = Object.fromEntries(fmt.formatToParts(date).map((x) => [x.type, x.value]));
  return { y: +p.year, m: +p.month, d: +p.day, hh: +p.hour, mm: +p.minute, ss: +p.second, dow: DOW[p.weekday] };
}

/** Offset (minutos) de São Paulo em relação ao UTC no instante dado. Ex.: -180. */
function offsetMinutes(date: Date): number {
  const p = spParts(date);
  const asUtc = Date.UTC(p.y, p.m - 1, p.d, p.hh, p.mm, p.ss);
  return Math.round((asUtc - Math.floor(date.getTime() / 1000) * 1000) / 60000);
}

/** Instante UTC correspondente a y-m-d hh:mm no horário de São Paulo. */
export function spDate(y: number, m: number, d: number, hh = 0, mm = 0): Date {
  const guess = new Date(Date.UTC(y, m - 1, d, hh, mm));
  const off = offsetMinutes(guess);
  return new Date(guess.getTime() - off * 60000);
}

export function startOfDaySP(date: Date): Date {
  const p = spParts(date);
  return spDate(p.y, p.m, p.d);
}

export function addDaysSP(date: Date, n: number): Date {
  const p = spParts(date);
  return spDate(p.y, p.m, p.d + n, p.hh, p.mm);
}

/** Chave yyyy-mm-dd do dia em São Paulo. */
export function dayKeySP(date: Date): string {
  const p = spParts(date);
  return `${p.y}-${String(p.m).padStart(2, "0")}-${String(p.d).padStart(2, "0")}`;
}

export function monthKeySP(date: Date): string {
  const p = spParts(date);
  return `${p.y}-${String(p.m).padStart(2, "0")}`;
}

export type Period = "dia" | "semana" | "mes" | "ano" | "custom";

export type Range = { from: Date; to: Date };

/** Período atual (from inclusivo, to exclusivo) que contém `now`. Semana começa na segunda. */
export function periodRange(period: Exclude<Period, "custom">, now: Date): Range {
  const p = spParts(now);
  switch (period) {
    case "dia":
      return { from: spDate(p.y, p.m, p.d), to: spDate(p.y, p.m, p.d + 1) };
    case "semana": {
      const delta = (p.dow + 6) % 7;
      return { from: spDate(p.y, p.m, p.d - delta), to: spDate(p.y, p.m, p.d - delta + 7) };
    }
    case "mes":
      return { from: spDate(p.y, p.m, 1), to: spDate(p.y, p.m + 1, 1) };
    case "ano":
      return { from: spDate(p.y, 1, 1), to: spDate(p.y + 1, 1, 1) };
  }
}

/** Período anterior de mesmo tamanho "de calendário" (mês anterior, ano anterior...). */
export function previousRange(period: Period, r: Range): Range {
  const f = spParts(r.from);
  switch (period) {
    case "dia":
      return { from: spDate(f.y, f.m, f.d - 1), to: r.from };
    case "semana":
      return { from: spDate(f.y, f.m, f.d - 7), to: r.from };
    case "mes":
      return { from: spDate(f.y, f.m - 1, 1), to: r.from };
    case "ano":
      return { from: spDate(f.y - 1, 1, 1), to: r.from };
    case "custom": {
      const len = r.to.getTime() - r.from.getTime();
      return { from: new Date(r.from.getTime() - len), to: r.from };
    }
  }
}

const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
export const MONTHS_SHORT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
export const WEEKDAYS_SHORT = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

export function monthName(m: number): string {
  return MONTHS[m - 1];
}

export function greetingSP(now: Date): string {
  const h = spParts(now).hh;
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

export function formatDateTimeSP(date: Date | string): string {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, dateStyle: "short", timeStyle: "short" }).format(new Date(date));
}

export function formatDateSP(date: Date | string): string {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, dateStyle: "medium" }).format(new Date(date));
}

export function relativeTime(date: Date | string, now = new Date()): string {
  const s = Math.round((now.getTime() - new Date(date).getTime()) / 1000);
  if (s < 60) return "agora";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h`;
  const d = Math.round(h / 24);
  return `${d} d`;
}
