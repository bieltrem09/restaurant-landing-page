# Code Max v1

CRM para quem vende criação e reforma de sites para negócios locais: Radar de Leads com dados reais do Google, a Ordeliry (IA de vendas consultivas pelo WhatsApp) e o painel de faturamento.

Stack: Next.js 16 (App Router) + TypeScript estrito, Tailwind 4, Supabase (Postgres + RLS, Auth, Realtime), Anthropic Claude API, Google Places API (New), PageSpeed Insights, Recharts, Motion, Zod, Vitest e Playwright.

## Como rodar

1. **Supabase**: crie um projeto e rode a migração `supabase/migrations/0001_init.sql` (SQL Editor ou `supabase db push`). Ela cria todas as tabelas com `user_id` e RLS, os índices, o trigger que cria o perfil no cadastro e a publicação Realtime de `activity` e `track_events`. Em Auth, habilite e-mail e, se quiser, Google, com redirect para `APP_URL/auth/callback`.
2. **Google Cloud**: ative a *Places API (New)* e a *PageSpeed Insights API*; gere as chaves (restrinja a de Places por API).
3. **Anthropic**: gere uma chave da API.
4. Copie `.env.example` para `.env.local` e preencha:

| Variável | Uso |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | cliente com sessão do usuário (RLS) |
| `SUPABASE_SERVICE_ROLE_KEY` | só no servidor: cache do Places, rastreamento, páginas públicas e cron |
| `GOOGLE_MAPS_API_KEY` | Text Search e Place Details |
| `PAGESPEED_API_KEY` | PageSpeed Insights (mobile) |
| `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` | Ordeliry (padrão `claude-sonnet-5-5`) |
| `APP_URL` | links públicos `/d/…`, `/p/…` e o `t.js` |
| `CRON_SECRET` | protege `/api/cron/revalidate` (a Vercel envia como `Authorization: Bearer`) |
| `PLACES_MONTHLY_CALL_LIMIT` | limite padrão de chamadas por mês (cada usuário pode ajustar em Ajustes) |

5. `npm install` e `npm run dev`.

## Deploy na Vercel

Importe o repositório com **Root Directory = `code-max`**, cadastre as variáveis acima e faça o deploy. O `vercel.json` agenda o cron diário que revalida leads salvos há mais de 30 dias (e alerta quando um lead sem site passa a ter site) e processa enriquecimentos pendentes.

## Scripts

- `npm test`: Vitest (score, agregados do painel no fuso de São Paulo, parser do WhatsApp, contexto da Ordeliry, mensalidades, análise de HTML).
- `npm run test:e2e`: Playwright. Os testes atuais cobrem o que roda sem banco (bloqueio de login, 375px sem rolagem lateral nos dois temas, `t.js`, `/api/track`).
- `npm run typecheck`, `npm run lint`, `npm run build`.

## Como as peças se encaixam

- **Radar** (`/radar`): `POST /api/radar/estimate` mostra as chamadas previstas e o saldo; `POST /api/radar/search` faz o Text Search paginado (até 60), descarta quem não está `OPERATIONAL`, quem está em "não contatar" e quem está fora do raio, guarda cache de 30 dias e enfileira `jobs`. O navegador aciona `POST /api/radar/enrich` em lotes (o cron cobre o resto): PageSpeed, HTTPS, HTML (copyright, WhatsApp, Instagram), site fora do ar. Cada sinal é salvo em `lead_signals` com fonte, valor e data; o score (`src/lib/score.ts`) só pontua dado verificado.
- **Ordeliry** (`/ordeliry`, painel lateral `Ctrl/⌘ + J`): `POST /api/ordeliry/chat` usa o prompt de sistema literal da especificação (`src/lib/ordeliry/system-prompt-template.ts`) com o contexto montado no servidor, responde em streaming e executa direto só as ferramentas de leitura; as que gravam (`save_note`, `create_followup`, `move_stage`, `generate_diagnosis_link`, `log_message`) aparecem como cards e só rodam depois da confirmação. Mensagens em blocos ```` ```mensagem ```` viram cards com Copiar, Abrir no WhatsApp (`wa.me`) e Editar. `POST /api/ordeliry/vision` transcreve prints. Fallback automático do servidor em caso de recusa ativado para os modelos que o suportam.
- **Painel** (`/`): todos os números vêm de `payments`, `deals`, `deal_stage_history`, `interactions` e `subscriptions`, calculados em funções puras (`src/lib/dashboard.ts`). Sem dados, estados vazios.
- **Presença ao vivo**: `<script src="APP_URL/t.js" data-k="TOKEN" defer></script>` nos sites de exemplo; diagnóstico e proposta já vêm com ele. Registra abertura, tempo, rolagem até o fim e clique no WhatsApp; ignora bots e o próprio vendedor (cookie, ou abra o exemplo uma vez com `?cm_excluir=1`).

## Fora da v1

API oficial do WhatsApp Business, multiusuário, geração automática do site de exemplo, gravação de ligações, cobrança automática e coleta direta de Instagram/iFood (ver seção 12 da especificação).
