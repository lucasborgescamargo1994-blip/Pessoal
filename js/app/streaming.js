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
// Põe no elemento o HTML do texto revelado até agora SEM refazer tudo. Antes, a cada quadro (60x por segundo) o conteúdo INTEIRO da resposta era jogado fora e recriado (centenas de
// elementos numa resposta longa, com leiaute e pintura de tudo de novo): era o que mais pesava enquanto a IA respondia, e quanto maior a resposta, pior. Agora só o que mudou é
// trocado (quase sempre o último pedaço). O resultado na tela é exatamente o mesmo (o conteúdo é igual ao que o innerHTML daria) — e o texto já mostrado deixa de ser recriado,
// então até dá para selecioná-lo enquanto a resposta continua chegando. O cursor continua sendo recriado a cada quadro, como antes (a animação dele reinicia e ele aparece sempre cheio).
function _atualizarConteudoFluido(el, html, comCursor) {
    try {
        const tpl = el.__tplFluido || (el.__tplFluido = document.createElement('template'));
        tpl.innerHTML = html;
        const cursorAntigo = el.lastChild && el.lastChild.nodeType === 1 && el.lastChild.classList.contains('stream-cursor') ? el.lastChild : null;
        if (cursorAntigo) el.removeChild(cursorAntigo);
        const novos = tpl.content.childNodes, velhos = el.childNodes;
        let i = 0;
        while (i < novos.length && i < velhos.length && velhos[i].isEqualNode(novos[i])) i++;   // o começo que não mudou fica como está
        while (el.childNodes.length > i) el.removeChild(el.lastChild);                         // sai o resto antigo (inclui o "Pensando…" do início)
        const resto = Array.prototype.slice.call(novos, i);                                     // (cópia: a lista de nós é "viva")
        for (let k = 0; k < resto.length; k++) el.appendChild(resto[k]);
        if (comCursor) { const c = document.createElement('span'); c.className = 'stream-cursor'; el.appendChild(c); }
    } catch (e) {
        el.innerHTML = html + (comCursor ? '<span class="stream-cursor"></span>' : '');   // qualquer imprevisto: o jeito de sempre
    }
}
// Regra "nunca o código (número) de parâmetro/funcionalidade" (Prereq.semCodigo, js/app/prerequisitos.js): tudo o que a IA escreve passa por aqui antes de ir para a tela. Sem o módulo, passa direto.
const _semCodigoParam = t => { try { return (typeof Prereq !== 'undefined' && Prereq.semCodigo) ? Prereq.semCodigo(t) : t; } catch (e) { return t; } };
function _criarRevelacaoFluida(contentEl, opts = {}) {
    const CPS = opts.cps || 220; // caracteres por segundo — rápido de ler, mas dá pra acompanhar
    let textoCompleto = '', revelados = 0, streamAcabou = false, ultimoTs = null, animando = false, aoTerminar = null;
    // Adaptação ao computador (v28.38): cada atualização da tela custa (refazer o HTML, estilo, leiaute) e cresce com o tamanho da resposta. Medido num i3 de 2 núcleos, uma resposta de 8.000 caracteres
    // consumia ~43 % da thread principal o tempo todo (ao digitar ou rolar durante a resposta, tudo travava). Se o passo anterior custou caro, pula quadros: o texto continua aparecendo na MESMA velocidade
    // (o ritmo é por tempo, não por quadro: só chega em pedaços maiores, 30 ou 20 vezes por segundo em vez de 60) e sobra thread principal. Em computador rápido (passo barato) nada muda.
    const ORCAMENTO_MS = 2.4;   // custo médio do passo (sem a pintura, que soma ~75 % por cima) que ainda deixa a resposta em ≈ 25 % da thread principal
    let custo = 0, intervalo = 0, ultimoRender = 0, ultimoBotao = 0;
    function passo(ts) {
        if (intervalo > 0 && ultimoRender && ts - ultimoRender < intervalo && (revelados < textoCompleto.length || !streamAcabou)) { requestAnimationFrame(passo); return; }   // quadro pulado (o fim da revelação nunca é adiado)
        const t0 = performance.now();
        if (ultimoTs === null) ultimoTs = ts;
        revelados = Math.min(textoCompleto.length, revelados + ((ts - ultimoTs) / 1000) * CPS);
        ultimoTs = ts;
        const falta = revelados < textoCompleto.length;
        _atualizarConteudoFluido(contentEl, renderMd(textoCompleto.slice(0, Math.floor(revelados))), falta || !streamAcabou);
        // Sem scrollToBottom aqui de propósito: a cada quadro (várias vezes por segundo) isso
        // puxava a página pra baixo o tempo todo durante o streaming, sem deixar o usuário ler
        // desde o começo da resposta enquanto ela ainda está sendo escrita. Em vez disso, só
        // atualiza o indicador "↓" flutuante -- ele avisa que ainda tem conteúdo vindo, sem forçar
        // a rolagem de ninguém.
        if (!falta && streamAcabou || ts - ultimoBotao > 160) { _atualizarBotaoScrollDown(falta || !streamAcabou); ultimoBotao = ts; }   // o botão ↓ lê o leiaute (força um cálculo da página inteira): ~6×/s basta para ele
        const gasto = performance.now() - t0; custo = custo ? custo * 0.6 + gasto * 0.4 : gasto;
        intervalo = custo > ORCAMENTO_MS ? Math.min(100, Math.ceil(custo / ORCAMENTO_MS) * 16.7 - 9) : 0; ultimoRender = ts;
        if (falta || !streamAcabou) { requestAnimationFrame(passo); }
        else { animando = false; if (aoTerminar) { const f = aoTerminar; aoTerminar = null; try { f(); } catch (e) { console.warn('[revelação] aoTerminar:', e); } } }
    }
    function garantirAnimando() { if (!animando) { animando = true; ultimoTs = null; requestAnimationFrame(passo); } }
    return {
        atualizar(novoTextoCompleto) { textoCompleto = _semCodigoParam(novoTextoCompleto); garantirAnimando(); },   // (o número do código nunca chega a aparecer, nem pela metade durante o streaming)
        // cb (opcional): chamado quando o último caractere acabou de aparecer (ex.: os botões de esclarecimento só entram depois do texto)
        // (rede de segurança: com a aba em segundo plano o navegador pausa o requestAnimationFrame — o cb sai por tempo, depois da duração normal da revelação)
        finalizar(cb) {
            streamAcabou = true;
            if (cb) {
                aoTerminar = cb;
                setTimeout(() => { if (aoTerminar) { const f = aoTerminar; aoTerminar = null; try { f(); } catch (e) { console.warn('[revelação] aoTerminar:', e); } } }, Math.min(6000, 700 + textoCompleto.length * 5));
            }
            garantirAnimando();
        }
    };
}

