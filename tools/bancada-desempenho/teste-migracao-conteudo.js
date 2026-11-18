'use strict';
/* teste-migracao-conteudo.js — confere o CONTEÚDO da página migracao.html (passo a passo, vídeos, regras e prazos, glossário) sem navegador e sem rede.
   Rode depois de editar config/migracao-roteiro.js, config/migracao-regras.js ou config/migracao-glossario.js:
     $env:ELECTRON_RUN_AS_NODE = "1"; & "$env:LOCALAPPDATA\Programs\Microsoft VS Code\Code.exe" tools\bancada-desempenho\teste-migracao-conteudo.js | Out-String
   O que confere: ids únicos, valores de "quando" que existem nas perguntas, TODOS os caminhos de menu contra o menu real (config/menu-bsoft.js), os 6 vídeos (links do YouTube),
   que cada documento e cada resposta do cliente tem o passo certo, que os prazos citados na tela existem em config/migracao-regras.js, links https e a ausência de código
   de parâmetro/funcionalidade e de endereço de tela nos textos. */
const fs = require('fs'), path = require('path'), vm = require('vm');
const raiz = path.resolve(__dirname, '..', '..');
const ler = rel => fs.readFileSync(path.join(raiz, rel), 'utf8');

const ctx = { URL, console: { log() {}, warn() {}, info() {}, error() {} } };
ctx.window = ctx; vm.createContext(ctx);
['config/menu-bsoft.js', 'js/app/menu-bsoft.js', 'js/app/prerequisitos.js', 'js/faq/logica.js', 'config/migracao-roteiro.js', 'config/migracao-regras.js', 'config/migracao-glossario.js', 'js/migracao/logica.js']
    .forEach(f => vm.runInContext(ler(f), ctx, { filename: f }));
const Menu = vm.runInContext('MenuBsoft', ctx), Prereq = vm.runInContext('Prereq', ctx), Faq = vm.runInContext('FaqLogica', ctx), ML = vm.runInContext('MigLogica', ctx);
const R = ctx.BSOFT_MIG_ROTEIRO, G = ctx.BSOFT_MIG_REGRAS, GL = ctx.BSOFT_MIG_GLOSSARIO;

let ok = 0, falhas = [];
const t = (nome, cond, detalhe) => { if (cond) ok++; else falhas.push(nome + (detalhe ? ' → ' + detalhe : '')); };
const unicos = (lista) => { const v = new Set(), d = []; lista.forEach(x => { if (v.has(x)) d.push(x); v.add(x); }); return d; };

// ───────── perguntas do começo ─────────
const TIPOS = ['escolha', 'multi', 'numeracao'];
t('perguntas: arquivo carregou, com trilha, docs, seguro e numeração', !!R && ['trilha', 'docs', 'seguro', 'numeracao'].every(id => R.perguntas.some(q => q.id === id)), JSON.stringify((R.perguntas || []).map(q => q.id)));
t('perguntas: ids únicos', unicos(R.perguntas.map(q => q.id)).length === 0);
const perg = id => R.perguntas.find(p => p.id === id);
R.perguntas.forEach(q => {
    const n = 'pergunta ' + q.id;
    t(n + ': tipo conhecido', TIPOS.includes(q.tipo), q.tipo);
    t(n + ': tem rótulo', !!q.rotulo && q.rotulo.length >= 8);
    (q.so || []).forEach(s => t(n + ': "so" é uma trilha que existe', !!R.trilhas[s], s));
    if (q.tipo === 'escolha' || q.tipo === 'multi') {
        t(n + ': tem pelo menos 2 opções, com valor e rótulo', Array.isArray(q.opcoes) && q.opcoes.length >= 2 && q.opcoes.every(o => !!o.v && !!o.r));
        t(n + ': valores das opções únicos', unicos((q.opcoes || []).map(o => o.v)).length === 0);
        const vals = (q.opcoes || []).map(o => o.v);
        if (q.tipo === 'escolha') t(n + ': a resposta padrão é uma das opções', vals.includes(q.padrao), q.padrao);
        else t(n + ': as respostas padrão são opções que existem', Array.isArray(q.padrao) && q.padrao.length >= 1 && q.padrao.every(v => vals.includes(v)));
    }
});
t('pergunta "trilha": uma opção para cada trilha (e a "numeração" só para quem vem de outro sistema)', JSON.stringify(perg('trilha').opcoes.map(o => o.v).sort()) === JSON.stringify(Object.keys(R.trilhas).sort()) && JSON.stringify(perg('numeracao').so) === JSON.stringify(['migracao']));
t('a tela de perguntas não pede nada que seja configuração do sistema (certificado, talão, regra, tabela, usuário)', !/certificado|tal[ãa]o|regra de c[áa]lculo|tabela de pre|usu[áa]rio/i.test(JSON.stringify(R.perguntas)));

