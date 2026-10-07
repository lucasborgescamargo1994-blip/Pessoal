/* js/app/conversas.js — Lista, criação, seleção e exclusão de conversas. */
// ═══════════════════════════════════════════════════════════
//  SISTEMA DE CONVERSAS
// ═══════════════════════════════════════════════════════════
function carregarConversas() {
    try {
        const saved = localStorage.getItem(CONVERSAS_KEY); conversas = saved ? JSON.parse(saved) : [];
        const ultimaConversa = conversas.length > 0 ? conversas[0] : null;
        if (ultimaConversa && ultimaConversa.mensagens.length === 0) { conversaAtivaId = ultimaConversa.id; }
        else { criarNovaConversa(); }
        renderizarListaConversas();
    } catch(e) { conversas = []; criarNovaConversa(); }
}
function salvarConversas() { try { localStorage.setItem(CONVERSAS_KEY, JSON.stringify(conversas)); if (conversaAtivaId) localStorage.setItem(CONVERSA_ATIVA_KEY, conversaAtivaId); } catch(e) {} }
function limparTodasConversas() {
    if (!confirm('⚠️ Limpar todas as conversas?\n\nTodo o histórico será apagado permanentemente.\nEsta ação não pode ser desfeita.')) return;
    localStorage.removeItem(CONVERSAS_KEY);
    localStorage.removeItem(CONVERSA_ATIVA_KEY);
    conversas = [];
    conversaAtivaId = null;
    criarNovaConversa();
}
function criarNovaConversa(titulo = 'Nova Conversa') {
    const id = 'conv_' + Date.now();
    // logTimestamp / ultimaPerguntaLog = a ÚLTIMA pergunta registrada no log desta conversa (toda pergunta gera uma linha: ver feedback-log.js)
    conversas.unshift({ id, titulo, data: new Date().toISOString(), mensagens: [], contexto: [], primeiraPergunta: "", logTimestamp: null, ultimaPerguntaLog: "", topicoAtual: null, documentoContexto: null, mlKnowledgeId: null });
    conversaAtivaId = id; salvarConversas(); renderizarListaConversas(); limparChatStream(); return id;
}
function novaConversa() { criarNovaConversa(); document.getElementById('searchInput').focus({ preventScroll: true }); }   // (preventScroll: no simulador, o foco não "puxa" a página do painel administrativo)
function selecionarConversa(id) { if (conversaAtivaId === id) return; conversaAtivaId = id; salvarConversas(); renderizarListaConversas(); restaurarConversa(id); }
function excluirConversa(id, event) {
    event.stopPropagation();
    if (!confirm('Excluir esta conversa?')) return;
    conversas = conversas.filter(c => c.id !== id);
    if (conversaAtivaId === id) { if (conversas.length > 0) { conversaAtivaId = conversas[0].id; restaurarConversa(conversaAtivaId); } else { criarNovaConversa(); } }
    salvarConversas(); renderizarListaConversas();
}
function getConversaAtiva() { return conversas.find(c => c.id === conversaAtivaId) || null; }
function adicionarMensagemNaConversa(sender, text) {
    const conversa = getConversaAtiva(); if (!conversa) return;
    conversa.mensagens.push({ sender, text, timestamp: Date.now() });
    if (sender === 'user' && conversa.titulo === 'Nova Conversa' && conversa.mensagens.filter(m => m.sender === 'user').length === 1) { conversa.titulo = text.length > 40 ? text.substring(0, 37) + '...' : text; conversa.primeiraPergunta = text; }
    if (sender === 'user') conversa.contexto.push({ role:'user', content:text });
    else if (sender === 'ai' || sender === 'system' || sender === 'ml') conversa.contexto.push({ role:'assistant', content:text.replace(/<[^>]*>/g,'') });
    if (conversa.contexto.length > 40) conversa.contexto = conversa.contexto.slice(-40);
    if (conversa.mensagens.length > 500) conversa.mensagens = conversa.mensagens.slice(-500);
    salvarConversas(); renderizarListaConversas();
}
