/* js/app/youtube.js — YouTube Bsoft integrado. */
// ═══════════════════════════════════════════════════════════
//  YOUTUBE BSOFT INTEGRADO (APENAS IFRAME - SEM FETCH)
// ═══════════════════════════════════════════════════════════
let ytPanelOpen = false;
let ytCurrentVideoId = null;
const YT_CHANNEL_ID = 'UCbmFIPD1wvpBlQuDIA5h-Cg';
const YT_CHANNEL_URL = 'https://www.youtube.com/@bsoft';

function toggleYTPanel() {
    ytPanelOpen = !ytPanelOpen;
    document.getElementById('ytPanel').classList.toggle('open', ytPanelOpen);
    document.getElementById('ytTab').classList.toggle('open', ytPanelOpen);
    if (ytPanelOpen) {
        carregarCanalNoPlayer();
    }
}

function carregarCanalNoPlayer() {
    const playerDiv = document.getElementById('ytPlayer');
    const uploadsPlaylist = 'UU' + YT_CHANNEL_ID.substring(2);
    playerDiv.innerHTML = `
        <iframe 
            width="100%" height="100%" 
            src="https://www.youtube.com/embed?listType=playlist&list=${uploadsPlaylist}" 
            frameborder="0" 
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
            allowfullscreen>
        </iframe>`;
    document.getElementById('ytStatus').textContent = '🎬 Canal @bsoft carregado no player';
    document.getElementById('ytStatus').style.color = '#166534';
    document.getElementById('ytVideoList').innerHTML = `
        <div style="padding:12px;">
            <p style="font-size:12px;color:var(--text-muted);margin-bottom:12px;">
                📺 Navegue pelos vídeos no player acima ou use os links rápidos abaixo:
            </p>
            <div style="display:flex;flex-direction:column;gap:6px;" id="ytQuickLinks">
                <a href="javascript:void(0)" onclick="reproduzirVideo('', 'Pesquisar Bsoft TMS')" 
                   style="padding:10px;background:#fff0f0;border-radius:8px;text-decoration:none;color:var(--text);font-size:13px;border:1px solid #ffcccc;">
                   🔍 Buscar vídeos sobre Bsoft TMS
                </a>
                <a href="javascript:void(0)" onclick="window.open('${YT_CHANNEL_URL}/videos', '_blank')" 
                   style="padding:10px;background:#fff0f0;border-radius:8px;text-decoration:none;color:var(--text);font-size:13px;border:1px solid #ffcccc;">
                   🌐 Ver todos os vídeos do canal
                </a>
                <a href="javascript:void(0)" onclick="window.open('${YT_CHANNEL_URL}/playlists', '_blank')" 
                   style="padding:10px;background:#fff0f0;border-radius:8px;text-decoration:none;color:var(--text);font-size:13px;border:1px solid #ffcccc;">
                   📋 Ver playlists do canal
                </a>
            </div>
        </div>`;
}

function pesquisarNoYT() {
    const query = document.getElementById('ytSearchInput').value.trim();
    if (!query) {
        carregarCanalNoPlayer();
        return;
    }
    const playerDiv = document.getElementById('ytPlayer');
    playerDiv.innerHTML = `
        <iframe 
            width="100%" height="100%" 
            src="https://www.youtube.com/embed?listType=search&list=${encodeURIComponent(query + ' Bsoft TMS')}" 
            frameborder="0" 
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
            allowfullscreen>
        </iframe>`;
    document.getElementById('ytStatus').textContent = '🔍 Pesquisando: ' + query;
    document.getElementById('ytStatus').style.color = '#ff0000';
    document.getElementById('ytVideoList').innerHTML = `
        <div style="padding:12px;">
            <p style="font-size:12px;color:var(--text-muted);margin-bottom:8px;">
                🔍 Resultados para "<b>${escapeHtml(query)}</b>" no player acima
            </p>
            <a href="javascript:void(0)" onclick="window.open('https://www.youtube.com/results?search_query=${encodeURIComponent(query + ' Bsoft TMS')}', '_blank')" 
               style="display:block;padding:10px;background:#fff0f0;border-radius:8px;text-decoration:none;color:var(--text);font-size:13px;border:1px solid #ffcccc;text-align:center;">
               🌐 Ver mais resultados no YouTube
            </a>
        </div>`;
}

