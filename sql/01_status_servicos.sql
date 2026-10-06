-- ═══════════════════════════════════════════════════════════════════════════
-- Setup da tabela StatusServicos (status SEFAZ / ANTT no topo do app)
-- ═══════════════════════════════════════════════════════════════════════════
-- Rode este arquivo inteiro no SQL Editor do painel do Supabase, UMA vez,
-- antes de publicar a Edge Function "status-sefaz".
--
-- Uma linha por serviço: "sefaz" e "antt", as duas preenchidas sozinhas pela
-- mesma Edge Function agendada "status-sefaz" (30/09/2026: ANTT também
-- virou 100% automático, não tem mais edição manual pelo app).
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists "StatusServicos" (
    servico        text primary key,              -- 'sefaz' ou 'antt'
    geral          text not null default 'ok',     -- 'ok' ou 'alerta'
    detalhes       text,                           -- descrição do problema (1 linha por item), null quando geral='ok'
    atualizado_em  timestamptz not null default now(),
    atualizado_por text                            -- null = atualização automática; 'admin' = editado manualmente
);

insert into "StatusServicos" (servico, geral, detalhes)
values
    ('sefaz', 'ok', null),
    ('antt',  'ok', null)
on conflict (servico) do nothing;

-- ─────────────────────────────────────────────────────────────────────────
-- Permissões: OBRIGATÓRIO, não é opcional. Tabela criada por SQL Editor (em
-- vez da interface Table Editor) NÃO ganha automaticamente a permissão de
-- leitura/escrita pra NENHUM papel -- nem "anon" (usado pelo app, mesma
-- chave pública já embutida no HTML) nem "service_role" (usado pela Edge
-- Function pra gravar). Sem isso, toda consulta do app volta 401 "permission
-- denied for table StatusServicos", e a Edge Function falha do mesmo jeito
-- ao tentar gravar (confirmado ao vivo em 28-30/09/2026, os dois casos).
-- UPDATE pro anon/authenticated não é mais usado agora que o ANTT também é
-- automático (mantido aqui só por não fazer diferença/risco ter -- é uma
-- tabela pequena e sem dado sensível). INSERT/UPDATE pro service_role é
-- usado pelo "upsert" da Edge Function (grava criando a linha se não
-- existir, ou atualizando se já existir).
-- ─────────────────────────────────────────────────────────────────────────
grant select, update on public."StatusServicos" to anon;
grant select, update on public."StatusServicos" to authenticated;
grant select, insert, update on public."StatusServicos" to service_role;
