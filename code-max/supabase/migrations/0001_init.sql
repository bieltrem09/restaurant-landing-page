-- Code Max v1 — schema inicial
-- Todas as tabelas de negócio têm user_id e RLS por usuário.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------- enums
create type lead_status as enum ('novo', 'salvo', 'descartado', 'nao_contatar', 'cliente');
create type lead_faixa as enum ('quente', 'morno', 'frio');
create type deal_etapa as enum ('novo', 'contato', 'exemplo', 'proposta', 'negociacao', 'ganho', 'perdido');
create type motivo_perda as enum ('preco', 'sumiu', 'ja_tem_fornecedor', 'sem_interesse', 'timing', 'decisor_nao_alcancado', 'outro');
create type interaction_tipo as enum ('mensagem_enviada', 'mensagem_recebida', 'ligacao', 'audio', 'nota');
create type interaction_origem as enum ('manual', 'colado', 'print', 'ordeliry');
create type project_status as enum ('briefing', 'design', 'desenvolvimento', 'aprovacao', 'no_ar', 'manutencao');
create type payment_forma as enum ('pix', 'boleto', 'cartao', 'dinheiro');
create type tracker_tipo as enum ('exemplo', 'diagnostico', 'proposta');
create type track_evento as enum ('open', 'scroll_end', 'click_whatsapp', 'heartbeat');
create type job_status as enum ('pendente', 'rodando', 'feito', 'erro');

-- ---------------------------------------------------------------- perfil e configuração
create table profiles (
  user_id uuid primary key references auth.users on delete cascade,
  nome text not null default '',
  estudio text not null default '',
  whatsapp text not null default '',
  cidade_base text not null default '',
  tom text not null default 'equilibrado' check (tom in ('formal', 'equilibrado', 'descontraido')),
  horario_comercial jsonb not null default '{"inicio":"09:00","fim":"18:00","dias":[1,2,3,4,5]}',
  meta_mensal numeric(12,2) not null default 0,
  meta_contratos int not null default 0,
  nichos_alvo text[] not null default '{}',
  regioes_alvo jsonb not null default '[]',
  score_pesos jsonb,
  places_limite_mensal int,
  tema text not null default 'system' check (tema in ('system', 'light', 'dark')),
  onboarding_concluido boolean not null default false,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table services (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade default auth.uid(),
  nome text not null,
  nichos text[] not null default '{}',
  descricao text not null default '',
  inclui text[] not null default '{}',
  nao_inclui text[] not null default '{}',
  preco_implantacao numeric(12,2) not null default 0,
  mensalidade numeric(12,2) not null default 0,
  prazo_dias int not null default 7,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

create table portfolio_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade default auth.uid(),
  titulo text not null,
  url text not null,
  nicho text not null default '',
  imagem text,
  destaque boolean not null default false,
  criado_em timestamptz not null default now()
);

-- ---------------------------------------------------------------- radar
create table searches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade default auth.uid(),
  nicho text not null,
  cidade text not null,
  bairro text,
  lat double precision,
  lng double precision,
  raio_km numeric(4,1) not null,
  status text not null default 'rodando' check (status in ('rodando', 'enriquecendo', 'concluida', 'erro')),
  chamadas_usadas int not null default 0,
  total_resultados int not null default 0,
  erro text,
  criada_em timestamptz not null default now()
);

-- Cache compartilhado (dados públicos do Google), escrito só pelo service role.
create table places_cache (
  place_id text primary key,
  payload_json jsonb not null,
  coletado_em timestamptz not null default now()
);

create table api_usage (
  id bigserial primary key,
  user_id uuid not null references auth.users on delete cascade,
  api text not null check (api in ('places', 'pagespeed', 'anthropic')),
  chamadas int not null default 1,
  ocorreu_em timestamptz not null default now()
);

create table leads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade default auth.uid(),
  search_id uuid references searches on delete set null,
  place_id text not null,
  nome text not null,
  nicho text not null,
  endereco text,
  bairro text,
  cidade text,
  lat double precision,
  lng double precision,
  distancia_km numeric(6,2),
  telefone text,
  telefone_internacional text,
  website text,
  instagram text,
  rating numeric(2,1),
  rating_count int,
  maps_url text,
  primary_type text,
  score int not null default 0,
  faixa lead_faixa not null default 'frio',
  pacote_sugerido_id uuid references services on delete set null,
  status lead_status not null default 'novo',
  enriquecimento text not null default 'pendente' check (enriquecimento in ('pendente', 'rodando', 'feito', 'erro')),
  ultima_coleta timestamptz,
  ultimo_contato_em timestamptz,
  criado_em timestamptz not null default now(),
  unique (user_id, place_id)
);

