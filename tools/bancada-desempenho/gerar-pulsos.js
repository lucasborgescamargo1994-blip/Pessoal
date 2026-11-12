'use strict';
// Gera os keyframes em "degraus" (20 quadros/s) dos pulsos de box-shadow, com a MESMA curva ease-out do original.
// ease-out = cubic-bezier(0, 0, .58, 1). Cada degrau segura o valor que a curva original tinha no início dele.
function bezier(x1, y1, x2, y2) {
    const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx, cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
    const X = t => ((ax * t + bx) * t + cx) * t, Y = t => ((ay * t + by) * t + cy) * t;
    return x => { if (x <= 0) return 0; if (x >= 1) return 1; let lo = 0, hi = 1, t = x; for (let i = 0; i < 60; i++) { const v = X(t); if (Math.abs(v - x) < 1e-9) break; if (v < x) lo = t; else hi = t; t = (lo + hi) / 2; } return Y(t); };
}
const easeOut = bezier(0, 0, 0.58, 1);
const f = (n, d) => String(+n.toFixed(d));
function gerar(nome, seg, spread, alfa0, cor) {
    const N = Math.round(seg * 20);
    let css = '@keyframes ' + nome + ' {\n';
    for (let i = 0; i < N; i++) {
        const u = easeOut(i / N), pct = f(i * 100 / N, 3);
        css += '    ' + pct + '% { box-shadow: 0 0 0 ' + f(spread * u, 3) + 'px ' + cor(f(alfa0 * (1 - u), 3)) + '; animation-timing-function: step-end; }\n';
    }
    css += '    100% { box-shadow: 0 0 0 ' + spread + 'px ' + cor('0') + '; }\n}\n';
    return css;
}
// scrollDownPulse: duas metades (0→50 % e 50→100 %), cada uma com ease-in-out própria (a curva vale por INTERVALO entre keyframes)
function gerarVaiVem(nome, seg, spread, alfa0) {
    const easeInOut = bezier(0.42, 0, 0.58, 1), M = Math.round(seg / 2 * 20); let css = '@keyframes ' + nome + ' {\n';
    for (let i = 0; i < M; i++) { const u = easeInOut(i / M); css += '    ' + f(i * 50 / M, 3) + '% { box-shadow: var(--shadow-lg), 0 0 0 ' + f(spread * u, 3) + 'px rgba(249,115,22,' + f(alfa0 * (1 - u), 3) + '); animation-timing-function: step-end; }\n'; }
    for (let i = 0; i < M; i++) { const u = easeInOut(i / M); css += '    ' + f(50 + i * 50 / M, 3) + '% { box-shadow: var(--shadow-lg), 0 0 0 ' + f(spread * (1 - u), 3) + 'px rgba(249,115,22,' + f(alfa0 * u, 3) + '); animation-timing-function: step-end; }\n'; }
    return css + '    100% { box-shadow: var(--shadow-lg), 0 0 0 0 rgba(249,115,22,' + alfa0 + '); }\n}\n';
}
const tom = a => 'rgb(var(--primary-rgb) / ' + a + ')';
const ambar = a => 'rgba(245,158,11,' + a + ')';
const que = process.argv[2];
if (que === 'mais') console.log(gerar('maisPulso', 1.9, 13, 0.5, tom));
if (que === 'dot') console.log(gerar('dotPulse', 1.6, 9, 0.55, ambar));
if (que === 'dot2') console.log(gerar('dotPulse2', 1.6, 8, 0.55, tom));
if (que === 'scroll') console.log(gerarVaiVem('scrollDownPulse', 1.4, 7, 0.45));
// conferência numérica: erro máximo do degrau contra a curva contínua (em px de spread)
if (que === 'erro') {
    for (const [nome, seg, spread] of [['maisPulso', 1.9, 13], ['dotPulse', 1.6, 9], ['dotPulse2', 1.6, 8]]) {
        const N = Math.round(seg * 20); let max = 0;
        for (let k = 0; k <= 4000; k++) { const t = k / 4000; const i = Math.min(N - 1, Math.floor(t * N)); const d = Math.abs(easeOut(t) - easeOut(i / N)) * spread; if (d > max) max = d; }
        console.log(nome + ': ' + N + ' degraus; erro máximo de ' + max.toFixed(2) + ' px de spread (e ' + (max / spread * 0.5).toFixed(3) + ' de alfa)');
    }
}
