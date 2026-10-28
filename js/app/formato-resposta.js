/* js/app/formato-resposta.js — "Resposta curta" ou "Resposta completa detalhada": a pessoa escolhe como quer a resposta da IA.

   Logo depois da pergunta (quando a IA vai mesmo responder), o chat mostra dois botões:
     ⚡ Resposta curta — a IA vai direto ao ponto, só com o essencial para resolver (para quem não lê textão);
     📖 Resposta completa detalhada — como sempre foi: todos os passos, com todos os detalhes.
   A resposta CURTA termina com o botão "Resposta completa detalhada": se não bastar, a pessoa pede a completa sem perguntar de novo
   (a pergunta é refeita sem repetir a bolha, o log nem o cálculo do embedding; a curta continua na tela, mas sai do contexto da IA).
   Em Personalizar › "Formato da resposta" dá para fixar "sempre curta" ou "sempre completa" (e nunca mais ver os botões).
   Não pergunta: chamada de voz (não dá para clicar), "pesquisar com a IA", quando não achou nada no manual (a resposta é só "não encontrei")
   e quando a pessoa já fixou o formato. O padrão da escolha é 'perguntar'. A instrução de cada modo vai no fim do prompt (ver textoModo). */
const Formato = (() => {
    const CTX = new Map();      // cartões "como prefere?" na tela: id → { query, base }
    const CURTAS = new Map();   // respostas curtas na tela: ts → { opts (para refazer em modo completo), contextoMsg, usado }

    function preferencia() { try { const v = Prefs.get('formatoResposta'); return v === 'curta' || v === 'completa' ? v : 'perguntar'; } catch (e) { return 'perguntar'; } }

    // 'curta' | 'completa' | 'perguntar'
    //   o: { vum, voz, forcarIA, reuso, desambiguado }
    function decidir(o) {
        o = o || {};
        if (o.vum) return 'completa';        // sem resultado no manual: a resposta é só "não encontrei, reformule" — não há o que encurtar
        if (o.voz) return 'completa';        // chamada de voz: sem como clicar (e a fala já corta em 4000 caracteres)
        if (o.forcarIA) return 'completa';   // "Não era o que procurava? pesquisar com a IA": quer a busca mais funda
        const p = preferencia();
        if (p !== 'perguntar') return p;
        if (o.reuso && !o.desambiguado) return 'completa';   // outras repetições internas (nunca pergunta de novo no meio de um fluxo)
        return 'perguntar';
    }

    // Instrução que vai no prompt. 'completa' puro = nada (a IA responde como sempre respondeu).
    function textoModo(formato, expandida) {
        if (formato === 'curta') {
            return `\n⚡ MODO DA RESPOSTA — CURTA E OBJETIVA (escolha do cliente). ESTA INSTRUÇÃO TEM PRIORIDADE sobre a regra 5 (não omitir passos) e sobre qualquer pedido de resposta longa. O cliente quer chegar direto à solução, sem enrolação: responda em NO MÁXIMO 8 linhas. Comece já pela solução (sem saudação, sem introdução, sem repetir a pergunta, sem "espero ter ajudado"), dê só os passos e dados ESSENCIAIS para resolver, em lista numerada curta (uma linha por passo), sempre com o caminho de menu exato e os nomes exatos de campos e botões quando existirem. Corte explicações, contexto, exemplos, alternativas e observações — no máximo UMA observação, e só se for decisiva (algo que, esquecido, faria o cliente errar). EXCEÇÃO: se a regra 9 (PRÉ-REQUISITO) se aplicar, o bloco "⚙️ Antes de tudo, verifique:" continua OBRIGATÓRIO e vem PRIMEIRO, em no máximo 2 linhas por item (no máximo 2 itens; sem linha de ligação e sem "💡 Verifique também") (Descrição e Nome Interno do parâmetro/funcionalidade — nunca o código —, como precisa estar e onde conferir) — ele não conta nas 8 linhas nem como "observação". Todas as outras regras continuam valendo: use só o que está no conhecimento, nunca invente, caminhos de menu exatos. Se a solução tiver muitos passos, entregue os principais, na ordem certa, e pare; o cliente tem um botão para pedir a versão completa.\n`;
        }
        if (formato === 'completa' && expandida) {
            return `\n📖 MODO DA RESPOSTA — COMPLETA E DETALHADA (escolha do cliente): o cliente já recebeu a resposta curta e agora pediu a versão COMPLETA. Siga a regra 5 normalmente (todos os passos, na íntegra, com todos os detalhes) e não comente nem repita a resposta curta.\n`;
        }
        return '';
    }

    // Mostra o cartão com os dois botões. info: { vp, logTs } — base = opções do handleChat para a passada seguinte.
    function mostrar(query, opts, info) {
        info = info || {};
        const id = 'fmt' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
        CTX.set(id, { query, base: Object.assign({}, opts, { pergunta: query, reutilizarMensagem: true, formatoDecidido: true, vetor: info.vp || null, logTs: info.logTs === undefined ? null : info.logTs }) });
        const card = document.createElement('div');
        card.className = 'answer-card fmt-card';
        card.dataset.fmtCtx = id;
        card.setAttribute('role', 'group');
        card.setAttribute('aria-live', 'polite');
        card.setAttribute('aria-labelledby', id + 'h');
        card.innerHTML = `<div class="fmt-head" id="${id}h"><span aria-hidden="true">🧭</span> Como você prefere a resposta?</div>
            <div class="fmt-lista">
                <button type="button" class="fmt-op" data-f="curta" onclick="fmtEscolher(this)"><span class="fmt-ic" aria-hidden="true">⚡</span><span class="fmt-tx"><b>Resposta curta</b><small>direto ao ponto, sem enrolação</small></span></button>
                <button type="button" class="fmt-op" data-f="completa" onclick="fmtEscolher(this)"><span class="fmt-ic" aria-hidden="true">📖</span><span class="fmt-tx"><b>Resposta completa detalhada</b><small>todos os passos, com todos os detalhes</small></span></button>
            </div>
            <div class="fmt-dica">Depois da curta você pode pedir a completa com um clique. Quer fixar uma das duas? Personalizar › Formato da resposta.</div>`;
        document.getElementById('chatStream').appendChild(card);
        if (typeof scrollToBottom === 'function') scrollToBottom(true);
        return card;
    }

    async function escolher(btn) {
        const card = btn && btn.closest ? btn.closest('.fmt-card') : null;
        const ctx = card && CTX.get(card.dataset.fmtCtx);
        if (!ctx) return;                       // já escolhido, apagado ou de outra conversa
        CTX.delete(card.dataset.fmtCtx);        // (também impede o clique duplo)
        const f = btn.dataset.f === 'curta' ? 'curta' : 'completa';
        card.classList.add('is-resolvido');
        card.removeAttribute('aria-live');
        card.innerHTML = `<div class="fmt-ok" role="status">${f === 'curta' ? '⚡ Resposta curta' : '📖 Resposta completa detalhada'}</div>`;
        console.log(`%c🧭 [formato] ${f}`, 'color:#0369a1;font-weight:600;');
        try { const inp = document.getElementById('searchInput'); if (inp && window.innerWidth > 768) inp.focus({ preventScroll: true }); } catch (e) { /* conforto */ }
        await rodar(Object.assign({}, ctx.base, { formato: f }));
    }

    async function rodar(opts) {
        try { await handleChat(opts); }
        catch (e) {
            console.error('[formato] a resposta falhou:', e);
            const k = (typeof Desamb !== 'undefined') ? Desamb.guardarOpts(opts) : null;
            appendMessage('ai', '😕 Não consegui responder agora.' + (k ? ` <button type="button" onclick="this.closest('.message').remove();Desamb.refazer('${k}')" style="margin-left:6px;padding:4px 12px;border-radius:8px;background:var(--primary);color:#fff;border:none;cursor:pointer;font-weight:600;font-size:12.5px;">🔄 Tentar novamente</button>` : ''));
        }
    }

    // A resposta CURTA acabou de ser mostrada: guarda o que é preciso para refazê-la em modo completo (botão no fim dela).
    //   ts = id do cartão da resposta; query = a pergunta; opts = opções do handleChat desta passada; info: { vp, logTs }
    function registrarCurta(ts, query, opts, info) {
        info = info || {};
        CURTAS.set(String(ts), { opts: Object.assign({}, opts, { pergunta: query, reutilizarMensagem: true, formatoDecidido: true, formato: 'completa', expandida: true, vetor: info.vp || null, logTs: info.logTs === undefined ? null : info.logTs }), contextoMsg: null, usado: false });
    }
    // depois de a resposta entrar no contexto da conversa: guarda a mensagem (para tirá-la do contexto da IA se a pessoa pedir a completa)
    function marcarNoContexto(ts) {
        const r = CURTAS.get(String(ts)); if (!r) return;
        try { const c = getConversaAtiva(); if (c && c.contexto && c.contexto.length) r.contextoMsg = c.contexto[c.contexto.length - 1]; } catch (e) { /* só deixa de limpar */ }
    }

    // Botão "Resposta completa detalhada" no fim da resposta curta
    async function expandir(btn) {
        const card = btn && btn.closest ? btn.closest('.answer-card') : null;
        const r = card && CURTAS.get(String(card.dataset.fmtCurta));
        if (!r || r.usado) return;
        r.usado = true;
        btn.disabled = true; btn.textContent = '📖 Gerando a resposta completa abaixo…';
        // a resposta curta continua na tela, mas sai do contexto da IA (senão ela veria a própria resposta curta e a pergunta repetida)
        try { const c = getConversaAtiva(); if (c && r.contextoMsg) { c.contexto = c.contexto.filter(m => m !== r.contextoMsg); salvarConversas(); } } catch (e) { /* conforto */ }
        await rodar(Object.assign({}, r.opts));
        btn.textContent = '✔ Resposta completa aberta abaixo';
    }

    // Se a pessoa digitou outra pergunta sem escolher, o cartão antigo é apagado
    function encerrarPendentes() {
        document.querySelectorAll('.fmt-card:not(.is-resolvido)').forEach(card => {
            CTX.delete(card.dataset.fmtCtx);
            card.classList.add('is-resolvido');
            card.removeAttribute('aria-live');
            card.innerHTML = '<div class="fmt-ok">⏭️ Pergunta anterior: você seguiu para outro assunto.</div>';
        });
    }
    // Nova conversa / troca de conversa: os cartões saíram da tela, então os dados deles também saem da memória
    function limpar() { CTX.clear(); CURTAS.clear(); }

    return { preferencia, decidir, textoModo, mostrar, escolher, registrarCurta, marcarNoContexto, expandir, encerrarPendentes, limpar };
})();
function fmtEscolher(btn) { return Formato.escolher(btn); }
function fmtExpandir(btn) { return Formato.expandir(btn); }
