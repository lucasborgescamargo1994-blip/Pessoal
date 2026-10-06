/* js/app/respostas-rapidas.js — Respostas rápidas aprovadas pela equipe.

   Como funciona:
   • A equipe revisa, na Área Administrativa (aba "Revisão"), as respostas que a IA deu. Aprovada → vira uma linha em
     "respostas_rapidas" no Supabase.
   • Quando alguém faz uma pergunta PARECIDA com uma aprovada, o chat mostra a resposta pronta na hora (sem gastar IA)
     — com o botão "Não era o que procurava? Clique aqui para pesquisar com a IA".
   • O índice fica em cache no IndexedDB e só baixa o que mudou (baixo consumo do plano gratuito do Supabase).
   A comparação das perguntas está em js/core/rr-match.js. Os limiares ficam em config/mcp-config.js ("respostasRapidas"). */

const RR = { itens: [], pronto: false, sync: '', erro: null };
const RR_CTX = new Map();   // contexto de cada cartão exibido (pergunta original, id da resposta, log...)

function _rrNormalizarItem(r) {
    let variantes = r.variantes;
    if (typeof variantes === 'string') { try { variantes = JSON.parse(variantes); } catch (e) { variantes = []; } }
    return { id: r.id, pergunta: r.pergunta || '', variantes: Array.isArray(variantes) ? variantes.filter(Boolean) : [], resposta: r.resposta || '', categoria: r.categoria || '', atualizado_em: r.atualizado_em || '' };
}

// Baixa só o que mudou desde a última vez (cache em IndexedDB). Se a tabela ainda não existir, o app segue normal.
async function carregarRespostasRapidas() {
    try {
        const cache = (await KV.get('rr_indice')) || { itens: [], sync: '' };
        const mapa = new Map((cache.itens || []).map(i => [i.id, i]));
        let sync = cache.sync || '';
        const novos = [], lote = 1000;
        for (let de = 0; ; de += lote) {
            let q = sb.from('respostas_rapidas').select('id,pergunta,variantes,resposta,categoria,ativo,atualizado_em').order('atualizado_em', { ascending: true }).range(de, de + lote - 1);
            q = sync ? q.gte('atualizado_em', sync) : q.eq('ativo', true);
            const { data, error } = await q;
            if (error) throw error;
            (data || []).forEach(r => novos.push(r));
            if (!data || data.length < lote) break;
        }
        novos.forEach(r => {
            if (r.ativo === false) mapa.delete(r.id); else mapa.set(r.id, _rrNormalizarItem(r));
            if ((r.atualizado_em || '') > sync) sync = r.atualizado_em;
        });
        // exclusões definitivas: confere só a lista de ids (leve)
        if (mapa.size) {
            const { data: ids, error: e2 } = await sb.from('respostas_rapidas').select('id').eq('ativo', true).range(0, 4999);
            if (!e2 && Array.isArray(ids)) { const vivos = new Set(ids.map(x => x.id)); Array.from(mapa.keys()).forEach(id => { if (!vivos.has(id)) mapa.delete(id); }); }
        }
        RR.itens = Array.from(mapa.values()); RR.sync = sync; RR.pronto = true; RR.erro = null;
        KV.set('rr_indice', { itens: RR.itens, sync });   // cache só local (IndexedDB)
        const novidades = novos.filter(r => (r.atualizado_em || '') > (cache.sync || '')).length;
        console.log(`⚡ [respostas rápidas] ${RR.itens.length} resposta(s) aprovada(s) carregada(s)${novidades ? ` (${novidades} novidade(s) desde a última vez)` : ''}`);
    } catch (e) {
        RR.erro = (e && e.message) || String(e);
        const cache = await KV.get('rr_indice');
        if (cache && Array.isArray(cache.itens)) { RR.itens = cache.itens; RR.pronto = true; }
        console.info('[respostas rápidas] não deu para atualizar agora (usando o que está em cache):', RR.erro);
    }
    _rrPrepararEmSegundoPlano();
    _rrPrepararConteudoEmSegundoPlano();
}

// Prepara (normaliza/sinônimos) as perguntas em pequenos blocos, para não travar a tela.
function _rrPrepararEmSegundoPlano() {
    const pend = RR.itens.filter(i => !i._prep);
    if (!pend.length) return;
    let k = 0;
    (function passo() {
        const fim = Math.min(k + 40, pend.length);
        for (; k < fim; k++) { try { RRMatch.prepararItem(pend[k]); } catch (e) { /* item inválido: ignora */ } }
        if (k < pend.length) setTimeout(passo, 10);
    })();
}

