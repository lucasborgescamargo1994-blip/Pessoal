'use strict';
// Captura RESPOSTAS REAIS da IA (e os artigos que ela recebeu) em ?sim=1 (somente leitura) para calibrar/testar a regra das imagens do procedimento (js/core/imagens-banco.js).
// Segue o fluxo EXATO do usuário: pergunta → (se tiver "sefaz" etc.) assistente "Consulta de Rejeição SEFAZ" → "Consultar no banco de dados" → "curta ou completa?" → resposta.
// Gasta uma chamada de IA por rodada. A IA varia a cada resposta: use 6 a 10 rodadas, nos dois formatos.
// Uso:  Code.exe captura-respostas.js "Como cancelar um Ct-e na SEFAZ" completa,completa,completa,curta 89 saida.json
//       (ID = o artigo que tem a imagem; a saída vai para o arquivo dado — o texto dos artigos é cópia da base: não suba para o GitHub sem querer)
// Depois: Code.exe replay-captura.js saida.json   → reexecuta cada resposta pelo BancoImg.analisar de verdade e diz se a imagem entra (com e sem a prova do título).
const fs = require('fs');
const L = require('./lib-cdp.js');
const PERGUNTA = process.argv[2], FORMATOS = (process.argv[3] || 'completa').split(','), ID = +(process.argv[4] || 0), SAIDA = process.argv[5] || 'captura.json';
if (!PERGUNTA) { console.error('Uso: Code.exe captura-respostas.js "pergunta" completa,curta ID_DO_ARTIGO saida.json'); process.exit(1); }
(async () => {
    const c = await L.abrirPagina(9555);
    await c.send('Page.enable'); await c.send('Runtime.enable');
    await c.send('Emulation.setDeviceMetricsOverride', { width: 1366, height: 800, deviceScaleFactor: 1, mobile: false });
    const registros = [];
    for (let k = 0; k < FORMATOS.length; k++) {
        const fmt = FORMATOS[k];
        await c.send('Page.addScriptToEvaluateOnNewDocument', { source: "try{localStorage.removeItem('bsoft_perf'); localStorage.removeItem('bsoft_v27_prefs')}catch(e){}" });
        await L.navegar(c, L.URL_APP);
        for (let i = 0; i < 240; i++) { await L.sleep(500); try { if (await c.eval("(()=>{const i=document.getElementById('searchInput');return !!(i&&!i.disabled&&typeof isVectorizing!=='undefined'&&!isVectorizing&&bancoCompletoRaw.length>100&&typeof BancoImg!=='undefined')})()")) break; } catch (e) { /* carregando */ } }
        await L.sleep(1200);
        // guarda o que o chat entrega a BancoImg.analisar (a resposta FINAL e os artigos) sem mudar o comportamento
        await c.eval(`(()=>{ window.__capt = []; const orig = BancoImg.analisar; BancoImg.analisar = function(artigos, texto) { const out = orig.apply(this, arguments);
          try { window.__capt.push({ texto, candidatos: out.candidatos, imagens: out.imagens.length, artigos: (artigos || []).slice(0, 6).map(r => ({ id: r.idSupabase != null ? r.idSupabase : r.id, titulo: String(r.erro || r.titulo || '').slice(0, 100), sim: r.similaridade, temImagem: !!(r.imagens && r.imagens.length), reforco: !!r._reforcoPalavraChave, erro: r.erro, solucao: r.solucao, emitir: r.emitir, caminhoMenu: r.caminhoMenu })) }); } catch (e) { /* só captura */ }
          return out; }; return true })()`);
        await c.eval("document.getElementById('searchInput').value = " + JSON.stringify(PERGUNTA) + "; handleChat(); 0");
        let wiz = false;
        for (let i = 0; i < 24; i++) { await L.sleep(250); if (await c.eval("!!document.getElementById('sefazWizardCard')")) { wiz = true; break; } }
        if (wiz) await c.eval("document.querySelector('#sefazWizardCard button[onclick*=\"_sefazWizBancoDados\"]').click(); 0");
        let fmtCard = false;
        for (let i = 0; i < 80; i++) { await L.sleep(250); if (await c.eval("!!document.querySelector('.fmt-card .fmt-op')")) { fmtCard = true; break; } }
        if (fmtCard) await c.eval("document.querySelector('.fmt-card .fmt-op[data-f=\"" + fmt + "\"]').click(); 0");
        for (let i = 0; i < 240; i++) { await L.sleep(500); if (i > 8 && !(await c.eval("document.body.classList.contains('ai-busy')")) && (await c.eval("window.__capt.length")) > 0) break; }
        await L.sleep(2500);
        const r = await c.eval(`(()=>{ const ult = [...document.querySelectorAll('#chatStream .answer-card:not(.fmt-card):not(#sefazWizardCard)')].pop(); return { capt: window.__capt || [], galeria: !!(ult && ult.querySelector('.bd-imagens')) } })()`);
        const cp = r.capt[r.capt.length - 1];
        registros.push({ rodada: k + 1, formato: fmt, wizard: wiz, galeria: r.galeria, texto: cp ? cp.texto : null, candidatos: cp ? cp.candidatos : null, artigos: cp ? cp.artigos : null });
        const mine = cp && cp.candidatos ? cp.candidatos.find(x => x.id === ID) : null;
        console.log('rodada ' + (k + 1) + ' [' + fmt + '] galeria=' + r.galeria + ' ' + (mine ? JSON.stringify({ sim: mine.sim, prova: mine.prova, trechos: mine.trechos, maior: mine.maiorTrechos, fracao: mine.fracao, cobertura: mine.cobertura, uso: mine.uso }) : '(artigo ' + ID + ' não era candidato)') + ' · tamanho=' + (cp ? cp.texto.length : 0));
    }
    fs.writeFileSync(SAIDA, JSON.stringify({ pergunta: PERGUNTA, id: ID, registros }, null, 1), 'utf8');
    console.log('gravado em ' + SAIDA);
    c.fechar(); process.exit(0);
})().catch(e => { console.error(String(e && e.stack || e).slice(0, 900)); process.exit(1); });
