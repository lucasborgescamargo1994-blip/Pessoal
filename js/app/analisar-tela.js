/* js/app/analisar-tela.js — Assistente "Analisar tela" (visão computacional). */
async function _executarAnaliseTela() {
    const btnStyle = 'display:flex;align-items:center;gap:6px;padding:6px 14px;border:1.5px solid var(--border);border-radius:8px;background:var(--surface);cursor:pointer;font-size:13px;font-weight:500;color:var(--text);transition:all .2s;';
    const btnHo = `onmouseover="this.style.borderColor='var(--primary)';this.style.background='var(--primary-light)'" onmouseout="this.style.borderColor='var(--border)';this.style.background='var(--surface)'"`;
    const _renderCard = (texto) => {
        const card = document.createElement('div'); card.className = 'answer-card';
        card.innerHTML = `<div class="answer-section"><div class="section-content">${renderMd(texto)}</div></div>
            <div class="feedback-area">
                <button onclick="analisarTelaNovaCaptura()" style="${btnStyle}" ${btnHo}>🖥️ Analisar tela novamente</button>
                <button onclick="novaConversa()" style="${btnStyle}" ${btnHo}>➕ Nova conversa</button>
            </div>`;
        document.getElementById('chatStream').appendChild(card); scrollToBottom(true);
        adicionarMensagemNaConversa('ai', texto.replace(/\*\*(.*?)\*\*/g, '$1'));
    };

    // ETAPA 1: Captura da tela
    const ldShare = appendLoadingCard('🖥️ Selecione a tela que deseja compartilhar...');
    let stream;
    try {
        stream = await navigator.mediaDevices.getDisplayMedia({ video: { cursor: 'always' }, audio: false });
    } catch(e) { ldShare.remove(); appendMessage('ai', '❌ Compartilhamento de tela cancelado.'); return; }
    ldShare.remove();
    const video = document.createElement('video'); video.srcObject = stream; video.muted = true;
    await new Promise(resolve => { video.onloadedmetadata = () => { video.play(); resolve(); }; });
    await new Promise(r => setTimeout(r, 300));
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280; canvas.height = video.videoHeight || 720;
    canvas.getContext('2d').drawImage(video, 0, 0);
    const base64Url = canvas.toDataURL('image/jpeg', 0.85);
    stream.getTracks().forEach(t => t.stop()); video.srcObject = null;

    // ETAPA 2: IA descreve o que está na tela (chamada curta e focada)
    const ld1 = appendLoadingCard('🔍 Identificando o que está na tela...');
    let descricaoTela = '';
    try {
        const r1 = await callMCPVision(
            [{ role: 'user', content: [
                { type: 'text', text: 'Descreva de forma concisa o que aparece nesta tela do sistema Bsoft TMS: nome do módulo, funcionalidade, campos visíveis e qualquer mensagem de erro. Responda em português, em até 3 linhas, sem inventar nada que não esteja visível na imagem.' },
                { type: 'image_url', image_url: { url: base64Url } }
            ]}],
            { temperature: 0.1, maxTokens: 300 }
        );
        descricaoTela = r1.text;
    } catch(e) { ld1.remove(); appendMessage('ai', '❌ Não foi possível ler a tela. Tente novamente.'); return; }
    ld1.remove();

    // ETAPA 3: Busca vetorial no manual com a descrição identificada
    const ld2 = appendLoadingCard('🧠 Buscando no manual...');
    const vp = await gerarEmbedding(normalizarSinonimos(descricaoTela));
    let rr = [];
    if (vp) {
        rr = manualVetorizado
            .map(item => ({ ...item, similaridade: calcularSimilaridade(vp, item.vetor) }))
            .sort((a, b) => b.similaridade - a.similaridade).slice(0, 15);
    }
    const trb = rr.length > 0 && rr[0].similaridade > 0.65;
    let ar = '';
    if (rr.length > 0) {
        ar = '\n=== ARTIGOS RELEVANTES DO MANUAL ===\n';
        rr.forEach((r, i) => { ar += `[${i+1} - ${(r.similaridade*100).toFixed(0)}%] ${r.erro}\nSolução: ${r.solucao}\n${r.emitir ? 'Emissão: '+r.emitir+'\n' : ''}---\n`; });
    }
    const semResultado = !trb && rr.every(r => r.similaridade < 0.5);
    const mi = semResultado ? '\n⚠️ ATENÇÃO: Nenhum artigo relevante encontrado no manual para esta tela. Informe claramente ao usuário que não encontrou e peça para descrever a dúvida no chat.' : '';
    ld2.remove();

    // Cruza a descrição da tela com a tabela Rotinas -- ajuda a confirmar o nome OFICIAL da tela
    // (em vez de confiar só no palpite da IA de visão) e, se fizer sentido, informar o nome
    // interno/caminho técnico da rotina como referência extra.
    const rotinasRel = _buscarRotinasRelevantes(descricaoTela, 3);
    let rotinasCtx = '';
    if (rotinasRel.length > 0) {
        rotinasCtx = '\n=== ROTINA(S) DO SISTEMA IDENTIFICADA(S) (use pra confirmar o nome oficial da tela) ===\n';
        rotinasRel.forEach((x, i) => { rotinasCtx += `\n[ROTINA ${i+1} - sim:${(x.sim*100).toFixed(0)}%]\n${_formatarRotinaParaPrompt(x.item)}\n`; });
    }

    // ETAPA 4: Resposta final usando APENAS os artigos encontrados
    const ch = obterContextoHorario();
    const prompt = `🏢 VOCÊ É UM AGENTE DE SUPORTE DA BSOFT TMS\n\n${ch}\n\nO usuário compartilhou uma captura de tela para análise.\n\nTELA IDENTIFICADA: ${descricaoTela}\n${rotinasCtx}\n🎯 REGRAS OBRIGATÓRIAS:\n1. Use APENAS as informações dos artigos do manual abaixo. NUNCA invente.\n2. Se não encontrar no manual, diga claramente que não encontrou e peça para descrever a dúvida no chat.\n3. Relacione o que está visível na tela com o que o manual diz.\n4. Se a seção "ROTINA(S) DO SISTEMA IDENTIFICADA(S)" tiver algo relevante, use o Nome oficial dela pra confirmar/corrigir como você chama a tela na resposta. Só cite o nome interno/caminho técnico da rotina se isso realmente ajudar o usuário (ex.: pedido de suporte técnico) -- não é obrigatório mencionar em toda resposta.${mi}\n\n📚 MANUAL BSOFT TMS:\n${ar || 'Nenhum artigo relevante encontrado para esta tela.'}\n\n📝 FORMATO:\n- Responda em Markdown limpo\n- Use **negrito** para termos importantes\n- No final, SEMPRE inclua: "Se não era isso que eu queria que analise na tela, pode perguntar no chat o que necessita exatamente."`;

    const ld3 = appendLoadingCard('🤖 Analisando com base no manual...');
    try {
        const result = await callMCPVision(
            [{ role: 'user', content: [{ type: 'text', text: prompt }, { type: 'image_url', image_url: { url: base64Url } }]}],
            { temperature: 0.2, maxTokens: 4096 }
        );
        ld3.remove(); _renderCard(result.text);
    } catch(e) {
        ld3.remove();
        const retryMsg = appendMessage('ai', '⚠️ Erro na análise. Tentando novamente em <strong>5</strong> segundos...');
        for (let i = 4; i >= 1; i--) {
            await new Promise(r => setTimeout(r, 1000));
            retryMsg.innerHTML = `⚠️ Erro na análise. Tentando novamente em <strong>${i}</strong> segundo${i !== 1 ? 's' : ''}...`;
        }
        await new Promise(r => setTimeout(r, 1000)); retryMsg.remove();
        const ld4 = appendLoadingCard('🤖 Analisando com base no manual (2ª tentativa)...');
        try {
            const result2 = await callMCPVision(
                [{ role: 'user', content: [{ type: 'text', text: prompt }, { type: 'image_url', image_url: { url: base64Url } }]}],
                { temperature: 0.2, maxTokens: 4096 }
            );
            ld4.remove(); _renderCard(result2.text);
        } catch(e2) {
            ld4.remove();
            appendMessage('ai', `❌ Não foi possível analisar a tela. Descreva sua dúvida no chat ou tente novamente.<br><button onclick="analisarTelaNovaCaptura()" style="${btnStyle};margin-top:10px;" ${btnHo}>🖥️ Analisar tela novamente</button>`);
        }
    }
}
async function btnWelcomeAnalisarTela() {
    const welcome = document.getElementById('welcomeMsg');
    if (welcome) welcome.remove();
    appendMessage('user', '🖥️ Analisar tela');
    adicionarMensagemNaConversa('user', 'Analisar tela');
    await _executarAnaliseTela();
}
async function analisarTelaNovaCaptura() {
    appendMessage('user', '🖥️ Analisar tela novamente');
    adicionarMensagemNaConversa('user', 'Analisar tela novamente');
    await _executarAnaliseTela();
}
async function _executarAnaliseImagem(base64Url, fileName) {
    const btnStyle = 'display:flex;align-items:center;gap:6px;padding:6px 14px;border:1.5px solid var(--border);border-radius:8px;background:var(--surface);cursor:pointer;font-size:13px;font-weight:500;color:var(--text);transition:all .2s;';
    const btnHo = `onmouseover="this.style.borderColor='var(--primary)';this.style.background='var(--primary-light)'" onmouseout="this.style.borderColor='var(--border)';this.style.background='var(--surface)'"`;
    const _renderCard = (texto) => {
        const card = document.createElement('div'); card.className = 'answer-card';
        card.innerHTML = `<div class="answer-section"><div class="section-content">${renderMd(texto)}</div></div>
            <div class="feedback-area">
                <button onclick="document.getElementById('fileInput').click()" style="${btnStyle}" ${btnHo}>📎 Analisar outra imagem</button>
                <button onclick="novaConversa()" style="${btnStyle}" ${btnHo}>➕ Nova conversa</button>
            </div>`;
        document.getElementById('chatStream').appendChild(card); scrollToBottom(true);
        adicionarMensagemNaConversa('ai', texto.replace(/\*\*(.*?)\*\*/g, '$1'));
    };
    // ETAPA 1: IA descreve o que está na imagem
    const ld1 = appendLoadingCard('🔍 Identificando o que está na imagem...');
    let descricaoTela = '';
    try {
        const r1 = await callMCPVision(
            [{ role: 'user', content: [
                { type: 'text', text: 'Descreva de forma concisa o que aparece nesta imagem do sistema Bsoft TMS: nome do módulo, funcionalidade, campos visíveis e qualquer mensagem de erro. Responda em português, em até 3 linhas, sem inventar nada que não esteja visível na imagem.' },
                { type: 'image_url', image_url: { url: base64Url } }
            ]}],
            { temperature: 0.1, maxTokens: 300 }
        );
        descricaoTela = r1.text;
    } catch(e) { ld1.remove(); appendMessage('ai', '❌ Não foi possível ler a imagem. Tente novamente.'); return; }
    ld1.remove();
    // ETAPA 2: Busca vetorial com a descrição identificada
    const ld2 = appendLoadingCard('🧠 Buscando no manual...');
    const vp = await gerarEmbedding(normalizarSinonimos(descricaoTela));
    let rr = [];
    if (vp) {
        rr = manualVetorizado
            .map(item => ({ ...item, similaridade: calcularSimilaridade(vp, item.vetor) }))
            .sort((a, b) => b.similaridade - a.similaridade).slice(0, 15);
    }
    let ar = '';
    if (rr.length > 0) {
        ar = '\n=== ARTIGOS RELEVANTES DO MANUAL ===\n';
        rr.forEach((r, i) => { ar += `[${i+1} - ${(r.similaridade*100).toFixed(0)}%] ${r.erro}\nSolução: ${r.solucao}\n${r.emitir ? 'Emissão: '+r.emitir+'\n' : ''}---\n`; });
    }
    const semResultado = rr.length === 0 || rr[0].similaridade < 0.5;
    const mi = semResultado ? '\n⚠️ ATENÇÃO: Nenhum artigo relevante encontrado no manual para esta imagem. Informe claramente ao usuário que não encontrou e peça para descrever a dúvida no chat.' : '';
    ld2.remove();
    // Cruza a descrição da imagem com a tabela Rotinas -- mesma ideia do "Analisar tela" por
    // compartilhamento de tela, só que aqui pra imagem anexada.
    const rotinasRel = _buscarRotinasRelevantes(descricaoTela, 3);
    let rotinasCtx = '';
    if (rotinasRel.length > 0) {
        rotinasCtx = '\n=== ROTINA(S) DO SISTEMA IDENTIFICADA(S) (use pra confirmar o nome oficial da tela) ===\n';
        rotinasRel.forEach((x, i) => { rotinasCtx += `\n[ROTINA ${i+1} - sim:${(x.sim*100).toFixed(0)}%]\n${_formatarRotinaParaPrompt(x.item)}\n`; });
    }
    // ETAPA 3: Resposta final usando APENAS os artigos encontrados
    const ch = obterContextoHorario();
    const prompt = `🏢 VOCÊ É UM AGENTE DE SUPORTE DA BSOFT TMS\n\n${ch}\n\nO usuário anexou uma imagem para análise.\n\nIMAGEM IDENTIFICADA: ${descricaoTela}\n${rotinasCtx}\n🎯 REGRAS OBRIGATÓRIAS:\n1. Use APENAS as informações dos artigos do manual abaixo. NUNCA invente.\n2. Se não encontrar no manual, diga claramente que não encontrou e peça para descrever a dúvida no chat.\n3. Relacione o que está visível na imagem com o que o manual diz.\n4. Se a seção "ROTINA(S) DO SISTEMA IDENTIFICADA(S)" tiver algo relevante, use o Nome oficial dela pra confirmar/corrigir como você chama a tela na resposta.${mi}\n\n📚 MANUAL BSOFT TMS:\n${ar || 'Nenhum artigo relevante encontrado para esta imagem.'}\n\n📝 FORMATO:\n- Responda em Markdown limpo\n- Use **negrito** para termos importantes\n- No final, SEMPRE inclua: "Se não era isso que eu queria que analise na imagem, pode perguntar no chat o que necessita exatamente."`;
    const ld3 = appendLoadingCard('🤖 Analisando com base no manual...');
    try {
        const result = await callMCPVision(
            [{ role: 'user', content: [{ type: 'text', text: prompt }, { type: 'image_url', image_url: { url: base64Url } }]}],
            { temperature: 0.2, maxTokens: 4096 }
        );
        ld3.remove(); _renderCard(result.text);
    } catch(e) {
        ld3.remove();
        const retryMsg = appendMessage('ai', '⚠️ Erro na análise. Tentando novamente em <strong>5</strong> segundos...');
        for (let i = 4; i >= 1; i--) {
            await new Promise(r => setTimeout(r, 1000));
            retryMsg.innerHTML = `⚠️ Erro na análise. Tentando novamente em <strong>${i}</strong> segundo${i !== 1 ? 's' : ''}...`;
        }
        await new Promise(r => setTimeout(r, 1000)); retryMsg.remove();
        const ld4 = appendLoadingCard('🤖 Analisando com base no manual (2ª tentativa)...');
        try {
            const result2 = await callMCPVision(
                [{ role: 'user', content: [{ type: 'text', text: prompt }, { type: 'image_url', image_url: { url: base64Url } }]}],
                { temperature: 0.2, maxTokens: 4096 }
            );
            ld4.remove(); _renderCard(result2.text);
        } catch(e2) {
            ld4.remove();
            appendMessage('ai', `❌ Não foi possível analisar a imagem. Descreva sua dúvida no chat ou tente novamente.<br><button onclick="document.getElementById('fileInput').click()" style="${btnStyle};margin-top:10px;" ${btnHo}>📎 Analisar outra imagem</button>`);
        }
    }
}
