/* js/app/chat.js — Lógica principal do chat (handleChat). */
// ═══════════════════════════════════════════════════════════
//  LÓGICA DE CHAT PRINCIPAL (com Repositório integrado)
// ═══════════════════════════════════════════════════════════
// opts (uso interno, ex.: botão "pesquisar com a IA" da resposta rápida):
//   { pergunta, forcarIA, reutilizarMensagem } — refaz a pergunta já exibida, sem repetir a bolha do usuário
//   e sem procurar de novo nas respostas rápidas.
async function handleChat(opts) {
    opts = (opts && typeof opts === 'object' && !(typeof Event !== 'undefined' && opts instanceof Event)) ? opts : {};
    const _reuso = !!opts.reutilizarMensagem;
    if (_paramFuncMode && !_reuso) { _paramFuncMode = false; return handleParametrosFuncionalidades(); }
    const ch = obterContextoHorario();
    if (isVectorizing) return;
    const input = document.getElementById('searchInput');
    const query = (opts.pergunta ? String(opts.pergunta) : input.value).trim();
    if (!query) return;

    // Perguntas sobre a agenda pessoal ("quais tarefas tenho hoje?", "tarefa: ligar para o cliente amanhã 14h") são respondidas aqui, na tela:
    // não vão para a IA, não entram no histórico da conversa e não geram log (os dados são pessoais e ficam só no computador do usuário).
    if (!_reuso && typeof V !== 'undefined' && V.AgendaChat && V.AgendaChat.tratar(query)) return;

    // Oculta o card de boas-vindas ao enviar a primeira mensagem
    const _wm = document.getElementById('welcomeMsg');
    if (_wm) { _wm.style.transition = 'opacity .25s'; _wm.style.opacity = '0'; setTimeout(() => _wm.remove(), 250); }

	const queryNormalizada = normalizarSinonimos(query);
    const fn = ["não deu", "não funcionou", "continuo com erro", "ainda não", "não deu certo", "proximo", "próximo", "outra opção", "mais alguma", "próxima solução"];
    const uqp = !_reuso && fn.some(f => query.toLowerCase().includes(f));

    if (uqp && filaSolucoes.length > 0) {
        appendMessage('user', query); adicionarMensagemNaConversa('user', query); input.value = "";
        processarProximaSolucao(lastQuery); return;
    }

    filaSolucoes = []; lastQuery = query;
    if (!_reuso) { appendMessage('user', query); adicionarMensagemNaConversa('user', query); input.value = ""; }

    const conversa = getConversaAtiva();
    if (conversa) { const dd = detectarDocumento(query.toLowerCase()); if (dd) { conversa.documentoContexto = dd; conversa.topicoAtual = query; salvarConversas(); } }

    if (!_reuso && ehCriacaoRegra(query)) {
        const _rr = await perguntarAuxilioRegra();
        if (_rr === 'sim' && Ferr.disponivel()) {
            // o assistente abre na própria aba (o chat fica como está). A 1ª pergunta da conversa gera o log aqui e a ferramenta reaproveita esse registro.
            Ferr.abrir('regra', { consulta: query, novo: true, logTs: logSearch(query, true) });
            appendMessage('system', '📋 Abri o <b>Criar Regra</b> em uma aba. Quando terminar, volte pela aba <b>Chat</b> — a conversa continua aqui.');
            return;
        }
        if (_rr === 'sim') {
            const _tipo = await perguntarTipoRegra();
            if (_tipo === 'cte') {
                const _modoCte = await perguntarModoCte();
                if (_modoCte === 'dnd') { logSearch(query, true); mostrarWizardRegraDnd(query); return; }
                if (_modoCte === 'classico') { logSearch(query, true); mostrarWizardRegra(query); return; }
                return;
            }
            if (_tipo === 'contrato') {
                const _modo = await perguntarModoContrato();
                if (_modo === 'dnd') { logSearch(query, true); mostrarWizardContratoDnd(query); return; }
                if (_modo === 'classico') { logSearch(query, true); mostrarWizardContrato(query); return; }
                return;
            }
            if (_tipo === 'faturamento') { logSearch(query, true); mostrarWizardFaturamento(query); return; }
            return;
        }
        // 'nao' → continua busca normal no banco
    }

    if (!_reuso && ehErroSefaz(query)) {
        const r = await wizardRejeicaoSefaz(true);
        if (!r) return;
        if (!r.bancoDados) { logSearch(`Erros Sefaz - ${r.codigo} (${r.tipo})`, true); await gerarRespostaSefaz(r.codigo, r.tipo); return; }
        // r.bancoDados === true → continua no fluxo normal abaixo
    }

    if (!_reuso && ehAssistenteRelatorios(query)) {
        if (Ferr.disponivel()) {
            Ferr.abrir('relatorios', { consulta: query, novo: true, logTs: logSearch(query, true) });
            appendMessage('system', '📊 Abri o <b>Assistente de Relatórios</b> em uma aba. Quando terminar, volte pela aba <b>Chat</b> — a conversa continua aqui.');
        } else mostrarWizardRelatorio();
        return;
    }

    const _saudacaoInstantanea = _reuso ? null : _respostaInstantanea(query);
    if (_saudacaoInstantanea) {
        appendMessage('ai', _saudacaoInstantanea);
        adicionarMensagemNaConversa('ai', _saudacaoInstantanea);
        if (document.hidden) { _enviarNotificacaoNavegador('🤖 Suporte Bsoft TMS respondeu', _saudacaoInstantanea, 'bsoft-ia-resposta'); }
        if (isCallActive) { speak(_saudacaoInstantanea); }
        return;
    }

    const _t0 = performance.now();
    const _tp = (label, from) => console.log(`%c⏱️ [handleChat] ${label}: ${(performance.now()-from).toFixed(0)}ms`, 'color:#f97316;font-weight:600;');

    const ld = appendLoadingCard("🧠 Elaborando sua resposta...");
    const _t2 = performance.now();
    const vp = await gerarEmbedding(queryNormalizada);
    _tp('gerarEmbedding', _t2);

    // ── Resposta rápida aprovada (pergunta parecida com uma já revisada pela equipe) ──
    // Pulada quando o usuário acabou de dizer "não era o que procurava" (opts.forcarIA).
    if (!opts.forcarIA) {
        try {
            const _rr = await rrBuscar(query, vp);
            if (_rr) { ld.remove(); rrMostrarResposta(_rr, query, performance.now() - _t0); return; }
        } catch (e) { console.warn('[respostas rápidas] busca falhou, seguindo para a IA:', e); }
    }
    const _t3 = performance.now();
    let rr = [];
    if (vp) {
        // Busca vetorial (caminho normal)
        const _todos = manualVetorizado.map(item => ({ ...item, similaridade: calcularSimilaridade(vp, item.vetor) })).sort((a, b) => b.similaridade - a.similaridade);
        // Se similaridade máxima < 0.1, houve incompatibilidade de dimensão (ex: vetor Llama fallback vs vetores Gemini armazenados)
        if (_todos.length > 0 && _todos[0].similaridade >= 0.1) {
            const _topN = _todos[0].similaridade > 0.85 ? 5 : _todos[0].similaridade > 0.65 ? 8 : 12;
            rr = _todos.slice(0, _topN);
        }
    }
    // Reforço por palavra-chave literal: mesmo quando a busca vetorial "funciona" (achou algo com
    // confiança), um artigo grande cobrindo VÁRIOS assuntos de uma vez (ex.: uma lista com ~150
    // opções de tela diferentes, de telas diferentes, num único artigo) tem sua similaridade
    // "diluída" pelo resto do conteúdo, e pode nem entrar no topN mesmo contendo a resposta exata
    // (caso real: "Limpar Data de Encerramento Automático" -- artigo caiu na posição 27, de resto
    // 500+, só por estar junto de mais ~150 outras opções não relacionadas). Aqui, à parte da busca
    // vetorial, procura o artigo com MAIS palavras da pergunta batendo literalmente no conteúdo; se
    // for um artigo forte (70%+ das palavras da pergunta aparecem literalmente nele) e ele ainda
    // não estiver no resultado vetorial, adiciona ele também -- não troca nem reordena o que a
    // busca vetorial já achou, só reforça.
    if (rr.length > 0) {
        const _normKw = t => String(t||'').toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,'');
        const _wordsKw = _normKw(queryNormalizada).split(/\s+/).filter(w => w.length > 2);
        if (_wordsKw.length >= 2) {
            const _jaIncluido = new Set(rr.map(r => r.idSupabase || r.erro));
            const _fonteKw = bancoCompletoRaw.length > 0 ? bancoCompletoRaw : manualVetorizado;
            const _melhorPalavraChave = _fonteKw
                .map(item => {
                    const txt = _normKw((item.erro || item.titulo || '') + ' ' + (item.solucao || item.conteudo || ''));
                    const hits = _wordsKw.filter(w => txt.includes(w)).length;
                    return { item, sim: hits / _wordsKw.length };
                })
                .filter(x => x.sim >= 0.7 && !_jaIncluido.has(x.item.idSupabase || x.item.erro))
                .sort((a, b) => b.sim - a.sim)[0];
            if (_melhorPalavraChave) rr.push({ ..._melhorPalavraChave.item, similaridade: _melhorPalavraChave.sim, _reforcoPalavraChave: true });
        }
    }
    // Fallback por palavras-chave: embedding null OU incompatibilidade de dimensão (Llama vs Gemini)
    if (rr.length === 0) {
        const _norm = t => String(t||'').toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,'');
        const _words = _norm(queryNormalizada).split(/\s+/).filter(w => w.length > 2);
        if (_words.length > 0) {
            const _fonte = bancoCompletoRaw.length > 0 ? bancoCompletoRaw : manualVetorizado;
            rr = _fonte
                .map(item => {
                    const txt = _norm((item.erro || item.titulo || '') + ' ' + (item.solucao || item.conteudo || ''));
                    const hits = _words.filter(w => txt.includes(w)).length;
                    return { ...item, similaridade: hits / _words.length };
                })
                .filter(item => item.similaridade > 0)
                .sort((a, b) => b.similaridade - a.similaridade)
                .slice(0, 10);
        }
    }
    _tp('buscaVetorial (map+sort)', _t3);

    // ── DEBUG: mostra o que foi encontrado no banco e qual método foi usado ──
    console.group(`🔍 [DB Debug] Pergunta: "${query.substring(0, 80)}"`);
    console.log(`📐 Embedding: ${vp ? `gerado (${vp.length} dims)` : 'FALHOU → busca por palavras-chave'}`);
    console.log(`📚 Banco carregado: ${manualVetorizado.length} artigos vetorizados | ${bancoCompletoRaw.length} artigos raw`);
    console.log(`🎯 Método de busca: ${vp && rr.length > 0 && rr[0].similaridade >= 0.1 ? 'VETORIAL (Jina)' : 'PALAVRAS-CHAVE'}`);
    if (rr.length > 0) {
        console.log(`📋 Top ${rr.length} resultado(s) encontrado(s):`);
        rr.forEach((r, i) => {
            if (i >= 5 && !r._reforcoPalavraChave) return; // top 5 + reforço (se existir), sem poluir o log
            const titulo = r.erro || r.titulo || '(sem título)';
            const sim = (r.similaridade * 100).toFixed(1);
            const fonte = r.isRepositorio ? '📁 Repositório' : '🗃️ BancoDados';
            const tag = r._reforcoPalavraChave ? ' 🔤 [reforço por palavra-chave]' : '';
            console.log(`  ${i+1}. [${sim}%] ${fonte} — ${titulo.substring(0, 80)}${tag}`);
        });
    } else {
        console.warn('⚠️ NENHUM artigo encontrado! A IA vai responder sem contexto do banco.');
    }
    console.groupEnd();
    // ────────────────────────────────────────────────────────────────────────

    // ── Respostas JÁ APROVADAS pela equipe também são CONHECIMENTO da IA (não só atalho) ──
    // Quando a pergunta não foi parecida o bastante para responder direto (ou o usuário pediu "pesquisar com a IA"), as respostas
    // aprovadas mais relacionadas entram no prompt, junto dos artigos. Se alguma foi recusada agora há pouco (opts.excluirRr), fica de fora.
    let rrCtx = '', rrUsadas = [];
    try {
        rrUsadas = await rrRelacionadas(query, vp, { excluir: opts.excluirRr });
        rrCtx = rrMontarContexto(rrUsadas);
        if (rrUsadas.length) console.log(`%c⚡ [respostas aprovadas no contexto da IA] ${rrUsadas.map(x => '#' + x.item.id + ' (' + Math.round(x.score * 100) + '%: termos ' + Math.round(x.lex * 100) + '%' + (x.sem != null ? ', significado ' + Math.round(x.sem * 100) + '%' : '') + ', texto ' + Math.round(x.cob * 100) + '%)').join(' · ')}`, 'color:#d97706;font-weight:600;');
    } catch (e) { console.warn('[respostas rápidas] não deu para usar as aprovadas como contexto, seguindo só com os artigos:', e); rrUsadas = []; rrCtx = ''; }

    const trb = rr.length > 0 && rr[0].similaridade > 0.65;
    let ar = "";
    if (rr.length > 0) { ar = "\n=== ARTIGOS MAIS RELEVANTES ===\n"; rr.forEach((r, i) => { const _limSol = i === 0 ? 999999 : i < 3 ? 4000 : 1000; const _limEmit = i === 0 ? 999999 : 800; ar += `[RELEVANTE ${i + 1} - ${(r.similaridade * 100).toFixed(0)}%] ${r.erro}\nSolução: ${r.solucao.substring(0, _limSol)}\n${r.emitir ? 'Emissão: ' + r.emitir.substring(0, _limEmit) + '\n' : ''}---\n`; }); }

    let mi = "", vum = false;
    if (!trb && rr.every(r => r.similaridade < 0.5) && !rrUsadas.some(x => x.score >= 0.5)) { vum = true; mi = `\n⚠️ ATENÇÃO: Nenhum resultado encontrado no manual (max: ${rr.length > 0 ? (rr[0].similaridade * 100).toFixed(0) : 0}%).\n`; }

    const _logTs = logSearch(query, !vum);   // timestamp da linha de log DESTA pergunta (toda pergunta gera a sua; null no simulador): a resposta e o 👍/👎 vão para ela

    let conhecimentoRepositorio = '';
    if (!trb || vum) {
        const _t4 = performance.now();
        const repoKnowledge = await buscarConhecimentoRelevanteNoRepositorio(query);
        _tp('buscarRepositorio', _t4);
        if (repoKnowledge) { conhecimentoRepositorio = repoKnowledge; appendMessage('system', '📁 <strong>Documento relevante encontrado no repositório!</strong>'); }
    }

    const cc = conversa ? conversa.contexto.slice(-6) : [];
    let hc = ""; if (cc.length > 0) { hc = "\n=== HISTÓRICO DA CONVERSA ===\n"; cc.forEach(m => { hc += `${m.role === 'user' ? '👤 Cliente' : '🤖 Suporte'}: ${m.content.substring(0, 800)}\n`; }); }

    const dc = conversa?.documentoContexto || detectarDocumento(query.toLowerCase());
    const es = buildContextoSistema(query, dc);

    // Busca por similaridade de palavras-chave em Parâmetros e Funcionalidades
    let pfCtx = '';
    try {
        const _nPF = t => String(t||'').toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,'');
        const _wPF = _nPF(query).split(/\s+/).filter(w => w.length > 2);
        if (_wPF.length > 0) {
            // similaridade 0-1: proporção de palavras da query presentes no registro
            const _simPF = item => { const txt = _nPF(Object.values(item).join(' ')); return _wPF.filter(w => txt.includes(w)).length / _wPF.length; };
            // formata apenas campos relevantes, limitado a 250 chars por registro
            const _fPF = item => Object.entries(item).filter(([k,v]) => k!=='id'&&k!=='created_at'&&v!=null&&String(v).trim()!=='').map(([k,v]) => `  ${k}: ${String(v).trim()}`).join('\n').substring(0, 250);
            // mínimo: ao menos 2 palavras coincidem (ou 100% se query tiver 1 palavra)
            const _minSim = Math.min(2, _wPF.length) / _wPF.length;
            const pm = dadosParametros.map(p=>({item:p,sim:_simPF(p)})).filter(x=>x.sim>=_minSim).sort((a,b)=>b.sim-a.sim).slice(0,5);
            const fm = dadosFuncionalidades.map(f=>({item:f,sim:_simPF(f)})).filter(x=>x.sim>=_minSim).sort((a,b)=>b.sim-a.sim).slice(0,5);
            if (pm.length > 0 || fm.length > 0) {
                pfCtx = '\n=== PARÂMETROS E FUNCIONALIDADES RELACIONADOS ===\n';
                pm.forEach((x,i) => { pfCtx += `\n[PARÂMETRO ${i+1} - sim:${(x.sim*100).toFixed(0)}%]\n${_fPF(x.item)}\n`; });
                fm.forEach((x,i) => { pfCtx += `\n[FUNCIONALIDADE ${i+1} - sim:${(x.sim*100).toFixed(0)}%]\n${_fPF(x.item)}\n`; });
            }
        }
    } catch(e) {}

    // Busca na tabela Rotinas (telas/funções cadastradas) -- ajuda a responder "onde fica X"/"como
    // acesso X" com o nome oficial e o id real da rotina, em vez de arriscar inventar.
    let rotinasCtx = '';
    try {
        const rotinasRel = _buscarRotinasRelevantes(query, 3);
        if (rotinasRel.length > 0) {
            rotinasCtx = '\n=== ROTINAS RELACIONADAS ===\n';
            rotinasRel.forEach((x,i) => { rotinasCtx += `\n[ROTINA ${i+1} - sim:${(x.sim*100).toFixed(0)}%]\n${_formatarRotinaParaPrompt(x.item)}\n`; });
        }
    } catch(e) {}

    const ps = `🏢 VOCÊ É UM AGENTE DE SUPORTE DA BSOFT TMS\n\n${ch}\n\n🎯 Atenda o cliente de forma PROFISSIONAL e DIDÁTICA.\n\nREGRAS OBRIGATÓRIAS:\n1. Use APENAS as informações contidas no CONHECIMENTO abaixo. Nada além.\n2. NUNCA invente. Se não encontrar a resposta no conhecimento fornecido, diga claramente que não encontrou e peça para reformular.\n3. ⚠️ CAMINHOS DE MENU — PROIBIDO INVENTAR: Só cite um caminho de menu (ex: "Transporte > Documentos > Ct-e") se ele aparecer LITERALMENTE nos CAMINHOS DO MENU ou na solução do artigo fornecido. Se o caminho não estiver explícito no conhecimento abaixo, NÃO mencione nenhum caminho — escreva apenas "acesse pelo menu do sistema" sem inventar a navegação.\n4. Procedimentos e passos: só descreva o que estiver documentado na solução. Não crie etapas extras por lógica própria.\n5. ⚠️ NÃO OMITA NADA DA SOLUÇÃO — REGRA ABSOLUTA: Reproduza TODOS os passos da solução do artigo, na íntegra. É PROIBIDO: resumir, condensar, escrever "etc.", "e assim por diante", pular etapas, ou dizer "siga os passos normais". Se a solução tem 10 passos, escreva os 10 completos com todos os detalhes. O público é suporte iniciante que não conhece o sistema — cada detalhe é essencial para resolver o problema. Prefira respostas longas e completas a respostas curtas e incompletas.\n6. Mantenha o contexto da conversa.\n7. Seja conversacional e humano.\n8. Diferencie: CT-e, MDF-e, NF-e, NFS-e, Minuta, OC, CIOT, VPO.\n9. PARÂMETROS E FUNCIONALIDADES: Se a seção "PARÂMETROS E FUNCIONALIDADES RELACIONADOS" contiver itens relevantes para a pergunta, mencione-os ao final da resposta como opção adicional — ex: "💡 Verifique também se o parâmetro/funcionalidade X está habilitado, pois pode estar relacionado a esta situação."\n10. ROTINAS: Se a seção "ROTINAS RELACIONADAS" tiver algo relevante pra pergunta (ex.: "onde fica X", "como acesso X"), use o Nome oficial pra confirmar como a tela/função se chama. Só inclua o nome interno/caminho técnico da rotina se isso realmente ajudar (ex.: pedido claramente técnico) -- e nesse caso, deixe claro que o caminho técnico precisa ser completado com o endereço do sistema do próprio cliente antes (cada empresa Bsoft tem o seu). Nunca invente nome oficial nem id de rotina que não estejam listados aqui.\n11. RESPOSTAS APROVADAS PELA EQUIPE: Se existir a seção "RESPOSTAS JÁ APROVADAS PELA EQUIPE DE SUPORTE", ela traz respostas que a própria equipe já revisou e aprovou para perguntas parecidas — é conhecimento VALIDADO, do mesmo nível dos artigos. Se alguma delas resolve a pergunta atual, use o conteúdo dela por inteiro (sem omitir passos) e complemente com os artigos quando fizer sentido. Se um artigo e uma resposta aprovada divergirem sobre o MESMO assunto, siga a resposta aprovada. NÃO aplique uma resposta aprovada que seja sobre outro assunto, outro código de erro/rejeição ou outro tipo de documento (CT-e, MDF-e, NF-e, NFS-e…): nesse caso, ignore-a. Nunca diga ao cliente que existe uma "resposta aprovada" ou uma "seção" — apenas responda.\n\n${mi}\n📚 CONHECIMENTO:\n${es}${rrCtx}${ar}${pfCtx}${rotinasCtx}${conhecimentoRepositorio}${hc}\n\n🗣️ PERGUNTA: "${query}"\n\n📝 FORMATO:\n- Markdown limpo. NUNCA JSON.\n- **negrito** para termos importantes.\n- Listas com - para passos sequenciais.\n- Linguagem conversacional e humana.${vum ? '\n- Não encontrou: pedir reformulação.' : ''}\n- OBRIGATÓRIO: ao encerrar toda resposta completa, escreva \`#finalizado\` sozinho na última linha.`;

    // Build multi-turn messages when conversation history exists
    const _historyTurns = cc.slice(0, -1); // previous turns, current query already added to cc as last item
    let _apiMessages;
    if (_historyTurns.length >= 2) {
        // Remove embedded history text from context to avoid duplication with proper message turns
        const _psContexto = ps.split('\n\n🗣️')[0].replace(hc, '');
        const _fmtSuffix = `\n\n📝 FORMATO:\n- Markdown limpo.\n- **negrito** para termos importantes.\n- Listas com - para passos sequenciais.\n- Linguagem conversacional e humana.${vum ? '\n- Se não encontrou no manual: pedir reformulação.' : ''}`;
        _apiMessages = [
            { role: 'user', content: _psContexto },
            ..._historyTurns.map(m => ({ role: m.role, content: m.content.substring(0, 800) })),
            { role: 'user', content: `🗣️ PERGUNTA: "${query}"${_fmtSuffix}` }
        ];
    } else {
        _apiMessages = [{ role: 'user', content: ps }];
    }

    let _streamCard = null;
    let _mainStreamConectado = false; // só vira true depois que o modelo grande conecta de fato — usado no catch pra decidir a mensagem de erro certa
    const _filter = _makeThinkingFilter();
    // Rascunho rápido de um modelo menor (North Mini), disparado em paralelo com o modelo grande —
    // só é mostrado se o modelo grande ainda não tiver começado a responder (tira a sensação de
    // tela parada enquanto ele processa/conecta). Assim que a resposta de verdade do modelo grande
    // começa a chegar, ela substitui o rascunho normalmente — o rascunho nunca vira a resposta
    // salva, notificada ou falada na chamada, é só pra ocupar a espera. Se o North Mini falhar, sem
    // problema: simplesmente não aparece nada antes da resposta de verdade.
    // (o rascunho pode ser desligado em config/mcp-config.js → "rascunho": { "ativo": false })
    const _rascunhoPromise = (MCP_CFG.rascunho.ativo
        ? callMCPAPI(DEFAULT_MCP_CONFIG.provider, DEFAULT_MCP_CONFIG.model, DEFAULT_MCP_CONFIG.apiKey, DEFAULT_MCP_CONFIG.baseUrl, _apiMessages, { temperature: 0.2, maxTokens: 24000 })
        : Promise.resolve({ text: '' }))
        .then(r => (r.text || '').replace(/#finalizado\s*/gi, '').trim())
        .catch(() => '');

    // O card é criado JÁ DE CARA, antes mesmo de esperar o modelo grande conectar — senão o
    // rascunho não teria onde aparecer enquanto essa conexão ainda está rolando (que é bem a hora
    // em que ele mais ajuda). O selo de qual IA respondeu (canto inferior direito) começa vazio e
    // só é preenchido depois, quando o modelo grande conecta de verdade.
    const ts = Date.now();
    const card = document.createElement('div'); card.className = 'answer-card'; _streamCard = card;
    card.innerHTML = `<div class="answer-section"><div class="section-content" id="_sc${ts}"><span class="stream-thinking">💭 Pensando e formando resposta...</span><span class="stream-cursor"></span></div></div>
        <div class="feedback-area" id="_sf${ts}" data-log-ts="${_logTs || ''}" style="display:none">
            <span class="feedback-util">Esta resposta foi útil?</span>
            <button class="feedback-btn" onclick="saveFeedback(${ts},'positivo',this)">👍</button>
            <button class="feedback-btn" onclick="saveFeedback(${ts},'negativo',this)">👎</button>
            <button onclick="novaConversa()" style="display:flex;align-items:center;gap:6px;padding:6px 14px;border:1.5px solid var(--border);border-radius:8px;background:var(--surface);cursor:pointer;font-size:13px;font-weight:500;color:var(--text);transition:all .2s;" onmouseover="this.style.borderColor='var(--primary)';this.style.background='var(--primary-light)'" onmouseout="this.style.borderColor='var(--border)';this.style.background='var(--surface)'">➕ Nova conversa</button>
            <button class="btn-pesquisa-avancada" style="background:linear-gradient(135deg, #10b981, #059669);" onclick="Workspace.open('ciot', {beside: true})">🗺️ CIOT</button>
            <button class="btn-pesquisa-avancada" style="background:linear-gradient(135deg, #dc2626, #991b1b);" onclick="Workspace.open('blog', {beside: true});document.getElementById('blogSearchInput').value='${query.replace(/'/g, "\\'")}';pesquisarNoBlog();">📝 Blog</button>
            <button class="btn-pesquisa-avancada" style="background:linear-gradient(135deg, #2563eb, #1d4ed8);" onclick="Workspace.open('manual', {beside: true});">📘 Manual</button>
            <button class="btn-pesquisa-avancada" style="background:linear-gradient(135deg, #ff0000, #cc0000);" onclick="Workspace.open('yt', {beside: true});document.getElementById('ytSearchInput').value='${query.replace(/'/g, "\\'")}';pesquisarNoYT();">🎬 YouTube</button>
			<button class="btn-pesquisa-avancada" style="background:linear-gradient(135deg, var(--central-color), var(--central-dark));" onclick="Workspace.open('central', {beside: true});document.getElementById('centralSearchInput').value='${query.replace(/'/g, "\\'")}';pesquisarNaCentral();">📚 Central</button>
            ${filaSolucoes.length > 0 ? `<button class="feedback-btn next" onclick="fillAndSend('Próximo')">➡️ Próxima</button>` : ''}
            <span style="margin-left:auto;" id="_ib${ts}"></span>
        </div>`;
    document.getElementById('chatStream').appendChild(card);
    ld.remove();
    scrollToBottom(true);

    const contentEl = document.getElementById('_sc' + ts);
    const feedbackEl = document.getElementById('_sf' + ts);
    let lastVis = '', streamDone = false;
    const _revelacao = _criarRevelacaoFluida(contentEl); // ritmo fluido de exibição, independente da velocidade real do modelo
    const _guarda = _criarGuardaIdioma(contentEl, _revelacao);   // a resposta TEM que sair em português do Brasil (se vier inglês, traduz antes de mostrar)

    _rascunhoPromise.then(rascunho => {
        if (rascunho && !streamDone && !lastVis.trim() && !mcpPareceIngles(rascunho)) {   // rascunho em inglês nunca aparece
            contentEl.innerHTML = `<div style="font-size:10.5px;color:#0369a1;margin-bottom:8px;">⚡ Resposta rápida — aprimorando com o modelo avançado...</div>` + renderMd(rascunho);
        }
    });

    try {
        const _t5 = performance.now();
        const { resp: _resp, provider: _pr, iaUsada: _iu, iaModelo: _im } = await callCurrentMCPStream(
            _apiMessages, { temperature: 0.2, maxTokens: 24000 }
        );
        _tp('callCurrentMCPStream (conectado)', _t5);
        _mainStreamConectado = true;

        const iaUsada = _iu || 'OpenRouter';
        const iaModelo = (_im || '').split('/').pop();
        const _iaBadgeCfg = iaUsada==='Gemini'
            ? {emoji:'🌐',color:'#7c3aed',bg:'#f5f3ff',border:'#ddd6fe'}
            : iaUsada==='Custom'
            ? {emoji:'🔌',color:'#059669',bg:'#f0fdf4',border:'#bbf7d0'}
            : {emoji:'⚡',color:'#0369a1',bg:'#f0f9ff',border:'#bae6fd'};
        const iaBadge = `<span style="font-size:10px;color:${_iaBadgeCfg.color};background:${_iaBadgeCfg.bg};padding:2px 7px;border-radius:10px;border:1px solid ${_iaBadgeCfg.border};font-weight:600;">${_iaBadgeCfg.emoji} ${iaUsada}${iaModelo?' · '+iaModelo:''}</span>`;
        const _ibEl = document.getElementById('_ib' + ts);
        if (_ibEl) _ibEl.innerHTML = iaBadge;

        const { finishReason: _hcFR } = await _readSSEStream(_resp, _pr, chunk => {
            lastVis = _filter.push(chunk);
            _guarda.atualizar(lastVis);
        });

        streamDone = true;
        let finalText = _filter.finish();
        _tp('TOTAL handleChat (streaming)', _t0);
        console.log(`%c⏱️ [handleChat] streaming: ${iaUsada} / ${_im}`, 'color:#7c3aed;font-weight:600;');

        // Auto-fallback quando resposta vier em branco
        if (!finalText.trim()) {
            console.warn('[handleChat] Resposta em branco — tentando fallback sem:', _im);
            contentEl.innerHTML = '<span class="stream-thinking">⚠️ Servidor com lentidão, aguarde mais um momento...</span><span class="stream-cursor"></span>';
            let _fbOk = false;
            try {
                const _filter2 = _makeThinkingFilter();
                const { resp: _resp2, provider: _pr2 } = await callCurrentMCPStream(
                    _apiMessages, { temperature: 0.4, maxTokens: 3000, skipModels: [_im] }
                );
                await _readSSEStream(_resp2, _pr2, chunk => {
                    _guarda.atualizar(_filter2.push(chunk));
                });
                finalText = _filter2.finish();
                _fbOk = !!finalText.trim();
            } catch(e) { console.warn('[handleChat] Fallback também falhou:', e); }

            if (!_fbOk) {
                const _rq = query.replace(/'/g, "\\'");
                contentEl.innerHTML = `<div style="color:var(--text-muted);font-style:italic;font-size:13px;margin-bottom:10px;">⚠️ Não foi possível obter resposta dos modelos disponíveis no momento.</div><button onclick="this.closest('.answer-card').remove();fillAndSend('${_rq}');" style="padding:8px 18px;border-radius:8px;background:var(--primary);color:#fff;border:none;cursor:pointer;font-weight:600;font-size:13px;">🔄 Tentar novamente</button>`;
                feedbackEl.style.display = 'flex';
                scrollToBottom(true);
                return;
            }
        }

        // Truncado = API sinalizou limite de tokens. Ausência de #finalizado não é critério.
        finalText = finalText.replace(/#finalizado\s*/gi, '').trim();
        const _hcTruncado = _hcFR === 'length' || _hcFR === 'max_tokens';
        if (_hcTruncado) {
            const _rq = query.replace(/'/g, "\\'");
            contentEl.innerHTML = `<div style="color:var(--text-muted);font-style:italic;font-size:13px;margin-bottom:10px;">⚠️ A resposta não foi concluída. Tente novamente.</div><button onclick="this.closest('.answer-card').remove();fillAndSend('${_rq}');" style="padding:8px 18px;border-radius:8px;background:var(--primary);color:#fff;border:none;cursor:pointer;font-weight:600;font-size:13px;">🔄 Tentar novamente</button>`;
            feedbackEl.style.display = 'flex';
            scrollToBottom(true);
            return;
        }

        // Idioma: sempre português do Brasil. Se um modelo (ex.: o fallback North Mini) respondeu em inglês, traduz ANTES de mostrar e de guardar no log.
        finalText = (await _guarda.concluir(finalText)).texto;

        // Entrega o texto final pra fila de revelação em vez de estampar tudo de uma vez — assim
        // o final da resposta continua aparecendo no mesmo ritmo fluido, mesmo que o modelo tenha
        // sido rápido o bastante pra já ter mandado tudo de uma vez só. Sem forçar rolagem aqui:
        // a revelação ainda pode estar no meio do caminho nesse ponto, e forçar desceria a tela
        // antes mesmo dela terminar de aparecer — deixa o usuário livre pra ler do jeito que quiser.
        _revelacao.atualizar(finalText);
        _revelacao.finalizar();
        feedbackEl.style.display = 'flex';
        adicionarMensagemNaConversa('ai', finalText.replace(/\*\*(.*?)\*\*/g, '$1'));
        // Guarda a resposta apresentada no log (vai para a fila de revisão da Área Administrativa)
        registrarRespostaNoLog(_logTs, { resposta: finalText, fonte: 'ia', modelo: _im });
        simEnviarAoPainel({ tipo: 'bsoft:sim:trace', fonte: 'ia', pergunta: query, modelo: _im, ms: Math.round(performance.now() - _t0), bloqueios: window.BSOFT_SIM_BLOQUEIOS.length, bloqueiosLista: window.BSOFT_SIM_BLOQUEIOS.slice(-20), forcouIA: !!opts.forcarIA, rrContexto: rrUsadas.map(x => ({ id: x.item.id, pct: Math.round(x.score * 100) })) });
        // Resposta pode demorar — se a pessoa saiu da aba/janela nesse meio tempo, avisa que já
        // terminou (só quando não está olhando; quem está vendo o streaming não precisa de aviso).
        if (document.hidden) {
            _enviarNotificacaoNavegador('🤖 Suporte Bsoft TMS respondeu', finalText.replace(/[*_#`]/g, '').trim(), 'bsoft-ia-resposta');
        }
        if (isCallActive) { speak(finalText); }

    } catch (e) {
        if (_mainStreamConectado) {
            // conectou, mas quebrou no meio do stream — mantém o que já tinha (rascunho ou parcial
            // do modelo grande) na tela em vez de sumir com tudo, e avisa que interrompeu.
            const partial = _filter.finish();
            const ce = _streamCard.querySelector('.section-content');
            const fe = _streamCard.querySelector('.feedback-area');
            if (ce) ce.innerHTML = (partial ? renderMd(partial) : ce.innerHTML) + '<p style="color:#dc2626;font-size:12px;margin-top:8px">⚠️ Resposta interrompida. Tente novamente.</p>';
            if (fe) fe.style.display = 'flex';
        } else {
            // o modelo grande nunca chegou a conectar — o card só tinha o "Pensando..." (ou, no
            // máximo, o rascunho do modelo pequeno) e nada disso é uma resposta de verdade pra
            // manter na tela. Remove e mostra a mensagem padrão de "não encontrei", como sempre foi.
            if (_streamCard) _streamCard.remove();
            appendMessage('ai', '😕 <b>Não encontrei</b> esta informação no manual. Por favor, tente <b>reformular a pergunta</b> ou pergunte sobre outro assunto do Bsoft TMS.');
            adicionarMensagemNaConversa('ai', 'Não encontrei esta informação no manual. Por favor, reformule a pergunta ou pergunte sobre outro assunto.');
        }
    }
}
