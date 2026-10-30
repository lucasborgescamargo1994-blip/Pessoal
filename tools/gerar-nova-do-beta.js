// Promove o Beta para a Nova Versão do "Criar Regra › Ct-e / Conhecimento".
//
// A Nova Versão (js/app/regra-cte-nova.js) é uma CÓPIA do Beta (js/app/regra-cte-beta.js) com outro "sobrenome" nos nomes, para os dois poderem existir ao mesmo tempo
// sem se misturar (são scripts clássicos: tudo é global):
//     _cb… / CB_… / cb-… / cb_… / cbSlide…  ->  _nv… / NV_… / nv-… / nv_… / nvSlide…      (funções, constantes, classes do CSS, ids de opções)
//     wCteBeta… / wizardRegraBetaCard / 'cte-beta' / cteBeta / mostrarWizardRegraCteBeta  ->  wCteNova… / wizardRegraNovaCard / 'cte-nova' / cteNova / mostrarWizardRegraCteNova
// O CSS do Beta (a parte .cb-… do fim de css/regra-passos.css) também é copiado como .nv-…, no fim do mesmo arquivo.
//
// Uso (na pasta do projeto):
//     node tools/gerar-nova-do-beta.js              mostra o que o Beta tem de DIFERENTE da Nova Versão (o que falta promover) — não escreve nada
//     node tools/gerar-nova-do-beta.js --escrever   gera a Nova Versão inteira a partir do Beta (JS e CSS). SOBRESCREVE: serve para "promover tudo"; para promover só uma parte,
//                                                   use o modo de comparação acima e leve as mudanças escolhidas à mão para js/app/regra-cte-nova.js (e ao bloco .nv- do CSS)
//     node tools/gerar-nova-do-beta.js --checar     só confere se a Nova Versão atual está sintaticamente sã e sem nomes do Beta sobrando
// Sem Node instalado: o Electron do VS Code roda igual (ELECTRON_RUN_AS_NODE=1 "…\Code.exe" tools\gerar-nova-do-beta.js).
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const RAIZ = path.resolve(__dirname, '..');
const ARQ = { beta: 'js/app/regra-cte-beta.js', nova: 'js/app/regra-cte-nova.js', css: 'css/regra-passos.css' };
const ler = f => fs.readFileSync(path.join(RAIZ, f), 'utf8').replace(/^﻿/, '').replace(/\r\n/g, '\n');
const existe = f => fs.existsSync(path.join(RAIZ, f));
const gravar = (f, t) => fs.writeFileSync(path.join(RAIZ, f), t, 'utf8');   // os arquivos do projeto são LF
const falha = m => { console.error('ERRO: ' + m); process.exit(1); };

// troca um texto exato e AVISA se ele não existir mais (o Beta mudou: ajuste esta tabela)
function trocar(txt, de, para) {
    if (!txt.includes(de)) falha('texto esperado não encontrado no Beta (atualize a tabela de trocas do gerador): ' + de.slice(0, 90));
    return txt.split(de).join(para);
}
// os nomes: o que muda de "sobrenome"
function renomear(txt) {
    return txt
        .replace(/mostrarWizardRegraCteBeta/g, 'mostrarWizardRegraCteNova')
        .replace(/wizardRegraBetaCard/g, 'wizardRegraNovaCard')
        .replace(/wCteBeta/g, 'wCteNova')
        .replace(/cte-beta/g, 'cte-nova')
        .replace(/cteBeta/g, 'cteNova')
        .replace(/\b_cb/g, '_nv')
        .replace(/\bCB_/g, 'NV_')
        .replace(/\bcb(?=[A-Z0-9])/g, 'nv')
        .replace(/\bcb-/g, 'nv-')
        .replace(/\bcb_/g, 'nv_');
}

