-- MODO SEM LOGIN (temporário, pedido pelo dono do projeto). Um único dono fixo; o app acessa como "anon",
-- limitado às linhas desse dono. Enquanto isto estiver ativo, quem tiver o link do site vê e altera os dados do CRM.
-- Para religar o login: defina CODE_MAX_LOGIN=on na Vercel e rode o bloco "DESFAZER" no fim deste arquivo.

create or replace function public.app_owner_id() returns uuid
language sql immutable security invoker set search_path = '' as $$ select '7c0de000-0000-4000-8000-000000000001'::uuid $$;

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values ('00000000-0000-0000-0000-000000000000', public.app_owner_id(), 'authenticated', 'authenticated', 'dono@codemax.local', '', now(),
        '{"provider":"email","providers":["email"]}', '{"full_name":""}', now(), now())
on conflict (id) do nothing;

insert into public.profiles (user_id) values (public.app_owner_id()) on conflict (user_id) do nothing;

do $$
declare t text;
begin
  foreach t in array array[
    'profiles','services','portfolio_items','searches','leads','lead_signals','lead_alerts','deals',
    'deal_stage_history','interactions','tasks','ai_threads','ai_messages','playbook_entries',
    'deal_outcomes','trackers','track_events','diagnoses','proposals','clients','projects',
    'subscriptions','payments','do_not_contact','activity','api_usage','jobs'
  ] loop
    execute format('grant select, insert, update, delete on table public.%I to anon', t);
    execute format('create policy "%1$s_sem_login" on public.%1$I for all to anon using (user_id = public.app_owner_id()) with check (user_id = public.app_owner_id())', t);
  end loop;
end $$;
grant select, insert, update on table public.places_cache to anon;
create policy "places_cache_sem_login" on public.places_cache for all to anon using (true) with check (true);
grant usage, select on all sequences in schema public to anon;

do $$
declare t text;
begin
  foreach t in array array[
    'services','portfolio_items','searches','leads','lead_signals','lead_alerts','deals',
    'deal_stage_history','interactions','tasks','ai_threads','ai_messages','playbook_entries',
    'deal_outcomes','trackers','diagnoses','proposals','clients','projects',
    'subscriptions','payments','do_not_contact','activity'
  ] loop
    execute format('alter table public.%I alter column user_id set default coalesce(auth.uid(), public.app_owner_id())', t);
  end loop;
end $$;

-- DESFAZER (religar o login):
-- do $$ declare r record; begin
--   for r in select tablename, policyname from pg_policies where schemaname = 'public' and policyname like '%\_sem\_login' loop
--     execute format('drop policy %I on public.%I', r.policyname, r.tablename);
--   end loop;
-- end $$;
-- revoke select, insert, update, delete on all tables in schema public from anon;