// Guarda do idioma: a resposta tem que sair em português do Brasil. A PREVENÇÃO é a instrução que vai em toda chamada à IA
// (js/core/mcp.js → mcpComIdioma). Esta é a rede de segurança para quando um modelo (ex.: o fallback North Mini) responde em inglês
// mesmo assim: não mostra o texto em inglês (espera ~140 caracteres para decidir), segura a revelação e, ao fim do stream, TRADUZ para
// pt-BR e só então entrega o texto. Uso: g.atualizar(texto) no lugar de revelacao.atualizar(texto); await g.concluir(textoFinal).
const _AVISO_TRADUZINDO = '<span class="stream-thinking">🌎 A IA respondeu em outro idioma — traduzindo para português do Brasil...</span><span class="stream-cursor"></span>';
function _criarGuardaIdioma(contentEl, revelacao) {
    let checado = false, ingles = false;
    return {
        atualizar(txt) {
            if (!checado && txt.length >= 140) {
                checado = true; ingles = mcpPareceIngles(txt);
                if (ingles) { console.warn('[idioma] resposta começou em inglês — vai ser traduzida para pt-BR'); contentEl.innerHTML = _AVISO_TRADUZINDO; }
            }
            if (checado && !ingles) revelacao.atualizar(txt);
        },
        // devolve { texto, traduzido, falhou }: texto já em pt-BR (ou o original, se não deu para traduzir)
        async concluir(txtFinal) {
            if (!String(txtFinal || '').trim() || (!ingles && !mcpPareceIngles(txtFinal))) return { texto: txtFinal };
            contentEl.innerHTML = _AVISO_TRADUZINDO;
            try {
                const t = await mcpTraduzirParaPtBr(txtFinal);
                if (t && !mcpPareceIngles(t)) { console.info('[idioma] resposta em inglês traduzida para pt-BR'); return { texto: t, traduzido: true }; }
            } catch (e) { console.warn('[idioma] não consegui traduzir:', e && e.message); }
            return { texto: '**⚠️ Esta resposta saiu em inglês e não consegui traduzi-la agora. Clique em “Nova conversa” e pergunte de novo, ou reformule a pergunta.**\n\n' + txtFinal, falhou: true };
        }
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
