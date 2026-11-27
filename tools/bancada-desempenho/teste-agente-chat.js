'use strict';
// O AGENTE DE IA dentro do chat (v29.0.0) — teste ponta a ponta no Edge de verdade (headless), com a IA DE VERDADE (gasta ~6 chamadas grátis).
//   Fase 1 (?sim=1, somente leitura): perguntas pelo campo e pelo ➤, como a pessoa faz — cartão com passos/fontes/barra de 👍👎, pergunta que envolve parâmetro (sem "Antes de tudo" no início; v29.1.0), conta exata, "ferramenta recomendada" (sem IA), pergunta com botões.
//   Fase 2 (sem ?sim, banco de mentira para o log): o que o chat grava em "logs" (pergunta, resposta, fonte, modelo, dados do banco usados) — nada vai para o Supabase de verdade.
//   Fase 3: a RESERVA — agente desligado em Personalizar (e ?agente=0) → o chat clássico responde; e falha total dos modelos → aviso + "Tentar novamente".
// Uso:  Code.exe teste-agente-chat.js [--url=http://localhost:8080/index.html] [--porta=9560] [--captura=pasta-das-imagens] [--so=1,2,3]
// (o servidor local do projeto precisa estar de pé: tools\servidor-local.bat)
const fs = require('fs'), path = require('path'), os = require('os'), { execSync } = require('child_process');
const L = require('./lib-cdp.js');
const arg = (n, d) => { const a = process.argv.find(x => x.startsWith('--' + n + '=')); return a ? a.slice(n.length + 3) : d; };
const BASE = arg('url', (process.env.BSOFT_URL || 'http://localhost:8080/index.html').split('?')[0]), PORTA = +arg('porta', 9560), CAPTURA = arg('captura', os.tmpdir());
const SO = arg('so', '1,2,3').split(',').map(Number);
let n = 0, falhas = 0; const ok = (nome, cond, det) => { n++; if (!cond) { falhas++; console.log('  ✘ ' + nome + (det !== undefined ? '  → ' + (typeof det === 'string' ? det : JSON.stringify(det)) : '')); } else console.log('  ✔ ' + nome + (det !== undefined && process.argv.includes('--verbose') ? '  → ' + (typeof det === 'string' ? det : JSON.stringify(det)) : '')); };

const PRONTO = "(()=>{try{const i=document.getElementById('searchInput');return !!(i&&!i.disabled&&typeof isVectorizing!=='undefined'&&!isVectorizing&&bancoCompletoRaw.length>100&&!document.getElementById('sendBtn').disabled&&typeof AgenteChat!=='undefined'&&AgenteChat.diagnostico().preparado)}catch(e){return false}})()";
// espera a resposta terminar: nenhum "Pensando/status do agente" na tela e o cartão novo com a barra de feedback (ou botões de pergunta, ou a ferramenta recomendada)
const TERMINOU = n => `(()=>{const s=document.getElementById('chatStream');if(s.querySelector('.ag-status')||s.querySelector('.message.ai-msg .loading-dots'))return false;return s.querySelectorAll('.answer-card').length>=${n}})()`;

