'use strict';
/* teste-migracao-ia-real.js — O chat da página migracao.html (Primeira emissão guiada) com a IA DE VERDADE (os modelos do painel administrativo, via config/mcp-config.js). Gasta chamadas de IA (grátis).
   Faz perguntas reais pelo fluxo da página (busca no banco → prompt → IA → resposta com fontes) no passo certo do passo a passo e confere, para cada resposta:
     ✔ português (sem inglês) · ✔ nenhum código/número de parâmetro ou funcionalidade · ✔ os caminhos de menu citados existem no MENU REAL · ✔ os prazos citados (N dias/horas/anos)
     estão no material que a IA recebeu (nada inventado) · ✔ citou o que o cenário exige · ✔ NÃO mandou o cliente configurar o sistema (certificado, talão…) quando isso é do Suporte · ✔ trouxe as fontes
     · ✔ sem endereço de tela. No modo "Deu erro" confere o formato causa → correção → depois → se não resolver. Mostra as respostas inteiras para você ler.
   Uso:  $env:ELECTRON_RUN_AS_NODE = "1"; & "$env:LOCALAPPDATA\Programs\Microsoft VS Code\Code.exe" tools\bancada-desempenho\teste-migracao-ia-real.js [cenarios] [saida.txt]
         cenários (vírgula): numeracao,leigo,prazo,certificado,rejeicao,ciot,erro539,erroduvida,seguro — padrão: todos. Nunca mostra a chave da IA. Servidor do projeto em http://localhost:8791 (ou BSOFT_URL).
         Para ver como as RESERVAS se comportam (a cadeia cai nelas quando o 1º modelo demora): $env:IA_MODELO = "cohere" (ou nemotron, laguna, ernie) põe esse modelo em 1º lugar. */
