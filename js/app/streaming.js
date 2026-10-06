/* js/app/streaming.js — Leitura de respostas em streaming e cadeia de modelos. */
// ═══════════════════════════════════════════════════════════
//  HELPERS DE STREAMING
// ═══════════════════════════════════════════════════════════
function _makeThinkingFilter() {
    let buf = '', inThinking = false, out = '';
    return {
        push(chunk) {
            buf += chunk;
            while (true) {
                if (!inThinking) {
                    const si = buf.indexOf('<thinking>');
                    if (si === -1) {
                        // Hold back 9 chars max (length of '<thinking') to avoid splitting across chunks
                        const safe = Math.max(0, buf.length - 9);
                        out += buf.slice(0, safe); buf = buf.slice(safe); break;
                    }
                    out += buf.slice(0, si); buf = buf.slice(si + 10); inThinking = true;
                } else {
                    const ei = buf.indexOf('</thinking>');
                    if (ei === -1) { buf = buf.slice(Math.max(0, buf.length - 11)); break; }
                    buf = buf.slice(ei + 11); inThinking = false;
                }
            }
            return out;
        },
        finish() { if (!inThinking) out += buf; buf = ''; return out; }
    };
}

// Revela o texto acumulado num ritmo constante de caracteres por segundo, independente de quão
// rápido a IA manda os pedaços — com um modelo rápido, o stream de rede pode chegar quase todo de
// uma vez, e sem isso o texto "pula" pronto na tela em vez de aparecer fluido. atualizar() é
// chamado com o texto completo até agora (não só o pedaço novo) a cada chunk que chega; o ritmo
// nunca ultrapassa CPS, mas também nunca fica pra trás de quão rápido o texto real já chegou —
// se a IA está digitando devagar de verdade, a revelação acompanha no ritmo dela, sem esperar à
// toa. finalizar() avisa que não vem mais nada novo, só terminar de revelar o que ainda falta.
function _criarRevelacaoFluida(contentEl, opts = {}) {
    const CPS = opts.cps || 220; // caracteres por segundo — rápido de ler, mas dá pra acompanhar
    let textoCompleto = '', revelados = 0, streamAcabou = false, ultimoTs = null, animando = false;
    function passo(ts) {
        if (ultimoTs === null) ultimoTs = ts;
        revelados = Math.min(textoCompleto.length, revelados + ((ts - ultimoTs) / 1000) * CPS);
        ultimoTs = ts;
        const falta = revelados < textoCompleto.length;
        contentEl.innerHTML = renderMd(textoCompleto.slice(0, Math.floor(revelados))) + (falta || !streamAcabou ? '<span class="stream-cursor"></span>' : '');
        // Sem scrollToBottom aqui de propósito: a cada quadro (várias vezes por segundo) isso
        // puxava a página pra baixo o tempo todo durante o streaming, sem deixar o usuário ler
        // desde o começo da resposta enquanto ela ainda está sendo escrita. Em vez disso, só
        // atualiza o indicador "↓" flutuante -- ele avisa que ainda tem conteúdo vindo, sem forçar
        // a rolagem de ninguém.
        _atualizarBotaoScrollDown(falta || !streamAcabou);
        if (falta || !streamAcabou) { requestAnimationFrame(passo); } else { animando = false; }
    }
    function garantirAnimando() { if (!animando) { animando = true; ultimoTs = null; requestAnimationFrame(passo); } }
    return {
        atualizar(novoTextoCompleto) { textoCompleto = novoTextoCompleto; garantirAnimando(); },
        finalizar() { streamAcabou = true; garantirAnimando(); }
    };
}

async function _readSSEStream(resp, provider, onChunk) {
    const reader = resp.body.getReader();
    const dec = new TextDecoder();
    let buf = '';
    let finishReason = '';
    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buf += dec.decode(value, { stream: true });
            const lines = buf.split('\n');
            buf = lines.pop() ?? '';
            for (const line of lines) {
                if (!line.startsWith('data: ')) continue;
                const raw = line.slice(6).trim();
                if (raw === '[DONE]') return { finishReason };
                try {
                    const j = JSON.parse(raw);
                    const fr = j.choices?.[0]?.finish_reason || j.candidates?.[0]?.finishReason;
                    if (fr) finishReason = fr;
                    const chunk = provider === 'google'
                        ? (j.candidates?.[0]?.content?.parts?.filter(p => p.text)?.map(p => p.text)?.join('') ?? '')
                        : (j.choices?.[0]?.delta?.content ?? '');
                    if (chunk) onChunk(chunk);
                } catch {}
            }
        }
    } finally {
        try { reader.releaseLock(); } catch {}
    }
    return { finishReason };
}

