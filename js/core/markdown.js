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
// ── Link de ROTINA do Bsoft (tela do sistema) ────────────────────────────────────────────────────────────────────────────────────────────────
// A IA indica a tela com o link-modelo  https://NOMEDOCLIENTE.bsoft.app/versoes/versao5.0/rotinas/c.php?id=<nome interno>&menu=s  (cada cliente tem o seu endereço). Em vez de mostrar esse link que não abre,
// o texto da resposta ganha um CAMPO para a pessoa colar o endereço do sistema dela e o botão "Acessar tela", que monta o link certo e abre numa nova guia. Vale para o link completo com o endereço-modelo
// (NOMEDOCLIENTE, SEUCLIENTE, CLIENTE, XXXX), para o caminho sem endereço (/versoes/…/rotinas/c.php?id=…) e para o link dentro de [texto](link). Link com endereço REAL de cliente continua sendo um link comum.
// O endereço colado fica guardado neste navegador (bsoft_dominio_cliente) e já aparece preenchido nas próximas telas. O id só aceita letras, números, _ . - (nada vai para o HTML sem passar por aí).
const _ROTINA_RE = new RegExp('(?:https?:\\/\\/(?:nome[-_]?do[-_]?cliente|seu[-_]?cliente|cliente|xxx+)\\.bsoft\\.app|(?<![A-Za-z0-9._\\-\\/]))\\/versoes\\/([A-Za-z0-9._\\-]+)\\/rotinas\\/c\\.php\\?id=([A-Za-z0-9_.\\-]+)(?:&(?:amp;)?menu=s)?', 'gi');
const _ROTINA_CHAVE_DOMINIO = 'bsoft_dominio_cliente';
function _rotinaEsc(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
// O que a pessoa colou -> endereço do sistema (só a origem: https://empresa.bsoft.app), ou null se não parece um endereço (ou ainda é o exemplo NOMEDOCLIENTE).
function rotinaNormalizarDominio(txt) {
    let t = String(txt || '').trim();
    if (!t) return null;
    if (!/^[a-z][a-z0-9+.\-]*:\/\//i.test(t)) t = 'https://' + t;
    let u;
    try { u = new URL(t); } catch (e) { return null; }
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
    if (!/^[a-z0-9.\-]+$/i.test(u.hostname) || u.hostname.indexOf('.') < 1 || /nome[-_]?do[-_]?cliente|seu[-_]?cliente/i.test(u.hostname)) return null;
    return u.origin;
}
function _rotinaWidgetHtml(versao, id) {
    let salvo = '';
    try { salvo = rotinaNormalizarDominio(localStorage.getItem(_ROTINA_CHAVE_DOMINIO)) || ''; } catch (e) { /* sem armazenamento: o campo só nasce vazio */ }
    const caminho = '/versoes/' + versao + '/rotinas/c.php?id=' + id + '&menu=s';
    // (uma linha só e sem * | ` — o resto do renderMd roda depois e não pode mexer neste HTML)
    return '<span class="rotina-link" data-ver="' + _rotinaEsc(versao) + '" data-id="' + _rotinaEsc(id) + '" style="display:inline-flex;flex-wrap:wrap;align-items:center;gap:6px;margin:4px 0;padding:6px 8px;border:1.5px solid #bfdbfe;border-radius:10px;background:#eff6ff;vertical-align:middle;max-width:100%;">'
        + '<input type="text" class="rotina-dominio" value="' + _rotinaEsc(salvo) + '" placeholder="Cole aqui o endereço do seu sistema (https://NOMEDOCLIENTE.bsoft.app)" aria-label="Endereço do seu sistema Bsoft" onkeydown="if(event.key===\'Enter\'){event.preventDefault();rotinaAbrir(this);}" style="width:470px;flex:1 1 470px;max-width:100%;padding:6px 9px;border:1.5px solid #93c5fd;border-radius:8px;font-size:12.5px;background:#fff;color:inherit;">'
        + '<button type="button" onclick="rotinaAbrir(this)" style="padding:6px 13px;border:none;border-radius:8px;background:#2563eb;color:#fff;font-size:12.5px;font-weight:700;cursor:pointer;">🔗 Acessar tela</button>'
        + '<span style="flex-basis:100%;font-size:11px;color:#6b7280;word-break:break-all;">' + _rotinaEsc(caminho) + '</span>'
        + '<span class="rotina-erro" style="flex-basis:100%;font-size:12px;color:#b91c1c;"></span></span>';
}
// Clique em "Acessar tela" (ou Enter no campo): monta endereço + caminho da rotina e abre numa nova guia.
function rotinaAbrir(el) {
    const w = el && el.closest ? el.closest('.rotina-link') : null;
    if (!w) return;
    const campo = w.querySelector('.rotina-dominio'), erro = w.querySelector('.rotina-erro');
    const origem = rotinaNormalizarDominio(campo ? campo.value : '');
    if (!origem) {
        if (erro) erro.textContent = 'Cole o endereço do SEU sistema, por exemplo https://suaempresa.bsoft.app (o nome da sua empresa no lugar de NOMEDOCLIENTE).';
        if (campo && campo.focus) campo.focus();
        return;
    }
    if (erro) erro.textContent = '';
    if (campo) campo.value = origem;
    try { localStorage.setItem(_ROTINA_CHAVE_DOMINIO, origem); } catch (e) { /* só deixa de lembrar */ }
    try { document.querySelectorAll('.rotina-dominio').forEach(i => { if (!i.value.trim()) i.value = origem; }); } catch (e) { /* conforto */ }
    window.open(origem + '/versoes/' + w.dataset.ver + '/rotinas/c.php?id=' + encodeURIComponent(w.dataset.id) + '&menu=s', '_blank', 'noopener,noreferrer');
}
// Converte links em markdown [texto](url) e URLs soltas (http/https) em <a> clicável, abrindo em nova guia.
function _linkify(txt) {
    const _links = [];
    // Links de rotina do Bsoft viram campo + botão (ver acima); entram antes de tudo para o resto não tratá-los como link comum
    const _viraCampo = (_, ver, id) => { _links.push(_rotinaWidgetHtml(ver, id)); return ` L${_links.length - 1} `; };
    let h = txt.replace(new RegExp('\\[[^\\[\\]]+\\]\\(' + _ROTINA_RE.source + '\\)', 'gi'), _viraCampo)   // [texto](link da rotina): o texto do link some, entra o campo
               .replace(_ROTINA_RE, _viraCampo);
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
