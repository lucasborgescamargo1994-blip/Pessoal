-- ═══════════════════════════════════════════════════════════════════════════
-- 05 — Caminho no menu de cada artigo da base de conhecimento (tabela "BancoDados")
-- ═══════════════════════════════════════════════════════════════════════════
-- Rode este arquivo INTEIRO, UMA vez, no SQL Editor do painel do Supabase
-- (Dashboard → SQL Editor → New query → cole → Run). É seguro rodar de novo: usa "if not exists".
--
-- O que ele faz:
--   Cria a coluna "caminho_menu" na tabela "BancoDados" (a base de conhecimento). Na Área Administrativa → aba Revisão, o formulário
--   "Salvar no banco de dados" (e a janela "Corrigir artigo") ganha o campo "Caminho no menu (opcional)", logo depois de "Categoria (opcional)":
--   o que for escrito ali é gravado direto nesta coluna, por exemplo:
--       Transporte > Configurações > Informações de cobrança padrão
--   A IA recebe esse caminho junto do artigo e o escreve literalmente na resposta ("Ou pelo menu: Transporte > Configurações > …").
--
-- Enquanto este SQL não for rodado, o sistema funciona normalmente: o campo aparece, mas ao tentar gravar um caminho a Revisão avisa para rodar
-- este arquivo (nada é gravado pela metade); sem caminho preenchido, tudo grava como sempre. As regras de segurança do 03_seguranca_rls.sql já
-- cobrem a tabela (a política de "BancoDados" é por tabela, não por coluna).
-- ═══════════════════════════════════════════════════════════════════════════

alter table public."BancoDados" add column if not exists caminho_menu text;   -- ex.: 'Transporte > Configurações > Informações de cobrança padrão'

-- faz a API do Supabase enxergar a coluna nova na hora (sem esperar o cache de esquema atualizar sozinho)
notify pgrst, 'reload schema';

-- ─── Conferência ───────────────────────────────────────────────────────────
-- Depois de rodar, esta consulta deve devolver 1 linha:
--   select column_name, data_type from information_schema.columns
--    where table_schema = 'public' and table_name = 'BancoDados' and column_name = 'caminho_menu';
