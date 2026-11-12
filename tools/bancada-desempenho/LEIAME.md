# Bancada de desempenho (v28.38)

Mede o sistema **no Edge de verdade** (quadros por segundo, tempo da tecla até a letra aparecer, rolagem, CPU por processo, resposta da IA, fidelidade do visual), controlado por script (Chrome DevTools Protocol).
Existe porque a medida de “parado, numa máquina boa” não via o problema: foi preciso **reproduzir num computador fraco** para achar que o gargalo era a placa de vídeo (ver README, seção “Fluidez”).

## Como rodar

Não há Node instalado: os scripts rodam com o **Electron do VS Code como se fosse Node** (a saída só aparece se for enviada para `Out-String`).

```powershell
# 1) servidor do projeto (porta 8080)               → tools\servidor-local.bat
# 2) Edge de testes numa janela de verdade, no 2º monitor (ajuste -X/-Y/-Largura/-Altura ao seu)
Start-Process powershell -ArgumentList '-NoProfile','-File','tools\bancada-desempenho\edge-up.ps1'
# 3) um script (exemplo: tempo da tecla e rolagem, antes de começar escolha o cenário)
$env:ELECTRON_RUN_AS_NODE = "1"
& "$env:LOCALAPPDATA\Programs\Microsoft VS Code\Code.exe" tools\bancada-desempenho\bench.js --cenario=ocioso,foco,digitando,rolando,rolando_foco | Out-String
```

Outro endereço do app: variável `BSOFT_URL` (padrão `http://localhost:8080/index.html?sim=1`). Tudo roda em **modo simulação** (`?sim=1`): nada é gravado no banco.

| Script | O que faz |
|---|---|
| `bench.js` | carrega o app, cria um chat de 80 mensagens e mede, por cenário (`ocioso`, `foco`, `digitando`, `rolando`, `rolando_foco`): quadros/s (média, p95, pior), tempo de cada tecla, CPU da placa de vídeo e da página, tarefas da thread principal |
| `ab.js variantes.json` | teste A/B ao vivo: injeta CSS/JS de cada variante (veja `variantes-exemplo.json`) e mede parado, digitando e rolando; `--entrada` mede a entrada de uma mensagem nova |
| `stream.js` | resposta da IA **simulada** pelo `handleChat` real (`--chars`, `--digitar`, `--rolar`, `--perfil` = onde o JavaScript gasta o tempo, `--original` = revelação antiga) |
| `fid2.js` | fidelidade: compara o fundo novo com o original, pixel a pixel (claro, escuro, “Leves”, tom azul, janela estreita) |
| `perf-test.js` | 14 testes da vigilância automática (digitação/rolagem lentas de verdade, sem falso positivo, “Voltar ao completo”, “Leves”) |
| `regressao.js` | 12 testes: console limpo, Personalizar refaz o fundo, resposta simulada completa |
| `teste-imagens-chat.js` | **Imagens do procedimento (v28.39), lado do chat** — 24 testes: regras puras, carga com colunas ausentes, calibragem com os artigos reais (`calib-imagens.js`), resposta pelo `handleChat` real com imagens, ampliar, histórico, URL perigosa. Usa a porta 9555 (`-SemJanela` serve) |
| `teste-imagens-painel.js` | 25 testes do campo “Imagens do procedimento” do painel (comprimir, colar/arrastar/escolher, limpeza ao cancelar, “Corrigir artigo”) com banco e armazenamento **simulados** |
| `teste-imagens-revisao.js` · `…-sem-coluna.js` | 8 + 3 testes da aba Revisão com o campo de imagens (trocar de pergunta descarta, “Salvar no banco de dados” leva as imagens, coluna ausente avisa) |
| `gerar-pulsos.js` | gera os keyframes em degraus dos pulsos (`mais`, `dot`, `dot2`, `scroll`) com a curva original; `erro` mostra o desvio |
| `sessao.js` | `ev "<js>"` avalia uma expressão na página aberta |

## Armadilhas (já enganaram uma medida)

- **O Windows pode estar com as animações desligadas.** Aí o Edge informa `prefers-reduced-motion: reduce` e o sistema **já não anima** (regra em `css/theme-2026.css`): tudo parece ótimo. Os scripts forçam `no-preference` (o que a maioria vê); para medir o modo sem animação use `--reduzir` (em `stream.js`).
- **Janela minimizada = quadros parados** (`visibilityState: hidden`) e o script fica esperando. Deixe a janela de teste aberta, atrás das outras (não minimizada). `bench.js` e `ab.js` desistem depois de um limite de tempo (a medida se perde); `stream.js` não tem limite: se travar, encerre o processo.
- **Edge sem janela (`-SemJanela`) não reproduz o custo da placa de vídeo** (50 quadros/s e 98 ms por tecla na janela real viraram 60 e 24 ms no headless). Serve só para a thread principal (resposta da IA, carga).
- **“O app terminou de carregar?”** — `window.isVectorizing` NÃO existe (é um `let` de script, não vira propriedade da janela): a espera passava sempre. Use `typeof isVectorizing!=='undefined' && !isVectorizing && bancoCompletoRaw.length>100` (perfil novo, sem vetores guardados, leva dezenas de segundos para baixar os vetores).
- Compare sempre **na mesma bancada** e repita (a CPU de outro programa mexe ±5 %).

## Como ler os números (nesta bancada: i3-7100, Intel HD 630, 1536×730 a 125 %)

| | bom | ruim |
|---|---|---|
| quadros/s parado e rolando | 55–60 (tela de 60 Hz) | < 40 |
| tecla até a letra (mediana) | ≈ 25 ms | > 80 ms |
| CPU placa + página, parado | < 30 % | > 80 % |
