/* js/app/ciot.js — Painel do Geolocalizador CIOT. */
// ═══════════════════════════════════════════════════════════
//  PAINEL CIOT
// ═══════════════════════════════════════════════════════════
let ciotPanelOpen = false;
const CIOT_URL = "https://lucasborgescamargo1994-blip.github.io/Pessoal/geolocaliza";

function toggleCiotPanel() {
    ciotPanelOpen = !ciotPanelOpen;
    const panel = document.getElementById('ciotPanel');
    const tab = document.getElementById('ciotTab');
    const overlay = document.getElementById('centralOverlay');
    
    panel.classList.toggle('open', ciotPanelOpen);
    tab.classList.toggle('open', ciotPanelOpen);
    
    if (ciotPanelOpen) {
        if (overlay) overlay.classList.add('active');
        // Carrega o iframe pela primeira vez ou recarrega
        const iframe = document.getElementById('ciotIframe');
        if (iframe && iframe.src === 'about:blank') {
            iframe.src = CIOT_URL;
            document.getElementById('ciotStatus').textContent = '🗺️ Carregando Geolocalizador CIOT...';
        } else if (iframe && iframe.src !== CIOT_URL) {
            iframe.src = CIOT_URL;
        } else {
            document.getElementById('ciotStatus').textContent = '🗺️ Validador de Rotas e CIOT - By Lucas Camargo';
        }
    } else {
        if (overlay) overlay.classList.remove('active');
    }
}

function abrirCiotNovaAba() {
    window.open(CIOT_URL, '_blank');
    document.getElementById('ciotStatus').textContent = '🗺️ Aberto em nova aba';
    setTimeout(() => {
        document.getElementById('ciotStatus').textContent = '🗺️ Validador de Rotas e CIOT - By Lucas Camargo';
    }, 3000);
}

function recarregarCiot() {
    const iframe = document.getElementById('ciotIframe');
    const currentSrc = iframe.src;
    iframe.src = 'about:blank';
    document.getElementById('ciotStatus').textContent = '🔄 Recarregando...';
    setTimeout(() => {
        iframe.src = CIOT_URL;
        document.getElementById('ciotStatus').textContent = '🗺️ Validador de Rotas e CIOT - By Lucas Camargo';
    }, 500);
}

function enviarContextoCiotParaIA() {
    appendMessage('system', '🗺️ <strong>Geolocalizador CIOT aberto</strong><br>Utilize a ferramenta ao lado para validar rotas e distâncias de CT-e.');
    const conversa = getConversaAtiva();
    if (conversa) {
        conversa.contexto.push({
            role: 'user',
            content: 'O usuário abriu o Geolocalizador CIOT para validar rotas e calcular distâncias rodoviárias.'
        });
        salvarConversas();
    }
    toggleCiotPanel();
}