async function abrir(c, url, antes) {
    await c.send('Page.addScriptToEvaluateOnNewDocument', { source: "try{localStorage.removeItem('bsoft_perf'); localStorage.setItem('bsoft_usuario_nome','Teste Agente')}catch(e){}" + (antes || '') });
    await L.navegar(c, url);
    for (let i = 0; i < 360; i++) { await L.sleep(500); try { if (await c.eval(PRONTO)) break; } catch (e) { /* carregando */ } }
    await L.sleep(800);
}
async function perguntar(c, texto, nCartoes, limiteS) {
    const t0 = Date.now();
    await c.eval(`document.getElementById('searchInput').value = ${JSON.stringify(texto)}; document.getElementById('sendBtn').click(); 0`);
    for (let i = 0; i < (limiteS || 90) * 2; i++) { await L.sleep(500); if (i > 1 && await c.eval(TERMINOU(nCartoes)).catch(() => false)) break; }
    await L.sleep(300);
    return Date.now() - t0;
}
const LER = `(() => { const s = document.getElementById('chatStream'); const cs = [...s.querySelectorAll('.answer-card')]; const c = cs[cs.length - 1]; if (!c) return null;
  const fa = c.querySelector('.feedback-area'); const cont = c.querySelector('.section-content');
  return { classes: c.className, texto: (cont || c).innerText.replace(/[ \\t]+/g, ' ').trim(), passos: [...c.querySelectorAll('.ag-passo')].map(p => (p.classList.contains('agente') ? '▶' : '·') + p.querySelector('.ag-rot').textContent), resumoPassos: (c.querySelector('.ag-passos summary') || {}).textContent || '',
    fontes: [...c.querySelectorAll('.ag-fonte')].map(f => f.textContent), barra: fa ? fa.style.display : null, logTs: fa ? fa.dataset.logTs : null, opcoes: [...c.querySelectorAll('.ag-opcoes button')].map(b => b.textContent), badge: (c.querySelector('[id^=_ib]') || {}).textContent || '',
    retry: !!c.querySelector('button[onclick*="AgenteChat.refazer"]'), ferr: [...c.querySelectorAll('.fs-op')].map(b => b.innerText.replace(/\\s+/g, ' ')), nCartoes: cs.length } })()`;

