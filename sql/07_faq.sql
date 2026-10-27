-- ═════════════════════════════════════════════════════════════════
-- 07 — FAQ: perguntas, respostas e vídeos (página faq.html + aba "FAQ" da Área Administrativa)
-- ═════════════════════════════════════════════════════════════════
-- Rode este arquivo INTEIRO, UMA vez, no SQL Editor do painel do Supabase
-- (Dashboard → SQL Editor → New query → cole → Run). É seguro rodar de novo: usa "if not exists" / "create or replace".
--
-- O que ele cria (tudo novo — nenhuma tabela existente é alterada):
--   1. faq_itens — cada pergunta do FAQ: texto da pergunta e da resposta (formato Markdown), categoria, caminho no menu, palavras-chave,
--      os VÍDEOS anexados (lista de {titulo, url}: YouTube, Google Drive, Vimeo, Loom, arquivo .mp4…), de onde veio (banco de dados /
--      resposta rápida / digitada à mão) e se está PUBLICADA (só as publicadas aparecem na página faq.html).
--   2. função faq_aplicar_politicas(seguro) — liga as regras de segurança (veja abaixo).
--
-- SEGURANÇA — dois modos, igual ao resto do sistema:
--   • Sem o 03_seguranca_rls.sql (modo "local" do painel): a tabela fica aberta para a chave pública, como respostas_rapidas — a página
--     faq.html só mostra as PUBLICADAS, mas quem souber consultar o banco consegue ler (e editar) também os rascunhos. Serve para começar.
--   • Com o 03_seguranca_rls.sql (modo "supabase"): o público só LÊ as publicadas; só o ADMINISTRADOR cria, edita e vê os rascunhos.
--     (Rodou o 03 DEPOIS deste? Ele já reaplica as regras desta tabela sozinho.)
-- Os vídeos em si NÃO ficam aqui: a tabela guarda só o endereço (YouTube/Drive/…). Para enviar o arquivo do computador direto pelo painel,
-- rode também o 07b_faq_videos_storage.sql (opcional).
-- ═════════════════════════════════════════════════════════════════

-- ─── 1) Perguntas do FAQ ───────────────────────────────────────────
create table if not exists public.faq_itens (
    id             bigint generated always as identity primary key,
    pergunta       text    not null,                                -- "Como emitir um CT-e de complemento?"
    resposta       text,                                            -- texto da resposta (Markdown: **negrito**, listas, links)
    categoria      text,                                            -- agrupa e filtra na página (ex.: "Ct-e", "Financeiro")
    caminho_menu   text,                                            -- ex.: "Transporte > Conhecimentos" (aparece como "Onde fica")
    palavras_chave text,                                            -- sinônimos para a busca (ex.: "cancelar anular estornar")
    videos         jsonb   not null default '[]'::jsonb,            -- [{"titulo":"Passo a passo","url":"https://youtu.be/…"}]
    origem         text,                                            -- 'banco' (artigo do BancoDados) | 'resposta_rapida' | vazio (digitada no painel)
    origem_id      bigint,                                          -- id do artigo / da resposta rápida de onde veio
    publicado      boolean not null default false,                  -- só as publicadas aparecem em faq.html
    ordem          integer not null default 0,                      -- menor aparece primeiro (empate: pelo id)
    criado_por     text,
    criado_em      timestamptz not null default now(),
    atualizado_em  timestamptz not null default now(),
    constraint faq_itens_videos_lista check (jsonb_typeof(videos) = 'array')
);
-- a mesma origem não entra duas vezes no FAQ (o painel avisa "já está no FAQ")
create unique index if not exists faq_itens_origem_uni on public.faq_itens (origem, origem_id) where origem is not null and origem_id is not null;
create index if not exists faq_itens_lista_idx on public.faq_itens (publicado, ordem, id);
create index if not exists faq_itens_categoria_idx on public.faq_itens (categoria);

-- "atualizado_em" preenchido pelo banco a cada alteração
create or replace function public.faq_atualizado_em() returns trigger
language plpgsql as $$
begin
    new.atualizado_em := now();
    return new;
end $$;
drop trigger if exists faq_itens_atualizado on public.faq_itens;
create trigger faq_itens_atualizado before update on public.faq_itens
    for each row execute function public.faq_atualizado_em();

-- Permissões de tabela (tabela criada por SQL não ganha permissão automática). O que cada papel PODE de fato fazer é decidido pelas regras (RLS) abaixo.
grant select, insert, update, delete on public.faq_itens to anon, authenticated;
grant all on public.faq_itens to service_role;

-- ─── 2) Regras de segurança (RLS) ──────────────────────────────────
-- seguro = false → tabela aberta (modo "local" do painel).   seguro = true → o público só lê as PUBLICADAS; só o administrador escreve e vê rascunhos.
-- Este arquivo escolhe sozinho: se a função eh_admin() (criada pelo 03_seguranca_rls.sql) existir, aplica o modo seguro.
create or replace function public.faq_aplicar_politicas(seguro boolean) returns void
language plpgsql as $$
begin
    alter table public.faq_itens enable row level security;
    drop policy if exists "bsoft faq aberto" on public.faq_itens;
    drop policy if exists "bsoft faq ler"    on public.faq_itens;
    drop policy if exists "bsoft faq admin"  on public.faq_itens;
    if not coalesce(seguro, false) then
        create policy "bsoft faq aberto" on public.faq_itens for all to anon, authenticated using (true) with check (true);
    else
        create policy "bsoft faq ler"   on public.faq_itens for select to anon, authenticated using (publicado or public.eh_admin());
        create policy "bsoft faq admin" on public.faq_itens for all to authenticated using (public.eh_admin()) with check (public.eh_admin());
    end if;
end $$;

select public.faq_aplicar_politicas(to_regprocedure('public.eh_admin()') is not null);

-- faz a API do Supabase enxergar a tabela nova na hora
notify pgrst, 'reload schema';

-- ─── Conferência ───────────────────────────────────────────────────
-- Depois de rodar, esta consulta deve devolver 1 linha:
--   select table_name from information_schema.tables where table_schema = 'public' and table_name = 'faq_itens';
