/* js/migracao/iniciar.js — Primeira emissão guiada: liga tudo ao abrir a página (migracao.html).
   1) a aparência que a pessoa escolheu em Personalizar no sistema principal (cor de destaque e fundo);
   2) o que o cliente já respondeu e o ponto em que parou (guardados no navegador) → mostra as perguntas ou o passo a passo;
   3) a base de conhecimento (BancoDados, respostas aprovadas, FAQ, parâmetros): é lida em segundo plano — a página já funciona antes de ela chegar. */
(function () {
    'use strict';
    const E = Mig;

    // ── aparência: usa a cor e o fundo que a pessoa escolheu em Personalizar no sistema principal ──
    try {
        const p = JSON.parse(localStorage.getItem('bsoft_v27_prefs') || '{}') || {};
        const h = document.documentElement;
        h.dataset.bg = p.bg || 'aurora'; h.dataset.efeitos = p.efeitos || 'completo';
        if (p.accent && /^#[0-9a-f]{3,8}$/i.test(p.accent) && p.accentRgb) { h.style.setProperty('--primary', p.accent); h.style.setProperty('--primary-rgb', String(p.accentRgb).replace(/[^0-9, ]/g, '').replace(/,/g, ' ').replace(/\s+/g, ' ').trim()); }
    } catch (e) { /* sem preferências: padrão */ }

    // ── base de conhecimento ──
    async function carregarDados() {
        const d = E.dados; d.estado = 'carregando'; d.erro = ''; E.emit('dados-estado');
        try { MigDados.iniciar(); } catch (e) { d.estado = 'erro'; d.erro = e.message; E.construirIndices(); E.emit('dados-estado'); E.emit('dados-prontos'); return; }
        const [b, r, f, p, fu] = await Promise.allSettled([MigDados.carregarBanco(), MigDados.carregarRapidas(), MigDados.carregarFaq(), MigDados.carregarParametros(), MigDados.carregarFuncionalidades()]);
        if (b.status === 'fulfilled') d.banco = b.value; else { d.estado = 'erro'; d.erro = String((b.reason && b.reason.message) || b.reason || 'falha de rede').slice(0, 120); console.error('[migração] BancoDados:', b.reason); }
        if (r.status === 'fulfilled') { d.rapidas = r.value.itens; d.rapidasExiste = r.value.existe; }
        if (f.status === 'fulfilled') { d.faq = f.value.itens; d.faqExiste = f.value.existe; }
        if (p.status === 'fulfilled') d.params = p.value.itens;
        if (fu.status === 'fulfilled') d.funcs = fu.value.itens;
        if (d.estado !== 'erro') d.estado = 'pronto';
        E.construirIndices();
        E.emit('dados-estado'); E.emit('dados-prontos');
        console.log('[migração] base: ' + d.banco.length + ' artigos, ' + d.rapidas.length + ' respostas rápidas, ' + d.faq.length + ' FAQ, ' + d.params.length + ' parâmetros, ' + d.funcs.length + ' funcionalidades');
    }

    E.carregarLocal();
    E.construirIndices(true);                       // regras, glossário e vídeos não dependem do banco: a busca deles já funciona
    window.addEventListener('storage', ev => { if (ev.key === MigDados.chaveLocal()) { E.carregarLocal(); E.iniciarTela(); } });
    E.iniciarTela();
    carregarDados();
    window.MigCarregarDados = carregarDados;        // (também facilita testar)
})();
