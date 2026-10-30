/* js/core/markdown.js — Conversão de texto da IA em HTML (links, negrito, listas, tabelas). */
function filtrarPensamentoAlto(texto) {
    if (!texto) return { texto: '', eraPensamento: false };
    // Remove blocos completos <thinking>...</thinking>
    const rBloco = new RegExp('<thinking>[\\s\\S]*?</thinking>', 'gi');
    let limpo = texto.replace(rBloco, '').trim();
    // Remove bloco aberto sem fechamento (resposta truncada mid-thinking)
    const idxAberto = limpo.toLowerCase().indexOf('<thinking>');
    if (idxAberto !== -1) limpo = limpo.substring(0, idxAberto).trim();
    const teveBlocos = limpo.length < texto.trim().length;
    if (teveBlocos && limpo.length >= 30) return { texto: limpo, eraPensamento: false };
    if (teveBlocos && limpo.length < 30) return { texto: '', eraPensamento: true };
    return { texto: texto.trim(), eraPensamento: false };
}
// ── Link de ROTINA do Bsoft (removido na v28.26) ─────────────────────────────────────────────────────────────────────────────────────────
// A IA não indica mais a tela com o link-modelo https://NOMEDOCLIENTE.bsoft.app/versoes/…/rotinas/c.php?id=… (ninguém usava o campo "Acessar tela"). Respostas ANTIGAS, guardadas no histórico,
// ainda podem ter esse link: aqui ele só é tirado do texto ([texto](link) vira o texto; o link solto some), para não sobrar um endereço que não abre.
const _ROTINA_RE = new RegExp('(?:https?:\\/\\/(?:nome[-_]?do[-_]?cliente|seu[-_]?cliente|cliente|xxx+)\\.bsoft\\.app|(?<![A-Za-z0-9._\\-\\/]))\\/versoes\\/([A-Za-z0-9._\\-]+)\\/rotinas\\/c\\.php\\?id=([A-Za-z0-9_.\\-]+)(?:&(?:amp;)?menu=s)?', 'gi');
// Converte links em markdown [texto](url) e URLs soltas (http/https) em <a> clicável, abrindo em nova guia.
function _linkify(txt) {
    const _links = [];
    // Link de rotina do Bsoft (só existe em respostas antigas) é tirado antes de tudo: [texto](link) fica só o texto e o link solto some (ver acima)
    let h = txt.replace(new RegExp('\\[([^\\[\\]]+)\\]\\(' + _ROTINA_RE.source + '\\)', 'gi'), '$1')
               .replace(_ROTINA_RE, '');
    // (aspas e < > ficam de fora da URL: senão dava para "fechar" o href e injetar atributos como onmouseover)
    h = h.replace(/\[([^\[\]]+)\]\((https?:\/\/[^\s()`*"'<>]+)\)/g, (_, label, url) => {
        _links.push(`<a href="${url}" target="_blank" rel="noopener noreferrer">${label}</a>`);
        return ` L${_links.length - 1} `;
    });
    // Exclui também crase e asterisco: para que uma URL colada em `código` ou **negrito**
    // não engula o delimitador de fechamento e bagunce o pareamento dos marcadores seguintes.
    h = h.replace(/https?:\/\/(?:[^\s<>"')\]&`*]|&(?!lt;|gt;|quot;))+/g, url => {
        const trail = (url.match(/[.,;:!?)]+$/) || [''])[0];
        const clean = trail ? url.slice(0, -trail.length) : url;
        _links.push(`<a href="${clean}" target="_blank" rel="noopener noreferrer">${clean}</a>`);
        return ` L${_links.length - 1} ${trail}`;
    });
    return h.replace(/ L(\d+) /g, (_, i) => _links[i]);
}
// Fórmula em LaTeX (\[ ... \], \( ... \), \frac{}{}, \text{}) que a IA às vezes escreve apesar da regra: o chat não tem como "desenhar"
// LaTeX, então vira texto comum e legível (ex.: "Base = Valor Líquido ÷ ((100 − Alíquota) ÷ 100)"). Texto sem LaTeX passa direto, sem custo.
function _latexParaTexto(txt) {
    if (!/\\(?:\[|\]|\(|\)|frac|text|approx|times|cdot|div|left|right|%)/.test(txt)) return txt;
    let t = txt;
    t = t.replace(/\\\[([\s\S]*?)\\\]/g, (_, f) => '\n' + f.trim() + '\n');   // fórmula em linha própria
    t = t.replace(/\\\(([\s\S]*?)\\\)/g, (_, f) => f.trim());                  // fórmula dentro da frase
    t = t.replace(/\\(?:text|mathrm|mathbf|textbf|operatorname)\s*\{([^{}]*)\}/g, '$1');
    const _env = s => (/[+\-−×÷*/=]/.test(s) ? '(' + s + ')' : s);
    for (let i = 0; i < 8 && /\\d?frac\s*\{/.test(t); i++) {                   // de dentro para fora (frações aninhadas)
        t = t.replace(/\\d?frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, (_, a, b) => _env(a.trim()) + ' ÷ ' + _env(b.trim()));
    }
    t = t.replace(/\\(?:left|right)\s*/g, '').replace(/\\approx/g, '≈').replace(/\\times|\\cdot/g, '×').replace(/\\div/g, '÷').replace(/\\leq?\b/g, '≤').replace(/\\geq?\b/g, '≥').replace(/\\neq/g, '≠')
         .replace(/\\%/g, '%').replace(/\\[,;:! ]/g, ' ').replace(/\\\$/g, '$');
    // cálculo inverso: a fórmula do Bsoft é sempre "(100 − Alíquota) ÷ 100" (primeiro 100 menos a alíquota, depois ÷ 100), nunca "1 − Alíquota ÷ 100"
    t = t.replace(/\(\s*1\s*[−-]\s*([A-Za-zÀ-ú_]+)\s*÷\s*100\s*\)/g, '((100 − $1) ÷ 100)');
    t = t.replace(/\(\s*1\s*[−-]\s*0,(\d{1,3})\s*\)/g, (_, d) => '((100 − ' + String(Math.round(parseFloat('0.' + d) * 1000) / 10).replace('.', ',') + ') ÷ 100)');   // (1 − 0,18) → ((100 − 18) ÷ 100)
    return t.replace(/(\d) - (\d)/g, '$1 − $2');
}
function renderMd(txt) {
    if (!txt) return '';
    txt = _latexParaTexto(txt);
    // Escape HTML
    let h = txt.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    // Links (markdown e URLs soltas) — antes dos demais estilos para não quebrar a sintaxe
    h = _linkify(h);
    // Code blocks
    h = h.replace(/```(?:\w+\n)?([\s\S]*?)```/g, (_, code) =>
        `<pre style="background:#f4f4f4;border:1px solid #e5e7eb;border-radius:6px;padding:10px 12px;overflow-x:auto;font-size:12px;font-family:monospace;margin:8px 0;white-space:pre;">${code.trim()}</pre>`);
    // Inline code
    h = h.replace(/`([^`]+)`/g, '<code style="background:#f4f4f4;padding:1px 5px;border-radius:3px;font-family:monospace;font-size:12px;color:#c0392b;">$1</code>');
    // Bold / italic
    h = h.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
    h = h.replace(/\*(.*?)\*/g, '<em>$1</em>');
    // Headings
    h = h.replace(/^####\s+(.+)$/gm, '<h4 style="font-size:13px;font-weight:700;color:#1f2937;margin:10px 0 3px;">$1</h4>');
    h = h.replace(/^###\s+(.+)$/gm,  '<h3 style="font-size:14px;font-weight:700;color:#111827;margin:12px 0 4px;border-bottom:1px solid #f3f4f6;padding-bottom:3px;">$1</h3>');
    h = h.replace(/^##\s+(.+)$/gm,   '<h2 style="font-size:15px;font-weight:700;color:#111827;margin:14px 0 5px;">$1</h2>');
    h = h.replace(/^#\s+(.+)$/gm,    '<h2 style="font-size:16px;font-weight:700;color:#111827;margin:16px 0 6px;">$1</h2>');
    // Horizontal rule
    h = h.replace(/^---+$/gm, '<hr style="border:none;border-top:1px solid #e5e7eb;margin:10px 0;">');
    // Tables (| col | col |)
    h = h.replace(/((?:^\|.+\|\n?)+)/gm, (block) => {
        const lines = block.trim().split('\n').filter(l => l.trim());
        const isSep = l => /^\|[\s\-:|]+\|/.test(l.trim());
        let tbl = '<div style="overflow-x:auto;margin:8px 0;"><table style="width:100%;border-collapse:collapse;font-size:12.5px;">';
        let hdrDone = false;
        lines.forEach(line => {
            if (isSep(line)) { hdrDone = true; return; }
            const cells = line.split('|').slice(1, -1);
            const tag = !hdrDone ? 'th' : 'td';
            const s = tag === 'th'
                ? 'background:#f9fafb;font-weight:700;padding:7px 10px;border:1px solid #e5e7eb;text-align:left;'
                : 'padding:6px 10px;border:1px solid #e5e7eb;vertical-align:top;';
            tbl += '<tr>' + cells.map(c => `<${tag} style="${s}">${c.trim()}</${tag}>`).join('') + '</tr>';
        });
        return tbl + '</table></div>';
    });
    // Blockquotes (&gt; because > was already escaped)
    h = h.replace(/^&gt;\s*(.+)$/gm, '<blockquote style="border-left:3px solid var(--primary);padding:4px 12px;margin:4px 0;color:#4b5563;background:#fef9f5;border-radius:0 6px 6px 0;">$1</blockquote>');
    // Lists
    h = h.replace(/^[ \t]*[-*] (.+)$/gm, '<li style="margin:2px 0;">$1</li>');
    h = h.replace(/^[ \t]*\d+\. (.+)$/gm, '<li style="margin:2px 0;">$1</li>');
    h = h.replace(/((?:<li[^>]*>.+<\/li>\n?)+)/g, '<ul style="margin:6px 0 6px 18px;padding:0;">$1</ul>');
    // Line breaks
    h = h.replace(/\n/g, '<br>');
    return h;
}