// ───────── passo a passo ─────────
t('passos: arquivo carregou', !!R && Array.isArray(R.passos) && R.passos.length >= 8, 'passos=' + (R && R.passos && R.passos.length));
const fasesIds = R.fases.map(f => f.id), passosIds = R.passos.map(p => p.id);
t('passos: ids de fase únicos', unicos(fasesIds).length === 0, unicos(fasesIds).join(','));
t('passos: ids de passo únicos', unicos(passosIds).length === 0, unicos(passosIds).join(','));
t('passos: ids só com letras e números (o progresso do cliente é guardado por eles)', passosIds.every(i => /^[a-zA-Z][a-zA-Z0-9]*$/.test(i)), passosIds.filter(i => !/^[a-zA-Z][a-zA-Z0-9]*$/.test(i)).join(','));
const opcoesDe = id => { const p = perg(id); return p && p.opcoes ? p.opcoes.map(o => o.v) : null; };
const VALIDOS = { trilha: Object.keys(R.trilhas), docs: opcoesDe('docs'), seguro: opcoesDe('seguro') };   // as chaves que "quando" e "se" podem usar (só perguntas de escolha)
const valida = (obj, onde) => {
    Object.keys(obj || {}).forEach(k => {
        t(onde + ': chave "' + k + '" é uma pergunta de escolha', k in VALIDOS, k);
        if (VALIDOS[k]) (obj[k] || []).forEach(v => t(onde + ': valor "' + v + '" de ' + k + ' existe', VALIDOS[k].includes(v), v));
        t(onde + ': "' + k + '" é lista', Array.isArray(obj[k]));
    });
};
R.fases.forEach(f => { valida(f.quando, 'fase ' + f.id + ' quando'); t('fase ' + f.id + ': tem título', !!f.titulo); (f.so || []).forEach(s => t('fase ' + f.id + ': "so" válido', !!R.trilhas[s], s)); t('fase ' + f.id + ': tem passos', R.passos.some(p => p.fase === f.id)); });
R.passos.forEach(p => {
    const n = 'passo ' + p.id;
    t(n + ': fase existe', fasesIds.includes(p.fase), p.fase);
    t(n + ': nível válido', ['obrigatorio', 'recomendado', 'opcional'].includes(p.nivel), p.nivel);
    t(n + ': título e resumo (uma frase: o que vamos fazer)', !!p.titulo && p.titulo.length >= 8 && !!p.resumo && p.resumo.length >= 20);
    t(n + ': tem a pergunta pronta do chat ("mentor")', typeof p.mentor === 'string' && p.mentor.length > 10);
    t(n + ': tem consultas ao banco ("buscas")', Array.isArray(p.buscas) && p.buscas.length >= 1);
    t(n + ': "Passo a passo" com pelo menos 2 ações', Array.isArray(p.como) && p.como.length >= 2);
    t(n + ': tem "cuidados"', Array.isArray(p.cuidados) && p.cuidados.length >= 1);
    t(n + ': tempo estimado', typeof p.tempo === 'string' && p.tempo.length >= 3, p.tempo);
    valida(p.quando, n + ' quando');
    (p.alertas || []).forEach((a, i) => { valida(a.se, n + ' alerta ' + i); t(n + ' alerta ' + i + ': tipo e texto', ['aviso', 'dica'].includes(a.tipo) && !!a.texto); });
    (p.onde || []).forEach(c => { const v = Menu.validarCaminho(c); t(n + ': caminho no menu real "' + c + '"', v.ok, 'não existe em config/menu-bsoft.js'); });
    (p.video || []).forEach(k => t(n + ': o vídeo "' + k + '" existe no mapa de vídeos', !!(R.videos || {})[k], k));
    (p.erros || []).forEach((e, i) => t(n + ': erro ' + (i + 1) + ' com texto curto e consulta ao banco', !!e.t && e.t.length <= 48 && !!e.q && e.q.length >= 8, e.t));
    if (p.dinamico) t(n + ': bloco especial conhecido', ['numeracao', 'prazos'].includes(p.dinamico), p.dinamico);
});
t('passos: todo passo (menos "entender") tem pelo menos um erro comum cadastrado', R.passos.filter(p => p.id !== 'entender').every(p => (p.erros || []).length >= 1), R.passos.filter(p => p.id !== 'entender' && !(p.erros || []).length).map(p => p.id).join(','));
t('passos: o bloco de numeração é só da trilha "outro sistema"', R.passos.filter(p => p.dinamico === 'numeracao').every(p => JSON.stringify((p.quando || {}).trilha) === JSON.stringify(['migracao'])));
t('passos: o último passo é o dos prazos (depois de emitir)', R.passos[R.passos.length - 1].dinamico === 'prazos');

