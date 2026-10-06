-- ═══════════════════════════════════════════════════════════════════════════
-- 03 — SEGURANÇA DO BANCO (RLS) — OPCIONAL, mas é o que protege de verdade
-- ═══════════════════════════════════════════════════════════════════════════
-- POR QUE EXISTE
--   A chave "anon" do Supabase fica no código do sistema (é pública por desenho). Hoje, sem estas regras, qualquer
--   pessoa que abra o sistema e entenda de programação consegue editar/apagar o conteúdo do banco — a senha da
--   Área Administrativa só esconde a tela. Estas regras fazem o BANCO exigir um login de administrador para:
--     • editar a base de conhecimento (BancoDados, Parametros, Funcionalidades, Rotinas, RejeicoesSEFAZ);
--     • publicar/apagar novidades;
--     • criar/editar/apagar respostas rápidas;
--     • apagar logs.
--   O app dos usuários continua funcionando como hoje: ler tudo, gravar log/feedback, gravar o vetor (embedding).
--
-- ANTES DE RODAR (passo a passo completo no README.md, seção "Segurança"):
--   1. Supabase → Authentication → Users → "Add user" → crie o usuário administrador (e-mail + senha forte, marque
--      "Auto Confirm User").
--   2. Supabase → Authentication → Sign In / Providers → DESLIGUE "Allow new users to sign up" (ninguém mais cria conta).
--   3. Troque o e-mail na linha marcada "TROQUE AQUI" logo abaixo pelo e-mail do passo 1.
--   4. Rode este arquivo inteiro no SQL Editor. Se algo der errado, rode 03b_desfazer_rls.sql (volta ao estado anterior).
--   5. Em config/admin-config.js troque "modo" para "supabase" e preencha "supabaseEmail" (e suba o arquivo no GitHub).
--
-- Dica: faça isso fora do horário de uso e teste o app em seguida (abrir, perguntar, dar 👍/👎, ver novidades).
-- ═══════════════════════════════════════════════════════════════════════════

begin;

-- ─── Quem é administrador ──────────────────────────────────────────────────
create table if not exists public.admin_emails (email text primary key);
alter table public.admin_emails enable row level security;   -- sem política = ninguém lê/escreve pela API (só pelo SQL Editor)
insert into public.admin_emails (email) values (lower('TROQUE_AQUI@seu-email.com.br'))      -- ← TROQUE AQUI
    on conflict do nothing;

create or replace function public.eh_admin() returns boolean
language sql stable security definer set search_path = public as $$
    select exists (select 1 from public.admin_emails a where a.email = lower(coalesce(auth.jwt() ->> 'email', '')))
$$;
grant execute on function public.eh_admin() to anon, authenticated;

-- ─── Tabelas "só leitura para o público; escrita só do administrador" ───────
-- (BancoDados tem uma exceção logo depois: o app grava o vetor/embedding.)
do $$
declare t text;
begin
    foreach t in array array['BancoDados','Parametros','Funcionalidades','Rotinas','RejeicoesSEFAZ','StatusServicos','suporte_novidades','respostas_rapidas','respostas_fixas']
    loop
        if to_regclass('public.' || quote_ident(t)) is null then
            raise notice 'Tabela % não existe — ignorada.', t;
            continue;
        end if;
        execute format('alter table public.%I enable row level security', t);
        execute format('drop policy if exists "bsoft leitura publica" on public.%I', t);
        execute format('drop policy if exists "bsoft admin escreve" on public.%I', t);
        execute format('create policy "bsoft leitura publica" on public.%I for select to anon, authenticated using (true)', t);
        execute format('create policy "bsoft admin escreve" on public.%I for all to authenticated using (public.eh_admin()) with check (public.eh_admin())', t);
    end loop;
end $$;

-- StatusServicos: só a Edge Function (service_role, que ignora RLS) grava; remove a permissão antiga de UPDATE
do $$ begin
    if to_regclass('public."StatusServicos"') is not null then
        revoke update on public."StatusServicos" from anon, authenticated;
    end if;
end $$;

-- BancoDados: o app (anon) grava o vetor de cada registro depois de calculá-lo — SÓ a coluna "embedding"
drop policy if exists "bsoft vetor anon" on public."BancoDados";
create policy "bsoft vetor anon" on public."BancoDados" for update to anon using (true) with check (true);
revoke update on public."BancoDados" from anon;
grant update (embedding) on public."BancoDados" to anon;

-- ─── logs: todo mundo registra e dá feedback; só o administrador apaga ─────
alter table public.logs enable row level security;
drop policy if exists "bsoft logs leitura" on public.logs;
drop policy if exists "bsoft logs insere" on public.logs;
drop policy if exists "bsoft logs atualiza" on public.logs;
drop policy if exists "bsoft logs apaga admin" on public.logs;
create policy "bsoft logs leitura"    on public.logs for select to anon, authenticated using (true);
create policy "bsoft logs insere"     on public.logs for insert to anon, authenticated with check (true);
create policy "bsoft logs atualiza"   on public.logs for update to anon, authenticated using (true) with check (true);
create policy "bsoft logs apaga admin" on public.logs for delete to authenticated using (public.eh_admin());

-- ─── machine_learning: o app insere/remove conhecimento aprendido (comportamento atual mantido) ───
do $$ begin
    if to_regclass('public.machine_learning') is not null then
        alter table public.machine_learning enable row level security;
        drop policy if exists "bsoft ml leitura" on public.machine_learning;
        drop policy if exists "bsoft ml insere" on public.machine_learning;
        drop policy if exists "bsoft ml apaga" on public.machine_learning;
        drop policy if exists "bsoft ml admin" on public.machine_learning;
        create policy "bsoft ml leitura" on public.machine_learning for select to anon, authenticated using (true);
        create policy "bsoft ml insere"  on public.machine_learning for insert to anon, authenticated with check (true);
        create policy "bsoft ml apaga"   on public.machine_learning for delete to anon, authenticated using (true);
        create policy "bsoft ml admin"   on public.machine_learning for update to authenticated using (public.eh_admin()) with check (public.eh_admin());
    end if;
end $$;

commit;

-- ─── TESTES (rode depois; "set local role" finge ser o app, sem login) ─────
-- Cada bloco deve terminar como descrito. Rode um de cada vez; o "rollback" desfaz qualquer coisa que o teste fizesse.
--
-- 1) App lê a base (deve funcionar e mostrar um número):
--      begin; set local role anon; select count(*) from public."BancoDados"; rollback;
-- 2) App NÃO pode editar a base (deve dar erro "permission denied" ou "violates row-level security"):
--      begin; set local role anon; update public."Parametros" set id = id; rollback;
-- 3) App NÃO pode apagar log (0 linhas apagadas, sem erro, ou erro de permissão):
--      begin; set local role anon; delete from public.logs where id = -1; rollback;
-- 4) App pode registrar log (deve funcionar):
--      begin; set local role anon; insert into public.logs (pergunta, feedback) values ('teste rls', 'Pendente'); rollback;
-- 5) App pode gravar vetor (0 linhas, mas SEM erro de permissão):
--      begin; set local role anon; update public."BancoDados" set embedding = embedding where id = -1; rollback;
