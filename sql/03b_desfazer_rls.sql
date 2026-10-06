-- ═══════════════════════════════════════════════════════════════════════════
-- 03b — DESFAZ o 03_seguranca_rls.sql (volta ao comportamento anterior: tabelas "abertas")
-- ═══════════════════════════════════════════════════════════════════════════
-- Use se, depois do 03, algo do app parar de funcionar e você precisar voltar rápido.
-- (Depois me conte o que quebrou — dá para ajustar a regra em vez de desligar a segurança.)
-- ═══════════════════════════════════════════════════════════════════════════

begin;

do $$
declare t text;
begin
    foreach t in array array['BancoDados','Parametros','Funcionalidades','Rotinas','RejeicoesSEFAZ','StatusServicos','suporte_novidades','respostas_rapidas','respostas_fixas','machine_learning']
    loop
        if to_regclass('public.' || quote_ident(t)) is null then continue; end if;
        execute format('drop policy if exists "bsoft leitura publica" on public.%I', t);
        execute format('drop policy if exists "bsoft admin escreve" on public.%I', t);
        execute format('alter table public.%I disable row level security', t);
    end loop;
end $$;

drop policy if exists "bsoft vetor anon" on public."BancoDados";
grant update on public."BancoDados" to anon, authenticated;
do $$ begin
    if to_regclass('public."StatusServicos"') is not null then
        grant select, update on public."StatusServicos" to anon, authenticated;
    end if;
end $$;

drop policy if exists "bsoft logs leitura" on public.logs;
drop policy if exists "bsoft logs insere" on public.logs;
drop policy if exists "bsoft logs atualiza" on public.logs;
drop policy if exists "bsoft logs apaga admin" on public.logs;
alter table public.logs disable row level security;

do $$ begin
    if to_regclass('public.machine_learning') is not null then
        drop policy if exists "bsoft ml leitura" on public.machine_learning;
        drop policy if exists "bsoft ml insere" on public.machine_learning;
        drop policy if exists "bsoft ml apaga" on public.machine_learning;
        drop policy if exists "bsoft ml admin" on public.machine_learning;
        alter table public.machine_learning disable row level security;
    end if;
end $$;

-- (mantém a tabela admin_emails e a função eh_admin(): são inofensivas)
commit;
