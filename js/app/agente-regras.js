/* js/app/agente-regras.js — A PONTE entre a geração de regras (Criar Regra › Ct-e / Conhecimento Nova Versão e Beta) e o AGENTE DE REGRAS (v29.2.0).
   A geração de regras NÃO usava o agente: era "um prompt + uma chamada de IA" (+ uma correção) e a IA só conhecia o texto fixo do prompt. O motor (js/agente/motor.js › Agente.regrasIA, fonte em agente-bsoft/nucleo/regras-ia.js):
     • põe no prompt a documentação OFICIAL da equipe que está na base de conhecimento (o manual "Funções disponíveis…" + os artigos que combinam com o pedido: IBS/CBS, advalorem, CST 60, KM progressivo…);
     • CONFERE cada resposta com as conferências do chat (js/app/regra-cte-passos.js › _cnProblemasDaResposta com ctx.agente: sintaxe, função/campo que não existe, ICMS, ordem das linhas, linha perdida, loop)
       e, havendo problema, devolve a lista para a IA corrigir — até 3 vezes (antes: 1 correção). Resposta limpa de primeira = nenhuma chamada a mais.
   Esta ponte só faz a LIGAÇÃO: entrega ao motor o prompt que o gerador clássico já monta (enviarWizardRegraDnd, js/app/tutorial-regras.js), liga as conferências e devolve o resultado no formato que o resto do fluxo
   (loop, alerta do ICMS, cartão da regra, "Voltar") já entende. Qualquer falha devolve null/erro e o gerador clássico assume — como sempre foi.
   Liga/desliga: Personalizar › "Usar o Agente de IA nas regras" (pref agenteRegras, padrão ligado) · ?agente=0 no endereço desliga tudo do agente. Teste: tools/bancada-desempenho/teste-regras-validador.js (conferências) e teste-regras-agente.js. */
'use strict';
const AgenteRegras = (() => {
    const VERSAO = '29.2.0';
    const motor = () => (typeof window !== 'undefined' ? window.Agente : null);
    // categorias de problema que SÓ o agente cobra (as do ICMS e da ordem o chat já mostra no próprio cartão: não repetir)
    const RE_NOVOS = /^(?:SINTAXE|VALIDACAO|A funcao |O\(s\) campo\(s\)|A regra original definia|LOOP:)/;

    function ativo() {
        try { if (typeof location !== 'undefined' && /[?&]agente=0(?:&|$)/.test(location.search)) return false; } catch (e) { /* sem location */ }
        const A = motor();
        if (!A || !A.regrasIA || typeof AgenteChat === 'undefined' || typeof _regraLimparContinuacao !== 'function') return false;
        try { return Prefs.get('agenteRegras') !== false; } catch (e) { return true; }
    }

    // o: { sysMsg, userMsg, pedido, original, nomes[], assistente (CTE_ASSISTENTES[x]), aoStatus(texto), sinal }
    // → { text, _iaUsada: 'Agente', _iaModelo, agente: { reparos, chamadasIA, problemas[], referencia, apoio[], ms, tokens, avisos } }
    async function gerar(o) {
        const A = motor();
        if (!ativo()) throw new Error('o agente de regras não está ligado');
        await AgenteChat.prepararMotor();   // entrega ao motor os artigos que o chat JÁ baixou (a 1ª vez leva 1–3 s; depois já está pronto)
        const status = t => { try { if (o.aoStatus) o.aoStatus(t); } catch (e) { /* só a tela */ } };
        const base = { original: o.original || '', pedido: o.pedido || '', nomes: o.nomes || [], agente: true };
        const validar = (texto, info) => o.assistente && o.assistente.problemasNaResposta ? o.assistente.problemasNaResposta(texto, Object.assign({}, base, { docs: (info && info.docs) || '' })) : [];
        const r = await A.regrasIA.gerar({
            sistema: o.sysMsg, usuario: o.userMsg, pedido: o.pedido, validar, limpar: _regraLimparContinuacao, sinal: o.sinal,
            aceitaSemCodigo: t => /^[\s*`#>-]*LOOP DETECTADO[\s*`]*:/i.test(String(t || '')),   // a recusa de loop que o prompt manda a IA fazer (ver CN_LOOP_PROMPT)
            aoEvento: e => {
                if (e.tipo === 'fundamentacao') status('📚 Elaborando a regra com a documentação da equipe' + (e.referencia ? ' (manual de funções' + (e.apoio.length ? ' + ' + e.apoio.length + ' artigo(s) do assunto' : '') + ')' : '') + '…');
                else if (e.tipo === 'etapa' && e.rodada > 0) status('🔎 ' + e.texto);
            },
        });
        const nota = notaDoAgente(r);
        return {
            text: r.texto + nota, _iaUsada: 'Agente', _iaModelo: r.modelo,
            agente: { reparos: r.reparos, chamadasIA: r.chamadasIA, problemas: r.problemas, referencia: r.referencia, apoio: r.apoio, ms: r.ms, tokens: r.tokens, avisos: r.avisos, rodadas: r.rodadas },
        };
    }

    // O que o agente fez, em uma linha no fim da resposta (e, se sobrou problema que ele não conseguiu corrigir, a lista — para a pessoa conferir antes de usar). Só texto: o cartão lê o código pelos ```.
    function notaDoAgente(r) {
        if (!/```/.test(r.texto || '')) return '';   // recusa ("LOOP DETECTADO: …") ou pergunta: sem nota
        const base = [r.referencia ? 'manual de funções da equipe (A' + r.referencia.id + ')' : '', ...(r.apoio || []).map(a => 'A' + a.id + ' ' + String(a.titulo || '').slice(0, 40))].filter(Boolean);
        const sobras = (r.problemas || []).filter(p => RE_NOVOS.test(p));
        let t = '\n\n**🤖 Agente de Regras:** regra conferida automaticamente (sintaxe, funções e campos, ICMS, ordem das linhas, loops)'
            + (r.reparos ? ' — ' + r.reparos + ' correção(ões) feita(s) antes de entregar' : ' — nada a corrigir')
            + (base.length ? ' · base: ' + base.join('; ') : '') + '.';
        if (sobras.length) t += '\n**⚠️ Ainda sobrou na conferência (confira antes de usar):**\n' + sobras.slice(0, 5).map(p => '- ' + p).join('\n');
        return t;
    }

    return { VERSAO, ativo, gerar, notaDoAgente, RE_NOVOS };
})();
