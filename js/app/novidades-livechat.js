/* js/app/novidades-livechat.js — Novidades e chat ao vivo (Supabase Realtime). */

// ═══════════════════════════════════════════════════════════
//  CANAL DE NOVIDADES & LIVE CHAT (Supabase Realtime)
// ═══════════════════════════════════════════════════════════
const NEWS_STORAGE_KEY = 'bsoft_novidades_v1';
const LIVE_CHAT_TABLE = 'suporte_live_chat';
// ID único da sessão do usuário (persiste no localStorage)
const chatSessionId = (() => {
    const k = 'bsoft_chat_session';
    let id = localStorage.getItem(k);
    if (!id) { id = crypto.randomUUID(); localStorage.setItem(k, id); }
    return id;
})();

let newsPanelOpen = true; // sempre visível como coluna
let newsAdminMode = false;
let currentNewsTab = 'novidades';
let chatSubscription = null;
let chatUnreadCount = 0;
let adminSelectedSession = null;
let _adminRefreshInterval = null;

function toggleNewsPanel() { /* painel fixo, sem toggle */ }

// ── Abas ────────────────────────────────────────────────────

function switchNewsTab(tab) {
    currentNewsTab = tab;
    document.querySelectorAll('.news-tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    document.getElementById('newsTabNovidades').style.display = tab === 'novidades' ? 'flex' : 'none';
    document.getElementById('newsTabChat').style.display      = tab === 'chat'      ? 'flex' : 'none';
    if (tab === 'novidades') { _pararRefreshAdmin(); renderNovidades(); }
    if (tab === 'chat') {
        chatUnreadCount = 0;
        _atualizarBadgeChat();
        _initChatTab();
    }
}

// A publicação/remoção de novidades agora é feita na Área Administrativa (admin/index.html → aba "Novidades").
// newsAdminMode fica sempre false aqui: o app só LÊ as novidades. (O chat ao vivo, hoje oculto, ainda consulta essa variável.)

// ── Novidades (Supabase Realtime) ───────────────────────────
const NOVIDADES_TABLE = 'suporte_novidades';
let novidadesSubscription = null;

const _newsTypeMap = {
    update:  { label: '✅ Atualização', cls: 'news-type-update' },
    new:     { label: '🆕 Novidade',    cls: 'news-type-new' },
    warning: { label: '⚠️ Aviso',       cls: 'news-type-warning' },
    info:    { label: 'ℹ️ Info',         cls: 'news-type-info' },
};

function _renderNovidadeItem(item) {
    const t = _newsTypeMap[item.tipo] || _newsTypeMap.info;
    const data = new Date(item.created_at).toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric' });
    const div = document.createElement('div');
    div.className = 'news-item';
    div.dataset.newsId = item.id;
    div.innerHTML = `
        <div class="news-item-header">
            <span class="news-type-badge ${t.cls}">${t.label}</span>
            <span class="news-date">${data}</span>
        </div>
        <div class="news-title">${escapeHtml(item.titulo)}</div>
        <div class="news-content">${escapeHtml(item.conteudo).replace(/\n/g,'<br>')}</div>`;
    return div;
}

async function renderNovidades() {
    const feed = document.getElementById('newsFeed');
    const empty = document.getElementById('newsEmpty');
    if (!feed) return;

    const { data, error } = await sb.from(NOVIDADES_TABLE)
        .select('*').order('created_at', { ascending: false });

    Array.from(feed.querySelectorAll('.news-item')).forEach(el => el.remove());

    if (error || !data || !data.length) {
        empty.style.display = 'block';
        return;
    }
    empty.style.display = 'none';
    data.forEach(item => feed.appendChild(_renderNovidadeItem(item)));

    // Inscreve realtime uma só vez
    if (!novidadesSubscription) _subscribeNovidades();
}

function _subscribeNovidades() {
    novidadesSubscription = sb.channel('novidades_channel')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: NOVIDADES_TABLE }, payload => {
            const feed = document.getElementById('newsFeed');
            const empty = document.getElementById('newsEmpty');
            if (!feed) return;
            empty.style.display = 'none';
            feed.insertBefore(_renderNovidadeItem(payload.new), feed.firstChild);
            // Notifica no navegador só quando a aba não está em primeiro plano — quem já está
            // olhando vê o item aparecer no painel na hora, não precisa de aviso duplicado.
            if (document.hidden) {
                const _t = _newsTypeMap[payload.new.tipo] || _newsTypeMap.info;
                _enviarNotificacaoNavegador(`${_t.label} — Bsoft TMS`, payload.new.titulo, 'bsoft-novidade');
            }
        })
        .on('postgres_changes', { event: 'DELETE', schema: 'public', table: NOVIDADES_TABLE }, payload => {
            document.querySelector(`[data-news-id="${payload.old.id}"]`)?.remove();
            const feed = document.getElementById('newsFeed');
            if (feed && !feed.querySelector('.news-item'))
                document.getElementById('newsEmpty').style.display = 'block';
        })
        .subscribe();
}