function reproduzirVideo(videoId, titulo) {
    if (videoId) {
        ytCurrentVideoId = videoId;
    }
    const playerDiv = document.getElementById('ytPlayer');
    if (videoId) {
        playerDiv.innerHTML = `
            <iframe 
                width="100%" height="100%" 
                src="https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1" 
                frameborder="0" 
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                allowfullscreen>
            </iframe>`;
    } else {
        playerDiv.innerHTML = `
            <iframe 
                width="100%" height="100%" 
                src="https://www.youtube.com/embed?listType=search&list=${encodeURIComponent(titulo || 'Bsoft TMS')}" 
                frameborder="0" 
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                allowfullscreen>
            </iframe>`;
    }
    document.getElementById('ytStatus').textContent = '▶️ ' + (titulo || 'Pesquisando...').substring(0, 50);
    document.getElementById('ytStatus').style.color = '#166534';
    window._ytVideoId = videoId;
    window._ytVideoTitle = titulo;
}

function abrirCanalYT() {
    window.open(YT_CHANNEL_URL + '/videos', '_blank');
}

function obterTranscricaoYT() {
    if (ytCurrentVideoId) {
        window.open(`https://www.youtube.com/watch?v=${ytCurrentVideoId}`, '_blank');
    } else {
        window.open(YT_CHANNEL_URL + '/videos', '_blank');
    }
    document.getElementById('ytStatus').textContent = '📝 Abra o vídeo, copie a transcrição e cole abaixo';
    document.getElementById('ytStatus').style.color = '#b45309';
    let area = document.getElementById('ytTranscriptArea');
    if (!area) {
        area = document.createElement('div');
        area.id = 'ytTranscriptArea';
        area.style.cssText = 'padding:12px;background:#fffbeb;border-top:2px solid #f59e0b;margin-top:8px;';
        area.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                <label style="font-size:11px;font-weight:600;">📝 Transcrição do vídeo:</label>
                <button onclick="document.getElementById('ytTranscriptArea').remove()" style="background:none;border:none;cursor:pointer;font-size:14px;">✕</button>
            </div>
            <textarea id="ytTranscriptInput" placeholder="Para obter a transcrição:&#10;1. Abra o vídeo no YouTube (botão abaixo)&#10;2. Clique em '...' abaixo do vídeo&#10;3. Selecione 'Mostrar transcrição'&#10;4. Copie o texto e cole aqui..." 
                      style="width:100%;min-height:100px;padding:8px;margin:6px 0;border:1px solid #f59e0b;border-radius:6px;font-family:inherit;font-size:12px;resize:vertical;"></textarea>
            <div style="display:flex;gap:8px;">
                <button onclick="window.open('https://www.youtube.com/watch?v=${ytCurrentVideoId || 'watch'}', '_blank')" 
                        style="padding:8px 16px;background:#ff0000;color:white;border:none;border-radius:6px;cursor:pointer;font-weight:600;font-family:inherit;font-size:12px;">
                    ▶️ Abrir no YouTube
                </button>
                <button onclick="enviarTranscricaoManual()" 
                        style="padding:8px 16px;background:var(--primary);color:white;border:none;border-radius:6px;cursor:pointer;font-weight:600;font-family:inherit;font-size:12px;">
                    🤖 Enviar para IA
                </button>
            </div>
        `;
        const videoList = document.getElementById('ytVideoList');
        videoList.insertBefore(area, videoList.firstChild);
    }
    area.scrollIntoView({ behavior: 'smooth' });
}

async function enviarTranscricaoManual() {
    const input = document.getElementById('ytTranscriptInput');
    const transcricao = input?.value?.trim();
    if (!transcricao || transcricao.length < 20) {
        alert('Cole a transcrição do vídeo primeiro!');
        return;
    }
    appendMessage('system', '🎬 <strong>Analisando transcrição do vídeo da Bsoft...</strong>');
    const conversa = getConversaAtiva();
    if (conversa) {
        conversa.contexto.push({
            role: 'user',
            content: `[TRANSCRIÇÃO YOUTUBE BSOFT - "${window._ytVideoTitle || 'Vídeo'}"]:\n${transcricao.substring(0, 3000)}`
        });
        salvarConversas();
    }
    document.getElementById('searchInput').value = `Analise esta transcrição do vídeo da Bsoft e me explique os pontos principais`;
    document.getElementById('ytStatus').textContent = '✅ Transcrição enviada para IA';
    document.getElementById('ytStatus').style.color = '#166534';
    const area = document.getElementById('ytTranscriptArea');
    if (area) area.remove();
    await handleChat();
}

function enviarTranscricaoParaIA() {
    obterTranscricaoYT();
}

function enviarPesquisaYTParaChat() {
    const query = document.getElementById('ytSearchInput').value.trim();
    if (query) {
        document.getElementById('searchInput').value = query + ' bsoft youtube';
        handleChat();
    }
}

// Atalho Ctrl+Shift+Y
document.addEventListener('keydown', function(e) {
    if (e.ctrlKey && e.shiftKey && e.key === 'Y') {
        e.preventDefault();
        toggleYTPanel();
    }
});
