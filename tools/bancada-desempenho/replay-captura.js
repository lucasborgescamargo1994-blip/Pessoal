'use strict';
// Reexecuta as respostas REAIS capturadas por captura-respostas.js pelo MÓDULO de verdade (js/core/imagens-banco.js → BancoImg.analisar), sem navegador e sem gastar IA.
// Mostra, por arquivo, em quantas respostas a imagem do artigo-alvo entra: só pela resposta (a regra de cópia/vocabulário) e com a prova do título. Sai com erro se alguma faltar.
// Uso:  Code.exe replay-captura.js captura1.json [captura2.json …]
const fs = require('fs'), path = require('path');
global.window = { BSOFT_CONFIG: { supabaseUrl: 'https://x.supabase.co' } };
const B = new Function(fs.readFileSync(path.join(__dirname, '..', '..', 'js', 'core', 'imagens-banco.js'), 'utf8') + '; return BancoImg;')();
const URL_OK = 'https://x.supabase.co/storage/v1/object/public/bancodados-imagens/a.webp';
const arqs = process.argv.slice(2); if (!arqs.length) { console.error('Uso: Code.exe replay-captura.js captura.json [outra.json …]'); process.exit(1); }
let falhou = 0;
arqs.forEach(arq => {
    const D = JSON.parse(fs.readFileSync(arq, 'utf8'));
    [['só a resposta decide', false], ['com a pergunta (título + resposta)', true]].forEach(([modo, comPergunta]) => {
        let ok = 0; const falhas = [];
        D.registros.forEach(r => {
            if (!r.texto) return;
            const rr = r.artigos.map(a => ({ idSupabase: a.id, erro: a.erro, solucao: a.solucao, emitir: a.emitir, caminhoMenu: a.caminhoMenu, similaridade: a.sim, _reforcoPalavraChave: a.reforco, imagens: a.id === D.id ? [{ url: URL_OK, legenda: '' }] : null }));
            const alvo = B.analisar(rr, r.texto, comPergunta ? D.pergunta : undefined).candidatos.find(c => c.id === D.id);
            if (alvo && alvo.motivo === 'ok') ok++; else falhas.push(r.rodada + ':' + (alvo ? alvo.motivo.slice(0, 100) : 'não era candidato'));
        });
        falhou += falhas.length;
        console.log(path.basename(arq) + ' · ' + modo.padEnd(34) + ' → a imagem entra em ' + ok + '/' + D.registros.length + (falhas.length ? '   FALHAS: ' + falhas.join(' | ') : ''));
    });
});
process.exit(falhou ? 1 : 0);
