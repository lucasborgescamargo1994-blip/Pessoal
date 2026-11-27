'use strict';
// A CHAMADA DE VOZ respondida pelo AGENTE (v29.3.0) — Conversa rápida (o 📞), no Edge de verdade, com a IA DE VERDADE (gasta ~8 chamadas de IA). Nada vai ao banco: a tabela "logs" é de mentira (as
// perguntas viram linhas só na memória do teste, que confere o que seria gravado); o resto do banco só é lido. (Sem ?sim=1 porque no modo simulação o chat nem tenta gravar o log.)
// O microfone e o alto-falante são SIMULADOS (SpeechRecognition e speechSynthesis de mentira): o teste "fala" uma frase, espera o fim do turno como o motor de voz espera, e lê o que o alto-falante FALARIA,
// com o tempo de cada frase. Compara o agente com o caminho de antes (Personalizar › "Usar o Agente de IA nas chamadas de voz" ligado × desligado).
// Fase 1  agente: pergunta → resposta curta e falável (≤ 2–3 frases, sem símbolos, sem código de parâmetro) → "continua" segue de onde parou → rejeição da SEFAZ → pergunta com parâmetro (sem "Antes de tudo") → log
// Fase 2  o caminho de antes, mesma pergunta (para comparar o tempo até a 1ª frase)
// Fase 3  reserva: o agente cai (erro) → a chamada continua pelo caminho de antes e, depois de 2 falhas seguidas, o agente sai da chamada
// Fase 4  interromper no meio da fala
// Uso (servidor do projeto na 8080 → tools\servidor-local.bat):  Code.exe teste-voz-agente.js [--url=…] [--porta=9568] [--so=1,2,3]
const L = require('./lib-cdp.js');
const { execSync } = require('child_process');
const arg = (n, d) => { const a = process.argv.find(x => x.startsWith('--' + n + '=')); return a ? a.slice(n.length + 3) : d; };
const URL = arg('url', 'http://localhost:8080/index.html'), PORTA = +arg('porta', 9568), SO = String(arg('so', '1,2,3,4,5')).split(',').map(Number);
let ok = 0, falhas = 0;
const t = (nome, cond, extra) => { if (cond) { ok++; console.log('  ✔ ' + nome); } else { falhas++; console.log('  ✘ ' + nome + (extra !== undefined ? '  → ' + (typeof extra === 'string' ? extra : JSON.stringify(extra)) : '')); } };
const palavras = s => String(s || '').split(/\s+/).filter(Boolean).length;

const STUBS = `(() => {
  const falas = window.__falas = [];
  Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: { speaking: false, paused: false, speak(u) { falas.push({ t: u.text, em: performance.now() }); setTimeout(() => { try { u.onend && u.onend(); } catch (e) {} }, 60 + u.text.length * 18); }, cancel() { }, resume() { }, pause() { }, getVoices() { return []; }, addEventListener() { }, removeEventListener() { } } });
  window.SpeechSynthesisUtterance = function (t) { this.text = t; };
  // (como o reconhecedor de verdade: a lista de resultados CRESCE durante a sessão e recomeça quando a sessão recomeça)
  class FakeSR { constructor() { window.__sr = this; this.vivo = false; this.lista = []; } start() { this.vivo = true; this.lista = []; setTimeout(() => { try { this.onstart && this.onstart(); } catch (e) {} }, 0); } stop() { this.vivo = false; setTimeout(() => { try { this.onend && this.onend(); } catch (e) {} }, 0); } abort() { this.vivo = false; } }
  window.SpeechRecognition = window.webkitSpeechRecognition = FakeSR;
  // a pessoa "fala": um resultado final do reconhecedor (o motor espera o fim da frase como sempre)
  window.__dizer = texto => { const sr = window.__sr; sr.lista.push(Object.assign([{ transcript: texto, confidence: 0.9 }], { isFinal: true })); sr.onresult({ resultIndex: sr.lista.length - 1, results: sr.lista }); };
  window.__enchimentos = ['Um instante…', 'Deixa eu ver…', 'Hum, só um segundo…', 'Já vejo isso…', 'Certo, um momento…'];
})();`;

