/* js/app/chat.js — Lógica principal do chat (handleChat). */
// ═══════════════════════════════════════════════════════════
//  LÓGICA DE CHAT PRINCIPAL (com Repositório integrado)
// ═══════════════════════════════════════════════════════════
// opts (uso interno, ex.: botão "pesquisar com a IA" da resposta rápida):
//   { pergunta, forcarIA, reutilizarMensagem } — refaz a pergunta já exibida, sem repetir a bolha do usuário
//   e sem procurar de novo nas respostas rápidas.
// JavaScript do botão "Tentar novamente" de uma resposta que falhou. Na 2ª passada da pergunta vaga (botões "qual é o seu caso?") refaz COM a escolha da pessoa,
// em vez de recomeçar a pergunta do zero (que duplicaria a bolha e o log e perderia o assunto escolhido).
function _jsRefazer(opts, rq) {
    // (opts da passada que falhou, já marcadas como "mesma pergunta": refaz com a mesma escolha de assunto/formato, sem nova bolha nem nova linha de log)
    if (opts && opts.reutilizarMensagem && typeof Desamb !== 'undefined') return "Desamb.refazer('" + Desamb.guardarOpts(opts) + "');";
    return "fillAndSend('" + rq + "');";
}
async function handleChat(opts) {
    opts = (opts && typeof opts === 'object' && !(typeof Event !== 'undefined' && opts instanceof Event)) ? opts : {};
    const _reuso = !!opts.reutilizarMensagem;
    if (_paramFuncMode && !_reuso) { _paramFuncMode = false; return handleParametrosFuncionalidades(); }
    const ch = obterContextoHorario();
    if (isVectorizing) return;
    const input = document.getElementById('searchInput');
    let query = (opts.pergunta ? String(opts.pergunta) : input.value).trim();
    if (!query) return;
    // Esclarecimento com botões (js/app/esclarecimento.js): a IA perguntou "em qual tela você está?" e a pessoa DIGITOU a resposta em vez de clicar —
    // vale como o clique: a busca e a IA recebem a pergunta REFINADA (pergunta original + esclarecimento + resposta); a bolha mostra só o que ela digitou.
    // (_bolha também vem pronta quando o clique no botão chama o handleChat.)
    let _bolha = opts.bolha ? String(opts.bolha) : null;
    if (!_reuso && typeof Esc !== 'undefined') {
        let _ed = null;
        try { _ed = Esc.consumirDigitada(query, opts); } catch (e) { console.warn('[esclarecimento] resposta digitada:', e); }
        if (_ed) { _bolha = query; query = _ed.refinada; opts = Object.assign({}, opts, _ed.opts); }
    }
    if (!_reuso && typeof Desamb !== 'undefined') Desamb.encerrarPendentes();   // botões de "qual é o seu caso?" que a pessoa deixou sem escolher: apagados
    if (!_reuso && typeof Formato !== 'undefined') Formato.encerrarPendentes();  // idem para os botões "resposta curta / completa detalhada"
    if (!_reuso && typeof Esc !== 'undefined') Esc.encerrarPendentes();          // idem para os botões de esclarecimento da IA

    // Perguntas sobre a agenda pessoal ("quais tarefas tenho hoje?", "tarefa: ligar para o cliente amanhã 14h") são respondidas aqui, na tela:
    // não vão para a IA, não entram no histórico da conversa e não geram log (os dados são pessoais e ficam só no computador do usuário).
    if (!_reuso && typeof V !== 'undefined' && V.AgendaChat && V.AgendaChat.tratar(query)) return;

    // "Latitude e longitude de RUA, NÚMERO, BAIRRO — CIDADE - UF" (ou só o endereço nesse formato): respondido na tela por js/app/geolocalizacao.js, com o OpenStreetMap e sem IA —
    // a IA não consulta mapas e não pode chutar coordenadas. Tenta Rua+Bairro+Cidade+Estado, depois Bairro+Cidade+Estado, depois Cidade+Estado.
    // (um defeito aí nunca derruba o chat: se der erro ou se o mapa não conhecer a "cidade" de uma frase solta, a pergunta segue o caminho normal, com a IA.)
    if (!_reuso && typeof Geo !== 'undefined') {
        let _geo = null;
        try { _geo = Geo.interpretar(query); } catch (e) { console.warn('[geolocalização] interpretar', e); }
        if (_geo) { let _feito; try { _feito = await Geo.responder(query, _geo); } catch (e) { console.warn('[geolocalização]', e); _feito = false; } if (_feito !== false) return; }
    }

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
    if (!_reuso) { appendMessage('user', _bolha || query); adicionarMensagemNaConversa('user', _bolha || query, query); input.value = ""; }   // (a IA lê a pergunta refinada; a tela mostra só o que a pessoa escolheu/digitou)

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
            if (_tipo === 'cte-nova') { logSearch(query, true); mostrarWizardRegraCteNova(query); return; }
            if (_tipo === 'cte-beta') { logSearch(query, true); mostrarWizardRegraCteBeta(query); return; }
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
    const vp = ((opts.desambiguado || opts.formatoDecidido) && opts.vetor) ? opts.vetor : await gerarEmbedding(queryNormalizada);   // passada seguinte (pergunta vaga / escolha do formato): reaproveita o embedding da 1ª
    _tp('gerarEmbedding', _t2);

    // ── Resposta rápida aprovada (pergunta parecida com uma já revisada pela equipe) ──
    // Pulada quando o usuário acabou de dizer "não era o que procurava" (opts.forcarIA) e na 2ª passada da pergunta vaga (a 1ª já tentou e não achou).
    if (!opts.forcarIA && !opts.desambiguado && !opts.formatoDecidido) {
        try {
            const _rr = await rrBuscar(query, vp);
            if (_rr) { ld.remove(); rrMostrarResposta(_rr, query, performance.now() - _t0); return; }
        } catch (e) { console.warn('[respostas rápidas] busca falhou, seguindo para a IA:', e); }
    }
    const _t3 = performance.now();
    let rr = [], _buscaVetorial = false;
    if (vp) {
        // Busca vetorial (caminho normal)
        const _todos = manualVetorizado.map(item => ({ ...item, similaridade: calcularSimilaridade(vp, item.vetor) })).sort((a, b) => b.similaridade - a.similaridade);
        // Se similaridade máxima < 0.1, houve incompatibilidade de dimensão (ex: vetor Llama fallback vs vetores Gemini armazenados)
        if (_todos.length > 0 && _todos[0].similaridade >= 0.1) {
            _buscaVetorial = true;
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
    // 2ª passada da pergunta vaga (js/app/desambiguacao.js): o assunto escolhido vai em 1º lugar e os outros candidatos saem da lista
    if (opts.desambiguado && typeof Desamb !== 'undefined') rr = Desamb.aplicarEscolha(rr, opts, manualVetorizado);

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
        if (opts.desambiguado && typeof Desamb !== 'undefined') rrUsadas = Desamb.filtrarAprovadas(rrUsadas, opts);   // 2ª passada da pergunta vaga: sem respostas aprovadas do assunto recusado
        rrCtx = rrMontarContexto(rrUsadas);
        if (rrUsadas.length) console.log(`%c⚡ [respostas aprovadas no contexto da IA] ${rrUsadas.map(x => '#' + x.item.id + ' (' + Math.round(x.score * 100) + '%: termos ' + Math.round(x.lex * 100) + '%' + (x.sem != null ? ', significado ' + Math.round(x.sem * 100) + '%' : '') + ', texto ' + Math.round(x.cob * 100) + '%)').join(' · ')}`, 'color:#d97706;font-weight:600;');
    } catch (e) { console.warn('[respostas rápidas] não deu para usar as aprovadas como contexto, seguindo só com os artigos:', e); rrUsadas = []; rrCtx = ''; }

    // ── Pergunta vaga (pode ser sobre mais de um assunto): pergunta qual antes de responder — sem IA, com os mesmos resultados da busca acima ──
    // Não pergunta em: nova tentativa/2ª passada, "pesquisar com a IA", chamada de voz (não dá para clicar) nem quando a busca foi só por palavra-chave.
    if (!_reuso && !opts.forcarIA && !opts.desambiguado && !opts.esclarecimentos && !isCallActive && typeof Desamb !== 'undefined') {   // (depois de um esclarecimento da IA a pergunta já veio refinada: não pergunta "qual é o seu caso?" por cima)
        let _dv = null;
        try { _dv = Desamb.avaliar(query, rr, rrUsadas, { vetorial: _buscaVetorial, temHistorico: !!(conversa && conversa.contexto && conversa.contexto.some(m => m && m.role === 'assistant')) }); }
        catch (e) { console.warn('[desambiguação] não consegui avaliar, seguindo normal:', e); }
        if (_dv) console.log(`%c🤔 [desambiguação] ${_dv.perguntar ? 'PERGUNTA — ' : 'segue direto — '}${_dv.motivo}`, 'color:#7c3aed;font-weight:600;');
        if (_dv && _dv.perguntar) {
            ld.remove();
            const _logDv = logSearch(query, true);   // a pergunta já conta no log; a resposta (depois do clique) é gravada nesta mesma linha
            Desamb.mostrar(query, _dv, { vp, logTs: _logDv });
            if (document.hidden) _enviarNotificacaoNavegador('🤖 Suporte Bsoft TMS', 'Preciso saber qual é o seu caso para responder — escolha uma opção no chat.', 'bsoft-ia-resposta');
            simEnviarAoPainel({ tipo: 'bsoft:sim:trace', fonte: 'desambiguacao', pergunta: query, opcoes: _dv.opcoes.map(o => ({ titulo: o.titulo, sim: o.sim })), ms: Math.round(performance.now() - _t0), bloqueios: window.BSOFT_SIM_BLOQUEIOS.length, bloqueiosLista: window.BSOFT_SIM_BLOQUEIOS.slice(-20) });
            return;
        }
    }

    // ── Pré-requisito primeiro (js/app/prerequisitos.js): Parâmetros e Funcionalidades de que a pergunta pode DEPENDER ──
    // Vêm os mencionados pelos artigos mais relevantes (similaridade ≥ 50%) + os que combinam com a pergunta. A regra 9 do prompt manda abrir a resposta com
    // "⚙️ Antes de tudo, verifique:" em vez de deixar o item para o fim. Pergunta curta de acompanhamento ("sim, quero vincular") é buscada junto da pergunta anterior.
    let pfCtx = '', _pmUsados = [], _fmUsados = [], _dicaPre = '', _pfPediu = false;   // _pmUsados/_fmUsados: o que entrou no prompt (vai para o log: "dados do banco usados" na Revisão)
    if (typeof Prereq !== 'undefined') {
        try {
            const _ant = ((conversa && conversa.contexto) || []).filter(m => m && m.role === 'user').slice(-2, -1)[0];
            const _qPre = (Prereq.tokens(query).length < 3 && _ant) ? String(_ant.content).substring(0, 300) + ' ' + query : query;
            const _ehCond = Prereq.ehPerguntaDeCondicao(_qPre);
            const _artPre = rr.filter(r => r.similaridade >= 0.5 && !r._reforcoPalavraChave).slice(0, 3);
            const _citados = Prereq.citadosNosArtigos(_artPre, dadosParametros, dadosFuncionalidades);
            const _pf = Prereq.combinar(_citados, Prereq.buscar(_qPre, dadosParametros, dadosFuncionalidades));
            _pmUsados = _pf.parametros; _fmUsados = _pf.funcionalidades;
            _pfPediu = _pf.parametros.some(x => x.daPergunta) || _pf.funcionalidades.some(x => x.daPergunta);   // "para que serve o parâmetro X?": a resposta está na tabela, não no manual
            pfCtx = Prereq.montarContexto(_pf);
            _dicaPre = Prereq.dica(_ehCond, _pf);
            console.log(`%c⚙️ [pré-requisitos] ${_ehCond ? 'pergunta de condição · ' : ''}${_pf.parametros.length} parâmetro(s) (${_citados.parametros.length} mencionado(s) em artigo) · ${_pf.funcionalidades.length} funcionalidade(s)`, 'color:#0891b2;font-weight:600;');
        } catch (e) { console.warn('[pré-requisitos] não consegui buscar parâmetros/funcionalidades, seguindo sem eles:', e); }
    }

    const trb = rr.length > 0 && rr[0].similaridade > 0.65;
    let ar = "";
    if (rr.length > 0) { ar = "\n=== ARTIGOS MAIS RELEVANTES ===\n"; rr.forEach((r, i) => { const _limSol = i === 0 ? 999999 : i < 3 ? 4000 : 1000; const _limEmit = i === 0 ? 999999 : 800; ar += `[RELEVANTE ${i + 1} - ${(r.similaridade * 100).toFixed(0)}%] ${r.erro}\nSolução: ${r.solucao.substring(0, _limSol)}\n${r.emitir ? 'Emissão: ' + r.emitir.substring(0, _limEmit) + '\n' : ''}${(r.caminhoMenu || r.caminho_menu) ? 'Caminho no menu: ' + String(r.caminhoMenu || r.caminho_menu).trim() + '\n' : ''}---\n`; }); }

    let mi = "", vum = false;
    if (!trb && !_pfPediu && rr.every(r => r.similaridade < 0.5) && !rrUsadas.some(x => x.score >= 0.5)) { vum = true; mi = `\n⚠️ ATENÇÃO: Nenhum resultado encontrado no manual (max: ${rr.length > 0 ? (rr[0].similaridade * 100).toFixed(0) : 0}%).\n`; }

    if (opts.desambiguado && typeof Desamb !== 'undefined') mi += Desamb.textoEsclarecimento(opts);   // o que a pessoa escolheu nos botões "qual é o seu caso?"
    // ── Esclarecimento com botões (js/app/esclarecimento.js): em vez de "não encontrei, informe X, Y, Z", a IA pergunta UMA coisa e oferece botões ──
    // 'preferido' = nada achado no manual; 'permitido' = só achou algo fraco; 'proibido' = resposta forte, voz, "pesquisar com a IA", 2ª passada da pergunta vaga ou rodadas esgotadas.
    let _modoEsc = 'proibido';
    const _rodadasEsc = opts.esclarecimentos || 0;
    if (typeof Esc !== 'undefined') {
        try { _modoEsc = Esc.modo({ vum, trb, voz: isCallActive, forcarIA: opts.forcarIA, expansao: opts.expandida, desambiguado: opts.desambiguado, rodadas: _rodadasEsc }); }
        catch (e) { console.warn('[esclarecimento] não consegui decidir o modo, seguindo sem perguntar:', e); }
        if (_modoEsc !== 'proibido' || _rodadasEsc > 0) { try { mi += Esc.textoRegra(_modoEsc, _rodadasEsc); } catch (e) { _modoEsc = 'proibido'; } }
        console.log(`%c💬 [esclarecimento] modo: ${_modoEsc}${_rodadasEsc ? ' (rodada ' + _rodadasEsc + ')' : ''}`, 'color:#7c3aed;font-weight:600;');
    }
    const _fraseNaoAchou = _modoEsc === 'preferido' ? 'Não encontrou no manual: faça a PERGUNTA DE ESCLARECIMENTO COM BOTÕES (instrução acima) em vez de dizer só "não encontrei"; só peça reformulação se nenhuma pergunta ajudar.' : 'Não encontrou: pedir reformulação.';
    if (opts.desambiguado && vum && opts.logTs && !BSOFT_SIM) { try { sb.from('logs').update({ encontrou: false }).eq('timestamp', opts.logTs).then(() => {}, () => {}); } catch (e) { /* só informação */ } }   // a linha nasceu como "encontrou" quando os botões apareceram
    // ── Resposta curta ou completa? (js/app/formato-resposta.js) ──
    // Só aqui, quando a IA vai mesmo responder (depois da resposta rápida e da pergunta vaga). Pergunta: a linha de log nasce agora (1 por pergunta) e a escolha refaz a pergunta
    // sem repetir bolha/log/embedding. Preferência fixa em Personalizar, chamada de voz, "pesquisar com a IA" e "não achei nada" não perguntam.
    let _formato = 'completa';
    if (typeof Formato !== 'undefined') {
        _formato = opts.formato || Formato.decidir({ vum, voz: isCallActive, forcarIA: opts.forcarIA, reuso: _reuso, desambiguado: opts.desambiguado });
        if (_formato === 'perguntar') {
            ld.remove();
            const _logFmt = ('logTs' in opts) ? opts.logTs : logSearch(query, !vum);
            Formato.mostrar(query, opts, { vp, logTs: _logFmt });
            if (document.hidden) _enviarNotificacaoNavegador('🤖 Suporte Bsoft TMS', 'Escolha como prefere a resposta: curta ou completa detalhada.', 'bsoft-ia-resposta');
            return;
        }
    }
    const _modo = (typeof Formato !== 'undefined') ? Formato.textoModo(_formato, !!opts.expandida) : '';   // instrução do modo (vazia no modo completo normal: a IA responde como sempre)
    const _logTs = ('logTs' in opts) ? opts.logTs : logSearch(query, !vum);   // (2ª passada da pergunta vaga: a linha de log já foi criada quando os botões apareceram)
    // opções para o botão "Tentar novamente" desta resposta: mesma pergunta, mesma escolha de assunto/formato, sem nova bolha nem nova linha de log
    const _optsRetry = Object.assign({}, opts, { pergunta: query, reutilizarMensagem: true, formatoDecidido: true, formato: _formato, vetor: vp, logTs: _logTs });   // (_logTs = timestamp da linha de log DESTA pergunta — toda pergunta gera a sua; null no simulador: a resposta e o 👍/👎 vão para ela)

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

    // (Parâmetros e Funcionalidades: ver o bloco "Pré-requisito primeiro" antes de `trb`/`vum`, mais acima)

    // Busca na tabela Rotinas (telas/funções cadastradas) -- ajuda a responder "onde fica X"/"como
    // acesso X" com o nome oficial e o id real da rotina, em vez de arriscar inventar.
    let rotinasCtx = '', _rotinasUsadas = [];
    try {
        const rotinasRel = _buscarRotinasRelevantes(query, 3);
        if (rotinasRel.length > 0) {
            _rotinasUsadas = rotinasRel;
            rotinasCtx = '\n=== ROTINAS RELACIONADAS ===\n';
            rotinasRel.forEach((x,i) => { rotinasCtx += `\n[ROTINA ${i+1} - sim:${(x.sim*100).toFixed(0)}%]\n${_formatarRotinaParaPrompt(x.item)}\n`; });
        }
    } catch(e) {}

    // Quais dados do banco de dados esta resposta vai usar (artigos, respostas aprovadas, parâmetros, funcionalidades, rotinas): gravados no log junto
    // da resposta, para a aba Revisão mostrar — e deixar corrigir direto na base. Só informação: se algo falhar aqui, a resposta sai igual.
    let _fontesUsadas = null;
    try { _fontesUsadas = fontesDoBanco({ artigos: rr, aprovadas: rrUsadas, parametros: _pmUsados, funcionalidades: _fmUsados, rotinas: _rotinasUsadas }); }
    catch (e) { console.warn('[log] não consegui listar os dados do banco usados nesta resposta:', e); }

    const _regra9 = (typeof Prereq !== 'undefined') ? Prereq.REGRA : '9. PARÂMETROS E FUNCIONALIDADES: Se a seção "PARÂMETROS E FUNCIONALIDADES RELACIONADOS" contiver itens que condicionam a pergunta, mencione-os ANTES do passo a passo.';   // (a regra completa fica em js/app/prerequisitos.js)
    const ps = `🏢 VOCÊ É UM AGENTE DE SUPORTE DA BSOFT TMS\n\n${ch}\n\n🎯 Atenda o cliente de forma PROFISSIONAL e DIDÁTICA.\n\nREGRAS OBRIGATÓRIAS:\n1. Use APENAS as informações contidas no CONHECIMENTO abaixo. Nada além.\n2. NUNCA invente. Se não encontrar a resposta no conhecimento fornecido, diga claramente que não encontrou e peça para reformular.\n3. ⚠️ CAMINHOS DE MENU — PROIBIDO INVENTAR: Só cite um caminho de menu (ex: "Transporte > Documentos > CT-e") se ele aparecer LITERALMENTE nos CAMINHOS DO MENU (é o menu REAL do sistema, copiado dele), nos ATALHOS E PROCEDIMENTOS, em "Primeiros passos", em DOCUMENTOS (Emissão) ou em TALÕES do conhecimento, na linha "Onde conferir/alterar" da seção PARÂMETROS E FUNCIONALIDADES RELACIONADOS, no campo "Caminho no menu" de uma ROTINA ou de um artigo fornecido, ou na solução do artigo fornecido. Copie o caminho EXATAMENTE como está (mesmos nomes e níveis, separados por " > "): não pule nem junte níveis, não traduza nem abrevie nomes, e NÃO copie as marcas internas "(id da rotina: …)" e "[pasta]" (servem só para você). Se houver mais de um caminho para a mesma tela, cite o que melhor combina com a pergunta — na dúvida, o de MENOS níveis (o mais direto) — e, se fizer sentido, o outro. Se uma fonte divergir do CAMINHOS DO MENU ou do "Caminho no menu" da rotina (que vêm do menu real), vale o do menu real. Itens marcados [pasta] são pastas do menu (abrem uma lista de telas), não telas. O menu pode variar conforme a permissão do usuário e os módulos contratados: se o cliente disser que não encontra o item, sugira conferir com o administrador do sistema a permissão do usuário às rotinas. Se o caminho não estiver explícito no conhecimento abaixo, NÃO mencione nenhum caminho — escreva apenas "acesse pelo menu do sistema" sem inventar a navegação.\n4. Procedimentos e passos: só descreva o que estiver documentado na solução. Não crie etapas extras por lógica própria.\n5. ⚠️ NÃO OMITA NADA DA SOLUÇÃO — REGRA ABSOLUTA: Reproduza TODOS os passos da solução do artigo, na íntegra. É PROIBIDO: resumir, condensar, escrever "etc.", "e assim por diante", pular etapas, ou dizer "siga os passos normais". Se a solução tem 10 passos, escreva os 10 completos com todos os detalhes. O público é suporte iniciante que não conhece o sistema — cada detalhe é essencial para resolver o problema. Prefira respostas longas e completas a respostas curtas e incompletas.\n6. Mantenha o contexto da conversa.\n7. Seja conversacional e humano.\n8. Diferencie: CT-e, MDF-e, NF-e, NFS-e, Minuta, OC, CIOT, VPO.\n${_regra9}\n10. ROTINAS: Se a seção "ROTINAS RELACIONADAS" tiver algo relevante pra pergunta (ex.: "onde fica X", "como acesso X"), use o Nome oficial pra confirmar como a tela/função se chama. Só inclua o nome interno da rotina se isso realmente ajudar (ex.: pedido claramente técnico). NÃO escreva link nem endereço (URL) da tela: oriente sempre pelo caminho do menu. Se a própria rotina trouxer "Caminho no menu: …" (vem do menu real; se houver dois separados por OU, cite o mais direto), ou se os CAMINHOS DO MENU trouxerem esse mesmo id de rotina, ou se algum artigo trouxer "Caminho no menu: …" ou o caminho de menu constar LITERALMENTE na solução do artigo (use-o EXATAMENTE como está), escreva o caminho COMPLETO copiado como está (os caminhos reais têm de 1 a 5 níveis; não acrescente "Menu >"); se NÃO constar, NÃO invente a navegação (a regra 3 continua valendo) — escreva apenas "Procure pelo menu do sistema: <Nome oficial da tela>"; e, se a rotina disser "Aparece como item no menu do sistema: Não", diga que essa tela não aparece como item do menu. Nunca invente nome oficial nem id de rotina que não estejam listados aqui.\n11. RESPOSTAS APROVADAS PELA EQUIPE: Se existir a seção "RESPOSTAS JÁ APROVADAS PELA EQUIPE DE SUPORTE", ela traz respostas que a própria equipe já revisou e aprovou para perguntas parecidas — é conhecimento VALIDADO, do mesmo nível dos artigos. Se alguma delas resolve a pergunta atual, use o conteúdo dela por inteiro (sem omitir passos) e complemente com os artigos quando fizer sentido. Se um artigo e uma resposta aprovada divergirem sobre o MESMO assunto, siga a resposta aprovada. NÃO aplique uma resposta aprovada que seja sobre outro assunto, outro código de erro/rejeição ou outro tipo de documento (CT-e, MDF-e, NF-e, NFS-e…): nesse caso, ignore-a. Nunca diga ao cliente que existe uma "resposta aprovada" ou uma "seção" — apenas responda.\n12. ⚠️ NF-e E NFS-e SÃO DOCUMENTOS DIFERENTES — NUNCA OS CONFUNDA: NF-e = Nota Fiscal Eletrônica de PRODUTOS/mercadorias (a nota que acompanha a carga e que o CT-e transporta). NFS-e = Nota Fiscal de SERVIÇO Eletrônica (serviços, emitida na prefeitura/município, com ISS). Nunca trate uma pela outra: não responda uma pergunta de NF-e com conteúdo de NFS-e (nem o contrário), não troque nem misture as siglas e não as escreva como se fossem sinônimos (ex.: "NF-e/NFS-e"). Se o conhecimento fornecido for de um desses documentos e a pergunta for do outro, não aplique esse conteúdo — diga que ele se refere a outro documento. Ao citar o documento, use sempre a sigla exata (NF-e ou NFS-e) que o conhecimento e a pergunta tratam; se a pergunta disser só "nota fiscal" e não der para saber qual das duas é, peça ao cliente para informar qual.\n13. ⚠️ COORDENADAS — NUNCA INVENTE: você NÃO consulta mapas. Nunca informe latitude, longitude ou coordenadas por conta própria nem "aproximadas"; só repita coordenadas que estejam escritas literalmente no CONHECIMENTO. Se pedirem as coordenadas de um endereço, oriente a enviar o endereço no formato "RUA, NÚMERO, BAIRRO — CIDADE - UF" junto de "latitude e longitude" (o sistema consulta o mapa e responde sozinho).\n14. ⚠️ FÓRMULAS E CÁLCULOS EM TEXTO SIMPLES: o chat NÃO exibe LaTeX. NUNCA use \\[ \\], \\( \\), \\frac, \\text, \\approx, $...$ nem qualquer código LaTeX. Escreva a fórmula em texto comum, em uma linha, com os nomes dos campos e os símbolos + − × ÷ = ≈ e parênteses, ex.: **Base = Valor Líquido ÷ ((100 − Alíquota) ÷ 100)**; depois mostre o exemplo com números, ex.: Base = 1.200,00 ÷ ((100 − 18) ÷ 100) = 1.200,00 ÷ 0,82 ≈ R$ 1.463,41.\n   📐 CÁLCULO INVERSO (ICMS "por dentro"): escreva SEMPRE a fórmula exatamente assim, nesta ordem: **Base = Valor Líquido ÷ ((100 − Alíquota) ÷ 100)**. Explique os passos assim: 1º) subtraia a alíquota de 100; 2º) divida esse resultado por 100; 3º) divida o Valor Líquido pelo resultado do 2º passo. NUNCA escreva essa fórmula como "1 − Alíquota ÷ 100", "1 − 0,18" nem de qualquer outra forma — use sempre (100 − Alíquota) ÷ 100, e nos exemplos com números mostre ((100 − 18) ÷ 100).\n\n${mi}\n📚 CONHECIMENTO:\n${es}${rrCtx}${ar}${pfCtx}${rotinasCtx}${conhecimentoRepositorio}${hc}${_dicaPre}\n\n🗣️ PERGUNTA: "${query}"\n${_modo}\n📝 FORMATO:\n- Markdown limpo. NUNCA JSON.\n- **negrito** para termos importantes.\n- Listas com - para passos sequenciais.\n- Linguagem conversacional e humana.${vum ? '\n- ' + _fraseNaoAchou : ''}\n- OBRIGATÓRIO: ao encerrar toda resposta completa, escreva \`#finalizado\` sozinho na última linha.`;

    // Build multi-turn messages when conversation history exists
    const _historyTurns = cc.slice(0, -1); // previous turns, current query already added to cc as last item
    let _apiMessages;
    if (_historyTurns.length >= 2) {
        // Remove embedded history text from context to avoid duplication with proper message turns
        const _psContexto = ps.split('\n\n🗣️')[0].replace(hc, '');
        const _fmtSuffix = `${_dicaPre}\n${_modo}\n📝 FORMATO:\n- Markdown limpo.\n- **negrito** para termos importantes.\n- Listas com - para passos sequenciais.\n- Linguagem conversacional e humana.${vum ? '\n- Se ' + _fraseNaoAchou.charAt(0).toLowerCase() + _fraseNaoAchou.slice(1) : ''}`;
        _apiMessages = [
            { role: 'user', content: _psContexto },
            ..._historyTurns.map(m => ({ role: m.role, content: m.content.substring(0, 800) })),
            { role: 'user', content: `🗣️ PERGUNTA: "${query}"${_fmtSuffix}` }
        ];
    } else {
        _apiMessages = [{ role: 'user', content: ps }];
    }

    const _semMarcadorEsc = t => { try { return (typeof Esc !== 'undefined') ? Esc.ocultarParcial(t) : t; } catch (e) { return t; } };   // o marcador [[BOTOES: …]] nunca aparece na tela, nem pela metade
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
    if (_formato === 'curta' && typeof Formato !== 'undefined') {   // resposta curta: guarda como refazê-la em modo completo (botão no fim dela)
        card.dataset.fmtCurta = String(ts);
        Formato.registrarCurta(ts, query, opts, { vp, logTs: _logTs });
    }
    card.innerHTML = `<div class="answer-section"><div class="section-content" id="_sc${ts}"><span class="stream-thinking">💭 Pensando e formando resposta...</span><span class="stream-cursor"></span></div></div>
        <div class="feedback-area" id="_sf${ts}" data-log-ts="${_logTs || ''}" style="display:none">
            ${_formato === 'curta' ? '<button type="button" class="btn-fmt-completa" onclick="fmtExpandir(this)">📖 Resposta completa detalhada</button>' : ''}
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
            _guarda.atualizar(_semMarcadorEsc(lastVis));
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
                    _guarda.atualizar(_semMarcadorEsc(_filter2.push(chunk)));
                });
                finalText = _filter2.finish();
                _fbOk = !!finalText.trim();
            } catch(e) { console.warn('[handleChat] Fallback também falhou:', e); }

            if (!_fbOk) {
                const _rq = query.replace(/'/g, "\\'");
                contentEl.innerHTML = `<div style="color:var(--text-muted);font-style:italic;font-size:13px;margin-bottom:10px;">⚠️ Não foi possível obter resposta dos modelos disponíveis no momento.</div><button onclick="this.closest('.answer-card').remove();${_jsRefazer(_optsRetry, _rq)}" style="padding:8px 18px;border-radius:8px;background:var(--primary);color:#fff;border:none;cursor:pointer;font-weight:600;font-size:13px;">🔄 Tentar novamente</button>`;
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
            contentEl.innerHTML = `<div style="color:var(--text-muted);font-style:italic;font-size:13px;margin-bottom:10px;">⚠️ A resposta não foi concluída. Tente novamente.</div><button onclick="this.closest('.answer-card').remove();${_jsRefazer(_optsRetry, _rq)}" style="padding:8px 18px;border-radius:8px;background:var(--primary);color:#fff;border:none;cursor:pointer;font-weight:600;font-size:13px;">🔄 Tentar novamente</button>`;
            feedbackEl.style.display = 'flex';
            scrollToBottom(true);
            return;
        }

        // Esclarecimento com botões (js/app/esclarecimento.js): a IA terminou com [[BOTOES: a | b | c]]? O marcador SAI do texto sempre; as opções só viram botões se o modo permitia.
        let _opcoesEsc = null;
        if (typeof Esc !== 'undefined') {
            try {
                const _x = Esc.extrair(finalText);
                finalText = _x.texto;
                if (_modoEsc !== 'proibido' && _x.opcoes) {
                    if (_rodadasEsc > 0 && Esc.repetida(finalText, opts.perguntasEsc)) console.log('%c💬 [esclarecimento] a IA repetiu uma pergunta já respondida — botões descartados', 'color:#7c3aed;font-weight:600;');
                    else { _opcoesEsc = _x.opcoes; if (!finalText.trim()) finalText = 'Para eu te ajudar melhor, escolha a opção que mais se parece com o seu caso:'; }
                }
            } catch (e) { console.warn('[esclarecimento] não consegui ler o marcador de botões:', e); }
        }

        // Idioma: sempre português do Brasil. Se um modelo (ex.: o fallback North Mini) respondeu em inglês, traduz ANTES de mostrar e de guardar no log.
        finalText = (await _guarda.concluir(finalText)).texto;

        // Entrega o texto final pra fila de revelação em vez de estampar tudo de uma vez — assim
        // o final da resposta continua aparecendo no mesmo ritmo fluido, mesmo que o modelo tenha
        // sido rápido o bastante pra já ter mandado tudo de uma vez só. Sem forçar rolagem aqui:
        // a revelação ainda pode estar no meio do caminho nesse ponto, e forçar desceria a tela
        // antes mesmo dela terminar de aparecer — deixa o usuário livre pra ler do jeito que quiser.
        _revelacao.atualizar(finalText);
        if (_opcoesEsc) {
            // pergunta de esclarecimento: não é uma resposta final (sem "foi útil?", sem atalhos); os botões entram quando o texto termina de aparecer.
            // Quem já escolheu (ou fixou) o formato curta/completa não escolhe de novo na passada seguinte.
            const _fmtSeguinte = (!vum && (opts.formato || opts.formatoDecidido || (typeof Formato !== 'undefined' && Formato.preferencia() !== 'perguntar'))) ? _formato : null;
            feedbackEl.style.display = 'none';
            const _perg = Esc.perguntaDe(finalText), _opc = _opcoesEsc.slice();
            _revelacao.finalizar(() => { try { Esc.mostrar(card, { base: query, pergunta: _perg, perguntas: (opts.perguntasEsc || []).concat(_perg), opcoes: _opc, rodadas: _rodadasEsc, formato: _fmtSeguinte }); } catch (e) { console.warn('[esclarecimento] não consegui mostrar os botões:', e); } });
            if (document.hidden) _enviarNotificacaoNavegador('🤖 Suporte Bsoft TMS', 'Preciso de uma informação para te ajudar — escolha uma opção no chat.', 'bsoft-ia-resposta');
        } else {
            _revelacao.finalizar();
            feedbackEl.style.display = 'flex';
        }
        adicionarMensagemNaConversa('ai', finalText.replace(/\*\*(.*?)\*\*/g, '$1'));
        if (_formato === 'curta' && typeof Formato !== 'undefined') Formato.marcarNoContexto(ts);
        // Guarda a resposta apresentada no log (vai para a fila de revisão da Área Administrativa).
        // Pergunta de esclarecimento: guarda também as opções e entra como "ignorada" na Revisão (não é uma resposta que possa virar resposta rápida).
        registrarRespostaNoLog(_logTs, { resposta: finalText + (_opcoesEsc ? '\n\n[Botões oferecidos: ' + _opcoesEsc.join(' | ') + ']' : ''), fonte: 'ia', modelo: _im, fontes: _fontesUsadas, revisao: _opcoesEsc ? 'ignorada' : undefined });
        simEnviarAoPainel({ tipo: 'bsoft:sim:trace', fonte: 'ia', pergunta: query, modelo: _im, ms: Math.round(performance.now() - _t0), bloqueios: window.BSOFT_SIM_BLOQUEIOS.length, bloqueiosLista: window.BSOFT_SIM_BLOQUEIOS.slice(-20), forcouIA: !!opts.forcarIA, formato: _formato, esclarecimento: _opcoesEsc, modoEsclarecimento: _modoEsc, rrContexto: rrUsadas.map(x => ({ id: x.item.id, pct: Math.round(x.score * 100) })) });
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
            if (ce) ce.innerHTML = (partial ? renderMd(_semMarcadorEsc(partial)) : ce.innerHTML) + '<p style="color:#dc2626;font-size:12px;margin-top:8px">⚠️ Resposta interrompida. Tente novamente.</p>';
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
