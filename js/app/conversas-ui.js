/* js/app/conversas-ui.js — Renderização da lista de conversas e da barra lateral. */
function limparChatStream() { const stream = document.getElementById('chatStream'); stream.innerHTML = ''; stream.appendChild(_criarWelcomeMsg()); }
function restaurarConversa(id) {
    const conversa = conversas.find(c => c.id === id); if (!conversa) return;
    const stream = document.getElementById('chatStream'); stream.innerHTML = '';
    if (conversa.mensagens.length === 0) { stream.appendChild(_criarWelcomeMsg()); return; }
    conversa.mensagens.forEach(msg => { const d = document.createElement('div'); d.className = msg.sender === 'system' ? 'message system-msg' : msg.sender === 'ml' ? 'message ml-msg' : `message ${msg.sender==='user'?'user-msg':'ai-msg'}`; d.innerHTML = msg.text; stream.appendChild(d); });
    scrollToBottom(true);
}
function renderizarListaConversas() {
    const lista = document.getElementById('listaConversas');
    const q = (document.getElementById('conversaSearch')?.value || '').toLowerCase().trim();
    const filtradas = q ? conversas.filter(c => c.titulo.toLowerCase().includes(q)) : conversas;
    if (filtradas.length === 0) {
        lista.innerHTML = `<div style="text-align:center;color:var(--text-muted);padding:20px;font-size:13px;">${q ? '🔍 Nenhuma conversa encontrada' : 'Nenhuma conversa ainda'}</div>`;
        return;
    }
    lista.innerHTML = filtradas.map(c => { const d = new Date(c.data); const ds = d.toLocaleDateString('pt-BR',{day:'2-digit',month:'short'}); const ia = c.id===conversaAtivaId; const ml = c.mlKnowledgeId?' 🧠':''; return `<div class="conversa-item${ia?' active':''}" onclick="selecionarConversa('${c.id}')"><div class="conversa-titulo">${escapeHtml(c.titulo)}${ml}</div><div class="conversa-data">${ds} • ${c.mensagens.length} msgs</div><button class="btn-excluir-conversa" onclick="excluirConversa('${c.id}', event)" title="Excluir">🗑️</button></div>`; }).join('');
}
function escapeHtml(text) { const d = document.createElement('div'); d.textContent = text; return d.innerHTML; }
function toggleSidebar() {
    const s = document.getElementById('sidebar');
    const expandBtn = document.querySelector('.btn-toggle-sidebar');
    if (window.innerWidth <= 768) {
        s.classList.toggle('open');
    } else {
        const willCollapse = !s.classList.contains('collapsed');
        s.classList.toggle('collapsed');
        if (expandBtn) expandBtn.style.display = willCollapse ? 'flex' : 'none';
    }
}
document.addEventListener('click', function(e) { const s = document.getElementById('sidebar'); const t = document.querySelector('.btn-toggle-sidebar'); if (s.classList.contains('open') && !s.contains(e.target) && e.target !== t && !t.contains(e.target)) s.classList.remove('open'); });
