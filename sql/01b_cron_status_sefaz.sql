-- Comando corrigido pro Cron Job "status-sefaz-agendado".
--
-- No painel: Integrations > Cron > clica no job "status-sefaz-agendado" (ou
-- "⋮" > Edit) > apaga o conteúdo do campo de comando > cola isto no lugar >
-- salva.
--
-- O que mudou em relação ao que estava:
--   1. headers agora manda Authorization com a anon key (sem isso a Supabase
--      rejeita a chamada antes dela chegar na função -- por isso o cron
--      "sucedia" mas os logs da função não mostravam nada).
--   2. timeout subiu de 1000ms (1 segundo -- curto demais) pra 30000ms
--      (30 segundos -- a função busca 2 sites externos e grava 2 vezes no
--      banco, precisa de mais margem).
select
  net.http_post(
      url:='https://btikuvmypdugpfmusqsf.supabase.co/functions/v1/status-sefaz',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ0aWt1dm15cGR1Z3BmbXVzcXNmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE1Mzk5MjgsImV4cCI6MjA5NzExNTkyOH0.Ai_qaiX_ft8IzpS0HsJsQO_6b5JS-x26A-5GM-MyYak"}'::jsonb,
      timeout_milliseconds:=30000
  );
