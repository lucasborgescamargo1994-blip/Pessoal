/* admin/js/aba-novidades.js — Aba "Novidades": publica avisos/novidades que aparecem para todos os usuários (coluna "Novidades" do sistema). */
(function () {
    'use strict';
    const TIPOS = { update: ['✅ Atualização', 'ok'], new: ['🆕 Novidade', 'pr'], warning: ['⚠️ Aviso', 'wa'], info: ['ℹ️ Informação', 'in'] };
    const E = { itens: [], erro: null, carregando: false, jaCarregou: false };
    const R = {};

    async function carregar() {
        E.carregando = true; E.erro = null; renderLista();
        try {
            const { data, error } = await ADM.sb.from('suporte_novidades').select('id, tipo, titulo, conteudo, created_at').order('created_at', { ascending: false }).limit(200);
            if (error) throw error; E.itens = data || [];
        } catch (e) { E.erro = e; }
        E.carregando = false; E.jaCarregou = true; renderLista();
    }

    function cartaoNovidade(it) {
        const t = TIPOS[it.tipo] || TIPOS.info;
        return h('div', { class: 'cartao' }, h('div', { class: 'cartao-corpo', style: { gap: '8px' } },
            h('div', { class: 'linha', style: { gap: '8px' } }, h('span', { class: 'sel ' + t[1] }, t[0]), h('span', { class: 'mu', style: { fontSize: '12px' } }, ADM.fmt.dataHora(it.created_at)), h('span', { class: 'grow' }),
                h('button', { class: 'btn peq', type: 'button', onclick: () => abrirEdicao(it) }, I('edit', 13), 'Editar'),
                h('button', { class: 'btn peq fantasma perigo', type: 'button', 'aria-label': 'Excluir', title: 'Excluir', onclick: () => excluir(it) }, I('trash', 13))),
            h('div', { style: { fontWeight: 800, fontSize: '15px', wordBreak: 'break-word' } }, it.titulo),
            h('div', { style: { whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: 'var(--ad-mu)' } }, it.conteudo)));
    }
    function renderLista() {
        const box = limpar(R.lista);
        if (E.erro) { box.appendChild(ADM.ui.aviso('er', h('b', null, 'Não consegui carregar as novidades.'), h('br'), ADM.db.erroTexto(E.erro))); return; }
        if (E.carregando && !E.itens.length) { box.appendChild(h('div', { class: 'vazio' }, 'Carregando…')); return; }
        if (!E.itens.length) { box.appendChild(ADM.ui.vazio('🔔', 'Nenhuma novidade publicada', 'Use o formulário ao lado para publicar a primeira.')); return; }
        E.itens.forEach(it => box.appendChild(cartaoNovidade(it)));
    }

    function campos(valor) {
        const tipo = h('select', { 'aria-label': 'Tipo' }, Object.keys(TIPOS).map(k => h('option', { value: k }, TIPOS[k][0]))); tipo.value = valor.tipo || 'update';
        const titulo = h('input', { type: 'text', maxlength: 120, placeholder: 'Título curto' }); titulo.value = valor.titulo || '';
        const conteudo = h('textarea', { rows: 6, placeholder: 'Conteúdo da novidade (texto simples; as quebras de linha são mantidas)' }); conteudo.value = valor.conteudo || '';
        return { tipo, titulo, conteudo, ler: () => ({ tipo: tipo.value, titulo: titulo.value.trim(), conteudo: conteudo.value.trim() }) };
    }

    async function publicar(f, btn) {
        const v = f.ler();
        if (!v.titulo || !v.conteudo) { ADM.ui.toast('Preencha o título e o conteúdo.', 'wa'); return; }
        await ADM.ui.ocupado(btn, async () => {
            try {
                const r = await ADM.sb.from('suporte_novidades').insert(v).select('id, tipo, titulo, conteudo, created_at'); ADM.db.exigirAfetadas(r);
                E.itens.unshift(r.data[0]); f.titulo.value = ''; f.conteudo.value = ''; renderLista();
                ADM.ui.toast('Publicado! Quem estiver com o sistema aberto já recebe agora.', 'ok');
            } catch (e) { ADM.ui.toast(ADM.db.erroTexto(e), 'er', 9000); }
        });
    }
    function abrirEdicao(it) {
        const f = campos(it);
        ADM.ui.modal({ titulo: 'Editar novidade', largura: 560, fecharFora: false,
            corpo: [h('label', { class: 'campo' }, h('span', { class: 'rot' }, 'Tipo'), f.tipo), h('label', { class: 'campo' }, h('span', { class: 'rot' }, 'Título'), f.titulo), h('label', { class: 'campo' }, h('span', { class: 'rot' }, 'Conteúdo'), f.conteudo),
                h('div', { class: 'dica' }, 'Quem já está com o sistema aberto vê a versão editada só ao recarregar.')],
            botoes: [{ rotulo: 'Cancelar', tipo: 'fantasma' }, { rotulo: 'Salvar', tipo: 'primario', fechar: false, acao: async (btn, api) => {
                const v = f.ler(); if (!v.titulo || !v.conteudo) { ADM.ui.toast('Preencha o título e o conteúdo.', 'wa'); return false; }
                const r = await ADM.sb.from('suporte_novidades').update(v).eq('id', it.id).select('id'); ADM.db.exigirAfetadas(r);
                Object.assign(it, v); renderLista(); ADM.ui.toast('Novidade atualizada.', 'ok'); api.fechar();
            } }] });
    }
    async function excluir(it) {
        if (!(await ADM.ui.confirmar(`Remover a novidade “${ADM.fmt.trunc(it.titulo, 80)}”?`, { titulo: 'Remover novidade', rotuloOk: 'Remover', perigo: true, detalhe: 'Ela some na hora para todos os usuários.' }))) return;
        try { const r = await ADM.sb.from('suporte_novidades').delete().eq('id', it.id).select('id'); ADM.db.exigirAfetadas(r); E.itens = E.itens.filter(x => x.id !== it.id); renderLista(); ADM.ui.toast('Removida.', 'ok', 2500); }
        catch (e) { ADM.ui.toast(ADM.db.erroTexto(e), 'er', 9000); }
    }

    ADM.registrarAba({
        id: 'novidades', titulo: 'Novidades', icone: 'megaphone', ordem: 70,
        descricao: 'Avisos e novidades que aparecem para todos os usuários na coluna “Novidades” do sistema (e como notificação, se a aba estiver em segundo plano).',
        montar(ctx) {
            const f = campos({});
            const previa = h('div'), atualizarPrevia = () => { const v = f.ler(); limpar(previa).appendChild(cartaoNovidade({ id: 0, tipo: v.tipo, titulo: v.titulo || 'Título da novidade', conteudo: v.conteudo || 'O conteúdo aparece aqui.', created_at: new Date().toISOString() })); previa.querySelectorAll('button').forEach(b => { b.disabled = true; b.style.visibility = 'hidden'; }); };
            [f.tipo, f.titulo, f.conteudo].forEach(c => c.addEventListener('input', atualizarPrevia)); f.tipo.addEventListener('change', atualizarPrevia); atualizarPrevia();
            R.lista = h('div', { class: 'pilha', style: { gap: '10px' } });
            const btnPub = h('button', { class: 'btn primario', type: 'button', onclick: e => publicar(f, e.currentTarget) }, I('megaphone', 16), 'Publicar');
            ctx.corpo.appendChild(h('div', { class: 'mcp-grade' },
                h('div', { class: 'pilha' }, h('h3', { style: { fontSize: '15px' } }, 'Publicadas'), R.lista),
                h('div', { class: 'pilha' }, h('div', { class: 'cartao' }, h('div', { class: 'cartao-topo' }, h('h3', null, I('plus', 16), 'Nova novidade')),
                    h('div', { class: 'cartao-corpo' }, h('label', { class: 'campo' }, h('span', { class: 'rot' }, 'Tipo'), f.tipo), h('label', { class: 'campo' }, h('span', { class: 'rot' }, 'Título'), f.titulo),
                        h('label', { class: 'campo' }, h('span', { class: 'rot' }, 'Conteúdo'), f.conteudo), h('div', { class: 'campo' }, h('span', { class: 'rot' }, 'Como vai aparecer'), previa), h('div', { class: 'linha' }, btnPub))))));
            ctx.barra.append(h('button', { class: 'btn icone', type: 'button', title: 'Recarregar', 'aria-label': 'Recarregar', onclick: carregar }, I('refresh', 17)));
        },
        abrir() { if (!E.jaCarregou) carregar(); },
    });
})();
