'use strict';
// Imagem anexada ao chat (v28.40) com a IA DE VERDADE (?sim=1, somente leitura; gasta chamadas de IA: uma de visão e uma de resposta por rodada).
// Desenha na hora um print de conversa com cliente (ou de tela de erro), cola no campo, escreve a pergunta e envia — como a pessoa faz. Mostra o que a IA leu, a resposta e confere o básico.
// A IA varia a cada resposta: rode mais de uma rodada por cenário.
// Uso:  Code.exe teste-anexos-ia-real.js [cenarios separados por vírgula: carta,prazo,rejeicao,tela,duas] [rodadas por cenário, padrão 1] [pergunta, ou - para enviar SÓ a imagem] [arquivo-de-saida.json]
const fs = require('fs');
const L = require('./lib-cdp.js');
const CEN = (process.argv[2] || 'carta,prazo').split(','), RODADAS = +(process.argv[3] || 1), PERGUNTA = process.argv[4] === undefined ? 'o que eu verifico primeiro?' : (process.argv[4] === '-' ? '' : process.argv[4]), SAIDA = process.argv[5];

const CENARIOS = {
    carta: { titulo: 'Cliente não consegue emitir carta de correção (permissão)', falas: [['c', 'Bom dia! Preciso de ajuda urgente'], ['c', 'Estou tentando emitir uma carta de correção do CT-e 4821 e o sistema não deixa'], ['c', 'Aparece uma mensagem dizendo que eu não tenho permissão para essa ação'], ['a', 'Bom dia! Vou verificar para você'], ['c', 'Já saí e entrei de novo no sistema e continua igual']], espera: [/corre[çc][ãa]o/i, /permiss/i] },
    prazo: { titulo: 'Cliente quer cancelar CT-e fora do prazo', falas: [['c', 'Boa tarde, preciso cancelar um CT-e que emiti semana passada'], ['c', 'O botão de cancelar na SEFAZ não aparece mais pra mim'], ['a', 'Boa tarde! Qual o número do CT-e?'], ['c', 'É o 3377. Já faz uns 10 dias que emiti'], ['c', 'O que eu faço? O cliente já recusou a carga']], espera: [/cancel/i, /CT-?e/i] },
    rejeicao: { titulo: 'Cliente com rejeição ao autorizar MDF-e', falas: [['c', 'Oi, tô com um problema pra autorizar o MDF-e'], ['c', 'Fica dando rejeição 539 e não autoriza de jeito nenhum'], ['a', 'Oi! Me manda um print da tela?'], ['c', 'Mandei. Já tentei enviar 3 vezes e sempre volta a mesma rejeição'], ['c', 'A viagem sai hoje às 18h, preciso resolver']], espera: [/539|rejei/i, /MDF/i] },
    tela: { titulo: 'Tela de erro do sistema (não é conversa)', tela: true, linhas: ['Bsoft TMS - Conhecimento de Transporte', 'Erro ao transmitir o CT-e', 'Rejeição 539: Duplicidade de CT-e, com diferença na Chave de Acesso', 'Documento: CT-e 4821  Série: 1', 'Situação: Rejeitado'], espera: [/539|rejei/i, /CT-?e/i] },
};
CENARIOS.duas = { titulo: 'Conversa dividida em DOIS prints (cancelar CT-e)', partes: [{ falas: CENARIOS.prazo.falas.slice(0, 3) }, { falas: CENARIOS.prazo.falas.slice(3) }], espera: CENARIOS.prazo.espera };