// o que o cliente responde → o passo certo aparece
const passoDe = (perfil) => ML.montarRoteiro(ML.sanearPerfil(perfil, R), R).passos.map(p => p.id);
t('cada documento marcado traz o seu passo (CT-e, MDF-e, CIOT frota própria, contrato de frete)', ['cte', 'mdfe', 'ciotPropria', 'contratoFrete'].every(d => passoDe({ trilha: 'migracao', docs: [d] }).includes(d)));
t('cada documento do passo a passo tem vídeo tutorial', ['cte', 'mdfe', 'ciotPropria', 'contratoFrete'].every(d => (R.passos.find(p => p.id === d).video || []).includes(d)));
t('cadastros (pessoas e veículos) têm vídeo', ['pessoas', 'veiculos'].every(d => (R.passos.find(p => p.id === d).video || []).includes(d)));
t('seguro "ainda não configurei" traz o passo do seguro; "já configurado" e "não tenho" não', passoDe({ trilha: 'migracao', docs: ['cte'], seguro: 'configurar' }).includes('seguro') && !passoDe({ trilha: 'migracao', docs: ['cte'], seguro: 'configurado' }).includes('seguro') && !passoDe({ trilha: 'migracao', docs: ['cte'], seguro: 'nao' }).includes('seguro'));
t('empresa nova começa por "entender" e não tem a numeração; quem vem de outro sistema é o contrário', passoDe({ trilha: 'nova', docs: ['cte'] })[0] === 'entender' && !passoDe({ trilha: 'nova', docs: ['cte'] }).includes('numeracao') && passoDe({ trilha: 'migracao', docs: ['cte'] })[0] === 'numeracao' && !passoDe({ trilha: 'migracao', docs: ['cte'] }).includes('entender'));
t('qualquer combinação de respostas gera um passo a passo (mínimo: cadastros, o documento e os prazos)', (() => { let bad = []; for (const trilha of ['migracao', 'nova']) for (const seguro of ['configurado', 'configurar', 'nao']) for (let m = 1; m < 16; m++) { const docs = ['cte', 'mdfe', 'ciotPropria', 'contratoFrete'].filter((_, i) => m & (1 << i)); const ids = passoDe({ trilha, docs, seguro }); if (ids.length < 4 || ids[ids.length - 1] !== 'depois' || new Set(ids).size !== ids.length) bad.push(trilha + '/' + seguro + '/' + docs); } return bad.length === 0; })());
t('a ordem dos passos é a do roteiro (nada fora de ordem em nenhuma combinação)', (() => { const ordem = passosIds; for (const m of [1, 5, 15]) { const docs = ['cte', 'mdfe', 'ciotPropria', 'contratoFrete'].filter((_, i) => m & (1 << i)); const ids = passoDe({ trilha: 'migracao', docs, seguro: 'configurar' }); if (ids.some((id, i) => i && ordem.indexOf(id) < ordem.indexOf(ids[i - 1]))) return false; } return true; })());

