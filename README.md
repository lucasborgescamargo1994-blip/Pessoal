# Bsoft TMS · Suporte IA — v28

Assistente de suporte do Bsoft TMS: responde dúvidas com a base de conhecimento + IA, aprende com a equipe
(**respostas rápidas** aprovadas por você) e tem uma **Área Administrativa** com abas (revisão, IA/MCP, banco de dados, logs, análise, simulador…).

É só HTML + CSS + JavaScript — **sem build e sem servidor**. Funciona:

- no **GitHub Pages** (o endereço que você divulga para a equipe);
- no seu computador, **abrindo o `index.html` com dois cliques** (sem erro de CORS);
- em um servidor local (`tools/servidor-local.bat`), igual ao GitHub Pages.

> As versões antigas (`v26`, `v27`, arquivo único) continuam na pasta acima desta, intactas, como plano B (rollback).
> **Não suba a pasta de cima no GitHub** — só o conteúdo desta pasta (`bsoft-suporte-ia`). Veja [O que subir no GitHub](#o-que-subir-no-github).

---

## Sumário

1. [Estrutura de pastas](#estrutura-de-pastas)
2. [Rodar no computador](#rodar-no-computador)
3. [Publicar no GitHub Pages](#publicar-no-github-pages)
4. [Banco de dados (Supabase): o que instalar](#banco-de-dados-supabase-o-que-instalar)
5. [Área Administrativa](#área-administrativa)
6. [Respostas rápidas e revisão](#respostas-rápidas-e-revisão)
7. [Análise de logs (aba Análise)](#análise-de-logs-aba-análise)
8. [Ferramentas em abas (Sefaz, Regras, Relatórios, Parâmetros)](#ferramentas-em-abas-sefaz-regras-relatórios-parâmetros)
9. [Agenda (tarefas, cronograma e lembretes)](#agenda-tarefas-cronograma-e-lembretes)
10. [Latitude e longitude no chat](#latitude-e-longitude-no-chat-v2813)
11. [Pergunta vaga: botões “qual é o seu caso?”](#pergunta-vaga-botões-qual-é-o-seu-caso-v2818)
12. [Menu real do sistema: caminhos de cada tela](#menu-real-do-sistema-caminhos-de-cada-tela-v2819)
13. [Resposta curta ou completa detalhada](#resposta-curta-ou-completa-detalhada-v2820)
14. [IA / MCP: trocar modelos e chaves](#ia--mcp-trocar-modelos-e-chaves)
15. [Segurança — leia](#segurança--leia)
16. [Problemas comuns](#problemas-comuns)
17. [Para quem vai mexer no código](#para-quem-vai-mexer-no-código)

---

## Estrutura de pastas

```
bsoft-suporte-ia/
├─ index.html              ← o sistema (chat) que os usuários abrem
├─ admin/
│  ├─ index.html           ← Área Administrativa (login + abas)
│  ├─ senha.html           ← gera/recupera a senha do painel (sem precisar da antiga)
│  ├─ admin.css
│  └─ js/                  ← nucleo, auth, componentes, analise-core, graficos e uma aba por arquivo (aba-*.js)
├─ config/                 ← AS CONFIGURAÇÕES (arquivos pequenos que você edita/sobe)
│  ├─ app-config.js        ← endereços públicos (Supabase, planilhas)
│  ├─ mcp-config.js        ← IA: provedor, chaves, modelos, regras das respostas rápidas
│  └─ admin-config.js      ← senha do painel (hash) e modo de login
├─ css/                    ← estilos (tokens, app-*, theme-2026, workspace, ferramentas, meu-espaco, agenda, ...)
├─ js/
│  ├─ core/                ← base compartilhada (IA/MCP, Supabase, markdown, busca de respostas rápidas...)
│  ├─ app/                 ← lógica do chat e dos assistentes (ferramentas.js = abas das ferramentas; regras, relatórios, Sefaz...)
│  └─ ui/                  ← interface (abas, Meu Espaço, agenda-*.js, Personalizar, paleta de comandos...)
├─ sql/                    ← scripts para rodar no Supabase (01, 02, 03 e o 03b que desfaz o 03)
├─ supabase/functions/     ← Edge Function do status SEFAZ/ANTT
├─ tools/                  ← utilitários: servidor-local.bat, atualizar-versao.ps1, verificar-projeto.ps1, gerar-nova-do-beta.js
├─ .nojekyll  .gitignore  README.md
```

**Por que tudo é "script comum" (sem `import`/módulos)?** Navegadores bloqueiam módulos e `fetch` de arquivos locais
(erro de CORS) quando a página é aberta por duplo clique. Com scripts comuns carregados por `<script src>`,
o mesmo código roda no GitHub Pages **e** no disco. Por isso a **ordem** dos `<script>` no final do `index.html` importa.

---

## Rodar no computador

**Jeito mais simples:** dê dois cliques em `index.html`. Pronto.

**Igual ao GitHub Pages (opcional):** dê dois cliques em `tools/servidor-local.bat` — abre `http://localhost:8080/index.html`.
(É um servidorzinho em PowerShell, não instala nada. Para outra porta: `servidor-local.bat 8090`.)

O painel fica em `admin/index.html` (ou no botão **🔑** do cabeçalho do sistema).

---

## Publicar no GitHub Pages

1. Crie um repositório (ex.: `bsoft-suporte-ia`) e suba **o conteúdo desta pasta** (não a pasta de cima).
   - Pelo site: *Add file → Upload files* (arraste tudo, **inclusive** `.nojekyll`), ou
   - Pelo GitHub Desktop, ou pelo terminal dentro desta pasta:
     ```bash
     git init
     git add .
     git commit -m "Bsoft TMS Suporte IA v28"
     git branch -M main
     git remote add origin https://github.com/SEU-USUARIO/bsoft-suporte-ia.git
     git push -u origin main
     ```
2. No repositório: **Settings → Pages → Build and deployment → Deploy from a branch → `main` / `(root)` → Save**.
3. Em ~1 minuto o sistema está em `https://SEU-USUARIO.github.io/bsoft-suporte-ia/` e o painel em `.../admin/`.

> ⚠️ **No plano gratuito do GitHub, Pages só funciona com repositório público** — e *tudo* que está no repositório fica
> público (código, `config/mcp-config.js` com as chaves, o hash da senha). Leia [Segurança](#segurança--leia) antes de publicar.

Depois de qualquer atualização: faça commit + push; em ~1 minuto o site já está novo.
Dica: rode `tools/atualizar-versao.ps1 -Versao 28.1.0` antes do push para forçar os navegadores a baixarem CSS/JS novos.

---

## Banco de dados (Supabase): o que instalar

Rode **uma vez** cada arquivo no Supabase: *Dashboard → SQL Editor → New query → colar o arquivo → Run*.
Todos são seguros para rodar de novo.

| Ordem | Arquivo | Para quê | Obrigatório? |
|---|---|---|---|
| 1 | `sql/01_status_servicos.sql` (+ `01b_cron_status_sefaz.sql`, `supabase/functions/status-sefaz`) | Painel de status SEFAZ/ANTT | só se usar o status |
| 2 | `sql/02_respostas_rapidas_e_revisao.sql` | Guarda a **resposta** da IA nos logs, fila de **revisão** e a tabela de **respostas rápidas** | **sim**, para a revisão/respostas rápidas |
| 3 | `sql/03_seguranca_rls.sql` | Faz o **banco** exigir o login de administrador para editar conteúdo | recomendado (veja [Segurança](#segurança--leia)) |
| — | `sql/03b_desfazer_rls.sql` | Desfaz o 03 (volta ao banco "aberto") | só se precisar voltar atrás |
| 4 | `sql/04_logs_fontes_banco.sql` | Cria a coluna `logs.fontes_banco`: guarda **quais dados do banco a IA usou** em cada resposta (aba Revisão) | para ver essa lista na Revisão (sem ele, tudo funciona igual) |
| 5 | `sql/05_bancodados_caminho_menu.sql` | Cria a coluna `BancoDados.caminho_menu`: o **caminho da tela no menu** de cada artigo (ex.: `Transporte > Configurações > Tela`), preenchido na aba Revisão e em "Corrigir artigo" | para guardar o caminho junto do artigo e a IA mostrá-lo literalmente (sem ele, tudo funciona igual) |

**Conferir se deu certo:** painel → aba **Sistema** → **Rodar verificação** (lista o que existe e o que falta).
Enquanto o `02` não for rodado, o sistema funciona normalmente — só não grava a resposta no log nem mostra respostas rápidas.
Enquanto o `04` não for rodado, a resposta é gravada normalmente (e vai para a Revisão) — só não guarda nem mostra os dados do banco que a IA usou.

---

## Área Administrativa

Abra `admin/index.html` (botão **🔑** no cabeçalho do sistema). Entre com a senha e use as abas — dá para alternar entre
todas na mesma tela (`Alt+1` … `Alt+9` também trocam de aba). Tudo o que você está editando fica guardado ao trocar de aba.

| Aba | O que faz |
|---|---|
| **Revisão** | Mostra as respostas que a IA deu aos usuários. Você edita, **aprova** (vira resposta rápida), rejeita ou ignora. Agrupa perguntas iguais e sugere "perguntas parecidas" como variantes. Cada resposta mostra os **dados do banco de dados que a IA usou** — clique num artigo para corrigir o texto dele e salvar direto na base de conhecimento (item 8 de [Respostas rápidas e revisão](#respostas-rápidas-e-revisão)). |
| **Respostas rápidas** | Lista/edita/pausa/exclui as respostas aprovadas, mostra quantas vezes cada uma foi usada e tem um **testador**: "se alguém perguntar isto, qual resposta o sistema usaria?". |
| **Simulador** | O chat de verdade dentro do painel, **sem gravar nada** (nem log, nem feedback). Mostra de onde veio cada resposta (rápida ou IA, qual modelo, tempo). Dá para testar a configuração de IA **antes de salvar**. |
| **IA / MCP** | Edita `config/mcp-config.js`: provedor, chaves, cadeia de modelos (arrastar para ordenar, testar cada um), visão, embeddings, regras das respostas rápidas. |
| **Banco de dados** | Editor das tabelas de conteúdo (base de conhecimento, parâmetros, funcionalidades, rotinas, rejeições SEFAZ…): editar, criar, duplicar, excluir, exportar CSV. |
| **Logs** | Perguntas dos usuários, 👍/👎, motivo e **retorno do suporte**; filtros, busca, exclusão em lote, exportar CSV. A resposta só é baixada quando você abre a linha (economiza transferência). |
| **Análise** | Lê **todos os logs direto do banco** (sem importar planilha) e mostra o que alimentar na IA primeiro, a evolução no tempo — com filtros de **período, usuário, assunto e pergunta específica** —, o uso por pessoa e as perguntas que mais se repetem. Veja [Análise de logs](#análise-de-logs-aba-análise). |
| **Novidades** | Publica avisos que aparecem para todos na coluna "Novidades". |
| **Sistema** | Verificação do banco, **usuários e acessos** (criar logins e escolher as abas de cada pessoa), alterar a senha, limpeza do cache deste navegador, informações. |

### Senha do painel

- Hoje o painel aceita a **senha antiga** do sistema (só o *hash* dela está em `config/admin-config.js`; a senha em si não aparece no arquivo).
  Um aviso amarelo pede para trocá-la — ela ficava escrita à vista no código do v26/v27, então considere-a pública.
- **Trocar:** aba **Sistema → Alterar a senha do painel** → gera o `config/admin-config.js` novo → suba no GitHub.
- **Esqueceu?** Abra `admin/senha.html`, crie uma senha nova (não precisa da antiga), substitua o arquivo e suba.
- Depois de 3 erros seguidos o login espera um pouco (5 s, 15 s, 30 s… até 5 min); a sessão encerra sozinha após 120 min parada
  (`sessaoMinutosOciosa` em `admin-config.js`).

### Vários usuários e abas liberadas (aba Sistema → Usuários e acessos)

Quem entra com a **senha do painel** é o **administrador principal**: vê todas as abas e é o único que cria usuários. Para dar acesso a mais gente:

1. **Sistema → Usuários e acessos → Novo usuário**: escreva o usuário (login), clique em **Gerar senha forte** (e **Copiar**, para enviar à pessoa) e marque as **abas** que ela pode usar.
   Há atalhos: *Suporte*, *Só consulta*, *Tudo, menos configurações*. Abas delicadas têm uma etiqueta (IA / MCP guarda chaves de API; Banco de dados altera o conteúdo da IA; Logs pode excluir logs).
2. As mudanças ficam num **rascunho** (etiqueta "novo"/"alterado" e um ponto na aba). Clique em **Salvar no arquivo…** — o painel atualiza o `config/admin-config.js` — e faça **commit + push**.
3. Em ~1 minuto o usuário já entra no mesmo endereço do painel, digitando **usuário e senha**. O administrador principal continua entrando com a senha dele
   (no campo "Usuário" pode deixar em branco ou escrever o nome que quiser).

Como funciona e o que esperar:

- Quem não tem uma aba **não a vê, não abre pelo endereço (`#/aba`), nem pelos atalhos `Alt+número`**; botões que levariam a uma aba sem acesso somem. Quem fica **sem nenhuma aba** vê um aviso para falar com o administrador.
- **Desativar** bloqueia a entrada sem apagar o usuário; **Senha** redefine; **Excluir** remove. Nada vale até o arquivo ser publicado.
- Quem estiver logado e for **desativado, excluído ou tiver a senha trocada** é desconectado em até **5 minutos**; se só as **abas** mudarem, a página recarrega sozinha para aplicar.
  (A conferência lê o arquivo publicado; abrindo o painel direto do disco ela não acontece.)
- O nome do usuário aparece no histórico (`revisado_por` nas revisões, `aprovado_por` nas respostas rápidas) e no topo do painel.
- Cada usuário tem o próprio hash de senha (PBKDF2, 210 mil voltas, sal único). A senha em si nunca é gravada.
- **Só o administrador principal** vê "Usuários e acessos" e "Senha do administrador principal". Quem recebeu a aba Sistema vê só a verificação, as informações e a limpeza do cache do próprio navegador.
- Trocar a senha do administrador principal (aba Sistema ou `admin/senha.html`) **mantém a lista de usuários** no arquivo gerado.
- **Limite importante:** no modo `local` isso organiza o que cada pessoa vê e usa, mas **não é uma barreira de segurança** — quem entende de programação consegue falar direto com o banco, e os hashes ficam no
  arquivo público do GitHub (use senhas fortes). No **modo seguro** (Supabase) o acesso é por uma conta só e esta lista não vale.

---

## Respostas rápidas e revisão

Como funciona, do começo ao fim:

1. O usuário pergunta. O sistema grava a **pergunta + a resposta apresentada** no log (`revisao = pendente`).
   O simulador do painel **não grava nada**.
2. Em **Admin → Revisão** você confere a resposta, ajusta o texto (com pré-visualização) e escolhe:
   - **Aprovar** → cria uma linha em `respostas_rapidas` (a "planilha" nova), com variantes opcionais; ou
   - **Salvar no banco de dados** → em vez de resposta rápida, grava como **artigo da base de conhecimento** (`BancoDados`, o que a IA consulta) — veja o item 7; ou
   - **Adicionar como variante** de uma resposta rápida que já existe; ou **Rejeitar** (com motivo) / **Ignorar**.
3. Quando alguém faz uma pergunta **parecida** com uma aprovada, o chat mostra a resposta pronta **na hora, sem gastar IA**, com o selo
   ⚡ *Resposta rápida* e o botão **"Não era o que procurava? Clique aqui para pesquisar com a IA"**.
   Se clicar, a IA responde e o log recebe 👎 automático ("resposta rápida não era a procurada") — vira sinal para você melhorar a resposta.
4. Como decide que é "parecida" (ajustável em **IA / MCP → Respostas rápidas**): mesma pergunta depois de normalizar acentos/sinônimos,
   ou ≥ 80 % dos termos em comum; opcionalmente confere o **significado** (Jina) ≥ 92 %. Se a pergunta tem **números** (ex.: erro 539),
   eles precisam ser iguais — assim "erro 539" nunca recebe a resposta do "erro 540".
5. Pause uma resposta (chave **Ativa**) sem apagar; veja usos e 👍/👎 por resposta; use o testador para calibrar.
6. **As respostas aprovadas também são conhecimento da IA.** Quando a pergunta *não* é parecida o bastante para responder direto (ou quando o usuário
   clica em "pesquisar com a IA"), o sistema procura as aprovadas **mais relacionadas** — pela pergunta cadastrada/variantes, pelo significado (Jina) e pelos
   termos que aparecem no **texto** da resposta — e entrega até **3** delas à IA, dentro do prompt, junto dos artigos do manual (seção *"RESPOSTAS JÁ APROVADAS
   PELA EQUIPE DE SUPORTE"* + regra 11). A IA trata como conhecimento validado, usa quando resolve a pergunta e ignora quando é de outro assunto. Detalhes:
   - números precisam bater (erro 539 nunca recebe a resposta do 540);
   - a resposta que o usuário acabou de recusar ("não era o que procurava") **não** entra no contexto;
   - se há uma aprovada bem relacionada, a IA não diz "não encontrei no manual";
   - em **IA / MCP → Respostas rápidas** dá para **desligar** isso ("Usar também como conhecimento da IA") ou mudar quantas entram (1 a 6);
     as chaves no arquivo são `usarNoContexto` e `contextoMax`. No **Simulador**, o rastro mostra 📚 quais aprovadas foram dadas à IA em cada pergunta.
7. **Resposta rápida × banco de dados — qual escolher?** Resposta rápida é para pergunta que sempre tem a mesma resposta (o texto sai pronto, sem IA).
   **Salvar no banco de dados** é para tema amplo, ou que muda conforme a pergunta: o texto vira um artigo que a IA consulta e adapta. Como funciona:
   - grava em `BancoDados`: `titulo` = pergunta principal, `conteudo` = a resposta (já com os seus ajustes), `categoria` (opcional) e **vetor vazio** — o sistema
     calcula o vetor de busca sozinho na próxima vez que abre (é o mesmo caminho do **Novo registro** da aba **Banco de dados**; **não precisa de SQL novo**);
   - os logs da pergunta ficam com `revisao = banco` e a nota *"Salvo no banco de dados (#id)"*; dá para filtrar por **Salvas no banco de dados** na Revisão
     e na aba Logs, e o botão **Abrir no banco de dados** leva direto ao artigo (na aba **Banco de dados**, digitar `#123` no filtro vai direto ao ID 123);
   - avisa antes se já existe artigo com título muito parecido (≥ 80 %) ou se o usuário deu 👎 na resposta; as **variantes** da pergunta não são gravadas
     (só valem na resposta rápida);
   - **Reabrir para revisão** não apaga o artigo — edite ou exclua na aba **Banco de dados**.
8. **De onde a IA tirou a resposta? (v28.4 — `sql/04_logs_fontes_banco.sql`).** A cada resposta da IA o sistema guarda, na coluna `logs.fontes_banco`, a lista dos
   **dados do banco de dados que foram entregues à IA** para montá-la: artigos da base de conhecimento (com a relevância de cada um), respostas rápidas aprovadas usadas como
   conhecimento, parâmetros, funcionalidades e rotinas. Na **Revisão**, o cartão **"Dados do banco usados nesta resposta"** mostra essa lista:
   - **clicar num artigo** abre a janela *Corrigir artigo #id*: ela lê o texto **atual** direto da base (título, categoria, conteúdo e "como emitir"), mostra a pergunta e a
     resposta da IA para conferir, e **Salvar no banco de dados** atualiza o próprio artigo — vale para todos e o vetor de busca é recalculado sozinho na próxima abertura do
     sistema (mesmo caminho do **Editar** da aba **Banco de dados**). Dica: se a resposta da IA saiu errada por causa de um artigo errado ou velho, corrija **ele** em vez de criar outro;
   - **resposta rápida** abre a janela de edição dela; **parâmetro, funcionalidade e rotina** abrem a aba **Banco de dados** já no registro (lá você clica em **Editar**);
     documentos do repositório e conhecimento aprendido aparecem só para consulta;
   - quem não tem a aba **Banco de dados** (ou **Respostas rápidas**) liberada vê a lista, mas não consegue abrir a edição desses itens;
   - **lista vazia** = a IA não recebeu nenhum dado do banco para aquela pergunta (a resposta saiu sem base) — um bom sinal de que vale *Salvar no banco de dados*;
   - respostas **anteriores ao SQL 04** (ou geradas por quem ainda estava com a versão antiga aberta) não têm esse registro e nunca terão;
   - o que fica gravado é só o suficiente para achar o registro (tipo, id, título cortado em 90 caracteres e relevância) — o texto é lido na hora, da própria base.

9. **Caminho no menu (v28.17.1 — `sql/05_bancodados_caminho_menu.sql`).** Rodando o SQL 05 nasce a coluna `BancoDados.caminho_menu` (a "planilha" de artigos). Na **Revisão**, logo depois de "Categoria (opcional)", há o campo **Caminho no menu**:
   - grava direto na coluna `caminho_menu` quando você clica em **Salvar no banco de dados** (na aprovação como resposta rápida o campo não é usado);
   - o mesmo campo existe em **Corrigir artigo** (editar um artigo já salvo); mudar só o caminho não zera o vetor de busca do artigo;
   - separe os níveis com `>` (aceita também `›`, `»`, `→`, `->`, `|`; tudo vira `Menu > Submenu > Tela`);
   - **Efeito na IA:** o artigo entra no prompt com a linha "Caminho no menu: …" e a IA a usa **literalmente** (chat e Analisar tela); sem caminho ela nunca inventa. A mudança chega aos usuários quando abrem o sistema de novo;
   - Sem o SQL 05 nada quebra: o sistema abre normalmente (a carga refaz sem a coluna), o campo fica desabilitado em "Corrigir artigo", e em "Salvar no banco de dados" avisa que **nada foi salvo** e qual SQL rodar. A aba **Sistema** ganhou a linha de verificação da coluna.

O índice das respostas rápidas é baixado **só com o que mudou** e guardado no navegador (IndexedDB) — consumo mínimo do plano gratuito do Supabase.

---

## Análise de logs (aba Análise)

A aba **Análise** lê **todos os logs direto do banco** — não precisa exportar/importar CSV — e tem quatro visões:

- **Foco IA** — volume de dúvidas por assunto, "encontrou × não encontrou" e o **Plano de ação** (o que alimentar na IA primeiro: prioridade ALTA / MÉDIA / BAIXA).
- **Temporal** — evolução por dia e horários de pico, com filtros (abaixo).
- **Usuários** — quem mais usa, taxa de resposta e assunto principal de cada pessoa.
- **Recorrentes** — as 50 perguntas que mais se repetem.

**Filtros da visão Temporal** (todos juntos; os números, os gráficos e a tabela "Consultas do filtro" acompanham):

| Filtro | Como usar |
|---|---|
| **Período** | duas datas, ou os atalhos **7 / 30 / 90 dias / Tudo** (contam até a data do último log). |
| **Usuário** | lista com a quantidade de consultas de cada pessoa. |
| **Assunto** | lista dos assuntos (ver abaixo como são definidos). |
| **Pergunta específica** | escolha uma na lista (ou clique numa das **Perguntas mais frequentes**) = **só aquela pergunta**; ou digite parte do texto = **todas que contêm** o texto (sem diferenciar maiúsculas/acentos). |

Cada filtro ativo vira uma etiqueta com **×** para tirar só ele; **Limpar filtros** zera tudo. Nas outras visões, o botão **Ver no tempo** de cada linha
(assunto, usuário ou pergunta) abre a Temporal já filtrada.

Detalhes que valem saber:

- **Horário de Brasília.** A data vem de `created_at` (relógio do servidor); se faltar, da coluna `timestamp`. Um log às 23h30 aparece no próprio dia (não no seguinte). **Atenção (corrigido na v28.6.1):** o Supabase devolve `created_at` **sem fuso** (`2026-10-08T11:18:06.865777`), mas ele é UTC (11:18 UTC = 08:18 em Brasília). Até a v28.6.0 esse texto era lido "como está escrito", e todos os horários da Análise saíam 3 h adiantados (o 1º atendimento das 08:18 aparecia nos "Horários de pico" como 11h, e perguntas depois das 21h caíam no dia seguinte). Agora: dado lido do banco = UTC convertido para Brasília; planilha exportada (arquivo avulso `Análise de Logs.html`) = vale a leitura (UTC ou já em Brasília) que bate com a coluna `timestamp` da mesma linha, e sem ela UTC; texto com fuso (`Z`, `+00`, `-03:00`) continua sendo convertido. As telas Logs e Revisão sempre mostraram a hora pelo `timestamp` e já estavam certas; o "há X min" da Revisão e as datas das Novidades passam a usar a mesma leitura (`ADM.fmt.instante`, em `admin/js/nucleo.js`).
- **Agrupamentos:** usuários sem diferenciar maiúsculas/acentos (`Ana.Silva` = `ana.silva`); perguntas iguais sem diferenciar maiúsculas, acentos e pontuação.
- **"Encontrou" em branco** (log antigo) **não conta como falha** — aparece como "sem a informação".
- **Assunto** é por palavras-chave, comparando palavra inteira (as regras estão em `admin/js/analise-core.js › REGRAS_CATEGORIA`; dá para acrescentar palavras ali).
- **Origem** (IA / resposta rápida / ferramenta): o seletor no topo aparece quando os logs trazem a origem (SQL 02) e vale para todas as visões.
- **Consumo do Supabase:** baixa todas as linhas de `logs` **sem a coluna `resposta`** (cerca de 1 MB a cada 5 mil logs), uma vez ao abrir a aba. Ao reabrir, só recarrega se passaram 10 min;
  o botão ⟳ atualiza na hora. A aba **só lê** — não grava nada.

**`Análise de Logs.html`** (arquivo avulso na pasta de cima, fora do GitHub) continua funcionando com planilha CSV/Excel e tem os mesmos filtros e o mesmo cálculo
(o núcleo `admin/js/analise-core.js` está copiado dentro dele entre os marcadores `NÚCLEO` — se mudar um, copie para o outro).

---

## Ferramentas em abas (Sefaz, Regras, Relatórios, Parâmetros)

**Erros SEFAZ**, **Criar Regra**, **Assistente de Relatórios** e **Parâmetros / Funcionalidades** não escrevem mais dentro do chat: cada um abre na
**própria aba** (barra lateral, botão **+**, `Ctrl K` ou os atalhos da tela inicial). A conversa do chat fica intacta — dá para voltar a ela pela aba **Chat**
(ou pelo botão **Voltar ao chat** da ferramenta) sem abrir uma conversa nova, e até ver as duas lado a lado (tela dividida). **Nova consulta** limpa só a
aba da ferramenta; fechar a aba (✕) também a reinicia.

**Criar Regra › Ct-e › "Monte com um clique" › 📊 Cálculo do ICMS (v28.3.1)** — além do ICMS Demonstrativo, Cálculo Inverso, Somar ICMS e Substituição Tributária, há:
- **Definir valor manualmente GNRE?** — acrescenta, logo depois do `valorICMS`: `if (obt("outrosValores[vICMSGNRE]") < 0.01) def("outrosValores[vICMSGNRE]", obt("valorICMS"));`.
  O GNRE digitado na tela do Ct-e é mantido; se vier vazio (menor que 0,01) recebe o valor do ICMS. Se a regra já tiver o `vICMSGNRE`, a opção troca em vez de duplicar.
- **Redução Base de cálculo?** — abre um campo para a porcentagem (0 a 100) e gera `def("baseCalculo", obt("valorFrete") * (100 - %) / 100);` (20 → base = 80 % do frete; 0 → sem redução; 100 → base zero).
  Essa linha **substitui qualquer outra definição de `baseCalculo`** que já estiver montada (ICMS Demonstrativo, Cálculo Inverso, regra base ou regra colada), então a base nunca fica calculada duas vezes —
  e vale em qualquer ordem de cliques. Sem um número válido nada é aplicado (o campo avisa). Como a definição é única, com alíquota 0 a base também fica reduzida (a que zerava a base some).
  Se a base da regra colada estiver escondida num bloco if/else ("Linha extra"), o montador não consegue trocar e avisa em vermelho.

**⭐ v28.12.0 — a Nova Versão agora é o assistente de 6 passos (o que era o Beta) · o Beta segue oculto, para evoluir.** O botão **Ct-e / Conhecimento Nova Versão** do **Criar Regra** passou a abrir o assistente de **6 passos** (Regra base → Campos personalizados → Cálculo do Frete Valor → Cálculo do ICMS → Cálculo Total Prestação → Montagem manual), com tudo o que o Beta tinha na 28.11.1: regra colada/base que **marca as caixinhas conforme o que a regra já tem**, "Somar Frete Valor no Total Prestação", "Somar Frete Valor na Base de Cálculo", **"Somar ICMS"** (Demonstrativo, Cálculo Inverso e Somar ICMS são exclusivas), layout **anti-scroll**, caixas "Somar no …" que abrem com a busca, "Preencher manualmente", trava do ICMS e trava de loop. O **Beta continua oculto** (Personalizar › Recursos em teste) e é onde as novidades são feitas e testadas; elas chegam à Nova Versão **aos poucos** (veja **"Promover do Beta para a Nova Versão"** mais abaixo). As **4 telas antigas** da Nova Versão (descritas logo abaixo, v28.5) foram **aposentadas**; o que continua valendo daquela descrição é o catálogo do "Demais opções", a trava do ICMS, a trava de loop e o "Voltar" — comuns aos dois assistentes. **Atenção:** a Nova Versão herdou as **ausências do Beta**: **Fração do Pedágio, Seguro (%), Gris (%) e "Somar … no Total Serviço" não existem nela** (continuam no **Ct-e / Conhecimento** clássico, e dá para pedir pela caixa da IA). **Ordem dos botões do Criar Regra:** 1º **Ct-e / Conhecimento Nova Versão**, 2º **Contrato de Frete**, 3º **Faturamento**, por último **Ct-e / Conhecimento (Antigo)** — o montador clássico, que só mudou de lugar e de nome (o log segue registrando "Ct-e"); com o Beta ligado, o botão tracejado dele vem depois de todos (`perguntarTipoRegra`, em `assistente-regras.js`). Não precisa de SQL.

**(Histórico) Nova Versão antiga em 4 telas (v28.5 a v28.11, aposentada na 28.12.0)** — o mesmo montador de Ct-e, mas em **telas, uma de cada vez** (como slides), para quem se perde com tudo numa tela só.
Ao abrir o **Criar Regra** aparecem dois botões lado a lado: **Ct-e / Conhecimento** (o montador de sempre, **intacto**) e **Ct-e / Conhecimento Nova Versão**. Não precisa de SQL nem de configuração.
A trilha no topo mostra os 4 passos (dá para clicar para voltar a qualquer um):
1. **Regra base** — colar a regra que o cliente já usa **ou** escolher uma das regras prontas (as mesmas do montador clássico). A regra é lida na hora ("N cálculos reconhecidos") e já vai para a montagem. Trocar a regra base recomeça a montagem (desmarca as opções do passo 3).
2. **Campos personalizados** — "Irá utilizar campos personalizados?": **Não** (padrão) ou **Sim**. Com "Sim" aparecem **dois campos separados**, cada um com os nomes internos separados por vírgula (preencha só o que for usar):
   - **Ct-e / Contrato de Frete** (criados em *Transporte › Configurações › Tipos Valores Outros*): vão para a caixa **Utiliza Valores outros (Campos Personalizados)?** da montagem, como chips rosa arrastáveis, e entram na regra como `obt('outrosValores[nome]')`.
   - **Tabela de Preços** (criados em *Transporte › Tabelas de Preços › Tabela de preços Valores Outros*): vão para a faixa amarela **Campos personalizados da Tabela de Preços**, logo abaixo da caixa rosa, como chips amarelos arrastáveis, e entram na regra **sem `obt`**, como `tabelaPrecos.nome`.

   Se a regra colada já usa `outrosValores[nome]`, a tela oferece **Usar estes nomes** (no campo do Ct-e). Nome = letras, números e `_` (sem espaço nem símbolo; os inválidos são listados no campo certo e ignorados); "Sim" sem nenhum nome válido nos dois campos não deixa avançar (um só campo preenchido basta).
   Na regra feita com a IA, os dois grupos vão em linhas separadas do pedido, com o formato certo de cada um.
3. **O que configurar** — no topo a faixa "Se preferir montar a regra manualmente, marque a opção “Desejo fazer a montagem manual da regra” no rodapé e clique em avançar para montagem manual"; a pergunta **O que deseja configurar ou alterar?** com uma caixa que **filtra** todo o "Monte com um clique"
   (por começo de palavra, sem diferenciar acento: `st`, `ton`, `gnre`, `reduzir`, `pedagio`…; **Esc** limpa o filtro); os grupos em negrito com as opções; uma faixa "Marcadas" (com ✕ para desmarcar, mesmo com o filtro escondendo a opção); e ao lado a caixa
   **Ou se preferir, explique diretamente para a IA o que o cliente necessita, seja bem claro**.
   Rodapé (da esquerda para a direita): **◀ Voltar**, **Avançar para montagem manual** e **✨ Gerar Regra**. O **Avançar para montagem manual** (sem seta) vem **travado e cinza**: só é liberado depois de marcar a caixa
   **"Desejo fazer a montagem manual da regra"** que fica logo acima dele — é para forçar a leitura da tela antes de seguir. A trava vale também para a trilha de passos do topo (clicar em "4 Montagem manual" sem marcar leva de volta a esta tela,
   com um aviso e a caixa piscando) e o botão cinza, quando clicado, explica o que falta. A caixa fica marcada depois de liberada (voltar da montagem não pede de novo) e reinicia a cada vez que o assistente é aberto.
   - **Gerar Regra** vai direto (não depende da caixa): se há texto para a IA, **a IA monta** (levando junto a regra base e o que foi marcado — o mesmo caminho do "Gerar com IA" do clássico, e os campos personalizados do passo 2 vão para a IA, cada grupo com o seu formato);
     se só há marcações e/ou regra base, gera **sem IA**; sem nada marcado, escrito ou carregado, avisa. Opção marcada que pede número (ex.: % da redução) ainda sem valor bloqueia o Gerar **e** o Avançar, levando ao campo.
   - **➕ Demais opções (v28.6)** — último grupo da lista, só desta versão (o clássico não muda): uma caixinha para cada conta pronta **"Somar X no Y"**, separadas por campo de destino. Quem digita "somar ICMS" no filtro já vê **Somar ICMS no Frete Valor**, **no Total Serviço** e **no Total Prestação**.
     - **Frete Valor**: ICMS, Outros, Pedágio, Gris, Diária, Seguro, Seg. Aduaneiro, Total do Serviço, Total Prestação. **Base de Cálculo**: os mesmos, menos o ICMS. **Total Serviço**: ICMS, Outros, Pedágio, Gris, Diária, Seguro, Seg. Aduaneiro, Total Prestação. **Total Prestação**: ICMS, Outros, Pedágio, Gris, Diária, Seguro, Seg. Aduaneiro, Total do Serviço (33 opções ao todo; o "Somar ICMS no Total Prestação" é a opção que já existia no grupo do ICMS e só passou a aparecer aqui).
     - Não existe somar um campo nele mesmo (Total do Serviço no Total Serviço, Total Prestação no Total Prestação): dobraria o valor. Dá para marcar quantas quiser ao mesmo tempo.
     - Cada uma soma o campo **dentro da conta que a regra já faz do campo de destino** (`_aplicarSomaEmCampo`, em `tutorial-regras.js`): se o destino tem mais de uma definição (ex.: Frete Valor com e sem frete mínimo) o termo entra em **todas**; definições que valem só um número fixo (ex.: "se alíquota = 0, base = 0") ficam como estão; se o campo já tem o termo, não duplica.
     - Se a regra montada **não calcula** o campo de destino (ex.: sem regra base), a opção **não inventa** uma definição: a faixa "Marcadas" mostra "— sem efeito: a regra não calcula Total Prestação" e o **Gerar Regra** bloqueia explicando (escolha uma regra base no passo 1, monte o campo ou desmarque).
   - **⛔ Trava do ICMS (v28.6)** — o valor do ICMS **não pode ser reduzido**: a SEFAZ rejeita o Ct-e quando ele não é igual a Base de Cálculo × Alíquota. Quem quer pagar menos ICMS reduz a **Base de Cálculo** (opção **Redução Base de cálculo?**). Só vale nesta versão:
     - o grupo **Cálculo do ICMS** e a caixa da IA trazem o recado;
     - pedido escrito para a IA como "reduzir o ICMS em 20%", "desconto no valor do ICMS", "abater do ICMS"… é detectado enquanto se digita (aviso vermelho embaixo da caixa) e **bloqueia o Gerar Regra** sem chamar a IA. Não bloqueia "reduzir a base de cálculo do ICMS", "reduzir o frete", nem frases com "não/sem";
     - uma **faixa vermelha no topo** (em qualquer tela) aparece enquanto a regra montada — vinda de regra colada, regra base editada ou da montagem manual — definir o `valorICMS` com conta diferente de `baseCalculo * (aliquota/100)`; enquanto ela existir, **Gerar Regra** e **Gerar Regra Montada** ficam bloqueados (a conta é conferida com números de teste, sem `eval`; `def("valorICMS", 0)` é aceito, e expressões que a trava não consegue interpretar, como `Math.round(...)`, não bloqueiam);
     - o pedido enviado à IA leva uma **regra obrigatória** (nunca alterar o valorICMS; reduzir só a base) e, se mesmo assim a IA devolver uma regra assim, o cartão abre com um **alerta em cima**.
   - **🔁 Trava de loop (v28.7)** — nenhuma regra com **loop** é entregue. Loop = campos que precisam do valor um do outro para serem calculados, ex.: `def("valorFrete", … obt("totalPrestacao") …)` numa linha e `def("totalPrestacao", … obt("valorFrete") …)` em outra (ou um ciclo maior: A usa B, B usa C, C usa A). A conta nunca fecha e o valor muda a cada recálculo. Só vale nesta versão:
     - cada `def("A", conta)` depende dos campos lidos com `obt()` na conta **e** na condição do `if` que o controla (variáveis simples como `valor = obt("x")…; def("y", valor)` são seguidas). Um campo ler o **próprio** valor (ex.: frete mínimo) **não** é loop; tabelaPrecos.* e `$V(...)` não contam; comentários são ignorados;
     - o pedido enviado à IA manda **verificar loop antes de entregar** (tentar desfazê-lo sem mudar o pedido e, se não der, responder `LOOP DETECTADO: A -> B -> A. <causa>` em vez da regra);
     - **ao vivo**: uma **faixa laranja no topo** (em qualquer tela) mostra o caminho do loop (`Frete Valor → Total Prestação → Frete Valor`), as linhas que o formam e **qual opção marcada o causa**, enquanto a regra montada tiver loop (vem de opção marcada, regra colada/base ou montagem manual). **Gerar Regra** e **Gerar Regra Montada** ficam bloqueados e levam de volta ao **passo 3** com a explicação; a IA nem é chamada;
     - **regra devolvida pela IA com loop** (código com loop ou recusa `LOOP DETECTADO:`): a regra **não é entregue**; o assistente **reabre no passo 3 com tudo restaurado** (opções, textos, montagem) e a faixa explica a causa (um aviso também fica no chat). A faixa se fecha em "Entendi" ou ao gerar de novo.
     - exemplos de opções que formam loop com uma regra base (ela já soma frete, outros, pedágio, Gris, seguro e diária no Total Prestação): **Somar ICMS / Total Prestação / Total do Serviço no Frete Valor**, **Somar Total do Serviço no Total Prestação** e **Seguro/Gris "Em cima do total prestação"** (o Total Prestação já inclui o seguro/Gris, que passariam a depender dele). Para o seguro/Gris use "Em cima do valor frete" (ou outra base que não inclua o campo).
4. **Montagem manual** — a área de montagem de sempre (é o **mesmo HTML** do montador clássico: `_cteHtmlAreaMontagem()` em `tutorial-regras.js`), com o tutorial passo a passo (só os passos desta tela; abre sozinho na 1ª vez, a não ser que já tenham pedido para não mostrar).
   Se houver instruções para a IA escritas no passo 3, um aviso lembra que o **Gerar Regra Montada** não as usa e oferece o botão **Gerar com a IA**.

O **Voltar** do cartão da regra gerada (com ou sem IA) reabre o assistente **na tela em que estava e com tudo restaurado** (opções, números, filtro, textos e a montagem — inclusive o que foi arrastado à mão); se a IA falhar, o cartão de erro também traz o Voltar.
O log da ferramenta registra **"Criar Regra - Ct-e (Nova Versão)"** (o clássico segue como "Ct-e"), então dá para contar o uso de cada versão na aba **Logs/Análise**.
Arquivos (até a 28.11; **desde a 28.12.0 o `regra-cte-passos.js` guarda só a biblioteca compartilhada** — catálogo, regras prontas, travas de ICMS/loop — e as telas ficam em `regra-cte-nova.js` e `regra-cte-beta.js`): `js/app/regra-cte-passos.js` e `css/regra-passos.css` (novos; é lá que ficam os dados do "Demais opções" — `CN_SOMA_ALVOS` — e a trava do ICMS); o resto reaproveita o `tutorial-regras.js`/`assistente-regras.js` — as 4 telas existem juntas na página (só uma visível) com os mesmos ids do clássico, então colar, regras prontas, opções, arrastar e gerar são feitos pelas mesmas funções `_cte*`.

**Criar Regra › Ct-e / Conhecimento Beta (v28.8, em teste)** — a **linha de desenvolvimento** do assistente de 6 passos: a Nova Versão (28.12.0) é a **cópia estável** dele, e aqui se faz e se testa o que ainda não foi para ela, sem arriscar a Nova Versão. (Nas descrições abaixo, "Nova Versão" é a antiga de 4 telas, que o Beta tomou como ponto de partida.) Fica **oculto por padrão**: para aparecer, ligue **Personalizar › Recursos em teste (Beta) › Criador de regra Beta** (a chave é da pessoa/navegador e vai junto com as preferências da pasta do Meu Espaço; "Restaurar padrões" desliga). Ligada, o **Criar Regra** ganha um 5º botão tracejado **🧪 Ct-e / Conhecimento Beta — EM TESTE**. São **6 passos**:
1. **Regra base** — igual à Nova Versão (colar / regra pronta) **mais uma 3ª opção bem nítida, em caixa verde tracejada: ☐ "Para montar do zero clique em avançar"**. O **Avançar** começa **cinza e travado** e só libera com **uma das três** escolhas (regra colada, regra base escolhida ou a caixa marcada); clicar nele travado, ou na trilha do topo, explica o que falta e pisca a caixa. As três são alternativas: marcar "do zero" **descarta** a regra colada/base e as opções marcadas; colar ou escolher uma regra base desmarca o "do zero".
2. **Campos personalizados** — igual à Nova Versão.
3. **Cálculo do Frete Valor**, 4. **Cálculo do ICMS**, 5. **Cálculo Total Prestação** — a **mesma tela do passo 3 da Nova Versão** (filtro, "Marcadas", opções, caixa da IA, rodapé), mas cada passo mostra **só** as opções do seu cálculo: **Frete Valor** = Cálculo do Valor Frete (as 3 contas de frete — no Beta chamadas **Tarifa x peso (Tonelada)**, **Tarifa x peso (KG)** e **Tarifa x Valor Total das Notas**, que na Nova Versão e no clássico seguem como "Em cima do peso (tonelada)", "Em cima do peso (KG)" e "Em cima do valor total dos documentos" — + **Preencher manualmente**; os nomes ficam em `CB_ROTULOS`, em `regra-cte-beta.js`, e a busca ainda acha pelo nome antigo) + "Somar … no Frete Valor" (9); **ICMS** = Cálculo do ICMS (com o aviso de que o valor do ICMS não pode ser reduzido) + "Somar … na Base de Cálculo" (8); **Total Prestação** = "Somar … no Total Prestação", incluindo "Somar ICMS no Total Prestação" (**9**, a 1ª é **Somar Frete Valor no Total Prestação**: só do Beta, **já vem marcada** — ver abaixo). Na prática os 3 passos são **uma tela só** que troca de título e de painel: o filtro zera a cada passo, a caixa da IA é uma só (o texto vale para os três) e **o que foi marcado em um passo continua marcado nos outros** (a faixa "Marcadas" mostra tudo). O rodapé dos passos 3 e 4 tem **◀ Voltar · [☐ Desejo fazer a montagem manual… + Avançar para montagem manual] · Próximo: <cálculo seguinte> ▶ · ✨ Gerar Regra**; o 5 não tem o "Próximo". **Gerar Regra** gera com o que foi marcado/escrito em qualquer passo.
6. **Montagem manual** — a área de montagem de sempre. A trava (caixa "Desejo fazer a montagem manual da regra"), o aviso de opção sem número/"sem efeito", a **trava do ICMS** e a **trava de loop** são as da Nova Versão; só muda **para onde a pessoa volta**: opção sem número ou "sem efeito" → ao passo da opção; loop → ao passo da opção que o causa (ou ao Frete Valor, se não for por opção); texto da IA pedindo reduzir o ICMS → fica no passo de cálculo atual.
**Somar Frete Valor no Total Prestação (v28.9, só do Beta)** — vem **marcada por padrão** ao abrir o Beta e ao marcar "do zero" (regra montada do zero). **Com uma regra colada ou uma regra base escolhida (v28.10) ela NÃO é marcada nem aplicada sozinha**: vale o "marcar conforme a regra" descrito logo abaixo (fica marcada só se o Total Prestação da regra já soma o frete). Se a pessoa a **desmarcar de propósito** (na caixinha, no ✕ da faixa "Marcadas" ou em "Desmarcar todas"), ela não é marcada de novo sozinha; marcar de novo desfaz isso, e o "Voltar" do cartão gerado lembra a escolha. Diferente das outras contas "Somar", esta **cria** o Total Prestação (`def("totalPrestacao", obt('valorFrete'))`) quando nenhuma linha da regra o define — é o que deixa as demais contas "Somar … no Total Prestação" terem onde entrar numa regra montada **do zero**. Com uma regra base/colada que já soma o frete no total ela vem marcada e nada muda; numa regra colada cujo Total Prestação **não** soma o frete ela vem **desmarcada** e a regra não é tocada (marcar acrescenta o `obt('valorFrete')`; desmarcar tira). Se o Total Prestação estiver dentro de um `if/else` da regra colada, ela fica "sem efeito" — aviso na faixa "Marcadas", mas **não bloqueia** o Gerar (não foi escolha da pessoa). A opção é aplicada **antes** das outras contas "Somar" (`_cteGruposOpcoes`: grupos do clássico → `CB_OPCOES_EXTRAS` → `CN_OPCOES_DEMAIS`).
**Base de Cálculo: Frete Valor × Total Prestação e o atalho "Somar ICMS" (v28.11, só do Beta, passo 4)** —
(1) **"Somar Frete Valor na Base de Cálculo"** (1ª da caixa "Somar na Base de Cálculo", `CB_ITEM_FRETE_BASE`): é **derivada da regra** — vem marcada quando a Base de Cálculo montada usa o Frete Valor, seja numa **regra colada**, numa **regra base** ou ao escolher um **cálculo padrão** (ICMS Demonstrativo, Cálculo Inverso, Redução da base, que calculam em cima do frete) — e desmarca sozinha quando a base deixa de usar o frete (`_cbSincronizar`, chamada a cada atualização da faixa "Marcadas"). A caixa "Somar na Base de Cálculo" **abre sozinha** quando ela é marcada e fecha de volta quando o frete sai. Como o frete faz parte do cálculo escolhido, **não dá para desmarcá-la nem fechar a caixa enquanto um desses cálculos estiver marcado** (aparece o aviso explicando; para tirar o frete da base: desmarque o cálculo ou marque "Somar Total Prestação na Base"). Numa base colada em que o frete é só uma parcela somada (`frete + outros`), desmarcar tira o frete da regra (e marcar devolve exatamente). Marcar sem nenhuma base montada não faz nada e avisa para escolher antes um cálculo de ICMS. Ela só **entra na regra** (o motor só a aplica) quando **a própria pessoa a marca**: marcada sozinha (pela regra ou por um cálculo) ela só reflete a base — assim, ao tirar o cálculo, o frete não fica "grudado" numa base que não o tinha; "Desmarcar todas" e "tirar o frete" valem até a pessoa marcá-la de novo ou escolher um cálculo que traz o frete.
(2) **"Somar Total Prestação na Base de Cálculo" × "Somar Frete Valor na Base"** são **exclusivas** (mesmo grupo): marcar uma desmarca a outra. E marcar o **total** **tira o frete da base de verdade** — o Total Prestação já inclui o frete, então não pode somar os dois: o frete somado sai da conta (`frete + outros` → `outros + total`), e o frete **dentro do cálculo** (Demonstrativo: `frete` → `total`; Inverso: `frete ÷ (100 − alíq.)` → `total ÷ (100 − alíq.)`; Redução: `frete × (100 − X) ÷ 100` → `total × (100 − X) ÷ 100`) é **trocado** pelo total, sem acrescentar o total uma 2ª vez (gancho `aposAplicar` do motor das opções → `_cbAposAplicar`). Desmarcar o total devolve o frete (a conta volta a ser exatamente a de antes). Uma regra colada cuja base já soma frete **e** total (o frete entra duas vezes na regra do cliente) é lida como "total" e o passo 1 avisa a duplicidade — a regra não é alterada sozinha.
(3) **"Somar ICMS"** (logo depois de ICMS Demonstrativo e Cálculo Inverso, v28.11.1): é a **terceira escolha de cálculo do ICMS** — **Demonstrativo, Cálculo Inverso e Somar ICMS são exclusivas** (marcar uma desmarca as outras; mesmo grupo). Marcado, o "Somar ICMS" **preenche a regra** com o cálculo da base e do `valorICMS` do Demonstrativo (`aliquota == 0 → baseCalculo 0`; `aliquota > 0 → baseCalculo = valorFrete`; `valorICMS = base × alíquota`) **e** marca "Somar ICMS no Total Prestação" (passo 5, `icms_somar`; a caixa "Somar no Total Prestação" abre) — é a regra base "SOMAR ICMS" como opção (`CB_ITEM_SOMAR_ICMS`, que usa o código do Demonstrativo; `_cteGruposOpcoes()` o põe na ordem certa, antes do ICMS no total). Trocar "Somar ICMS" por Demonstrativo/Inverso tira o ICMS do total (era dele). As duas pontas combinam sozinhas (`_cbSincronizar`): com "Somar ICMS" marcado, desmarcar "Somar ICMS no Total Prestação" (passo 5) o transforma em Demonstrativo (a regra é a mesma), e marcar o ICMS no total com o Demonstrativo marcado o transforma em "Somar ICMS". Numa regra colada/base que já tem o cálculo do Demonstrativo **e** o ICMS somado no total, quem vem marcada é "Somar ICMS" (as regras base "ICMS DEMONSTRATIVO" e "CÁLCULO INVERSO" marcam o respectivo cálculo). Cálculo Inverso + ICMS no total (passo 5) continua possível (o ICMS no total é uma caixa do passo 5; "Somar ICMS" é o atalho do par Demonstrativo + total). Detalhes: o ✕ da faixa "Marcadas" em "Somar ICMS" tira o cálculo **e** o ICMS do total (igual a desmarcar a caixinha); cada troca automática entre as três escolhas mostra um aviso ("Somar ICMS virou ICMS Demonstrativo…", "Somar ICMS no Total Prestação saiu do total…"); numa regra **sem** bloco de ICMS o cálculo entra **antes** do Total Prestação (que soma o `valorICMS`; do zero e nas regras base já era assim); se o Total Prestação do cliente já vem **antes** do cálculo do ICMS, avisa (na execução ele leria o ICMS ainda não calculado: mover na montagem manual); numa regra que **não calcula** o Total Prestação o "ICMS no total" fica **"sem efeito"** (e trava o Gerar) em vez de criar um total só com o ICMS; marcar "Somar Total Prestação na Base" junto com o ICMS somado no total cria um **loop** (base → total → ICMS → base) e a mensagem diz isso; e "ICMS Demonstrativo" ⇄ "Somar ICMS" contam como a **mesma parte** da regra colada nos avisos de "tirei da regra" e na confirmação de "Desmarcar todas".
(4) **Identificação mais completa**: um cálculo que tem **soma por cima** agora também é reconhecido (`_cbCasaBloco`): ex.: `Tarifa x peso (KG) + Outros`, Redução + Outros, Cálculo Inverso + Seguro na base — antes só era reconhecido o cálculo "puro". Desmarcar um cálculo assim tira a conta inteira (as somas que estavam nela saem junto; as caixas "Somar …" ficam "sem efeito" até haver o cálculo de novo). Além disso `_aplicarSomaEmCampo` (compartilhado) não reformata mais a conta quando o termo já está nela.

**Marcar conforme a regra (v28.10, só do Beta)** — ao **colar uma regra** ou **escolher uma regra base**, as caixinhas dos passos 3 a 5 já vêm **marcadas conforme o que a regra JÁ tem** (ex.: "Somar Gris no Total Prestação" só vem marcada se o Total Prestação da regra já soma o Gris; "Tarifa x peso (Tonelada)" só se o frete da regra é exatamente esse cálculo; a redução da Base de Cálculo vem com o número da regra), para ninguém **editar sem querer**: marcar assim **não mexe na regra** — ela segue exatamente como foi colada (o aviso do passo 1 diz quantas foram marcadas). A leitura (`_cbPresente`/`_cbDetectar`, em `regra-cte-beta.js`) é **conservadora**: só marca quando a regra tem **exatamente** o que a opção poria (mesmo campo, mesma conta, mesma condição; espaços, aspas e parênteses de fora não contam); na dúvida, não marca. "Preencher manualmente" não é lido da regra (é uma escolha da pessoa). Depois as caixinhas funcionam **nos dois sentidos** (gancho `prepararBase` do assistente, chamado por `_cteAplicarOpcionais`): **desmarcar** uma que veio da regra **tira da regra o que ela fazia** (a soma sai da conta; o cálculo sai com as linhas dele — avisa "Tirei da regra o que … fazia") e **marcar de novo devolve exatamente o que era** (a conta sempre parte da regra como entrou, nunca do resultado já mexido); **marcar outra** do mesmo campo (outro jeito de calcular o frete/ICMS) **troca no lugar**, sem mudar a ordem da regra. Para não perder a regra sem querer, **"Desmarcar todas"** e **fechar uma caixa "Somar no …"** que tenha contas vindas da regra **perguntam antes** (confirmação). O "Voltar" do cartão gerado guarda quais caixinhas estavam marcadas e se a regra veio de fora. Sem regra de fora (montada do zero) nada disso se aplica: vale a opção padrão acima. Detalhes: (a) ao escolher uma **regra base**, a caixa de colar passa a mostrar a **regra como ela está** (as 3 bases têm o mesmo código cru; "inverso" e "somar ICMS" vêm das opções já aplicadas) — assim a 1ª tecla digitada ali não troca a regra; (b) as caixas "Somar no …" voltam a ficar **fechadas** depois de colar/escolher, exceto as que têm conta marcada; (c) "desmarquei a opção padrão de propósito" só vale no "do zero" (numa regra de fora, desmarcá-la é tirar uma parte daquela regra e não vale para a próxima); (d) se uma opção marcada troca os mesmos campos de uma que veio da regra (ex.: marcar "Inverso" numa regra que tinha a redução da base), a que veio da regra é aplicada de novo por cima, na ordem de sempre (redução sobre o Inverso). (e) uma opção "Somar X no Y" marcada que **não soma nada** porque a conta de Y já usa X subtraindo/multiplicando/dividindo (ou como 1º termo de uma conta que continua com subtração) aparece na faixa "Marcadas" como "sem efeito: já aparece na conta de Y sem ser somado" e **trava o Gerar** (antes o clique não fazia nada, em silêncio); um campo que a conta soma E subtrai (`+ Gris - Gris`) não é lido como "somado"; (f) ao tirar da regra um campo inteiro (ex.: desmarcar as contas que sobravam no Total Prestação), as **linhas extras com código** ligadas a ele ficam antes do próximo campo que sobrou (não pulam para o fim da regra) e os comentários que só descreviam o que saiu saem junto. **Leitor de regras (compartilhado, v28.10)**: duas correções que valem para todos os criadores — uma variável com o mesmo nome de um campo (`var valorICMS = …; def("valorICMS", valorICMS)`) não corrompe mais o `obt("valorICMS")`, e `if (c) def(...)` numa linha só **sem** ponto e vírgula não vira condição com lixo (segue como "linha extra"). **Limitações**: mexer na **montagem manual** (passo 6) e depois marcar/desmarcar uma opção refaz a regra a partir da base e descarta essas edições manuais (já era assim); regras com `if (...) def(...)` numa linha só, ou com o campo dentro de `if/else`, ficam como "linha extra" e não são lidas; `def(` escrito em várias linhas também não é lido (nada é marcado). **Pendentes (leitor de regras, antigos, tarefa à parte)**: variável reatribuída dentro de um bloco (`peso = …; for (…) { peso = peso - … }`) perde a declaração ao colar; `if/else` sem chaves vira código inválido ao colar; `def()` em várias linhas vira "linha extra". Nova Versão e clássico não mudam (o gancho só existe no Beta).
**Preencher manualmente (v28.9.1, só do Beta, no Cálculo do Frete Valor)** — a pessoa vai digitar o Frete Valor na própria tela do Ct-e, então a regra **não calcula o frete**. É uma opção marcável que **não coloca nada na regra**; fica no mesmo grupo das contas de frete (em tonelada / em KG / em valor dos documentos), então é **exclusiva** com elas (marcar uma desmarca a outra). Na faixa "Marcadas" aparece como "Frete Valor: preencher manualmente" e, se houver pedido para a IA, o pedido leva o aviso "não adicione nenhum cálculo novo de valorFrete" (`dicasIA` do assistente). Atenção: com o frete preenchido à mão, as contas "Somar … no Frete Valor" ficam "sem efeito" (não há cálculo de frete onde somar). Código: `modo:'nada'` em `_cteAplicarOpcionais` (`tutorial-regras.js`), `CB_ITEM_FRETE_MANUAL` em `regra-cte-beta.js`.
**Caixas "Somar no …" (v28.9.1, só do Beta)** — nos três passos de cálculo, as contas prontas "Somar X no <campo>" ficam atrás de uma **caixa de marcação** com o nome do bloco ("Somar no Frete Valor", "Somar na Base de Cálculo", "Somar no Total Prestação"): **só aparecem com a caixa marcada**. Desmarcar a caixa fecha o bloco e **desmarca as contas que estavam marcadas lá dentro** (avisa quantas) — conta escondida não pode continuar valendo na regra; conta marcada nunca fica escondida (a caixa se abre sozinha, por exemplo com a regra base "SOMAR ICMS", que já marca "Somar ICMS no Total Prestação"). A caixa do **Total Prestação nasce marcada** (por causa da opção padrão "Somar Frete Valor no Total Prestação", que fica visível e marcada dentro dela); desmarcá-la tira essa opção e **marcar de novo a traz de volta**. **A busca abre a caixa sozinha (v28.10)**: ao digitar algo no filtro, a caixa "Somar no …" do passo que tiver conta combinando **é marcada/aberta na hora e já mostra o resultado** (a linha da caixa diz "aberta pela busca — N conta(s) combina(m)"), para ninguém achar que "não existe" só porque a conta estava dentro de uma caixa fechada. Quando a busca muda para algo que não combina mais (ou é apagada, ou Esc), a caixa **fecha de volta** — a não ser que a pessoa tenha marcado uma conta dentro dela (aí fica aberta). Se a pessoa **fechar a caixa à mão** enquanto a mesma busca está escrita, ela não reabre até a busca mudar. Abrir pela busca **não** traz de volta a opção padrão do Total Prestação (só abrir a caixa pelo clique faz isso). Código: início de `_cbFiltrar` (`data-auto` / `data-nao-abrir` na `.cb-sub-recolhivel`). A escala do anti-scroll **não muda** ao pesquisar: `_cbAjustar` mede a caixa aberta pela busca como fechada e depois confere o estado real, baixando a escala só se estourar. O "Voltar" lembra quais caixas estavam abertas. Como as caixas começam fechadas, os passos de Frete e ICMS ficam mais leves (o anti-scroll usa escala maior).
**Layout anti-scroll (v28.9, só do Beta)** — os campos de cada passo ficam **todos visíveis na tela, sem barra de rolagem, em qualquer resolução** (testado de 1024×650 a 2560×1300). Como funciona: a tela de cada passo é diagramada em colunas (as opções, os campos montados e a prévia da regra ganham colunas conforme a largura) e `_cbAjustar()` (em `regra-cte-beta.js`) a **encolhe com `transform: scale()` só o necessário** para caber na área do corpo (busca da maior escala em que nada estoura), refazendo o cálculo ao abrir o passo, redimensionar a janela, abrir/fechar uma faixa de aviso, marcar uma opção ou mexer na montagem. Em monitores grandes a escala fica em 1 (tamanho natural); num notebook 1366×768 os passos usam de 0,85 a 1 e a montagem com uma regra base completa, cerca de 0,7. A escala **não muda enquanto a pessoa digita no filtro** (a medição considera todas as opções; **v28.10 corrigiu um bug** em que, ao digitar uma busca que achava contas dentro das caixas "Somar" — ex.: "somar", "pedágio" —, o texto "Mostrando 0 de 4 opções (+9 na caixa “Somar”)" estourava a largura da linha do filtro e a tela encolhia até o mínimo, "como um zoom negativo"; e uma busca sem resultado também encolhia o passo 5: a linha do filtro agora é flexível e a medição trata a caixa "Somar" como bloco e ignora a mensagem "Nenhuma opção encontrada") e a mensagem do rodapé flutua em cima dele (não empurra a tela). **Rolagem só aparece quando nem a escala mínima cabe** (`CB_ESCALA_MIN`, 0,58 — janela minúscula ou zoom alto do navegador). Atenção: o ajuste também compensa o zoom moderado do navegador (a tela é reencaixada em vez de rolar) até esse mínimo. Tudo é escopado em `.cb-anti` (`css/regra-passos.css`): a Nova Versão e o clássico não mudam.
Ficam **fora do Beta por enquanto** (não são de nenhum dos passos pedidos): Fração do Pedágio, Seguro (%), Gris (%) e "Somar … no Total Serviço" — e, como a Nova Versão de hoje é a cópia do Beta, eles também não estão nela (continuam no Ct-e clássico). O log registra **"Criar Regra - Ct-e (Beta)"**; o "Voltar" do cartão gerado volta ao mesmo passo com tudo restaurado.
Arquivos: `js/app/regra-cte-beta.js` (prefixo `_cb`/`CB_`, ids `wCteBeta*`, `wizardRegraBetaCard`) e o bloco `.cb-*` de `css/regra-passos.css` (o resto reaproveita as classes `.cn-*`); a Nova Versão (28.12.0) é `js/app/regra-cte-nova.js` (prefixo `_nv`/`NV_`, ids `wCteNova*`, `wizardRegraNovaCard`) e o bloco `.nv-*` no fim do mesmo CSS. **Compartilhado com a Nova Versão**: o catálogo de opções (`CN_BUSCA`, `CN_SOMA_*`, `CN_OPCOES_DEMAIS`, aplicado por `_cteGruposOpcoes()`), as regras prontas, os textos do prompt (`CN_PROMPT_REGRA`) e os analisadores puros (loop, ICMS). O código comum de gerar/"Voltar" (`tutorial-regras.js`) agora consulta `window.CTE_ASSISTENTES` (`_cteAssistenteAtivo()`), onde Nova Versão e Beta se registram com a mesma interface — um próximo assistente em telas entra do mesmo jeito. Cada assistente traz no registro as **suas** opções extras (`opcoesExtras`, `grupoApos`) e o motor (`_cteGruposOpcoes()`) usa as do assistente aberto (`window._cteAssistenteAberto` vale enquanto o cartão ainda não está na tela), então Nova Versão e Beta coexistem sem se misturar.

**Promover do Beta para a Nova Versão (v28.12.0)** — a Nova Versão (`js/app/regra-cte-nova.js` + o bloco `.nv-*` no fim de `css/regra-passos.css`) é uma **cópia do Beta com outros nomes** (`_cb…`/`CB_…`/`cb-…`/`cb_…` → `_nv…`/`NV_…`/`nv-…`/`nv_…`; `wCteBeta…` → `wCteNova…`; `'cte-beta'` → `'cte-nova'`). Fluxo:
1. **Mexa só no Beta** e teste (ligue o Beta em Personalizar › Recursos em teste).
2. Para levar ao ar, peça "promova X para a Nova Versão". Rode `node tools/gerar-nova-do-beta.js` — **sem argumentos não escreve nada**: lista, linha a linha, o que o Beta tem de diferente da Nova Versão (`-` = só no Beta, ainda não promovido) — e leve as mudanças escolhidas para `regra-cte-nova.js` e para o bloco `.nv-` do CSS.
3. Para promover **tudo** de uma vez: `node tools/gerar-nova-do-beta.js --escrever` (**sobrescreve** a Nova Versão e o bloco `.nv-`). `--checar` só confere a sintaxe e se sobrou algum nome do Beta. Sem Node instalado, o Electron do VS Code serve (`ELECTRON_RUN_AS_NODE=1`).
4. Suba a versão (`toolsatualizar-versao.ps1`) e publique a pasta inteira.

Cuidados: o `regra-cte-passos.js` (catálogo, regras prontas, travas de ICMS/loop), o motor (`tutorial-regras.js` / `assistente-regras.js`) e as classes `.cn-*` do CSS são **compartilhados** — mexer neles muda Beta **e** Nova Versão ao mesmo tempo (não dá para "promover aos poucos" o que mora lá). Função/constante nova no Beta deve usar o prefixo `_cb`/`CB_` (o gerador renomeia); texto "Beta" solto em comentário ou tela é ajustado pela tabela do gerador (ele avisa se alguma troca deixar de existir).

**Lateral — Blog e Repositório ocultos por padrão (v28.5):** os atalhos **Blog** e **Repositório** deixaram de aparecer na barra lateral (e no botão **+**), para as demais opções caberem sem rolar. Quem já usava o sistema também recebe a mudança
**uma única vez** (marcador `railDefaults` nas preferências, que acompanham a pasta do Meu Espaço); depois disso vale o que a pessoa escolher em **Ajustes › Ferramentas visíveis** — é só clicar em **Blog**/**Repositório** ali para trazê-los de volta
(**Restaurar padrões** volta a ocultá-los). Ocultos, ainda dá para abri-los digitando no **Ctrl K** (aparecem com a marca "oculta"). Para mudar o padrão no código: `HIDDEN_DEFAULT` em `js/ui/preferencias.js` (e some 1 em `RAIL_DEFAULTS` para a mudança chegar de novo a quem já tem preferências salvas).

**Registro (log) — como funciona:**
- **Toda pergunta feita no chat gera a sua própria linha de log — a 1ª da conversa e também as seguintes** (desde a v28.3). É isso que faz o log contar 100% do uso:
  cada pergunta tem a sua resposta (`fonte` = `ia` ou `rapida`, `modelo`), vai para a **Revisão** como qualquer outra e recebe o **seu** 👍/👎 (o botão de cada resposta
  vale para a pergunta daquela resposta, mesmo que a pessoa já tenha feito outras depois).
- **O que conta:** perguntas digitadas (ou clicadas em "Em alta"/sugestões), "Tentar novamente" e "Pesquisar com a IA" depois de uma resposta rápida (a IA foi chamada de novo: vira
  mais uma linha, e a da resposta rápida fica com o 👎 automático). **O que não conta:** saudações/agradecimentos/despedidas ("oi", "obrigado", "tchau"), que o sistema responde na
  hora sem IA; as perguntas da **Agenda** (ficam só no computador da pessoa); o **Analisar tela**; e o simulador do painel.
- Cada ferramenta tem o **seu próprio registro**, 1 por sessão da ferramenta (gravado na primeira consulta de verdade, não ao abrir a aba), com a coluna
  `fonte = 'ferramenta'`. No painel (**Logs**) aparece como **🧰 Ferramenta** e dá para filtrar. O 👍/👎 dentro da ferramenta vai para o registro dela.
- Se você digitar no chat "criar regra…" ou "assistente de relatórios…", o chat registra a pergunta e **abre a ferramenta
- **Assistente de Relatórios — o quadro inteiro da coluna recebe o campo (v28.15.1):** ao arrastar um campo, soltar **em cima do nome da coluna** (ou em qualquer parte do quadro da coluna) agora coloca o campo na área azul, igual a soltar nela; antes o texto do campo caía dentro do nome da coluna. A área azul ganha destaque enquanto o campo está por cima. Texto arrastado de fora (não do assistente) solto no nome da coluna continua sendo digitado nele. Código: `_relDropZoneDragOver/DragLeave/Drop` em `js/app/assistente-relatorios.js` (os eventos ficam no quadro da coluna, não mais só na área azul).
  na aba reaproveitando esse mesmo registro** (sem duplicar).
- No Copilot (janela flutuante) e no simulador não existem abas: lá as ferramentas continuam funcionando dentro do chat (e registram 1 vez por conversa, como antes).
- Atenção ao ler os números: o total de linhas do log agora é o total de **perguntas**, não de conversas (antes era quase 1 por conversa). Perguntas de continuação
  ("e para o MDF-e?") entram como qualquer outra — na Revisão, confira o contexto antes de aprovar como resposta rápida.
- **Histórico antigo:** as linhas gravadas antes da v28.3 só têm a 1ª pergunta de cada conversa (as seguintes nunca foram gravadas e não dá para recuperar). Para declarar o
  uso com 100% de precisão, conte **a partir do dia em que a v28.3 foi publicada** (anote essa data). Se a IA falhar, a pergunta continua registrada como uma linha **sem resposta**
  (uso tentado); para contar só as respostas entregues pela IA, use as linhas com `fonte = 'ia'`.

---

## Agenda (tarefas, cronograma e lembretes)

A **Agenda** é uma **aba própria** (ícone **Agenda** na barra lateral, botão **+**, `Ctrl K` ou o botão **Agenda** do Meu Espaço),
para organizar tarefas e responsabilidades. Ela abre em uma nova guia, então dá para alternar com o chat sem perder a conversa — ou ver as duas lado a lado (tela dividida).
Em **Personalizar › Abas e atalhos › Ao abrir o sistema** dá para escolher abrir direto nela.

**O que tem na Agenda**
- **Calendário** (mês), **Lista** (atrasadas, hoje, próximos dias, sem data, concluídas) e **Cronograma** (barras no tempo, agrupadas por **responsável**; 2, 4 ou 8 semanas).
- Cada tarefa tem: título, **data de início e de término**, **horário**, **responsável**, prioridade, situação (a fazer / em andamento / concluída), **lembrete**
  (na hora, 5/15/30 min, 1 h ou 1 dia antes), **repetição** (todo dia, dias úteis, toda semana, todo mês), detalhes e etiquetas.
- Campo rápido no painel do dia: escreva `Ligar para o cliente amanhã 14h @João !alta #sefaz` e a agenda separa data, horário, responsável, prioridade e etiqueta.
- Clicar num dia do calendário mostra as tarefas dele; **Mostrar no chat** traz essas tarefas para a conversa. No chat, *"abrir a agenda"* abre a aba.

**Sincronização com o chat** (tudo local — o cartão aparece só na tela):
- Pergunte no chat: *"quais tarefas tenho hoje?"*, *"o que tenho amanhã?"*, *"minha agenda"*, *"tarefas atrasadas"*, *"tarefas desta semana"*, *"tarefas do dia 15/10"*,
  *"o que a Maria tem hoje?"*. Para criar: `tarefa: ligar para o cliente amanhã 14h @João`.
- Essas mensagens **não vão para a IA, não entram no histórico/contexto da conversa, não geram log e não usam a rede**.
  Perguntas de suporte do tipo *"como criar uma tarefa agendada no sistema?"* continuam indo normalmente para a IA.

**Lembretes**
- Ao abrir o sistema aparece o **quadro do dia** (tarefas atrasadas, de hoje e um resumo dos próximos dias) com *Concluir*, *Adiar* e *Abrir*.
  Em **Personalizar › Agenda e lembretes** dá para escolher: sempre, uma vez por dia ou nunca.
- Na hora da tarefa (ou às 08:00, se não tiver horário) aparece um aviso no canto da tela; opcionalmente também como notificação do navegador e com um som.
  **Os lembretes só funcionam com o sistema aberto** — uma página da web não consegue avisar quando está fechada.
- A bolinha no ícone da **Agenda** (e no botão Agenda do Meu Espaço) mostra quantas tarefas estão atrasadas ou são de hoje.

**Privacidade (LGPD):** as tarefas ficam **na mesma pasta local das anotações** (`meu-espaco.json`, mais os backups diários) que você escolhe no chip da pasta (na Agenda ou no Meu Espaço — é a mesma pasta e o mesmo aviso nas duas abas).
Nada é enviado ao Supabase, à IA ou a qualquer servidor — nem pelo chat. Quem trocar de navegador/computador escolhe a mesma pasta e as tarefas voltam.
O backup (**Exportar backup**) inclui as tarefas.

---

## Latitude e longitude no chat (v28.13)

Digite no chat o pedido com o endereço, por exemplo:

```
latitude e longitude de AC ALTO PARAISO, 10 10, CENTRO — ALTO PARAÍSO - PR
```

O endereço no formato do Bsoft (`RUA, NÚMERO, BAIRRO — CIDADE - UF`) também funciona **sozinho**, sem as palavras "latitude e longitude". Outros jeitos aceitos: `coordenadas de Av. Brasil, 1000, Zona 01, Maringá - PR`, `lat/long de Rua XV de Novembro, Centro, Curitiba, PR`, `latitude e longitude de Alto Paraíso - PR` (só a cidade). A UF pode vir como `PR`, `/PR` ou o nome do estado; CEP e "Brasil" no fim são ignorados.

- **Atalho na tela inicial (v28.15):** o card **📍 Pesquisa Latitude/Longitude** (no lugar do antigo "Minha agenda", que continua no menu lateral, no `Ctrl K` e no botão do Meu Espaço) abre no chat um cartão com o campo do endereço e o botão **🔎 Pesquisar** (Enter também); daí em diante é o mesmo fluxo de quando o pedido é digitado. Clicar de novo com um cartão já esperando só leva até ele. Código: `Geo.abrirPesquisa()` e o card em `js/app/boas-vindas.js`.
- **Pergunta antes de calcular, e rota entre dois endereços (v28.14):** assim que o chat reconhece o endereço, ele mostra o endereço 1 como foi entendido e pergunta **"Deseja informar mais um endereço para calcular a distância?"**, já com o campo do **endereço 2** e o botão **▶ Executar** (Enter no campo também executa). Com o endereço 2: calcula o endereço 1, depois o 2 (cada um com a ordem de busca abaixo) e mostra as coordenadas dos dois e os links **Ver rota no Maps (Total KM Percurso)** e **Rota no OpenStreetMap** — o trajeto e os **km** só aparecem no mapa, ao abrir a rota. **De propósito o cartão não mostra nenhuma distância** (a em linha reta poderia ser usada como se fosse a real). Campo vazio + Executar, ou **"Não, só este endereço"**, calcula só o endereço 1. Nada é consultado ao serviço de mapas antes do clique (exceto, em silêncio, a conferência de uma frase solta com só "cidade - UF"). Se o endereço 2 não for entendido, o cartão avisa e o campo continua livre para corrigir; se o 2 não for achado, aparece o 1 e a explicação, sem link de rota; sem conexão no 1, o 2 nem é consultado.
- **Quem responde:** o próprio sistema, **na tela e sem IA** (a IA não consulta mapas e a regra 13 do prompt proíbe que ela invente coordenadas). A consulta vai direto do navegador para o serviço gratuito **OpenStreetMap / Nominatim** (sem chave, sem cadastro; só o endereço digitado é enviado a ele).
- **Ordem da busca** (para na primeira que achar): **1)** Rua + Bairro + Cidade + Estado → **2)** Bairro + Cidade + Estado → **3)** Cidade + Estado. Sem bairro, o passo 1 vira Rua + Cidade + Estado; sem rua, começa no 2. **O número da casa não entra na busca.** Abreviaturas (`AV`, `R`, `AC`…) são tentadas por extenso e, se não achar, do jeito digitado. **Extra (não estava no pedido original):** quando há rua **e** bairro e os passos 1 e 2 falham, antes de cair para a cidade o sistema tenta **Rua + Cidade + Estado** — a rua costuma existir no mapa mesmo quando o nome do bairro dos Correios não bate com o do OpenStreetMap (ex.: "Centro" × "Glicério" na Rua 25 de Março, São Paulo). Esse resultado vem com o aviso "o bairro informado não bateu"; para tirar esse passo extra, apague a linha `semBairro` em `tentativas()`.
- **Cada resultado é conferido antes de valer:** o estado tem que ser o informado e o município também (assim "Alto Paraíso" do Paraná não volta com o de Goiás nem com um povoado de mesmo nome em outra cidade); a rua tem que ter o nome pedido; uma rua que só existe em **outro bairro** da cidade não serve para o passo 1. Se não bate, desce para o passo seguinte. Se só existir um povoado/distrito com o nome da cidade, ou uma estação/prédio com o nome do bairro, o resultado vale só como último recurso e o cartão avisa. Nomes que o IBGE e o OSM escrevem diferente (Santana × Sant'Ana do Livramento) são tratados como iguais; rodovia pedida pelo código (`BR-376`) é achada pelo campo `ref` do mapa.
- **O cartão (enxuto, para caber sem rolar até os links):** o endereço como foi entendido **numa linha só, em fonte pequena** (Rua · Número · Bairro · Cidade · Estado por extenso), **Latitude e Longitude lado a lado**, botões de copiar (cada uma e "latitude, longitude") **com os links "Ver no OpenStreetMap" e "Abrir no Google Maps" na mesma linha** (quebram para a linha de baixo só se o chat estiver estreito), uma linha "Encontrado por … · Precisão …" (rua = ponto sobre a rua, **não** o número exato; bairro e cidade = o centro), o aviso (quando há) em fonte pequena numa linha e a atribuição do OpenStreetMap (licença ODbL). O passo a passo "Como a busca andou" foi retirado: o "Encontrado por" já diz qual das buscas achou.
- **Limites do serviço:** no máximo 1 consulta por segundo (o sistema espera entre uma e outra; no pior caso são 5 consultas ≈ 6 s) e a mesma consulta não é repetida na sessão (cache só em memória; falha não fica guardada). Cada consulta tem 12 s de limite. Sem internet, ou se o serviço limitar/falhar, o cartão diz isso — **nunca** inventa coordenadas. O OpenStreetMap tem pouca cobertura de número de casa e de bairros de cidades pequenas (ex.: o "Centro" de Alto Paraíso-PR não existe lá em 14/10/2026), por isso muitos endereços acabam no passo 3.
- **Log e privacidade:** a tabela `logs` recebe **uma linha por pedido, quando o cálculo roda (ao Executar)** — só **"Geolocalização - CIDADE/UF (rua|bairro|cidade|erro|não achou)"** ou, com dois endereços, **"Geolocalização rota - CIDADE/UF (nível) → CIDADE/UF (nível)"** (fonte "ferramenta"); quem vê a pergunta e não clica em nada não gera linha — a rua e o número **não** vão para o banco. A pergunta digitada fica no histórico local da conversa, como qualquer outra — e, como qualquer mensagem da conversa, **vai junto no histórico enviado à IA nas perguntas seguintes** (o endereço não é enviado à IA por este recurso, só pelo histórico). Não precisa de SQL.
- **Perguntas de "como fazer"** (ex.: "como preencher a latitude do cliente") **continuam indo para a IA**: só é tratado como pedido de coordenadas quando há um endereço com **cidade e UF** (ou o formato do Bsoft completo). Frases de suporte que só citam latitude/longitude e terminam em UF ("latitude errada para Londrina - PR") também seguem para a IA: palavras que não são nome de cidade barram a leitura e, quando a frase passa mas o mapa **não conhece** a "cidade", o chat volta para a IA em vez de mostrar "não encontrei". Dois endereços no mesmo pedido também vão para a IA (ela orienta a mandar um de cada vez).
- **Para mexer:** `js/app/geolocalizacao.js` (global `Geo`: `interpretar`, `buscar`, `responder`; `Geo.config.espacoMs`/`tempoMs`) e o gancho logo abaixo da Agenda no começo do `handleChat` (`js/app/chat.js`). Para trocar de provedor de mapas, só a função `consultar()` e a validação `avaliar()`.

## Pergunta vaga: botões “qual é o seu caso?” (v28.18)

Quando a pergunta pode ser sobre **mais de um assunto**, o chat não chuta: mostra botões e responde só sobre o que a pessoa escolher. Exemplo: **“preciso habilitar emissor de nf-e”** pode ser o *módulo de emissão* ou o erro *“emissor não habilitado para NF-e”*:

```
🤔 Para eu acertar a resposta: qual é o seu caso?
  [🛠️ Como habilitar o módulo emissor de NF-e]
  [⚠️ Erro emissor não habilitado para NF-e]
  [🤷 Nenhum desses — é outra coisa]
```

- **Não usa IA para decidir** (é instantâneo e não gasta a cota do provedor): aproveita os resultados da busca por significado (Jina) que o chat já faz para montar a resposta — não acrescenta nenhuma chamada de rede. Os botões são os **títulos dos artigos** do banco de dados; o ícone mostra o tipo (⚠️ erro/problema, 🛠️ “como fazer”, 📄 outro).
- **Quando pergunta** (tudo ao mesmo tempo): a busca foi por significado; a pergunta é curta (até 7 termos) e sem número/código (ex.: “rejeição 539” nunca pergunta); não parece continuação da conversa (começa com “e”, “mas”, “isso”…, ou tem até 2 termos numa conversa que já teve resposta); **nenhum** resultado — artigo, repositório, aprendizado ou resposta aprovada — chega à “certeza” (82%); há 2 a 3 artigos **de assuntos diferentes** empatados (diferença de até 4 pontos) com o primeiro; e a pergunta não é praticamente o título de um deles. Títulos quase iguais contam como um assunto só — exceto “Erro…” × “Como…”, que são assuntos diferentes. Pergunta de uma palavra só pergunta se os assuntos forem de natureza diferente (erro × como fazer).
- **Nunca pergunta** durante a chamada de voz, em “Não era o que procurava? pesquisar com a IA”, quando a busca caiu para palavra-chave, nem repete a mesma pergunta na mesma conversa. Se a pessoa digitar outra coisa sem escolher, os botões antigos são apagados. Quem não gosta liga/desliga em **Personalizar › Perguntar quando a pergunta estiver vaga**.
- **Depois do clique** a pergunta é refeita **sem repetir a bolha, o log nem o cálculo do embedding**: o artigo escolhido vai em primeiro, os outros candidatos (e as respostas aprovadas parecidas com eles) saem do prompt, e a IA recebe “o cliente confirmou que quer saber sobre: …”. **Nenhum desses** tira os candidatos e a IA pede mais detalhes (e a linha do log passa a “não encontrou” se o manual não tem mais nada).
- **Log e Revisão:** continua **uma linha por pergunta**, criada quando os botões aparecem. Depois do clique a pergunta da linha ganha o sufixo **“ [assunto: …]”** (ou “ [nenhum dos assuntos sugeridos]”), para a Revisão não transformar uma pergunta vaga em resposta rápida de um assunto só. As fontes mostram a semelhança real da busca (não os 90% do prompt).
- **Ajustar sem mexer em código:** **Admin → IA / MCP → Pergunta vaga** (liga/desliga, margem de empate 4%, certeza 82%, semelhança mínima 50%, máximo de botões 3, máximo de termos 7; vai no `config/mcp-config.js`, chave `desambiguacao`). O **Simulador** mostra, no rastro, “🤔 perguntou qual é o caso” com os assuntos e as porcentagens — use para calibrar com perguntas reais: se está perguntando demais, **diminua a margem** ou **a certeza**; se não pergunta quando deveria, aumente.
- **Para mexer:** `js/app/desambiguacao.js` (global `Desamb`: `avaliar`, `mostrar`, `escolher`, `aplicarEscolha`, `filtrarAprovadas`, `textoEsclarecimento`), o gancho no `handleChat` (depois de `rrRelacionadas`: `Desamb.avaliar`; a 2ª passada usa `opts.desambiguado`/`foco`/`descartados`/`vetor`/`logTs`), `css/desambiguacao.css`.

## Menu real do sistema: caminhos de cada tela (v28.19)

A IA agora consulta **o menu de verdade do Bsoft** (23 módulos, 83 pastas, 714 telas), copiado do próprio sistema, em vez de depender de uma lista de caminhos escrita à mão. A cada pergunta, o chat acha as telas/pastas que combinam com o que a pessoa disse e entrega à IA o caminho **completo e exato** (ex.: `Transporte > Configurações > Tabelas de Preços > Tabela de Pagamento de Frete`).

- **Onde está:** `config/menu-bsoft.js` (os dados: uma linha por pasta/tela, com o **id da rotina** de cada tela) e `js/app/menu-bsoft.js` (a busca). A busca **não usa IA**: é instantânea e não gasta cota. Se nada do menu combinar com a pergunta, a IA recebe "nenhuma tela do menu parece relacionada" e **não inventa caminho**.
- **O que a IA recebe no prompt:** o bloco **CAMINHOS DO MENU** (até 12 telas/pastas; para pastas, o que ela contém), mais os **ATALHOS E PROCEDIMENTOS** que combinam com a pergunta (nomes do dia a dia, como "Motoristas" → Pessoas > Pessoas, e passos por dentro de uma tela, como CIOT e Vale-Pedágio). Em perguntas gerais ("como é o menu?") entra também a visão dos módulos e pastas.
- **Liga com o link da tela:** o id que o menu usa em cada tela é o mesmo **Nome Interno** da tabela Rotinas. Então, quando a IA mostra o link da rotina (aquele com o campo "cole o endereço do seu sistema"), a rotina já vem com o **"Caminho no menu"** certo — sem precisar cadastrar nada no banco (o campo `BancoDados.caminho_menu` continua valendo para o que o menu não cobre).
- **O que foi conferido nos caminhos rápidos antigos (54):** 46 estavam certos; **6 estavam errados e foram corrigidos** — "Financeiro > Fiscal > Tipos de Operações" (faltava *Configurações*), "Tabela de Preços > Tabela de Preços" (o certo é *Tabelas de Preços*), "Tabela de Preços Valores Outros" (idem), "Caixas e Bancos" (o certo é *Caixa e Bancos*) em *Consulta Lançamentos* (é *Consulta de Lançamentos*) e *Transferências*, e "Comissões dos motoristas" (é *Comissionamento*); os 2 restantes (CIOT e Vale-Pedágio) são passos **dentro** da tela do CT-e e foram para `procedimentos`. A estrutura de reserva (módulos › pastas) também foi refeita pelo menu real.
- **Documentos principais:** o menu mostra mais de uma tela para alguns documentos, então a IA recebe as duas: **NFS-e** (`Transporte > Documentos > NFS-e` ou `Financeiro > Notas Fiscais > Notas Fiscais`), **MDF-e** (`Transporte > Manifesto de Carga` ou `Transporte > Documentos > MDF-e`) e **OC** (`Transporte > Ordem de Carregamento Simplificada` ou `Transporte > Ordem de Carregamento`). A **Minuta** não tem item próprio no menu (a pasta *Documentos* só tem CRT, CT-e, DC-e, MDF-e, MIC e NFS-e): a IA segue o artigo do manual. *Confirme com o time qual é qual e ajuste em `js/app/sistema-bsoft.js`.*
- **Como a busca foi testada:** sem IA, com ~480 perguntas de suporte escritas por revisores (sinônimos como *caminhão*/*carreta*, plural, erro de digitação, perguntas com duas coisas, frases longas de chat e perguntas que **não** têm tela): a tela certa foi o 1º resultado em ~95% e ficou entre os 3 primeiros em ~97%; perguntas sem tela quase nunca devolvem lixo. As frases longas ("oi, bom dia, preciso saber onde…") são o ponto mais fraco (~72% no top 3). Parte das perguntas serviu para ajustar a busca, então vale conferir com perguntas reais no **Simulador**.
- **Pegadinha que o menu mostra:** não existem níveis como "Operacional & Gestão" — as telas ficam direto no módulo (`Transporte > Veículos`). Há telas com **o mesmo nome em lugares diferentes** (ex.: *Percursos* em `Transporte > Configurações` e direto em `Transporte`); nesses casos a IA recebe os dois caminhos e cita o mais direto. O menu varia por **permissão e módulos contratados** do cliente: se ele não achar o item, a IA sugere conferir a permissão do usuário às rotinas.
- **Atualizar quando o menu mudar (1 minuto, sem Node):** abra o Bsoft no Chrome com um usuário que veja todos os módulos › `F12` › **Console** › (se pedir, digite `allow pasting`) cole o conteúdo de `tools/capturar-menu.js` e Enter — o menu inteiro vai para a área de transferência. Cole no lugar do texto de `config/menu-bsoft.js` (entre as duas crases), salve e suba no GitHub. O módulo pessoal **Minhas Rotinas** é ignorado de propósito.
- **Conferir um caminho:** no console do chat, `MenuBsoft.validarCaminho('Transporte > Veículos')` devolve `{ ok: true, tela: true, correspondente: … }`; `MenuBsoft.buscar('tabela de preços')` mostra o que a IA veria. Os caminhos escritos em `js/app/sistema-bsoft.js` são conferidos contra o menu por teste automático — ao mudar um, rode a conferência de novo.

## Resposta curta ou completa detalhada (v28.20)

Logo depois da pergunta (quando a IA vai mesmo responder), o chat mostra dois botões: **⚡ Resposta curta** e **📖 Resposta completa detalhada**. Cada um manda uma instrução diferente para a IA:

- **Curta:** a IA vai direto à solução, em no máximo 8 linhas, só com os passos essenciais (caminho de menu e nomes de campos exatos), sem saudação, introdução nem explicações. As demais regras continuam valendo (nada inventado, só o que está no manual). A instrução tem prioridade sobre a regra de "não omitir nada da solução".
- **Completa detalhada:** igual ao que o sistema sempre fez (todos os passos, com todos os detalhes) — o prompt é **idêntico** ao de antes.
- **No fim da resposta curta** há o botão **📖 Resposta completa detalhada**: um clique gera a completa logo abaixo, **sem perguntar de novo** (a pergunta não é repetida na tela nem no log, e o embedding não é recalculado). A curta continua na tela, mas sai do contexto da IA para ela não "se enxergar" respondendo curto. A resposta completa passa a ser a gravada na linha de log daquela pergunta (a Revisão vê a última).
- **Fixar o formato:** **Personalizar › Formato da resposta**: *Perguntar sempre* (padrão) · *Sempre curta* · *Sempre completa* (sem botões).
- **Quando NÃO pergunta:** chamada de voz (usa a completa), "Não era o que procurava? pesquisar com a IA", quando não achou nada no manual (a resposta é só "não encontrei"), resposta rápida aprovada pela equipe (já é instantânea) e quando a pessoa fixou o formato. Se a pergunta for vaga, primeiro vêm os botões "qual é o seu caso?" e **depois** os de formato (a escolha de assunto é mantida na completa).
- **"Tentar novamente"** (quando a IA falha) agora refaz a mesma pergunta com a mesma escolha de assunto e de formato, sem criar outra bolha nem outra linha de log.
- **Para mexer:** `js/app/formato-resposta.js` (global `Formato`: `decidir`, `textoModo` — o texto das instruções —, `mostrar`, `escolher`, `expandir`), o gancho no `handleChat` (logo antes de `_logTs`; a instrução entra no fim dos dois prompts, depois da pergunta) e `css/desambiguacao.css`. Os textos das instruções ficam em `Formato.textoModo`: dá para ajustar o tamanho da curta (hoje 8 linhas) ali.

## IA / MCP: trocar modelos e chaves

Tudo da IA fica em **um arquivo**: `config/mcp-config.js`. O fluxo é:

1. **Admin → IA / MCP**: mude o que quiser (modelo, ordem, chave, regras). **Testar** cada modelo faz uma chamada de verdade;
   **Testar no simulador** usa a configuração em edição *antes de salvar*.
2. **Salvar no arquivo** (Edge/Chrome gravam direto no `config/mcp-config.js` — escolha o arquivo só na 1ª vez).
   Em outros navegadores use **Copiar**/**Baixar** e substitua o arquivo.
3. **Suba o arquivo no GitHub** (commit + push; ou *Abrir no GitHub (editar e colar)* — o botão aparece quando o painel
   descobre o repositório ou você preenche `"repositorio"` em `admin-config.js`).
4. Pronto: o sistema **confere o arquivo logo ao abrir e a cada 2 horas** (enquanto estiver aberto — e também ao voltar para a aba)
   e passa a usar a configuração nova **sozinho**, sem recarregar a página. Só aplica quando o *conteúdo* realmente mudou.

Detalhes:

- Os modelos formam uma **cadeia**: tenta o 1º (2 tentativas); se falhar, o 2º, e assim por diante. Dá para ter um **modelo prioritário**
  de outro provedor (ex.: um pago) na frente da cadeia grátis.
- **Resposta provisória**: um modelo leve responde primeiro enquanto o principal elabora a resposta completa (pode desligar).
- **Idioma: sempre português do Brasil.** Modelos pequenos/grátis (principalmente os de código, como o North Mini no fallback) respondem em inglês quando
  ninguém pede o idioma. Por isso **toda chamada à IA** (chat, Parâmetros, regras, relatórios, resposta provisória, painel) leva a instrução
  "IDIOMA OBRIGATÓRIO: pt-BR" no começo e no fim do prompt (`js/core/mcp.js → mcpComIdioma`). Como rede de segurança, se mesmo assim a resposta sair em
  inglês, o chat **não mostra o inglês**: detecta, traduz para pt-BR e só então exibe (e é a versão traduzida que vai para o log). Se nem a tradução
  funcionar, mostra o texto com um aviso. Uma resposta provisória em inglês simplesmente não aparece.
- **Visão** (Analisar tela) e **embeddings** (busca por significado) têm lista/chave próprias. O modelo de embeddings é fixo
  (`jina-embeddings-v3`): os vetores guardados no banco foram gerados com ele.
- As chaves ficam no arquivo **divididas em pedaços** (só para não ficarem como uma linha pesquisável; **não é criptografia**).
- Se o arquivo estiver com erro de digitação, o sistema mantém a configuração anterior e avisa no console.

---

## Segurança — leia

Este sistema roda **no navegador** e é publicado como site estático. Isso traz limites que é importante conhecer:

| Assunto | Realidade | O que fazer |
|---|---|---|
| **Chaves de IA** (`mcp-config.js`) | Qualquer visitante que abrir as ferramentas do desenvolvedor consegue ver as chaves. | Use chaves **gratuitas ou com limite de gasto**; troque se vazar. A solução definitiva é uma *Edge Function* intermediando as chamadas (não incluída). |
| **Chave pública do Supabase** (`app-config.js`) | É pública por desenho do Supabase. O que protege o banco são as regras **RLS**. | Rode o `sql/03_seguranca_rls.sql` e use o **modo seguro** do painel (abaixo). |
| **Senha do painel — modo `local`** | O hash da senha fica em arquivo público. É uma proteção **básica** (esconde a tela), mas **não protege o banco**: quem entende de programação fala direto com o Supabase. | Use senha **forte (12+ caracteres)** — o hash é público e pode ser testado offline — ou o modo seguro. |
| **Vários usuários no painel — modo `local`** | As abas liberadas a cada usuário valem só na tela (e os hashes das senhas ficam no arquivo público). Evita acidentes e acesso casual; **não impede** quem entende de programação de falar direto com o banco. | Use senhas fortes (o painel gera) e libere só as abas necessárias; para proteção de verdade, o modo seguro. |
| **Painel — modo `supabase`** (recomendado) | Login no Supabase Auth + regras RLS: só o administrador consegue **gravar** no conteúdo; o app dos usuários continua lendo, registrando log e dando feedback. | Passo a passo abaixo. |
| **Texto de usuários/IA** | Tudo que vem do banco entra no painel como **texto** (nunca como HTML) e o painel tem política CSP (sem scripts embutidos). | — |
| **Logs** | Guardam o que os usuários digitaram (pode haver dado pessoal — LGPD). | Apague periodicamente (aba Logs) e **não aprove** respostas que contenham dado pessoal. |
| **Meu Espaço** | Anotações pessoais ficam **só no navegador** do usuário (sem rede, sem Supabase, sem telemetria). | Se exportar backup para pasta sincronizada (OneDrive/Google Drive), ele vai para a nuvem. |

### Ativar o modo seguro (≈ 10 minutos)

1. Supabase → **Authentication → Users → Add user**: crie o administrador (e-mail + senha forte; marque *Auto Confirm User*).
2. Supabase → **Authentication → Sign In / Providers**: **desligue** *Allow new users to sign up*.
3. Abra `sql/03_seguranca_rls.sql`, troque o e-mail na linha marcada `TROQUE AQUI`, rode o arquivo inteiro no SQL Editor
   e rode os testes comentados no final do arquivo. (Deu problema? `sql/03b_desfazer_rls.sql` volta ao estado anterior.)
4. Em `config/admin-config.js`: `"modo": "supabase"` e `"supabaseEmail": "o-email-do-passo-1"`. Suba o arquivo.
5. Entre no painel (agora com a senha **do Supabase**) e rode **Sistema → Rodar verificação**: deve aparecer "regras de segurança instaladas — você é administrador ✔".

Detalhes das regras: leitura pública de tudo; escrita só do administrador em `BancoDados`, `Parametros`, `Funcionalidades`, `Rotinas`,
`RejeicoesSEFAZ`, `StatusServicos`, `suporte_novidades`, `respostas_rapidas`; o app (anônimo) só pode gravar o **vetor** (`embedding`) na base,
inserir/atualizar `logs` e inserir/apagar `machine_learning` (como já fazia). Só o administrador apaga logs.

> ⚠️ As regras do `03` não foram testadas contra o seu banco real (não tenho acesso para rodar SQL aí). Teste fora do horário de uso,
> use os testes do arquivo e, se algo quebrar, rode o `03b`.

### O que subir no GitHub

- ✅ O **conteúdo desta pasta** (`bsoft-suporte-ia`), inclusive `.nojekyll`.
- ❌ **Não** suba a pasta de cima (`Sistema erros e soluções`): a pasta `.claude` dela contém uma chave. O `.gitignore` desta pasta já ignora `.claude/`.
- ❌ Nada de `_qa/`, backups ou planilhas com dados reais.

---

## Problemas comuns

| Sintoma | Causa provável / solução |
|---|---|
| Aba **Revisão** diz que "faltam as colunas" / **Respostas rápidas** diz que a tabela não existe | Rode `sql/02_respostas_rapidas_e_revisao.sql` (botão **Copiar o SQL** na própria tela) e clique em Atualizar. |
| Na **Revisão**, o cartão "Dados do banco usados nesta resposta" pede para rodar o SQL 04 / diz "Sem registro" | Rode `sql/04_logs_fontes_banco.sql` (botão **Copiar o SQL** no próprio cartão) e clique em **Atualizar**. As respostas novas passam a ter a lista; as antigas não têm como ganhar. |
| "O banco recusou a gravação (sem permissão)" | Você ativou o `03` mas o painel está no modo `local`. Troque para `"modo": "supabase"` (passo 4 acima) — ou rode o `03b`. |
| Login do painel: "Este endereço não permite conferir a senha" | A criptografia do navegador só funciona em **HTTPS**, `localhost` ou arquivo aberto do disco. Evite abrir por IP de rede (`http://192.168...`). |
| Esqueci a senha do painel | `admin/senha.html` (modo local; os usuários cadastrados são mantidos) ou redefinir no Supabase → Authentication (modo seguro). |
| Um usuário novo diz "Usuário ou senha incorretos" | Confira se você fez **commit + push** do `config/admin-config.js` depois de **Salvar no arquivo…** e espere ~1 min. Usuário e senha não diferenciam maiúsculas/acentos no usuário (só na senha). Se foi desativado, a tela avisa depois de acertar a senha. |
| Um usuário esqueceu a senha | Sistema → Usuários e acessos → botão **Senha** (gera uma nova) → Salvar no arquivo… → push. |
| Um usuário diz que "não tem acesso a nenhuma aba" ou não vê uma aba | Sistema → Usuários e acessos → **Editar** → marque as abas → Salvar no arquivo… → push. Ele recebe a mudança ao recarregar (ou em até 5 min). |
| No console aparece `[Continuação 1/3] Resposta truncada detectada — continuando automaticamente...` (ao gerar uma regra com a IA) | Não é erro: a IA parou no **limite de tokens** da resposta e o sistema pediu o resto sozinho (até 3 vezes). Nos geradores de regra (Ct-e clássico e Nova Versão, Contrato de Frete, Faturamento) o limite é `REGRAS_MAX_TOKENS` (8000, no começo de `js/app/assistente-regras.js`; era 3000 até a v28.5.0). Se ainda aparecer, a regra é muito grande ou o modelo escreve demais: suba o valor (no Gemini o teto é 8192) ou troque o modelo em **IA / MCP**. Desde a v28.5.1 a emenda das partes preserva o espaço/quebra de linha da divisa (antes podia colar palavras e até juntar uma linha de código num comentário `//…`). |
| Sumiram o **Blog** e o **Repositório** da lateral | É o padrão desde a v28.5. Para trazê-los de volta: **Ajustes** (ícone na base da lateral) → **Ferramentas visíveis** → clique em **Blog** e/ou **Repositório**. Também abrem pelo **Ctrl K**. |
| No **Criar Regra › Nova Versão** aparece "Não dá para reduzir o valor do ICMS…" ou uma faixa vermelha "A regra montada altera o valor do ICMS" | É a trava do ICMS (v28.6): a SEFAZ rejeita o Ct-e quando o valor do ICMS não é Base de Cálculo × Alíquota. Para pagar menos ICMS, use **Redução Base de cálculo?** (passo 3) ou peça à IA "reduzir a base de cálculo em X%". A faixa some sozinha quando a linha `def("valorICMS", …)` volta a ser `baseCalculo * (aliquota/100)` (corrija na montagem manual ou na regra colada). Para mudar a lista de frases pedidas, veja `CN_RED_RAIZ` em `js/app/regra-cte-passos.js`. |
| Na **Análise** os horários (ex.: "Horários de pico") estão 3 h adiantados em relação ao uso real | Era um erro até a v28.6.0 (o `created_at` do Supabase vem sem fuso, mas é UTC). Corrigido na v28.6.1: publique a pasta inteira e faça **Ctrl+F5** no painel (o painel guarda os arquivos em cache) e clique em **Atualizar** na aba Análise. O arquivo avulso `Análise de Logs.html` (fora do GitHub) também recebeu a correção — abra a versão nova dele. |
| No **Criar Regra › Nova Versão** aparece uma faixa laranja "Loop na regra: Frete Valor → Total Prestação → Frete Valor" e o Gerar Regra não gera | É a trava de loop (v28.7): dois ou mais campos dependem um do outro, então a conta nunca fecha. A faixa mostra o caminho, as linhas e a opção marcada que causa o loop: desmarque-a, ajuste o pedido para a IA ou corrija a regra colada/montagem manual para que um dos campos seja calculado só dos campos de origem. Se foi a IA que devolveu a regra com loop, o assistente volta ao passo 3 sozinho. A detecção está em `_cnLoopsDoCodigo` (`js/app/regra-cte-passos.js`). |
| Pedi **latitude e longitude** no chat e o cartão diz "Não foi possível consultar" | O serviço de mapas (OpenStreetMap) não respondeu: sem internet, bloqueio de rede da empresa para `nominatim.openstreetmap.org`, ou o serviço limitou as consultas (espere um minuto). Nada é inventado — tente de novo. |
| Pedi **latitude e longitude** e o cartão diz "Não encontrei" ou veio um lugar aproximado (cidade) | O OpenStreetMap não conhece aquela rua/bairro. Confira a grafia da cidade e a **UF**; o cartão mostra qual das buscas achou ("Encontrado por"). Quando só a cidade é achada, a coordenada é o centro dela. |
| Não aparece o botão **Ct-e / Conhecimento Beta** no Criar Regra | É de propósito: o Beta vem oculto. Ligue em **Personalizar › Recursos em teste (Beta) › Criador de regra Beta** (vale só neste navegador/pasta de preferências) e abra o Criar Regra de novo. |
| Marquei "Somar … no …" e a faixa "Marcadas" diz "sem efeito" | A regra montada não calcula o campo de destino (ex.: "Total Prestação"), então não há onde somar. Escolha uma **regra base** no passo 1 (ela já calcula frete, base, total prestação e total serviço) ou monte o campo na montagem manual; trocar a regra base desmarca as opções, então marque as contas de novo. |
| Mudei a IA e nada mudou para os usuários | Confirme o commit/push do `config/mcp-config.js` e aguarde ~1 min; o sistema confere ao abrir e a cada 2 h. No painel: **IA / MCP → Conferir arquivo publicado agora**. |
| Simulador fica em "carregando a base…" | A base leva alguns segundos para carregar; se passar de 1 min, clique em **Recarregar** e confira a internet. |
| Tela branca ao abrir `index.html` pelo disco | Confira se a pasta está completa (js/, css/, config/). Rode `tools/verificar-projeto.ps1`. |
| A IA responde "Todos os provedores falharam" | Modelos grátis saem do ar de vez em quando. **IA / MCP → Testar todos** mostra quais responderam; troque os que falharem. |
| Painel não grava o arquivo ("Salvar…") | Firefox/Safari não deixam o site gravar no disco: use **Copiar** ou **Baixar** e substitua `config/mcp-config.js`. |

---

## Para quem vai mexer no código

- **Ordem dos scripts** (fim do `index.html` e do `admin/index.html`): `config/*` → `js/core/*` → `js/app/*` → `js/ui/*`. Cada arquivo declara
  funções/variáveis globais; um arquivo novo precisa ser listado nos dois HTMLs que o usam (e `tools/atualizar-versao.ps1` cuida do `?v=`).
- **Criar Regra › Ct-e (assistentes em telas)**: `regra-cte-passos.js` (biblioteca compartilhada, carrega primeiro) → `regra-cte-beta.js` (desenvolvimento) → `regra-cte-nova.js` (cópia estável, **gerada do Beta** por `tools/gerar-nova-do-beta.js`; veja "Promover do Beta para a Nova Versão"). Não edite a Nova Versão à mão sem levar a mudança ao Beta.
- **IA que gera regra só usa o que está documentado (v28.15.2)**: `REGRAS_SO_O_DOCUMENTADO` (em `js/app/assistente-regras.js`, logo acima de `CONTEXTO_REGRAS`) é a "regra absoluta" que abre **todos** os prompts de geração de regra (Ct-e: clássico, montador e assistentes Nova Versão/Beta; Contrato de Frete; Faturamento; chat de regras — 7 prompts). Ela lista o que existe (`def`, `obt`, `$SV`, `$V`, `alert("texto")`, `COM_RF.composicaoFrete`, `IRRF.defineDescontoIRRF`, `tabelaPrecos.*`, JavaScript puro, `Math.*`), **proíbe inventar** função/objeto/campo (cita `msg()`, `preventSave()`, `bloquear()`… como exemplos de coisas que não existem; aviso ao usuário = só `alert`) e manda, quando o pedido exigir algo sem recurso documentado (ex.: impedir o salvamento), **não inventar**: fazer a parte possível, deixar o comentário `// ATENCAO: nao ha funcao documentada para …` no código e explicar em 1–2 frases depois do bloco. Surgiu um recurso novo no sistema? Documente-o nos `CONTEXTO_*` e, se for função/objeto, acrescente no item 1 da constante. (Caso real: "valide o peso total das notas e impeça de salvar o Ct-e" gerou `msg()` e `preventSave()`, que não existem.)
- **Link de tela (rotina) com campo + botão (v28.16)**: quando a IA indica uma tela do sistema, o link-modelo `https://NOMEDOCLIENTE.bsoft.app/versoes/versao5.0/rotinas/c.php?id=<nome interno>&menu=s` **não aparece mais como link**: no lugar entra um **campo** ("Cole aqui o endereço do seu sistema") e o botão **🔗 Acessar tela** (Enter no campo também); ele monta o link com o endereço colado e abre numa **nova guia**. Aceita `https://empresa.bsoft.app`, `empresa.bsoft.app` ou até o link de qualquer tela dela (só a origem é usada); recusa vazio, texto solto e o próprio exemplo NOMEDOCLIENTE (avisa em vermelho). O endereço fica **guardado neste navegador** (`bsoft_dominio_cliente`) e já vem preenchido nas próximas telas (e nos outros campos da página). Vale no chat, em "Analisar tela" e nas respostas rápidas (tudo que passa pelo `renderMd`, `js/core/markdown.js`) e no painel admin. Funciona com o link completo com o endereço-modelo (NOMEDOCLIENTE, SEUCLIENTE, CLIENTE, XXXX), só com o caminho `/versoes/…/rotinas/c.php?id=…` e dentro de `[texto](link)`; link com endereço **real** de cliente continua link comum. O id só aceita letras, números, `_ . -`. Para a IA copiar o link do jeito certo, `_formatarRotinaParaPrompt` (`js/app/rotinas.js`) agora entrega o link completo com NOMEDOCLIENTE e a regra 10 do prompt manda copiá-lo sem explicar como montar a URL.
- **Link de tela — ajustes (v28.16.1):** o campo do endereço agora tem **470 px** (cresce para preencher a linha) e mostra a mensagem **"Cole aqui o endereço do seu sistema (https://NOMEDOCLIENTE.bsoft.app)" inteira** (medido: precisa de ~440 px; só corta se o chat estiver mais estreito que ~460 px). E a IA passou a apresentar **também o caminho pelo menu** logo depois do link, para quem não quiser usar a ferramenta: se o caminho de menu constar **literalmente nos artigos** ela escreve "Ou pelo menu: Menu > Submenu > Tela"; se não constar **não inventa** — escreve "Ou procure pelo menu do sistema: <Nome oficial da tela>"; e se a rotina estiver marcada como fora do menu, diz que o link é o caminho para abri-la (regra 10 do `handleChat` e regra 4 do "Analisar tela", nas duas variantes). **Limite dos dados:** a coluna `Menu` da tabela `Rotinas` é só **Sim/Não** (a rotina aparece como item do menu ou não) — **não traz o caminho do menu**; por isso o caminho só aparece quando algum artigo do manual o traz. Se quiser o caminho em toda tela, o passo é incluir uma coluna com o caminho de menu na tabela `Rotinas` (SQL + preenchimento) e passá-la em `_formatarRotinaParaPrompt`.
- **Prompt do chat**: o `handleChat` (`js/app/chat.js`, variável `ps`) leva uma lista numerada de **REGRAS OBRIGATÓRIAS** para a IA. A **12** (v28.12.2) proíbe confundir **NF-e** (nota de produtos/mercadorias) com **NFS-e** (nota de serviço, da prefeitura): a IA não aplica conteúdo de um ao outro, não mistura as siglas e, se a pergunta disser só "nota fiscal" sem dar para saber qual é, pede ao cliente para informar. A regra 8 ("Diferencie: CT-e, MDF-e, NF-e, NFS-e…") continua valendo.
- **Nada de `import`, `fetch` de arquivo local nem caminho absoluto** (`/js/...`): quebram no `file://` e/ou em subpasta do GitHub Pages.
  Caminhos são sempre relativos; arquivos de configuração são `<script>` que definem `window.BSOFT_*`.
- **Painel**: cada aba é um arquivo `admin/js/aba-*.js` que chama `ADM.registrarAba({ id, titulo, icone, ordem, montar(ctx), abrir() })`.
  Monte a tela com `h('tag', {...}, filhos)` (texto sempre como texto); evite `innerHTML` com dados do banco.
- **Gráficos do painel** não usam biblioteca: `admin/js/graficos.js` (`ADM.graf.linha/colunas/rosca/ranking`) desenha em SVG/CSS com as cores do tema (claro/escuro) e respeita a CSP.
  A matemática da análise de logs fica em `admin/js/analise-core.js` (sem DOM e sem rede, reaproveitada no `Análise de Logs.html`).
- **Escritas no banco** passam por `ADM.db.exigirAfetadas(resp)`: com RLS, um `update`/`delete` barrado **não dá erro** (volta 0 linhas) — essa checagem transforma isso em erro de verdade.
- **Simulador**: `index.html?sim=1` → cliente do Supabase **somente leitura** (`js/core/supabase-client.js`) + histórico próprio descartável.
- **Atualizar a versão do Supabase JS** (o `<script>` do CDN tem verificação de integridade SRI): troque a versão na URL e recalcule o hash:
  ```powershell
  $u = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@X.Y.Z/dist/umd/supabase.js'
  $b = (Invoke-WebRequest $u -UseBasicParsing).Content
  'sha384-' + [Convert]::ToBase64String([Security.Cryptography.SHA384]::Create().ComputeHash($b))
  ```
  e atualize `integrity="..."` em `index.html` e `admin/index.html`.
- `tools/verificar-projeto.ps1` confere se todos os arquivos citados nos HTMLs existem e lista arquivos soltos.

Navegadores: Edge/Chrome recomendados (o painel grava arquivos direto e o reconhecimento de voz só existe neles).