(async () => {
    const c = await L.abrirPagina(9555);
    await c.send('Page.enable'); await c.send('Runtime.enable'); await c.send('Network.enable'); await c.send('Network.setCacheDisabled', { cacheDisabled: true });   // (sem cache: o arquivo editado agora é o que roda)
    const logs = [], avisos = []; c.on('Runtime.consoleAPICalled', p => { const t = p.args.map(a => a.value !== undefined ? String(a.value) : (a.description || '')).join(' '); if (/\[Vision\]|\[anexos\]|\[IA\]|handleChat\] streaming|📷/.test(t)) logs.push(t.slice(0, 260)); if ((p.type === 'warning' || p.type === 'error') && /anexos|Vision|IA\]/.test(t)) avisos.push(p.type + ': ' + t.slice(0, 400)); });
    const erros = []; c.on('Runtime.exceptionThrown', p => erros.push((p.exceptionDetails.exception && p.exceptionDetails.exception.description || p.exceptionDetails.text).slice(0, 300)));
    await c.send('Emulation.setDeviceMetricsOverride', { width: 1366, height: 800, deviceScaleFactor: 1, mobile: false });
    const resultados = [];
    for (const nome of CEN) {
        for (let r = 1; r <= RODADAS; r++) {
            const cen = CENARIOS[nome]; if (!cen) { console.log('cenário desconhecido: ' + nome); continue; }
            await c.send('Page.addScriptToEvaluateOnNewDocument', { source: "try{localStorage.removeItem('bsoft_perf'); localStorage.removeItem('bsoft_v27_prefs')}catch(e){}" });
            await L.navegar(c, L.URL_APP);
            for (let i = 0; i < 240; i++) { await L.sleep(500); try { if (await c.eval("(()=>{const i=document.getElementById('searchInput');return !!(i&&!i.disabled&&typeof isVectorizing!=='undefined'&&!isVectorizing&&bancoCompletoRaw.length>100&&typeof Anexos!=='undefined'&&!document.getElementById('sendBtn').disabled)})()")) break; } catch (e) { /* carregando */ } }
            await L.sleep(1200); logs.length = 0;
            // desenha o print (conversa estilo WhatsApp, ou uma tela de erro) e cola no campo, como a pessoa faria
            await c.eval(`window.__desenhar = (cen) => new Promise(res => { const w = 760, cv = document.createElement('canvas'); const x0 = cv.getContext('2d'); x0.font = '19px Segoe UI';
              const quebra = (t, larg) => { const l = []; let cur = ''; t.split(' ').forEach(p => { if (x0.measureText((cur + ' ' + p).trim()).width > larg) { l.push(cur); cur = p; } else cur = (cur + ' ' + p).trim(); }); l.push(cur); return l; };
              let alt = 80; const blocos = [];
              if (cen.tela) { cen.linhas.forEach(t => { const l = quebra(t, w - 80); blocos.push({ l, t }); alt += l.length * 28 + 14; }); alt += 40; }
              else cen.falas.forEach(([q, t]) => { const l = quebra(t, 520); blocos.push({ l, q }); alt += l.length * 26 + 34; });
              cv.width = w; cv.height = alt; const x = cv.getContext('2d');
              if (cen.tela) { x.fillStyle = '#f3f3f3'; x.fillRect(0, 0, w, alt); x.fillStyle = '#1f3a5f'; x.fillRect(0, 0, w, 52); x.fillStyle = '#fff'; x.font = 'bold 19px Segoe UI'; x.fillText(blocos[0].t, 20, 33);
                let y = 90; x.fillStyle = '#fff'; x.fillRect(20, 70, w - 40, alt - 100); blocos.slice(1).forEach((b, i) => { x.fillStyle = i === 1 ? '#b91c1c' : '#111'; x.font = (i === 1 ? 'bold ' : '') + '19px Segoe UI'; b.l.forEach(l => { x.fillText(l, 40, y); y += 28; }); y += 14; }); }
              else { x.fillStyle = '#efeae2'; x.fillRect(0, 0, w, alt); x.fillStyle = '#075e54'; x.fillRect(0, 0, w, 60); x.fillStyle = '#fff'; x.font = 'bold 20px Segoe UI'; x.fillText('Cliente · Transportadora Exemplo', 24, 38); x.font = '12px Segoe UI'; x.fillText('online', 24, 54);
                let y = 80; blocos.forEach(b => { x.font = '19px Segoe UI'; const lw = Math.max(...b.l.map(l => x.measureText(l).width)) + 32, h = b.l.length * 26 + 20, bx = b.q === 'a' ? w - lw - 24 : 24; x.fillStyle = b.q === 'a' ? '#dcf8c6' : '#ffffff'; x.beginPath(); x.roundRect(bx, y, lw, h, 12); x.fill(); x.fillStyle = '#111'; b.l.forEach((l, i) => x.fillText(l, bx + 16, y + 28 + i * 26)); x.fillStyle = '#8696a0'; x.font = '11px Segoe UI'; x.fillText('09:4' + (blocos.indexOf(b) % 10), bx + lw - 44, y + h - 5); y += h + 14; }); }
              cv.toBlob(b => res(new File([b], 'print.png', { type: 'image/png' })), 'image/png'); })`);
            const partes = cen.partes || [cen];   // (um print por parte: "duas" cola dois, como a pessoa cola um depois do outro)
            for (const parte of partes) { await c.eval(`window.__desenhar(${JSON.stringify(parte)}).then(f => { const dt = new DataTransfer(); dt.items.add(f); document.getElementById('searchInput').dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })); })`); await L.sleep(400); }
            for (let i = 0; i < 80; i++) { await L.sleep(250); if (await c.eval('Anexos.pendentes().length === ' + partes.length + ' && Anexos.pendentes().every(a => !a.preparando)')) break; }
            const t0 = Date.now();
            await c.eval(`document.getElementById('searchInput').value = ${JSON.stringify(PERGUNTA)}; document.getElementById('sendBtn').click(); 0`);
            let fim = false;
            for (let i = 0; i < 360; i++) { await L.sleep(500); if (i > 6 && !(await c.eval('Anexos.ocupado()')) && !(await c.eval("document.body.classList.contains('ai-busy')")) && (await c.eval("document.querySelectorAll('#chatStream .answer-card, #chatStream .anx-erro').length")) > 0) { fim = true; break; } }
            await L.sleep(4000);
            const ms = Date.now() - t0;
            const d = await c.eval(`(() => { const s = document.getElementById('chatStream'); const cards = [...s.querySelectorAll('.answer-card')]; const ult = cards[cards.length - 1]; const lote = [...Anexos._lotes.values()].pop();
              return { erro: !!s.querySelector('.anx-erro'), resposta: ult ? (ult.querySelector('.section-content') || ult).innerText : '', leitura: lote && lote.leitura ? { resumo: lote.leitura.resumo, textos: lote.leitura.textos, busca: lote.leitura.busca } : null, bolha: !!s.querySelector('.anx-bolha'), fmt: !!s.querySelector('.fmt-card'), imagensProc: !!(ult && ult.querySelector('.bd-imagens')) } })()`);
            const checks = {
                leuOAssunto: cen.espera.every(re => re.test((d.leitura ? d.leitura.resumo + ' ' + d.leitura.textos : ''))),
                respondeu: d.resposta.length > 200, terminou: fim && !d.erro,
                comSecoes: /por onde come[cç]ar/i.test(d.resposta),
                assuntoNaResposta: cen.espera.every(re => re.test(d.resposta)),
                semCodigoDeParametro: !/(par[aâ]metro|funcionalidade)\s*(n[º°o.]*\s*)?\(?\d{2,}\)?/i.test(d.resposta),
                semPerguntaDeFormato: !d.fmt, semIngles: !/\b(the|you must|please|check that)\b/i.test(d.resposta)
            };
            const modelo = (logs.filter(t => /\[Vision\] OK/.test(t)).pop() || '').replace(/.*modelo:\s*/, '');
            const resp = { cenario: nome, rodada: r, ms, modeloVisao: modelo, leitura: d.leitura, checks, resposta: d.resposta };
            resultados.push(resp);
            console.log('\n══════ ' + cen.titulo + ' · rodada ' + r + ' · ' + Math.round(ms / 1000) + ' s · visão: ' + (modelo || '?') + ' ══════');
            console.log('LEITURA  resumo: ' + (d.leitura ? d.leitura.resumo : '(sem leitura)')); console.log('         textos: ' + (d.leitura ? d.leitura.textos : '')); console.log('         busca : ' + (d.leitura ? d.leitura.busca : ''));
            console.log('CHECAGENS: ' + Object.keys(checks).map(k => (checks[k] ? '✔' : '✘') + k).join('  '));
            if (avisos.length) { console.log('AVISOS DO CONSOLE: ' + avisos.slice(-6).join(' | ')); avisos.length = 0; }
            console.log('RESPOSTA:\n' + d.resposta.slice(0, 2600));
            if (nome === CEN[0] && r === 1) { const shot = await c.send('Page.captureScreenshot', { format: 'png' }); const arq = require('path').join(require('os').tmpdir(), 'anexos-ia-real-' + nome + '.png'); fs.writeFileSync(arq, Buffer.from(shot.data, 'base64')); console.log('captura da tela: ' + arq); }
        }
    }
    const total = resultados.length, bons = resultados.filter(x => Object.values(x.checks).every(Boolean)).length;
    console.log('\nRESUMO: ' + bons + '/' + total + ' respostas com TODAS as checagens ✔ · erros de JS: ' + (erros.length ? erros.join(' | ') : 'nenhum'));
    if (SAIDA) fs.writeFileSync(SAIDA, JSON.stringify(resultados, null, 1), 'utf8');
    c.fechar(); process.exit(0);
})().catch(e => { console.error(String(e && e.stack || e)); process.exit(1); });
