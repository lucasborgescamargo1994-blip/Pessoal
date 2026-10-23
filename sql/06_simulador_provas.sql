-- ═════════════════════════════════════════════════════════════════
-- 06 — Simulador de atendimento: PROVAS, resultados, treinos livres e configuração
-- ═════════════════════════════════════════════════════════════════
-- Rode este arquivo INTEIRO, UMA vez, no SQL Editor do painel do Supabase
-- (Dashboard → SQL Editor → New query → cole → Run). É seguro rodar de novo: usa "if not exists" / "create or replace".
--
-- O que ele cria (tudo novo — nenhuma tabela existente é alterada):
--   1. sim_provas      — as provas montadas na Área Administrativa (aba "Treinamento"): título, curso do YOUniversity, casos, regras.
--   2. sim_tentativas  — cada vez que alguém faz uma prova (nome completo, nota, aprovado ou não, conversas de cada caso).
--   3. sim_sessoes     — os treinos livres do simulador (quem treinou, qual caso, se resolveu, a conversa).
--   4. sim_config      — uma linha só, com os ajustes do simulador (treino livre ligado/desligado, boas-vindas...).
--   5. funções sim_iniciar_tentativa / sim_concluir_tentativa / sim_minhas_tentativas — é POR ELAS que o simulador registra e consulta as provas
--      (o simulador nunca lê nem grava direto na tabela de tentativas; assim, no modo seguro, só o administrador enxerga os resultados de todos).
--   6. função sim_aplicar_politicas(seguro) — liga as regras de segurança (veja abaixo).
--
-- SEGURANÇA — dois modos, igual ao resto do sistema:
--   • Sem o 03_seguranca_rls.sql (modo "local" do painel): as tabelas ficam abertas para a chave pública, como respostas_rapidas — quem
--     souber consultar o banco consegue ler resultados e editar provas. Serve para começar.
--   • Com o 03_seguranca_rls.sql (modo "supabase"): só o ADMINISTRADOR lê resultados e edita provas; o simulador só consegue ler as provas
--     ATIVAS, registrar treinos novos e usar as funções acima (que limitam o que cada pessoa vê: o próprio histórico).
--     (Rodou o 03 DEPOIS deste? Ele já reaplica as regras destas tabelas sozinho.)
--   Limite que nenhuma regra resolve: a nota é calculada no navegador de quem faz a prova (a IA conversa pelo navegador). É um teste de
--   aprendizado, não um exame com fiscal: o administrador pode abrir qualquer tentativa, ler a conversa e aprovar/reprovar manualmente.
-- ═════════════════════════════════════════════════════════════════

-- ─── 1) Provas ─────────────────────────────────────────────────────
create table if not exists public.sim_provas (
    id             bigint generated always as identity primary key,
    titulo         text    not null,                          -- nome da prova (ex.: "Prova — Emissão de CT-e")
    descricao      text,                                      -- o que a pessoa lê antes de começar
    curso_nome     text,                                      -- conteúdo do YOUniversity a que a prova pertence
    curso_link     text,                                      -- endereço para REVISAR o conteúdo (aparece quando reprova)
    proximo_link   text,                                      -- para onde seguir quando aprova (opcional)
    msg_aprovado   text,                                      -- mensagem ao aprovar (opcional)
    msg_reprovado  text,                                      -- mensagem ao reprovar (opcional)
    itens          jsonb   not null default '[]'::jsonb,      -- casos: [{"tipo":"banco","id":123,"titulo":"..."}, {"tipo":"custom","titulo":"...","solucao":"...","categoria":"..."}]
    config         jsonb   not null default '{}'::jsonb,      -- {"nota_minima":70,"max_mensagens":10,"tempo_min":0,"perfil":"normal","dicas":false,"max_tentativas":0,"embaralhar":false}
    ativo          boolean not null default false,            -- só provas ativas aparecem para os alunos
    criado_por     text,
    criado_em      timestamptz not null default now(),
    atualizado_em  timestamptz not null default now()
);