create table lead_signals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade default auth.uid(),
  lead_id uuid not null references leads on delete cascade,
  chave text not null,
  valor_json jsonb not null,
  pontos int not null default 0,
  fonte text not null,
  coletado_em timestamptz not null default now(),
  unique (lead_id, chave)
);

create table lead_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade default auth.uid(),
  lead_id uuid not null references leads on delete cascade,
  tipo text not null,
  texto text not null,
  lido boolean not null default false,
  criado_em timestamptz not null default now()
);

-- ---------------------------------------------------------------- pipeline e conversas
create table deals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade default auth.uid(),
  lead_id uuid not null references leads on delete cascade,
  service_id uuid references services on delete set null,
  etapa deal_etapa not null default 'novo',
  valor_implantacao numeric(12,2) not null default 0,
  mensalidade numeric(12,2) not null default 0,
  probabilidade numeric(4,3),
  entrou_na_etapa_em timestamptz not null default now(),
  proximo_followup_em timestamptz,
  motivo_perda motivo_perda,
  motivo_perda_texto text,
  ganho_em timestamptz,
  perdido_em timestamptz,
  criado_em timestamptz not null default now()
);

create table deal_stage_history (
  id bigserial primary key,
  user_id uuid not null references auth.users on delete cascade default auth.uid(),
  deal_id uuid not null references deals on delete cascade,
  de deal_etapa,
  para deal_etapa not null,
  ocorreu_em timestamptz not null default now()
);

create table interactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade default auth.uid(),
  lead_id uuid not null references leads on delete cascade,
  tipo interaction_tipo not null,
  autor text,
  texto text not null,
  origem interaction_origem not null default 'manual',
  confirmada boolean not null default true,
  ocorreu_em timestamptz not null default now()
);

create table tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade default auth.uid(),
  lead_id uuid references leads on delete cascade,
  titulo text not null,
  mensagem text,
  vence_em timestamptz not null,
  feita boolean not null default false,
  criado_em timestamptz not null default now()
);

-- ---------------------------------------------------------------- Ordeliry
create table ai_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade default auth.uid(),
  lead_id uuid references leads on delete cascade,
  modo text not null default 'auto',
  titulo text not null default 'Nova conversa',
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table ai_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade default auth.uid(),
  thread_id uuid not null references ai_threads on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  conteudo jsonb not null,
  tokens int,
  feedback smallint check (feedback in (-1, 1)),
  feedback_texto text,
  criado_em timestamptz not null default now()
);

create table playbook_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade default auth.uid(),
  titulo text not null,
  nicho text,
  conteudo text not null,
  fonte text not null default 'manual',
  aprovado boolean not null default false,
  criado_em timestamptz not null default now()
);

create table deal_outcomes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade default auth.uid(),
  deal_id uuid not null references deals on delete cascade,
  lead_id uuid not null references leads on delete cascade,
  nicho text not null,
  resultado text not null check (resultado in ('ganho', 'perdido')),
  conversa text not null,
  criado_em timestamptz not null default now()
);

-- ---------------------------------------------------------------- rastreamento, propostas
create table trackers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade default auth.uid(),
  token text not null unique default encode(gen_random_bytes(12), 'hex'),
  lead_id uuid not null references leads on delete cascade,
  tipo tracker_tipo not null,
  url text,
  criado_em timestamptz not null default now()
);

create table track_events (
  id bigserial primary key,
  user_id uuid not null references auth.users on delete cascade,
  tracker_id uuid not null references trackers on delete cascade,
  lead_id uuid not null references leads on delete cascade,
  evento track_evento not null,
  pagina text,
  duracao_s int,
  ocorreu_em timestamptz not null default now()
);

create table diagnoses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade default auth.uid(),
  lead_id uuid not null references leads on delete cascade,
  tracker_id uuid not null references trackers on delete cascade,
  conteudo_json jsonb not null,
  criado_em timestamptz not null default now()
);

