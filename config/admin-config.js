/* ═══════════════════════════════════════════════════════════════════════════
   CONFIGURAÇÃO DA ÁREA ADMINISTRATIVA (só é carregada por admin/index.html)

   Há dois modos de login:

   • "local"    — a senha é conferida no próprio navegador, comparando com o "hash" abaixo (a senha em si NÃO fica
                  escrita aqui). É uma proteção básica: impede acesso casual, mas NÃO protege o banco de dados,
                  porque quem entender de programação consegue falar direto com o Supabase.
                  Para trocar a senha: Admin → aba "Sistema" → "Alterar senha" (gera este arquivo de novo).
                  Esqueceu a senha? Abra admin/senha.html, gere um hash novo e cole aqui.

   • "supabase" — recomendado. O login é feito no Supabase Auth (um usuário que você cria no painel do Supabase) e
                  as regras do banco (sql/03_seguranca_rls.sql) só deixam esse usuário editar o conteúdo.
                  Para ativar: crie o usuário, rode o SQL 03 e troque "modo" para "supabase" + preencha "supabaseEmail".
                  Passo a passo no README.md (seção Segurança).

   "repositorio" (opcional): endereço do seu repositório no GitHub, ex.: "meu-usuario/bsoft-suporte-ia".
   Com ele, o painel mostra o botão "Abrir no GitHub" para colar a configuração nova direto no site, sem precisar do Git.
   ═══════════════════════════════════════════════════════════════════════════ */
window.BSOFT_ADMIN = {
  "modo": "local",
  "supabaseEmail": "",
  "sessaoMinutosOciosa": 120,
  "repositorio": "",
  "ramo": "main",
  "senha": {
    "algoritmo": "PBKDF2-SHA256",
    "iteracoes": 210000,
    "sal": "gD/7fs+o6PGfm30GKwqG3g==",
    "hash": "5jTbWtgbpyN6rq6V5DmUC8ekXDtOS2fJMn2J0kB69X4="
  }
};
