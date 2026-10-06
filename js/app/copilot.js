/* js/app/copilot.js — Copilot (janela flutuante Picture-in-Picture). */
// ═══════════════════════════════════════════════════════════
//  COPILOT — Document Picture-in-Picture
// ═══════════════════════════════════════════════════════════
async function abrirCopilot() {
    if (!('documentPictureInPicture' in window)) {
        alert('O Copilot requer Chrome 116+ com suporte a Document Picture-in-Picture.');
        return;
    }
    const PIP_W = 620, PIP_H = 700;
    let pipWin;
    try {
        pipWin = await window.documentPictureInPicture.requestWindow({ width: PIP_W, height: PIP_H });
    } catch(e) {
        alert('Não foi possível abrir o Copilot: ' + e.message);
        return;
    }

    pipWin.document.head.innerHTML = `<meta charset="UTF-8"><title>Bsoft Copilot</title>
<style>*{margin:0;padding:0;box-sizing:border-box}html,body{height:100%;overflow:hidden}iframe{width:100%;height:100%;border:none}</style>`;

    // Injeta funções de mover/redimensionar NO contexto do pipWin
    // (necessário: quando executadas ali, window === pipWin e moveTo/resizeTo têm permissão)
    const pipScript = pipWin.document.createElement('script');
    pipScript.textContent = `
function pipMinimize() {
    window.resizeTo(80, 80);
    setTimeout(function() {
        window.moveTo(screen.availWidth - 100, screen.availHeight - 100);
    }, 60);
}
function pipRestore(w, h, x, y) {
    window.resizeTo(w, h);
    setTimeout(function() { window.moveTo(x, y); }, 60);
}
`;
    pipWin.document.head.appendChild(pipScript);

    const frame = pipWin.document.createElement('iframe');
    frame.src = window.location.href;
    frame.style.cssText = 'width:100%;height:100%;border:none;visibility:hidden;';
    pipWin.document.body.appendChild(frame);

    frame.addEventListener('load', () => {
        try {
            const doc = frame.contentDocument;

            // Colapsa sidebar sem animação
            const sidebar = doc.getElementById('sidebar');
            if (sidebar) {
                sidebar.style.transition = 'none';
                sidebar.classList.add('collapsed');
                requestAnimationFrame(() => { sidebar.style.transition = ''; });
            }

            // Bolinha de restore (cobre a tela inteira do PiP minimizado)
            const ball = doc.createElement('div');
            ball.style.cssText = 'display:none;position:fixed;inset:0;background:white;z-index:999999;align-items:center;justify-content:center;cursor:pointer;';
            ball.innerHTML = '<div style="display:flex;flex-direction:column;align-items:center;gap:8px;max-width:80px;"><div style="width:42px;height:42px;background:linear-gradient(135deg,#f97316,#ea580c);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:21px;box-shadow:0 3px 14px rgba(249,115,22,0.6);">🤖</div><span style="font-size:11px;font-weight:600;color:#374151;text-align:center;line-height:1.3;">Clique no robô para maximizar</span></div>';
            doc.body.appendChild(ball);

            // Botão minimizar no header, no lugar do botão Menu
            const headerLeft = doc.querySelector('.header-left');
            const logoMark = doc.querySelector('.logo-mark');
            const minBtn = doc.createElement('button');
            minBtn.title = 'Minimizar Copilot';
            minBtn.textContent = '−';
            minBtn.style.cssText = 'flex-shrink:0;width:32px;height:32px;border-radius:8px;border:1px solid var(--border);background:var(--surface);cursor:pointer;font-size:20px;font-weight:700;color:var(--text-muted);display:flex;align-items:center;justify-content:center;line-height:1;padding:0;transition:all 0.2s;';
            minBtn.onmouseover = () => { minBtn.style.background='var(--primary-light)'; minBtn.style.borderColor='var(--primary-border)'; minBtn.style.color='var(--primary)'; };
            minBtn.onmouseout  = () => { minBtn.style.background='var(--surface)';       minBtn.style.borderColor='var(--border)';         minBtn.style.color='var(--text-muted)'; };
            if (headerLeft && logoMark) {
                headerLeft.insertBefore(minBtn, logoMark);
            } else if (headerLeft) {
                headerLeft.prepend(minBtn);
            } else {
                doc.body.appendChild(minBtn);
            }

            let savedX, savedY;

            minBtn.onclick = () => {
                savedX = pipWin.screenX;
                savedY = pipWin.screenY;
                ball.style.display = 'flex';
                minBtn.style.display = 'none';
                try { pipWin.pipMinimize(); } catch(e) {}
            };
            ball.onclick = () => {
                ball.style.display = 'none';
                minBtn.style.display = '';
                try { pipWin.pipRestore(PIP_W, PIP_H, savedX ?? 100, savedY ?? 100); } catch(e) {}
            };
        } catch(e) {
            console.warn('[Copilot] Erro ao inicializar:', e.message);
        }
        frame.style.visibility = 'visible';
    });
}