const fs = require('fs'), path = require('path'), os = require('os');
const L = require('./lib-cdp.js');
const URL_PG = process.env.BSOFT_URL || 'http://localhost:8791/bsoft-suporte-ia/migracao.html?sim=1';
const PORTA = 9556;
const NUMS = { cteSerie: '1', cteNumero: '1500', mdfeSerie: '1', mdfeNumero: '320' };
// o cliente só emite: uma linha que manda ele ajustar/editar a numeração inicial do talão (sem dizer que é com o Suporte) quebra a regra
const ensinaEditarTalao = t => t.split('\n').some(l => /(ajust|edit|alter|defin|habilit|corrij|mude|troque)[^\n]{0,80}(numeração inicial|número inicial|pode definir)/i.test(l) && !/Suporte|Implanta|configuração|não é algo|peça /i.test(l));
const NAO_TALAO = [ensinaEditarTalao, 'o cliente a editar o talão / numeração inicial'];
const MODELO = process.env.IA_MODELO || '';   // ex.: IA_MODELO=cohere — põe esse modelo da cadeia em 1º lugar (para testar as reservas)
// perfil: as respostas do cliente · passo: em que passo ele está · erro: usa o modo "Deu erro" · deve: o que a resposta precisa dizer · nao: o que ela NÃO pode dizer
const TODOS = {
    numeracao: { perfil: { trilha: 'migracao', docs: ['cte', 'mdfe'], seguro: 'configurado', numeracao: NUMS }, passo: 'numeracao', pergunta: 'Estou migrando de outro sistema. Como confiro se o Bsoft continua a numeração de CT-e e MDF-e sem dar rejeição 539?', deve: [[/talõ/i, 'fala de talão'], [/numera|sequência/i, 'fala de numeração'], [/Tipos de Talões/i, 'caminho Tipos de Talões'], [/1501|1500/, 'usa o número que o cliente informou']], nao: [NAO_TALAO] },
    leigo: { perfil: { trilha: 'nova', docs: ['cte', 'mdfe'], seguro: 'configurado' }, passo: 'entender', pergunta: 'O que é CT-e e MDF-e? Qual a diferença?', deve: [[/CT-e/, 'CT-e'], [/MDF-e/, 'MDF-e'], [/conhecimento de transporte/i, 'explica a sigla do CT-e'], [/manifesto/i, 'explica o manifesto']] },
    prazo: { perfil: { trilha: 'nova', docs: ['cte', 'mdfe'], seguro: 'configurado' }, passo: 'depois', pergunta: 'Emiti um CT-e ontem em São Paulo com o valor errado. Ainda consigo cancelar? Qual é o prazo?', deve: [[/168|7 dias|sete dias/i, 'prazo de 7 dias / 168 h'], [/contador|SEFAZ/i, 'manda confirmar com o contador/SEFAZ']] },
    certificado: { perfil: { trilha: 'migracao', docs: ['cte', 'mdfe'], seguro: 'configurado', numeracao: NUMS }, passo: 'cte', pergunta: 'O sistema pediu o certificado digital. Como instalo? A empresa só tem um token.', deve: [[/Suporte/i, 'manda falar com o Suporte']], nao: [[/Passo a passo no Bsoft[\s\S]{0,40}\n\s*1\.[\s\S]{0,200}(instal|import)/i, 'ensinar o cliente a instalar o certificado']] },
    rejeicao: { perfil: { trilha: 'migracao', docs: ['cte', 'mdfe'], seguro: 'configurado', numeracao: NUMS }, passo: 'mdfe', pergunta: 'Deu rejeição 539 ao autorizar o MDF-e. O que significa e como resolvo?', deve: [[/duplicidade|já foi usad|já usad/i, 'explica a duplicidade'], [/Talões|numeração inicial|sequência|Suporte/i, 'manda ajustar a numeração/talão ou falar com o Suporte']], nao: [NAO_TALAO] },
    ciot: { perfil: { trilha: 'nova', docs: ['cte', 'ciotPropria'], seguro: 'configurado' }, passo: 'ciotPropria', pergunta: 'Minha frota é própria. Preciso de CIOT?', deve: [[/24\/05\/2026|2026/, 'cita a mudança de 2026'], [/confirm|contador|ANTT/i, 'manda confirmar']] },
    erro539: { perfil: { trilha: 'migracao', docs: ['cte', 'mdfe'], seguro: 'configurado', numeracao: NUMS }, passo: 'cte', erro: true, pergunta: 'Rejeição 539: Duplicidade de CT-e. O número já foi usado.', deve: [[/Causa provável/i, 'seção Causa provável'], [/Como corrigir/i, 'seção Como corrigir'], [/Depois de corrigir/i, 'seção Depois de corrigir'], [/Se não resolver/i, 'seção Se não resolver'], [/duplicidade|já foi usad|já usad/i, 'explica a duplicidade'], [/Talões liberados|numeração|Suporte/i, 'aponta a numeração/o Suporte']], nao: [NAO_TALAO] },
    erroduvida: { perfil: { trilha: 'migracao', docs: ['cte', 'mdfe'], seguro: 'configurado', numeracao: NUMS }, passo: 'cte', erro: true, pergunta: 'Rejeição 8888: erro xyzabc inexistente na validação do grupo ZZ99', deve: [[/não consta|não encontrei|não há/i, 'diz que o erro não consta na base'], [/Suporte/i, 'manda levar ao Suporte']], nao: [NAO_TALAO] },
    seguro: { perfil: { trilha: 'migracao', docs: ['cte', 'mdfe'], seguro: 'configurar', numeracao: NUMS }, passo: 'seguro', pergunta: 'Como cadastro a apólice do seguro e ligo a averbação automática?', deve: [[/apólice/i, 'fala da apólice'], [/averba/i, 'fala da averbação'], [/automática/i, 'averbação automática']] },
};
const escolhidos = (process.argv[2] && process.argv[2] !== '-' ? process.argv[2].split(',') : Object.keys(TODOS)).filter(k => TODOS[k]);
const saida = process.argv[3] || '';
const sleep = L.sleep;