(async () => {
    const proc = await L.lancar({ porta: PORTA, gpu: false, w: 1366, h: 900, args: ['--headless=new'] });
    const c = await L.abrirPagina(PORTA);
    const temporizacao = [];   // linhas "⏱️ [conversa voz] modelo · 1ª palavra X ms · fim do turno → fala: Y ms"
    await c.send('Page.enable'); await c.send('Runtime.enable'); await c.send('Network.enable');
    const consola = [];   // avisos e erros do motor de voz e do agente (para entender um turno que não respondeu): --depurar mostra depois de cada fala
    c.on('Runtime.consoleAPICalled', p => { const x = p.args.map(a => a.value !== undefined ? String(a.value) : (a.description || '')).join(' '); if (/\[conversa voz\]/.test(x)) temporizacao.push(x.replace(/^%c/, '').replace(/color:[^ ]+$/, '').trim().slice(0, 240)); if (/conversa voz|agente|voz\]|\[log\]/i.test(x) && /warn|error|log/.test(p.type)) consola.push(p.type + ': ' + x.slice(0, 260)); });
    const erros = []; c.on('Runtime.exceptionThrown', p => erros.push((p.exceptionDetails.exception && p.exceptionDetails.exception.description || p.exceptionDetails.text).slice(0, 300)));
    await c.send('Emulation.setDeviceMetricsOverride', { width: 1366, height: 900, deviceScaleFactor: 1, mobile: false });
    await c.send('Page.addScriptToEvaluateOnNewDocument', { source: STUBS + "; try{localStorage.setItem('bsoft_usuario_nome','Teste Agente'); localStorage.removeItem('bsoft_v27_prefs'); localStorage.removeItem('bsoft_voz_modelos')}catch(e){}" });
    await L.navegar(c, URL);
    for (let i = 0; i < 400; i++) { await L.sleep(400); if (await c.eval("typeof isVectorizing !== 'undefined' && !isVectorizing && bancoCompletoRaw.length > 100 && typeof AgenteVoz !== 'undefined' && typeof ConversaVoz !== 'undefined'").catch(() => false)) break; }
    await L.sleep(1500);
    const prep = await c.eval("AgenteChat.prepararMotor().then(() => ({ ok: true })).catch(e => ({ ok: false, erro: String(e && e.message || e) }))");
    console.log('agente de voz ' + await c.eval('AgenteVoz.VERSAO') + ' · ligado: ' + await c.eval('AgenteVoz.ativo()') + ' · motor preparado: ' + JSON.stringify(prep));
    // banco de mentira só para o log (o resto do sistema segue normal)
    await c.eval(`window.__logs = []; (() => { const orig = sb.from.bind(sb); sb.from = t => t !== 'logs' ? orig(t) : ({ insert: async row => { window.__logs.push({ op: 'insert', row }); return { error: null }; }, update: p => ({ eq: async (col, v) => { window.__logs.push({ op: 'update', payload: p, onde: col + '=' + v }); return { error: null }; } }), select: () => ({ order: () => ({ limit: async () => ({ data: [], error: null }) }) }) }); })(); 0`);
    await c.eval(`window.__turno = async (texto, maxMs) => {
        const antes = __falas.length, t0 = performance.now();
        __dizer(texto);
        let ultima = performance.now(), n = antes;
        for (;;) {
            await new Promise(r => setTimeout(r, 120));
            const e = ConversaVoz.estado();
            if (__falas.length !== n) { n = __falas.length; ultima = performance.now(); }
            const quieto = e && e.fase === 'ouvindo' && !e.falando && e.filaFala === 0 && __falas.length > antes && performance.now() - ultima > 1800;
            if (quieto || performance.now() - t0 > (maxMs || 60000)) break;
        }
        const todas = __falas.slice(antes), falas = todas.filter(f => !__enchimentos.includes(f.t));   // ("Deixa eu ver…" não é resposta: só segura a vez enquanto a IA pensa)
        return { falas: falas.map(f => f.t), enchimento: todas.length - falas.length, ms1: falas.length ? Math.round(falas[0].em - t0) : null, msFim: Math.round(performance.now() - t0), estado: ConversaVoz.estado() };
    }; 0`);
    const turno = async (frase, ms) => {
        const r = await c.eval('window.__turno(' + JSON.stringify(frase) + ',' + (ms || 60000) + ')');
        if (arg('depurar', false) || !r.falas.length) { console.log('   [depuração] estado: ' + JSON.stringify(r.estado) + ' · turno ' + r.msFim + ' ms · enchimentos: ' + r.enchimento + '\n     ' + (consola.splice(0).join('\n     ') || '(sem avisos)')); } else consola.length = 0;
        return r;
    };
    const logsDe = async () => c.eval('window.__logs');
    const dito = r => r.falas.join(' ');
    const sym = s => /[*#_>`]/.test(s);
    const res = {};

    if (SO.includes(1)) {
        console.log('\n══ Fase 1 — a chamada respondida pelo AGENTE');
        t('a chamada começa (microfone e alto-falante simulados) e o agente está ligado', await c.eval('ConversaVoz.iniciar() === true && AgenteVoz.ativo({}) === true'));
        await c.eval('Prefs.set({ agenteVoz: true }, { quiet: true }); 0');
        await L.sleep(2500);   // a saudação ("Olá! Aqui é o suporte do Bsoft…") e o ignorarAte
        const q1 = 'Como faço para cancelar um MDF-e que já foi autorizado?';
        let r = await turno(q1); res.q1 = r;
        console.log('   “' + q1 + '” → ' + r.falas.length + ' frase(s) · 1ª fala em ' + r.ms1 + ' ms · turno inteiro ' + r.msFim + ' ms\n     ↳ ' + dito(r).slice(0, 300));
        t('responde com fala curta (1 a 3 frases, até ~60 palavras) e é sobre cancelar MDF-e', r.falas.length >= 1 && r.falas.length <= 4 && palavras(dito(r)) <= 70 && /cancel/i.test(dito(r)) && /mdf|manifesto/i.test(dito(r)), { frases: r.falas.length, palavras: palavras(dito(r)), dito: dito(r).slice(0, 200) });
        t('o texto é falável: sem símbolos de Markdown, sem links e sem número de parâmetro', !sym(dito(r)) && !/https?:/.test(dito(r)) && !/par[aâ]metro\s*(n[º°o.]*\s*)?\d{2,5}/i.test(dito(r)));
        t('a 1ª frase sai rápido (menos de 7 s depois de a pessoa terminar)', r.ms1 !== null && r.ms1 < 7000, r.ms1);
        const logs1 = await logsDe();
        const upd1 = logs1.filter(x => x.op === 'update').pop(), ins1 = logs1.filter(x => x.op === 'insert');
        t('a pergunta virou UMA linha do log e a resposta foi gravada nela: fonte "ia", modelo "(voz, agente)", com as fontes do banco', ins1.length === 1 && upd1 && upd1.payload && upd1.payload.fonte === 'ia' && /\(voz, agente\)/.test(upd1.payload.modelo || '') && !!upd1.payload.resposta, { insercoes: ins1.length, modelo: upd1 && upd1.payload && upd1.payload.modelo });
        t('o chat recebeu a pergunta e a resposta da chamada', await c.eval("document.querySelectorAll('#chatStream .message, #chatStream .answer-card').length >= 2"));

        const sobrou = /continue\?|continuar\?/i.test(dito(r));
        console.log('   (ofereceu “quer que eu continue?”: ' + (sobrou ? 'sim' : 'não') + ')');
        r = await turno('sim, pode continuar'); res.cont = r;
        console.log('   “sim, pode continuar” → ' + r.falas.length + ' frase(s) · 1ª fala em ' + r.ms1 + ' ms\n     ↳ ' + dito(r).slice(0, 300));
        const antes = new Set(dito(res.q1).toLowerCase().split(/\W+/).filter(w => w.length > 3));
        const nova = dito(r).toLowerCase().split(/\W+/).filter(w => w.length > 3), repetidas = nova.filter(w => antes.has(w)).length;
        t('"continua" segue de onde parou: fala algo e não repete a resposta anterior (menos de 80 % das palavras iguais)', r.falas.length >= 1 && nova.length > 0 && repetidas / nova.length < 0.8, { frases: r.falas.length, repetidas: nova.length ? Math.round(100 * repetidas / nova.length) + '%' : 'n/a' });

        r = await turno('O que significa a rejeição 539 do CT-e?'); res.rej = r;
        console.log('   “rejeição 539” → ' + r.falas.length + ' frase(s) · 1ª fala em ' + r.ms1 + ' ms\n     ↳ ' + dito(r).slice(0, 300));
        t('a rejeição da SEFAZ vem do banco (duplicidade: número e série já usados / chave de acesso) — o motor de voz de antes não tinha essa ferramenta', /duplicidade|j[aá] (foi|foram) (usad|emitid)|mesma (chave|s[eé]rie|numera)|numera[cç][aã]o|s[eé]rie|chave de acesso|539/i.test(dito(r)), dito(r).slice(0, 200));

        r = await turno('É possível vincular CT-e de talões diferentes ao mesmo contrato de frete?'); res.pf = r;
        console.log('   “vincular CT-e de talões diferentes” → ' + r.falas.length + ' frase(s) · 1ª fala em ' + r.ms1 + ' ms\n     ↳ ' + dito(r).slice(0, 300));
        t('responde o que foi perguntado (talões / contrato de frete), sem abrir com "Antes de tudo" e sem número de parâmetro', /tal[õo]es|contrato|v[ií]ncul|sim|poss[ií]vel/i.test(dito(r)) && !/antes de tudo/i.test(dito(r)) && !/par[aâ]metro\s*(n[º°o.]*\s*)?\d{2,5}/i.test(dito(r)), dito(r).slice(0, 160));
        const modelos = temporizacao.filter(x => /1ª palavra/.test(x));
        console.log('   tempos do motor de voz:\n     ' + modelos.join('\n     '));
    }

    if (SO.includes(2)) {
        console.log('\n══ Fase 2 — o caminho de antes (agente desligado nas chamadas), mesma pergunta');
        if (!await c.eval('ConversaVoz.ativa()')) { await c.eval('ConversaVoz.iniciar()'); await L.sleep(2500); }
        await c.eval('Prefs.set({ agenteVoz: false }, { quiet: true }); 0');
        t('com a chave desligada o agente sai da chamada', await c.eval('AgenteVoz.ativo({}) === false'));
        const nLogs = (await logsDe()).length;
        const r = await turno('Como faço para cancelar um MDF-e que já foi autorizado?'); res.antes = r;
        console.log('   → ' + r.falas.length + ' frase(s) · 1ª fala em ' + r.ms1 + ' ms · turno inteiro ' + r.msFim + ' ms\n     ↳ ' + dito(r).slice(0, 300));
        t('o caminho de antes continua respondendo (cancelar MDF-e)', r.falas.length >= 1 && /cancel/i.test(dito(r)), dito(r).slice(0, 160));
        const upd = (await logsDe()).slice(nLogs).filter(x => x.op === 'update').pop();
        t('e grava o log do jeito de antes: modelo "(voz)" sem "agente"', upd && upd.payload && /\(voz\)/.test(upd.payload.modelo || '') && !/agente/.test(upd.payload.modelo || ''), upd && upd.payload && upd.payload.modelo);
        if (res.q1 && r.ms1 != null && res.q1.ms1 != null) console.log('   ⏱ 1ª frase da MESMA pergunta: agente ' + res.q1.ms1 + ' ms · caminho de antes ' + r.ms1 + ' ms  (a IA varia: compare com várias rodadas)');
        await c.eval('Prefs.set({ agenteVoz: true }, { quiet: true }); 0');
    }

    if (SO.includes(3)) {
        console.log('\n══ Fase 3 — o agente cai: a chamada continua e, depois de 2 falhas, o agente sai da chamada');
        if (!await c.eval('ConversaVoz.ativa()')) { await c.eval('ConversaVoz.iniciar()'); await L.sleep(2500); }
        await c.eval("window.__resp = Agente.agente.responder; Agente.agente.responder = async () => { throw new Error('queda de mentira do agente'); }; 0");
        const r1 = await turno('Onde eu cadastro um motorista no sistema?');
        console.log('   1ª queda → ' + r1.falas.length + ' frase(s) · ' + r1.msFim + ' ms\n     ↳ ' + dito(r1).slice(0, 200));
        t('com o agente fora do ar a pessoa é respondida do mesmo jeito (caminho de antes)', r1.falas.length >= 1 && /motorista|pessoas|cadastr/i.test(dito(r1)), dito(r1).slice(0, 160));
        const r2 = await turno('Como eu emito um CT-e complementar?');
        t('2ª queda: continua respondendo', r2.falas.length >= 1, dito(r2).slice(0, 160));
        t('depois de 2 falhas seguidas o agente sai da chamada (não gasta mais tempo tentando)', await c.eval('AgenteVoz.ativo({ agenteFalhas: ConversaVoz.estado().agenteFalhas }) === false'), await c.eval('ConversaVoz.estado()'));
        await c.eval("Agente.agente.responder = window.__resp; 0");
    }

    if (SO.includes(4)) {
        console.log('\n══ Fase 4 — interromper no meio da fala');
        await c.eval('ConversaVoz.encerrar("teste"); 0'); await L.sleep(500);
        await c.eval('Prefs.set({ agenteVoz: true }, { quiet: true }); 0');
        t('nova chamada com o agente de volta', await c.eval('ConversaVoz.iniciar() === true && AgenteVoz.ativo({}) === true')); await L.sleep(2500);
        const p = c.eval('window.__turno("Como faço para emitir um CT-e de substituição?", 40000)');
        for (let i = 0; i < 100; i++) { await L.sleep(200); if (await c.eval('ConversaVoz.estado().falando === true')) break; }
        await c.eval('ConversaVoz.interromper(); 0');
        const r = await p;
        t('interromper corta a fala e devolve a vez à pessoa (sem erro)', (await c.eval('ConversaVoz.estado().fase')) === 'ouvindo' && !(await c.eval('ConversaVoz.estado().falando')), r.estado);
        const r2 = await turno('Obrigado, era só isso.');
        t('"obrigado, era só isso" é respondido na hora (sem IA) e a chamada pode ser encerrada', r2.falas.length >= 1 && /nada|mais|ligar/i.test(dito(r2)), dito(r2).slice(0, 120));
    }
    try { await c.eval('ConversaVoz.encerrar("teste"); 0'); } catch (e) { /* já encerrada */ }

    if (SO.includes(5)) {
        console.log('\n══ Fase 5 — voz AO VIVO (Gemini): o conhecimento que a consulta entrega vem do agente (sem IA, sem abrir chamada real)');
        await c.eval('Prefs.set({ agenteVoz: true }, { quiet: true }); 0');
        const k = await c.eval(`AgenteVoz.consultar('Como cancelar um MDF-e que já foi autorizado?').then(r => r && ({ len: r.texto.length, encontrou: r.encontrou, titulos: r.titulos, nFontes: (r.fontes || []).length, cod: /par[aâ]metro\\s*(n[º°o.]*\\s*)?\\d{2,5}/i.test(r.texto), mdfe: /MDF/i.test(r.texto) }))`);
        t('a consulta devolve o conhecimento do banco (artigos lidos, na mesma forma do VozConsulta): texto, encontrou, fontes e títulos', k && k.len > 600 && k.encontrou === true && k.titulos.length >= 1 && k.nFontes >= 1 && k.mdfe, k);
        t('e o modelo da voz ao vivo nunca recebe o número de parâmetro/funcionalidade', k && k.cod === false);
        const v = await c.eval(`VozAoVivo.consultarBase('Como cancelar um MDF-e?').then(r => ({ len: r.texto.length, encontrou: r.encontrou }))`).catch(() => null);
        t('a busca de sempre (VozConsulta) continua disponível como reserva', v && v.len > 300, v);
        await c.eval('Prefs.set({ agenteVoz: false }, { quiet: true }); 0');
        t('com a chave desligada a consulta do agente não é usada (devolve null)', (await c.eval("AgenteVoz.consultar('como cancelar um mdf-e')")) === null);
    }

    console.log('\nerros de JavaScript na página: ' + (erros.length ? erros.slice(0, 3).join(' | ') : 'nenhum'));
    t('nenhum erro de JavaScript durante as chamadas', erros.length === 0, erros.slice(0, 2));
    console.log('\n' + ok + ' verificações ok · ' + falhas + ' falha(s)');
    c.fechar(); try { execSync('taskkill /F /T /PID ' + proc.pid, { stdio: 'ignore' }); } catch (e) { /* ok */ }
    process.exit(falhas ? 1 : 0);
})().catch(e => { console.error(String(e && e.stack || e)); process.exit(1); });
