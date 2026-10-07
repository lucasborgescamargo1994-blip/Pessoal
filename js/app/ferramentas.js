/* js/app/ferramentas.js — Ferramentas em ABAS: Erros SEFAZ, Criar Regra, Assistente de Relatórios e Parâmetros / Funcionalidades.

   Antes, esses assistentes escreviam dentro da conversa do chat (e obrigavam a abrir uma conversa nova para voltar ao chat).
   Agora cada um abre na sua própria aba do workspace, com a sua área de mensagens: a conversa do chat fica intacta e dá para
   alternar entre a ferramenta e o chat (ou ver as duas lado a lado, em tela dividida).

   Como funciona por baixo:
   • Cada ferramenta tem um painel (#paneSefaz, #paneRegra...) com uma área de mensagens própria (#ftStream_<id>).
   • Os módulos dos assistentes não escrevem mais direto no chat: chamam ferrMsg('<id>', ...), ferrCarregando('<id>', ...),
     ferrRolar('<id>', ...), ferrLog('<id>', ...) etc. Se não houver aba (Copilot e simulador, que não têm abas), tudo cai de volta
     no chat, exatamente como era antes.
   • LOG: TODA pergunta feita no CHAT gera a sua própria linha de log (a 1ª da conversa e as seguintes: ver js/app/feedback-log.js) e
     o uso de uma ferramenta tem o seu próprio registro (1 por sessão da ferramenta; "Nova consulta" começa outra sessão).
     Sem aba (Copilot), a ferramenta registra 1 vez por conversa — os assistentes chamam o log em várias etapas. */

