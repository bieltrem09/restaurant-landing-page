-- Permissões da Data API para as tabelas do Code Max (schema public).
-- Projetos Supabase novos podem não conceder acesso automático às tabelas criadas por SQL.
-- A segurança continua na RLS: cada usuário só vê as próprias linhas.
grant usage on schema public to anon, authenticated, service_role;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
-- places_cache é só do servidor (service role).
revoke all on table public.places_cache from authenticated;