// ── JS ───────────────────────────────────────────────────────────────────────
const INICIO_JS = 'const CB_PASSOS = [';   // o cabeçalho (comentário) do Beta fica de fora: a Nova Versão tem o seu
const CABECALHO_NOVA = `/* js/app/regra-cte-nova.js — Criar Regra › "Ct-e / Conhecimento Nova Versão": assistente em 7 passos (regra base → campos → gerar regra com IA → cálculo do Frete Valor, do ICMS e do Total Prestação → montagem). */
// ═══════════════════════════════════════════════════════════
//  Ct-e / CONHECIMENTO — NOVA VERSÃO (assistente em telas)
// ═══════════════════════════════════════════════════════════
// ATENÇÃO: este arquivo é uma CÓPIA do Beta (js/app/regra-cte-beta.js) com outros nomes (_nv…/NV_…/nv-… no lugar de _cb…/CB_…/cb-…; ids wCteNova…). As novidades nascem no Beta (oculto: liga em
// Personalizar › Recursos em teste) e são levadas para cá aos poucos — veja tools/gerar-nova-do-beta.js (sem argumentos mostra o que o Beta tem a mais) e a seção "Promover do Beta para a Nova Versão" do README.
// O texto explicativo dos passos, das travas e dos ganchos do motor está no cabeçalho do Beta; aqui vale o mesmo, trocando só os nomes.
// COMPARTILHADO com o Beta: js/app/regra-cte-passos.js (catálogo de opções, regras prontas, textos do prompt e analisadores de ICMS/loop) e o motor das opções (assistente-regras.js / tutorial-regras.js,
// que perguntam ao assistente aberto — window.CTE_ASSISTENTES — quais opções extras ele traz).

`;
function renderJs(beta) {
    const i = beta.indexOf(INICIO_JS);
    if (i < 0) falha('não achei "' + INICIO_JS + '" no Beta (o gerador corta o cabeçalho a partir dela)');
    let t = beta.slice(i);
    t = trocar(t, '<span class="cn-selo cb-selo">Beta</span>', '<span class="cn-selo">Nova versão</span>');   // o selo laranja "Beta" do topo vira o "Nova versão" de sempre
    t = trocar(t, "'➕ Demais opções (Beta)'", "'➕ Demais opções (Nova Versão)'");
    t = renomear(t);
    // o que sobrou escrito "Beta" nos comentários/textos
    TEXTOS.forEach(([de, para]) => { t = trocar(t, de, para); });
    return CABECALHO_NOVA + t;
}
// trocas de texto (feitas DEPOIS dos nomes). Cada uma precisa existir no Beta, senão o gerador avisa.
const TEXTOS = [];   // (nada a trocar por enquanto: os comentários do Beta que diziam "só do Beta" já foram reescritos de forma neutra)

// ── CSS ──────────────────────────────────────────────────────────────────────
const CSS_BETA_INI = '/* ── "Ct-e / Conhecimento Beta" (js/app/regra-cte-beta.js)';
const CSS_NOVA_INI = '/* ── "Ct-e / Conhecimento Nova Versão" (js/app/regra-cte-nova.js)';
function partesCss(css) {
    const b = css.indexOf(CSS_BETA_INI);
    if (b < 0) falha('não achei o bloco do Beta em css/regra-passos.css (esperava uma linha começando com: ' + CSS_BETA_INI + ')');
    const n = css.indexOf(CSS_NOVA_INI);
    if (n >= 0 && n < b) falha('o bloco da Nova Versão está ANTES do bloco do Beta no CSS (a ordem esperada é Beta, depois Nova Versão)');
    return { antes: css.slice(0, b), beta: css.slice(b, n >= 0 ? n : css.length), nova: n >= 0 ? css.slice(n) : '' };
}
function renderCss(blocoBeta) {
    let t = blocoBeta;
    t = trocar(t, CSS_BETA_INI, CSS_NOVA_INI);
    t = renomear(t);
    CSS_TEXTOS.forEach(([de, para]) => { t = trocar(t, de, para); });
    return t;
}
const CSS_TEXTOS = [
    [': reaproveita tudo acima (.cn-*); só o que é próprio dele fica aqui ── */', ': CÓPIA do bloco do Beta (.cb-… → .nv-…), gerada por tools/gerar-nova-do-beta.js; reaproveita tudo acima (.cn-*) ── */'],
    ['═══ Beta: layout ANTI-SCROLL (.nv-anti)', '═══ Nova Versão: layout ANTI-SCROLL (.nv-anti)'],
    [' (e a Nova Versão tem a sua própria cópia, .nv-anti, mais abaixo)', ' (o Beta tem a sua própria cópia, .cb-anti, mais acima)']
];

// ── comparação (diff de linhas) ──────────────────────────────────────────────
function diffLinhas(a, b) {   // a = o que a Nova Versão TERIA se fosse gerada agora; b = o que ela tem. Devolve trechos "-" (só no Beta) e "+" (só na Nova atual)
    const A = a.split('\n'), B = b.split('\n'), n = A.length, m = B.length;
    const L = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
    for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i][j] = A[i] === B[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
    const out = []; let i = 0, j = 0;
    while (i < n || j < m) {
        if (i < n && j < m && A[i] === B[j]) { i++; j++; }
        else if (j < m && (i >= n || L[i][j + 1] >= L[i + 1][j])) { out.push({ t: '+', l: j + 1, s: B[j] }); j++; }
        else { out.push({ t: '-', l: i + 1, s: A[i] }); i++; }
    }
    return out;
}
function mostrarDiff(titulo, rotuloA, rotuloB, a, b) {
    const d = diffLinhas(a, b);
    console.log('\n=== ' + titulo + ' ===');
    if (!d.length) { console.log('  (igual)'); return 0; }
    console.log('  "-" = só no ' + rotuloA + '   "+" = só em ' + rotuloB + '   (número = linha no arquivo respectivo)');
    d.forEach(x => console.log('  ' + x.t + String(x.l).padStart(5) + '  ' + x.s.slice(0, 220)));
    return d.length;
}

