/* admin/js/aba-sistema.js — Aba "Sistema": verificação do banco, usuários e acessos, segurança (senha/modo seguro), limpeza do cache deste navegador e informações. */
(function () {
    'use strict';
    const ARQ = ADM.arquivoLocal('admin_cfg_handle', 'admin-config.js', 'Arquivo admin-config.js do projeto');
    const R = {};
    const sim = ok => ok ? '✔ sim' : '✖ não';
    const clone = o => JSON.parse(JSON.stringify(o));
    // o config/admin-config.js "como está agora" — inclui o que este painel acabou de gerar. É a base de TODO arquivo novo (troca de senha ou de usuários),
    // senão gerar um depois do outro desfaria o primeiro.
    let CFG_BASE = clone(window.BSOFT_ADMIN || {});

    const ITENS = [
        { t: 'BancoDados', rot: 'Base de conhecimento (BancoDados)', obrig: true },
        { t: 'Parametros', rot: 'Parâmetros', obrig: true },
        { t: 'Funcionalidades', rot: 'Funcionalidades', obrig: true },
        { t: 'Rotinas', rot: 'Rotinas (telas)', obrig: true },
        { t: 'RejeicoesSEFAZ', rot: 'Rejeições SEFAZ' },
        { t: 'logs', rot: 'Logs', obrig: true },
        { t: 'machine_learning', rot: 'Conhecimento aprendido' },
        { t: 'suporte_novidades', rot: 'Novidades' },
        { t: 'StatusServicos', rot: 'Status SEFAZ/ANTT', sql: '01_status_servicos.sql' },
        { t: 'respostas_rapidas', rot: 'Respostas rápidas', sql: '02_respostas_rapidas_e_revisao.sql' },
        { t: 'respostas_rapidas_uso', rot: 'Uso das respostas rápidas (visão)', sql: '02_respostas_rapidas_e_revisao.sql' },
    ];

    /* ───────────── verificação do banco ───────────── */
    async function verificar(btn) {
        await ADM.ui.ocupado(btn, async () => {
            const linhas = [], add = (estado, rot, det, sql) => linhas.push({ estado, rot, det, sql });
            for (const it of ITENS) {
                try {
                    // 1 linha de verdade primeiro: uma consulta "só contar" (HEAD) numa tabela que não existe volta sem erro no supabase-js
                    const um = await ADM.sb.from(it.t).select('*').limit(1); if (um.error) throw um.error;
                    const r = await ADM.sb.from(it.t).select('*', { count: 'exact', head: true });
                    add('ok', it.rot, r.count == null ? 'existe' : ADM.fmt.num(r.count) + ' registro(s)');
                } catch (e) { add(it.obrig ? 'er' : 'wa', it.rot, ADM.db.ehTabelaAusente(e) ? 'não existe' + (it.sql ? ' — rode sql/' + it.sql : '') : ADM.db.erroTexto(e), it.sql); }
            }
            try { const r = await ADM.sb.from('logs').select('resposta, fonte, modelo, revisao, revisao_nota, revisado_em, revisado_por, resposta_rapida_id').limit(1); if (r.error) throw r.error; add('ok', 'Colunas de revisão em “logs”', 'presentes'); }
            catch (e) { add('wa', 'Colunas de revisão em “logs”', ADM.db.ehColunaAusente(e) ? 'faltam — rode sql/02_respostas_rapidas_e_revisao.sql' : ADM.db.erroTexto(e), '02_respostas_rapidas_e_revisao.sql'); }
            try { const r = await ADM.sb.from('logs').select('retorno').limit(1); if (r.error) throw r.error; add('ok', 'Coluna “retorno” em “logs” (resposta do suporte ao feedback)', 'presente'); }
            catch (e) { add('wa', 'Coluna “retorno” em “logs”', ADM.db.ehColunaAusente(e) ? 'não existe — a Gestão de Feedback dos usuários não mostra o retorno do suporte' : ADM.db.erroTexto(e)); }
            try { const r = await ADM.sb.from('logs').select('fontes_banco').limit(1); if (r.error) throw r.error; add('ok', 'Coluna “fontes_banco” em “logs” (quais dados do banco a IA usou — aba Revisão)', 'presente'); }
            catch (e) { add('wa', 'Coluna “fontes_banco” em “logs”', ADM.db.ehColunaAusente(e) ? 'não existe — a Revisão não mostra quais dados do banco a IA usou em cada resposta. Rode sql/04_logs_fontes_banco.sql' : ADM.db.erroTexto(e), '04_logs_fontes_banco.sql'); }

            // segurança
            let sessao = 'anônima (chave pública)';
            try { const s = await ADM.sb.auth.getSession(); if (s.data && s.data.session) sessao = 'autenticada como ' + s.data.session.user.email; } catch (e) { /* ok */ }
            add('in', 'Modo de acesso do painel', (ADM.auth.modo === 'supabase' ? 'seguro (Supabase)' : 'local (senha só no navegador)') + ' · sessão ' + sessao);
            const rpc = await ADM.sb.rpc('eh_admin');
            if (rpc.error) add(ADM.auth.modo === 'supabase' ? 'er' : 'wa', 'Regras de segurança do banco (SQL 03)', 'NÃO instaladas — qualquer pessoa com a chave pública do sistema consegue editar o conteúdo do banco. Recomendado: README → Segurança.', '03_seguranca_rls.sql');
            else if (ADM.auth.modo === 'local') add('er', 'Regras de segurança do banco (SQL 03)', 'instaladas, mas o painel está no modo local: as gravações daqui serão barradas. Troque “modo” para "supabase" em config/admin-config.js.');
            else add(rpc.data === true ? 'ok' : 'er', 'Regras de segurança do banco (SQL 03)', rpc.data === true ? 'instaladas — você é administrador ✔' : 'instaladas, mas esta conta NÃO é administradora (confira a tabela admin_emails)');
            renderVerificacao(linhas);
        });
    }
    function renderVerificacao(linhas) {
        const ic = { ok: ['✔', 'ok'], er: ['✖', 'er'], wa: ['⚠', 'wa'], in: ['ℹ', 'in'] };
        limpar(R.verif).appendChild(h('div', { class: 'tabela-wrap', style: { maxHeight: 'none' } }, h('table', { class: 'tabela' }, h('tbody', null, linhas.map(l => h('tr', null,
            h('td', { style: { width: '34px' } }, h('span', { class: 'sel ' + ic[l.estado][1] }, ic[l.estado][0])), h('td', { style: { fontWeight: 600 } }, l.rot),
            h('td', { class: 'mu', style: { wordBreak: 'break-word' } }, l.det, l.sql ? [' ', ADM.ui.sqlAjuda(l.sql)] : null)))))));
    }

    /* ───────────── senha ───────────── */
    function secSenha() {
        if (ADM.auth.modo === 'supabase') {
            const ref = ((window.BSOFT_CONFIG && BSOFT_CONFIG.supabaseUrl) || '').replace(/^https?:\/\//, '').split('.')[0];
            return h('div', { class: 'cartao' }, h('div', { class: 'cartao-topo' }, h('h3', null, I('shield', 16), 'Senha e acesso')),
                h('div', { class: 'cartao-corpo' }, ADM.ui.aviso('ok', h('b', null, 'Modo seguro ativo.'), ' O login é feito no Supabase Auth com a conta ', h('b', null, (window.BSOFT_ADMIN && BSOFT_ADMIN.supabaseEmail) || ADM.auth.email()), '.'),
                    h('div', { class: 'dica' }, 'Para trocar a senha, abra o Supabase → Authentication → Users → (sua conta) → “Send password recovery” ou “Reset password”.'),
                    ref ? h('a', { class: 'btn', href: 'https://supabase.com/dashboard/project/' + ref + '/auth/users', target: '_blank', rel: 'noopener' }, I('ext', 14), 'Abrir Authentication → Users') : null));
        }
        const atual = h('input', { type: 'password', autocomplete: 'current-password' }), nova = h('input', { type: 'password', autocomplete: 'new-password' }), repete = h('input', { type: 'password', autocomplete: 'new-password' });
        const barra = h('div', { class: 'forca' }, h('i')), txt = h('span', { class: 'dica' });
        nova.addEventListener('input', () => {
            const f = Cripto.forca(nova.value);
            barra.firstChild.style.width = (nova.value ? Math.max(8, f.pontos / 4 * 100) : 0) + '%';
            barra.firstChild.style.background = ['var(--ad-er)', 'var(--ad-er)', '#f59e0b', '#84cc16', 'var(--ad-ok)'][f.pontos];
            txt.textContent = nova.value ? 'Senha ' + f.rotulo + (f.pontos < 3 ? ' — use 12+ caracteres, misture maiúsculas, números e símbolos.' : '.') : '';
        });
        const btn = h('button', { class: 'btn primario', type: 'button', onclick: e => trocarSenha(e.currentTarget, { atual, nova, repete, barra, txt }) }, I('key', 15), 'Gerar nova senha');
        const multi = ADM.auth.multiusuario();
        return h('div', { class: 'cartao' }, h('div', { class: 'cartao-topo' }, h('h3', null, I('key', 16), multi ? 'Senha do administrador principal' : 'Alterar a senha do painel')),
            h('div', { class: 'cartao-corpo' },
                multi ? h('div', { class: 'dica' }, 'Esta é a senha de quem entra como administrador principal. A senha de cada outro usuário é definida em “Usuários e acessos” (botão Senha).') : null,
                ADM.ui.aviso('wa', h('b', null, 'Proteção básica.'), ' No modo local a senha só esconde esta tela; quem entende de programação ainda consegue falar direto com o banco. Para proteger de verdade, ative o modo seguro (README → Segurança).'),
                h('label', { class: 'campo' }, h('span', { class: 'rot' }, 'Senha atual'), atual),
                h('div', { class: 'g2' }, h('label', { class: 'campo' }, h('span', { class: 'rot' }, 'Nova senha'), nova), h('label', { class: 'campo' }, h('span', { class: 'rot' }, 'Repita a nova senha'), repete)),
                barra, txt, h('div', { class: 'linha' }, btn),
                h('div', { class: 'dica' }, 'A senha nunca é gravada: só um “hash” embaralhado (PBKDF2, 210 mil voltas) fica em config/admin-config.js. Depois de gerar, suba esse arquivo no GitHub para valer no site.')));
    }
    async function trocarSenha(btn, c) {
        if (!Cripto.disponivel()) return ADM.ui.toast('Este endereço não permite a criptografia necessária (use HTTPS, localhost ou o arquivo aberto do disco).', 'er');
        await ADM.ui.ocupado(btn, async () => {
            try {
                if (!(await Cripto.conferir(c.atual.value, CFG_BASE.senha))) { ADM.ui.toast('A senha atual não confere.', 'er'); c.atual.focus(); return; }
                if (c.nova.value.length < 8) { ADM.ui.toast('A nova senha precisa ter pelo menos 8 caracteres.', 'wa'); c.nova.focus(); return; }
                if (c.nova.value !== c.repete.value) { ADM.ui.toast('A repetição não é igual à nova senha.', 'wa'); c.repete.focus(); return; }
                const f = Cripto.forca(c.nova.value);
                if (f.pontos < 2 && !(await ADM.ui.confirmar('Esta senha é ' + f.rotulo + '. Usar mesmo assim?', { titulo: 'Senha fraca', rotuloOk: 'Usar mesmo assim' }))) return;
                const senha = await Cripto.novoHash(c.nova.value);
                const cfg = Object.assign({}, CFG_BASE, { senha });   // mantém os usuários já publicados (a lista continua no arquivo)
                const texto = Cripto.textoConfig(cfg);
                let gravou = false;
                if (ARQ.suportado) { try { gravou = await ARQ.gravar(texto); } catch (e) { if (e.name !== 'AbortError') ADM.ui.toast('Não consegui gravar direto no arquivo: ' + e.message, 'wa', 9000); } }
                CFG_BASE = cfg;   // os próximos arquivos gerados aqui (ex.: de usuários) partem desta senha nova
                [c.atual, c.nova, c.repete].forEach(i => { i.value = ''; }); c.barra.firstChild.style.width = '0'; c.txt.textContent = '';
                janelaPublicarSenha(texto, gravou);
            } catch (e) { ADM.ui.toast(ADM.db.erroTexto(e), 'er', 9000); }
        });
    }
    function janelaPublicarSenha(texto, gravou) {
        const gh = ADM.urlEditarGithub('config/admin-config.js');
        ADM.ui.modal({
            titulo: gravou ? 'Nova senha gerada e salva' : 'Nova senha gerada', largura: 600, fecharFora: false,
            corpo: [gravou ? ADM.ui.aviso('ok', h('b', null, 'Salvo!'), ' O arquivo ', h('code', null, ARQ.nome() || 'admin-config.js'), ' foi atualizado com a nova senha.')
                           : ADM.ui.aviso('wa', h('b', null, 'Falta colocar o arquivo no projeto.'), ' Copie ou baixe e salve como ', h('code', null, 'config/admin-config.js'), ' (substituindo o antigo).'),
                h('ol', { class: 'passos' }, h('li', null, 'Faça ', h('b', null, 'commit + push'), ' do arquivo ', h('code', null, 'config/admin-config.js'), ' no GitHub.'), h('li', null, 'Aguarde ~1 minuto. ', h('b', null, 'Até lá, a senha antiga continua valendo no site.')), h('li', null, 'No próximo login, use a nova senha. (Esta sessão continua aberta até você sair.)')),
                h('div', { class: 'linha' }, !gravou ? h('button', { class: 'btn peq', type: 'button', onclick: () => ADM.ui.copiar(texto, 'Conteúdo copiado.') }, I('copy', 13), 'Copiar conteúdo') : null,
                    !gravou ? h('button', { class: 'btn peq', type: 'button', onclick: () => ADM.ui.baixar('admin-config.js', texto, 'text/javascript;charset=utf-8') }, I('download', 13), 'Baixar admin-config.js') : null,
                    gh ? h('a', { class: 'btn peq', href: gh, target: '_blank', rel: 'noopener' }, I('ext', 13), 'Abrir no GitHub (editar e colar)') : null)],
            botoes: [{ rotulo: 'Fechar', tipo: 'primario' }],
        });
    }

    /* ───────────── usuários e acessos ─────────────
       Só o administrador principal vê e edita (modo local). A lista fica no config/admin-config.js ("usuarios"): cada pessoa com o seu hash de senha e as
       abas liberadas. As alterações ficam num RASCUNHO até você clicar em "Salvar no arquivo" e publicar o arquivo no GitHub (como na troca de senha). */
    const U = { publicado: [], rascunho: [] };
    const chaveNome = s => ADM.auth.chaveNome(s);
    const todasAbas = () => ADM.abasTodas || ADM.abas;
    const RESUMO_ABA = {
        revisao: 'Confere as respostas da IA e aprova, rejeita ou manda para o banco de dados.',
        respostas: 'Edita, pausa e exclui as respostas rápidas.',
        simulador: 'Testa o chat sem gravar nada.',
        mcp: 'Escolhe os modelos de IA e guarda as chaves de API.',
        banco: 'Edita e exclui o conteúdo que a IA consulta.',
        logs: 'Vê, edita e exclui logs; responde os 👎.',
        analise: 'Gráficos de uso: perguntas, usuários, assuntos e horários.',
        novidades: 'Publica avisos que aparecem para todos os usuários.',
        sistema: 'Verificação do banco, limpeza de cache e informações. (Senhas e usuários ficam só com o administrador principal.)',
    };
    const RISCO_ABA = { mcp: 'contém chaves de API', banco: 'altera o conteúdo da IA', logs: 'pode excluir logs', novidades: 'publica para todos' };
    const MODELOS_ACESSO = [
        ['Suporte', ['revisao', 'respostas', 'simulador', 'logs', 'analise'], 'Revisão, Respostas rápidas, Simulador, Logs e Análise'],
        ['Só consulta', ['logs', 'analise'], 'Logs e Análise'],
        ['Tudo, menos configurações', null, 'todas, menos IA / MCP e Sistema'],
    ];

    // o usuário guardado no arquivo: só os campos conhecidos e só abas que existem
    const limpaUsuario = u => ({ nome: String(u.nome).replace(/\s+/g, ' ').trim(), ativo: u.ativo !== false, abas: todasAbas().map(a => a.id).filter(id => (u.abas || []).includes(id)), criadoEm: u.criadoEm || new Date().toISOString(), senha: u.senha });
    const usuariosSujo = () => JSON.stringify(U.rascunho) !== JSON.stringify(U.publicado);
    const marcarSujo = () => ADM.marcarSujo('sistema', usuariosSujo());
    function carregarUsuarios() {
        U.publicado = ((CFG_BASE && CFG_BASE.usuarios) || []).filter(u => u && u.nome && u.senha && u.senha.hash).map(limpaUsuario);
        U.rascunho = clone(U.publicado);
    }
    const nomeAba = id => { const a = todasAbas().find(x => x.id === id); return a ? a.titulo : id; };

    function validarNome(nome, chaveIgnorar) {
        if (nome.length < 3) return 'O usuário precisa ter pelo menos 3 caracteres.';
        if (nome.length > 30) return 'O usuário pode ter no máximo 30 caracteres.';
        if (!/^[\p{L}\p{N}][\p{L}\p{N} ._-]*$/u.test(nome)) return 'Use só letras, números, espaço, ponto, hífen ou sublinhado (e comece por letra ou número).';
        const k = chaveNome(nome);
        if (['admin', 'administrador', 'administrador principal'].includes(k)) return 'Esse nome é reservado para o administrador principal.';
        if (U.rascunho.some(u => chaveNome(u.nome) === k && k !== chaveIgnorar)) return 'Já existe um usuário com esse nome.';
        return '';
    }

    // campo de senha com "Gerar senha forte", "Copiar" e a barra de força; devolve { el, input }
    function campoSenhaNova(rotulo) {
        const input = h('input', { type: 'text', class: 'mono', autocomplete: 'off', spellcheck: 'false', placeholder: 'Mínimo de 8 caracteres' });
        const barra = h('div', { class: 'forca' }, h('i')), txt = h('span', { class: 'dica' });
        const atualizar = () => {
            const f = Cripto.forca(input.value);
            barra.firstChild.style.width = (input.value ? Math.max(8, f.pontos / 4 * 100) : 0) + '%';
            barra.firstChild.style.background = ['var(--ad-er)', 'var(--ad-er)', '#f59e0b', '#84cc16', 'var(--ad-ok)'][f.pontos];
            txt.textContent = input.value ? 'Senha ' + f.rotulo + (f.pontos < 3 ? ' — o ideal é 12+ caracteres, com maiúsculas, números e símbolos.' : '.') : '';
        };
        input.addEventListener('input', atualizar);
        const el = h('div', { class: 'campo' }, h('span', { class: 'rot' }, rotulo),
            h('div', { class: 'senha-nova' }, input,
                h('button', { class: 'btn', type: 'button', title: 'Sorteia uma senha forte', onclick: () => { input.value = Cripto.gerarSenha(14); atualizar(); } }, I('sparkles', 14), 'Gerar senha forte'),
                h('button', { class: 'btn', type: 'button', title: 'Copia a senha para você enviar à pessoa', onclick: () => { if (!input.value) return ADM.ui.toast('Gere ou digite uma senha primeiro.', 'wa'); ADM.ui.copiar(input.value, 'Senha copiada.'); } }, I('copy', 14), 'Copiar')),
            barra, txt, h('div', { class: 'dica' }, 'Anote ou copie a senha agora: depois ela não pode mais ser vista — só redefinida. No arquivo fica apenas o hash.'));
        return { el, input };
    }

    function abrirJanelaUsuario(chaveEdit) {
        const existente = chaveEdit ? U.rascunho.find(u => chaveNome(u.nome) === chaveEdit) : null, novo = !existente;
        if (novo && !Cripto.disponivel()) return ADM.ui.toast('Este endereço não permite a criptografia necessária (use HTTPS, localhost ou o arquivo aberto do disco).', 'er');
        const ids = todasAbas().map(a => a.id), marcadas = new Set(existente ? existente.abas : []);
        const iNome = h('input', { type: 'text', maxlength: 30, autocomplete: 'off', placeholder: 'Ex.: maria.souza' }); iNome.value = existente ? existente.nome : '';
        const ativo = ADM.ui.chave(existente ? existente.ativo !== false : true, null, 'Usuário ativo');
        const senha = novo ? campoSenhaNova('Senha inicial') : null;
        const caixas = todasAbas().map(a => {
            const cb = h('input', { type: 'checkbox', 'aria-label': a.titulo }); cb.checked = marcadas.has(a.id);
            cb.addEventListener('change', () => { if (cb.checked) marcadas.add(a.id); else marcadas.delete(a.id); });
            return { a, cb };
        });
        const aplicar = lista => caixas.forEach(({ a, cb }) => { cb.checked = lista.includes(a.id); if (cb.checked) marcadas.add(a.id); else marcadas.delete(a.id); });
        const modelos = MODELOS_ACESSO.map(([nome, lista, dica]) => h('button', { class: 'btn peq', type: 'button', title: dica, onclick: () => aplicar(lista || ids.filter(id => id !== 'mcp' && id !== 'sistema')) }, nome));
        const corpo = [
            h('div', { class: 'g2' },
                h('label', { class: 'campo' }, h('span', { class: 'rot' }, 'Usuário (para entrar)'), iNome, h('span', { class: 'dica' }, 'Maiúsculas e acentos não importam ao entrar.')),
                h('div', { class: 'campo' }, h('span', { class: 'rot' }, 'Situação'), h('div', { class: 'linha', style: { gap: '10px', minHeight: '38px' } }, ativo.el, h('span', { style: { cursor: 'pointer' }, onclick: () => { ativo.input.checked = !ativo.input.checked; } }, 'Ativo (pode entrar)')))),
            senha ? senha.el : null,
            h('div', { class: 'campo' },
                h('span', { class: 'rot' }, 'Abas liberadas'),
                h('div', { class: 'linha', style: { gap: '6px' } }, h('span', { class: 'dica' }, 'Atalhos:'), modelos,
                    h('button', { class: 'btn peq', type: 'button', onclick: () => aplicar(ids) }, 'Marcar todas'), h('button', { class: 'btn peq fantasma', type: 'button', onclick: () => aplicar([]) }, 'Limpar')),
                h('div', { class: 'aba-opcoes' }, caixas.map(({ a, cb }) => h('label', { class: 'aba-opcao' }, cb,
                    h('div', null, h('div', { class: 'nome' }, I(a.icone || 'file', 14), a.titulo, RISCO_ABA[a.id] ? h('span', { class: 'sel wa' }, RISCO_ABA[a.id]) : null),
                        h('div', { class: 'desc' }, RESUMO_ABA[a.id] || ADM.fmt.trunc(a.descricao || '', 90)))))),
                h('div', { class: 'dica' }, 'Quem não tem uma aba não a vê nem consegue abri-la pelos atalhos ou links. Abas novas que o sistema ganhar no futuro só aparecem para quem você liberar.'))];
        ADM.ui.modal({
            titulo: novo ? 'Novo usuário' : 'Editar usuário — ' + existente.nome, largura: 760, fecharFora: false, corpo,
            botoes: [{ rotulo: 'Cancelar', tipo: 'fantasma' }, {
                rotulo: novo ? 'Adicionar usuário' : 'Salvar alterações', tipo: 'primario', fechar: false,
                acao: async (btn, api) => {
                    const nome = iNome.value.replace(/\s+/g, ' ').trim(), erro = validarNome(nome, existente ? chaveNome(existente.nome) : '');
                    if (erro) { ADM.ui.toast(erro, 'wa'); iNome.focus(); return false; }
                    const abas = ids.filter(id => marcadas.has(id)), ligado = ativo.input.checked;
                    if (!abas.length && ligado) { ADM.ui.toast('Escolha pelo menos uma aba (ou desative o usuário).', 'wa'); return false; }
                    if (novo) {
                        const s = senha.input.value;
                        if (s.length < 8) { ADM.ui.toast('A senha precisa ter pelo menos 8 caracteres.', 'wa'); senha.input.focus(); return false; }
                        const f = Cripto.forca(s);
                        if (f.pontos < 2 && !(await ADM.ui.confirmar('Esta senha é ' + f.rotulo + '. Usar mesmo assim?', { titulo: 'Senha fraca', rotuloOk: 'Usar mesmo assim' }))) return false;
                        U.rascunho.push({ nome, ativo: ligado, abas, criadoEm: new Date().toISOString(), senha: await Cripto.novoHash(s) });
                    } else Object.assign(existente, { nome, ativo: ligado, abas });
                    api.fechar(); renderUsuarios(); marcarSujo();
                    ADM.ui.toast(novo ? `Usuário “${nome}” adicionado ao rascunho. Falta salvar o arquivo e publicar.` : `Alterações em “${nome}” guardadas no rascunho. Falta salvar o arquivo e publicar.`, 'ok', 6000);
                },
            }],
        });
    }

    function abrirJanelaRedefinir(chave) {
        const u = U.rascunho.find(x => chaveNome(x.nome) === chave); if (!u) return;
        if (!Cripto.disponivel()) return ADM.ui.toast('Este endereço não permite a criptografia necessária (use HTTPS, localhost ou o arquivo aberto do disco).', 'er');
        const senha = campoSenhaNova('Nova senha');
        ADM.ui.modal({
            titulo: 'Redefinir a senha — ' + u.nome, largura: 520, fecharFora: false,
            corpo: [ADM.ui.aviso('in', 'A senha antiga deixa de valer assim que o arquivo for publicado. Quem estiver logado com ela é desconectado em até 5 minutos.'), senha.el],
            botoes: [{ rotulo: 'Cancelar', tipo: 'fantasma' }, {
                rotulo: 'Redefinir', tipo: 'primario', fechar: false,
                acao: async (btn, api) => {
                    const s = senha.input.value;
                    if (s.length < 8) { ADM.ui.toast('A senha precisa ter pelo menos 8 caracteres.', 'wa'); senha.input.focus(); return false; }
                    const f = Cripto.forca(s);
                    if (f.pontos < 2 && !(await ADM.ui.confirmar('Esta senha é ' + f.rotulo + '. Usar mesmo assim?', { titulo: 'Senha fraca', rotuloOk: 'Usar mesmo assim' }))) return false;
                    u.senha = await Cripto.novoHash(s);
                    api.fechar(); renderUsuarios(); marcarSujo();
                    ADM.ui.toast(`Nova senha de “${u.nome}” guardada no rascunho. Falta salvar o arquivo e publicar.`, 'ok', 6000);
                },
            }],
        });
    }

    async function excluirUsuario(chave) {
        const u = U.rascunho.find(x => chaveNome(x.nome) === chave); if (!u) return;
        if (!(await ADM.ui.confirmar(`Excluir o usuário “${u.nome}”?`, { titulo: 'Excluir usuário', rotuloOk: 'Excluir', perigo: true, detalhe: 'Só vale depois de salvar o arquivo e publicar. Para apenas bloquear a entrada por um tempo, use “Desativar”.' }))) return;
        U.rascunho = U.rascunho.filter(x => x !== u); renderUsuarios(); marcarSujo();
    }

    async function descartarUsuarios() {
        if (!usuariosSujo()) return;
        if (!(await ADM.ui.confirmar('Descartar as alterações de usuários e voltar ao que está no arquivo?', { titulo: 'Descartar alterações', rotuloOk: 'Descartar', perigo: true }))) return;
        U.rascunho = clone(U.publicado); renderUsuarios(); marcarSujo();
    }

    function confirmarPublicado(cfg) {
        CFG_BASE = clone(cfg); U.publicado = ((cfg.usuarios) || []).map(limpaUsuario); U.rascunho = clone(U.publicado);
        renderUsuarios(); marcarSujo();
    }
    async function salvarUsuarios(btn) {
        if (!usuariosSujo()) return;
        const cfg = Object.assign({}, CFG_BASE, { usuarios: U.rascunho.map(limpaUsuario) });
        if (!cfg.usuarios.length) delete cfg.usuarios;   // lista vazia = volta ao modo de senha única
        const texto = Cripto.textoConfig(cfg);
        await ADM.ui.ocupado(btn, async () => {
            let gravou = false;
            if (ARQ.suportado) { try { gravou = await ARQ.gravar(texto); } catch (e) { if (e.name !== 'AbortError') ADM.ui.toast('Não consegui gravar direto no arquivo: ' + e.message, 'wa', 9000); } }
            if (gravou) confirmarPublicado(cfg);
            janelaPublicarUsuarios(texto, gravou, cfg);
        });
    }
    function janelaPublicarUsuarios(texto, gravou, cfg) {
        const gh = ADM.urlEditarGithub('config/admin-config.js');
        ADM.ui.modal({
            titulo: gravou ? 'Usuários salvos' : 'Salvar os usuários', largura: 620, fecharFora: false,
            corpo: [gravou ? ADM.ui.aviso('ok', h('b', null, 'Salvo!'), ' O arquivo ', h('code', null, ARQ.nome() || 'admin-config.js'), ' foi atualizado com a lista de usuários.')
                           : ADM.ui.aviso('wa', h('b', null, 'Falta colocar o arquivo no projeto.'), ' Copie ou baixe e salve como ', h('code', null, 'config/admin-config.js'), ' (substituindo o antigo).'),
                h('div', { class: 'campo' }, h('span', { class: 'rot' }, 'Agora publique'), h('ol', { class: 'passos' },
                    h('li', null, 'Faça ', h('b', null, 'commit + push'), ' do arquivo ', h('code', null, 'config/admin-config.js'), ' no GitHub.'),
                    h('li', null, 'Aguarde ~1 minuto. ', h('b', null, 'Só depois disso'), ' os usuários novos conseguem entrar.'),
                    h('li', null, 'Quem for desativado, excluído ou tiver a senha trocada perde o acesso em até 5 minutos (ou ao recarregar a página). Mudança de abas vale na hora em que a pessoa recarregar.'),
                    h('li', null, 'Entregue a senha inicial a cada pessoa por um canal seguro. Ela entra pelo mesmo endereço do painel, com o usuário e a senha.'))),
                h('div', { class: 'linha' }, !gravou ? h('button', { class: 'btn peq', type: 'button', onclick: () => ADM.ui.copiar(texto, 'Conteúdo copiado.') }, I('copy', 13), 'Copiar conteúdo') : null,
                    !gravou ? h('button', { class: 'btn peq', type: 'button', onclick: () => ADM.ui.baixar('admin-config.js', texto, 'text/javascript;charset=utf-8') }, I('download', 13), 'Baixar admin-config.js') : null,
                    gh ? h('a', { class: 'btn peq', href: gh, target: '_blank', rel: 'noopener' }, I('ext', 13), 'Abrir no GitHub (editar e colar)') : null)],
            botoes: gravou ? [{ rotulo: 'Fechar', tipo: 'primario' }] : [{ rotulo: 'Ainda não', tipo: 'fantasma' }, { rotulo: 'Já salvei o arquivo no projeto ✔', tipo: 'primario', acao: () => { confirmarPublicado(cfg); } }],
        });
    }

    function chipsAbas(u) {
        const todas = todasAbas().map(a => a.id);
        if (!u.abas.length) return h('span', { class: 'mu' }, 'nenhuma aba');
        if (todas.every(id => u.abas.includes(id))) return h('span', { class: 'sel pr' }, 'todas as abas');
        return h('div', { class: 'chips-abas' }, u.abas.map(id => h('span', { class: 'sel' + (RISCO_ABA[id] ? ' wa' : ''), title: RISCO_ABA[id] ? nomeAba(id) + ' — ' + RISCO_ABA[id] : nomeAba(id) }, nomeAba(id))));
    }
    function renderUsuarios() {
        if (!R.usuarios) return;
        const box = limpar(R.usuarios), sujo = usuariosSujo();
        const pub = new Map(U.publicado.map(u => [chaveNome(u.nome), JSON.stringify(u)])), atuais = new Set(U.rascunho.map(u => chaveNome(u.nome)));
        const removidos = U.publicado.filter(u => !atuais.has(chaveNome(u.nome)));
        let novos = 0, alterados = 0;
        const linhas = [h('tr', null,
            h('td', { style: { minWidth: '170px' } }, h('b', null, 'Administrador principal'), h('div', { class: 'dica' }, 'Entra com a senha do painel (cartão abaixo).')),
            h('td', null, h('span', { class: 'sel pr' }, 'todas as abas')), h('td', null, h('span', { class: 'sel ok' }, 'ativo')), h('td', { class: 'mu' }, '—'),
            h('td', { class: 'acoes mu nw', title: 'O administrador principal não pode ser removido nem limitado' }, 'fixo'))];
        U.rascunho.slice().sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')).forEach(u => {
            const k = chaveNome(u.nome), antes = pub.get(k), estado = antes === undefined ? 'novo' : antes !== JSON.stringify(u) ? 'alterado' : '';
            if (estado === 'novo') novos++; else if (estado === 'alterado') alterados++;
            linhas.push(h('tr', { style: u.ativo ? null : { opacity: .65 } },
                h('td', null, h('b', null, u.nome), ' ', estado ? h('span', { class: 'sel wa', title: 'Ainda não está no arquivo' }, estado) : null),
                h('td', null, chipsAbas(u)),
                h('td', null, u.ativo ? h('span', { class: 'sel ok' }, 'ativo') : h('span', { class: 'sel er' }, 'desativado')),
                h('td', { class: 'nw mu' }, ADM.fmt.dataHora(u.criadoEm).slice(0, 10)),
                h('td', { class: 'acoes' },
                    h('button', { class: 'btn peq', type: 'button', title: 'Editar o nome, as abas e a situação', onclick: () => abrirJanelaUsuario(k) }, I('edit', 13), 'Editar'),
                    h('button', { class: 'btn peq fantasma icone', type: 'button', title: 'Definir uma senha nova para este usuário', 'aria-label': 'Senha', onclick: () => abrirJanelaRedefinir(k) }, I('key', 14)),
                    h('button', { class: 'btn peq fantasma icone', type: 'button', title: u.ativo ? 'Desativar: impede de entrar sem apagar o usuário' : 'Ativar: permite entrar de novo', 'aria-label': u.ativo ? 'Desativar' : 'Ativar', onclick: () => { u.ativo = !u.ativo; renderUsuarios(); marcarSujo(); } }, I(u.ativo ? 'ban' : 'check', 14)),
                    h('button', { class: 'btn peq fantasma icone perigo', type: 'button', title: 'Excluir', 'aria-label': 'Excluir', onclick: () => excluirUsuario(k) }, I('trash', 14)))));
        });
        box.append(
            h('div', { class: 'tabela-wrap', style: { maxHeight: 'none' } }, h('table', { class: 'tabela' },
                h('thead', null, h('tr', null, [['Usuário'], ['Abas liberadas'], ['Situação'], ['Criado em'], ['', 'tr']].map(c => h('th', { class: c[1] || '' }, c[0])))), h('tbody', null, linhas))),
            !U.rascunho.length ? h('div', { class: 'dica' }, 'Nenhum outro usuário ainda. Clique em “Novo usuário” para dar acesso a mais alguém — escolhendo só as abas que a pessoa precisa.') : null,
            h('div', { class: 'usuarios-rodape' },
                sujo ? h('span', { class: 'sel wa' }, '● alterações não salvas: ' + [novos ? novos + ' novo(s)' : '', alterados ? alterados + ' alterado(s)' : '', removidos.length ? removidos.length + ' a remover (' + removidos.map(u => u.nome).join(', ') + ')' : ''].filter(Boolean).join(' · ')) : h('span', { class: 'sel' }, 'sem alterações'),
                h('span', { class: 'grow' }),
                h('button', { class: 'btn fantasma', type: 'button', disabled: !sujo, onclick: descartarUsuarios }, 'Descartar'),
                h('button', { class: 'btn primario', type: 'button', disabled: !sujo, onclick: e => salvarUsuarios(e.currentTarget) }, I('save', 15), 'Salvar no arquivo…')));
    }
    function secUsuarios() {
        if (ADM.auth.modo !== 'local') {
            return h('div', { class: 'cartao' }, h('div', { class: 'cartao-topo' }, h('h3', null, I('user', 16), 'Usuários e acessos')),
                h('div', { class: 'cartao-corpo' }, ADM.ui.aviso('in', h('b', null, 'Modo seguro (Supabase).'), ' Aqui o acesso é pela conta do Supabase Auth, que é uma só. Vários usuários com abas diferentes valem no ', h('b', null, 'modo local'), ' (o login por senha no navegador).')));
        }
        carregarUsuarios();
        R.usuarios = h('div', { class: 'cartao-corpo', style: { paddingTop: 0 } });
        const cartao = h('div', { class: 'cartao' },
            h('div', { class: 'cartao-topo' }, h('h3', null, I('user', 16), 'Usuários e acessos'),
                h('button', { class: 'btn primario', type: 'button', onclick: () => abrirJanelaUsuario(null) }, I('plus', 15), 'Novo usuário')),
            h('div', { class: 'cartao-corpo', style: { paddingBottom: 0 } },
                h('div', { class: 'dica' }, 'Crie logins para outras pessoas e escolha em quais abas cada uma pode entrar. Quem tem uma aba usa tudo o que ela faz: por exemplo, quem tem Logs também pode excluir logs.'),
                ADM.ui.aviso('wa', h('b', null, 'Proteção básica.'), ' No modo local, as abas liberadas organizam o que cada pessoa vê e usa, mas não impedem quem entende de programação de falar direto com o banco — e o hash de cada senha fica no arquivo público do GitHub, então use senhas fortes. Para proteger de verdade, use o modo seguro (README → Segurança).')),
            R.usuarios);
        renderUsuarios();
        return cartao;
    }
    // quem não é o administrador principal vê só o próprio acesso
    function secMeuAcesso() {
        const eu = ADM.auth.usuarioAtual();
        return h('div', { class: 'cartao' }, h('div', { class: 'cartao-topo' }, h('h3', null, I('user', 16), 'Seu acesso')),
            h('div', { class: 'cartao-corpo' }, h('div', { class: 'linha', style: { gap: '6px' } }, h('b', null, eu.nome), h('span', { class: 'mu' }, 'abas liberadas:'), ADM.abas.map(a => h('span', { class: 'sel' }, a.titulo))),
                h('div', { class: 'dica' }, 'Senha, usuários e abas são definidos pelo administrador principal do painel. Para trocar a sua senha ou pedir outra aba, fale com ele.')));
    }

    /* ───────────── cache deste navegador ───────────── */
    const CACHES = ['bsoft_emb_v3', 'bsoft_emb_v2', 'bsoft_emb_v1', 'bsoft_repositorio_cache', 'bsoft_repositorio_vetores', 'bsoft_repositorio_filelist', 'bsoft_central_artigos', 'bsoft_blog_artigos', 'bsoft_mcp_estado', 'bsoft_novidades_v1'];
    const MANTER = ['bsoft_meuespaco_cache_v1', 'bsoft_v27_prefs', 'bsoft_v27_welcomed', 'bsoft_v28_welcomed', 'bsoft_v27_sp_nag', 'bsoft_usuario_nome', 'bsoft_device_id'];
    async function limparCaches() {
        if (!(await ADM.ui.confirmar('Limpar os caches do sistema neste navegador?', { titulo: 'Limpar caches', rotuloOk: 'Limpar', detalhe: 'Apaga os vetores da busca, o cache do repositório/blog e o índice das respostas rápidas. Conversas, Meu Espaço e preferências ficam. O sistema recarrega tudo sozinho na próxima abertura (um pouco mais lenta).' }))) return;
        CACHES.forEach(k => { try { localStorage.removeItem(k); } catch (e) { /* ok */ } });
        await KV.limpar();
        ADM.ui.toast('Caches limpos neste navegador.', 'ok');
    }
    async function limparTudo() {
        if (!(await ADM.ui.confirmar('Apagar TODOS os dados locais do sistema neste navegador e redefinir?', { titulo: '⚠️ Limpeza total', rotuloOk: 'Continuar', perigo: true,
            detalhe: 'Apaga conversas, histórico, aprendizado local e caches. NÃO apaga o Meu Espaço, as preferências visuais, seu nome nem as configurações do painel. Não mexe em nada no banco de dados nem em outros usuários.' }))) return;
        if (!(await ADM.ui.confirmar('Confirmar a limpeza total?', { titulo: 'Última confirmação', rotuloOk: 'Apagar', perigo: true }))) return;
        const guardar = new Map(); MANTER.forEach(k => { const v = localStorage.getItem(k); if (v != null) guardar.set(k, v); });
        for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && /^bsoft[_-]admin/.test(k)) guardar.set(k, localStorage.getItem(k)); }
        localStorage.clear(); guardar.forEach((v, k) => { try { localStorage.setItem(k, v); } catch (e) { /* ok */ } });
        await KV.limpar();
        ADM.ui.toast('Dados locais do sistema apagados neste navegador.', 'ok');
    }

    /* ───────────── informações ───────────── */
    function secInfo() {
        const e = BSOFT_ENV, mcpCfg = (ADM.mcp && ADM.mcp.publicado) || MCP_CFG, host = ((window.BSOFT_CONFIG && BSOFT_CONFIG.supabaseUrl) || '').replace(/^https?:\/\//, '');
        const linha = (r, v) => h('tr', null, h('td', { class: 'mu', style: { width: '210px', fontWeight: 600 } }, r), h('td', null, v));
        return h('div', { class: 'cartao' }, h('div', { class: 'cartao-topo' }, h('h3', null, I('info', 16), 'Informações')),
            h('div', { class: 'tabela-wrap', style: { maxHeight: 'none', border: 0, boxShadow: 'none' } }, h('table', { class: 'tabela' }, h('tbody', null,
                linha('Versão do sistema', 'v' + ((window.BSOFT_CONFIG && BSOFT_CONFIG.versaoApp) || '?')),
                linha('Configuração de IA publicada', 'versão ' + mcpCfg.versao + (mcpCfg.atualizadoEm ? ' · ' + ADM.fmt.dataHora(mcpCfg.atualizadoEm) : '')),
                linha('Onde está rodando', e.githubPages ? 'GitHub Pages' : e.localhost ? 'localhost (servidor local)' : e.arquivoLocal ? 'arquivo aberto do disco' : location.host),
                linha('Banco de dados', host || '—'),
                linha('Modo do painel', ADM.auth.modo === 'supabase' ? 'seguro (Supabase Auth)' : 'local (senha no navegador)'),
                ADM.auth.multiusuario() ? linha('Entrou como', ADM.auth.usuarioAtual().nome + (ADM.auth.ehPrincipal() ? ' (administrador principal)' : ' (usuário com abas limitadas)')) : null,
                ADM.auth.multiusuario() && ADM.auth.ehPrincipal() ? linha('Usuários cadastrados', ((window.BSOFT_ADMIN && BSOFT_ADMIN.usuarios) || []).filter(u => u && u.ativo !== false).length + ' ativo(s) no arquivo publicado') : null,
                linha('Sessão expira por inatividade', ADM.auth.minutosOciosos + ' min'),
                linha('Salvar arquivos direto do painel', sim(ARQ.suportado) + (ARQ.suportado ? '' : ' (use Copiar/Baixar; Edge e Chrome permitem salvar direto)')),
                linha('Criptografia (senha)', sim(Cripto.disponivel())),
                linha('Atalhos', h('span', null, h('kbd', null, 'Alt'), ' + ', h('kbd', null, '1'), '…', h('kbd', null, String(ADM.abas.length)), ' trocam de aba'))))));
    }

    ADM.registrarAba({
        id: 'sistema', titulo: 'Sistema', icone: 'gear', ordem: 80,
        descricao: 'Verificação do banco, usuários e acessos (quem entra e em quais abas), segurança (senha e modo seguro), limpeza do cache deste navegador e informações.',
        sujo: () => usuariosSujo(),   // alterações de usuários ainda não salvas: avisa antes de sair da página
        montar(ctx) {
            R.verif = h('div');
            const principal = ADM.auth.ehPrincipal();
            const btnVerif = h('button', { class: 'btn primario', type: 'button', onclick: e => verificar(e.currentTarget) }, I('activity', 15), 'Rodar verificação');
            ctx.corpo.append(h('div', { class: 'pilha' },
                principal ? secUsuarios() : secMeuAcesso(),
                h('div', { class: 'mcp-grade' },
                    h('div', { class: 'pilha' },
                        h('div', { class: 'cartao' }, h('div', { class: 'cartao-topo' }, h('h3', null, I('database', 16), 'Verificação do banco de dados'), btnVerif),
                            h('div', { class: 'cartao-corpo' }, h('div', { class: 'dica' }, 'Confere se as tabelas e colunas necessárias existem, quantos registros há e como está a segurança. Só lê — não altera nada.'), R.verif)),
                        secInfo()),
                    h('div', { class: 'pilha' }, principal ? secSenha() : null,   // trocar senha é coisa do administrador principal
                        h('div', { class: 'cartao' }, h('div', { class: 'cartao-topo' }, h('h3', null, I('trash', 16), 'Dados locais deste navegador')),
                            h('div', { class: 'cartao-corpo' }, h('div', { class: 'dica' }, 'Afeta só este navegador (o do administrador) — nada nos outros usuários nem no banco de dados.'),
                                h('div', { class: 'linha' }, h('button', { class: 'btn', type: 'button', onclick: limparCaches }, I('refresh', 15), 'Limpar caches'), h('button', { class: 'btn perigo', type: 'button', onclick: limparTudo }, I('trash', 15), 'Limpar tudo e redefinir'))))))));
        },
    });
})();
