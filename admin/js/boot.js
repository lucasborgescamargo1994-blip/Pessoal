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

    // Topo: bonequinho + nome de quem está dentro; clicando abre o menu (banco, tema, abrir o sistema, sair)
    function mostrarQuemEntrou() {
        let nome, papel;
        if (ADM.auth.multiusuario()) {
            const u = ADM.auth.usuarioAtual();
            nome = u.nome || 'Administrador';
            papel = u.principal ? 'Administrador principal · todas as abas' : 'Abas liberadas: ' + (ADM.abas.map(a => a.titulo).join(', ') || 'nenhuma');
        } else {
            const u = ADM.auth.usuario();
            nome = !u || u === 'admin' ? 'Administrador' : u;
            papel = ADM.auth.ehPrincipal() ? 'Administrador principal · todas as abas' : 'Abas liberadas: ' + (ADM.abas.map(a => a.titulo).join(', ') || 'nenhuma');
        }
        el('btnUsuarioNome').textContent = nome; el('usuarioPopNome').textContent = nome; el('usuarioPopPapel').textContent = papel;
        el('btnUsuario').setAttribute('aria-label', 'Menu do usuário ' + nome);
    }

    // As abas ficam com nome + ícone enquanto couberem; se não couberem (muitas abas, janela estreita, zoom), viram só ícone (a aberta mostra o nome) — nada fica escondido.
    function ajustarAbas() {
        const nav = el('abas');
        if (!nav || el('app').hidden) return;
        nav.classList.remove('compactas');
        if (nav.scrollWidth > nav.clientWidth + 1) nav.classList.add('compactas');
    }
    function vigiarAbas() {
        const nav = el('abas'); let agendado = false;
        const agendar = () => { if (agendado) return; agendado = true; setTimeout(() => { agendado = false; ajustarAbas(); }, 60); };      // (setTimeout e não requestAnimationFrame: este não roda com a guia em segundo plano)
        window.addEventListener('resize', agendar);
        if (window.ResizeObserver) { const ro = new ResizeObserver(agendar); ro.observe(nav); nav.querySelectorAll('.aba').forEach(a => ro.observe(a)); }      // também quando muda o tamanho de uma aba (selo de pendentes, nome da aberta)
        setInterval(() => { if (!document.hidden) ajustarAbas(); }, 2000);      // rede de segurança: se algum aviso de tamanho não chegar (zoom, fonte que carrega tarde), em até 2 s a barra se acerta
        ajustarAbas();
    }

    function montarMenuUsuario() {
        const caixa = el('usuarioMenu'), botao = el('btnUsuario'), pop = el('menuUsuario');
        const aberto = () => !pop.hidden;
        const abrir = () => { pop.hidden = false; botao.setAttribute('aria-expanded', 'true'); };
        const fechar = (devolverFoco) => { if (!aberto()) return; pop.hidden = true; botao.setAttribute('aria-expanded', 'false'); if (devolverFoco) botao.focus(); };
        botao.addEventListener('click', () => (aberto() ? fechar() : abrir()));
        document.addEventListener('mousedown', e => { if (aberto() && !caixa.contains(e.target)) fechar(); });
        document.addEventListener('keydown', e => { if (e.key === 'Escape' && aberto() && !document.querySelector('#modalRoot .modal')) { fechar(true); e.stopPropagation(); } });
        caixa.addEventListener('focusout', e => { if (aberto() && e.relatedTarget && !caixa.contains(e.relatedTarget)) fechar(); });
        el('btnAbrirApp').addEventListener('click', () => fechar());      // o tema deixa o menu aberto (dá para ver o efeito); abrir o sistema e sair fecham
        el('btnSair').addEventListener('click', () => fechar());
    }

    function abrirPainel(info) {
        el('login').hidden = true; el('app').hidden = false;
        document.querySelectorAll('.ic-slot').forEach(s => s.appendChild(I(s.dataset.ic, 16)));
        ADM.montarAbas();   // só entram as abas que esta pessoa pode usar
        mostrarQuemEntrou(); montarMenuUsuario(); vigiarAbas();
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