create table proposals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade default auth.uid(),
  deal_id uuid not null references deals on delete cascade,
  tracker_id uuid not null references trackers on delete cascade,
  conteudo_json jsonb not null,
  enviada_em timestamptz,
  aceita_em timestamptz,
  criado_em timestamptz not null default now()
);

-- ---------------------------------------------------------------- clientes e financeiro
create table clients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade default auth.uid(),
  lead_id uuid references leads on delete set null,
  deal_id uuid references deals on delete set null,
  nome text not null,
  nicho text not null default '',
  telefone text,
  criado_em timestamptz not null default now()
);

create table projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade default auth.uid(),
  client_id uuid not null references clients on delete cascade,
  titulo text not null,
  status project_status not null default 'briefing',
  progresso int not null default 0 check (progresso between 0 and 100),
  entrega_prevista date,
  url_site text,
  criado_em timestamptz not null default now()
);

create table subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade default auth.uid(),
  client_id uuid not null references clients on delete cascade,
  descricao text not null default 'Mensalidade',
  valor numeric(12,2) not null,
  dia_vencimento int not null check (dia_vencimento between 1 and 28),
  ativa boolean not null default true,
  inicio date not null default current_date,
  criado_em timestamptz not null default now()
);

create table payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade default auth.uid(),
  client_id uuid not null references clients on delete cascade,
  deal_id uuid references deals on delete set null,
  subscription_id uuid references subscriptions on delete set null,
  valor numeric(12,2) not null check (valor > 0),
  forma payment_forma not null,
  pago_em timestamptz not null,
  referencia text,
  criado_em timestamptz not null default now()
);

-- ---------------------------------------------------------------- LGPD e jobs
create table do_not_contact (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade default auth.uid(),
  place_id text,
  telefone text,
  nome text,
  motivo text,
  criado_em timestamptz not null default now(),
  check (place_id is not null or telefone is not null)
);

create table jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  tipo text not null,
  payload jsonb not null,
  status job_status not null default 'pendente',
  tentativas int not null default 0,
  erro text,
  executar_em timestamptz not null default now(),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table activity (
  id bigserial primary key,
  user_id uuid not null references auth.users on delete cascade default auth.uid(),
  lead_id uuid references leads on delete set null,
  tipo text not null,
  texto text not null,
  ocorreu_em timestamptz not null default now()
);

-- ---------------------------------------------------------------- índices
create index leads_place_id_idx on leads (place_id);
create index leads_user_status_idx on leads (user_id, status);
create index lead_signals_lead_idx on lead_signals (lead_id);
create index deals_user_etapa_idx on deals (user_id, etapa);
create index interactions_lead_idx on interactions (lead_id, ocorreu_em);
create index payments_pago_em_idx on payments (pago_em);
create index payments_user_pago_idx on payments (user_id, pago_em);
create index track_events_tracker_idx on track_events (tracker_id);
create index track_events_user_idx on track_events (user_id, ocorreu_em desc);
create index jobs_status_idx on jobs (status, executar_em);
create index dnc_user_place_idx on do_not_contact (user_id, place_id);
create index activity_user_idx on activity (user_id, ocorreu_em desc);
create index api_usage_user_idx on api_usage (user_id, api, ocorreu_em);
create index tasks_user_due_idx on tasks (user_id, feita, vence_em);

-- ---------------------------------------------------------------- RLS
do $$
declare t text;
begin
  foreach t in array array[
    'services','portfolio_items','searches','leads','lead_signals','lead_alerts','deals',
    'deal_stage_history','interactions','tasks','ai_threads','ai_messages','playbook_entries',
    'deal_outcomes','trackers','track_events','diagnoses','proposals','clients','projects',
    'subscriptions','payments','do_not_contact','activity','api_usage','jobs'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy "%1$s_owner" on %1$I for all using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
  end loop;
end $$;

alter table profiles enable row level security;
create policy "profiles_owner" on profiles for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- places_cache: sem políticas = só service role acessa.
alter table places_cache enable row level security;

-- Cria o perfil vazio no cadastro.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (user_id, nome) values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''));
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Realtime para o feed e presença ao vivo.
alter publication supabase_realtime add table activity, track_events;
