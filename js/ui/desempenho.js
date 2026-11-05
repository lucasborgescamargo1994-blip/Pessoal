/* js/ui/desempenho.js — Desempenho automático: se o computador não dá conta do visual, o sistema se ajusta sozinho (e avisa), sem mexer em textos, cores nem posições.

   Por que existe: o visual (fundo animado + vidro) é bonito, mas em computadores simples (placa de vídeo básica, poucos núcleos, acesso remoto) ele pesava. Parte do peso já foi tirada SEM mudar
   o que se vê (css/desempenho.css, js/app/streaming.js); isto aqui é a rede de segurança para os computadores que, mesmo assim, não conseguem ~36 quadros por segundo:
     • "completo": tudo como sempre foi (padrão — é o que quase todo mundo vê);
     • "medio":    para SÓ os movimentos contínuos (deriva do fundo, brilho do logo, giro do anel, brilho do título): fica igual, parado, e o vidro continua;
     • "leve":     se ainda estiver pesado, tira também o vidro (backdrop-filter) — o mesmo que "Leves" em Personalizar › Animações e vidro.
   Como decide (sem IA, sem rede): mede o tempo entre quadros (requestAnimationFrame) por 2 s, só com a janela visível e com foco — a) com o sistema parado, nos primeiros segundos de uso, e
   b) enquanto a IA responde. Duas medidas ruins seguidas (mediana de quadro ≥ 28 ms parado, ≥ 40 ms respondendo) descem um nível; três boas seguidas encerram a vigilância. Computadores com 2 núcleos
   ou menos (ou 2 GB de memória) já começam em "medio" (o visual é o mesmo, só sem os movimentos de fundo).
   Fica gravado SÓ neste computador (localStorage "bsoft_perf", validade de 14 dias — não vai para a pasta do Meu Espaço, para um PC rápido não herdar o ajuste de um lento). A pessoa vê um aviso
   com o botão "Voltar ao completo", e controla em Personalizar › "Ajustar o visual sozinho se o computador estiver lento". Quem escolheu "Leves" ou "Desligadas" em Animações e vidro não é afetado.
   O nível é aplicado como o atributo data-perf no <html> (css/desempenho.css) — e já na primeira pintura (js/core/early.js). */
