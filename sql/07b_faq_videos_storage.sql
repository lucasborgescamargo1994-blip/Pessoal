-- ═════════════════════════════════════════════════════════════════
-- 07b — FAQ (OPCIONAL): enviar o arquivo de vídeo do computador direto pelo painel
-- ═════════════════════════════════════════════════════════════════
-- Só precisa se você quiser o botão "Enviar vídeo do computador" no editor do FAQ (aba FAQ da Área Administrativa).
-- Sem este arquivo o FAQ funciona igual: é só colar o link do vídeo (YouTube, Google Drive, Vimeo, Loom…).
--
-- Rode DEPOIS do 07_faq.sql, uma vez, no SQL Editor do Supabase. É seguro rodar de novo.
--
-- O que ele faz: cria o "bucket" (pasta de arquivos) público "faq-videos" e as regras de quem pode enviar arquivos para ele.
--   • Sem o 03_seguranca_rls.sql (modo "local"): qualquer pessoa com a chave pública consegue ENVIAR vídeo para esse bucket
--     (como as tabelas do sistema nesse modo). Quem tem o link sempre consegue ASSISTIR (bucket público).
--   • Com o 03_seguranca_rls.sql (modo "supabase"): só o administrador envia/troca/apaga.
--
-- ATENÇÃO — limite de tamanho: no plano gratuito do Supabase cada arquivo pode ter NO MÁXIMO 50 MB (e o espaço total é de 1 GB).
-- Gravação de tela costuma passar disso: para vídeos grandes prefira o YouTube ("não listado") ou o Google Drive e cole o link.
-- ═════════════════════════════════════════════════════════════════

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('faq-videos', 'faq-videos', true, 52428800, array['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime', 'video/x-m4v'])
on conflict (id) do update
    set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.faq_videos_aplicar_politicas(seguro boolean) returns void
language plpgsql as $$
begin
    drop policy if exists "bsoft faq videos envio"  on storage.objects;
    drop policy if exists "bsoft faq videos troca"  on storage.objects;
    drop policy if exists "bsoft faq videos apaga"  on storage.objects;
    if not coalesce(seguro, false) then
        create policy "bsoft faq videos envio" on storage.objects for insert to anon, authenticated with check (bucket_id = 'faq-videos');
        create policy "bsoft faq videos troca" on storage.objects for update to anon, authenticated using (bucket_id = 'faq-videos') with check (bucket_id = 'faq-videos');
        create policy "bsoft faq videos apaga" on storage.objects for delete to anon, authenticated using (bucket_id = 'faq-videos');
    else
        create policy "bsoft faq videos envio" on storage.objects for insert to authenticated with check (bucket_id = 'faq-videos' and public.eh_admin());
        create policy "bsoft faq videos troca" on storage.objects for update to authenticated using (bucket_id = 'faq-videos' and public.eh_admin()) with check (bucket_id = 'faq-videos' and public.eh_admin());
        create policy "bsoft faq videos apaga" on storage.objects for delete to authenticated using (bucket_id = 'faq-videos' and public.eh_admin());
    end if;
end $$;

select public.faq_videos_aplicar_politicas(to_regprocedure('public.eh_admin()') is not null);

notify pgrst, 'reload schema';

-- Conferência: esta consulta deve devolver 1 linha:
--   select id, public, file_size_limit from storage.buckets where id = 'faq-videos';