async function _rrVetorDe(texto) {   // vetor da pergunta cadastrada (cache por conteúdo); gera na Jina só na 1ª vez
    const chave = 'rrvec:' + RRMatch.hash(texto);
    let v = await KV.get(chave);
    if (!v) { v = await gerarEmbedding(texto); if (v) KV.set(chave, v); }
    return v;
}

// Procura uma resposta aprovada para a pergunta. Devolve { item, lex, sem, motivo, variante } ou null.
async function rrBuscar(query, vp) {
    const cfg = (MCP_CFG && MCP_CFG.respostasRapidas) || { ativo: true, limiarLexical: 0.8, limiarSemantico: 0.92, minTermos: 2 };
    if (!cfg.ativo || !RR.itens.length) return null;
    const alvo = RRMatch.preparar(query);
    if (!alvo.norm) return null;
    const lista = RR.itens.map(item => Object.assign({ item }, RRMatch.comparar(alvo, item)));

    // 1) idêntica ou bem parecida (termos em comum), com os mesmos números
    let melhor = null;
    lista.forEach(x => {
        if (!x.numerosOk) return;
        const passa = x.exato ? alvo.termos.length >= 1 : (alvo.termos.length >= cfg.minTermos && x.lex >= cfg.limiarLexical);
        if (passa && (!melhor || x.lex > melhor.lex)) melhor = Object.assign({ sem: null, motivo: x.exato ? 'idêntica' : 'parecida' }, x);
    });
    if (melhor) return melhor;

    // 2) parecida pelo significado: só entre as candidatas com alguma sobreposição de termos
    if (vp && alvo.termos.length >= cfg.minTermos) {
        const cands = lista.filter(x => x.numerosOk && x.lex >= RRMatch.MIN_CANDIDATA).sort((a, b) => b.lex - a.lex).slice(0, 3);
        if (cands.length) {
            const medidas = await Promise.race([
                Promise.all(cands.map(async x => { const v = await _rrVetorDe(x.variante); return { x, sem: v ? calcularSimilaridade(vp, v) : 0 }; })),
                new Promise(res => setTimeout(() => res([]), 4000))   // não segura o chat esperando a Jina
            ]);
            const bom = medidas.filter(m => m.sem >= cfg.limiarSemantico).sort((a, b) => b.sem - a.sem)[0];
            if (bom) return Object.assign({ sem: bom.sem, motivo: 'significado parecido' }, bom.x);
        }
    }
    return null;
}

/* ═══ Respostas aprovadas como CONHECIMENTO da IA ═══════════════════════════════════════════════════════════
   As respostas rápidas não servem só de atalho. Quando a pergunta NÃO é parecida o bastante para responder direto (ou quando o
   usuário clica em "pesquisar com a IA"), as respostas aprovadas mais relacionadas entram no prompt da IA como conhecimento já
   validado pela equipe — junto dos artigos do manual (ver handleChat em js/app/chat.js e a regra 11 do prompt).
   Como acha as relacionadas (sem gastar IA): 1) parecença da PERGUNTA cadastrada (e variantes) com a pergunta feita; 2) parecença
   de SIGNIFICADO (Jina) entre as melhores candidatas; 3) cobertura dos termos da pergunta dentro do TEXTO da resposta aprovada.
   Liga/desliga e quantidade: config/mcp-config.js → respostasRapidas.usarNoContexto / contextoMax (aba "IA / MCP" do painel). */
const RR_CTX_LIMITES = { lexical: 0.30, semantico: 0.75, cobertura: 0.70, coberturaMinTermos: 3 };
const RR_TR = new Map();   // "id|atualizado_em" → Set com os termos do texto da resposta (preenchido em segundo plano; não vai para o cache)
const _rrChaveTr = i => i.id + '|' + (i.atualizado_em || '');

function _rrPrepararConteudoEmSegundoPlano() {
    const pend = RR.itens.filter(i => !RR_TR.has(_rrChaveTr(i)));
    if (!pend.length) return;
    let k = 0;
    (function passo() {
        const fim = Math.min(k + 6, pend.length);   // blocos pequenos: o texto da resposta é bem maior que a pergunta
        for (; k < fim; k++) {
            const i = pend[k];
            try { RR_TR.set(_rrChaveTr(i), new Set(extrairTermosComSinonimos([i.pergunta].concat(i.variantes || [], [i.resposta]).join(' ')))); } catch (e) { /* item inválido: ignora */ }
        }
        if (k < pend.length) setTimeout(passo, 20);
    })();
}