// ── conferência da Nova Versão ───────────────────────────────────────────────
function checar(js) {
    let problemas = 0;
    try { new vm.Script(js, { filename: ARQ.nova }); } catch (e) { console.log('SINTAXE: ' + e.message); problemas++; }
    const corpo = js.slice(Math.max(0, js.indexOf('const NV_PASSOS = [')));   // (o cabeçalho explica a cópia e por isso cita os nomes do Beta)
    const sobras = (corpo.match(/(\b_cb[A-Za-z0-9_]*|\bCB_[A-Z0-9_]+|\bcb-[a-z-]+|wCteBeta\w*|wizardRegraBetaCard|cte-beta|cteBeta|mostrarWizardRegraCteBeta)/g) || []);
    if (sobras.length) { console.log('NOMES DO BETA SOBRANDO: ' + [...new Set(sobras)].join(', ')); problemas++; }
    return problemas;
}

// ── principal ────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
if (args.includes('--ajuda') || args.includes('-h')) { console.log(fs.readFileSync(__filename, 'utf8').split('\n').slice(0, 19).join('\n')); process.exit(0); }
const beta = ler(ARQ.beta);
const novaGerada = renderJs(beta);
const css = ler(ARQ.css), pc = partesCss(css);
const cssNovoGerado = renderCss(pc.beta);

if (args.includes('--sobras')) {   // (para quem mantém o gerador) linhas da Nova Versão gerada que ainda dizem "beta"
    [['JS', novaGerada], ['CSS', cssNovoGerado]].forEach(([n, t]) => t.split('\n').forEach((l, i) => { if (/beta/i.test(l)) console.log(n + String(i + 1).padStart(5) + '  ' + l.trim().slice(0, 250)); }));
    process.exit(0);
}
if (args.includes('--escrever')) {
    if (checar(novaGerada)) falha('a Nova Versão gerada não passou na conferência — nada foi escrito');
    gravar(ARQ.nova, novaGerada);
    gravar(ARQ.css, pc.antes + pc.beta + cssNovoGerado);
    console.log('Escrito: ' + ARQ.nova + ' (' + novaGerada.split('\n').length + ' linhas) e o bloco .nv- no fim de ' + ARQ.css);
    console.log('Lembre: index.html precisa carregar js/app/regra-cte-nova.js (depois do Beta) e a versão deve subir (tools\\atualizar-versao.ps1).');
    process.exit(0);
}
if (!existe(ARQ.nova)) { console.log('Ainda não existe ' + ARQ.nova + ' — rode com --escrever para gerar.'); process.exit(0); }
const novaAtual = ler(ARQ.nova);
if (args.includes('--checar')) { const p = checar(novaAtual); console.log(p ? p + ' problema(s).' : 'Nova Versão sã: sintaxe ok e nenhum nome do Beta sobrando.'); process.exit(p ? 1 : 0); }
// (o ponto de corte é o mesmo texto JÁ RENOMEADO: na Nova Versão a constante se chama NV_PASSOS; procurar CB_PASSOS devolvia -1 e o slice comparava só o último caractere — o diff dizia "(igual)" sempre)
const INICIO_NOVA = renomear(INICIO_JS);
const nJs = mostrarDiff('JS — ' + ARQ.nova, 'Beta (já renomeado)', 'Nova Versão atual', novaGerada.slice(Math.max(0, novaGerada.indexOf(INICIO_NOVA))), novaAtual.slice(Math.max(0, novaAtual.indexOf(INICIO_NOVA))));
const nCss = mostrarDiff('CSS — bloco .nv- de ' + ARQ.css, 'Beta (já renomeado)', 'Nova Versão atual', cssNovoGerado, pc.nova);
console.log('\n' + (nJs + nCss ? 'Diferenças: ' + nJs + ' linha(s) no JS, ' + nCss + ' no CSS. Tudo o que tem "-" é novidade do Beta ainda não promovida.' : 'A Nova Versão está igual ao Beta.'));
