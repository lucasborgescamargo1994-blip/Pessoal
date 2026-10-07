/* admin/js/boot.js — Liga tudo: tela de entrada → painel com abas. */
'use strict';
(function () {
    const SAL_DA_MIGRACAO = 'E2dkVWxSL44rgW1viaXwCg==';   // sal da senha antiga trazida do sistema v27 (ela estava escrita no código — precisa ser trocada)
    const el = id => document.getElementById(id);
    let contagem = null;

    function msgLogin(txt, tipo) { const m = el('loginMsg'); m.textContent = txt || ''; m.className = 'login-msg' + (tipo ? ' ' + tipo : ''); }

    function travaVisual() {
        const falta = ADM.auth.bloqueioRestante();
        if (contagem) { clearInterval(contagem); contagem = null; }
        if (!falta) { el('loginEntrar').disabled = false; return; }
        el('loginEntrar').disabled = true;
        const t0 = Date.now();
        contagem = setInterval(() => {
            const resta = falta - Math.floor((Date.now() - t0) / 1000);
            if (resta <= 0) { clearInterval(contagem); contagem = null; el('loginEntrar').disabled = false; msgLogin(''); return; }
            msgLogin(`Muitas tentativas seguidas. Aguarde ${resta}s.`);
        }, 500);
        msgLogin(`Muitas tentativas seguidas. Aguarde ${falta}s.`);
    }

    function mostrarLogin() {
        el('app').hidden = true; el('login').hidden = false;
        const seguro = ADM.auth.modo === 'supabase';
        el('campoNome').hidden = seguro;
        if (!seguro) {
            // com usuários cadastrados o campo vira "Usuário" (o administrador principal pode deixar em branco ou usar o nome que quiser)
            const multi = ADM.auth.multiusuario(), campo = el('loginNome');
            el('loginNomeRot').textContent = multi ? 'Usuário' : 'Seu nome';
            el('loginNomeDica').textContent = multi ? '(administrador principal: pode deixar em branco)' : '(opcional — aparece no histórico de revisões)';
            campo.placeholder = multi ? 'Seu usuário' : 'Ex.: Lucas'; campo.setAttribute('autocomplete', multi ? 'username' : 'name');
            campo.value = ADM.auth.nomeSalvo();
        }
        const sup = el('loginModoSup');
        if (seguro) {
            sup.hidden = false; limpar(sup).appendChild(I('shield', 17));
            sup.appendChild(h('div', { class: 'corpo' }, 'Modo seguro (Supabase). Entrando como ', h('b', null, (window.BSOFT_ADMIN && BSOFT_ADMIN.supabaseEmail) || '(e-mail não configurado)'), '.'));
            el('loginRotulo').textContent = 'Senha do administrador';
        }
        el('loginDica').textContent = seguro
            ? 'A sessão fica salva neste navegador até você clicar em Sair ou ficar ' + ADM.auth.minutosOciosos + ' min sem usar.'
            : 'Proteção básica de acesso. Para proteger também o banco de dados, ative o modo seguro (README → Segurança).';
        if (!seguro && !Cripto.disponivel()) msgLogin('Este endereço não permite conferir a senha (precisa de HTTPS, localhost ou arquivo aberto do disco).');
        const aviso = ADM.auth.aviso(); if (aviso) msgLogin(aviso);
        travaVisual();
        setTimeout(() => el('loginSenha').focus(), 50);
    }

    async function enviarLogin(ev) {
        ev.preventDefault();
        const btn = el('loginEntrar');
        if (btn.disabled) return;
        msgLogin('');
        const r = await ADM.ui.ocupado(btn, () => ADM.auth.entrar(el('loginSenha').value, el('loginNome').value));
        if (r.ok) { el('loginSenha').value = ''; abrirPainel(r); return; }
        msgLogin(r.erro);
        const card = el('formLogin'); card.classList.remove('erro'); void card.offsetWidth; card.classList.add('erro');
        el('loginSenha').value = ''; el('loginSenha').focus();
        travaVisual();
    }

    function alternarTema() {
        const novo = document.documentElement.getAttribute('data-tema') === 'escuro' ? 'claro' : 'escuro';
        document.documentElement.setAttribute('data-tema', novo);
        lsSet('bsoft_admin_tema', novo);
    }

    function avisoSenhaAntiga() {
        const c = window.BSOFT_ADMIN || {};
        if (ADM.auth.modo !== 'local' || !ADM.auth.ehPrincipal() || !c.senha || c.senha.sal !== SAL_DA_MIGRACAO) return;
        const faixa = ADM.ui.aviso('wa', h('b', null, 'Troque a senha de administrador.'), ' Esta ainda é a senha antiga do sistema, que ficava escrita à vista no código do v26/v27 — considere-a pública. Vá em ',
            h('a', { href: '#/sistema' }, 'Sistema → Alterar senha'), '.');
        faixa.style.marginBottom = '14px'; faixa.id = 'avisoSenhaAntiga';
        el('painel').prepend(faixa);
    }

    // com usuários cadastrados, mostra no topo quem está dentro (e, ao passar o mouse, as abas liberadas)
    function mostrarQuemEntrou() {
        if (!ADM.auth.multiusuario()) return;
        const u = ADM.auth.usuarioAtual();
        el('chipUsuarioTxt').textContent = '👤 ' + (u.principal ? (u.nome || 'Administrador') + ' · principal' : u.nome);
        el('chipUsuario').title = u.principal ? 'Administrador principal: todas as abas' : 'Abas liberadas para você: ' + (ADM.abas.map(a => a.titulo).join(', ') || 'nenhuma');
        el('chipUsuario').hidden = false;
    }

    function abrirPainel(info) {
        el('login').hidden = true; el('app').hidden = false;
        document.querySelectorAll('.ic-slot').forEach(s => s.appendChild(I(s.dataset.ic, 16)));
        ADM.montarAbas();   // só entram as abas que esta pessoa pode usar
        mostrarQuemEntrou();
        if (!ADM.abas.length) {
            el('painel').appendChild(ADM.ui.vazio('🔒', 'Seu usuário ainda não tem acesso a nenhuma aba', 'Peça ao administrador do painel para liberar as abas que você precisa.'));
        } else {
            const pedido = (location.hash.match(/^#\/([a-z0-9-]+)/) || [])[1];
            let guardada = null; try { guardada = sessionStorage.getItem('bsoft_admin_aba'); } catch (e) { /* ok */ }
            ADM.irParaAba([pedido, guardada, 'revisao'].find(id => id && ADM.abas.some(a => a.id === id)) || ADM.abas[0].id);
            window.addEventListener('hashchange', () => { const id = (location.hash.match(/^#\/([a-z0-9-]+)/) || [])[1]; if (id && ADM.abas.some(a => a.id === id)) ADM.irParaAba(id); });
        }

        el('btnSair').addEventListener('click', async () => {
            if (ADM.temAlteracoes() && !(await ADM.ui.confirmar('Há alterações que ainda não foram salvas (por exemplo na aba IA / MCP). Sair mesmo assim?', { titulo: 'Sair da área administrativa', rotuloOk: 'Sair e descartar', perigo: true }))) return;
            ADM.auth.sair();
        });
        el('btnTema').addEventListener('click', alternarTema);
        document.addEventListener('keydown', e => {   // Alt+1…9 troca de aba
            if (!e.altKey || e.ctrlKey || e.metaKey) return;
            const m = /^Digit([1-9])$/.exec(e.code); if (!m) return;
            const aba = ADM.abas[Number(m[1]) - 1]; if (aba) { e.preventDefault(); ADM.irParaAba(aba.id); }
        });
        window.addEventListener('beforeunload', e => { if (!ADM._saindo && ADM.temAlteracoes()) { e.preventDefault(); e.returnValue = ''; } });

        ADM.testarBanco();
        window.addEventListener('online', ADM.testarBanco);
        if (ADM.atualizarPendentes && ADM.podeAba('revisao')) { ADM.atualizarPendentes(); setInterval(() => { if (document.visibilityState === 'visible') ADM.atualizarPendentes(); }, 3 * 60 * 1000); }   // o selo da Revisão só para quem tem essa aba
        avisoSenhaAntiga();
        if (info && info.avisoRls) ADM.ui.toast('Login feito, mas as regras de segurança do banco (SQL 03) ainda não estão instaladas — o banco continua aberto. Veja README → Segurança.', 'wa', 12000);
    }

    async function iniciar() {
        el('formLogin').addEventListener('submit', enviarLogin);
        el('loginOlho').addEventListener('click', () => { const i = el('loginSenha'); i.type = i.type === 'password' ? 'text' : 'password'; });
        if (!window.supabase || !window.BSOFT_CONFIG) {
            el('login').hidden = false; msgLogin('Não consegui carregar o Supabase (sem internet ou bloqueado?). Recarregue a página.'); el('loginEntrar').disabled = true; return;
        }
        ADM.sb = criarClienteSupabase(BSOFT_CONFIG.supabaseUrl, BSOFT_CONFIG.supabaseAnonKey, { persistirSessao: ADM.auth.modo === 'supabase', storageKey: 'bsoft-admin-auth' });
        if (await ADM.auth.restaurar()) abrirPainel(); else mostrarLogin();
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();
})();