// Respostas aprovadas relacionadas à pergunta (para o contexto da IA). Devolve [{ item, lex, sem, cob, score }], da mais para a menos relacionada.
// o.excluir: ids que NÃO devem entrar (ex.: a resposta rápida que o usuário acabou de dizer que "não era a procurada").
async function rrRelacionadas(query, vp, o = {}) {
    const cfg = (MCP_CFG && MCP_CFG.respostasRapidas) || {};
    if (cfg.usarNoContexto === false || !RR.itens.length) return [];
    const max = Math.min(6, Math.max(1, parseInt(cfg.contextoMax, 10) || 3));
    const excluir = new Set((o.excluir || []).map(String));
    const alvo = RRMatch.preparar(query);
    if (!alvo.termos.length) return [];
    const lista = [];
    for (const item of RR.itens) {
        if (excluir.has(String(item.id))) continue;
        const c = RRMatch.comparar(alvo, item);
        // números diferentes (ex.: outro código de rejeição) = outro assunto: não entra
        if (alvo.numeros && !c.numerosOk && RRMatch.preparar(c.variante).numeros) continue;
        const tr = RR_TR.get(_rrChaveTr(item));
        let achados = 0;
        if (tr) alvo.termos.forEach(t => { if (tr.has(t)) achados++; });
        lista.push({ item, lex: c.lex, variante: c.variante, achados, cob: tr ? achados / alvo.termos.length : 0, sem: null });
    }
    const base = x => Math.max(x.lex, x.cob * 0.7);
    const cands = lista.filter(x => base(x) >= RRMatch.MIN_CANDIDATA).sort((a, b) => base(b) - base(a)).slice(0, 5);
    if (vp && cands.length) {   // checagem por significado só nas melhores candidatas (cada vetor novo custa 1 chamada à Jina; depois fica em cache)
        await Promise.race([
            Promise.all(cands.map(async x => { try { const v = await _rrVetorDe(x.variante); x.sem = v ? calcularSimilaridade(vp, v) : null; } catch (e) { x.sem = null; } })),
            new Promise(res => setTimeout(res, 4000))   // não segura o chat esperando a Jina
        ]);
    }
    const L = RR_CTX_LIMITES;
    const entra = x => x.lex >= L.lexical || (x.sem != null && x.sem >= L.semantico) || (x.cob >= L.cobertura && x.achados >= L.coberturaMinTermos);
    const pontos = x => Math.max(x.lex, x.sem || 0, x.cob * 0.7);
    return lista.filter(entra).sort((a, b) => pontos(b) - pontos(a) || b.lex - a.lex).slice(0, max).map(x => Object.assign(x, { score: pontos(x) }));
}

// Texto que vai dentro do "📚 CONHECIMENTO" do prompt da IA
function rrMontarContexto(usadas) {
    if (!usadas || !usadas.length) return '';
    let out = '\n=== RESPOSTAS JÁ APROVADAS PELA EQUIPE DE SUPORTE (para perguntas parecidas) ===\n', total = 0;
    usadas.forEach((x, i) => {
        const lim = i === 0 ? 8000 : 4000;
        let txt = String(x.item.resposta || '').trim();
        if (!txt) return;
        if (txt.length > lim) txt = txt.slice(0, lim) + '\n[… a resposta aprovada continua; trecho cortado por tamanho]';
        if (i > 0 && total + txt.length > 16000) return;   // teto do bloco todo
        total += txt.length;
        out += `[APROVADA ${i + 1} - ${Math.round(x.score * 100)}%] Pergunta: ${x.item.pergunta}${x.item.categoria ? ' (categoria: ' + x.item.categoria + ')' : ''}\nResposta aprovada:\n${txt}\n---\n`;
    });
    return total ? out : '';
}