-- ─── 2) Tentativas de prova ────────────────────────────────────────
create table if not exists public.sim_tentativas (
    id               uuid primary key default gen_random_uuid(),   -- o navegador também pode gerar (crypto.randomUUID)
    prova_id         bigint,
    prova_titulo     text,
    nome             text    not null,                             -- nome completo digitado pela pessoa
    nome_chave       text    not null,                             -- o mesmo nome sem acento/maiúscula (agrupa "João da Silva" e "joao da silva")
    numero           integer,                                      -- 1ª, 2ª, 3ª tentativa desta pessoa nesta prova
    status           text    not null default 'em_andamento',      -- em_andamento | concluida
    nota             numeric,                                      -- 0 a 100 (% de casos resolvidos)
    nota_minima      numeric,
    aprovado         boolean,                                      -- resultado automático
    detalhes         jsonb   not null default '[]'::jsonb,         -- por caso: [{"titulo","resultado","turnos","duracao_s","conversa":[{"de","texto"}]}]
    duracao_s        integer,
    modelo           text,                                         -- último modelo de IA usado
    revisao_aprovado boolean,                                      -- decisão manual do administrador (vazio = vale a automática)
    revisao_obs      text,
    revisado_por     text,
    revisado_em      timestamptz,
    iniciado_em      timestamptz not null default now(),
    concluido_em     timestamptz
);
create index if not exists sim_tentativas_chave_idx on public.sim_tentativas (nome_chave, prova_id);
create index if not exists sim_tentativas_prova_idx on public.sim_tentativas (prova_id, iniciado_em desc);

-- ─── 3) Treinos livres ─────────────────────────────────────────────
create table if not exists public.sim_sessoes (
    id          bigint generated always as identity primary key,
    nome        text    not null,
    nome_chave  text    not null,
    caso_id     bigint,                  -- id do artigo em BancoDados
    caso_titulo text,
    categoria   text,
    perfil      text,                    -- normal | leigo | apressado
    resultado   text,                    -- Resolvido | Encerrado sem resolver
    turnos      integer,                 -- mensagens do suporte
    dicas       integer,
    duracao_s   integer,
    conversa    jsonb   not null default '[]'::jsonb,
    modelo      text,
    criado_em   timestamptz not null default now()
);
create index if not exists sim_sessoes_chave_idx on public.sim_sessoes (nome_chave, criado_em desc);

-- ─── 4) Configuração do simulador (uma linha só) ───────────────────
create table if not exists public.sim_config (
    id             integer primary key default 1 check (id = 1),
    config         jsonb   not null default '{}'::jsonb,   -- {"treino_livre":true,"boas_vindas":"","nota_minima_padrao":70}
    atualizado_em  timestamptz not null default now()
);
insert into public.sim_config (id) values (1) on conflict (id) do nothing;

-- "atualizado_em" preenchido pelo banco a cada alteração
create or replace function public.sim_atualizado_em() returns trigger
language plpgsql as $$
begin
    new.atualizado_em := now();
    return new;
end $$;
drop trigger if exists sim_provas_atualizado on public.sim_provas;
create trigger sim_provas_atualizado before update on public.sim_provas
    for each row execute function public.sim_atualizado_em();
drop trigger if exists sim_config_atualizado on public.sim_config;
create trigger sim_config_atualizado before update on public.sim_config
    for each row execute function public.sim_atualizado_em();

-- Permissões de tabela (tabela criada por SQL não ganha permissão automática). O que cada papel PODE de fato fazer é decidido pelas regras (RLS) abaixo.
grant select, insert, update, delete on public.sim_provas, public.sim_tentativas, public.sim_sessoes, public.sim_config to anon, authenticated;
grant all on public.sim_provas, public.sim_tentativas, public.sim_sessoes, public.sim_config to service_role;

-- ─── 5) Funções do simulador (security definer: rodam com permissão do dono e por isso funcionam mesmo no modo seguro) ─────
-- Começar uma prova: confere se está ativa e se ainda há tentativas, numera a tentativa e devolve o id (uuid).
create or replace function public.sim_iniciar_tentativa(p_prova_id bigint, p_nome text, p_chave text, p_nota_minima numeric)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
    v_prova public.sim_provas%rowtype;
    v_chave text := lower(btrim(coalesce(p_chave, '')));
    v_max   integer;
    v_n     integer;
    v_id    uuid;
begin
    if length(btrim(coalesce(p_nome, ''))) < 3 or v_chave = '' then raise exception 'nome_invalido'; end if;
    select * into v_prova from public.sim_provas where id = p_prova_id;
    if not found or not v_prova.ativo then raise exception 'prova_indisponivel'; end if;
    v_max := coalesce(nullif(v_prova.config ->> 'max_tentativas', '')::integer, 0);
    select count(*) into v_n from public.sim_tentativas where nome_chave = v_chave and prova_id = p_prova_id;
    if v_max > 0 and v_n >= v_max then raise exception 'tentativas_esgotadas'; end if;
    insert into public.sim_tentativas (prova_id, prova_titulo, nome, nome_chave, numero, nota_minima)
    values (p_prova_id, v_prova.titulo, left(btrim(p_nome), 160), left(v_chave, 160), v_n + 1, p_nota_minima)
    returning id into v_id;
    return v_id;
end $$;
grant execute on function public.sim_iniciar_tentativa(bigint, text, text, numeric) to anon, authenticated;