// ───────── vídeos tutoriais ─────────
Object.keys(R.videos || {}).forEach(k => { const v = R.videos[k], info = Faq.videoInfo(v.url); t('vídeo ' + k + ': título, palavras e link de player conhecido', !!v.titulo && !!v.palavras && info.ok && info.tipo === 'youtube' && !!info.embed, JSON.stringify(info)); });
t('os 6 vídeos tutoriais da equipe estão no roteiro', ['pessoas', 'veiculos', 'cte', 'mdfe', 'ciotPropria', 'contratoFrete'].every(k => !!(R.videos || {})[k]));
t('o endereço de cada vídeo tem o código certo (11 caracteres) e nenhum se repete', Object.values(R.videos || {}).every(v => /[?&]v=[A-Za-z0-9_-]{11}$/.test(v.url)) && unicos(Object.values(R.videos).map(v => v.url)).length === 0);
t('todo vídeo do mapa está em algum passo (nenhum fica órfão)', Object.keys(R.videos || {}).every(k => R.passos.some(p => (p.video || []).includes(k))));
t('sugestões do chat: lista geral não vazia', (R.sugestoes.geral || []).length >= 2);
t('trilhas: cada uma tem título e explicação', Object.keys(R.trilhas).every(k => !!R.trilhas[k].titulo && !!R.trilhas[k].sub));