// ── Live Chat (Supabase) ────────────────────────────────────

function _initChatTab() {
    if (newsAdminMode) {
        document.getElementById('chatIdentityBar').style.display = 'none';
        document.getElementById('chatIdentityEditBar').style.display = 'none';
        _mostrarListaSessions();
        _iniciarRefreshAdmin();
    } else {
        _pararRefreshAdmin();
        _esconderListaSessions();
        _atualizarIdentidadeChat();
        _carregarChat(chatSessionId);
        _subscribeChat(chatSessionId);
    }
}

// ── Nome do usuário no chat ─────────────────────────────────
function _atualizarIdentidadeChat() {
    const nome = getWindowsUser();
    const display = document.getElementById('chatUserNameDisplay');
    const bar = document.getElementById('chatIdentityBar');
    if (!display) return;
    if (bar) bar.style.display = 'flex';
    if (!nome || nome === 'Desconhecido') {
        display.textContent = 'Clique para definir seu nome';
        display.classList.add('unknown');
        editarNomeChat();
    } else {
        display.textContent = nome;
        display.classList.remove('unknown');
    }
}

function editarNomeChat() {
    const nome = getWindowsUser();
    const inp = document.getElementById('chatUserNameInput');
    if (inp) inp.value = (nome === 'Desconhecido' ? '' : nome);
    document.getElementById('chatIdentityBar').style.display = 'none';
    document.getElementById('chatIdentityEditBar').style.display = 'flex';
    if (inp) setTimeout(() => inp.focus(), 50);
}

function cancelarEditarNome() {
    document.getElementById('chatIdentityEditBar').style.display = 'none';
    document.getElementById('chatIdentityBar').style.display = 'flex';
}

function salvarNomeChat() {
    const inp = document.getElementById('chatUserNameInput');
    const nome = inp.value.trim();
    if (!nome) { inp.style.borderColor = '#ef4444'; setTimeout(() => inp.style.borderColor = '', 1000); return; }
    localStorage.setItem('bsoft_usuario_nome', nome);
    cancelarEditarNome();
    _atualizarIdentidadeChat();
}

function _esconderListaSessions() {
    const sessions = document.getElementById('chatAdminSessions');
    const area = document.getElementById('chatLiveArea');
    if (sessions) sessions.style.display = 'none';
    if (area) area.style.display = 'flex';
    const back = document.getElementById('chatAdminBack');
    if (back) { back.style.display = 'none'; adminSelectedSession = null; }
    document.getElementById('chatLiveStatus').textContent = 'Suporte Online';
}

function _iniciarRefreshAdmin() {
    _pararRefreshAdmin();
    _adminRefreshInterval = setInterval(() => {
        // só atualiza a lista se admin estiver na aba chat e não estiver dentro de uma conversa
        if (newsAdminMode && currentNewsTab === 'chat' && !adminSelectedSession) {
            _mostrarListaSessions();
        }
    }, 20000);
}

function _pararRefreshAdmin() {
    if (_adminRefreshInterval) { clearInterval(_adminRefreshInterval); _adminRefreshInterval = null; }
}

async function _mostrarListaSessions() {
    _unsubscribeChat();
    const area = document.getElementById('chatLiveArea');
    const sessions = document.getElementById('chatAdminSessions');
    if (area) area.style.display = 'none';
    if (sessions) sessions.style.display = 'flex';

    sessions.innerHTML = `
        <div class="chat-sessions-header">
            <span>💬 Conversas</span>
            <button class="btn-refresh-sessions" onclick="_mostrarListaSessions()" title="Atualizar">🔄</button>
        </div>
        <div style="padding:20px;text-align:center;color:#a8a29e;font-size:12px;">Carregando...</div>`;

    const { data, error } = await sb.from(LIVE_CHAT_TABLE)
        .select('session_id, role, content, created_at, usuario_nome')
        .order('created_at', { ascending: false });

    if (error) {
        sessions.innerHTML += `<div style="padding:16px;color:#dc2626;font-size:12px;">Erro: ${escapeHtml(error.message)}<br><small>Verifique se a tabela '${LIVE_CHAT_TABLE}' existe no Supabase.</small></div>`;
        return;
    }

    // Agrupa por session_id
    const map = {};
    (data || []).forEach(m => {
        if (!map[m.session_id]) map[m.session_id] = { last: m, hasUserMsg: false, nomeUsuario: '' };
        if (m.role === 'user') {
            map[m.session_id].hasUserMsg = true;
            if (m.usuario_nome && m.usuario_nome !== 'Desconhecido')
                map[m.session_id].nomeUsuario = m.usuario_nome;
        }
    });

    const sessoes = Object.entries(map).sort((a,b) => new Date(b[1].last.created_at) - new Date(a[1].last.created_at));

    sessions.innerHTML = `
        <div class="chat-sessions-header">
            <span>💬 Conversas (${sessoes.length})</span>
            <button class="btn-refresh-sessions" onclick="_mostrarListaSessions()" title="Atualizar">🔄</button>
        </div>` +
        (sessoes.length === 0
            ? '<div style="padding:24px;text-align:center;color:#a8a29e;font-size:13px;">Nenhuma conversa ainda.</div>'
            : sessoes.map(([sid, info]) => {
                const nome = info.nomeUsuario || ('Usuário ' + sid.substring(0,6));
                return `
                <div class="chat-session-item ${info.hasUserMsg ? 'unread' : ''}" onclick="abrirSessaoAdmin('${escapeHtml(sid)}','${escapeHtml(info.nomeUsuario)}')">
                    <div class="chat-session-id">👤 ${escapeHtml(nome)}</div>
                    <div class="chat-session-preview">${escapeHtml((info.last.content || '').substring(0,55))}</div>
                    <div class="chat-session-time">${new Date(info.last.created_at).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}</div>
                </div>`;}).join(''));
}

