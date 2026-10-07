/* admin/js/aba-revisao.js — Aba "Revisão": confere as respostas que a IA deu e decide o destino de cada uma.
   Fluxo:  usuário pergunta → o sistema grava pergunta + resposta no log (revisao = 'pendente') → aqui você escolhe:
           • aprovar → vira uma linha em respostas_rapidas → perguntas parecidas passam a receber a resposta pronta (revisao = 'aprovada');
           • salvar no banco de dados → vira um artigo da base de conhecimento (BancoDados) que a IA consulta (revisao = 'banco');
           • rejeitar / ignorar. */
(function () {
    'use strict';
    const TAM = 40;   // logs por página
    const COLS = 'id, pergunta, resposta, fonte, modelo, feedback, motivo, usuario_windows, timestamp, created_at, revisao, revisao_nota, revisado_em, revisado_por, resposta_rapida_id';
    const ESTADOS = [['pendente', 'Pendentes'], ['aprovada', 'Aprovadas (resposta rápida)'], ['banco', 'Salvas no banco de dados'], ['rejeitada', 'Rejeitadas'], ['ignorada', 'Ignoradas'], ['nao_se_aplica', 'Vindas de resposta rápida'], ['todas', 'Todas']];
    const ROTULO_REV = { banco: 'no banco de dados', nao_se_aplica: 'vinda de resposta rápida' };
    const CLASSE_REV = { aprovada: 'ok', banco: 'ok', rejeitada: 'er' };
    const rotuloRev = v => ROTULO_REV[v] || v;
    const E = { filtro: { revisao: 'pendente', fonte: '', feedback: '', texto: '' }, linhas: [], grupos: [], selChave: null, idxResp: 0, fim: false, carregando: false, erro: null, form: null, jaCarregou: false, salvando: false };
    const R = {};   // referências de tela

    const pesoFb = l => l.feedback === 'Positivo' ? 2 : l.feedback === 'Negativo' ? 0 : 1;
    const modeloCurto = m => String(m || '').split('/').pop().replace(/:free$/, '');
    const unicas = lista => { const v = new Set(), out = []; lista.forEach(x => { const k = RRMatch.preparar(x).norm; if (k && !v.has(k)) { v.add(k); out.push(x); } }); return out; };

    /* ───────────── pendências (selo da aba) ───────────── */
    ADM.atualizarPendentes = async function () {
        try {
            const n = await ADM.db.contar('logs', q => q.eq('revisao', 'pendente').not('resposta', 'is', null));
            ADM.badgeAba('revisao', n);
            return n;
        } catch (e) { ADM.badgeAba('revisao', 0); return null; }   // coluna ainda não existe (SQL 02 não rodado): sem selo
    };

    /* ───────────── artigos que já estão no banco de dados (só id, título e categoria) ─────────────
       serve para avisar de duplicidade antes de salvar e para sugerir as categorias que o banco de dados já usa */
    const BD = { itens: null, quando: 0, promessa: null };
    function carregarBD(forcar) {
        if (BD.promessa) return BD.promessa;
        if (!forcar && BD.itens && Date.now() - BD.quando < 5 * 60 * 1000) return Promise.resolve(BD.itens);
        BD.promessa = ADM.db.todas((de, ate) => ADM.sb.from('BancoDados').select('id, titulo, categoria').order('id', { ascending: true }).range(de, ate))
            .then(itens => { BD.itens = itens; BD.quando = Date.now(); sugerirCategorias(); return itens; })
            .finally(() => { BD.promessa = null; });
        return BD.promessa;
    }
    function categoriasSugeridas() {
        const visto = new Set(), saida = [];
        ADM.categoriasRR().concat((BD.itens || []).map(a => a.categoria)).forEach(c => {
            c = String(c || '').trim();
            const k = c.toLowerCase();
            if (c && !visto.has(k)) { visto.add(k); saida.push(c); }
        });
        return saida.sort((a, b) => a.localeCompare(b, 'pt-BR'));
    }
    function sugerirCategorias() {
        const dl = document.getElementById('dlCatRev');
        if (dl) limpar(dl).append(...categoriasSugeridas().map(c => h('option', { value: c })));
    }
    // artigo do banco de dados com título muito parecido (mesma régua de "parecida" das respostas rápidas); null se não há ou se não deu para checar
    async function artigoParecido(titulo) {
        try {
            const itens = (await carregarBD(true)).map(a => ({ id: a.id, pergunta: a.titulo || '' }));
            const achado = RRMatch.ranking(titulo, itens, 0.8).find(x => x.numerosOk);
            return achado ? { id: achado.item.id, titulo: achado.item.pergunta, lex: achado.lex } : null;
        } catch (e) { return null; }   // é só um aviso: se a checagem falhar, a gravação segue e o erro de verdade (se houver) aparece nela
    }
    const idDoBanco = l => { const m = /#(\d+)/.exec((l && l.revisao_nota) || ''); return m ? m[1] : null; };   // o log guarda "Salvo no banco de dados (#123)"

    /* ───────────── dados ───────────── */
    // perguntas com os mesmos termos (já com sinônimos aplicados: "CT-e" = "cte") e os mesmos números são "a mesma pergunta" — é assim que o sistema as compara
    const chaveGrupo = p => p.termos.length ? p.termos.slice().sort().join('|') + '#' + p.numeros : p.norm;
    function agrupar() {
        const mapa = new Map();
        E.linhas.forEach(l => {
            l._prep = l._prep || RRMatch.preparar(l.pergunta);
            const k = chaveGrupo(l._prep) || ('#' + l.id);
            if (!mapa.has(k)) mapa.set(k, { chave: k, itens: [], rep: l, item: { pergunta: l.pergunta } });
            mapa.get(k).itens.push(l);
        });
        E.grupos = Array.from(mapa.values());
        E.grupos.forEach(g => { g.itens.sort((a, b) => pesoFb(b) - pesoFb(a) || new Date(b.created_at) - new Date(a.created_at)); g.rep = g.itens[0]; });
    }
    const grupoSel = () => E.grupos.find(g => g.chave === E.selChave) || null;

    async function carregar(reiniciar) {
        if (E.carregando) return;
        E.carregando = true;
        if (reiniciar) { E.linhas = []; E.grupos = []; E.fim = false; E.erro = null; }
        renderLista();
        try {
            const de = E.linhas.length, f = E.filtro;
            let q = ADM.sb.from('logs').select(COLS).not('resposta', 'is', null).order('created_at', { ascending: false }).range(de, de + TAM - 1);
            if (f.revisao !== 'todas') q = q.eq('revisao', f.revisao);
            if (f.fonte) q = q.eq('fonte', f.fonte);
            if (f.feedback) q = q.eq('feedback', f.feedback);
            const t = ADM.db.termoSeguro(f.texto); if (t) q = q.ilike('pergunta', '%' + t + '%');
            const { data, error } = await q;
            if (error) throw error;
            E.linhas = E.linhas.concat(data || []);
            if (!data || data.length < TAM) E.fim = true;
            agrupar();
        } catch (e) { E.erro = e; }
        E.carregando = false; E.jaCarregou = true;
        if (!grupoSel() && E.grupos.length && !E.erro) selecionar(E.grupos[0].chave, true);
        else { renderLista(); if (!E.grupos.length) renderDetalhe(); }
    }

    /* ───────────── lista ───────────── */
    function selFeedback(fb) { return fb === 'Positivo' ? h('span', { class: 'sel ok' }, '👍 Positivo') : fb === 'Negativo' ? h('span', { class: 'sel er' }, '👎 Negativo') : h('span', { class: 'sel' }, '⏳ sem avaliação'); }
    function selFonte(l) { return l.fonte === 'rapida' ? h('span', { class: 'sel pr' }, '⚡ resposta rápida') : h('span', { class: 'sel ml', title: l.modelo || '' }, '🤖 ' + (modeloCurto(l.modelo) || 'IA')); }

    function renderLista() {
        const box = limpar(R.lista);
        if (E.erro && !E.linhas.length) {
            const colunas = ADM.db.ehColunaAusente(E.erro) || ADM.db.ehTabelaAusente(E.erro);
            box.appendChild(ADM.ui.aviso(colunas ? 'wa' : 'er', h('b', null, colunas ? 'O banco ainda não tem as colunas da revisão.' : 'Não consegui carregar.'), h('br'),
                colunas ? 'Rode o arquivo sql/02_respostas_rapidas_e_revisao.sql uma vez no SQL Editor do Supabase (é seguro rodar de novo). Depois clique em Atualizar.' : ADM.db.erroTexto(E.erro),
                colunas ? h('div', { style: { marginTop: '8px' } }, ADM.ui.sqlAjuda('02_respostas_rapidas_e_revisao.sql')) : null));
            return;
        }
        if (!E.grupos.length && !E.carregando) {
            const pend = E.filtro.revisao === 'pendente';
            box.appendChild(ADM.ui.vazio(pend ? '🎉' : '🗂️', pend ? 'Nada para revisar' : 'Nenhum item com esses filtros',
                pend ? 'Quando alguém usar o sistema, as perguntas e respostas da IA aparecem aqui. (Se nada chega, confira se o SQL 02 foi rodado.)' : 'Mude o filtro de situação ou limpe a busca.'));
            return;
        }
        E.grupos.forEach(g => {
            const l = g.rep;
            const b = h('button', { type: 'button', class: 'item-lista' + (g.chave === E.selChave ? ' ativo' : ''), 'aria-pressed': g.chave === E.selChave ? 'true' : 'false' },
                h('div', { class: 'meta' }, selFonte(l), selFeedback(l.feedback), g.itens.length > 1 ? h('span', { class: 'sel in', title: 'Mesma pergunta feita ' + g.itens.length + ' vezes' }, '×' + g.itens.length) : null,
                    E.filtro.revisao === 'todas' && l.revisao ? h('span', { class: 'sel ' + (CLASSE_REV[l.revisao] || '') }, rotuloRev(l.revisao)) : null, h('span', { class: 'grow' }), h('span', null, ADM.fmt.relativo(l.created_at))),
                h('div', { class: 'q' }, l.pergunta || '(sem texto)'),
                h('div', { class: 'r' }, ADM.fmt.trunc(ADM.fmt.semMd(l.resposta), 170)));
            b.addEventListener('click', () => selecionar(g.chave));
            box.appendChild(b);
        });
        if (E.carregando) box.appendChild(h('div', { class: 'vazio' }, h('span', { class: 'girar', style: { display: 'inline-block' } }, I('refresh', 20)), ' Carregando…'));
        else if (!E.fim) box.appendChild(h('button', { class: 'btn', type: 'button', onclick: () => carregar(false) }, 'Carregar mais'));
        else box.appendChild(h('div', { class: 'rodape-tabela' }, `${E.linhas.length} resposta(s) · ${E.grupos.length} pergunta(s) distinta(s)`));
    }

    function selecionar(chave, semRolar) {
        E.selChave = chave; E.idxResp = 0; E.form = null;
        renderLista(); renderDetalhe();
        if (!semRolar && window.innerWidth <= 900) R.detalhe.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    /* ───────────── detalhe ───────────── */
    function iniciarForm(g, L) {
        E.form = { chave: g.chave, logId: L.id, pergunta: String(L.pergunta || '').trim(), variantes: '', categoria: '', incluirIguais: true, extras: new Set(), rrIdCriado: null };
    }

    function renderDetalhe() {
        const box = limpar(R.detalhe);
        const g = grupoSel();
        if (!g) { box.appendChild(ADM.ui.vazio('👈', 'Escolha uma pergunta na lista', 'Aqui você confere a resposta que a IA deu, ajusta o texto e aprova para virar uma resposta rápida.')); return; }
        const L = g.itens[E.idxResp] || g.itens[0];
        if (!E.form || E.form.chave !== g.chave || E.form.logId !== L.id) iniciarForm(g, L);
        const f = E.form;
        const pendente = !L.revisao || L.revisao === 'pendente';

        /* cabeçalho: a pergunta e de onde veio */
        const meta = h('div', { class: 'linha', style: { gap: '6px' } }, selFonte(L), selFeedback(L.feedback),
            h('span', { class: 'sel' }, '👤 ' + (L.usuario_windows || 'desconhecido')), h('span', { class: 'sel' }, '🕒 ' + ADM.fmt.dataHoraLog(L)),
            L.revisao && L.revisao !== 'pendente' ? h('span', { class: 'sel ' + (CLASSE_REV[L.revisao] || '') }, 'situação: ' + rotuloRev(L.revisao)) : null);
        const topo = h('div', { class: 'cartao' }, h('div', { class: 'cartao-corpo' },
            h('div', { class: 'mu', style: { fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em' } }, 'Pergunta do usuário'),
            h('div', { style: { fontSize: '17px', fontWeight: 700, wordBreak: 'break-word' } }, L.pergunta || '(sem texto)'),
            meta,
            L.motivo ? ADM.ui.aviso('wa', h('b', null, 'Motivo do 👎: '), L.motivo) : null,
            L.revisao_nota ? ADM.ui.aviso('in', h('b', null, 'Nota da revisão: '), L.revisao_nota, L.revisado_por ? h('span', { class: 'mu' }, ' — ' + L.revisado_por) : null) : null,
            g.itens.length > 1 ? h('div', { class: 'linha' },
                h('span', { class: 'sel in' }, `Esta pergunta apareceu ${g.itens.length} vezes — resposta ${E.idxResp + 1} de ${g.itens.length}`),
                h('button', { class: 'btn peq', type: 'button', disabled: E.idxResp === 0, onclick: () => { E.idxResp--; E.form = null; renderDetalhe(); } }, I('chevronL', 14), 'Anterior'),
                h('button', { class: 'btn peq', type: 'button', disabled: E.idxResp >= g.itens.length - 1, onclick: () => { E.idxResp++; E.form = null; renderDetalhe(); } }, 'Próxima', I('chevronR', 14)),
                h('span', { class: 'dica' }, 'As respostas com 👍 vêm primeiro. Escolha a melhor.')) : null));
        box.appendChild(topo);

        if (!pendente) { renderSomenteLeitura(box, g, L); return; }

        /* formulário (serve aos dois destinos: resposta rápida ou banco de dados) */
        const iPerg = h('input', { type: 'text', maxlength: 400 }); iPerg.value = f.pergunta; iPerg.addEventListener('input', () => { f.pergunta = iPerg.value; });
        const iVar = h('textarea', { rows: 4, placeholder: 'Uma por linha (opcional). Outras formas de perguntar a mesma coisa.' }); iVar.value = f.variantes; iVar.addEventListener('input', () => { f.variantes = iVar.value; });
        const dl = h('datalist', { id: 'dlCatRev' }, categoriasSugeridas().map(c => h('option', { value: c })));
        const iCat = h('input', { type: 'text', list: 'dlCatRev', maxlength: 60, placeholder: 'Ex.: CT-e' }); iCat.value = f.categoria; iCat.addEventListener('input', () => { f.categoria = iCat.value; });
        const ed = ADM.editorResposta({ valor: f.resposta !== undefined ? f.resposta : L.resposta });
        if (f.resposta === undefined) f.resposta = L.resposta;
        ed.textarea.addEventListener('input', () => { f.resposta = ed.obter(); });
        f.ed = ed; f.iVar = iVar;

        const formCard = h('div', { class: 'cartao' },
            h('div', { class: 'cartao-topo' }, h('h3', null, I('edit', 16), 'Pergunta e resposta'),
                h('button', { class: 'btn peq fantasma', type: 'button', title: 'Voltar ao texto original da IA', onclick: () => { ed.definir(L.resposta); f.resposta = L.resposta; } }, I('undo', 14), 'Restaurar original')),
            h('div', { class: 'cartao-corpo' },
                h('div', { class: 'dica' }, h('b', null, '⚡ Aprovar e criar resposta rápida:'), ' resposta pronta, na hora e sem gastar IA, para perguntas parecidas. ',
                    h('b', null, 'Salvar no banco de dados:'), ' vira artigo da base de conhecimento — a IA consulta e monta a resposta com ele (melhor para temas amplos). Aqui só vão a pergunta (título), a categoria e a resposta; as variantes não.'),
                h('div', { class: 'g2' },
                    h('label', { class: 'campo' }, h('span', { class: 'rot' }, 'Pergunta principal (título no banco de dados)'), iPerg),
                    h('label', { class: 'campo' }, h('span', { class: 'rot' }, 'Categoria (opcional)'), iCat, dl)),
                h('label', { class: 'campo' }, h('span', { class: 'rot' }, 'Variantes da pergunta (só da resposta rápida)'), iVar),
                ed.el));

        /* coluna da direita: o que já existe */
        const lateral = h('div', { class: 'pilha' });
        const alvo = RRMatch.preparar(L.pergunta);
        const ja = RRMatch.ranking(L.pergunta, ADM.rr.itens, 0.55).slice(0, 5);
        const cfg = ADM.configAtiva().respostasRapidas;
        const jaResponde = ja.find(x => x.numerosOk && (x.exato || (alvo.termos.length >= cfg.minTermos && x.lex >= cfg.limiarLexical)));
        const cJa = h('div', { class: 'cartao' }, h('div', { class: 'cartao-topo' }, h('h3', null, I('search', 16), 'Já existe algo parecido?')),
            h('div', { class: 'cartao-corpo' }, ADM.rr.erro && !ADM.rr.itens.length
                ? ADM.ui.aviso('wa', 'Não consegui ler as respostas rápidas existentes (' + ADM.db.erroTexto(ADM.rr.erro) + ').')
                : !ja.length ? h('div', { class: 'mu' }, ADM.rr.itens.length ? 'Nenhuma resposta rápida parecida: pode criar uma nova.' : 'Ainda não há respostas rápidas — esta será a primeira!')
                : ja.map(x => h('div', { class: 'similar' + (x === jaResponde ? ' destaque' : '') },
                    h('div', { class: 'grow' }, h('div', { class: 'q' }, `#${x.item.id} · ${ADM.fmt.trunc(x.item.pergunta, 110)}`),
                        x.variante !== x.item.pergunta ? h('div', { class: 'mu' }, 'casou com: ' + ADM.fmt.trunc(x.variante, 90)) : null,
                        h('div', { class: 'linha', style: { marginTop: '6px', gap: '6px' } },
                            h('button', { class: 'btn peq', type: 'button', onclick: () => mesclarCom(x.item) }, I('plus', 13), 'Adicionar como variante'),
                            ADM.podeAba('respostas') ? h('button', { class: 'btn peq fantasma', type: 'button', onclick: () => { ADM.irParaAba('respostas', { editar: x.item.id }); } }, 'Abrir') : null)),
                    h('span', { class: 'pct ' + (x.lex >= .8 ? 'alto' : 'medio') }, ADM.fmt.pct(x.lex))))));
        if (jaResponde) cJa.insertBefore(h('div', { style: { padding: '12px 16px 0' } }, ADM.ui.aviso('wa', 'O sistema já responderia esta pergunta com a #' + jaResponde.item.id + '. Talvez baste adicioná-la como variante.')), cJa.children[1]);
        lateral.appendChild(cJa);

        /* perguntas parecidas ainda pendentes → viram variantes */
        const alvoPrep = alvo;
        const parecidas = E.grupos.filter(o => o.chave !== g.chave).map(o => Object.assign({ g: o }, RRMatch.comparar(alvoPrep, o.item))).filter(x => x.numerosOk && x.lex >= 0.55).sort((a, b) => b.lex - a.lex).slice(0, 8);
        if (parecidas.length) {
            lateral.appendChild(h('div', { class: 'cartao' }, h('div', { class: 'cartao-topo' }, h('h3', null, I('layers', 16), `Perguntas parecidas (${parecidas.length})`)),
                h('div', { class: 'cartao-corpo' }, h('div', { class: 'dica' }, 'Marque para incluir como variante da resposta rápida — as marcadas também são dadas como resolvidas ao aprovar ou ao salvar no banco de dados.'),
                    parecidas.map(x => {
                        const cb = h('input', { type: 'checkbox', checked: f.extras.has(x.g.chave), 'aria-label': 'Incluir como variante' });
                        cb.addEventListener('change', () => {
                            const linhas = iVar.value.split('\n').map(s => s.trim()).filter(Boolean);
                            if (cb.checked) { f.extras.add(x.g.chave); if (!linhas.includes(x.g.rep.pergunta)) linhas.push(x.g.rep.pergunta); }
                            else { f.extras.delete(x.g.chave); const i = linhas.indexOf(x.g.rep.pergunta); if (i >= 0) linhas.splice(i, 1); }
                            iVar.value = linhas.join('\n'); f.variantes = iVar.value;
                        });
                        return h('label', { class: 'similar', style: { cursor: 'pointer' } }, cb,
                            h('div', { class: 'grow' }, h('div', { class: 'q' }, ADM.fmt.trunc(x.g.rep.pergunta, 120)), h('div', { class: 'mu' }, x.g.itens.length > 1 ? x.g.itens.length + ' ocorrências' : '1 ocorrência')),
                            h('span', { class: 'pct ' + (x.lex >= .8 ? 'alto' : 'medio') }, ADM.fmt.pct(x.lex)));
                    }))));
        }
        if (g.itens.length > 1) {
            const cb = h('input', { type: 'checkbox', checked: f.incluirIguais }); cb.addEventListener('change', () => { f.incluirIguais = cb.checked; });
            lateral.appendChild(h('div', { class: 'cartao' }, h('div', { class: 'cartao-corpo' }, h('label', { class: 'marcar', style: { alignItems: 'flex-start' } }, cb,
                h('span', null, `Aplicar a decisão às outras ${g.itens.length - 1} ocorrência(s) desta mesma pergunta`)))));
        }

        box.appendChild(h('div', { class: 'detalhe-corpo' }, formCard, lateral));

        /* ações */
        box.appendChild(h('div', { class: 'rodape-acoes' },
            h('button', { class: 'btn ok', type: 'button', id: 'btnAprovar', onclick: e => aprovar(e.currentTarget) }, I('check', 16), 'Aprovar e criar resposta rápida'),
            h('button', { class: 'btn primario', type: 'button', id: 'btnBanco', title: 'Grava a pergunta e a resposta como artigo da base de conhecimento (banco de dados), em vez de criar uma resposta rápida', onclick: e => salvarNoBanco(e.currentTarget) }, I('database', 16), 'Salvar no banco de dados'),
            h('button', { class: 'btn perigo', type: 'button', onclick: rejeitar }, I('thumbdown', 15), 'Rejeitar…'),
            h('button', { class: 'btn', type: 'button', title: 'Não vale guardar (pergunta genérica, específica demais, etc.)', onclick: ignorar }, I('skip', 15), 'Ignorar'),
            h('span', { class: 'grow' }),
            ADM.podeAba('simulador') ? h('button', { class: 'btn', type: 'button', title: 'Faz a pergunta no chat de simulação (nada é gravado)', onclick: () => { ADM.irParaAba('simulador'); ADM.sim.perguntar(L.pergunta); } }, I('flask', 15), 'Testar no simulador') : null));
    }

    function renderSomenteLeitura(box, g, L) {
        const reabrirBtn = h('button', { class: 'btn', type: 'button', onclick: e => reabrir(e.currentTarget, g, L) }, I('undo', 15), 'Reabrir para revisão');
        const idBanco = L.revisao === 'banco' ? idDoBanco(L) : null;
        box.appendChild(h('div', { class: 'cartao' },
            h('div', { class: 'cartao-topo' }, h('h3', null, I('chat', 16), 'Resposta apresentada ao usuário')),
            h('div', { class: 'cartao-corpo' }, (() => { const p = h('div', { class: 'md-prev' }); p.innerHTML = renderMd(L.resposta || ''); return p; })(),
                h('div', { class: 'linha' }, L.resposta_rapida_id && ADM.podeAba('respostas') ? h('button', { class: 'btn', type: 'button', onclick: () => ADM.irParaAba('respostas', { editar: L.resposta_rapida_id }) }, I('zap', 15), 'Abrir resposta rápida #' + L.resposta_rapida_id) : null,
                    L.revisao === 'banco' && ADM.podeAba('banco') ? h('button', { class: 'btn', type: 'button', title: 'Abre a aba Banco de dados já no artigo que foi salvo', onclick: () => ADM.irParaAba('banco', idBanco ? { id: idBanco } : { buscar: L.pergunta }) }, I('database', 15), idBanco ? 'Abrir no banco de dados (#' + idBanco + ')' : 'Procurar no banco de dados') : null,
                    reabrirBtn,
                    ADM.podeAba('simulador') ? h('button', { class: 'btn', type: 'button', onclick: () => { ADM.irParaAba('simulador'); ADM.sim.perguntar(L.pergunta); } }, I('flask', 15), 'Testar no simulador') : null))));
    }

    /* ───────────── ações ───────────── */
    async function resolver(logs, patch) {
        const ids = Array.from(new Set(logs.map(l => l.id)));
        const r = await ADM.sb.from('logs').update(Object.assign({ revisado_em: new Date().toISOString(), revisado_por: ADM.auth.usuario() }, patch)).in('id', ids).select('id');
        ADM.db.exigirAfetadas(r);
        // atualiza a tela: sai da lista se o filtro não bate mais com a nova situação
        const set = new Set(ids);
        E.linhas.forEach(l => { if (set.has(l.id)) Object.assign(l, patch); });
        if (E.filtro.revisao !== 'todas') E.linhas = E.linhas.filter(l => !set.has(l.id) || l.revisao === E.filtro.revisao);
        const antes = E.grupos.map(x => x.chave), idx = antes.indexOf(E.selChave);
        agrupar();
        const proxima = E.grupos[Math.min(Math.max(idx, 0), E.grupos.length - 1)];
        E.selChave = proxima ? proxima.chave : null; E.idxResp = 0; E.form = null;
        renderLista(); renderDetalhe(); ADM.atualizarPendentes();
        if (!E.fim && E.grupos.length < 8) carregar(false);
    }
    function logsAfetados(g, L, f) {
        const lista = f.incluirIguais ? g.itens.slice() : [L];
        if (!lista.includes(L)) lista.push(L);
        f.extras.forEach(k => { const o = E.grupos.find(x => x.chave === k); if (o) lista.push(...o.itens); });
        return lista;
    }

    // As decisões (aprovar, salvar no banco de dados, variante, rejeitar, ignorar) nunca rodam ao mesmo tempo — do clique até o fim da gravação,
    // inclusive com uma pergunta de confirmação aberta — senão o mesmo item poderia ir para dois destinos.
    function exclusivo(acao) {
        return async function (...args) {
            if (E.salvando) return;
            E.salvando = true;
            try { await acao(...args); } finally { E.salvando = false; }
        };
    }

    const aprovar = exclusivo(async btn => {
        const g = grupoSel(); if (!g) return;
        const L = g.itens[E.idxResp] || g.itens[0], f = E.form;
        const pergunta = f.pergunta.trim(), resposta = f.ed.obter().trim();
        if (pergunta.length < 3) return ADM.ui.toast('Escreva a pergunta principal.', 'wa');
        if (resposta.length < 5) return ADM.ui.toast('A resposta está vazia.', 'wa');
        if (f.bancoIdCriado) return ADM.ui.toast(`O artigo #${f.bancoIdCriado} já foi criado no banco de dados nesta tela — clique em “Salvar no banco de dados” para concluir (ou exclua-o na aba Banco de dados antes de aprovar).`, 'wa', 10000);
        if (L.feedback === 'Negativo' && !(await ADM.ui.confirmar('O usuário avaliou esta resposta com 👎. Aprovar mesmo assim?', { titulo: 'Resposta com avaliação negativa', rotuloOk: 'Aprovar mesmo assim' }))) return;
        const duplicada = RRMatch.ranking(pergunta, ADM.rr.itens, 0.8).find(x => x.numerosOk);
        if (duplicada && !(await ADM.ui.confirmar(`Já existe a resposta rápida #${duplicada.item.id} ("${ADM.fmt.trunc(duplicada.item.pergunta, 80)}") muito parecida (${ADM.fmt.pct(duplicada.lex)}).\n\nCriar uma nova mesmo assim?`, { titulo: 'Pergunta parecida já cadastrada', rotuloOk: 'Criar nova' }))) return;
        const normP = RRMatch.preparar(pergunta).norm;
        const variantes = unicas(f.variantes.split('\n').map(s => s.trim()).filter(Boolean)).filter(v => RRMatch.preparar(v).norm !== normP);
        await ADM.ui.ocupado(btn, async () => {
            try {
                let rrId = f.rrIdCriado;   // se uma tentativa anterior criou a resposta mas falhou ao atualizar os logs, não cria de novo
                if (!rrId) {
                    const r = await ADM.sb.from('respostas_rapidas').insert({ pergunta, variantes, resposta, categoria: f.categoria.trim() || null, ativo: true, origem_log_id: L.id, aprovado_por: ADM.auth.usuario() }).select('id');
                    ADM.db.exigirAfetadas(r); rrId = r.data[0].id; f.rrIdCriado = rrId;
                }
                await resolver(logsAfetados(g, L, f), { revisao: 'aprovada', resposta_rapida_id: rrId, revisao_nota: null });
                ADM.ui.toast(`Aprovada! Criada a resposta rápida #${rrId}. Perguntas parecidas já passam a recebê-la.`, 'ok');
                ADM.rr.invalidar(); ADM.rr.carregar(true);
            } catch (e) {
                ADM.ui.toast((f.rrIdCriado ? `A resposta rápida #${f.rrIdCriado} foi criada, mas não consegui marcar os logs como aprovados — clique em Aprovar de novo para concluir. ` : '') + ADM.db.erroTexto(e), 'er', 12000);
            }
        });
    });

    // Em vez de criar uma resposta rápida, grava a pergunta (título) + a resposta (conteúdo) como artigo da base de conhecimento (BancoDados).
    // Mesmo formato do cadastro que o v27 já usava (titulo, conteudo e, se houver, categoria): o vetor de busca fica vazio e o sistema o calcula sozinho quando abre.
    const salvarNoBanco = exclusivo(async btn => {
        const g = grupoSel(); if (!g) return;
        const L = g.itens[E.idxResp] || g.itens[0], f = E.form;
        const titulo = f.pergunta.trim(), conteudo = f.ed.obter().trim(), categoria = f.categoria.trim();
        if (titulo.length < 3) return ADM.ui.toast('Escreva a pergunta principal — ela vira o título do artigo.', 'wa');
        if (conteudo.length < 5) return ADM.ui.toast('A resposta está vazia.', 'wa');
        if (f.rrIdCriado) return ADM.ui.toast(`A resposta rápida #${f.rrIdCriado} já foi criada nesta tela — clique em “Aprovar” para concluir (ou exclua-a na aba Respostas rápidas antes de salvar no banco de dados).`, 'wa', 10000);
        if (L.feedback === 'Negativo' && !(await ADM.ui.confirmar('O usuário avaliou esta resposta com 👎. Salvar no banco de dados mesmo assim?', { titulo: 'Resposta com avaliação negativa', rotuloOk: 'Salvar mesmo assim' }))) return;
        if (!f.bancoIdCriado) {
            const p = await artigoParecido(titulo);
            if (p && !(await ADM.ui.confirmar(`Já existe no banco de dados o artigo #${p.id} ("${ADM.fmt.trunc(p.titulo, 80)}") com título muito parecido (${ADM.fmt.pct(p.lex)}).\n\nSalvar um novo mesmo assim? (Para só corrigir o texto dele, edite-o na aba Banco de dados.)`, { titulo: 'Artigo parecido já cadastrado', rotuloOk: 'Salvar novo' }))) return;
        }
        await ADM.ui.ocupado(btn, async () => {
            try {
                let id = f.bancoIdCriado;   // se uma tentativa anterior criou o artigo mas falhou ao atualizar os logs, não cria de novo
                if (!id) {
                    const artigo = { titulo, conteudo };
                    if (categoria) artigo.categoria = categoria;
                    const r = await ADM.sb.from('BancoDados').insert(artigo).select('id');
                    ADM.db.exigirAfetadas(r); id = r.data[0].id; f.bancoIdCriado = id;
                    if (BD.itens) { BD.itens.push({ id, titulo, categoria: categoria || null }); sugerirCategorias(); }
                }
                await resolver(logsAfetados(g, L, f), { revisao: 'banco', resposta_rapida_id: null, revisao_nota: 'Salvo no banco de dados (#' + id + ')' });
                ADM.ui.toast(`Salvo no banco de dados (artigo #${id}). Vale para quem abrir o sistema daqui para frente — o vetor de busca é calculado sozinho na abertura.`, 'ok', 8000);
            } catch (e) {
                ADM.ui.toast((f.bancoIdCriado ? `O artigo #${f.bancoIdCriado} foi criado no banco de dados, mas não consegui marcar os logs — clique em Salvar no banco de dados de novo para concluir. ` : '') + ADM.db.erroTexto(e), 'er', 12000);
            }
        });
    });

    const mesclarCom = exclusivo(async rr => {
        const g = grupoSel(); if (!g) return;
        const L = g.itens[E.idxResp] || g.itens[0], f = E.form;
        const msg = `Adicionar "${ADM.fmt.trunc(f.pergunta, 90)}" como variante da resposta rápida #${rr.id}?\n\nO texto da resposta #${rr.id} NÃO muda. Esta pergunta (e as marcadas como parecidas) passa a receber aquela resposta.`;
        if (!(await ADM.ui.confirmar(msg, { titulo: 'Adicionar como variante', rotuloOk: 'Adicionar' }))) return;
        const normRR = RRMatch.preparar(rr.pergunta).norm;
        const novas = unicas([].concat(rr.variantes || [], [f.pergunta.trim()], f.variantes.split('\n').map(s => s.trim()).filter(Boolean))).filter(v => RRMatch.preparar(v).norm !== normRR);
        try {
            const r = await ADM.sb.from('respostas_rapidas').update({ variantes: novas }).eq('id', rr.id).select('id');
            ADM.db.exigirAfetadas(r);
            await resolver(logsAfetados(g, L, f), { revisao: 'aprovada', resposta_rapida_id: rr.id, revisao_nota: 'variante da #' + rr.id });
            ADM.ui.toast(`Adicionada como variante da #${rr.id}.`, 'ok');
            ADM.rr.invalidar(); ADM.rr.carregar(true);
        } catch (e) { ADM.ui.toast(ADM.db.erroTexto(e), 'er', 10000); }
    });

    const rejeitar = exclusivo(async () => {
        const g = grupoSel(); if (!g) return;
        const L = g.itens[E.idxResp] || g.itens[0], f = E.form;
        const nota = await ADM.ui.entrada({ titulo: 'Rejeitar resposta', mensagem: 'Por que esta resposta não serve? (opcional — fica no histórico para orientar melhorias)', rotulo: 'Motivo', multilinha: true, rotuloOk: 'Rejeitar', dica: 'Ex.: caminho de menu errado; resposta incompleta…' });
        if (nota === null) return;
        try { await resolver(logsAfetados(g, L, Object.assign({}, f, { extras: new Set() })), { revisao: 'rejeitada', revisao_nota: nota.trim() || null }); ADM.ui.toast('Resposta rejeitada.', 'ok'); }
        catch (e) { ADM.ui.toast(ADM.db.erroTexto(e), 'er', 10000); }
    });
    const ignorar = exclusivo(async () => {
        const g = grupoSel(); if (!g) return;
        const L = g.itens[E.idxResp] || g.itens[0], f = E.form;
        try { await resolver(logsAfetados(g, L, Object.assign({}, f, { extras: new Set() })), { revisao: 'ignorada', revisao_nota: null }); ADM.ui.toast('Ignorada.', 'ok', 2200); }
        catch (e) { ADM.ui.toast(ADM.db.erroTexto(e), 'er', 10000); }
    });
    async function reabrir(btn, g, L) {
        const eraBanco = L.revisao === 'banco', idBanco = eraBanco ? idDoBanco(L) : null;   // reabrir NÃO apaga o artigo que já foi para o banco de dados
        await ADM.ui.ocupado(btn, async () => {
            try {
                const r = await ADM.sb.from('logs').update({ revisao: 'pendente', revisao_nota: null, resposta_rapida_id: null, revisado_em: null, revisado_por: null }).eq('id', L.id).select('id');
                ADM.db.exigirAfetadas(r);
                Object.assign(L, { revisao: 'pendente', revisao_nota: null, resposta_rapida_id: null });
                if (E.filtro.revisao !== 'todas') { E.linhas = E.linhas.filter(l => l.id !== L.id); agrupar(); E.selChave = E.grupos[0] ? E.grupos[0].chave : null; }
                E.form = null; renderLista(); renderDetalhe(); ADM.atualizarPendentes();
                ADM.ui.toast(eraBanco ? `Voltou para a fila de pendentes. O artigo${idBanco ? ' #' + idBanco : ''} continua no banco de dados — edite ou exclua na aba Banco de dados se não quiser mais.` : 'Voltou para a fila de pendentes.', 'ok', eraBanco ? 8000 : 2500);
            } catch (e) { ADM.ui.toast(ADM.db.erroTexto(e), 'er', 10000); }
        });
    }

    /* ───────────── aba ───────────── */
    ADM.registrarAba({
        id: 'revisao', titulo: 'Revisão', icone: 'inbox', ordem: 10,
        descricao: 'Confira as respostas que a IA deu aos usuários. As boas viram respostas rápidas (imediatas, sem gastar IA, para perguntas parecidas — e também conhecimento validado para a IA) ou, quando o tema é mais amplo, vão para o banco de dados (base de conhecimento) com o botão “Salvar no banco de dados”.',
        montar(ctx) {
            const sel = (opcoes, valor, aoMudar, titulo) => { const s = h('select', { title: titulo, 'aria-label': titulo }, opcoes.map(([v, t]) => h('option', { value: v }, t))); s.value = valor; s.addEventListener('change', () => aoMudar(s.value)); return s; };
            const busca = h('input', { type: 'search', placeholder: 'Buscar na pergunta…', 'aria-label': 'Buscar na pergunta' });
            busca.addEventListener('input', debounce(() => { E.filtro.texto = busca.value; carregar(true); }, 380));
            ctx.barra.append(
                sel(ESTADOS, E.filtro.revisao, v => { E.filtro.revisao = v; E.selChave = null; carregar(true); }, 'Situação'),
                sel([['', 'Qualquer origem'], ['ia', '🤖 Respostas da IA'], ['rapida', '⚡ Respostas rápidas']], '', v => { E.filtro.fonte = v; carregar(true); }, 'Origem'),
                sel([['', 'Qualquer avaliação'], ['Positivo', '👍 Positivas'], ['Negativo', '👎 Negativas'], ['Pendente', '⏳ Sem avaliação']], '', v => { E.filtro.feedback = v; carregar(true); }, 'Avaliação do usuário'),
                busca,
                h('button', { class: 'btn icone', type: 'button', title: 'Atualizar', 'aria-label': 'Atualizar', onclick: () => { ADM.rr.invalidar(); ADM.rr.carregar(true); carregar(true); } }, I('refresh', 17)));
            R.lista = h('div', { class: 'lista', role: 'list', 'aria-label': 'Respostas para revisar' });
            R.detalhe = h('div', { class: 'detalhe', 'aria-live': 'polite' });
            ctx.corpo.appendChild(h('div', { class: 'md' }, R.lista, R.detalhe));
            renderDetalhe();
        },
        abrir() {
            ADM.rr.carregar();
            carregarBD().catch(() => { /* só para sugerir categorias; o aviso de duplicidade busca de novo na hora de salvar */ });
            if (!E.jaCarregou) carregar(true);
            else ADM.atualizarPendentes();
        },
    });
    // quando a lista de respostas rápidas termina de carregar (ou muda), refaz o painel "já existe algo parecido?" — sem roubar o foco de quem está digitando
    ADM.on('rr:mudou', () => {
        const aba = ADM.abas.find(a => a.id === 'revisao');
        if (!aba || !aba.montada || !R.detalhe || !grupoSel()) return;
        const foco = document.activeElement;
        if (foco && R.detalhe.contains(foco) && /^(INPUT|TEXTAREA|SELECT)$/.test(foco.tagName)) return;
        renderDetalhe();
    });
})();