// Mostra o cartão da resposta rápida (com o botão "Não era o que procurava?...").
function rrMostrarResposta(m, query, ms) {
    const item = m.item, ctxId = 'rr' + Date.now();
    const logTs = logSearch(query, true, { fonte: 'rapida', resposta: item.resposta, resposta_rapida_id: item.id });
    RR_CTX.set(ctxId, { query, itemId: item.id, logTs, contextoMsg: null });
    const card = document.createElement('div');
    card.className = 'answer-card rr-card'; card.dataset.rrCtx = ctxId;
    const feedbackId = Date.now();
    const trace = BSOFT_SIM ? `<span class="rr-trace" title="Só aparece no simulador">🔬 ${escapeHtml(m.motivo)} · léxico ${(m.lex * 100).toFixed(0)}%${m.sem != null ? ' · significado ' + (m.sem * 100).toFixed(0) + '%' : ''}</span>` : '';
    card.innerHTML = `<div class="rr-head"><span class="rr-badge">⚡ Resposta rápida</span><span class="rr-sub">aprovada pela equipe${item.categoria ? ' · ' + escapeHtml(item.categoria) : ''}</span>${trace}</div>
        <div class="answer-section"><div class="section-content">${renderMd(item.resposta)}</div></div>
        <div class="feedback-area">
            <span class="feedback-util">Esta resposta foi útil?</span>
            <button class="feedback-btn" onclick="saveFeedback(${feedbackId},'positivo',this)">👍</button>
            <button class="feedback-btn" onclick="saveFeedback(${feedbackId},'negativo',this)">👎</button>
            <button class="btn-rr-ia" onclick="pesquisarComIA(this)">🔎 Não era o que procurava? Clique aqui para pesquisar com a IA</button>
            <button class="feedback-btn" onclick="novaConversa()">➕ Nova conversa</button>
        </div>`;
    document.getElementById('chatStream').appendChild(card);
    scrollToBottom(true);
    const texto = item.resposta.replace(/\*\*(.*?)\*\*/g, '$1');
    adicionarMensagemNaConversa('ai', texto);
    const c = getConversaAtiva();
    if (c && c.contexto.length) RR_CTX.get(ctxId).contextoMsg = c.contexto[c.contexto.length - 1];
    if (document.hidden) _enviarNotificacaoNavegador('🤖 Suporte Bsoft TMS respondeu', texto.replace(/[*_#`]/g, '').trim(), 'bsoft-ia-resposta');
    if (isCallActive) speak(texto);
    console.log(`%c⚡ [resposta rápida] #${item.id} (${m.motivo}, léxico ${(m.lex * 100).toFixed(0)}%${m.sem != null ? ', significado ' + (m.sem * 100).toFixed(0) + '%' : ''}) em ${Math.round(ms)}ms`, 'color:#d97706;font-weight:700');
    simEnviarAoPainel({ tipo: 'bsoft:sim:trace', fonte: 'rapida', pergunta: query, itemId: item.id, motivo: m.motivo, lex: m.lex, sem: m.sem, ms: Math.round(ms), bloqueios: window.BSOFT_SIM_BLOQUEIOS.length, bloqueiosLista: window.BSOFT_SIM_BLOQUEIOS.slice(-20) });
}

// Botão "Não era o que procurava? Clique aqui para pesquisar com a IA"
async function pesquisarComIA(btn) {
    const card = btn.closest('.answer-card');
    const ctx = card && RR_CTX.get(card.dataset.rrCtx);
    if (!ctx) return;
    btn.disabled = true; btn.textContent = '🔎 Pesquisando com a IA…';
    // avisa a equipe: essa resposta rápida não resolveu (aparece como feedback negativo no log)
    if (!BSOFT_SIM && ctx.logTs) {
        sb.from('logs').update({ feedback: 'Negativo', motivo: `Resposta rápida #${ctx.itemId} não era a procurada — pesquisou com a IA` }).eq('timestamp', ctx.logTs).then(() => {}, () => {});
    }
    // a resposta rejeitada não deve influenciar a IA: tira do contexto da conversa (continua visível na tela)
    const c = getConversaAtiva();
    if (c && ctx.contextoMsg) { c.contexto = c.contexto.filter(m => m !== ctx.contextoMsg); salvarConversas(); }
    const fa = btn.closest('.feedback-area');
    if (fa) fa.querySelectorAll('.feedback-btn, .feedback-util').forEach(n => { if (n.textContent.indexOf('Nova conversa') < 0) n.remove(); });
    await handleChat({ pergunta: ctx.query, forcarIA: true, reutilizarMensagem: true, excluirRr: [ctx.itemId] });   // a resposta que acabou de ser recusada também não entra no contexto da IA
    btn.remove();
}
