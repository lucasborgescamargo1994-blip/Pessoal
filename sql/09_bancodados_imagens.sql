-- ═══════════════════════════════════════════════════════════════════════════
-- 09 — Imagens do procedimento nos artigos da base de conhecimento (tabela "BancoDados")
-- ═══════════════════════════════════════════════════════════════════════════
-- Rode este arquivo INTEIRO, UMA vez, no SQL Editor do painel do Supabase
-- (Dashboard → SQL Editor → New query → cole → Run). É seguro rodar de novo.
--
-- O que ele faz:
--   1) Cria a coluna "imagens" (jsonb) na tabela "BancoDados": a lista de prints do passo a passo do artigo, no formato
--         [ {"url": "https://…/storage/v1/object/public/bancodados-imagens/artigo-12/….webp", "legenda": "Tela de Parâmetros"}, … ]
--      Fica vazia (null) nos artigos que não têm imagem — nada muda para eles.
--   2) Cria o "bucket" (pasta de arquivos) PÚBLICO "bancodados-imagens", onde os prints ficam guardados, e as regras de quem pode
--      enviar / trocar / apagar arquivos nele.
--        • Sem o 03_seguranca_rls.sql (modo "local"): qualquer pessoa com a chave pública consegue ENVIAR imagens para esse bucket
--          (como as tabelas do sistema nesse modo).
--        • Com o 03_seguranca_rls.sql (modo "supabase"): só o administrador envia/troca/apaga.
--        • Quem tem o link da imagem sempre consegue VER (bucket público) — é assim que ela aparece no chat.
--
-- Depois de rodar: na Área Administrativa (aba Banco de dados › editar o artigo, Revisão › "Corrigir artigo" ou "Salvar no banco de
-- dados") o artigo ganha o campo "Imagens do procedimento": cole o print (Ctrl+V), arraste o arquivo ou clique em Adicionar imagem.
-- Quando a IA responder usando esse artigo, as imagens aparecem junto da resposta, abaixo do texto.
--
-- Enquanto este SQL não for rodado o sistema funciona normalmente (o chat só não mostra imagens); no painel, o campo "Imagens do
-- procedimento" avisa que falta rodar este arquivo — nada é gravado pela metade.
-- As regras de segurança do 03_seguranca_rls.sql já cobrem a tabela "BancoDados" (a política é por tabela, não por coluna).
--
-- ATENÇÃO — limite de tamanho: o painel reduz e comprime o print antes de enviar (largura máxima 1600 px, formato WebP: costuma
-- ficar entre 80 e 300 KB). O bucket aceita no máximo 5 MB por arquivo; no plano gratuito do Supabase o espaço total é de 1 GB.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public."BancoDados" add column if not exists imagens jsonb;   -- ex.: [{"url": "https://…", "legenda": "Tela de Parâmetros"}]

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('bancodados-imagens', 'bancodados-imagens', true, 5242880, array['image/webp', 'image/png', 'image/jpeg', 'image/gif'])
on conflict (id) do update
    set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.bancodados_imagens_aplicar_politicas(seguro boolean) returns void
language plpgsql as $$
begin
    drop policy if exists "bsoft bancodados imagens leitura" on storage.objects;
    drop policy if exists "bsoft bancodados imagens envio"   on storage.objects;
    drop policy if exists "bsoft bancodados imagens troca"   on storage.objects;
    drop policy if exists "bsoft bancodados imagens apaga"   on storage.objects;
    -- leitura (listar/conferir os arquivos do bucket): o bucket já é público, então isso não expõe nada além do que o link já mostra
    create policy "bsoft bancodados imagens leitura" on storage.objects for select to anon, authenticated using (bucket_id = 'bancodados-imagens');
    if not coalesce(seguro, false) then
        create policy "bsoft bancodados imagens envio" on storage.objects for insert to anon, authenticated with check (bucket_id = 'bancodados-imagens');
        create policy "bsoft bancodados imagens troca" on storage.objects for update to anon, authenticated using (bucket_id = 'bancodados-imagens') with check (bucket_id = 'bancodados-imagens');
        create policy "bsoft bancodados imagens apaga" on storage.objects for delete to anon, authenticated using (bucket_id = 'bancodados-imagens');
    else
        create policy "bsoft bancodados imagens envio" on storage.objects for insert to authenticated with check (bucket_id = 'bancodados-imagens' and public.eh_admin());
        create policy "bsoft bancodados imagens troca" on storage.objects for update to authenticated using (bucket_id = 'bancodados-imagens' and public.eh_admin()) with check (bucket_id = 'bancodados-imagens' and public.eh_admin());
        create policy "bsoft bancodados imagens apaga" on storage.objects for delete to authenticated using (bucket_id = 'bancodados-imagens' and public.eh_admin());
    end if;
end $$;

-- "seguro" = o 03_seguranca_rls.sql já foi rodado (a função eh_admin() existe)
select public.bancodados_imagens_aplicar_politicas(to_regprocedure('public.eh_admin()') is not null);

-- faz a API do Supabase enxergar a coluna nova na hora (sem esperar o cache de esquema atualizar sozinho)
notify pgrst, 'reload schema';

-- ─── Conferência ───────────────────────────────────────────────────────────
-- Depois de rodar, estas duas consultas devem devolver 1 linha cada:
--   select column_name, data_type from information_schema.columns
--    where table_schema = 'public' and table_name = 'BancoDados' and column_name = 'imagens';
--   select id, public, file_size_limit from storage.buckets where id = 'bancodados-imagens';