// ───────── regras e prazos ─────────
const regrasIds = G.regras.map(r => r.id);
t('regras: ids únicos', unicos(regrasIds).length === 0, unicos(regrasIds).join(','));
const DOCS = ['CT-e', 'MDF-e', 'CIOT e ANTT', 'Geral'];
G.regras.forEach(r => {
    const n = 'regra ' + r.id;
    t(n + ': documento conhecido', DOCS.includes(r.doc), r.doc);
    t(n + ': nível válido', ['conferido', 'orientativo'].includes(r.nivel), r.nivel);
    t(n + ': conferidoEm no formato AAAA-MM-DD', /^\d{4}-\d{2}-\d{2}$/.test(r.conferidoEm || ''), r.conferidoEm);
    t(n + ': regra e detalhe', !!r.regra && Array.isArray(r.detalhe) && r.detalhe.length >= 1);
    t(n + ': tem fonte', Array.isArray(r.fontes) && r.fontes.length >= 1);
    (r.fontes || []).forEach(f => { t(n + ': fonte com título', !!f.titulo); if (f.url) t(n + ': link https "' + f.url.slice(0, 60) + '"', /^https:\/\//.test(f.url) && !/\s/.test(f.url)); });
    (r.onde || []).forEach(c => { const v = Menu.validarCaminho(c); t(n + ': caminho no menu real "' + c + '"', v.ok); });
    t(n + ': tem consultas ao banco', Array.isArray(r.buscas));
    if (r.nivel === 'orientativo') t(n + ': orientativo diz o que confirmar (varia ou prazo)', !!(r.varia || r.prazo));
});
// as regras que o passo "Depois de emitir" mostra (js/migracao/tela-passos.js › blocoPrazos) precisam existir
['cte-cancelar', 'cte-cce', 'mdfe-cancelar', 'mdfe-encerrar', 'ciot-antes'].forEach(id => t('a regra "' + id + '", mostrada no passo dos prazos, existe', regrasIds.includes(id)));
t('a data de revisão e o aviso legal das regras existem (o cliente vê na tela)', /^\d{4}-\d{2}-\d{2}$/.test(G.revisadoEm) && G.aviso.length > 40);
G.calculadora.forEach(c => {
    const n = 'calculadora ' + c.id;
    t(n + ': regra existe', regrasIds.includes(c.regra), c.regra);
    t(n + ': uma medida (horas, dias ou anos)', [c.horas, c.dias, c.anos].filter(x => x > 0).length === 1);
    t(n + ': "desde" conhecido', ['autorizacao', 'emissao'].includes(c.desde), c.desde);
    t(n + ': documento conhecido', DOCS.includes(c.doc));
    Object.keys(c.porUF || {}).forEach(uf => t(n + ': UF "' + uf + '" com 2 letras e horas', /^[A-Z]{2}$/.test(uf) && c.porUF[uf] > 0));
});
t('a calculadora da tela tem o que o cliente escolhe (CT-e e MDF-e)', ['CT-e', 'MDF-e'].every(d => G.calculadora.some(c => c.doc === d && c.tipo !== 'guarda')));

// ───────── glossário (usado pela IA para explicar siglas) ─────────
const termos = GL.termos.map(x => x.termo);
t('glossário: termos únicos', unicos(termos).length === 0, unicos(termos).join(','));
t('glossário: pelo menos 40 termos', GL.termos.length >= 40, String(GL.termos.length));
GL.termos.forEach(x => {
    const n = 'termo ' + x.termo;
    t(n + ': grupo conhecido', GL.grupos.includes(x.grupo), x.grupo);
    t(n + ': explicação curta', !!x.simples && x.simples.length >= 30 && x.simples.length <= 520, String((x.simples || '').length));
    (x.ver || []).forEach(v => t(n + ': "ver ' + v + '" existe', termos.includes(v), v));
    if (x.bsoft && x.bsoft.onde) x.bsoft.onde.forEach(c => { const v = Menu.validarCaminho(c); t(n + ': caminho no menu real "' + c + '"', v.ok); });
});
GL.grupos.forEach(g => t('glossário: grupo "' + g + '" tem termos', GL.termos.some(x => x.grupo === g)));

// ───────── regras transversais de texto ─────────
const todos = [];
const coleta = (obj, rotulo) => { if (obj == null) return; if (typeof obj === 'string') todos.push([rotulo, obj]); else if (Array.isArray(obj)) obj.forEach((v, i) => coleta(v, rotulo + '[' + i + ']')); else if (typeof obj === 'object') Object.keys(obj).forEach(k => { if (k === 'url') return; coleta(obj[k], rotulo + '.' + k); }); };
coleta(R, 'roteiro'); coleta(G, 'regras'); coleta(GL, 'glossario');
todos.forEach(([rot, s]) => {
    if (Prereq.semCodigo(s) !== s) falhas.push('código de parâmetro/funcionalidade escrito em ' + rot + ': "' + s.slice(0, 90) + '"'); else ok++;
    if (/c\.php\?id=|javascript:|<script|onerror\s*=/i.test(s)) falhas.push('endereço de tela ou HTML perigoso em ' + rot + ': "' + s.slice(0, 90) + '"'); else ok++;
    if (/\bhttps?:\/\//i.test(s)) falhas.push('link solto em texto (use o campo fontes) em ' + rot + ': "' + s.slice(0, 90) + '"'); else ok++;
    if (/\s{2,}\S|[ ​‌‍⁠﻿]/.test(s) && !/^\s*$/.test(s)) falhas.push('espaço duplo ou invisível em ' + rot + ': "' + s.slice(0, 60) + '"'); else ok++;
});

console.log('\nConteúdo da primeira emissão: ' + R.passos.length + ' passos · ' + Object.keys(R.videos).length + ' vídeos · ' + R.passos.reduce((s, p) => s + (p.erros || []).length, 0) + ' erros comuns · ' + G.regras.length + ' regras · ' + G.calculadora.length + ' itens na calculadora · ' + GL.termos.length + ' termos');
console.log(ok + ' conferências ok · ' + falhas.length + ' problema(s)');
falhas.forEach(f => console.log('  ✘ ' + f));
process.exit(falhas.length ? 1 : 0);
