/* js/app/boas-vindas.js — Tela inicial (atalhos) e botões dos assistentes. */
// Atalhos da tela inicial (grade "bento"). Cada card usa --c como cor do ícone.
function _menuBtnsHtml() {
    const isPiP = window.self !== window.top;
    const cards = [
        ['🔍', 'Erros Sefaz', 'Assistente de rejeições e erros da SEFAZ', 'btnWelcomeSefaz()', '#dc2626'],
        ['📋', 'Criar Regra', 'Monte regras arrastando os campos', 'btnWelcomeRegra()', '#7c3aed'],
        ['📊', 'Assistente de Relatórios', 'Gera o arquivo .dat de relatório personalizado', 'btnWelcomeRelatorios()', '#2563eb'],
        ['⚙️', 'Parâmetros / Funcionalidades', 'Busca parâmetros e funcionalidades do sistema', 'btnWelcomeParametros()', '#0891b2'],
        ['🖥️', 'Analisar tela', 'Compartilhe a tela e a IA analisa pra você', 'btnWelcomeAnalisarTela()', '#059669'],
        isPiP ? null : ['🗒️', 'Meu Espaço', 'Suas anotações pessoais — ficam só no seu computador', "Workspace.open('space')", '#d97706'],
        isPiP ? null : ['📅', 'Minha agenda', 'Tarefas, cronograma e lembretes — abre em uma aba', 'btnWelcomeAgenda()', '#ea580c'],
        isPiP ? null : ['🤖', 'Modo Copilot', 'Abre o assistente em janela flutuante', 'abrirCopilot()', '#6d28d9'],
        ['💬', 'Gestão de Feedback', 'Veja seus feedbacks e retornos do suporte', 'btnWelcomeFeedback()', '#be185d'],
    ].filter(Boolean);
    return `<div class="bento">${cards.map((c, i) => `<button class="bento-card" style="--i:${i};--c:${c[4]}" onclick="${c[3]}"><span class="bc-ic">${c[0]}</span><span class="bc-tx"><b>${c[1]}</b><small>${c[2]}</small></span></button>`).join('')}</div>`;
}
function _welcomeHero(si, sub, pills = '') {
    return `<div class="hero"><div class="hero-hello">${si.emoji} ${si.saudacao}!<br><span class="grad">Como posso ajudar hoje?</span></div><div class="hero-sub">${sub}</div>${pills ? `<div class="hero-meta">${pills}</div>` : ''}</div>`;
}
function _criarWelcomeMsg() {
    const w = document.createElement('div');
    w.className = 'message ai-msg';
    w.id = 'welcomeMsg';
    w.innerHTML = _welcomeHero(obterSaudacao(), 'Sou o assistente IA <b>Bsoft TMS</b>. Escolha um atalho abaixo ou digite exatamente o que precisa.') + _menuBtnsHtml();
    return w;
}
// Erros SEFAZ, Criar Regra, Relatórios e Parâmetros abrem na própria aba (js/app/ferramentas.js): o chat fica como está.
// Sem abas (Copilot / simulador) cai no fluxo antigo, dentro do chat.
function btnWelcomeSefaz() {
    if (Ferr.abrir('sefaz')) return;
    const welcome = document.getElementById('welcomeMsg');
    if (welcome) welcome.remove();
    appendMessage('user', '🔍 Erros Sefaz');
    adicionarMensagemNaConversa('user', 'Erros Sefaz');
    wizardRejeicaoSefaz().then(r => {
        if (!r) return;
        if (r.bancoDados) { document.getElementById('searchInput').focus(); return; }
        logSearch(`Erros Sefaz - ${r.codigo} (${r.tipo})`, true); gerarRespostaSefaz(r.codigo, r.tipo);
    });
}
async function btnWelcomeRegra() {
    if (Ferr.abrir('regra')) return;
    const welcome = document.getElementById('welcomeMsg');
    if (welcome) welcome.remove();
    appendMessage('user', '📋 Criar Regra');
    adicionarMensagemNaConversa('user', 'Criar Regra');
    logSearch('Criar Regra', true);
    const _tipo = await perguntarTipoRegra();
    if (_tipo === 'cte') {
        const _modoCte = await perguntarModoCte();
        if (_modoCte === 'dnd') mostrarWizardRegraDnd('');
        else if (_modoCte === 'classico') mostrarWizardRegra('');
    }
    else if (_tipo === 'contrato') {
        const _modo = await perguntarModoContrato();
        if (_modo === 'dnd') mostrarWizardContratoDnd('');
        else if (_modo === 'classico') mostrarWizardContrato('');
    }
    else if (_tipo === 'faturamento') mostrarWizardFaturamento('');
}
function btnWelcomeRelatorios() {
    if (Ferr.abrir('relatorios')) return;
    const welcome = document.getElementById('welcomeMsg');
    if (welcome) welcome.remove();
    appendMessage('user', '📊 Assistente de Relatórios');
    adicionarMensagemNaConversa('user', 'Assistente de Relatórios');
    mostrarWizardRelatorio();
}
let _paramFuncMode = false;
function btnWelcomeParametros() {
    if (Ferr.abrir('params')) return;
    const welcome = document.getElementById('welcomeMsg');
    if (welcome) welcome.remove();
    _paramFuncMode = true;
    appendMessage('ai', '⚙️ <strong>Parâmetros / Funcionalidades</strong><br>Digite o que você precisa habilitar ou configurar e pressione Enter.<br><small style="color:var(--text-muted);">Ex: <em>CIOT, NF-e automática, exclusão de CT-e, permissão de emissão...</em></small>');
    const input = document.getElementById('searchInput');
    input.placeholder = 'Ex: CIOT, NF-e automática, exclusão de CT-e...';
    input.focus();
}
// "Minha agenda": abre a Agenda na própria aba (calendário já no dia de hoje). Para ver as tarefas no chat: pergunte "quais tarefas tenho hoje?" ou use "Mostrar no chat" na agenda.
function btnWelcomeAgenda() { if (typeof V !== 'undefined' && V.Agenda && V.Agenda.abrir) V.Agenda.abrir({ date: V.Agenda.today(), view: 'cal' }); }
async function btnWelcomeFeedback() {
    const welcome = document.getElementById('welcomeMsg');
    if (welcome) welcome.remove();
    appendMessage('user', '💬 Gestão de Feedback');
    adicionarMensagemNaConversa('user', 'Gestão de Feedback');

    const ld = appendLoadingCard('💬 Buscando seus feedbacks...');
    const nomeUsuario = getWindowsUser();
    const deviceId = getOrCreateDeviceId();

    try {
        // Colunas explícitas (nada de "*"): a coluna "resposta" é grande e não é usada aqui — evita gastar transferência do Supabase.
        const _consulta = cols => sb.from('logs')
            .select(cols)
            .eq('usuario_windows', nomeUsuario)
            .eq('device_id', deviceId)
            .neq('feedback', 'Pendente')
            .order('timestamp', { ascending: false })
            .limit(30);
        let { data, error } = await _consulta('id, pergunta, feedback, motivo, retorno, timestamp, created_at');
        if (error) ({ data, error } = await _consulta('id, pergunta, feedback, motivo, timestamp, created_at'));   // tabela sem a coluna "retorno"

        ld.remove();

        if (error || !data || data.length === 0) {
            appendMessage('ai', '💬 <strong>Gestão de Feedback</strong><br><br>Você ainda não enviou nenhum feedback (👍 ou 👎) neste dispositivo.<br><small style="color:var(--text-muted)">Os feedbacks aparecem aqui após você avaliar respostas da IA.</small>');
            return;
        }

        const linhas = data.map(log => {
            const _src = log.timestamp || log.created_at;
            const _d = _src ? new Date(_src) : null;
            const _p = n => String(n).padStart(2, '0');
            const dt = log.timestamp && _d
                ? `${_p(_d.getUTCDate())}/${_p(_d.getUTCMonth()+1)}/${_d.getUTCFullYear()}, ${_p(_d.getUTCHours())}:${_p(_d.getUTCMinutes())}`
                : (log.created_at ? new Date(log.created_at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : '—');
            const pergunta = escapeHtml((log.pergunta || '—').slice(0, 120));
            const fb = log.feedback;
            const temRetorno = log.retorno && log.retorno.trim();

            let badgeHtml = '';
            let rowBg = '';
            if (fb === 'Positivo') {
                badgeHtml = `<span style="background:#dcfce7;color:#166534;border-radius:6px;padding:2px 9px;font-size:11px;font-weight:700;">👍 Positivo</span>`;
                rowBg = 'border-left:3px solid #22c55e;';
            } else if (fb === 'Negativo') {
                badgeHtml = `<span style="background:#fee2e2;color:#991b1b;border-radius:6px;padding:2px 9px;font-size:11px;font-weight:700;">👎 Negativo</span>`;
                rowBg = 'border-left:3px solid #ef4444;';
            }

            const motivoHtml = log.motivo
                ? `<div style="font-size:11px;color:#92400e;background:#fef3c7;border-radius:5px;padding:3px 8px;margin-top:4px;">📝 <em>${escapeHtml(log.motivo)}</em></div>`
                : '';

            const retornoHtml = temRetorno
                ? `<div style="font-size:12px;color:#1e40af;background:#eff6ff;border:1px solid #bfdbfe;border-radius:5px;padding:5px 9px;margin-top:5px;">📩 <strong>Retorno do suporte:</strong> ${escapeHtml(log.retorno).replace(/\n/g, '<br>')}</div>`
                : '';

            return `<div style="padding:10px 12px;border-radius:8px;background:var(--surface);border:1px solid var(--border);${rowBg}margin-bottom:8px;">
                <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                    ${badgeHtml}
                    <span style="font-size:11px;color:var(--text-muted);">${dt}</span>
                </div>
                <div style="font-size:13px;margin-top:5px;color:var(--text);">${pergunta}</div>
                ${motivoHtml}${retornoHtml}
            </div>`;
        }).join('');

        const card = document.createElement('div');
        card.className = 'answer-card';
        card.innerHTML = `<div class="answer-section"><div class="section-content">
            <strong style="font-size:15px;">💬 Seus Feedbacks</strong>
            <small style="display:block;color:var(--text-muted);margin-bottom:10px;">Dispositivo: <code style="font-size:10px;">${deviceId}</code></small>
            ${linhas}
        </div></div>
        <div class="feedback-area">
            <button onclick="novaConversa()" style="display:flex;align-items:center;gap:6px;padding:6px 14px;border:1.5px solid var(--border);border-radius:8px;background:var(--surface);cursor:pointer;font-size:13px;font-weight:500;color:var(--text);">➕ Nova conversa</button>
        </div>`;
        document.getElementById('chatStream').appendChild(card);
        scrollToBottom(true);
    } catch(e) {
        ld.remove();
        appendMessage('ai', '⚠️ Erro ao carregar feedbacks. Tente novamente.');
    }
}
