import "server-only";
import { NextResponse } from "next/server";
import type { z } from "zod";
import { getUser } from "./supabase/server";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export function fail(status: number, message: string, extra?: Record<string, unknown>) {
  return NextResponse.json({ error: message, ...extra }, { status });
}

/** Valida o corpo JSON com Zod e devolve um erro legível em português. */
export async function parseJson<T extends z.ZodType>(req: Request, schema: T): Promise<z.infer<T>> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw new ApiError(400, "Corpo da requisição não é um JSON válido.");
  }
  const r = schema.safeParse(body);
  if (!r.success) {
    const issue = r.error.issues[0];
    throw new ApiError(400, `Campo inválido${issue.path.length ? ` "${issue.path.join(".")}"` : ""}: ${issue.message}`);
  }
  return r.data;
}

// Rate limit simples por chave (janela deslizante em memória, por instância).
const hits = new Map<string, number[]>();

export function rateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const arr = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (arr.length >= limit) throw new ApiError(429, "Muitas requisições. Tente de novo em instantes.");
  arr.push(now);
  hits.set(key, arr);
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((t) => now - t < windowMs)) hits.delete(k);
}

export async function requireApiUser() {
  const user = await getUser();
  if (!user) throw new ApiError(401, "Não autenticado.");
  return user;
}

/** Envolve um handler e converte ApiError em resposta JSON. */
export function handler<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (e) {
      if (e instanceof ApiError) return fail(e.status, e.message);
      console.error(e);
      return fail(500, "Erro interno. Tente novamente.");
    }
  };
}