-- Concluir: grava nota, resultado e as conversas. Só vale enquanto a tentativa está "em andamento" (depois disso só o administrador altera).
create or replace function public.sim_concluir_tentativa(p_id uuid, p_nota numeric, p_aprovado boolean, p_detalhes jsonb, p_duracao integer, p_modelo text)
returns boolean
language plpgsql security definer set search_path = public as $$
begin
    update public.sim_tentativas
       set status = 'concluida', nota = p_nota, aprovado = p_aprovado, detalhes = coalesce(p_detalhes, '[]'::jsonb),
           duracao_s = p_duracao, modelo = left(coalesce(p_modelo, ''), 120), concluido_em = now()
     where id = p_id and status = 'em_andamento';
    return found;
end $$;
grant execute on function public.sim_concluir_tentativa(uuid, numeric, boolean, jsonb, integer, text) to anon, authenticated;

-- A pessoa consulta SÓ o próprio histórico (colunas básicas; vale a decisão manual do administrador, quando houver).
create or replace function public.sim_minhas_tentativas(p_chave text)
returns table (prova_id bigint, numero integer, status text, nota numeric, aprovado boolean, iniciado_em timestamptz, concluido_em timestamptz)
language sql stable security definer set search_path = public as $$
    select t.prova_id, t.numero, t.status, t.nota, coalesce(t.revisao_aprovado, t.aprovado), t.iniciado_em, t.concluido_em
      from public.sim_tentativas t
     where t.nome_chave = lower(btrim(coalesce(p_chave, '')))
     order by t.iniciado_em desc
     limit 500
$$;
grant execute on function public.sim_minhas_tentativas(text) to anon, authenticated;

-- ─── 6) Regras de segurança (RLS) ──────────────────────────────────
-- seguro = false → tabelas abertas (modo "local" do painel).   seguro = true → só o administrador lê resultados e edita provas.
-- Este arquivo escolhe sozinho: se a função eh_admin() (criada pelo 03_seguranca_rls.sql) existir, aplica o modo seguro.
create or replace function public.sim_aplicar_politicas(seguro boolean) returns void
language plpgsql as $$
declare t text;
begin
    foreach t in array array['sim_provas', 'sim_tentativas', 'sim_sessoes', 'sim_config']
    loop
        execute format('alter table public.%I enable row level security', t);
        execute format('drop policy if exists "bsoft sim aberto" on public.%I', t);
        execute format('drop policy if exists "bsoft sim ler" on public.%I', t);
        execute format('drop policy if exists "bsoft sim admin" on public.%I', t);
        execute format('drop policy if exists "bsoft sim inserir" on public.%I', t);
        execute format('drop policy if exists "bsoft sim concluir" on public.%I', t);   -- (nome de uma versão anterior; garante que não sobra nada)
    end loop;

    if not coalesce(seguro, false) then
        foreach t in array array['sim_provas', 'sim_tentativas', 'sim_sessoes', 'sim_config']
        loop
            execute format('create policy "bsoft sim aberto" on public.%I for all to anon, authenticated using (true) with check (true)', t);
        end loop;
    else
        -- provas: o público só lê as ATIVAS; o administrador faz tudo
        create policy "bsoft sim ler"   on public.sim_provas for select to anon, authenticated using (ativo or public.eh_admin());
        create policy "bsoft sim admin" on public.sim_provas for all to authenticated using (public.eh_admin()) with check (public.eh_admin());
        -- configuração: todos leem; o administrador altera
        create policy "bsoft sim ler"   on public.sim_config for select to anon, authenticated using (true);
        create policy "bsoft sim admin" on public.sim_config for all to authenticated using (public.eh_admin()) with check (public.eh_admin());
        -- tentativas: SÓ o administrador acessa a tabela; o simulador passa pelas funções sim_iniciar_tentativa / sim_concluir_tentativa / sim_minhas_tentativas
        create policy "bsoft sim admin" on public.sim_tentativas for all to authenticated using (public.eh_admin()) with check (public.eh_admin());
        -- treinos livres: qualquer pessoa registra; só o administrador lê/apaga
        create policy "bsoft sim inserir" on public.sim_sessoes for insert to anon, authenticated with check (true);
        create policy "bsoft sim admin"   on public.sim_sessoes for all to authenticated using (public.eh_admin()) with check (public.eh_admin());
    end if;
end $$;

select public.sim_aplicar_politicas(to_regprocedure('public.eh_admin()') is not null);

-- faz a API do Supabase enxergar as tabelas/funções novas na hora
notify pgrst, 'reload schema';

-- ─── Conferência ───────────────────────────────────────────────────
-- Depois de rodar, esta consulta deve devolver 4 linhas:
--   select table_name from information_schema.tables where table_schema = 'public' and table_name like 'sim\_%' order by 1;
-- E esta, 1 linha (a configuração):
--   select * from public.sim_config;
