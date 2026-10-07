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
10. [IA / MCP: trocar modelos e chaves](#ia--mcp-trocar-modelos-e-chaves)
11. [Segurança — leia](#segurança--leia)
12. [Problemas comuns](#problemas-comuns)
13. [Para quem vai mexer no código](#para-quem-vai-mexer-no-código)

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
├─ tools/                  ← utilitários: servidor-local.bat, atualizar-versao.ps1
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

**Conferir se deu certo:** painel → aba **Sistema** → **Rodar verificação** (lista o que existe e o que falta).
Enquanto o `02` não for rodado, o sistema funciona normalmente — só não grava a resposta no log nem mostra respostas rápidas.

---

## Área Administrativa

Abra `admin/index.html` (botão **🔑** no cabeçalho do sistema). Entre com a senha e use as abas — dá para alternar entre
todas na mesma tela (`Alt+1` … `Alt+9` também trocam de aba). Tudo o que você está editando fica guardado ao trocar de aba.

| Aba | O que faz |
|---|---|
| **Revisão** | Mostra as respostas que a IA deu aos usuários. Você edita, **aprova** (vira resposta rápida), rejeita ou ignora. Agrupa perguntas iguais e sugere "perguntas parecidas" como variantes. |
| **Respostas rápidas** | Lista/edita/pausa/exclui as respostas aprovadas, mostra quantas vezes cada uma foi usada e tem um **testador**: "se alguém perguntar isto, qual resposta o sistema usaria?". |
| **Simulador** | O chat de verdade dentro do painel, **sem gravar nada** (nem log, nem feedback). Mostra de onde veio cada resposta (rápida ou IA, qual modelo, tempo). Dá para testar a configuração de IA **antes de salvar**. |
| **IA / MCP** | Edita `config/mcp-config.js`: provedor, chaves, cadeia de modelos (arrastar para ordenar, testar cada um), visão, embeddings, regras das respostas rápidas. |
| **Banco de dados** | Editor das tabelas de conteúdo (base de conhecimento, parâmetros, funcionalidades, rotinas, rejeições SEFAZ…): editar, criar, duplicar, excluir, exportar CSV. |
| **Logs** | Perguntas dos usuários, 👍/👎, motivo e **retorno do suporte**; filtros, busca, exclusão em lote, exportar CSV. A resposta só é baixada quando você abre a linha (economiza transferência). |
| **Análise** | Lê **todos os logs direto do banco** (sem importar planilha) e mostra o que alimentar na IA primeiro, a evolução no tempo — com filtros de **período, usuário, assunto e pergunta específica** —, o uso por pessoa e as perguntas que mais se repetem. Veja [Análise de logs](#análise-de-logs-aba-análise). |
| **Novidades** | Publica avisos que aparecem para todos na coluna "Novidades". |
| **Sistema** | Verificação do banco, **alterar a senha**, limpeza do cache deste navegador, informações. |

### Senha do painel

- Hoje o painel aceita a **senha antiga** do sistema (só o *hash* dela está em `config/admin-config.js`; a senha em si não aparece no arquivo).
  Um aviso amarelo pede para trocá-la — ela ficava escrita à vista no código do v26/v27, então considere-a pública.
- **Trocar:** aba **Sistema → Alterar a senha do painel** → gera o `config/admin-config.js` novo → suba no GitHub.
- **Esqueceu?** Abra `admin/senha.html`, crie uma senha nova (não precisa da antiga), substitua o arquivo e suba.
- Depois de 3 erros seguidos o login espera um pouco (5 s, 15 s, 30 s… até 5 min); a sessão encerra sozinha após 120 min parada
  (`sessaoMinutosOciosa` em `admin-config.js`).

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

- **Horário de Brasília.** A data vem de `created_at` (relógio do servidor); se faltar, da coluna `timestamp`. Um log às 23h30 aparece no próprio dia (não no seguinte).
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

**Registro (log) — como funciona:**
- A **1ª pergunta de cada conversa do chat sempre gera log.** A conversa só é marcada como "já registrada" quando o log é de fato gravado — então uma
  saudação ("oi"), um clique de atalho ou o uso de uma ferramenta **nunca** gastam o log da primeira pergunta de verdade.
- Cada ferramenta tem o **seu próprio registro**, 1 por sessão da ferramenta (gravado na primeira consulta de verdade, não ao abrir a aba), com a coluna
  `fonte = 'ferramenta'`. No painel (**Logs**) aparece como **🧰 Ferramenta** e dá para filtrar. O 👍/👎 dentro da ferramenta vai para o registro dela.
- Se você digitar no chat "criar regra…" ou "assistente de relatórios…", o chat registra a pergunta (se for a primeira da conversa) e **abre a ferramenta
  na aba reaproveitando esse mesmo registro** (sem duplicar).
- No Copilot (janela flutuante) e no simulador não existem abas: lá as ferramentas continuam funcionando dentro do chat, como antes.

---

## Agenda (tarefas, cronograma e lembretes)

A **Agenda** é uma **aba própria** (ícone **Agenda** na barra lateral, botão **+**, `Ctrl K`, atalho **Minha agenda** da tela inicial ou o botão **Agenda** do Meu Espaço),
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
| "O banco recusou a gravação (sem permissão)" | Você ativou o `03` mas o painel está no modo `local`. Troque para `"modo": "supabase"` (passo 4 acima) — ou rode o `03b`. |
| Login do painel: "Este endereço não permite conferir a senha" | A criptografia do navegador só funciona em **HTTPS**, `localhost` ou arquivo aberto do disco. Evite abrir por IP de rede (`http://192.168...`). |
| Esqueci a senha do painel | `admin/senha.html` (modo local) ou redefinir no Supabase → Authentication (modo seguro). |
| Mudei a IA e nada mudou para os usuários | Confirme o commit/push do `config/mcp-config.js` e aguarde ~1 min; o sistema confere ao abrir e a cada 2 h. No painel: **IA / MCP → Conferir arquivo publicado agora**. |
| Simulador fica em "carregando a base…" | A base leva alguns segundos para carregar; se passar de 1 min, clique em **Recarregar** e confira a internet. |
| Tela branca ao abrir `index.html` pelo disco | Confira se a pasta está completa (js/, css/, config/). Rode `tools/verificar-projeto.ps1`. |
| A IA responde "Todos os provedores falharam" | Modelos grátis saem do ar de vez em quando. **IA / MCP → Testar todos** mostra quais responderam; troque os que falharem. |
| Painel não grava o arquivo ("Salvar…") | Firefox/Safari não deixam o site gravar no disco: use **Copiar** ou **Baixar** e substitua `config/mcp-config.js`. |

---

## Para quem vai mexer no código

- **Ordem dos scripts** (fim do `index.html` e do `admin/index.html`): `config/*` → `js/core/*` → `js/app/*` → `js/ui/*`. Cada arquivo declara
  funções/variáveis globais; um arquivo novo precisa ser listado nos dois HTMLs que o usam (e `tools/atualizar-versao.ps1` cuida do `?v=`).
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
