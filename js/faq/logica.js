/* js/faq/logica.js — FAQ: a parte SEM tela (usada pela página faq.html e pela aba "FAQ" do painel).
   • videoInfo(url): descobre de que tipo é o link do vídeo (YouTube, Google Drive, Vimeo, Loom, arquivo .mp4…) e monta o endereço que pode ser colocado dentro da página
     (só endereços conhecidos viram "embed"; qualquer outro link https vira um botão "Abrir vídeo" — nada de HTML vindo de fora).
   • buscar(): a busca da página (sem acento/maiúscula, várias palavras, palavras-chave, categoria, "só com vídeo").
   • itemDeBanco() / itemDeRespostaRapida(): levam um artigo do banco de dados / uma resposta rápida para o formato do FAQ. */
const FaqLogica = (() => {
    const MAX_VIDEOS = 12;
    const MAX_URL = 600;
    const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;          // limite do plano gratuito do Supabase Storage por arquivo
    const EXT_VIDEO = /\.(mp4|webm|ogg|ogv|mov|m4v)$/i;
    const BUCKET_VIDEOS = 'faq-videos';

    const semAcento = s => String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const norm = s => semAcento(s).replace(/\s+/g, ' ').trim();

    // "1m30s", "90s", "90", "1h2m3s" → segundos (0 se não entender)
    function segundos(t) {
        t = String(t || '').trim().toLowerCase(); if (!t) return 0;
        if (/^\d+$/.test(t)) return Math.min(86400, Number(t));
        const m = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s?)?$/.exec(t);
        if (!m || (!m[1] && !m[2] && !m[3])) return 0;
        return Math.min(86400, (Number(m[1] || 0) * 3600) + (Number(m[2] || 0) * 60) + Number(m[3] || 0));
    }

    // Devolve { ok:true, tipo, rotulo, url, embed, abrir } ou { ok:false, erro }.
    //   tipo: youtube | drive | vimeo | loom | arquivo | link   (só os 5 primeiros têm "embed"; "link" abre em outra guia)
    function videoInfo(entrada) {
        let txt = String(entrada == null ? '' : entrada).trim();
        if (!txt) return { ok: false, erro: 'Cole o link do vídeo.' };
        if (txt.length > MAX_URL) return { ok: false, erro: 'Link longo demais.' };
        if (/\s/.test(txt)) return { ok: false, erro: 'O link não pode ter espaços.' };
        if (!/^[a-z][a-z0-9+.\-]*:/i.test(txt) && /^[a-z0-9.\-]+\.[a-z]{2,}(?:[/?#:]|$)/i.test(txt)) txt = 'https://' + txt;      // "youtu.be/abc" sem o https://
        let u; try { u = new URL(txt); } catch (e) { return { ok: false, erro: 'Isso não parece um link (precisa começar com https://).' }; }
        if (u.protocol !== 'https:' && u.protocol !== 'http:') return { ok: false, erro: 'Só links http/https são aceitos.' };
        if (u.username || u.password) return { ok: false, erro: 'O link não pode ter usuário/senha.' };
        const host = u.hostname.toLowerCase().replace(/^(www|m|music)\./, '');
        const partes = u.pathname.split('/').filter(Boolean);

        // ── YouTube ──
        if (host === 'youtu.be' || host === 'youtube.com' || host === 'youtube-nocookie.com') {
            let id = null;
            if (host === 'youtu.be') id = partes[0];
            else if (partes[0] === 'watch') id = u.searchParams.get('v');
            else if (['embed', 'shorts', 'live', 'v'].includes(partes[0])) id = partes[1];
            if (id && /^[A-Za-z0-9_-]{11}$/.test(id)) {
                const ini = segundos(u.searchParams.get('t') || u.searchParams.get('start'));
                return { ok: true, tipo: 'youtube', rotulo: 'YouTube', url: u.href, embed: `https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1${ini ? '&start=' + ini : ''}`, abrir: `https://www.youtube.com/watch?v=${id}${ini ? '&t=' + ini + 's' : ''}` };
            }
            if (partes[0] === 'playlist' || (partes[0] === 'watch' && u.searchParams.get('list'))) return { ok: true, tipo: 'link', rotulo: 'Lista do YouTube (abre em outra guia)', url: u.href, embed: null, abrir: u.href };
            return { ok: false, erro: 'Não achei o código do vídeo nesse link do YouTube. Abra o vídeo e copie o endereço da barra do navegador (ou o botão Compartilhar).' };
        }

        // ── Google Drive ──
        if (host === 'drive.google.com' || (host === 'docs.google.com' && partes[0] === 'file')) {
            if (partes.includes('folders') || partes[0] === 'drive') return { ok: false, erro: 'Esse link é de uma PASTA do Drive. Abra o vídeo, clique em Compartilhar › "Qualquer pessoa com o link" e copie o link do ARQUIVO.' };
            let id = null; const iD = partes.indexOf('d');
            if (iD >= 0 && partes[iD + 1]) id = partes[iD + 1]; else id = u.searchParams.get('id');
            if (id && /^[A-Za-z0-9_-]{10,}$/.test(id)) return { ok: true, tipo: 'drive', rotulo: 'Google Drive', url: u.href, embed: `https://drive.google.com/file/d/${id}/preview`, abrir: `https://drive.google.com/file/d/${id}/view` };
            return { ok: false, erro: 'Não achei o código do arquivo nesse link do Google Drive. Use o link de "Compartilhar" do vídeo.' };
        }

        // ── Vimeo ──
        if (host === 'vimeo.com' || host === 'player.vimeo.com') {
            const iV = partes.indexOf('video'); const id = host === 'player.vimeo.com' ? partes[iV + 1] : partes.find(p => /^\d+$/.test(p));
            if (id && /^\d{4,}$/.test(id)) {
                const depois = host === 'vimeo.com' ? partes[partes.indexOf(id) + 1] : null;
                const hash = u.searchParams.get('h') || (depois && /^[a-f0-9]{6,}$/i.test(depois) ? depois : null);
                return { ok: true, tipo: 'vimeo', rotulo: 'Vimeo', url: u.href, embed: `https://player.vimeo.com/video/${id}${hash ? '?h=' + encodeURIComponent(hash) : ''}`, abrir: `https://vimeo.com/${id}${hash ? '/' + encodeURIComponent(hash) : ''}` };
            }
            return { ok: false, erro: 'Não achei o código do vídeo nesse link do Vimeo.' };
        }

        // ── Loom ──
        if (host === 'loom.com') {
            const id = (['share', 'embed'].includes(partes[0]) ? partes[1] : null);
            if (id && /^[a-f0-9]{32}$/i.test(id)) return { ok: true, tipo: 'loom', rotulo: 'Loom', url: u.href, embed: `https://www.loom.com/embed/${id}`, abrir: `https://www.loom.com/share/${id}` };
            return { ok: false, erro: 'Não achei o código do vídeo nesse link do Loom.' };
        }

        // ── arquivo de vídeo direto (.mp4…) ──
        if (EXT_VIDEO.test(u.pathname)) return { ok: true, tipo: 'arquivo', rotulo: 'Arquivo de vídeo', url: u.href, embed: u.href, abrir: u.href };

        // ── qualquer outro link: aceito, mas só abre em outra guia (não vira player) ──
        if (u.protocol !== 'https:') return { ok: false, erro: 'Para links de outros sites use https://' };
        return { ok: true, tipo: 'link', rotulo: 'Link externo (abre em outra guia)', url: u.href, embed: null, abrir: u.href };
    }

    // Lista de vídeos que vem do banco (jsonb): aceita lista, texto JSON ou lixo. Devolve [{ titulo, url, info }] só com os que têm link válido.
    function lerVideos(valor) {
        let v = valor;
        if (typeof v === 'string') { try { v = JSON.parse(v); } catch (e) { v = []; } }
        if (!Array.isArray(v)) return [];
        const saida = [];
        v.slice(0, MAX_VIDEOS).forEach(x => {
            if (!x || typeof x !== 'object') return;
            const info = videoInfo(x.url);
            if (info.ok) saida.push({ titulo: String(x.titulo || '').trim().slice(0, 120), url: info.url, info });
        });
        return saida;
    }
    // Rascunho do editor ([{titulo,url}], linhas em branco) → { ok, videos:[{titulo,url}], erros:[{indice,erro}] }
    function prepararVideos(linhas) {
        const videos = [], erros = [];
        (Array.isArray(linhas) ? linhas : []).forEach((x, i) => {
            const url = String((x && x.url) || '').trim(), titulo = String((x && x.titulo) || '').trim().slice(0, 120);
            if (!url && !titulo) return;
            const info = videoInfo(url);
            if (!info.ok) { erros.push({ indice: i, erro: info.erro }); return; }
            videos.push({ titulo, url: info.url });
        });
        if (videos.length > MAX_VIDEOS) erros.push({ indice: -1, erro: 'No máximo ' + MAX_VIDEOS + ' vídeos por pergunta.' });
        return { ok: !erros.length, videos: videos.slice(0, MAX_VIDEOS), erros };
    }

    // Texto simples (para o resumo da lista): tira Markdown
    function resumo(texto, n) {
        let t = String(texto == null ? '' : texto).replace(/```[\s\S]*?```/g, ' ').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/https?:\/\/\S+/g, ' ')
            .replace(/^[ \t]*(?:#{1,6}|>|[-+*])[ \t]+/gm, '')             // título, citação e marcador de lista no começo da linha
            .replace(/[*`~]/g, '').replace(/(^|\s)_+|_+(?=\s|$|[.,;:!?)])/g, '$1').replace(/\|/g, ' ')   // ênfase colada na palavra some sem deixar espaço ("Novo." e não "Novo .")
            .replace(/\s+/g, ' ').trim();
        return t.length > n ? t.slice(0, n - 1).replace(/\s+\S*$/, '') + '…' : t;
    }

    // O renderMd do chat põe <br> entre os <li> e em volta das listas (no chat é invisível; na resposta do FAQ vira um vão enorme): tira os <br> que encostam em <ul>/<ol>/<li>.
    function arrumarListas(html) {
        return String(html == null ? '' : html).replace(/(?:<br\s*\/?>\s*)+(?=<\/?(?:ul|ol|li)\b)/gi, '').replace(/(<\/(?:ul|ol|li)>)(?:\s*<br\s*\/?>)+/gi, '$1');
    }

    // ── busca ──
    // Cada palavra digitada precisa aparecer em algum campo (sem acento, plural/singular tanto faz); a pontuação favorece a pergunta e as palavras-chave.
    const formas = p => { const s = [p]; if (p.length > 4 && p.endsWith('s')) s.push(p.slice(0, -1)); return s; };
    const _alvos = new WeakMap();      // texto já normalizado de cada pergunta (a busca roda a cada tecla)
    // texto de comparação: sem acento/maiúscula e SEM hífen dentro de palavra — "CT-e", "ct-e" e "cte" (idem MDF-e/mdfe, NF-e/nfe) viram a mesma coisa, de qualquer lado
    const chaveBusca = s => norm(s).replace(/(\S)-+(?=\S)/g, '$1');
    const alvo = it => { let a = _alvos.get(it); if (!a) { a = { p: chaveBusca(it.pergunta), k: chaveBusca(it.palavras_chave), c: chaveBusca(it.categoria), r: chaveBusca(it.resposta), m: chaveBusca(it.caminho_menu) }; _alvos.set(it, a); } return a; };
    function pontuar(it, palavras, frase) {
        const a = alvo(it); let pontos = 0;
        for (const pal of palavras) {
            const fs = formas(pal); let melhor = 0;
            for (const f of fs) { if (a.p.includes(f)) melhor = Math.max(melhor, 5); else if (a.k.includes(f)) melhor = Math.max(melhor, 4); else if (a.c.includes(f)) melhor = Math.max(melhor, 3); else if (a.m.includes(f)) melhor = Math.max(melhor, 2); else if (a.r.includes(f)) melhor = Math.max(melhor, 1); }
            if (!melhor) return 0;
            pontos += melhor;
        }
        if (frase && a.p.includes(frase)) pontos += 6;
        return pontos;
    }
    // filtros: { texto, categoria ('' = todas), comVideo (bool) }. Sem texto: ordem do painel (ordem, id).
    function buscar(itens, filtros) {
        const f = filtros || {}, q = chaveBusca(f.texto), palavras = q.split(' ').filter(Boolean);
        const base = (itens || []).filter(it => (!f.categoria || String(it.categoria || '').trim() === f.categoria) && (!f.comVideo || lerVideos(it.videos).length > 0));
        const porOrdem = (a, b) => ((Number(a.ordem) || 0) - (Number(b.ordem) || 0)) || (Number(a.id) - Number(b.id));
        if (!palavras.length) return base.slice().sort(porOrdem);
        return base.map(it => ({ it, p: pontuar(it, palavras, q) })).filter(x => x.p > 0).sort((a, b) => (b.p - a.p) || porOrdem(a.it, b.it)).map(x => x.it);
    }
    function categorias(itens) {
        const m = new Map();
        (itens || []).forEach(it => { const c = String(it.categoria || '').trim(); if (c) m.set(c, (m.get(c) || 0) + 1); });
        return Array.from(m.entries()).map(([nome, total]) => ({ nome, total })).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    }

    // ── do banco de dados para o FAQ ──
    const txt = v => String(v == null ? '' : v).trim();
    function itemDeBanco(r) {
        let resposta = txt(r.conteudo);
        if (txt(r.como_emitir)) resposta += (resposta ? '\n\n' : '') + '**Como emitir**\n' + txt(r.como_emitir);
        return { pergunta: txt(r.titulo), resposta, categoria: txt(r.categoria) || null, caminho_menu: txt(r.caminho_menu) || null, palavras_chave: null, origem: 'banco', origem_id: Number(r.id) };
    }
    function itemDeRespostaRapida(r) {
        const vars = Array.isArray(r.variantes) ? r.variantes.map(txt).filter(Boolean) : [];
        return { pergunta: txt(r.pergunta), resposta: txt(r.resposta), categoria: txt(r.categoria) || null, caminho_menu: null, palavras_chave: vars.length ? vars.join(' · ') : null, origem: 'resposta_rapida', origem_id: Number(r.id) };
    }
    const ROTULO_ORIGEM = { banco: 'Banco de dados', resposta_rapida: 'Resposta rápida' };

    // nome de arquivo seguro para o Storage: "Como Emitir CT-e (final).MP4" → "como-emitir-ct-e-final.mp4"
    function slugArquivo(nome) {
        const s = String(nome || 'video').split(/[\\/]/).pop(), pt = s.lastIndexOf('.');      // (só o nome do arquivo: nada de pasta/caminho)
        const base = (pt > 0 ? s.slice(0, pt) : s), ext = (pt > 0 ? s.slice(pt + 1) : '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5);
        const slug = semAcento(base).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'video';
        return slug + (ext ? '.' + ext : '');
    }
    function validarArquivoVideo(arq) {
        if (!arq) return 'Escolha um arquivo.';
        if (!/^video\//i.test(arq.type || '') && !EXT_VIDEO.test(arq.name || '')) return 'Esse arquivo não parece um vídeo (use .mp4, .webm ou .mov).';
        if (arq.size > MAX_UPLOAD_BYTES) return 'O arquivo tem ' + (arq.size / 1048576).toFixed(1).replace('.', ',') + ' MB e o limite é 50 MB. Para vídeos maiores use o YouTube ("não listado") ou o Google Drive e cole o link.';
        return null;
    }

    return { MAX_VIDEOS, MAX_UPLOAD_BYTES, BUCKET_VIDEOS, ROTULO_ORIGEM, semAcento, norm, segundos, videoInfo, lerVideos, prepararVideos, resumo, arrumarListas, chaveBusca, buscar, categorias, itemDeBanco, itemDeRespostaRapida, slugArquivo, validarArquivoVideo };
})();