async function abrirSessaoAdmin(sessionId, nomeUsuario) {
    adminSelectedSession = sessionId;
    const sessions = document.getElementById('chatAdminSessions');
    const area = document.getElementById('chatLiveArea');
    if (sessions) sessions.style.display = 'none';
    if (area) area.style.display = 'flex';
    const back = document.getElementById('chatAdminBack');
    if (back) { back.style.display = 'flex'; }
    document.getElementById('chatAdminSessionLabel').textContent = '👤 ' + (nomeUsuario || sessionId.substring(0,8) + '…');
    document.getElementById('chatLiveStatus').textContent = 'Respondendo como Lucas';
    await _carregarChat(sessionId);
    _subscribeChat(sessionId);
}

function voltarListaSessions() {
    _unsubscribeChat();
    _mostrarListaSessions();
}

async function _carregarChat(sessionId) {
    const { data, error } = await sb.from(LIVE_CHAT_TABLE)
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true });
    if (error) {
        document.getElementById('chatLiveStatus').textContent = 'Erro ao carregar. Tabela criada no Supabase?';
        return;
    }
    _renderMensagens(data || []);
    if (!newsAdminMode) document.getElementById('chatLiveStatus').textContent = 'Suporte Online';
}

function _renderMensagens(msgs) {
    const container = document.getElementById('chatLiveMessages');
    if (!container) return;
    container.innerHTML = msgs.length === 0
        ? '<div class="chat-empty"><div style="font-size:28px;margin-bottom:6px;">💬</div><p>Nenhuma mensagem ainda.<br>Envie sua dúvida ou problema!</p></div>'
        : msgs.map(m => `
            <div class="chat-msg ${m.role}">
                <div class="chat-bubble">${escapeHtml(m.content).replace(/\n/g,'<br>')}</div>
                <div class="chat-time">${new Date(m.created_at).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}</div>
            </div>`).join('');
    container.scrollTop = container.scrollHeight;
}

function _subscribeChat(sessionId) {
    _unsubscribeChat();
    chatSubscription = sb.channel('live_chat_' + sessionId)
        .on('postgres_changes', {
            event: 'INSERT', schema: 'public', table: LIVE_CHAT_TABLE,
            filter: `session_id=eq.${sessionId}`
        }, payload => {
            const m = payload.new;
            const container = document.getElementById('chatLiveMessages');
            if (!container) return;
            container.querySelector('.chat-empty')?.remove();
            const div = document.createElement('div');
            div.className = `chat-msg ${m.role}`;
            div.innerHTML = `<div class="chat-bubble">${escapeHtml(m.content).replace(/\n/g,'<br>')}</div><div class="chat-time">${new Date(m.created_at).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}</div>`;
            container.appendChild(div);
            container.scrollTop = container.scrollHeight;
            // Badge e notificação — admin responde ao usuário
            if (m.role === 'admin' && !newsAdminMode) {
                if (currentNewsTab !== 'chat' || document.visibilityState !== 'visible') {
                    chatUnreadCount++;
                    _atualizarBadgeChat();
                }
                _mostrarNotifToast('💬 Suporte respondeu', m.content, null, null);
                _enviarNotificacaoChat('💬 Suporte respondeu', m.content);
            }
        })
        .subscribe();
}

function _unsubscribeChat() {
    if (chatSubscription) { try { sb.removeChannel(chatSubscription); } catch(e){} chatSubscription = null; }
}

