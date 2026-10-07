/* js/app/parametros.js — Busca de Parâmetros e Funcionalidades. */
// ═══════════════════════════════════════════════════════════
//  PARÂMETROS / FUNCIONALIDADES
// ═══════════════════════════════════════════════════════════
// Na ferramenta em aba ("params") a pergunta vem do campo da própria aba; no chat (Copilot/simulador, sem abas) vem do campo do chat.
async function handleParametrosFuncionalidades(queryParam, dest) {
    // Parâmetros/Funcionalidades não dependem de vetorização — dados carregados do Supabase em loadData
    if (dadosParametros.length === 0 && dadosFuncionalidades.length === 0) {
        ferrMsg(dest, 'ai', '⚠️ Dados ainda sendo carregados do servidor. Aguarde alguns segundos e tente novamente.');
        console.warn('⚙️ [PF Debug] dadosParametros e dadosFuncionalidades ainda vazios');
        return;
    }
    let query;
    if (Ferr.emAba(dest)) query = String(queryParam || '').trim();
    else {
        const input = document.getElementById('searchInput');
        query = input.value.trim();
        if (query) { input.value = ''; input.placeholder = 'Digite sua dúvida...'; }
    }
    if (!query) return;

    ferrMsg(dest, 'user', `⚙️ ${escapeHtml(query)}`);
    ferrConversa(dest, 'user', query);
    ferrLog(dest, 'Assistente de Parâmetros e Funcionalidades - ' + query, true);

    const ld = ferrCarregando(dest, 'Consultando Parâmetros e Funcionalidades...');

    // Normaliza texto: lowercase + sem acentos
    const _norm = t => String(t||'').toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,'');
    const _queryWords = _norm(query).split(/\s+/).filter(w => w.length > 2);

    // Score: quantas palavras da query aparecem no registro
    const _scoreItem = item => {
        const txt = _norm(Object.values(item).join(' '));
        return _queryWords.reduce((s, w) => s + (txt.includes(w) ? 1 : 0), 0);
    };

    // Filtra só os que têm ao menos 1 palavra em comum, máximo 8 por categoria
    const _filtrarRelevantes = lista =>
        lista.map(item => ({ item, score: _scoreItem(item) }))
             .filter(x => x.score > 0)
             .sort((a, b) => b.score - a.score)
             .slice(0, 8)
             .map(x => x.item);

    // Formata registro limitado a 500 chars para não estourar o contexto da IA
    const _formatarRegistro = item => Object.entries(item)
        .filter(([k, v]) => k !== 'id' && k !== 'created_at' && v != null && String(v).trim() !== '')
        .map(([k, v]) => `  ${k}: ${String(v).trim()}`)
        .join('\n')
        .substring(0, 500);

    const paramsRel = _filtrarRelevantes(dadosParametros);
    const funcsRel  = _filtrarRelevantes(dadosFuncionalidades);

    // ── DEBUG ──────────────────────────────────────────────────────────────
    console.group(`⚙️ [PF Debug] Query: "${query}"`);
    console.log(`📦 Dados: ${dadosParametros.length} parâmetros | ${dadosFuncionalidades.length} funcionalidades`);
    console.log(`🔤 Palavras buscadas: [${_queryWords.join(', ')}]`);
    console.log(`✅ Parâmetros encontrados: ${paramsRel.length}`);
    if (paramsRel.length > 0) paramsRel.slice(0,3).forEach((p,i) => console.log(`  P${i+1}:`, JSON.stringify(p).substring(0,150)));
    console.log(`✅ Funcionalidades encontradas: ${funcsRel.length}`);
    if (funcsRel.length > 0) funcsRel.slice(0,3).forEach((f,i) => console.log(`  F${i+1}:`, JSON.stringify(f).substring(0,150)));
    if (paramsRel.length === 0 && funcsRel.length === 0) console.warn('⚠️ NENHUM resultado — verifique se dadosParametros/dadosFuncionalidades estão carregados');
    console.groupEnd();
    // ───────────────────────────────────────────────────────────────────────

    if (paramsRel.length === 0 && funcsRel.length === 0) {
        ld.remove();
        if (dadosParametros.length === 0 && dadosFuncionalidades.length === 0) {
            ferrMsg(dest, 'ai', '⚠️ Os dados de Parâmetros e Funcionalidades ainda não foram carregados. Aguarde e tente novamente.');
        } else {
            ferrMsg(dest, 'ai', `⚠️ Não encontrei parâmetros ou funcionalidades relacionados a "<strong>${escapeHtml(query)}</strong>". Tente palavras-chave mais específicas.`);
        }
        return;
    }

    let ctx = '';
    if (paramsRel.length > 0) {
        ctx += '\n=== PARÂMETROS RELEVANTES ===\n';
        paramsRel.forEach((p, i) => { ctx += `\n[PARÂMETRO ${i+1}]\n${_formatarRegistro(p)}\n`; });
    }
    if (funcsRel.length > 0) {
        ctx += '\n=== FUNCIONALIDADES RELEVANTES ===\n';
        funcsRel.forEach((f, i) => { ctx += `\n[FUNCIONALIDADE ${i+1}]\n${_formatarRegistro(f)}\n`; });
    }

    const prompt = `Você é um especialista no sistema Bsoft TMS.

No sistema, rotinas exigem habilitar parâmetros e/ou funcionalidades para que opções apareçam em tela ou permitam executar ações específicas.

Abaixo estão os parâmetros e funcionalidades pré-selecionados como relevantes para a pergunta do usuário:

${ctx}

PERGUNTA DO USUÁRIO: "${query}"

INSTRUÇÕES:
- Apresente os resultados em DUAS seções obrigatórias:
  **📋 Parâmetros relacionados** — liste TODOS os parâmetros acima que se aplicam, com nome e o que cada um faz.
  **⚙️ Funcionalidades relacionadas** — liste TODAS as funcionalidades acima que se aplicam, com nome e o que cada uma faz.
- Se não houver nenhum em uma seção, escreva "Nenhum encontrado nesta seção."
- Inclua TODOS os itens relevantes das duas seções — não escolha apenas um.
- Ao final, lembre: após habilitar, acesse **Opções do Sistema > Atualizar Permissões**.
- Use **negrito** para nomes e caminhos de menu. Responda em Markdown limpo.\n- OBRIGATÓRIO: ao encerrar toda resposta completa, escreva \`#finalizado\` sozinho na última linha.`;

    let _pfCard = null;
    const _pfFilter = _makeThinkingFilter();
    try {
        const { resp: _resp, provider: _pr, iaUsada: _iu, iaModelo: _im } = await callCurrentMCPStream(
            [{ role: 'user', content: prompt }], { temperature: 0.3, maxTokens: 5000 }
        );
        ld.remove();

        const iaUsada = _iu || 'OpenRouter';
        const iaModelo = (_im || '').split('/').pop();
        const _cfg = iaUsada==='Gemini'?{emoji:'🌐',color:'#7c3aed',bg:'#f5f3ff',border:'#ddd6fe'}:iaUsada==='Custom'?{emoji:'🔌',color:'#059669',bg:'#f0fdf4',border:'#bbf7d0'}:{emoji:'⚡',color:'#0369a1',bg:'#f0f9ff',border:'#bae6fd'};
        const badge = `<span style="font-size:10px;color:${_cfg.color};background:${_cfg.bg};padding:2px 7px;border-radius:10px;border:1px solid ${_cfg.border};font-weight:600;">${_cfg.emoji} ${iaUsada}${iaModelo?' · '+iaModelo:''}</span>`;
        const ts = Date.now();
        const card = document.createElement('div'); card.className = 'answer-card'; _pfCard = card;
        card.innerHTML = `<div style="background:#f0fdf4;padding:8px 15px;border-bottom:1px solid #bbf7d0;font-size:11px;color:#166534;font-weight:600;">⚙️ Assistente de Parâmetros e Funcionalidades — Bsoft TMS</div>
            <div class="answer-section"><div class="section-content" id="_pf${ts}"><span class="stream-thinking">💭 Pensando e formando resposta...</span><span class="stream-cursor"></span></div></div>
            <div class="feedback-area" id="_pff${ts}" style="display:none">
                <span class="feedback-util">Esta resposta foi útil?</span>
                <button class="feedback-btn" onclick="saveFeedback(${ts},'positivo',this)">👍</button>
                <button class="feedback-btn" onclick="saveFeedback(${ts},'negativo',this)">👎</button>
                ${ferrBotaoNovoHtml(dest)}
                <button onclick="${Ferr.emAba(dest) ? `document.getElementById('ftInput_${dest}').focus()` : `_paramFuncMode=true;document.getElementById('searchInput').placeholder='Ex: CIOT, NF-e automática...';document.getElementById('searchInput').focus();`}" style="display:flex;align-items:center;gap:6px;padding:6px 14px;border:1.5px solid #bbf7d0;border-radius:8px;background:#f0fdf4;cursor:pointer;font-size:13px;font-weight:500;color:#166534;transition:all .2s;">⚙️ Nova busca de parâmetro</button>
                <span style="margin-left:auto;">${badge}</span>
            </div>`;
        Ferr.stream(dest).appendChild(card);
        ferrRolar(dest, true);

        const contentEl = document.getElementById('_pf' + ts);
        const feedbackEl = document.getElementById('_pff' + ts);
        const _revelacao = _criarRevelacaoFluida(contentEl); // ritmo fluido de exibição, independente da velocidade real do modelo
        const _guarda = _criarGuardaIdioma(contentEl, _revelacao);   // resposta sempre em português do Brasil (se vier inglês, traduz antes de mostrar)

        const { finishReason: _pfFR } = await _readSSEStream(_resp, _pr, chunk => {
            _guarda.atualizar(_pfFilter.push(chunk));
        });

        const _pfRaw = _pfFilter.finish();
        let finalText = _pfRaw.replace(/#finalizado\s*/gi, '').trim();
        // Truncado = API sinalizou limit de tokens. Ausência de #finalizado não é critério.
        const _pfTruncado = _pfFR === 'length' || _pfFR === 'max_tokens';
        if (_pfTruncado || !finalText) {
            contentEl.innerHTML = `<div style="color:var(--text-muted);font-style:italic;font-size:13px;margin-bottom:10px;">⚠️ A resposta não foi concluída. Tente novamente.</div>`;
            const _btnRetry = document.createElement('button');
            _btnRetry.textContent = '🔄 Tentar novamente';
            _btnRetry.style.cssText = 'padding:8px 18px;border-radius:8px;background:var(--primary);color:#fff;border:none;cursor:pointer;font-weight:600;font-size:13px;';
            _btnRetry.onclick = () => {
                card.remove();
                if (Ferr.emAba(dest)) handleParametrosFuncionalidades(query, dest);
                else { _paramFuncMode = true; document.getElementById('searchInput').value = query; handleChat(); }
            };
            contentEl.appendChild(_btnRetry);
            feedbackEl.style.display = 'flex';
            ferrRolar(dest, true);
            return;
        }
        finalText = (await _guarda.concluir(finalText)).texto;   // idioma: traduz se algum modelo respondeu em inglês
        // Sem forçar rolagem aqui: a revelação ainda pode estar no meio do caminho, e forçar
        // desceria a tela antes dela terminar de aparecer.
        _revelacao.atualizar(finalText);
        _revelacao.finalizar();
        feedbackEl.style.display = 'flex';
        ferrConversa(dest, 'ai', finalText.replace(/\*\*(.*?)\*\*/g, '$1'));
        if (document.hidden) {
            _enviarNotificacaoNavegador('🤖 Suporte Bsoft TMS respondeu', finalText.replace(/[*_#`]/g, '').trim(), 'bsoft-ia-resposta');
        }
        if (isCallActive) { speak(finalText); }
    } catch(e) {
        if (_pfCard) {
            const ce = _pfCard.querySelector('.section-content');
            const fe = _pfCard.querySelector('.feedback-area');
            if (ce) ce.innerHTML = '<p style="color:#dc2626;">⚠️ Resposta interrompida. Tente novamente.</p>';
            if (fe) fe.style.display = 'flex';
        } else {
            ld.remove();
            ferrMsg(dest, 'ai', '😕 <b>Não encontrei</b> nos Parâmetros/Funcionalidades. Tente reformular a busca.');
            ferrConversa(dest, 'ai', 'Não encontrei nos Parâmetros/Funcionalidades. Tente reformular a busca.');
        }
    }
}

// ── ferramenta em aba (Workspace → "Parâmetros / Funcionalidades"): tem o próprio campo de busca ──
Ferr.registrar('params', {
    entrada: { placeholder: 'Ex: CIOT, NF-e automática, exclusão de CT-e, permissão de emissão…', rotulo: 'Buscar', aoEnviar: q => handleParametrosFuncionalidades(q, 'params') },
    iniciar(o) {
        ferrMsg('params', 'ai', '⚙️ <strong>Parâmetros / Funcionalidades</strong><br>Digite o que você precisa habilitar ou configurar e pressione Enter.<br><small style="color:var(--text-muted);">Ex: <em>CIOT, NF-e automática, exclusão de CT-e, permissão de emissão...</em></small>');
        if (o && o.consulta) handleParametrosFuncionalidades(o.consulta, 'params');   // veio de uma sugestão do chat: já pesquisa o que foi perguntado
    },
});