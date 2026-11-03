-- ════════════════════════════════════════════════════════════════════════════
-- 08 — Chamada de voz ao vivo (OPCIONAL): limite de chamadas por pessoa e por dia
-- ════════════════════════════════════════════════════════════════════════════
-- Só precisa se você publicar a função supabase/functions/voz-token (a voz ao vivo liberada para todos, sem mostrar a chave do Google).
-- Sem este arquivo a função funciona igual, só que sem o limite próprio (continua valendo o limite gratuito do Google).
--
-- Rode uma vez no SQL Editor do Supabase. É seguro rodar de novo.
--
-- O que ele faz: cria a tabela "voz_tokens", onde a função anota cada token entregue (só um HASH do IP — nunca o IP — e a hora), para
-- recusar quem pedir demais (padrão: 8 por pessoa a cada 10 minutos e 300 no total por dia; mude com os secrets VOZ_LIMITE_IP e VOZ_LIMITE_DIA).
-- A tabela fica fechada para a chave pública do sistema: só a função (service role) lê e grava nela.
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists public.voz_tokens (
    id        bigserial primary key,
    ip        text        not null,                    -- hash do IP (LGPD), não o IP
    criado_em timestamptz not null default now()
);
create index if not exists voz_tokens_ip_idx    on public.voz_tokens (ip, criado_em desc);
create index if not exists voz_tokens_criado_idx on public.voz_tokens (criado_em desc);

alter table public.voz_tokens enable row level security;   -- sem nenhuma política: ninguém mexe nela pela chave pública
revoke all on public.voz_tokens from anon, authenticated;