async function enviarMensagemChat() {
    const inp = document.getElementById('chatLiveInput');
    const content = inp.value.trim();
    if (!content) return;
    const role = newsAdminMode ? 'admin' : 'user';
    const sessionId = newsAdminMode ? adminSelectedSession : chatSessionId;
    if (!sessionId) { alert('Selecione uma conversa primeiro.'); return; }
    inp.value = '';
    document.getElementById('chatSendBtn').disabled = true;
    const { error } = await sb.from(LIVE_CHAT_TABLE).insert({ session_id: sessionId, role, content, usuario_nome: newsAdminMode ? 'Lucas (Suporte)' : getWindowsUser() });
    document.getElementById('chatSendBtn').disabled = false;
    inp.focus();
    if (error) { alert('Erro ao enviar: ' + error.message); }
}

function _atualizarBadgeChat() {
    const badge = document.getElementById('chatUnreadBadge');
    if (!badge) return;
    if (chatUnreadCount > 0) {
        badge.textContent = chatUnreadCount > 9 ? '9+' : chatUnreadCount;
        badge.classList.add('visible');
    } else {
        badge.classList.remove('visible');
    }
}

// ── Notificações ────────────────────────────────────────────
let _adminGlobalSub = null;
let _notifToastTimeout = null;
let _notifToastSession = null; // { id, nome } da sessão a abrir ao clicar

function _mostrarNotifToast(titulo, corpo, sessionId, nomeSession) {
    document.getElementById('panelNotifTitle').textContent = titulo;
    document.getElementById('panelNotifBody').textContent = corpo.substring(0, 80);
    _notifToastSession = sessionId ? { id: sessionId, nome: nomeSession } : null;
    const toast = document.getElementById('panelNotifToast');
    // restart animation
    toast.classList.remove('visible');
    void toast.offsetWidth;
    toast.classList.add('visible');
    clearTimeout(_notifToastTimeout);
    _notifToastTimeout = setTimeout(_fecharNotifToast, 6000);
}

function _fecharNotifToast() {
    clearTimeout(_notifToastTimeout);
    document.getElementById('panelNotifToast')?.classList.remove('visible');
}

function _clicarNotifToast() {
    _fecharNotifToast();
    chatUnreadCount = 0;
    _atualizarBadgeChat();
    switchNewsTab('chat');
    if (newsAdminMode && _notifToastSession) {
        abrirSessaoAdmin(_notifToastSession.id, _notifToastSession.nome);
    }
}

function _pedirPermissaoNotificacao() {
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
    }
}

function _tocarSomNotificacao() {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.frequency.value = 830; osc.type = 'sine';
        gain.gain.setValueAtTime(0.25, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
        osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.35);
    } catch(e) {}
}

// Genérica — usada pelo chat ao vivo (tag 'bsoft-chat'), pelas novidades (tag 'bsoft-novidade')
// e pela resposta da IA no chat principal (tag 'bsoft-ia-resposta). Cada gatilho usa sua própria
// tag pra uma notificação não substituir/apagar outra ainda não vista na bandeja do sistema.
function _enviarNotificacaoNavegador(titulo, corpo, tag) {
    _tocarSomNotificacao();
    if (!('Notification' in window)) return;
    const texto = (corpo || '').substring(0, 100);
    const _tag = tag || 'bsoft-geral';
    const disparar = () => { try { new Notification(titulo, { body: texto, tag: _tag, renotify: true }); } catch(e) {} };
    if (Notification.permission === 'granted') {
        disparar();
    } else if (Notification.permission !== 'denied') {
        Notification.requestPermission().then(p => { if (p === 'granted') disparar(); });
    }
}
function _enviarNotificacaoChat(titulo, corpo) {
    _enviarNotificacaoNavegador(titulo, corpo, 'bsoft-chat');
}

function _subscribeAdminGlobal() {
    if (_adminGlobalSub) return;
    _adminGlobalSub = sb.channel('admin_global_msgs')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: LIVE_CHAT_TABLE }, payload => {
            const m = payload.new;
            if (m.role !== 'user') return;
            // não notifica se já está visualizando essa sessão e a janela está em foco
            if (adminSelectedSession === m.session_id && currentNewsTab === 'chat' && document.visibilityState === 'visible') return;
            const nome = (m.usuario_nome && m.usuario_nome !== 'Desconhecido') ? m.usuario_nome : 'Usuário';
            chatUnreadCount++;
            _atualizarBadgeChat();
            _mostrarNotifToast(`💬 ${nome}`, m.content, m.session_id, nome);
            _enviarNotificacaoChat(`💬 ${nome}`, m.content);
        })
        .subscribe();
}

function _unsubscribeAdminGlobal() {
    if (_adminGlobalSub) { try { sb.removeChannel(_adminGlobalSub); } catch(e){} _adminGlobalSub = null; }
}