(async () => {
    const proc = await L.lancar({ porta: PORTA, gpu: false, w: 1366, h: 900, args: ['--headless=new'] });
    const c = await L.abrirPagina(PORTA);
    const errosJs = []; await c.send('Page.enable'); await c.send('Runtime.enable'); await c.send('Network.enable');
    c.on('Runtime.exceptionThrown', p => errosJs.push((p.exceptionDetails.exception && p.exceptionDetails.exception.description || p.exceptionDetails.text).slice(0, 300)));
    const avisos = []; c.on('Runtime.consoleAPICalled', p => { if (p.type !== 'warning' && p.type !== 'error') return; const t = p.args.map(a => a.value !== undefined ? String(a.value) : (a.description || '')).join(' '); if (/agente|\[log\]|ferramenta sugerida|imagens\]/i.test(t)) avisos.push(p.type + ': ' + t.slice(0, 260)); });
    await c.send('Emulation.setDeviceMetricsOverride', { width: 1366, height: 900, deviceScaleFactor: 1, mobile: false });
    const foto = async nome => { try { const s = await c.send('Page.captureScreenshot', { format: 'png' }); const f = path.join(CAPTURA, 'agente-chat-' + nome + '.png'); fs.writeFileSync(f, Buffer.from(s.data, 'base64')); console.log('  📷 ' + f); } catch (e) { /* sem foto */ } };
    try {
        if (SO.includes(1)) {
            console.log('\n══ Fase 1 — o agente respondendo no chat (?sim=1, IA real) ══');
            await abrir(c, BASE + '?sim=1');
            const d0 = await c.eval('AgenteChat.diagnostico()');
            ok('o agente está ligado e preparado (dados do chat aproveitados, sem baixar de novo)', d0.ativo && d0.preparado && d0.vetores >= 600 && d0.dados.artigos >= 600, d0);
            ok('as rejeições, as respostas aprovadas e o FAQ foram baixados (as únicas tabelas que o chat não tinha)', d0.dados.rejeicoes > 500 && d0.dados.respostas > 0, d0.dados);
            ok('o boas-vindas apresenta o Agente de IA', /Agente de IA/.test(await c.eval("document.getElementById('welcomeMsg').innerText")));
            const modelosVivos = d0.modelos.filter(m => !m.morto).length; console.log('  (info) modelos na cadeia: ' + d0.modelos.map(m => m.modelo.split('/').pop() + (m.morto ? '✘' : '')).join(' | ') + ' · vivos ' + modelosVivos);

            let ms = await perguntar(c, 'como cancelar um mdf-e?', 1);
            let r = await c.eval(LER);
            console.log('  #1 como cancelar um mdf-e? → ' + ms + ' ms · ' + r.resumoPassos + ' · ' + r.badge);
            ok('responde com cartão do agente (passos, texto, fontes, barra 👍👎)', r && /ag-card/.test(r.classes) && r.passos.length >= 2 && r.texto.length > 150 && r.fontes.length >= 1 && r.barra === 'flex', { passos: r.passos, fontes: r.fontes.length, barra: r.barra });
            ok('a resposta é sobre cancelar MDF-e', /cancel/i.test(r.texto) && /mdf|manifesto/i.test(r.texto), r.texto.slice(0, 120));
            ok('o cartão tem o endereço do log (data-log-ts) — em ?sim=1 fica vazio, como sempre', r.logTs === '' || r.logTs === null || typeof r.logTs === 'string');
            ok('a pesquisa prévia é rápida (passos somam menos de 2 s)', /\d+ passos? · (\d+ ms|1,\d s)/.test(r.resumoPassos), r.resumoPassos);
            await foto('resposta-mdfe');
            await c.eval("(() => { const s = document.getElementById('chatStream'); s.scrollTop = s.scrollHeight; })(); 0"); await L.sleep(400); await foto('resposta-mdfe-fim');   // (o fim do cartão: fontes e barra de 👍👎)
            await c.eval("document.querySelector('#chatStream .ag-card .ag-passos summary').click(); 0"); await L.sleep(300); await foto('resposta-mdfe-passos');   // (os passos abertos)
            const ctx = await c.eval('getConversaAtiva().contexto.map(m => m.role)');
            ok('a conversa lembra a pergunta e a resposta', JSON.stringify(ctx) === '["user","assistant"]', ctx);

            ms = await perguntar(c, 'é possível vincular cte de talões diferentes ao mesmo contrato de frete?', 2);
            r = await c.eval(LER);
            console.log('  #2 pergunta que envolve um parâmetro → ' + ms + ' ms');
            console.log('     ↳ início da resposta: ' + r.texto.slice(0, 320).replace(/\s+/g, ' '));
            ok('v29.1.0: NÃO abre com "⚙️ Antes de tudo, verifique" — a IA responde o que a pergunta pede', r.texto.length > 120 && !/Antes de tudo, verifique/i.test(r.texto) && !/^\s*[*_#\s]*⚙/.test(r.texto), r.texto.slice(0, 160));
            ok('a resposta trata do assunto perguntado (vincular CT-e / contrato de frete / talões)', /contrato de frete|tal[õo]es|vincul/i.test(r.texto), r.texto.slice(0, 160));
            ok('NUNCA o código do parâmetro', !/par[aâ]metros?\s*(n[ºo°.]*\s*)?\d{2,4}\b/i.test(r.texto) && !/funcionalidades?\s*(n[ºo°.]*\s*)?\d{1,4}\b/i.test(r.texto));

            ms = await perguntar(c, 'calcule o ICMS por dentro de um frete líquido de R$ 1.200,00 com alíquota de 18%', 3);
            r = await c.eval(LER);
            console.log('  #3 conta exata → ' + ms + ' ms · passos: ' + r.passos.join(' '));
            ok('base de cálculo exata (1.463,41) e fórmula no padrão do chat', /1\.463,41/.test(r.texto) && /\(100\s*[−-]\s*(Al[ií]quota|18)\)\s*÷\s*100/.test(r.texto), r.texto.slice(0, 200));
            ok('sem LaTeX, sem link de tela, sem "pensamento" do modelo', !/\\(frac|text|\[|\()/.test(r.texto) && !/c\.php/.test(r.texto) && !/<think/i.test(r.texto));

            ms = await perguntar(c, 'Rejeição NF-e 745', 4, 30);
            r = await c.eval(LER);
            console.log('  #4 ferramenta recomendada → ' + ms + ' ms');
            ok('o banco não tem a 745: mostra a "ferramenta recomendada" (Erros SEFAZ) em vez de chamar a IA', /ferr-sug-card/.test(r.classes) && r.ferr.some(t => /SEFAZ/.test(t)) && ms < 8000, { classes: r.classes, ferr: r.ferr, ms });

            await c.eval('novaConversa(); 0'); await L.sleep(500);
            ms = await perguntar(c, 'como cancelar?', 1);
            r = await c.eval(LER);
            console.log('  #5 pergunta vaga → ' + ms + ' ms · botões: ' + (r.opcoes.join(' | ') || '(respondeu direto)'));
            ok('pergunta vaga: o agente pergunta com botões (sem barra de 👍👎) ou responde cobrindo as opções', r.opcoes.length >= 2 ? r.barra === 'none' : (/CT-e/.test(r.texto) && /MDF-e/.test(r.texto)), r);
            if (r.opcoes.length >= 2) {
                await c.eval("document.querySelectorAll('#chatStream .ag-opcoes button')[1].click(); 0");
                for (let i = 0; i < 160; i++) { await L.sleep(500); if (await c.eval(TERMINOU(2)).catch(() => false)) break; }
                const r2 = await c.eval(LER);
                ok('clicar numa opção vale como digitar: nova bolha do usuário e nova resposta', r2.nCartoes === 2 && r2.texto.length > 100, { cartoes: r2.nCartoes, texto: r2.texto.slice(0, 100) });
            }
        }

        if (SO.includes(2)) {
            console.log('\n══ Fase 2 — o log (banco de mentira; nada vai para o Supabase) ══');
            await abrir(c, BASE, `;window.__espera = 1;`);
            await c.eval(`window.__logs = []; (() => { const orig = sb.from.bind(sb); sb.from = t => t !== 'logs' ? orig(t) : ({ insert: async row => { window.__logs.push({ op: 'insert', row }); return { error: null }; }, update: p => ({ eq: async (col, v) => { window.__logs.push({ op: 'update', payload: p, onde: col + '=' + v }); return { error: null }; } }), select: () => ({ order: () => ({ limit: async () => ({ data: [], error: null }) }) }) }); })(); 0`);
            const ms = await perguntar(c, 'é possível vincular cte de talões diferentes ao mesmo contrato de frete?', 1);
            const r = await c.eval(LER), logs = await c.eval('window.__logs');
            const ins = logs.find(l => l.op === 'insert'), upd = logs.find(l => l.op === 'update');
            console.log('  → ' + ms + ' ms · log: ' + logs.map(l => l.op).join(', '));
            ok('a pergunta virou UMA linha do log (encontrou = true) e o cartão aponta para ela', !!ins && ins.row.encontrou === true && ins.row.pergunta.startsWith('é possível') && r.logTs === ins.row.timestamp, { ins: ins && ins.row, logTs: r.logTs });
            ok('a resposta foi gravada na MESMA linha: fonte "ia", modelo, revisão pendente', !!upd && upd.payload.fonte === 'ia' && !!upd.payload.modelo && upd.payload.revisao === 'pendente' && upd.payload.resposta.length > 100 && upd.onde === 'timestamp=' + ins.row.timestamp, upd && { fonte: upd.payload.fonte, modelo: upd.payload.modelo, revisao: upd.payload.revisao });
            const fb = (upd && upd.payload.fontes_banco) || [];
            ok('"dados do banco usados" (aba Revisão): artigos, parâmetros e funcionalidades, no formato do chat', fb.some(f => f.tipo === 'banco' && f.id > 0) && fb.some(f => f.tipo === 'param' && f.id > 0) && fb.every(f => f.titulo && typeof f.pct === 'number'), fb.map(f => f.tipo + ':' + f.id));
            ok('a resposta gravada não tem código de parâmetro', !/par[aâ]metros?\s*(n[ºo°.]*\s*)?\d{2,4}\b/i.test(upd.payload.resposta));
            await c.eval("document.querySelector('#chatStream .feedback-btn[onclick*=positivo]').click(); 0"); await L.sleep(600);
            const logs2 = await c.eval('window.__logs');
            ok('o 👍 vai para a linha daquela pergunta', logs2.some(l => l.op === 'update' && l.payload.feedback === 'Positivo' && l.onde === 'timestamp=' + ins.row.timestamp), logs2.map(l => l.op + ':' + (l.payload && l.payload.feedback || '')));
        }

        if (SO.includes(3)) {
            console.log('\n══ Fase 3 — reserva: agente desligado e falha total ══');
            await abrir(c, BASE + '?sim=1');
            await c.eval("Prefs.set({ agente: false }); 0");
            ok('desligado em Personalizar: o chat clássico assume (e o boas-vindas deixa de falar do agente)', (await c.eval('AgenteChat.ativo()')) === false);
            await perguntar(c, 'como cancelar um mdf-e?', 1, 30);
            const rc = await c.eval(LER);
            ok('a pergunta segue pelo caminho clássico (cartão "Como você prefere a resposta?")', rc && /fmt-card/.test(rc.classes), rc && rc.classes);
            await c.eval("Prefs.set({ agente: true }); 0");
            ok('?agente=0 no endereço desliga também', await c.eval("(() => { const o = location.search; history.replaceState(null, '', location.pathname + '?sim=1&agente=0'); const v = AgenteChat.ativo(); history.replaceState(null, '', location.pathname + o); return v === false; })()"));
            await c.eval('novaConversa(); 0'); await L.sleep(400);
            await c.eval("window.__real = Agente.mcp.chamar; Agente.mcp.chamar = async () => { throw new Error('nenhum modelo respondeu — HTTP 429 (teste)'); }; 0");
            await perguntar(c, 'como cancelar um mdf-e encerrado?', 1, 30);
            const rf = await c.eval(LER);
            ok('todos os modelos falham: o cartão avisa, mostra o melhor artigo do banco e oferece "Tentar novamente"', rf && /Não foi possível obter resposta/.test(rf.texto) && rf.retry && /MDF-e/i.test(rf.texto), rf && rf.texto.slice(0, 200));
            ok('a falha não entra na memória da conversa como resposta', JSON.stringify(await c.eval('getConversaAtiva().contexto.map(m => m.role)')) === '["user"]');
            await c.eval("Agente.mcp.chamar = window.__real; document.querySelector('#chatStream button[onclick*=\"AgenteChat.refazer\"]').click(); 0");
            for (let i = 0; i < 160; i++) { await L.sleep(500); if (await c.eval(TERMINOU(1)).catch(() => false) && !(await c.eval("!!document.querySelector('#chatStream button[onclick*=\"AgenteChat.refazer\"]')"))) break; }
            const rr = await c.eval(LER);
            ok('"Tentar novamente" responde de verdade, sem duplicar a bolha da pergunta', rr && rr.texto.length > 100 && !/Não foi possível/.test(rr.texto) && (await c.eval("document.querySelectorAll('#chatStream .user-msg').length")) === 1, rr && rr.texto.slice(0, 100));
        }
    } catch (e) { console.log('ERRO no teste:', e && e.stack || e); falhas++; }
    console.log('\nerros de JavaScript na página: ' + (errosJs.length ? errosJs.join(' | ') : 'nenhum'));
    if (avisos.length) console.log('avisos do console (agente/log): ' + avisos.slice(0, 6).join(' | '));
    if (errosJs.length) falhas++;
    console.log('\n' + (n - falhas) + ' verificações ok · ' + falhas + ' falha(s)');
    c.fechar(); try { execSync('taskkill /F /T /PID ' + proc.pid, { stdio: 'ignore' }); } catch (e) { /* ok */ }
    process.exit(falhas ? 1 : 0);
})().catch(e => { console.error(String(e && e.stack || e)); process.exit(1); });
