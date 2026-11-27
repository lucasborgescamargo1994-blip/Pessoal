/* js/app/agente-voz.js — o AGENTE nas CHAMADAS DE VOZ (v29.3.0).
   A Conversa rápida (js/app/conversa-voz.js, o 📞 padrão) tinha o seu próprio caminho curto: busca enxuta (js/app/voz-consulta.js) + um prompt próprio + um modelo. Agora, quando o agente está ligado, quem PENSA a resposta
   da chamada é o agente (o mesmo motor do chat: pesquisa no banco de artigos, respostas aprovadas, parâmetros, rejeições da SEFAZ, menu real e regras fiscais), num MODO VOZ do motor: prompt curto, sem ferramentas,
   a pesquisa entra como texto e o limite de espera é bem menor. O que continua do conversa-voz.js: ouvir e detectar o fim da frase, cortar a resposta em 1–2 frases, "quer que eu continue?", "deixa eu ver…",
   interromper, o placar de modelos, o chat e o log. Esta ponte devolve ao conversa-voz.js o fluxo da resposta NO MESMO FORMATO de um modelo ({ leitor, ler, modelo, ttft, inicial }), então o resto não muda.
   Qualquer falha (agente ainda carregando, 1ª palavra demorou, erro) devolve null e o conversa-voz.js segue pelo caminho de sempre NAQUELE turno; depois de 2 falhas seguidas o agente fica desligado até o fim da chamada.
   Liga/desliga: Personalizar › "Usar o Agente de IA nas chamadas de voz" (pref agenteVoz, padrão ligado) · ?agente=0 desliga todo o agente. Ajustes finos: config/app-config.js → "agenteVoz": { … } (ver PADRAO).
   A voz AO VIVO (Gemini) fala com o modelo do Google; nela o agente entra só como a fonte do conhecimento (AgenteVoz.consultar). */
