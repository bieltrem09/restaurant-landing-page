import { spDate } from "./dates";

export type ParsedMessage = {
  ocorreu_em: string;
  autor: string;
  texto: string;
  midia: boolean;
};

// Android: "12/10/2026 14:03 - Nome: texto"  (também aceita aa, vírgula após a data e segundos)
const ANDROID = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4}),?\s+(\d{1,2}):(\d{2})(?::\d{2})?\s*-\s*([^:]+?):\s?([\s\S]*)$/;
// iOS: "[12/10/2026, 14:03:22] Nome: texto"
const IOS = /^‎?\[(\d{1,2})\/(\d{1,2})\/(\d{2,4}),?\s+(\d{1,2}):(\d{2})(?::\d{2})?\]\s*([^:]+?):\s?([\s\S]*)$/;
// Linha de sistema (sem autor): "12/10/2026 14:03 - As mensagens são protegidas..."
const SYSTEM = /^‎?\[?\d{1,2}\/\d{1,2}\/\d{2,4},?\s+\d{1,2}:\d{2}(?::\d{2})?\]?\s*-?\s*[^:]*$/;

const MEDIA = /^(<m[ií]dia oculta>|<media omitted>|‎?(imagem|áudio|audio|vídeo|video|figurinha|documento) omitid[oa]|.*\(arquivo anexado\))$/i;

export function parseWhatsAppExport(raw: string): ParsedMessage[] {
  const lines = raw.replace(/\r\n?/g, "\n").split("\n");
  const out: ParsedMessage[] = [];
  for (const line of lines) {
    const clean = line.replace(/[‎‏‪-‮]/g, "");
    const m = clean.match(ANDROID) ?? clean.match(IOS);
    if (m) {
      const [, d, mo, y, hh, mm, autor, texto] = m;
      const year = y.length === 2 ? 2000 + Number(y) : Number(y);
      const t = texto.trim();
      out.push({
        ocorreu_em: spDate(year, Number(mo), Number(d), Number(hh), Number(mm)).toISOString(),
        autor: autor.trim(),
        texto: t,
        midia: MEDIA.test(t),
      });
      continue;
    }
    if (SYSTEM.test(clean.trim()) && clean.trim()) continue;
    if (out.length && clean.trim() !== "") out[out.length - 1].texto += `\n${clean}`;
  }
  return out;
}

/** Autores distintos na ordem em que aparecem. */
export function authorsOf(msgs: ParsedMessage[]): string[] {
  return [...new Set(msgs.map((m) => m.autor))];
}

/** Converte para interações: o autor indicado como vendedor vira "enviada", o resto "recebida". */
export function toInteractions(msgs: ParsedMessage[], vendedor: string) {
  return msgs.map((m) => ({
    tipo: m.autor === vendedor ? ("mensagem_enviada" as const) : ("mensagem_recebida" as const),
    autor: m.autor,
    texto: m.midia ? "[mídia]" : m.texto,
    ocorreu_em: m.ocorreu_em,
    origem: "colado" as const,
  }));
}
