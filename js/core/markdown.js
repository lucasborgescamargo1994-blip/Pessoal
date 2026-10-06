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
// Converte links em markdown [texto](url) e URLs soltas (http/https) em <a> clicável, abrindo em nova guia.
function _linkify(txt) {
    const _links = [];
    // (aspas e < > ficam de fora da URL: senão dava para "fechar" o href e injetar atributos como onmouseover)
    let h = txt.replace(/\[([^\[\]]+)\]\((https?:\/\/[^\s()`*"'<>]+)\)/g, (_, label, url) => {
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
function renderMd(txt) {
    if (!txt) return '';
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
