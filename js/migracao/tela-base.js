/* js/migracao/tela-base.js — Primeira emissão guiada: a base da tela (migracao.html).
   O estado da página (window.Mig), o cliente guardado no navegador, o aviso (toast), as janelas de diálogo e os cartões que mostram o conhecimento
   (artigos do banco de dados, respostas aprovadas, FAQ com vídeos). A tela em si (perguntas, passo a passo e chat) fica em tela-passos.js.
   SEGURANÇA: todo texto que vem do banco, da IA ou do armazenamento do navegador entra na tela como TEXTO (h() usa textContent) ou passa pelo renderMd (que escapa o HTML antes de formatar);
   os vídeos só viram player quando o endereço é de um site conhecido (js/faq/logica.js › videoInfo); as imagens só valem se forem do armazenamento público do próprio Supabase (BancoImg). */
window.Mig = (function () {
    'use strict';
    const L = MigLogica;
    const E = {
        R: window.BSOFT_MIG_ROTEIRO, G: window.BSOFT_MIG_REGRAS, GL: window.BSOFT_MIG_GLOSSARIO, L,
        dados: { banco: [], rapidas: [], faq: [], params: [], funcs: [], faqExiste: true, rapidasExiste: true, estado: 'carregando', erro: '' },
        ix: { banco: null, rapida: null, faq: null, regra: null, termo: null, video: null },
        docs: new Map(),          // chave → documento (para abrir uma "fonte" citada)
        local: { versao: 1, clientes: [], atual: '' },
        atual: null, rot: null, ouvintes: {},
    };
    const $ = id => document.getElementById(id);

    /* ───────── DOM seguro ───────── */
    // h('div', { class: 'x', onclick: fn, 'aria-label': '…' }, filhos…) — texto sempre como texto
    function h(tag, attrs) {
        const n = document.createElement(tag);
        if (attrs) Object.keys(attrs).forEach(k => {
            const v = attrs[k];
            if (v == null || v === false) return;
            if (k === 'class') n.className = v;
            else if (k === 'dataset') Object.assign(n.dataset, v);
            else if (k.slice(0, 2) === 'on' && typeof v === 'function') n.addEventListener(k.slice(2), v);
            else if (v === true) n.setAttribute(k, '');
            else n.setAttribute(k, String(v));
        });
        for (let i = 2; i < arguments.length; i++) anexar(n, arguments[i]);
        return n;
    }
    function anexar(n, c) { if (c == null || c === false) return; if (Array.isArray(c)) c.forEach(x => anexar(n, x)); else n.append(c.nodeType ? c : document.createTextNode(String(c))); }
    const limpar = n => { while (n.firstChild) n.removeChild(n.firstChild); return n; };
    // Markdown da IA / do banco → HTML (o renderMd escapa o HTML antes de formatar). Se falhar, vira texto puro.
    function md(texto, cls) {
        const d = h('div', { class: 'mig-md' + (cls ? ' ' + cls : '') });
        try { d.innerHTML = FaqLogica.arrumarListas(renderMd(String(texto == null ? '' : texto))); } catch (e) { d.textContent = String(texto || ''); }
        d.querySelectorAll('a[href]').forEach(a => { a.target = '_blank'; a.rel = 'noopener noreferrer'; });
        return d;
    }
    function toast(msg, ms) { const t = $('toast'); if (!t) return; t.textContent = msg; t.hidden = false; clearTimeout(toast._t); toast._t = setTimeout(() => { t.hidden = true; }, ms || 3800); }
    function copiar(texto, ok) {
        const falha = () => { const ta = document.createElement('textarea'); ta.value = texto; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); toast(ok || 'Copiado.'); } catch (e) { toast('Não consegui copiar.'); } ta.remove(); };
        (navigator.clipboard && navigator.clipboard.writeText ? navigator.clipboard.writeText(texto).then(() => toast(ok || 'Copiado.'), falha) : Promise.resolve().then(falha));
    }

    /* ───────── eventos (a base de dados chegou) ───────── */
    function on(ev, fn) { (E.ouvintes[ev] = E.ouvintes[ev] || []).push(fn); }
    function emit(ev, d) { (E.ouvintes[ev] || []).slice().forEach(fn => { try { fn(d); } catch (e) { console.error('[migração] ' + ev + ':', e); } }); }

    /* ───────── diálogos (<dialog> nativo: Esc fecha, foco preso, leitor de tela avisado) ───────── */
    // abrirDialogo({ titulo, corpo (nó), botoes: [{ rotulo, classe, valor, aoClicar }], largo }) → promessa com o valor do botão (ou undefined se fechou com Esc)
    function abrirDialogo(o) {
        return new Promise(resolve => {
            const dlg = h('dialog', { class: 'mig-dialogo' + (o.largo ? ' largo' : ''), 'aria-labelledby': 'dlgTit' });
            const fechar = v => { try { dlg.close(); } catch (e) { /* já fechado */ } resolve(v); setTimeout(() => dlg.remove(), 60); };
            dlg.append(h('div', { class: 'mig-dialogo-cab' }, h('h2', { id: 'dlgTit' }, o.titulo || ''), h('button', { type: 'button', class: 'mig-x', 'aria-label': 'Fechar', onclick: () => fechar(undefined) }, '✕')));
            const corpo = h('div', { class: 'mig-dialogo-corpo' }, typeof o.corpo === 'function' ? o.corpo(fechar) : o.corpo); dlg.append(corpo);   // (corpo pode ser uma função que recebe "fechar" para fechar a janela de dentro)
            if (o.botoes && o.botoes.length) dlg.append(h('div', { class: 'mig-dialogo-rodape' }, o.botoes.map(b => h('button', { type: 'button', class: 'mig-btn ' + (b.classe || ''), onclick: async () => { if (b.aoClicar) { const r = await b.aoClicar(dlg); if (r === false) return; } fechar(b.valor); } }, b.rotulo))));
            dlg.addEventListener('close', () => { dlg.remove(); resolve(undefined); });
            dlg.addEventListener('click', ev => { if (ev.target === dlg) fechar(undefined); });
            document.body.appendChild(dlg);
            if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', '');
            const foco = dlg.querySelector('[autofocus],input,select,textarea,button.primario'); if (foco) setTimeout(() => foco.focus(), 30);
        });
    }
    const confirmar = (texto, o) => abrirDialogo({ titulo: (o && o.titulo) || 'Confirmar', corpo: h('p', { class: 'mig-dialogo-texto' }, texto), botoes: [{ rotulo: (o && o.nao) || 'Cancelar', valor: false }, { rotulo: (o && o.sim) || 'Sim', classe: (o && o.perigo) ? 'perigo' : 'primario', valor: true }] }).then(v => v === true);

    /* ───────── o cliente (só neste navegador) ───────── */
    // Neste computador só existe UM acompanhamento: o de quem está usando a página. Recomeçar apaga tudo e volta às perguntas.
    let carregado = false;      // só grava depois de ter LIDO o que já estava guardado (senão uma gravação precoce apagaria o cliente)
    function carregarLocal() {
        const bruto = MigDados.lerLocal();
        const lista = (Array.isArray(bruto.clientes) ? bruto.clientes : []).slice(0, 20).map(c => L.sanearCliente(c, E.R)).filter(Boolean);
        const c = lista.find(x => x.id === bruto.atual) || lista[0] || null;
        E.local = { versao: 1, clientes: c ? [c] : [], atual: c ? c.id : '' };
        carregado = true;
        definirAtual(E.local.atual, true);
    }
    function definirAtual(id, semSalvar) {
        E.atual = E.local.clientes.find(c => c.id === id) || null;
        E.local.atual = E.atual ? E.atual.id : '';
        E.rot = E.atual ? L.montarRoteiro(E.atual.perfil, E.R) : null;
        if (E.atual && E.rot) E.atual.passoIdx = Math.max(0, Math.min(E.atual.passoIdx || 0, E.rot.passos.length - 1));   // (o passo guardado nunca passa do último: o roteiro pode ter mudado)
        if (!semSalvar) salvar();
    }
    let _ultimoAvisoSalvar = 0;
    function salvar(agora) {
        if (!carregado) return Promise.resolve('');
        return MigDados.gravarLocal(E.local, agora).then(erro => { if (erro && Date.now() - _ultimoAvisoSalvar > 20000) { _ultimoAvisoSalvar = Date.now(); toast(erro, 8000); } return erro; });
    }
    // ao sair ou esconder a página, grava na hora o que estiver esperando o atraso de gravação
    const gravarJa = () => { if (carregado) MigDados.gravarLocal(E.local, true); };
    window.addEventListener('pagehide', gravarJa);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') gravarJa(); });
    function novoCliente(perfil) {
        const c = L.novoCliente(L.sanearPerfil(perfil, E.R));
        E.local.clientes = [c]; definirAtual(c.id); return c;
    }
    function excluirCliente() { E.local.clientes = []; definirAtual(''); }
    function mudarStatus(passoId, s) {
        if (!E.atual || !E.rot || !E.rot.porId.has(passoId) || !L.STATUS.includes(s)) return false;
        const mudou = L.registrarStatus(E.atual, passoId, s);
        if (mudou) salvar();
        return mudou;
    }
    function mudarPerfil(perfil) {
        if (!E.atual) return;
        E.atual.perfil = L.sanearPerfil(perfil, E.R); E.atual.atualizadoEm = Date.now();
        E.rot = L.montarRoteiro(E.atual.perfil, E.R); salvar();
    }
    const estadoDoPasso = id => L.statusDe(E.atual && E.atual.passos, id);

    /* ───────── índices de busca ───────── */
    // soLocal = só regras, glossário e vídeos (não dependem do banco de dados): a busca deles já funciona antes de a base chegar
    function construirIndices(soLocal) {
        const d = E.dados;
        E.ix.regra = L.criarIndice(E.G.regras.map(L.docDeRegra));
        E.ix.termo = L.criarIndice(E.GL.termos.map(L.docDeTermo));
        E.ix.video = L.criarIndice(Object.keys(E.R.videos || {}).map(k => L.docDeVideo(k, E.R.videos[k])));
        if (soLocal) return;
        E.ix.banco = L.criarIndice(d.banco.map(L.docDeBanco));
        E.ix.rapida = L.criarIndice(d.rapidas.map(L.docDeRapida));
        E.ix.faq = L.criarIndice(d.faq.map(L.docDeFaq));
        E.docs.clear();
        ['banco', 'rapida', 'faq'].forEach(k => E.ix[k].lista.forEach(x => E.docs.set(x.chave, x)));
    }

    /* ───────── cartões do conhecimento ───────── */
    function blocoCaminhos(caminhos) {
        if (!caminhos || !caminhos.length) return null;
        return h('ul', { class: 'mig-caminhos' }, caminhos.map(c => {
            const ok = typeof MenuBsoft !== 'undefined' && MenuBsoft.pronto() ? MenuBsoft.validarCaminho(c).ok : true;
            return h('li', null, h('span', { class: 'mig-caminho' + (ok ? '' : ' duvida'), title: ok ? 'Caminho do menu real do Bsoft' : 'Este caminho não foi encontrado no menu cadastrado — confira no sistema' }, '🧭 ' + c),
                h('button', { type: 'button', class: 'mig-mini', onclick: () => copiar(c, 'Caminho copiado.'), 'aria-label': 'Copiar o caminho ' + c }, 'copiar'));
        }));
    }
    function playerDeVideo(info, titulo) {
        const caixa = h('div', { class: 'mig-player' });
        if (info.tipo === 'arquivo') { const v = document.createElement('video'); v.controls = true; v.preload = 'metadata'; v.setAttribute('playsinline', ''); v.src = info.embed; v.setAttribute('aria-label', titulo); caixa.append(v); }
        else {
            const f = document.createElement('iframe'); f.src = info.embed; f.title = titulo; f.loading = 'lazy'; f.referrerPolicy = 'strict-origin-when-cross-origin';
            f.setAttribute('allow', 'fullscreen; picture-in-picture; encrypted-media; clipboard-write'); f.setAttribute('allowfullscreen', '');
            f.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-presentation allow-popups allow-popups-to-escape-sandbox'); caixa.append(f);
        }
        return caixa;
    }
    function blocoVideos(valor) {
        const vs = FaqLogica.lerVideos(valor); if (!vs.length) return null;
        return h('div', { class: 'mig-videos' }, vs.map((v, i) => {
            const titulo = v.titulo || ('Vídeo ' + (i + 1)), b = h('section', { class: 'mig-video', 'aria-label': titulo }, h('h4', null, '🎬 ' + titulo, h('small', null, ' ' + v.info.rotulo)));
            if (!v.info.embed) { b.append(h('a', { class: 'mig-btn primario', href: v.info.abrir, target: '_blank', rel: 'noopener noreferrer' }, '▶ Abrir vídeo')); return b; }
            const carregar = h('button', { type: 'button', class: 'mig-btn', onclick: ev => ev.currentTarget.replaceWith(playerDeVideo(v.info, titulo)) }, '▶ Carregar e assistir');
            b.append(carregar, h('div', { class: 'mig-video-link' }, h('a', { href: v.info.abrir, target: '_blank', rel: 'noopener noreferrer' }, 'Abrir em outra guia ↗')));
            return b;
        }));
    }
    function blocoImagens(valor) {
        if (typeof BancoImg === 'undefined') return null;
        let lista = []; try { lista = BancoImg.lista(valor) || []; } catch (e) { lista = []; }
        if (!lista.length) return null;
        return h('div', { class: 'mig-imgs' }, lista.map(im => h('a', { href: im.url, target: '_blank', rel: 'noopener noreferrer', title: im.legenda || 'Abrir a imagem' }, h('img', { src: im.url, alt: im.legenda || 'Imagem do passo a passo', loading: 'lazy' }))));
    }
    const ROTULO_FONTE = { banco: ['📚', 'Banco de dados'], rapida: ['✅', 'Resposta aprovada'], faq: ['❓', 'FAQ'] };
    // Um artigo/resposta/FAQ recolhível. o = { aberto }
    function cartaoConhecimento(doc, o) {
        o = o || {};
        const [ico, rotulo] = ROTULO_FONTE[doc.fonte] || ['📄', ''];
        const temVideo = doc.fonte === 'faq' && FaqLogica.lerVideos(doc.videos).length > 0;
        const corpo = h('div', { class: 'mig-know-corpo', hidden: true });
        const cab = h('button', { type: 'button', class: 'mig-know-cab', 'aria-expanded': 'false', onclick: alternar },
            h('span', { class: 'mig-know-ico', 'aria-hidden': 'true' }, ico), h('span', { class: 'mig-know-tit' }, doc.titulo),
            h('span', { class: 'mig-know-meta' }, h('span', { class: 'mig-tag' }, rotulo), doc.categoria ? h('span', { class: 'mig-tag suave' }, doc.categoria) : null, temVideo ? h('span', { class: 'mig-tag video' }, '🎬 vídeo') : null),
            h('span', { class: 'mig-seta', 'aria-hidden': 'true' }, '⌄'));
        const art = h('article', { class: 'mig-know ' + doc.fonte, dataset: { chave: doc.chave } }, cab, corpo);
        function montar() {
            corpo.append(md(doc.texto));
            if (doc.caminho) corpo.append(h('div', { class: 'mig-onde' }, h('b', null, 'Onde fica: '), doc.caminho));
            const im = doc.fonte === 'banco' ? blocoImagens(doc.imagens) : null; if (im) corpo.append(im);
            const vd = temVideo ? blocoVideos(doc.videos) : null; if (vd) corpo.append(vd);
            const acoes = h('div', { class: 'mig-acoes' }, h('button', { type: 'button', class: 'mig-btn pequeno', onclick: () => copiar(doc.titulo + '\n\n' + doc.texto, 'Texto copiado.') }, '📋 Copiar'));
            if (doc.fonte === 'faq') acoes.append(h('a', { class: 'mig-btn pequeno', href: 'faq.html?id=' + encodeURIComponent(doc.id), target: '_blank', rel: 'noopener noreferrer' }, 'Abrir no FAQ ↗'));
            corpo.append(acoes);
        }
        function alternar(forcar) {
            const abrir = typeof forcar === 'boolean' ? forcar : corpo.hidden;
            if (abrir && !corpo.firstChild) montar();
            corpo.hidden = !abrir; cab.setAttribute('aria-expanded', String(abrir)); art.classList.toggle('aberto', abrir);
        }
        if (o.aberto) alternar(true);
        art.abrir = () => alternar(true);
        return art;
    }

    Object.assign(E, { $, h, md, toast, copiar, limpar, on, emit, abrirDialogo, confirmar, carregarLocal, definirAtual, salvar, novoCliente, excluirCliente, mudarStatus, mudarPerfil, estadoDoPasso,
        construirIndices, blocoCaminhos, blocoVideos, blocoImagens, cartaoConhecimento });
    return E;
})();
