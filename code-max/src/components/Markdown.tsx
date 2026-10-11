"use client";

import { Fragment, type ReactNode } from "react";

/** Markdown mínimo e seguro (sem HTML): parágrafos, **negrito**, listas e títulos. */
function inline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`|https?:\/\/[^\s)]+)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith("**")) out.push(<b key={i++}>{tok.slice(2, -2)}</b>);
    else if (tok.startsWith("`")) out.push(<code key={i++}>{tok.slice(1, -1)}</code>);
    else
      out.push(
        <a key={i++} href={tok} target="_blank" rel="noreferrer">
          {tok}
        </a>,
      );
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function Markdown({ text }: { text: string }) {
  const blocks = text.split(/\n{2,}/);
  return (
    <>
      {blocks.map((b, bi) => {
        const lines = b.split("\n");
        if (lines.every((l) => /^\s*([-*]|\d+\.)\s+/.test(l) || !l.trim())) {
          return (
            <ul key={bi}>
              {lines.filter((l) => l.trim()).map((l, li) => (
                <li key={li}>{inline(l.replace(/^\s*([-*]|\d+\.)\s+/, ""))}</li>
              ))}
            </ul>
          );
        }
        if (/^#{1,4}\s/.test(lines[0])) {
          return (
            <Fragment key={bi}>
              <h4>{inline(lines[0].replace(/^#{1,4}\s/, ""))}</h4>
              {lines.length > 1 && <p>{lines.slice(1).map((l, li) => <Fragment key={li}>{li > 0 && <br />}{inline(l)}</Fragment>)}</p>}
            </Fragment>
          );
        }
        return (
          <p key={bi}>
            {lines.map((l, li) => (
              <Fragment key={li}>
                {li > 0 && <br />}
                {inline(l)}
              </Fragment>
            ))}
          </p>
        );
      })}
    </>
  );
}

export type Segment = { kind: "text"; text: string } | { kind: "mensagem"; intent: string; body: string };

/** Separa os blocos ```mensagem``` (cards de WhatsApp) do restante do texto. A linha anterior ao bloco é a intenção. */
export function splitMessages(text: string): Segment[] {
  const out: Segment[] = [];
  const re = /```mensagem\s*\n([\s\S]*?)(```|$)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    let before = text.slice(last, m.index);
    let intent = "";
    const lines = before.replace(/\s+$/, "").split("\n");
    const cand = lines.at(-1)?.trim() ?? "";
    if (cand && cand.length < 160) {
      intent = cand.replace(/^[*_#\s-]+|[*_:\s]+$/g, "");
      before = lines.slice(0, -1).join("\n");
    }
    if (before.trim()) out.push({ kind: "text", text: before.trim() });
    out.push({ kind: "mensagem", intent, body: m[1].trim() });
    last = m.index + m[0].length;
  }
  const rest = text.slice(last);
  if (rest.trim()) out.push({ kind: "text", text: rest.trim() });
  return out;
}