'use strict';
const AgenteVoz = (() => {
    const VERSAO = '29.3.0';
    const PADRAO = {
        primeiraPalavraMs: 8000,   // sem 1ª palavra do agente depois disso (tempo de pesquisa + 1ª palavra do modelo), o turno segue pelo caminho de sempre
        config: { artigosPrevios: 1, charsPrevios: 4200, quantidadePrevia: 3, maxTokensResposta: 170, temperatura: 0.4, raciocinio: 'desligado' },   // o que o motor usa só nesta pergunta
        limites: { parte: 3800, maxChars: 4800 },                                                                                                       // tamanho máximo do que cada ferramenta/pesquisa devolve
        tempos: { primeiroByte: 6500, semDados: 9000, total: 45000 },                                                                                   // limites de UMA chamada à IA (o chat espera até 70 s; a voz não pode)
        falhasSeguidas: 2,         // depois de tantas falhas seguidas o agente sai da chamada
        consulta: { artigosPrevios: 2, charsPrevios: 6000, quantidadePrevia: 4 },                                                                       // AgenteVoz.consultar (voz ao vivo): um pouco mais de conhecimento
    };
    const cfg = () => Object.assign({}, PADRAO, (typeof window !== 'undefined' && window.BSOFT_CONFIG && window.BSOFT_CONFIG.agenteVoz) || {});
    const motor = () => (typeof window !== 'undefined' ? window.Agente : null);
    const limpar = s => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();

    function ativo(V) {
        try { if (typeof location !== 'undefined' && /[?&]agente=0(?:&|$)/.test(location.search)) return false; } catch (e) { /* sem location */ }
        const A = motor();
        if (!A || !A.agente || !A.prereq || typeof AgenteChat === 'undefined') return false;
        try { if (Prefs.get('agenteVoz') === false) return false; } catch (e) { /* sem preferências: vale o padrão (ligado) */ }
        return !(V && (V.agenteFalhas || 0) >= cfg().falhasSeguidas);
    }
    const pronto = () => { const A = motor(); return !!(A && A.agente && A.agente.estado && A.agente.estado.fase === 'pronto'); };
    // chamado ao começar a chamada: deixa o motor pronto (normalmente já está: o chat o prepara numa folga logo depois de abrir)
    function preparar() { try { if (typeof AgenteChat !== 'undefined') AgenteChat.prepararMotor().catch(() => { /* a 1ª pergunta cai no caminho de sempre */ }); } catch (e) { /* idem */ } }

    // O que a pessoa pediu para CONTINUAR: o agente diz só o próximo trecho (a pesquisa de "continua" é refeita junto da pergunta anterior, o próprio motor junta as duas)
    const instrucaoContinuar = ja => 'A pessoa pediu para CONTINUAR. O que você JÁ FALOU (não repita nada disso): "' + limpar(ja).slice(0, 500) + '"\nDiga agora só o PRÓXIMO trecho do que está no CONHECIMENTO (1 ou 2 frases curtas). Se já não houver mais nada, diga que é só isso e pergunte se pode ajudar em mais alguma coisa.';

    // erro da cadeia → minutos "de castigo" no placar do conversa-voz.js (mesma ideia do abrirModelo dele)
    function castigo(erro) {
        const e = String(erro || '');
        if (/429|limite de uso/i.test(e)) return { min: 5, motivo: 'HTTP 429' };
        if (/tempo esgotado|408/i.test(e)) return { min: 10, motivo: 'lento' };
        if (/vazia/i.test(e)) return { min: 10, motivo: 'vazio' };
        return { min: 15, motivo: e.slice(0, 40) || 'falhou' };
    }

    /* o: { pergunta, historico:[{role,content}], continuar, ultimaResposta, ordemDeModelos:[nomes], aoModelo?({modelo, ttft}), aoRuim?(modelo, min, motivo), aoPrevia?({ titulos, fontes, usados, ms }) }
       → Promise<{ leitor, ler, modelo, ttft, inicial, viaAgente: true, fim: Promise<resultado> }> | null (não deu: o chamador segue pelo caminho de sempre). T.abort / T.leitor ficam a cargo do chamador. */
    async function abrir(T, o) {
        const A = motor(), k = cfg();
        if (!ativo() || !pronto()) { if (ativo()) preparar(); return null; }
        const ac = new AbortController(); T.abort = ac;
        const t0 = performance.now();
        const fila = []; let acordar = null, terminou = false, enviado = '', resultado = null, erro = null, modelo = '', ttft = 0;
        const empurrar = x => { fila.push(x); if (acordar) { const f = acordar; acordar = null; f(); } };
        const ordem = (o.ordemDeModelos || []).slice();
        const posicao = m => { const i = ordem.indexOf(m); return i < 0 ? 999 : i; };
        const fim = (async () => {
            try {
                resultado = await A.agente.responder({
                    pergunta: o.pergunta, historico: o.historico || [], voz: true, semAtalhos: true, sinal: ac.signal,
                    instrucaoExtra: o.continuar ? instrucaoContinuar(o.ultimaResposta) : '', config: k.config, limites: k.limites,
                    mcp: {
                        tempos: k.tempos, tentativas: 1, semEspera: true,
                        ordenar: passos => passos.slice().sort((a, b) => posicao(a.modelo) - posicao(b.modelo)),
                        aoPrimeiraPalavra: x => { modelo = x.modelo; ttft = x.ttft; if (o.aoModelo) { try { o.aoModelo(x); } catch (e) { /* só o placar */ } } },
                    },
                    aoEvento: e => {
                        if (e.tipo === 'texto') {   // texto parcial CUMULATIVO e já saneado (sem código de parâmetro, sem LaTeX, sem "pensamento"): empurra só o que cresceu
                            const t = String(e.texto || '');
                            if (t.length > enviado.length && t.startsWith(enviado)) { empurrar({ conteudo: t.slice(enviado.length) }); enviado = t; }
                        } else if (e.tipo === 'previa') {   // a pesquisa no banco terminou (antes da IA): fontes para a tela da chamada e para o log
                            if (o.aoPrevia) { try { o.aoPrevia(e); } catch (x) { /* só a tela */ } }
                        } else if (e.tipo === 'tentativa' && e.tentativa && e.tentativa.erro && o.aoRuim) {
                            const c = castigo(e.tentativa.erro); try { o.aoRuim(e.tentativa.modelo, c.min, c.motivo); } catch (x) { /* só o placar */ }
                        }
                    },
                });
                if (resultado && resultado.tipo === 'resposta' && !enviado && resultado.texto) { empurrar({ conteudo: resultado.texto }); enviado = resultado.texto; }   // (o motor não mandou pedaços: fala o texto inteiro)
            } catch (e) { erro = e; }
            terminou = true;
            empurrar({ conteudo: '', fim: (resultado && resultado.motivoFinal) || (erro ? 'erro' : 'stop'), acabou: true });
            return resultado;
        })();
        const leitor = {
            read: () => new Promise(resolve => { const tenta = () => { if (fila.length) resolve({ done: false, value: fila.shift() }); else if (terminou) resolve({ done: true }); else acordar = tenta; }; tenta(); }),
            cancel: () => { try { ac.abort(); } catch (e) { /* já terminou */ } },
        };
        const ler = x => ({ conteudo: (x && x.conteudo) || '', raciocinio: false, fim: (x && x.fim) || '', acabou: !!(x && x.acabou) });
        // espera a 1ª palavra (conteúdo) — ou desiste
        const limite = new Promise(res => setTimeout(() => res({ esgotou: true }), k.primeiraPalavraMs));
        for (;;) {
            if (T.cancelado) { try { ac.abort(); } catch (e) { /* já terminou */ } return null; }
            const lido = await Promise.race([leitor.read(), limite]);
            if (lido.esgotou) { try { ac.abort(); } catch (e) { /* já terminou */ } return null; }
            if (lido.done) return null;
            const x = ler(lido.value);
            if (x.conteudo) return { leitor, ler, modelo: modelo || 'agente', ttft: ttft || Math.round(performance.now() - t0), inicial: x, viaAgente: true, fim };
            if (x.acabou) { return null; }   // terminou sem falar nada (ex.: todos os modelos falharam e o motor devolveu o "modo de emergência": artigo, não fala)
        }
    }

    // As fontes e o "encontrou?" do log desta pergunta (o mesmo formato que o chat e o Agente do chat gravam)
    function dadosDoLog(res) {
        const usados = (res && res.usados) || {};
        let fontes = []; try { fontes = AgenteChat.logica.fontesParaLog(usados); } catch (e) { /* log sem fontes */ }
        const encontrou = (usados.itens || []).some(i => i && (i.sim != null ? i.sim >= 0.5 : (i.cobertura || 0) >= 0.9)) || !!(usados.aprovadas && usados.aprovadas.length);
        return { fontes, encontrou, titulos: (res && res.fontes || []).map(f => f.titulo).filter(Boolean).slice(0, 4) };
    }

    /* Só o CONHECIMENTO (para a voz ao vivo/Gemini, que fala com o modelo do Google): a mesma pesquisa do agente, devolvida como texto no formato do VozConsulta ({ texto, encontrou, fontes, titulos }).
       Sem IA. null/erro = o chamador usa o VozConsulta de sempre. */
    async function consultar(pergunta, historico) {
        const A = motor(), k = cfg();
        if (!ativo() || !pronto()) return null;
        const r = await A.agente.consultar({ pergunta, historico: historico || [], config: Object.assign({}, k.config, k.consulta), limites: k.limites });
        if (!r || !r.texto) return null;
        const texto = (typeof Prereq !== 'undefined' && Prereq.semCodigo) ? Prereq.semCodigo(r.texto) : r.texto;   // o modelo da voz ao vivo nunca recebe o número de parâmetro/funcionalidade
        const d = dadosDoLog({ usados: r.usados, fontes: r.fontes });
        return { texto, encontrou: !!r.encontrou, fontes: d.fontes, titulos: r.titulos || d.titulos || [] };
    }

    return { VERSAO, PADRAO, ativo, pronto, preparar, abrir, dadosDoLog, consultar, castigo, instrucaoContinuar };
})();