const Ferr = (() => {
    const DEF = {};     // id → { iniciar(opcoes), entrada: { placeholder, rotulo } | null }
    const SESS = {};    // id → { iniciou, logado, ts, pergunta }
    const PEND = {};    // id → opções passadas por Ferr.abrir (lidas quando a aba aparece pela 1ª vez)
    const sess = id => (SESS[id] = SESS[id] || { iniciou: false, logado: false, ts: null, pergunta: '' });
    const streamEl = id => document.getElementById('ftStream_' + id);
    const emAba = id => !!streamEl(id);
    const disponivel = () => typeof Workspace !== 'undefined' && !!document.getElementById('wsStage');

    function registrar(id, def) { DEF[id] = def; }

    /* ── painel da ferramenta ─────────────────────────────────────────────── */
    function montar(id) {
        const t = TOOLS[id], p = t && document.getElementById(t.pane);
        if (!p || p.dataset.ft || !DEF[id]) return;
        p.dataset.ft = '1';
        const ent = DEF[id].entrada;
        p.innerHTML = `<div class="ft" style="--tool-c:${t.color}">
            <div class="ft-head">
                <div class="ft-title"><span class="ft-logo">${icon(t.icon, 20)}</span><div><h2>${esc(t.label)}</h2><p>${esc(t.desc)}</p></div></div>
                <div class="ft-head-end">
                    <button class="ft-btn" data-a="novo" type="button" title="Limpar esta aba e começar uma nova consulta">${icon('refresh', 15)}<span>Nova consulta</span></button>
                    <button class="ft-btn" data-a="chat" type="button" title="Voltar para o chat — a sua conversa continua como estava">${icon('chat', 15)}<span>Voltar ao chat</span></button>
                </div>
            </div>
            <div class="ft-stream" id="ftStream_${id}" data-ferr="${id}"></div>
            ${ent ? `<div class="ft-composer"><div class="ft-input-wrap"><input type="text" id="ftInput_${id}" placeholder="${esc(ent.placeholder || 'Digite aqui...')}" autocomplete="off" aria-label="${esc(ent.placeholder || 'Digite aqui')}"><button type="button" id="ftEnviar_${id}" class="ft-send" title="${esc(ent.rotulo || 'Buscar')}">${icon('search', 17)}<span>${esc(ent.rotulo || 'Buscar')}</span></button></div></div>` : ''}
        </div>`;
        p.querySelector('.ft-head').addEventListener('click', e => {
            const b = e.target.closest('[data-a]'); if (!b) return;
            if (b.dataset.a === 'novo') reiniciar(id);
            else if (b.dataset.a === 'chat') Workspace.open('chat');
        });
        if (ent) {
            const inp = document.getElementById('ftInput_' + id), enviar = () => { const v = inp.value.trim(); if (!v) return; inp.value = ''; try { if (DEF[id].entrada.aoEnviar) DEF[id].entrada.aoEnviar(v); } catch (err) { console.warn('[ferramenta]', id, err); } };
            document.getElementById('ftEnviar_' + id).addEventListener('click', enviar);
            inp.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); enviar(); } });
        }
    }
    async function iniciar(id, o) {
        const s = sess(id); s.iniciou = true;
        // veio de uma pergunta digitada no chat que JÁ gerou o log da conversa: a ferramenta usa esse mesmo registro (não cria outro) e o 👍/👎 vai para ele
        if (o && o.logTs) { s.logado = true; s.ts = o.logTs; s.pergunta = String(o.consulta || ''); }
        try { await DEF[id].iniciar(o || {}); }
        catch (e) { console.error('[ferramenta]', id, e); msg(id, 'ai', '⚠️ Não consegui abrir esta ferramenta agora. Clique em <b>Nova consulta</b> para tentar de novo.'); }
    }
    // chamada pelo workspace quando a aba aparece na tela
    function aoMostrar(id) {
        if (!DEF[id]) return;
        montar(id);
        if (!sess(id).iniciou) { const o = PEND[id] || {}; PEND[id] = null; iniciar(id, o); }
        const inp = document.getElementById('ftInput_' + id); if (inp && innerWidth > 768) setTimeout(() => inp.focus({ preventScroll: true }), 60);
    }
    // chamada pelo workspace quando a aba é FECHADA: a próxima abertura começa do zero
    function aoFechar(id) {
        SESS[id] = { iniciou: false, logado: false, ts: null, pergunta: '' };
        const s = streamEl(id); if (s) s.innerHTML = '';
    }
    function reiniciar(id, o) {
        if (!DEF[id]) return;
        const s = streamEl(id); if (s) s.innerHTML = '';
        SESS[id] = { iniciou: true, logado: false, ts: null, pergunta: '' };
        iniciar(id, o);
    }
    // abre (ou volta para) a aba da ferramenta. o: { novo, consulta, beside }
    function abrir(id, o = {}) {
        if (!disponivel() || !DEF[id]) return false;
        const jaTinha = !!sess(id).iniciou;
        PEND[id] = o;
        Workspace.open(id, { beside: !!o.beside });
        if (jaTinha && o.novo) reiniciar(id, o);
        PEND[id] = null;
        return true;
    }

    /* ── escrita na área de mensagens da ferramenta (ou, sem aba, no chat) ─── */
    function msg(id, sender, html) {
        if (!emAba(id)) return appendMessage(sender, html);
        const d = document.createElement('div');
        d.className = sender === 'ml' ? 'message ml-msg' : sender === 'system' ? 'message system-msg' : `message ${sender === 'user' ? 'user-msg' : 'ai-msg'}`;
        d.innerHTML = html; streamEl(id).appendChild(d); rolar(id, true); return d;
    }
    function carregando(id, texto) {
        if (!emAba(id)) return appendLoadingCard(texto);
        const d = document.createElement('div'); d.className = 'message ai-msg'; d.style.cssText = 'display:flex;align-items:center;gap:10px;';
        d.innerHTML = `<span>${texto || '🔍 Buscando...'}</span><span class="loading-dots"><span></span><span></span><span></span></span>`;
        streamEl(id).appendChild(d); rolar(id, true); return d;
    }
    function rolar(id, force) {
        if (!emAba(id)) return scrollToBottom(force);
        const s = streamEl(id); if (!s) return;
        if (force || s.scrollHeight - s.scrollTop - s.clientHeight < 120) s.scrollTop = s.scrollHeight;
    }
    const stream = id => streamEl(id) || document.getElementById('chatStream');
    const conversa = (id, sender, text) => { if (!emAba(id)) return adicionarMensagemNaConversa(sender, text); };   // ferramenta em aba não escreve na conversa do chat

    /* ── log ────────────────────────────────────────────────────────────────
       Em aba: 1 registro por sessão da ferramenta, independente da conversa do chat. Sem aba: igual ao chat. */
    function log(id, texto, achou = true) {
        if (!emAba(id)) return logSearch(texto, achou, undefined, { umaPorConversa: true });   // sem aba (Copilot): 1 por conversa — os assistentes chamam o log a cada etapa
        const s = sess(id);
        if (s.logado) return s.ts;
        s.pergunta = String(texto || '');
        const ts = registrarLog(s.pergunta, achou, { fonte: 'ferramenta' });
        if (ts) { s.logado = true; s.ts = ts; }
        return ts;
    }

    /* ── botão "Nova ..." usado dentro dos cartões de resposta ─────────────── */
    function botaoNovoHtml(id) {
        const css = 'display:flex;align-items:center;gap:6px;padding:6px 14px;border:1.5px solid var(--border);border-radius:8px;background:var(--surface);cursor:pointer;font-size:13px;font-weight:500;color:var(--text);transition:all .2s;';
        const hov = `onmouseover="this.style.borderColor='var(--primary)';this.style.background='var(--primary-light)'" onmouseout="this.style.borderColor='var(--border)';this.style.background='var(--surface)'"`;
        return emAba(id) ? `<button onclick="ferrNovo('${id}')" style="${css}" ${hov}>🔄 Nova consulta</button>` : `<button onclick="novaConversa()" style="${css}" ${hov}>➕ Nova conversa</button>`;
    }
    const novo = id => { if (emAba(id)) reiniciar(id); else novaConversa(); };

    return { registrar, disponivel, abrir, reiniciar, aoMostrar, aoFechar, emAba, stream, msg, carregando, rolar, conversa, log, botaoNovoHtml, novo,
        sessao: id => sess(id), ids: () => Object.keys(DEF) };
})();
// atalhos globais (usados dentro dos módulos dos assistentes e nos botões dos cartões — declarações de função, para valer também em onclick="...")
function ferrMsg(id, sender, html) { return Ferr.msg(id, sender, html); }
function ferrCarregando(id, texto) { return Ferr.carregando(id, texto); }
function ferrRolar(id, force) { return Ferr.rolar(id, force); }
function ferrConversa(id, sender, text) { return Ferr.conversa(id, sender, text); }
function ferrLog(id, texto, achou) { return Ferr.log(id, texto, achou); }
function ferrNovo(id) { return Ferr.novo(id); }
function ferrBotaoNovoHtml(id) { return Ferr.botaoNovoHtml(id); }
