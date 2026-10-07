-- ═══════════════════════════════════════════════════════════════════════════
-- 02 — Respostas rápidas + fila de revisão das respostas da IA
-- ═══════════════════════════════════════════════════════════════════════════
-- Rode este arquivo INTEIRO, UMA vez, no SQL Editor do painel do Supabase
-- (Dashboard → SQL Editor → New query → cole → Run). É seguro rodar de novo: usa "if not exists".
--
-- O que ele cria:
--   1. Colunas novas na tabela "logs": guardam a RESPOSTA apresentada ao usuário e o andamento da revisão.
--   2. Tabela "respostas_rapidas": as respostas aprovadas pela equipe. Perguntas parecidas ganham a resposta pronta.
--   3. View "respostas_rapidas_uso": quantas vezes cada resposta rápida foi usada e o feedback recebido.
--
-- Enquanto este SQL não for rodado, o sistema continua funcionando normalmente — só não grava a resposta no
-- log nem mostra respostas rápidas (o app avisa no console do navegador).
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1) Log: resposta apresentada + revisão ────────────────────────────────
alter table public.logs add column if not exists resposta           text;         -- texto da resposta mostrada ao usuário
alter table public.logs add column if not exists fonte              text;         -- 'ia' (modelo de IA) | 'rapida' (resposta rápida aprovada) | 'ferramenta' (uso de Erros SEFAZ / Criar Regra / Relatórios / Parâmetros em aba)
alter table public.logs add column if not exists modelo             text;         -- qual modelo respondeu (quando fonte = 'ia')
alter table public.logs add column if not exists revisao            text;         -- pendente | aprovada | banco (salva no BancoDados) | rejeitada | ignorada | nao_se_aplica
alter table public.logs add column if not exists revisao_nota       text;         -- motivo da rejeição / observação do revisor
alter table public.logs add column if not exists revisado_em        timestamptz;
alter table public.logs add column if not exists revisado_por       text;
alter table public.logs add column if not exists resposta_rapida_id bigint;       -- se virou (ou veio de) uma resposta rápida
alter table public.logs add column if not exists retorno            text;         -- resposta do suporte ao feedback do usuário (aparece em "Gestão de Feedback" para ele; edite na aba Logs do painel)

-- acelera a fila de revisão (só indexa as linhas que têm resposta)
create index if not exists logs_revisao_idx on public.logs (revisao, created_at desc) where resposta is not null;
create index if not exists logs_resposta_rapida_idx on public.logs (resposta_rapida_id) where resposta_rapida_id is not null;

-- ─── 2) Respostas rápidas ──────────────────────────────────────────────────
create table if not exists public.respostas_rapidas (
    id             bigint generated always as identity primary key,
    pergunta       text    not null,                       -- pergunta "oficial"
    variantes      jsonb   not null default '[]'::jsonb,   -- outras formas de perguntar a mesma coisa: ["...", "..."]
    resposta       text    not null,                       -- texto da resposta (Markdown, igual ao da IA)
    categoria      text,
    ativo          boolean not null default true,          -- desligue para parar de usar sem apagar
    origem_log_id  bigint,                                 -- de qual log nasceu (opcional)
    aprovado_por   text,
    criado_em      timestamptz not null default now(),
    atualizado_em  timestamptz not null default now()
);
create index if not exists respostas_rapidas_sync_idx on public.respostas_rapidas (atualizado_em);

-- "atualizado_em" é preenchido pelo banco a cada alteração: é ele que faz o app baixar só o que mudou
create or replace function public.rr_atualizado_em() returns trigger
language plpgsql as $$
begin
    new.atualizado_em := now();
    return new;
end $$;
drop trigger if exists rr_atualizado_em on public.respostas_rapidas;
create trigger rr_atualizado_em before update on public.respostas_rapidas
    for each row execute function public.rr_atualizado_em();

-- Permissões (tabela criada por SQL não ganha permissão automática — mesmo motivo do StatusServicos).
-- Neste momento o app (papel "anon") lê, e a Área Administrativa grava com a mesma chave pública.
-- Para que SÓ o administrador consiga gravar, rode também o arquivo 03_seguranca_rls.sql.
grant select, insert, update, delete on public.respostas_rapidas to anon, authenticated;
grant all on public.respostas_rapidas to service_role;

-- ─── 3) Uso das respostas rápidas (para a aba "Respostas rápidas" do admin) ───
create or replace view public.respostas_rapidas_uso as
    select resposta_rapida_id                                   as id,
           count(*)                                              as usos,
           count(*) filter (where feedback = 'Positivo')         as positivos,
           count(*) filter (where feedback = 'Negativo')         as negativos,
           max(created_at)                                       as ultimo_uso
      from public.logs
     where fonte = 'rapida' and resposta_rapida_id is not null
     group by resposta_rapida_id;
grant select on public.respostas_rapidas_uso to anon, authenticated, service_role;

-- ─── Conferência ───────────────────────────────────────────────────────────
-- Depois de rodar, esta consulta deve listar as 9 colunas novas:
--   select column_name from information_schema.columns
--    where table_schema = 'public' and table_name = 'logs'
--      and column_name in ('resposta','fonte','modelo','revisao','revisao_nota','revisado_em','revisado_por','resposta_rapida_id','retorno');
-- (Ou, mais fácil: painel administrativo → aba Sistema → "Rodar verificação".)