async function callCurrentMCPStream(messages, config = {}) {
    const _conn = async (provider, model, apiKey, baseUrl) => {
        const preset = PROVIDER_PRESETS[provider];
        const isGoogle = provider === 'google';
        let url = baseUrl || preset.baseUrl;
        if (isGoogle) {
            url = preset.buildUrl(url, model, preset.chatEndpoint) + `?key=${apiKey}&alt=sse`;
        } else {
            url = url.replace(/\/+$/, '') + preset.chatEndpoint;
        }
        const body = preset.formatRequestBody(model, messages, config);
        if (!isGoogle) body.stream = true;
        const _ac = new AbortController();
        const _tid = setTimeout(() => _ac.abort(), 24000);
        let resp;
        try {
            resp = await fetch(url, { method: 'POST', headers: preset.headers(apiKey), body: JSON.stringify(body), signal: _ac.signal });
        } catch(e) {
            clearTimeout(_tid);
            if (e.name === 'AbortError') throw new Error(`[${provider}] timeout 12s`);
            throw e;
        }
        clearTimeout(_tid);
        if (!resp.ok) {
            const d = await resp.json().catch(() => ({}));
            throw Object.assign(new Error(`[${provider}] ${d.error?.message || 'HTTP ' + resp.status}`), { status: resp.status });
        }
        return resp;
    };

    // Cadeia de modelos: vem de config/mcp-config.js (ver js/core/mcp.js → mcpMontarCadeia):
    // modelo "prioritário" (se ativado) → principal → fallbacks, na ordem definida na Área Administrativa.
    // Os modelos da cadeia sempre usam as credenciais do provedor padrão (nunca as do modelo prioritário),
    // senão vira uma URL quebrada (modelo da OpenRouter colado na URL do Google) que o navegador só
    // reporta como erro de CORS.
    const chain = mcpMontarCadeia();

    const _skipModels = config.skipModels || [];
    const _activeChain = _skipModels.length ? chain.filter(c => !_skipModels.includes(c.model)) : chain;
    for (let i = 0; i < _activeChain.length; i++) {
        const c = _activeChain[i];
        try {
            console.log(`%c⭐ [Stream] Tentando ${c.model}...`, 'color:#0891b2;font-weight:600');
            const resp = await _conn(c.provider, c.model, c.apiKey, c.baseUrl);
            return { resp, provider: c.provider, iaUsada: c.label, iaModelo: c.model };
        } catch(e) {
            console.warn(`[Stream] ${c.model} falhou:`, e.message);
            if (i === _activeChain.length - 1) throw new Error('Todos os provedores falharam.');
        }
    }
}

// Saudação/agradecimento/despedida "pura" — responde na hora, sem gastar embedding nem chamada de
// IA nenhuma (nem precisa de um modelo pequeno pra isso: já sabe a resposta de cara). Só entra em
// ação quando a mensagem inteira é basicamente só isso — uma pergunta de verdade que comece com
// "bom dia, como eu..." continua indo pro fluxo normal, sem risco de ser interceptada à toa.
const _SAUDACOES_RAPIDAS = ['oi', 'ola', 'opa', 'eae', 'e ai', 'bom dia', 'boa tarde', 'boa noite', 'tudo bem', 'tudo bom', 'como vai', 'blz', 'beleza'];
const _AGRADECIMENTOS_RAPIDOS = ['obrigado', 'obrigada', 'brigado', 'brigada', 'valeu', 'vlw'];
const _DESPEDIDAS_RAPIDAS = ['tchau', 'ate mais', 'ate logo', 'falou', 'flw'];
function _respostaInstantanea(query) {
    const norm = query.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[!?.,]/g, '').trim();
    if (!norm || norm.length > 30) return null; // frase curta o bastante pra ser "só isso" e nada mais
    const bate = lista => lista.some(f => norm === f || norm.startsWith(f + ' ') || norm.endsWith(' ' + f));
    const info = obterSaudacao();
    if (bate(_AGRADECIMENTOS_RAPIDOS)) return `De nada! 😊 Qualquer outra dúvida, é só perguntar.`;
    if (bate(_DESPEDIDAS_RAPIDAS)) return `Até mais! ${info.emoji} Precisando, é só voltar aqui.`;
    if (bate(_SAUDACOES_RAPIDAS)) return `${info.emoji} ${info.saudacao}! Como posso te ajudar hoje?`;
    return null;
}
