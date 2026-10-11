import { describe, expect, it } from "vitest";
import { authorsOf, parseWhatsAppExport, toInteractions } from "@/lib/whatsapp-parser";
import { waLink, normalizeBrPhone } from "@/lib/format";

const EXPORT = `10/10/2026 14:01 - As mensagens e ligações são protegidas com a criptografia de ponta a ponta.
10/10/2026 14:02 - Vinicius: Oi, tudo bem? Sou o Vinicius, faço sites para pizzarias.
Posso te mostrar um exemplo?
10/10/2026 14:30 - Pizzaria Cheff Gourmett: pode sim
10/10/2026 21:10 - Vinicius: <Mídia oculta>
[11/10/26, 09:15:02] Pizzaria Cheff Gourmett: Oi: vi agora`;

describe("parser do export do WhatsApp", () => {
  const msgs = parseWhatsAppExport(EXPORT);

  it("lê mensagens, ignora linha de sistema e junta continuação", () => {
    expect(msgs).toHaveLength(4);
    expect(msgs[0].autor).toBe("Vinicius");
    expect(msgs[0].texto).toBe("Oi, tudo bem? Sou o Vinicius, faço sites para pizzarias.\nPosso te mostrar um exemplo?");
    expect(msgs[1].texto).toBe("pode sim");
  });

  it("converte hora de São Paulo para UTC", () => {
    expect(msgs[0].ocorreu_em).toBe("2026-10-10T17:02:00.000Z");
  });

  it("marca mídia e aceita formato iOS com dois-pontos na mensagem", () => {
    expect(msgs[2].midia).toBe(true);
    expect(msgs[3].autor).toBe("Pizzaria Cheff Gourmett");
    expect(msgs[3].texto).toBe("Oi: vi agora");
  });

  it("identifica autores e direção", () => {
    expect(authorsOf(msgs)).toEqual(["Vinicius", "Pizzaria Cheff Gourmett"]);
    const ints = toInteractions(msgs, "Vinicius");
    expect(ints.map((i) => i.tipo)).toEqual(["mensagem_enviada", "mensagem_recebida", "mensagem_enviada", "mensagem_recebida"]);
    expect(ints[2].texto).toBe("[mídia]");
  });
});

describe("link do WhatsApp", () => {
  it("normaliza telefone brasileiro", () => {
    expect(normalizeBrPhone("(11) 98765-4321")).toBe("5511987654321");
    expect(normalizeBrPhone("+55 11 3456-7890")).toBe("551134567890");
    expect(normalizeBrPhone("123")).toBeNull();
  });
  it("monta wa.me com número e texto", () => {
    expect(waLink("(11) 98765-4321", "Olá, tudo bem?")).toBe("https://wa.me/5511987654321?text=Ol%C3%A1%2C%20tudo%20bem%3F");
  });
});

import { emailTypo } from "@/app/login/LoginForm";

describe("correção de e-mail no login", () => {
  it("corrige domínios digitados errado", () => {
    expect(emailTypo("bielj009s@gmal.com")).toBe("bielj009s@gmail.com");
    expect(emailTypo("Fulano@Hotmal.com")).toBe("fulano@hotmail.com");
    expect(emailTypo("bielj009s@gmail.com")).toBeNull();
  });
});
