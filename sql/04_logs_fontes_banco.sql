-- ═══════════════════════════════════════════════════════════════════════════
-- 04 — Quais dados do banco de dados a IA usou em cada resposta (aba Revisão)
-- ═══════════════════════════════════════════════════════════════════════════
-- Rode este arquivo INTEIRO, UMA vez, no SQL Editor do painel do Supabase
-- (Dashboard → SQL Editor → New query → cole → Run). É seguro rodar de novo: usa "if not exists".
--
-- O que ele faz:
--   Cria a coluna "fontes_banco" na tabela "logs". A cada resposta da IA o sistema guarda ali a lista dos dados do banco de dados que
--   foram entregues à IA para montar a resposta (artigos da base de conhecimento, respostas rápidas aprovadas, parâmetros,
--   funcionalidades e rotinas). Na Área Administrativa → aba Revisão aparece o card "Dados do banco de dados usados nesta resposta":
--   clicando em um artigo você corrige o texto dele e salva direto na base de conhecimento.
--
-- Formato (jsonb), uma lista de itens — só o suficiente para achar o registro; o conteúdo é lido na hora, da própria base, quando você clica:
--   [ { "tipo": "banco", "id": 123, "titulo": "Como cancelar um MDF-e", "pct": 87 }, ... ]
--   tipo: banco | rr | param | func | rotina | repo | ml        pct: relevância de 0 a 100
--   Lista vazia ([]) = a IA não recebeu nenhum dado do banco para aquela pergunta. Vazio (null) = resposta anterior a este SQL.
--
-- Enquanto este SQL não for rodado, o sistema continua funcionando normalmente — só não guarda (nem mostra) as fontes
-- (o app avisa uma vez no console do navegador). Respostas anteriores a ele não têm essa informação e nunca terão.
-- As regras de segurança do 03_seguranca_rls.sql já cobrem a coluna (a política de "logs" é por linha, não por coluna).
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.logs add column if not exists fontes_banco jsonb;   -- dados do banco usados na resposta: [{tipo, id, titulo, pct}, ...]

-- faz a API do Supabase enxergar a coluna nova na hora (sem esperar o cache de esquema atualizar sozinho)
notify pgrst, 'reload schema';

-- ─── Conferência ───────────────────────────────────────────────────────────
-- Depois de rodar, esta consulta deve devolver 1 linha:
--   select column_name, data_type from information_schema.columns
--    where table_schema = 'public' and table_name = 'logs' and column_name = 'fontes_banco';
-- (Ou, mais fácil: painel administrativo → aba Sistema → "Rodar verificação".)
