/* js/app/feedback-log.js — Log das perguntas, resposta apresentada e feedback (👍/👎).
   Fluxo de revisão (v28): TODA pergunta feita no chat vira uma linha em "logs" — a 1ª da conversa e também as seguintes (v28.3), para o log
   contar 100% do uso. Quando a resposta termina, ela é gravada NA LINHA DAQUELA PERGUNTA (colunas resposta/fonte/modelo, revisao = 'pendente').
   O 👍/👎 de cada resposta vai para a linha da própria resposta (data-log-ts no cartão). Na Área Administrativa (aba "Revisão") você aprova ou
   rejeita: aprovada vira uma "resposta rápida" (tabela respostas_rapidas).
   No simulador (?sim=1) nada disso é gravado.
   As ferramentas em abas (SEFAZ, Regras, Relatórios, Parâmetros) têm o seu próprio registro: ver js/app/ferramentas.js. */

let currentLogTimestamp = null;
let perguntaPrimariaAtual = "";
let _avisouSqlPendente = false;

// Avisa uma vez só (no console) quando as colunas novas ainda não existem no Supabase.
function _avisarSqlPendente(error) {
    if (_avisouSqlPendente) return;
    _avisouSqlPendente = true;
    console.warn('[log] Não consegui gravar a resposta no log (as colunas novas ainda não existem?). Rode sql/02_respostas_rapidas_e_revisao.sql no Supabase. Detalhe:', error && error.message);
}

// Grava UMA linha de log (não depende de conversa). Devolve o timestamp da linha — ou null se não gravou (simulador).
// `extra` (opcional): { fonte, resposta, modelo, resposta_rapida_id } — gravado junto quando as colunas existem.
function registrarLog(query, found, extra) {
    if (BSOFT_SIM) return null;   // simulador: nenhum log
    try { verificarNomeUsuario(); } catch (e) { console.warn('[log] sem o nome do usuário (prompt indisponível):', e && e.message); }   // sem isso um navegador sem prompt() derrubava o chat inteiro
    const ts = getBrasiliaTimestamp();
    try {
        const base = {
            pergunta: query,
            encontrou: found,
            feedback: "Pendente",
            timestamp: ts,
            usuario_windows: getWindowsUser(),
            device_id: getOrCreateDeviceId()
        };
        // Tentativas em ordem; as colunas que talvez não existam no banco vão sendo retiradas (device_id, usuario_windows e as novas)
        const tentativas = [];
        if (extra && Object.keys(extra).length) tentativas.push({ ...base, ..._extraLog(extra) });
        tentativas.push(base);
        const { device_id, ...semDevice } = base; tentativas.push(semDevice);
        const { usuario_windows, ...minimo } = semDevice; tentativas.push(minimo);
        (async () => {
            let ultimoErro = null;
            for (let i = 0; i < tentativas.length; i++) {
                const { error } = await sb.from('logs').insert(tentativas[i]);
                if (!error) { if (i > 0 && extra && Object.keys(extra).length) _avisarSqlPendente(ultimoErro); return; }
                ultimoErro = error;
            }
            console.error('registrarLog error:', ultimoErro);
        })();
    } catch (e) { console.error(e); }
    return ts;
}

// Registra a pergunta do CHAT e devolve o timestamp do log — ou null se não registrou (simulador).
// Regra (v28.3): TODA pergunta registrada gera a sua própria linha de log — a 1ª da conversa e as seguintes. Cada linha leva a sua resposta
// (que vai para a Revisão) e o seu 👍/👎; quem chama guarda o timestamp devolvido para gravar a resposta e apontar o feedback na linha certa.
// Saudação ("oi", "obrigado"), "agenda" e cliques que não perguntam nada não chamam esta função, então não contam.
// opcoes.umaPorConversa: só para as ferramentas SEM aba (Copilot) — elas passam por várias etapas e cada etapa chama o log, então
// registram 1 vez por conversa (como sempre foi), em vez de uma linha por etapa.
function logSearch(query, found, extra, opcoes) {
    if (BSOFT_SIM) return null;   // simulador: nenhum log
    const conversa = getConversaAtiva();
    if (!conversa) return null;
    if (opcoes && opcoes.umaPorConversa && conversa.logTimestamp) {
        console.log("⏭️ Log ignorado (ferramenta sem aba: esta conversa já tem registro):", String(query).substring(0, 50));
        return null;
    }
    const ts = registrarLog(query, found, extra);
    if (!ts) return null;
    currentLogTimestamp = ts;
    perguntaPrimariaAtual = query;
    if (!conversa.logTimestamp) conversa.primeiraPergunta = query;   // o título/busca da conversa continuam pela 1ª pergunta registrada
    conversa.ultimaPerguntaLog = query;
    conversa.logTimestamp = ts;   // timestamp da ÚLTIMA pergunta registrada: o 👍/👎 que não tem endereço próprio (assistentes antigos) vai para ela
    salvarConversas();
    return ts;
}
function _extraLog(extra) {
    const e = {};
    if (extra.fonte) e.fonte = extra.fonte;
    if (extra.modelo) e.modelo = extra.modelo;
    if (extra.resposta) e.resposta = String(extra.resposta).slice(0, 12000);
    if (extra.resposta_rapida_id != null) e.resposta_rapida_id = extra.resposta_rapida_id;
    if (extra.resposta) e.revisao = extra.revisao || (extra.fonte === 'rapida' ? 'nao_se_aplica' : 'pendente');
    return e;
}

