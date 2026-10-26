/* js/faq/tela.js — FAQ: a tela (faq.html).
   Lê as perguntas PUBLICADAS da tabela faq_itens do Supabase (só leitura — este cliente não consegue gravar) e mostra com busca, categorias e vídeos.
   As perguntas são cadastradas na aba "FAQ" da Área Administrativa. Sem o SQL 07 a página avisa que o FAQ ainda não foi configurado.
   Todo texto vindo do banco entra na tela como TEXTO; a resposta passa por renderMd (que escapa o HTML antes de formatar); os vídeos só viram player quando o
   endereço é de um site conhecido (js/faq/logica.js › videoInfo) — o resto vira botão "Abrir vídeo". */
(function () {
    'use strict';
    const L = FaqLogica;
    const $ = id => document.getElementById(id);
    const PAGINA = 30;           // perguntas mostradas de uma vez
    const COLUNAS = 'id, pergunta, resposta, categoria, caminho_menu, palavras_chave, videos, ordem, atualizado_em';

    // ── aparência: usa a cor e o fundo que a pessoa escolheu em Personalizar no sistema principal ──
    try {
        const p = JSON.parse(localStorage.getItem('bsoft_v27_prefs') || '{}') || {};
        const h = document.documentElement;
        h.dataset.bg = p.bg || 'aurora'; h.dataset.efeitos = p.efeitos || 'completo';
        if (p.accent && p.accentRgb) { h.style.setProperty('--primary', p.accent); h.style.setProperty('--primary-rgb', String(p.accentRgb).replace(/,/g, ' ').replace(/\s+/g, ' ').trim()); }
    } catch (e) { /* sem preferências: padrão */ }

    const E = { itens: [], filtrados: [], categoria: '', texto: '', comVideo: false, mostrando: PAGINA, abertos: new Set(), carregado: false };

    const el = (tag, cls, texto) => { const n = document.createElement(tag); if (cls) n.className = cls; if (texto != null) n.textContent = texto; return n; };
    function toast(msg, ms) { const t = $('toast'); t.textContent = msg; t.hidden = false; clearTimeout(toast._t); toast._t = setTimeout(() => { t.hidden = true; }, ms || 3500); }
    function copiar(texto, ok) {
        (navigator.clipboard && navigator.clipboard.writeText ? navigator.clipboard.writeText(texto) : Promise.reject()).then(() => toast(ok), () => {
            const ta = document.createElement('textarea'); ta.value = texto; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); toast(ok); } catch (e) { toast('Não consegui copiar.'); } ta.remove();
        });
    }
    const linkDe = id => location.origin + location.pathname + '?id=' + id;

    // ── dados ──
    const ausente = e => !!e && (e.code === 'PGRST205' || e.code === '42P01' || /could not find the table|relation .* does not exist/i.test(String(e.message || '')));
    async function listar() {
        const sb = criarClienteSupabase(BSOFT_CONFIG.supabaseUrl, BSOFT_CONFIG.supabaseAnonKey, { somenteLeitura: true });
        const todos = [];
        for (let de = 0; ; de += 1000) {
            const { data, error } = await sb.from('faq_itens').select(COLUNAS).eq('publicado', true).order('ordem', { ascending: true }).order('id', { ascending: true }).range(de, de + 999);
            if (error) throw error;
            (data || []).forEach(r => todos.push(r));
            if (!data || data.length < 1000) break;
        }
        return todos;
    }

    // ── vídeo ──
    // O player só é montado quando a pergunta abre (e, das 2ª em diante, quando a pessoa clica) — abrir uma pergunta não carrega vários vídeos de uma vez.
    function montarPlayer(info, titulo) {
        const caixa = el('div', 'faq-player');
        if (info.tipo === 'arquivo') {
            const v = document.createElement('video'); v.controls = true; v.preload = 'metadata'; v.setAttribute('playsinline', ''); v.src = info.embed; v.setAttribute('aria-label', titulo);
            caixa.appendChild(v);
        } else {
            const f = document.createElement('iframe'); f.src = info.embed; f.title = titulo; f.loading = 'lazy'; f.referrerPolicy = 'strict-origin-when-cross-origin';
            f.setAttribute('allow', 'fullscreen; picture-in-picture; encrypted-media; clipboard-write'); f.setAttribute('allowfullscreen', '');
            f.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-presentation allow-popups allow-popups-to-escape-sandbox');
            caixa.appendChild(f);
        }
        return caixa;
    }
    function blocoVideo(v, i) {
        const titulo = v.titulo || ('Vídeo ' + (i + 1));
        const b = el('section', 'faq-video'); b.setAttribute('aria-label', titulo);
        const h = el('h3'); h.appendChild(document.createTextNode('🎬 ' + titulo)); h.appendChild(el('small', null, v.info.rotulo)); b.appendChild(h);
        if (!v.info.embed) {                                  // link de outro site: botão que abre em outra guia
            const a = el('a', 'faq-video-externo', '▶ Abrir vídeo'); a.href = v.info.abrir; a.target = '_blank'; a.rel = 'noopener noreferrer'; b.appendChild(a);
            return b;
        }
        if (i === 0) b.appendChild(montarPlayer(v.info, titulo));
        else { const bt = el('button', 'faq-btn', '▶ Carregar e assistir'); bt.type = 'button'; bt.addEventListener('click', () => { bt.replaceWith(montarPlayer(v.info, titulo)); }); b.appendChild(bt); }
        const l = el('div', 'faq-video-link'); const a = el('a', null, 'Abrir em outra guia ↗'); a.href = v.info.abrir; a.target = '_blank'; a.rel = 'noopener noreferrer'; l.appendChild(a); b.appendChild(l);
        return b;
    }

    // ── item ──
    function montarResposta(it, caixa) {
        const texto = el('div', 'faq-texto');
        if (String(it.resposta || '').trim()) { try { texto.innerHTML = L.arrumarListas(renderMd(it.resposta)); } catch (e) { texto.textContent = it.resposta; } }
        else texto.appendChild(el('p', null, 'Veja o vídeo abaixo.'));
        caixa.appendChild(texto);
        if (String(it.caminho_menu || '').trim()) { const o = el('div', 'faq-onde'); o.appendChild(el('b', null, 'Onde fica: ')); o.appendChild(document.createTextNode(String(it.caminho_menu).trim())); caixa.appendChild(o); }
        const videos = L.lerVideos(it.videos);
        if (videos.length) { const c = el('div', 'faq-videos'); videos.forEach((v, i) => c.appendChild(blocoVideo(v, i))); caixa.appendChild(c); }
        const ac = el('div', 'faq-acoes');
        const bl = el('button', 'faq-btn', '🔗 Copiar link desta pergunta'); bl.type = 'button'; bl.addEventListener('click', () => copiar(linkDe(it.id), 'Link copiado.')); ac.appendChild(bl);
        caixa.appendChild(ac);
    }
    function cartao(it) {
        const aberto = E.abertos.has(it.id), videos = L.lerVideos(it.videos);
        const art = el('article', 'faq-item' + (aberto ? ' aberto' : '')); art.id = 'p-' + it.id; art.dataset.id = it.id;
        const h = el('h2', 'faq-pergunta'); const bt = el('button'); bt.type = 'button'; bt.setAttribute('aria-expanded', String(aberto)); bt.setAttribute('aria-controls', 'r-' + it.id);
        bt.appendChild(el('span', 't', it.pergunta));
        const meta = el('span', 'meta');
        if (String(it.categoria || '').trim()) meta.appendChild(el('span', 'faq-tag', String(it.categoria).trim()));
        if (videos.length) meta.appendChild(el('span', 'faq-tag video', '🎬 ' + (videos.length > 1 ? videos.length + ' vídeos' : 'vídeo')));
        bt.appendChild(meta); const seta = el('span', 'seta', '⌄'); seta.setAttribute('aria-hidden', 'true'); bt.appendChild(seta);
        bt.addEventListener('click', () => alternar(it.id));
        h.appendChild(bt); art.appendChild(h);
        if (String(it.categoria || '').trim() || videos.length) {      // no celular a categoria e o 🎬 ficam numa linha própria
            const m = el('div', 'faq-tags-mobile');
            if (String(it.categoria || '').trim()) m.appendChild(el('span', 'faq-tag', String(it.categoria).trim()));
            if (videos.length) m.appendChild(el('span', 'faq-tag video', '🎬 ' + (videos.length > 1 ? videos.length + ' vídeos' : 'vídeo')));
            art.appendChild(m);
        }
        const previa = L.resumo(it.resposta, 170); if (previa) art.appendChild(el('p', 'faq-previa', previa));
        const r = el('div', 'faq-resp'); r.id = 'r-' + it.id; r.hidden = !aberto;
        if (aberto) montarResposta(it, r);
        art.appendChild(r);
        return art;
    }
    function alternar(id, forcar) {
        const art = $('p-' + id), it = E.itens.find(x => x.id === id); if (!art || !it) return;
        const abrir = forcar != null ? forcar : !E.abertos.has(id);
        const r = $('r-' + id), bt = art.querySelector('.faq-pergunta button');
        if (abrir) { E.abertos.add(id); if (!r.firstChild) montarResposta(it, r); r.hidden = false; }
        else { E.abertos.delete(id); r.hidden = true; }
        art.classList.toggle('aberto', abrir); bt.setAttribute('aria-expanded', String(abrir));
        try { history.replaceState(null, '', abrir ? location.pathname + '?id=' + id : location.pathname); } catch (e) { /* o endereço só deixa de acompanhar a pergunta aberta */ }      // (o endereço da barra já é o link para compartilhar)
    }

    // ── lista ──
    function atualizarCategorias() {
        const sel = $('fCategoria'), atual = E.categoria; sel.textContent = '';
        const todas = document.createElement('option'); todas.value = ''; todas.textContent = 'Todas as categorias'; sel.appendChild(todas);
        L.categorias(E.itens).forEach(c => { const o = document.createElement('option'); o.value = c.nome; o.textContent = c.nome + ' (' + c.total + ')'; sel.appendChild(o); });
        sel.value = L.categorias(E.itens).some(c => c.nome === atual) ? atual : ''; E.categoria = sel.value;
    }
    function render() {
        E.filtrados = L.buscar(E.itens, { texto: E.texto, categoria: E.categoria, comVideo: E.comVideo });
        const lista = $('faqLista'); lista.textContent = '';
        E.filtrados.slice(0, E.mostrando).forEach(it => lista.appendChild(cartao(it)));
        $('faqMais').hidden = E.filtrados.length <= E.mostrando;
        const total = E.itens.length, comVideo = E.itens.filter(i => L.lerVideos(i.videos).length).length;
        const filtrando = !!(E.texto.trim() || E.categoria || E.comVideo);
        const st = $('faqStatus'); st.classList.remove('erro');
        st.textContent = !total ? '' : filtrando ? `${E.filtrados.length} de ${total} pergunta(s)` : `${total} pergunta(s) · ${comVideo} com vídeo`;
        const v = $('faqVazio');
        if (total && !E.filtrados.length) { v.hidden = false; v.textContent = ''; v.appendChild(el('b', null, 'Nenhuma pergunta encontrada')); v.appendChild(document.createTextNode('Tente outras palavras, escolha "Todas as categorias" ou ')); const a = el('a', null, 'pergunte ao Suporte IA'); a.href = 'index.html'; v.appendChild(a); v.appendChild(document.createTextNode('.')); }
        else if (!total && E.carregado) { v.hidden = false; v.textContent = ''; v.appendChild(el('b', null, 'Ainda não há perguntas publicadas')); v.appendChild(document.createTextNode('Volte em breve — as perguntas e os vídeos aparecem aqui.')); }
        else v.hidden = true;
    }
    function mostrarErro(msg, detalhe) {
        const st = $('faqStatus'); st.classList.add('erro'); st.textContent = msg;
        const v = $('faqVazio'); v.hidden = false; v.textContent = '';
        v.appendChild(el('b', null, detalhe[0])); v.appendChild(document.createTextNode(detalhe[1]));
        if (detalhe[2]) { const bt = el('button', 'faq-btn', 'Tentar de novo'); bt.type = 'button'; bt.style.marginTop = '10px'; bt.style.display = 'block'; bt.style.marginInline = 'auto'; bt.addEventListener('click', carregar); v.appendChild(bt); }
        $('faqLista').textContent = ''; $('faqMais').hidden = true;
    }
    async function carregar() {
        $('faqStatus').classList.remove('erro'); $('faqStatus').textContent = 'Carregando as perguntas…'; $('faqVazio').hidden = true;
        try {
            if (!window.supabase) throw new Error('a biblioteca do Supabase não carregou (sem internet?)');
            E.itens = await listar(); E.carregado = true;
            atualizarCategorias(); render(); abrirDoEndereco();
        } catch (e) {
            console.error('[faq]', e);
            if (ausente(e)) mostrarErro('', ['O FAQ ainda não foi configurado', 'Quem administra o sistema precisa rodar o arquivo sql/07_faq.sql no Supabase e cadastrar as perguntas na aba FAQ do painel.']);
            else mostrarErro('Não consegui carregar as perguntas.', ['Não consegui carregar as perguntas', ((e && e.message) || 'Erro desconhecido') + ' — confira a internet.', true]);
        }
    }

    // link direto: faq.html?id=12  ou  faq.html#p-12  → abre a pergunta (e limpa os filtros se ela estiver escondida por eles)
    function idDoEndereco() {
        const m = /(?:[?&]id=|#p-)(\d+)/.exec(location.search + location.hash); return m ? Number(m[1]) : null;
    }
    function abrirPorId(id) {
        const it = E.itens.find(x => x.id === id); if (!it) { toast('Essa pergunta não está mais no FAQ.', 5000); return; }
        if (!E.filtrados.includes(it)) { E.texto = ''; E.categoria = ''; E.comVideo = false; $('fBusca').value = ''; $('fCategoria').value = ''; $('fVideo').checked = false; render(); }
        const pos = E.filtrados.indexOf(it); if (pos >= E.mostrando) { E.mostrando = pos + 1; render(); }
        E.abertos.add(id); render();
        const art = $('p-' + id); if (!art) return;
        art.scrollIntoView({ behavior: 'smooth', block: 'start' }); art.classList.add('destaque'); setTimeout(() => art.classList.remove('destaque'), 1800);
        const bt = art.querySelector('.faq-pergunta button'); if (bt) bt.focus({ preventScroll: true });
    }
    function abrirDoEndereco() { const id = idDoEndereco(); if (id != null) abrirPorId(id); }

    function iniciar() {
        let tempo = null;
        $('fBusca').addEventListener('input', () => { clearTimeout(tempo); tempo = setTimeout(() => { E.texto = $('fBusca').value; E.mostrando = PAGINA; render(); }, 130); });
        $('fCategoria').addEventListener('change', () => { E.categoria = $('fCategoria').value; E.mostrando = PAGINA; render(); });
        $('fVideo').addEventListener('change', () => { E.comVideo = $('fVideo').checked; E.mostrando = PAGINA; render(); });
        $('btnMais').addEventListener('click', () => { E.mostrando += PAGINA; render(); });
        document.addEventListener('keydown', e => { if (e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey && !/^(input|textarea|select)$/i.test((e.target && e.target.tagName) || '')) { e.preventDefault(); $('fBusca').focus(); } });
        window.addEventListener('hashchange', abrirDoEndereco);
        carregar();
    }
    window.Faq = { E, carregar, render, abrirPorId, alternar, atualizarCategorias };   // (também facilita testar)
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();
})();
