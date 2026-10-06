/* admin/js/aba-sistema.js — Aba "Sistema": verificação do banco, segurança (senha/modo seguro), limpeza do cache deste navegador e informações. */
(function () {
    'use strict';
    const ARQ = ADM.arquivoLocal('admin_cfg_handle', 'admin-config.js', 'Arquivo admin-config.js do projeto');
    const R = {};
    const sim = ok => ok ? '✔ sim' : '✖ não';

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
        return h('div', { class: 'cartao' }, h('div', { class: 'cartao-topo' }, h('h3', null, I('key', 16), 'Alterar a senha do painel')),
            h('div', { class: 'cartao-corpo' },
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
                if (!(await Cripto.conferir(c.atual.value, window.BSOFT_ADMIN.senha))) { ADM.ui.toast('A senha atual não confere.', 'er'); c.atual.focus(); return; }
                if (c.nova.value.length < 8) { ADM.ui.toast('A nova senha precisa ter pelo menos 8 caracteres.', 'wa'); c.nova.focus(); return; }
                if (c.nova.value !== c.repete.value) { ADM.ui.toast('A repetição não é igual à nova senha.', 'wa'); c.repete.focus(); return; }
                const f = Cripto.forca(c.nova.value);
                if (f.pontos < 2 && !(await ADM.ui.confirmar('Esta senha é ' + f.rotulo + '. Usar mesmo assim?', { titulo: 'Senha fraca', rotuloOk: 'Usar mesmo assim' }))) return;
                const senha = await Cripto.novoHash(c.nova.value);
                const texto = Cripto.textoConfig(Object.assign({}, window.BSOFT_ADMIN, { senha }));
                let gravou = false;
                if (ARQ.suportado) { try { gravou = await ARQ.gravar(texto); } catch (e) { if (e.name !== 'AbortError') ADM.ui.toast('Não consegui gravar direto no arquivo: ' + e.message, 'wa', 9000); } }
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
                linha('Sessão expira por inatividade', ADM.auth.minutosOciosos + ' min'),
                linha('Salvar arquivos direto do painel', sim(ARQ.suportado) + (ARQ.suportado ? '' : ' (use Copiar/Baixar; Edge e Chrome permitem salvar direto)')),
                linha('Criptografia (senha)', sim(Cripto.disponivel())),
                linha('Atalhos', h('span', null, h('kbd', null, 'Alt'), ' + ', h('kbd', null, '1'), '…', h('kbd', null, String(ADM.abas.length)), ' trocam de aba'))))));
    }

    ADM.registrarAba({
        id: 'sistema', titulo: 'Sistema', icone: 'gear', ordem: 80,
        descricao: 'Verificação do banco, segurança (senha e modo seguro), limpeza do cache deste navegador e informações.',
        montar(ctx) {
            R.verif = h('div');
            const btnVerif = h('button', { class: 'btn primario', type: 'button', onclick: e => verificar(e.currentTarget) }, I('activity', 15), 'Rodar verificação');
            ctx.corpo.append(h('div', { class: 'mcp-grade' },
                h('div', { class: 'pilha' },
                    h('div', { class: 'cartao' }, h('div', { class: 'cartao-topo' }, h('h3', null, I('database', 16), 'Verificação do banco de dados'), btnVerif),
                        h('div', { class: 'cartao-corpo' }, h('div', { class: 'dica' }, 'Confere se as tabelas e colunas necessárias existem, quantos registros há e como está a segurança. Só lê — não altera nada.'), R.verif)),
                    secInfo()),
                h('div', { class: 'pilha' }, secSenha(),
                    h('div', { class: 'cartao' }, h('div', { class: 'cartao-topo' }, h('h3', null, I('trash', 16), 'Dados locais deste navegador')),
                        h('div', { class: 'cartao-corpo' }, h('div', { class: 'dica' }, 'Afeta só este navegador (o do administrador) — nada nos outros usuários nem no banco de dados.'),
                            h('div', { class: 'linha' }, h('button', { class: 'btn', type: 'button', onclick: limparCaches }, I('refresh', 15), 'Limpar caches'), h('button', { class: 'btn perigo', type: 'button', onclick: limparTudo }, I('trash', 15), 'Limpar tudo e redefinir')))))));
        },
    });
})();