// Grava a resposta apresentada na linha de log da pergunta que a gerou ("ts" = valor devolvido por logSearch).
function registrarRespostaNoLog(ts, dados) {
    if (BSOFT_SIM || !ts || !dados) return;
    const texto = String(dados.resposta || '').trim();
    if (!texto) return;
    const upd = { resposta: texto.slice(0, 12000), fonte: dados.fonte || 'ia', revisao: dados.revisao || 'pendente' };
    if (dados.modelo) upd.modelo = dados.modelo;
    sb.from('logs').update(upd).eq('timestamp', ts).then(({ error }) => { if (error) _avisarSqlPendente(error); });
}

// A que linha de log pertence o botão 👍/👎 clicado?
//  1) dentro de uma ferramenta em aba → ao registro dela;
//  2) numa resposta do chat com endereço próprio (data-log-ts, gravado pelo cartão da resposta) → à linha DAQUELA pergunta — mesmo que a
//     pessoa já tenha feito outras perguntas depois (a pergunta não precisa ser reescrita: a linha já a tem);
//  3) senão (assistentes antigos sem endereço) → à última pergunta registrada da conversa.
function _alvoFeedback(btn) {
    const ft = btn && btn.closest ? btn.closest('[data-ferr]') : null;
    if (ft) { const s = Ferr.sessao(ft.dataset.ferr); return { pergunta: s.pergunta || '?', ts: s.ts }; }
    const al = btn && btn.closest ? btn.closest('[data-log-ts]') : null;
    if (al && al.dataset.logTs) return { pergunta: '', ts: al.dataset.logTs };
    const conversa = getConversaAtiva();
    return { pergunta: conversa?.ultimaPerguntaLog || conversa?.primeiraPergunta || perguntaPrimariaAtual || lastQuery || "?", ts: conversa?.logTimestamp || currentLogTimestamp };
}
const _campoPergunta = p => p ? { pergunta: p } : {};   // só reescreve a pergunta quando o alvo não tem linha própria

async function saveFeedback(logIndex, type, btn) {
    const feedbackArea = btn.parentElement;
    const { pergunta: perguntaParaLog, ts: timestampLog } = _alvoFeedback(btn);

    console.log("📝 Feedback associado à pergunta primária:", perguntaParaLog, "| timestamp:", timestampLog);

    if (type === 'positivo') {
        try {
            await sb.from('logs').update({feedback: "Positivo", ..._campoPergunta(perguntaParaLog)}).eq('timestamp', timestampLog);
            console.log("✅ Feedback POSITIVO enviado para Supabase");
        } catch(e) {
            console.error("Erro ao enviar feedback positivo:", e);
        }
        feedbackArea.innerHTML = "<span style='color:#166534;font-weight:700;'>👍 Obrigado pelo feedback positivo!</span>";
    } else {
        try {
            await sb.from('logs').update({feedback: "Negativo", ..._campoPergunta(perguntaParaLog)}).eq('timestamp', timestampLog);
            console.log("⚠️ Feedback NEGATIVO enviado para Supabase");
        } catch(e) {
            console.error("Erro ao enviar feedback negativo:", e);
        }
        feedbackArea.innerHTML = `<div class="reason-box" style="display:flex;">
            <textarea id="reason_${logIndex}" placeholder="O que faltou na resposta? Descreva o problema para melhorarmos."></textarea>
            <button onclick="sendDetailedFeedback(${logIndex}, this)">Enviar Feedback</button>
        </div>`;
    }
}

async function sendDetailedFeedback(logIndex, btn) {
    const reasonArea = document.getElementById(`reason_${logIndex}`);
    const motivo = reasonArea?.value?.trim() || "Sem motivo informado";
    const feedbackArea = btn.parentElement.parentElement;
    const { pergunta: perguntaParaLog, ts: timestampLog } = _alvoFeedback(btn);

    try {
        await sb.from('logs').update({feedback: "Negativo", ..._campoPergunta(perguntaParaLog), motivo: motivo}).eq('timestamp', timestampLog);
        console.log("📝 Feedback detalhado enviado:", motivo);
        feedbackArea.innerHTML = "<span style='color:#dc2626;font-weight:700;'>⚠️ Feedback negativo registrado! Vamos melhorar.</span>";
    } catch(e) {
        console.error("Erro ao enviar feedback detalhado:", e);
        feedbackArea.innerHTML = "<span style='color:#dc2626;font-weight:700;'>Erro ao enviar. Tente novamente.</span>";
    }
}