async function fecharAntigo(porta) {
    try { const v = await (await fetch('http://127.0.0.1:' + porta + '/json/version')).json(); const ws = new WebSocket(v.webSocketDebuggerUrl); await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; }); ws.send(JSON.stringify({ id: 1, method: 'Browser.close' })); await sleep(1800); } catch (e) { /* nenhum */ }
}
(async () => {
    await fecharAntigo(PORTA);
    const edge = await L.lancar({ porta: PORTA, gpu: false, w: 1280, h: 900, args: ['--headless=new'] });
    const c = await L.abrirPagina(PORTA), ev = js => c.eval(js);
    const esperar = async (cond, ms, passo = 400) => { const fim = Date.now() + ms; while (Date.now() < fim) { try { if (await ev(cond)) return true; } catch (e) { /* ainda */ } await sleep(passo); } return false; };
    const linhas = []; const log = s => { linhas.push(s); console.log(s); };
    let resumo = { total: 0, ok: 0 };
    try {
        await c.send('Runtime.enable'); await c.send('Page.enable');
        await L.navegar(c, 'about:blank'); await c.send('Storage.clearDataForOrigin', { origin: new URL(URL_PG).origin, storageTypes: 'local_storage' });
        await L.navegar(c, URL_PG);
        await esperar("typeof Mig !== 'undefined' && Mig.dados.estado === 'pronto'", 40000);
        // IA_MODELO=cohere → esse modelo vai para o 1º lugar da cadeia (os outros ficam de reserva): é assim que se testa o comportamento das reservas
        if (MODELO) await ev("(() => { const orig = window.mcpMontarCadeia; window.mcpMontarCadeia = function () { const c = orig(); const i = c.findIndex(p => p.model.includes(" + JSON.stringify(MODELO) + ")); return i > 0 ? [c[i]].concat(c.filter((_, k) => k !== i)) : c; }; return true; })()");
        await ev("window.__msgs = null; const orig = window.callMCPAPI; window.callMCPAPI = async function () { window.__msgs = arguments[4]; return orig.apply(this, arguments); }; true");
        log('Base: ' + (await ev("Mig.dados.banco.length + ' artigos · ' + Mig.dados.rapidas.length + ' respostas aprovadas · ' + Mig.dados.faq.length + ' FAQ'")) + ' · IA: ' + (await ev("mcpMontarCadeia().map(p => p.model).join(' → ')")));
        for (const id of escolhidos) {
            const cen = TODOS[id];
            // o cliente responde às perguntas do começo, vai até o passo certo e pergunta no chat (como a página faz)
            await ev("Mig.novoCliente(" + JSON.stringify(cen.perfil) + "); Mig.mostrarPassos(); Mig.irPasso(Mig.rot.passos.findIndex(p => p.id === " + JSON.stringify(cen.passo) + ")); true");
            await sleep(300);
            const t0 = Date.now();
            await ev("Mig.chatEnviar(" + JSON.stringify(cen.pergunta) + ", { modoErro: " + (cen.erro ? 'true' : 'false') + " }); true");
            const respondeu = await esperar("(() => { const m = Mig.atual.mentor; return (m.length >= 2 && m[m.length - 1].papel === 'ia') || !!document.querySelector('.mig-msg.erro'); })()", 300000, 700);
            const seg = Math.round((Date.now() - t0) / 1000);
            const r = await ev(`(() => { const m = Mig.atual.mentor, ia = m[m.length - 1], erro = !!document.querySelector('.mig-msg.erro');
                if (!ia || ia.papel !== 'ia') return { erro, texto: '', fontes: [] };
                const ctx = (window.__msgs || []).map(x => typeof x.content === 'string' ? x.content : '').join('\\n');
                const texto = ia.texto;
                const paresNumero = [...texto.matchAll(/(\\d+)\\s*(dias?|horas?|anos?|meses)/gi)].map(x => x[1] + ' ' + x[2].toLowerCase().replace(/s$/, ''));
                const noCtx = n => { const [num, un] = n.split(' '); return new RegExp('\\\\b' + num + '\\\\s*(' + un + 's?|h\\\\b)', 'i').test(ctx) || (un.startsWith('hora') && new RegExp('\\\\b' + num + '\\\\s*h\\\\b', 'i').test(ctx)); };
                const caminhos = [...texto.matchAll(/(?:(?:e(?=[A-Z]))?[A-ZÀ-Ý][\\wÀ-ÿ\\/\\-]*(?: [\\wÀ-ÿ\\/\\-]+){0,4})(?: >[\\wÀ-ÿ\\/\\-\\.]+(?: [\\wÀ-ÿ\\/\\-\\.]+){0,5})+/g)].map(x => x[0].trim());
                // o texto pode vir colado ao caminho ("Acesse Transporte > Conhecimentos", "…na tela Opções do Sistema > Suporte e leve…"): vale se alguma poda das palavras das pontas der um caminho do menu real
                const okCaminho = cm => { const partes = cm.split(' > '), ini = partes[0].split(' '), fim = partes[partes.length - 1].split(' '); for (let i = 0; i < ini.length; i++) for (let j = fim.length; j >= 1; j--) { const cand = [ini.slice(i).join(' ')].concat(partes.slice(1, -1), [fim.slice(0, j).join(' ').replace(/[.,;:]+$/, '')]).join(' > '); if (MenuBsoft.validarCaminho(cand).ok) return true; } return false; };
                return { erro, texto, fontes: ia.fontes.map(f => f.titulo), modelo: ia.modelo || '',
                    ptBR: !mcpPareceIngles(texto), semCodigo: Prereq.semCodigo(texto) === texto,
                    caminhos: caminhos.map(cm => ({ cm, ok: okCaminho(cm) })), numeros: paresNumero.map(n => ({ n, noCtx: noCtx(n) })), temLink: /https?:\\/\\//.test(texto) || /c\\.php\\?id=/.test(texto) };
            })()`);
            const checks = [];
            if (r.erro || !r.texto) checks.push(['a IA respondeu', false, 'sem resposta (erro ou tempo esgotado) — ' + seg + ' s']);
            else {
                checks.push(['a IA respondeu', true]); checks.push(['português (sem inglês)', r.ptBR]); checks.push(['sem código de parâmetro/funcionalidade', r.semCodigo]);
                checks.push(['resposta com corpo (> 250 caracteres)', r.texto.length > 250]);
                const ruins = r.caminhos.filter(x => !x.ok && x.cm.split(' > ').length >= 2);
                checks.push(['caminhos de menu existem no menu real', ruins.length === 0, ruins.map(x => x.cm).join(' | ')]);
                const inventados = r.numeros.filter(x => !x.noCtx);
                checks.push(['prazos citados vieram do material fornecido', inventados.length === 0, inventados.map(x => x.n).join(', ')]);
                checks.push(['sem link/endereço de tela', !r.temLink]);
                checks.push(['trouxe as fontes', r.fontes.length >= 1]);
                cen.deve.forEach(([re, nome]) => checks.push(['cita: ' + nome, re.test(r.texto)]));
                (cen.nao || []).forEach(([re, nome]) => checks.push(['NÃO manda ' + nome, typeof re === 'function' ? !re(r.texto) : !re.test(r.texto)]));
                if (cen.erro && /Como corrigir/i.test(r.texto)) { const ordem = ['Causa provável', 'Como corrigir', 'Depois de corrigir', 'Se não resolver'].map(s => r.texto.search(new RegExp(s, 'i'))); checks.push(['modo erro: as 4 seções na ordem certa', ordem.every((p, i) => p >= 0 && (i === 0 || p > ordem[i - 1])), ordem.join('<')]); }
            }
            resumo.total += checks.length; resumo.ok += checks.filter(x => x[1]).length;
            log('\n══════ ' + id + ' · ' + seg + ' s · ' + (r.modelo || '?') + ' ══════');
            log('PERGUNTA: ' + cen.pergunta);
            log('CHECAGENS: ' + checks.map(x => (x[1] ? '✔' : '✘') + x[0] + (x[1] || !x[2] ? '' : ' [' + x[2] + ']')).join('  '));
            log('FONTES: ' + (r.fontes || []).join(' | '));
            log('RESPOSTA:\n' + (r.texto || '(nenhuma)'));
            if (id === escolhidos[escolhidos.length - 1] || escolhidos.length === 1) { try { const sh = await c.send('Page.captureScreenshot', { format: 'png' }); const p = path.join(os.tmpdir(), 'migracao-mentor-real-' + id + '.png'); fs.writeFileSync(p, Buffer.from(sh.data, 'base64')); log('captura da tela: ' + p); } catch (e) { /* ok */ } }
            await ev("window.__msgs = null; true");
        }
    } catch (e) { log('ERRO NO TESTE: ' + String(e && e.stack || e).slice(0, 500)); }
    finally {
        try { c.fechar(); } catch (e) { /* ok */ }
        try { require('child_process').execSync('taskkill /PID ' + edge.pid + ' /T /F', { stdio: 'ignore' }); } catch (e) { try { edge.kill(); } catch (e2) { /* ok */ } }
    }
    log('\nRESUMO: ' + resumo.ok + ' de ' + resumo.total + ' checagens ✔ em ' + escolhidos.length + ' cenário(s)');
    if (saida) { try { fs.writeFileSync(saida, linhas.join('\n')); } catch (e) { /* ok */ } }
    process.exit(resumo.ok === resumo.total ? 0 : 1);
})();