'use strict';
const Perf = (() => {
    const KEY = 'bsoft_perf', VALIDADE = 14 * 24 * 3600 * 1000;
    const NIVEIS = ['completo', 'medio', 'leve'];
    const LIM_OCIOSO = 28, LIM_OCUPADO = 40;   // milissegundos por quadro (mediana). 28 ms ≈ 36 quadros por segundo
    const raiz = document.documentElement;
    let nivel = 'completo', iniciado = false, timer = 0, sondando = false, estavaOcupado = false;
    let ruinsOciosas = 0, boasOciosas = 0, sondasOciosas = 0, ruinsOcupadas = 0;

    const lerSalvo = () => { try { const o = JSON.parse(localStorage.getItem(KEY) || 'null'); if (!o || !NIVEIS.includes(o.n)) return null; if (Date.now() - (o.t || 0) > VALIDADE) { localStorage.removeItem(KEY); return null; } return o; } catch (e) { return null; } };
    const gravar = o => { try { if (o) localStorage.setItem(KEY, JSON.stringify(o)); else localStorage.removeItem(KEY); } catch (e) { /* sem localStorage: vale só nesta abertura */ } };
    // vale para quem deixou "Animações e vidro" em Completas (o padrão) e não desligou o ajuste automático
    function ativo() { try { return Prefs.get('perfAuto') !== false && (Prefs.get('efeitos') || 'completo') === 'completo'; } catch (e) { return true; } }
    function aplicar(n) { nivel = n; if (n === 'completo') raiz.removeAttribute('data-perf'); else raiz.dataset.perf = n; }
    const fraco = () => { try { return (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2) || (navigator.deviceMemory && navigator.deviceMemory <= 2); } catch (e) { return false; } };
    function podeAmostrar() {
        if (document.visibilityState !== 'visible' || !document.hasFocus()) return false;   // janela escondida/sem foco: o navegador reduz os quadros de propósito
        const vec = document.getElementById('vecOverlay');
        return !(vec && vec.classList.contains('visible'));                                   // preparando a base de conhecimento: o pico é de carga, não do visual (é position:fixed: offsetParent não serve)
    }

    // Mede os quadros por `ms` milissegundos → { ok, mediana, n }. ok = false se a janela perdeu visibilidade/foco no meio ou houve pausa grande (aba em segundo plano).
    function amostrar(ms) {
        return new Promise(resolve => {
            sondando = true;
            const t = []; let ult = 0, invalida = false; const fim = performance.now() + ms;
            const passo = ts => {
                if (document.visibilityState !== 'visible' || !document.hasFocus()) invalida = true;
                if (ult) { const d = ts - ult; if (d < 250) t.push(d); else invalida = true; }
                ult = ts;
                if (!invalida && performance.now() < fim) { requestAnimationFrame(passo); return; }
                sondando = false;
                if (invalida || t.length < 8) { resolve({ ok: false }); return; }
                t.sort((a, b) => a - b);
                resolve({ ok: true, mediana: t[Math.floor(t.length / 2)], n: t.length });
            };
            requestAnimationFrame(passo);
        });
    }

    function avisar(n) {
        const txt = n === 'medio'
            ? '<b>Deixei o sistema mais leve.</b> Este computador estava com dificuldade para animar o fundo, então parei só os movimentos de fundo — o resto continua igual.'
            : '<b>Deixei o visual ainda mais leve.</b> Este computador continuava com dificuldade, então também tirei o efeito de vidro. Textos, cores e posições continuam os mesmos.';
        try { Toast.show(txt + ' Para mudar: Personalizar › Animações e vidro.', { html: true, ms: 16000, icon: 'sparkles', action: { label: 'Voltar ao completo', fn: voltarAoCompleto } }); } catch (e) { /* sem avisos */ }
    }
    function degradar(motivo) {
        const i = NIVEIS.indexOf(nivel);
        if (i < 0 || i >= NIVEIS.length - 1) return;
        const novo = NIVEIS[i + 1];
        aplicar(novo); gravar({ n: novo, t: Date.now(), por: motivo });
        console.info('%c🪶 [desempenho] computador com dificuldade (' + motivo + '): nível "' + novo + '"', 'color:#0e7490;font-weight:600;');
        avisar(novo);
    }
    // a pessoa pediu o visual completo neste computador: vale por 14 dias sem vigiar (ou até ela religar o ajuste automático em Personalizar)
    function voltarAoCompleto() {
        aplicar('completo'); gravar({ n: 'completo', t: Date.now(), fixo: true }); parar();
        try { Toast.show('Pronto: visual completo de volta neste computador, e não vou mais ajustar sozinho por 14 dias. Para voltar ao automático antes, desligue e ligue “Ajustar o visual sozinho” em Personalizar.', { ms: 9000, icon: 'sparkles' }); } catch (e) { /* sem avisos */ }
    }
    function parar() { clearTimeout(timer); timer = 0; }

    // a) com o sistema parado (só no nível "completo": nos outros não há movimento para medir)
    function agendarOciosa(ms) { clearTimeout(timer); timer = setTimeout(sondaOciosa, ms); }
    async function sondaOciosa() {
        if (!ativo() || nivel !== 'completo') return;
        if (sondando || !podeAmostrar()) { agendarOciosa(6000); return; }
        const j = await amostrar(2000);
        if (j.ok) { if (j.mediana >= LIM_OCIOSO) { ruinsOciosas++; boasOciosas = 0; } else { boasOciosas++; ruinsOciosas = 0; } }
        if (ruinsOciosas >= 2) { ruinsOciosas = 0; degradar('quadros lentos com o sistema parado'); return; }
        if (boasOciosas >= 3) return;                        // 3 janelas boas seguidas: está tudo certo, não precisa mais vigiar o sistema parado
        if (++sondasOciosas < 12) agendarOciosa(j.ok ? 3000 : 8000);
    }
    // b) enquanto a IA responde (o ponto mais pesado: o texto aparece em tempo real e o vidro continua por baixo)
    async function aoOcupar() {
        if (!ativo() || nivel === 'leve' || sondando) return;
        await new Promise(r => setTimeout(r, 1200));         // deixa a resposta começar a aparecer
        if (!document.body.classList.contains('ai-busy') || sondando || !podeAmostrar()) return;
        const j = await amostrar(1600);
        if (!j.ok) return;
        if (j.mediana >= LIM_OCUPADO) { if (++ruinsOcupadas >= 2) { ruinsOcupadas = 0; degradar('quadros lentos enquanto a IA responde'); } } else ruinsOcupadas = 0;
    }

    function iniciar() {
        if (iniciado || (typeof IS_PIP !== 'undefined' && IS_PIP)) return;   // Copilot e simulador (janelas embutidas) ficam como estão
        iniciado = true;
        try { new MutationObserver(() => { const on = document.body.classList.contains('ai-busy'); if (on && !estavaOcupado) aoOcupar(); estavaOcupado = on; }).observe(document.body, { attributes: true, attributeFilter: ['class'] }); } catch (e) { /* sem observador */ }
        try { Prefs.on(keys => { if (keys && (keys.includes('*') || keys.includes('perfAuto') || keys.includes('efeitos'))) reavaliar(); }); } catch (e) { /* sem prefs */ }
        arrancar();
    }
    function arrancar() {
        parar();
        if (!ativo()) { aplicar('completo'); return; }
        const s = lerSalvo();
        if (s && s.fixo) { aplicar('completo'); return; }                    // pediu o visual completo neste computador
        if (s) aplicar(s.n);
        else if (fraco()) { aplicar('medio'); gravar({ n: 'medio', t: Date.now(), por: 'equipamento simples' }); }   // sem aviso: o visual é o mesmo, só sem os movimentos de fundo
        else aplicar('completo');
        ruinsOciosas = boasOciosas = sondasOciosas = ruinsOcupadas = 0;
        if (nivel === 'completo') agendarOciosa(7000);
    }
    // a pessoa mexeu em Personalizar (ajuste automático ou Animações e vidro)
    function reavaliar() {
        if (!ativo()) { aplicar('completo'); parar(); return; }
        const s = lerSalvo(); if (s && s.fixo) gravar(null);                 // religou o ajuste automático: recomeça do zero
        arrancar();
    }

    // texto curto para Personalizar: em que modo este computador está agora
    function dica() {
        if (nivel === 'completo') return '';
        return nivel === 'medio' ? ' Agora este computador está sem os movimentos de fundo (ajuste automático).' : ' Agora este computador está sem os movimentos de fundo e sem o vidro (ajuste automático).';
    }
    return { iniciar, nivel: () => nivel, dica, voltarAoCompleto, reavaliar, _teste: { amostrar, degradar, aplicar, lerSalvo, ativo } };
})();
