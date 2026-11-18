/* js/migracao/tela-passos.js — Primeira emissão guiada (migracao.html): a tela do CLIENTE.
   1) UMA tela de perguntas (de onde a empresa vem, quais documentos, seguro e últimos números emitidos);
   2) o PASSO A PASSO (Anterior / Próximo) — cada passo com o que ter em mãos, o caminho no menu, o vídeo tutorial e os erros mais comuns;
   3) o CHAT com a IA no MESMO lugar, ao lado do passo: ele já sabe em que passo a pessoa está, usa o banco de dados e o FAQ do Suporte e, no modo "Deu erro?",
      responde no formato causa → correção → depois → se não resolver. Nada aqui é configuração do sistema (isso é da Implantação/Suporte); a única exceção é o seguro.
   O progresso e a conversa ficam só neste navegador. Tudo o que vem do banco, da IA ou do cliente entra na tela como TEXTO (h() / renderMd escapam o HTML). */
(function () {
    'use strict';
    const E = Mig, L = E.L, h = E.h, $ = E.$;
    let modoErro = false, ocupado = false, ficha = 0, statusEl = null, relogio = null, ultimaPergunta = null, ultimoEnvio = null, chatAberto = false;
    const DOC_DO_PASSO = { cte: 'CT-e', mdfe: 'MDF-e', ciotPropria: 'CIOT da frota própria', contratoFrete: 'Contrato de frete / CIOT', pessoas: 'Cadastro de pessoas', veiculos: 'Cadastro de veículos', numeracao: 'Talão e numeração', seguro: 'Seguro e averbação', depois: 'Depois da emissão', entender: 'Visão geral' };
    // (o append nativo escreveria a palavra "null" na tela quando um filho é null — aqui filho vazio é pulado, como no h())
    const juntar = (pai, ...filhos) => { filhos.forEach(n => { if (n) pai.append(n); }); return pai; };
    const passos = () => (E.rot ? E.rot.passos : []);
    const idx = () => Math.max(0, Math.min(Math.max(0, passos().length - 1), E.atual ? E.atual.passoIdx || 0 : 0));
    const passoAtual = () => passos()[idx()] || null;

    /* ═════════ 1) perguntas do começo ═════════ */
    function mostrarForm(editar) {
        const raiz = $('telaInicio'); E.limpar(raiz); $('telaPassos').hidden = true; raiz.hidden = false; $('btnRecomecar').hidden = true; $('btnChatCelular').hidden = true;
        let perfil = editar && E.atual ? JSON.parse(JSON.stringify(E.atual.perfil)) : L.perfilPadrao(E.R, 'migracao');
        const perguntasBox = h('div', { class: 'mig-perguntas' }), erro = h('div', { class: 'mig-erro', role: 'alert', hidden: true });
        function campo(q) {
            const caixa = h('fieldset', { class: 'mig-campo' }, h('legend', null, q.rotulo));
            if (q.ajuda) caixa.append(h('p', { class: 'mig-ajuda' }, q.ajuda));
            if (q.tipo === 'multi') {
                const marcados = new Set(perfil[q.id] || []);
                caixa.append(h('div', { class: 'mig-opcoes' }, q.opcoes.map(op => h('label', { class: 'mig-op' }, h('input', { type: 'checkbox', checked: marcados.has(op.v), onchange: ev => { if (ev.target.checked) marcados.add(op.v); else marcados.delete(op.v); perfil[q.id] = q.opcoes.map(x => x.v).filter(v => marcados.has(v)); erro.hidden = true; } }), h('span', null, op.r)))));
            } else if (q.tipo === 'escolha') {
                const atual = q.id === 'trilha' ? perfil.trilha : perfil[q.id];
                caixa.append(h('div', { class: q.grande ? 'mig-opcoes-grandes' : 'mig-opcoes' }, q.opcoes.map(op => h('label', { class: 'mig-op' + (q.grande ? ' grande' : '') },
                    h('input', { type: 'radio', name: 'perf_' + q.id, value: op.v, checked: atual === op.v, onchange: () => { if (q.id === 'trilha') { perfil = L.sanearPerfil(Object.assign({}, perfil, { trilha: op.v }), E.R); montar(); } else perfil[q.id] = op.v; } }),
                    h('span', null, q.grande ? h('b', null, op.r) : op.r, q.grande && op.d ? h('small', null, op.d) : null)))));
            } else if (q.tipo === 'numeracao') {
                const n = perfil[q.id] || (perfil[q.id] = { cteSerie: '', cteNumero: '', mdfeSerie: '', mdfeNumero: '' });
                const num = (k, rot, max) => h('label', { class: 'mig-mini-campo' }, h('span', null, rot), h('input', { type: 'text', inputmode: 'numeric', maxlength: String(max), value: n[k] || '', oninput: ev => { ev.target.value = ev.target.value.replace(/\D/g, ''); (perfil[q.id] || (perfil[q.id] = {}))[k] = ev.target.value; } }));
                caixa.append(h('div', { class: 'mig-numeracao' }, h('b', null, 'CT-e'), num('cteSerie', 'série', 3), num('cteNumero', 'último número', 9), h('b', null, 'MDF-e'), num('mdfeSerie', 'série', 3), num('mdfeNumero', 'último número', 9)));
            }
            return caixa;
        }
        function montar() { E.limpar(perguntasBox); L.perguntasDoPerfil(E.R, perfil.trilha).forEach(q => perguntasBox.append(campo(q))); }
        montar();
        const enviar = () => {
            const limpo = L.sanearPerfil(perfil, E.R);      // (uma cópia: "perfil" continua sendo o que os campos da tela editam, mesmo se faltar alguma resposta)
            if (!limpo.docs.length) { erro.textContent = 'Marque pelo menos um documento para eu montar o passo a passo.'; erro.hidden = false; return; }
            if (editar && E.atual) { E.mudarPerfil(limpo); E.atual.passoIdx = Math.min(E.atual.passoIdx || 0, Math.max(0, passos().length - 1)); E.salvar(); }
            else E.novoCliente(limpo);
            mostrarPassos();
        };
        raiz.append(h('section', { class: 'mig-cartao mig-hero' },
            h('h1', null, editar ? 'Mudar as suas respostas' : 'Primeira emissão, passo a passo'),
            h('p', { class: 'mig-sub' }, editar ? 'O passo a passo é refeito com as novas respostas. O que você já fez continua marcado.' : 'Responda 3 ou 4 perguntas rápidas e eu monto o caminho certo para a sua empresa — com vídeo em cada passo e uma IA ao lado para tirar dúvidas e resolver erros.'),
            h('form', { class: 'mig-form', novalidate: true, onsubmit: ev => { ev.preventDefault(); enviar(); } }, perguntasBox, erro,
                h('div', { class: 'mig-acoes' }, h('button', { type: 'submit', class: 'mig-btn primario grande' }, editar ? 'Salvar e voltar ao passo a passo' : 'Começar o passo a passo →'), editar ? h('button', { type: 'button', class: 'mig-btn', onclick: () => mostrarPassos() }, 'Cancelar') : null))),
            h('p', { class: 'mig-aviso-privacidade' }, '🔒 Nada do que você responde sai do seu computador, exceto o que você digitar no chat (e, mesmo assim, sem CNPJ, CPF, telefone e e-mail).'));
    }

    /* ═════════ 2) o passo a passo ═════════ */
    const secao = (titulo, ...f) => h('section', { class: 'mig-sec' }, h('h4', null, titulo), ...f);
    function blocoNumeracao() {
        const n = (E.atual && E.atual.perfil.numeracao) || {}, linhas = [];
        const prox = v => String(parseInt(v, 10) + 1);
        if (n.cteNumero) linhas.push('Seu último CT-e: série ' + (n.cteSerie || '—') + ', número ' + n.cteNumero + ' → o próximo no Bsoft deve ser ' + prox(n.cteNumero) + '.');
        if (n.mdfeNumero) linhas.push('Seu último MDF-e: série ' + (n.mdfeSerie || '—') + ', número ' + n.mdfeNumero + ' → o próximo no Bsoft deve ser ' + prox(n.mdfeNumero) + '.');
        if (!linhas.length) return h('div', { class: 'mig-aviso' }, h('b', null, 'Você não informou os últimos números. '), 'Antes de conferir, veja no sistema anterior o último número de cada série. ', h('button', { type: 'button', class: 'mig-link', onclick: () => mostrarForm(true) }, 'Informar agora'));
        return h('div', { class: 'mig-numeros' }, h('b', null, 'O que você informou:'), linhas.map(t => h('p', null, t)), h('p', { class: 'mig-ajuda' }, 'Compare com o próximo número liberado no talão. Se não bater, não emita: fale com o Suporte.'));
    }
    const dataCurta = iso => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || ''); return m ? m[3] + '/' + m[2] + '/' + m[1] : ''; };
    function blocoPrazos() {
        const ids = ['cte-cancelar', 'cte-cce', 'mdfe-cancelar', 'mdfe-encerrar'].concat(E.atual.perfil.docs.some(d => /ciot|contrato/i.test(d)) ? ['ciot-antes'] : []);
        const regras = ids.map(id => E.G.regras.find(r => r.id === id)).filter(Boolean);
        const lista = h('div', { class: 'mig-regras-mini' }, regras.map(r => h('details', { class: 'mig-detalhes' }, h('summary', null, h('b', null, r.titulo), ' ', h('span', { class: 'mig-tag nivel-' + r.nivel }, r.nivel === 'conferido' ? 'conferida' : 'orientativa'), r.prazo ? h('small', null, ' · ' + r.prazo) : null),
            h('div', { class: 'mig-detalhes-corpo' }, h('p', { class: 'mig-regra-texto' }, r.regra), r.seNaoCumprir ? h('div', { class: 'mig-dica' }, h('b', null, 'E se passar do prazo? '), r.seNaoCumprir) : null, r.varia ? h('div', { class: 'mig-aviso' }, h('b', null, 'Pode variar: '), r.varia) : null,
                h('p', { class: 'mig-fontes' }, h('b', null, 'Fontes: '), (r.fontes || []).map((f, i) => [i ? ' · ' : '', f.url ? h('a', { href: f.url, target: '_blank', rel: 'noopener noreferrer' }, f.titulo) : f.titulo]), ' — conferida em ' + dataCurta(r.conferidoEm))))));
        const doc = h('select', { 'aria-label': 'Documento' }, ['CT-e', 'MDF-e'].map(d => h('option', { value: d }, d)));
        const agora = new Date(); agora.setSeconds(0, 0);
        const quando = h('input', { type: 'datetime-local', value: L.paraInputLocal(agora), 'aria-label': 'Data e hora em que o documento foi autorizado' });
        const uf = h('select', { 'aria-label': 'UF do emitente' }, h('option', { value: '' }, 'Outro estado'), L.UFS.map(u => h('option', { value: u }, u)));
        const saida = h('div', { class: 'mig-prazos-saida', role: 'status' });
        const calc = () => { E.limpar(saida); const base = L.deInputLocal(quando.value); if (!base) return; L.calcularPrazos(E.G.calculadora, { doc: doc.value, base, uf: uf.value }).filter(i => i.tipo !== 'guarda').forEach(i => saida.append(h('article', { class: 'mig-prazo estado-' + i.estado }, h('div', { class: 'ico', 'aria-hidden': 'true' }, { ok: '✅', atencao: '⏳', vencido: '⛔' }[i.estado]), h('div', { class: 'tx' }, h('h3', null, i.rotulo, i.porUF ? h('small', null, ' · regra do seu estado (' + i.horas + ' h)') : null), h('p', { class: 'ate' }, (i.tipo === 'bloqueio' ? 'limite antes do bloqueio: ' : 'até ') + L.formatarData(i.ate) + ' — ', h('b', null, L.formatarRestante(i.restanteMs))))))); };
        [doc, quando, uf].forEach(c => c.addEventListener('input', calc)); calc();
        return h('div', { class: 'mig-prazos' }, h('div', { class: 'mig-aviso-legal' }, h('b', null, '⚖️ Conferido em ' + dataCurta(E.G.revisadoEm) + '. '), E.G.aviso), lista,
            h('h4', { class: 'mig-sub-titulo' }, 'Até quando posso cancelar?'), h('div', { class: 'mig-form-linha' }, h('label', { class: 'mig-mini-campo' }, h('span', null, 'Documento'), doc), h('label', { class: 'mig-mini-campo largo' }, h('span', null, 'Autorizado em'), quando), h('label', { class: 'mig-mini-campo' }, h('span', null, 'UF do emitente'), uf)), saida);
    }
    // os erros mais comuns do passo: o botão abre o artigo do banco na hora (sem IA); se não achar, pergunta à IA no modo erro
    // Os artigos do banco são escritos para o Suporte e alguns ensinam a mexer em talão, certificado ou regras: o cliente só emite
    const avisoSoEmite = () => h('p', { class: 'mig-so-emite', role: 'note' }, 'ℹ️ Mexer em talão, certificado, regras de cálculo ou tabelas é com o Suporte. Se o artigo abaixo pedir isso, não faça: fale com o Suporte (Opções do Sistema > Suporte), levando o código e a mensagem do erro.');
    function abrirErro(e) {
        const doc = E.ix.banco ? (L.buscar(E.ix.banco, e.q, { max: 1, minCobertura: 0.3 })[0] || L.buscar(E.ix.rapida, e.q, { max: 1, minCobertura: 0.3 })[0]) : null;
        if (!doc) { abrirChatSeCelular(); enviar(e.t, { modoErro: true }); return; }
        E.abrirDialogo({ titulo: e.t, largo: true, corpo: h('div', null, avisoSoEmite(), E.cartaoConhecimento(doc.doc, { aberto: true })), botoes: [{ rotulo: 'Fechar', valor: false }, { rotulo: '🧠 Não resolveu? Perguntar à IA', classe: 'primario', valor: 'ia' }] }).then(v => { if (v === 'ia') { abrirChatSeCelular(); enviar(e.t, { modoErro: true }); } });
    }
    function cartaoPasso() {
        const p = passoAtual(), c = $('passoCard'); E.limpar(c);
        if (!p) { c.append(h('p', null, 'Nenhum passo para as suas respostas. Mude as respostas para ver o passo a passo.')); return; }
        const perfil = E.atual.perfil;
        c.append(h('header', { class: 'mig-passo-cab2' }, h('h2', null, p.titulo), h('span', { class: 'mig-passo-meta' }, p.tempo && p.tempo !== '—' ? h('span', { class: 'mig-tag suave' }, '⏱ ' + p.tempo) : null, p.nivel === 'obrigatorio' ? h('span', { class: 'mig-tag nivel-obrigatorio' }, 'Necessário') : null)), h('p', { class: 'mig-passo-resumo2' }, p.resumo));
        L.alertasDoPasso(p, perfil).forEach(a => c.append(h('div', { class: 'mig-' + a.tipo, role: 'note' }, h('b', null, a.tipo === 'aviso' ? '⚠️ Atenção: ' : '💡 Dica: '), a.texto)));
        if (p.video && p.video.length) { const vs = p.video.map(k => (E.R.videos || {})[k]).filter(Boolean).map(v => ({ titulo: v.titulo, url: v.url })), b = E.blocoVideos(vs); if (b) c.append(secao('🎬 Vídeo tutorial — assista se preferir', b)); }
        if (p.dinamico === 'numeracao') c.append(blocoNumeracao());
        if (p.precisa && p.precisa.length) c.append(secao('Tenha em mãos', h('ul', { class: 'mig-lista' }, p.precisa.map(t => h('li', null, t)))));
        const cam = E.blocoCaminhos(p.onde); if (cam) c.append(secao('Onde fica no Bsoft', cam));
        if (p.como && p.como.length) c.append(secao('Passo a passo', h('ol', { class: 'mig-como-fazer' }, p.como.map(t => h('li', null, t)))));
        if (p.cuidados && p.cuidados.length) c.append(secao('Cuidado', h('ul', { class: 'mig-cuidados' }, p.cuidados.map(t => h('li', null, t)))));
        if (p.dinamico === 'prazos') c.append(secao('Prazos que você precisa conhecer', blocoPrazos()));
        if (p.erros && p.erros.length) c.append(secao('Deu erro? Veja os mais comuns aqui', h('div', { class: 'mig-chips' }, p.erros.map(e => h('button', { type: 'button', class: 'mig-chip', onclick: () => abrirErro(e) }, '🚑 ' + e.t)))));
    }
    function stepper() {
        const lista = passos(), atual = idx(), feitos = lista.filter(p => E.estadoDoPasso(p.id) === 'feito').length;
        return h('div', { class: 'mig-progresso' },
            h('div', { class: 'mig-progresso-topo' }, h('b', null, 'Passo ' + (atual + 1) + ' de ' + lista.length), h('small', null, feitos + ' concluído(s)')),
            h('span', { class: 'mig-barra', role: 'img', 'aria-label': 'Passo ' + (atual + 1) + ' de ' + lista.length }, h('i', { style: 'width:' + Math.round(100 * (atual + 1) / Math.max(1, lista.length)) + '%' })),
            h('ol', { class: 'mig-stepper' }, lista.map((p, i) => h('li', null, h('button', { type: 'button', class: 'mig-step' + (i === atual ? ' atual' : '') + (E.estadoDoPasso(p.id) === 'feito' ? ' feito' : ''), title: p.titulo, 'aria-label': 'Ir para o passo ' + (i + 1) + ': ' + p.titulo, 'aria-current': i === atual ? 'step' : null, onclick: () => ir(i) }, E.estadoDoPasso(p.id) === 'feito' && i !== atual ? '✔' : String(i + 1))))));
    }
    function nav() {
        const lista = passos(), atual = idx(), ultimo = atual >= lista.length - 1;
        return h('div', { class: 'mig-nav' }, h('button', { type: 'button', class: 'mig-btn grande', disabled: atual === 0, onclick: () => ir(atual - 1) }, '← Anterior'), h('button', { type: 'button', class: 'mig-btn primario grande', onclick: () => { E.mudarStatus(lista[atual].id, 'feito'); if (ultimo) concluir(); else ir(atual + 1); } }, ultimo ? 'Concluir ✓' : 'Próximo →'));
    }
    function ir(i) { const lista = passos(); if (!lista.length) return; E.atual.passoIdx = Math.max(0, Math.min(lista.length - 1, i)); E.atual.atualizadoEm = Date.now(); E.salvar(); desenharPassos(); window.scrollTo({ top: 0 }); }
    function concluir() {
        const c = $('colunaPasso'); E.limpar(c);
        c.append(h('section', { class: 'mig-cartao mig-fim' }, h('h2', null, '🎉 Passo a passo concluído!'), h('p', { class: 'mig-sub' }, 'Você passou por todos os passos da sua primeira emissão. Guarde o XML dos documentos e lembre dos prazos para cancelar e encerrar.'),
            h('div', { class: 'mig-acoes' }, h('button', { type: 'button', class: 'mig-btn primario', onclick: () => ir(0) }, 'Rever o passo a passo'), h('button', { type: 'button', class: 'mig-btn', onclick: () => abrirChat() }, '💬 Tirar uma dúvida com a IA')), suporteCard()));
        window.scrollTo({ top: 0 });
    }
    function suporteCard() {
        const box = h('div', { class: 'mig-suporte' });
        const r = E.ix.banco ? L.buscar(E.ix.banco, 'como entrar em contato com a BSOFT TMS', { max: 1, minCobertura: 0.6 })[0] : null;
        box.append(h('h3', null, 'Precisa falar com uma pessoa?'), h('p', { class: 'mig-sub' }, 'No sistema, abra Opções do Sistema > Suporte: ticket, telefone, chat e acesso remoto.'));
        if (r) box.append(E.cartaoConhecimento(r.doc));
        return box;
    }
    function desenharPassos() {
        const col = $('colunaPasso'); E.limpar(col);
        if (!passos().length) { col.append(h('section', { class: 'mig-cartao' }, h('p', null, 'Nenhum passo para as suas respostas.'), h('button', { type: 'button', class: 'mig-btn primario', onclick: () => mostrarForm(true) }, 'Mudar as respostas'))); return; }
        const card = h('article', { class: 'mig-cartao mig-passo-card', id: 'passoCard', 'aria-live': 'polite' });
        col.append(stepper(), card, nav(), h('p', { class: 'mig-rodape-passos' }, h('button', { type: 'button', class: 'mig-link', onclick: () => mostrarForm(true) }, 'Mudar minhas respostas'), ' · ', h('button', { type: 'button', class: 'mig-link', onclick: recomecar }, 'Recomeçar do zero')));
        cartaoPasso(); desenharChat();
    }
    async function recomecar() {
        if (!(await E.confirmar('Recomeçar do zero? O progresso e a conversa com a IA deste computador serão apagados.', { sim: 'Recomeçar', perigo: true }))) return;
        E.excluirCliente();
        modoErro = false; ocupado = false; ficha++; ultimaPergunta = null; mostrarForm(false);
    }
    function mostrarPassos() {
        if (!E.atual) { mostrarForm(false); return; }
        $('telaInicio').hidden = true; $('telaPassos').hidden = false; $('btnRecomecar').hidden = false; $('btnChatCelular').hidden = false;
        desenharPassos();
    }

    /* ═════════ 3) o chat, no mesmo lugar do passo ═════════ */
    const horaCurta = ts => L.formatarData(new Date(ts)).slice(11);
    function dialogoRegra(r) {
        E.abrirDialogo({ titulo: r.titulo, corpo: h('div', null, h('p', { class: 'mig-regra-texto' }, r.regra), r.prazo ? h('p', null, h('b', null, 'Prazo: '), r.prazo) : null, h('ul', { class: 'mig-detalhe' }, (r.detalhe || []).map(d => h('li', null, d))),
            r.seNaoCumprir ? h('div', { class: 'mig-dica' }, h('b', null, 'E se passar do prazo? '), r.seNaoCumprir) : null, r.varia ? h('div', { class: 'mig-aviso' }, h('b', null, 'Pode variar: '), r.varia) : null, h('p', { class: 'mig-ajuda' }, 'Conferida em ' + dataCurta(r.conferidoEm) + ' — confirme com o seu contador.')), botoes: [{ rotulo: 'Fechar', valor: true }] });
    }
    function fonteChip(f) {
        const tipo = f.chave.split(':')[0], ico = tipo === 'video' ? '' : ({ banco: '📚', rapida: '✅', faq: '❓', regra: '⏱️' }[tipo] || '📄');   // (o título do vídeo já começa com 🎬)
        return h('button', { type: 'button', class: 'mig-chip fonte ' + tipo, onclick: () => {
            if (tipo === 'regra') { const r = E.G.regras.find(x => x.id === f.chave.slice(6)); if (r) dialogoRegra(r); return; }
            if (tipo === 'video') { const v = (E.R.videos || {})[f.chave.slice(6)]; if (v) E.abrirDialogo({ titulo: v.titulo, largo: true, corpo: E.blocoVideos([{ titulo: v.titulo, url: v.url }]), botoes: [{ rotulo: 'Fechar', valor: true }] }); return; }
            const doc = E.docs.get(f.chave); if (!doc) return E.toast('Esse conteúdo não está mais na base carregada.');
            E.abrirDialogo({ titulo: f.titulo, largo: true, corpo: h('div', null, avisoSoEmite(), E.cartaoConhecimento(doc, { aberto: true })), botoes: [{ rotulo: 'Fechar', valor: true }] });
        } }, (ico ? ico + ' ' : '') + f.titulo);
    }
    // "Baseado em": os 6 primeiros (vídeo, regras, artigos…, nessa ordem de utilidade para o cliente); o resto aparece ao clicar em "+N" — a lista inteira deixava a resposta enorme
    const PRIORIDADE_FONTE = { video: 0, regra: 1, banco: 2, rapida: 3, faq: 4 };
    function chipsDeFontes(fontes, max) {
        max = max || 6;
        const ord = fontes.map((f, i) => [f, i]).sort((a, b) => ((PRIORIDADE_FONTE[a[0].chave.split(':')[0]] ?? 9) - (PRIORIDADE_FONTE[b[0].chave.split(':')[0]] ?? 9)) || (a[1] - b[1])).map(x => x[0]);
        const caixa = h('div', { class: 'mig-fontes-chips' }, h('small', null, 'Baseado em: '), ord.slice(0, max).map(fonteChip));
        if (ord.length > max) caixa.append(h('button', { type: 'button', class: 'mig-mini', onclick: ev => { ev.currentTarget.remove(); ord.slice(max).forEach(f => caixa.append(fonteChip(f))); } }, '+' + (ord.length - max) + ' fontes'));
        return caixa;
    }
    function balao(m) {
        if (m.papel === 'voce') return h('div', { class: 'mig-msg voce' }, h('div', { class: 'mig-balao' }, h('p', null, m.texto)), h('small', { class: 'mig-hora' }, horaCurta(m.em)));
        return h('div', { class: 'mig-msg ia' }, h('div', { class: 'mig-balao' }, E.md(m.texto), h('div', { class: 'mig-acoes pequeno' }, h('button', { type: 'button', class: 'mig-mini', onclick: () => E.copiar(m.texto, 'Resposta copiada.') }, '📋 Copiar')),
            m.fontes && m.fontes.length ? chipsDeFontes(m.fontes) : null), h('small', { class: 'mig-hora' }, horaCurta(m.em)));
    }
    function digitando() {
        statusEl = h('span', { class: 'mig-digitando-tx' }, 'Buscando no banco de dados…');
        return h('div', { class: 'mig-msg ia digitando', role: 'status' }, h('div', { class: 'mig-balao' }, h('span', { class: 'mig-pontos', 'aria-hidden': 'true' }, h('i'), h('i'), h('i')), statusEl, h('button', { type: 'button', class: 'mig-mini', onclick: cancelar }, 'cancelar')));
    }
    // Cancelar: a pergunta sai da conversa (ficaria pendurada sem resposta) e o texto volta para o campo, para a pessoa editar e enviar de novo; resposta que chegar depois é ignorada (ficha)
    function cancelar() {
        ficha++; ocupado = false; clearInterval(relogio); relogio = null;
        const c = E.atual, ult = c && c.mentor[c.mentor.length - 1], env = ultimoEnvio;
        if (ult && ult.papel === 'voce') c.mentor.pop();
        if (env && env.erro) modoErro = true;
        desenharChat();
        const campo = $('chatCampo'); if (campo && env) { campo.value = env.texto; campo.focus(); }
        E.toast('Pergunta cancelada. O texto voltou para o campo.');
    }
    function erroBalao() {
        const e = ultimaPergunta;
        return h('div', { class: 'mig-msg ia erro', role: 'alert' }, h('div', { class: 'mig-balao' }, h('p', null, h('b', null, '⚠️ A IA não respondeu agora. '), 'Os modelos estão lentos ou indisponíveis. Tente de novo em instantes.'),
            e.fontes && e.fontes.length ? h('div', { class: 'mig-fontes-chips' }, h('small', null, 'Enquanto isso, veja o que o banco de dados tem sobre o assunto: '), e.fontes.map(fonteChip)) : null,
            h('div', { class: 'mig-acoes pequeno' }, h('button', { type: 'button', class: 'mig-btn pequeno primario', onclick: () => { const q = e.texto, er = e.modoErro; E.atual.mentor.pop(); ultimaPergunta = null; enviar(q, { modoErro: er }); } }, '🔁 Tentar de novo'))));
    }
    function sugestoes() {
        const p = passoAtual(), lista = [];
        if (p) lista.push(p.mentor);
        (E.R.sugestoes.geral || []).forEach(s => lista.push(s));
        return Array.from(new Set(lista)).slice(0, 4);
    }
    function desenharChat() {
        const col = $('colunaChat'); if (!col) return; const antes = $('chatLista'), noFim = !antes || antes.scrollHeight - antes.scrollTop - antes.clientHeight < 80;
        E.limpar(col);
        const c = E.atual, p = passoAtual();
        const lista = h('div', { class: 'mig-chat', id: 'chatLista', role: 'log', 'aria-live': 'polite', 'aria-label': 'Conversa com a IA', tabindex: '0' });
        if (!c.mentor.length) lista.append(h('div', { class: 'mig-chat-vazio' }, h('p', null, '👋 Olá! Estou aqui junto com você. Pergunte qualquer coisa sobre este passo ou cole a mensagem de erro se algo não funcionar.'), h('p', { class: 'mig-ajuda' }, 'Respondo com base no banco de dados do Suporte Bsoft. Se não souber, eu digo.')));
        c.mentor.forEach(m => lista.append(balao(m)));
        if (ocupado) lista.append(digitando());
        if (ultimaPergunta && !ocupado) lista.append(erroBalao());
        const sug = h('div', { class: 'mig-sugestoes' }, h('button', { type: 'button', class: 'mig-chip erro' + (modoErro ? ' ativo' : ''), 'aria-pressed': String(modoErro), disabled: ocupado, onclick: () => { modoErro = !modoErro; desenharChat(); } }, '🚑 Deu erro'), sugestoes().map(s => h('button', { type: 'button', class: 'mig-chip', disabled: ocupado, onclick: () => enviar(s) }, s)));
        const campo = h('textarea', { id: 'chatCampo', rows: '2', maxlength: '1200', 'aria-label': modoErro ? 'Cole a mensagem de erro' : 'Sua pergunta', placeholder: modoErro ? 'Cole aqui a mensagem de erro ou a rejeição (código e texto)…' : 'Escreva a sua dúvida… (Enter envia · Shift+Enter quebra a linha)', disabled: ocupado });
        const form = h('form', { class: 'mig-compor', onsubmit: ev => { ev.preventDefault(); const t = campo.value; campo.value = ''; enviar(t); } }, campo, h('button', { type: 'submit', class: 'mig-btn primario', disabled: ocupado }, 'Enviar'));
        campo.addEventListener('keydown', ev => { if (ev.key === 'Enter' && !ev.shiftKey && !ev.isComposing) { ev.preventDefault(); form.requestSubmit(); } });
        juntar(col, h('header', { class: 'mig-chat-cab' }, h('h2', null, '💬 Tire dúvidas com a IA'), p ? h('small', null, 'Você está em: ' + p.titulo) : null, h('button', { type: 'button', class: 'mig-x mig-so-celular', 'aria-label': 'Fechar o chat', onclick: () => { chatAberto = false; aplicarChat(); } }, '✕')),
            lista, sug, modoErro ? h('p', { class: 'mig-ajuda modo-erro' }, '🚑 Modo erro: cole a mensagem exata. Eu mostro a causa, como corrigir e o que fazer depois.') : null, form,
            h('div', { class: 'mig-chat-rodape' }, h('small', { class: 'mig-ajuda' }, '🔒 CNPJ, CPF, telefone e e-mail são omitidos antes de ir para a IA.'), c.mentor.length ? h('button', { type: 'button', class: 'mig-link', onclick: limparConversa }, 'Limpar conversa') : null));
        if (noFim) lista.scrollTop = lista.scrollHeight;
    }
    async function limparConversa() { if (!(await E.confirmar('Apagar a conversa com a IA deste computador?', { sim: 'Apagar', perigo: true }))) return; E.atual.mentor = []; ultimaPergunta = null; E.salvar(); desenharChat(); }
    function aplicarChat() { const g = $('gradePassos'); if (g) g.classList.toggle('chat-aberto', chatAberto); const b = $('btnChatCelular'); if (b) b.setAttribute('aria-expanded', String(chatAberto)); }
    function abrirChat() { chatAberto = true; aplicarChat(); setTimeout(() => { const f = $('chatCampo'); if (f) f.focus({ preventScroll: false }); }, 50); }
    const abrirChatSeCelular = () => { if (window.matchMedia('(max-width: 980px)').matches) abrirChat(); };

    async function enviar(texto, o) {
        o = o || {};
        texto = String(texto || '').trim().slice(0, 1200);
        if (!texto || ocupado || !E.atual) return;
        const c = E.atual, p = passoAtual(), erro = o.modoErro != null ? o.modoErro : modoErro, minha = ++ficha;
        if (L.anonimizar(texto) !== texto) E.toast('Omiti CNPJ, CPF, telefone ou e-mail antes de enviar para a IA.', 5000);
        const pergunta = erro ? L.montarPedidoErro({ doc: p ? (DOC_DO_PASSO[p.id] || p.titulo) : '', mensagem: texto }) : texto;
        const historico = c.mentor.slice();
        c.mentor.push({ papel: 'voce', texto: erro ? '🚑 Erro: ' + texto : texto, em: Date.now(), fontes: [] });
        ultimoEnvio = { texto, erro }; ultimaPergunta = null; ocupado = true; modoErro = false; const t0 = Date.now(); desenharChat();
        clearInterval(relogio); relogio = setInterval(() => { if (statusEl && statusEl.isConnected) statusEl.textContent = (statusEl.dataset.base || 'Buscando no banco de dados…') + ' ' + Math.round((Date.now() - t0) / 1000) + ' s'; }, 1000);
        const r = await MigIA.perguntar(E, { pergunta, historico, passo: p, modo: erro ? 'erro' : '', aoTentar: (m, t) => { if (statusEl) { statusEl.dataset.base = 'Consultando a IA' + (t > 1 ? ' (2ª tentativa)' : '') + '…'; statusEl.textContent = statusEl.dataset.base; } } });
        if (minha !== ficha) return;
        clearInterval(relogio); relogio = null; ocupado = false;
        if (r.erro) ultimaPergunta = { texto, modoErro: erro, fontes: r.fontes.slice(0, 5).map(f => ({ chave: f.chave, titulo: f.titulo })) };
        else {
            const fontes = r.fontes.map(f => ({ chave: f.chave, titulo: f.titulo })).concat(r.regras.map(g => ({ chave: 'regra:' + g.id, titulo: g.titulo })));
            c.mentor.push({ papel: 'ia', texto: r.texto, em: Date.now(), fontes, modelo: r.modelo });
            if (c.mentor.length > L.LIMITES.mentor) c.mentor.splice(0, c.mentor.length - L.LIMITES.mentor);
            c.atualizadoEm = Date.now(); E.salvar();
        }
        desenharChat();
    }

    let ligado = false;
    function iniciarTela() {
        if (!ligado) {
            ligado = true;
            $('btnRecomecar').addEventListener('click', recomecar);
            $('btnChatCelular').addEventListener('click', () => { chatAberto = !chatAberto; aplicarChat(); if (chatAberto) abrirChat(); });
        }
        if (E.atual) mostrarPassos(); else mostrarForm(false);
    }
    E.on('dados-prontos', () => { if (E.atual && !$('telaPassos').hidden && passoAtual() && passoAtual().id === 'depois') cartaoPasso(); });
    E.iniciarTela = iniciarTela; E.chatEnviar = enviar; E.irPasso = ir; E.mostrarForm = mostrarForm; E.mostrarPassos = mostrarPassos;
    E.fonteChip = fonteChip;      // (a migracaolocal.html mostra as fontes já enquanto a IA local escreve)
})();
