/* js/app/feedback-log.js — Log das perguntas, resposta apresentada e feedback (👍/👎).
   Fluxo de revisão (v28): a 1ª pergunta de cada conversa vira uma linha em "logs". Quando a resposta termina,
   ela é gravada nessa mesma linha (colunas resposta/fonte/modelo, revisao = 'pendente'). Na Área Administrativa
   (aba "Revisão") você aprova ou rejeita: aprovada vira uma "resposta rápida" (tabela respostas_rapidas).
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

// Registra a pergunta do CHAT e devolve o timestamp do log — ou null se não registrou.
// Regra: a 1ª pergunta registrada de cada conversa gera log (as seguintes não). A conversa só é marcada como "já registrada"
// quando o log é de fato gravado — então uma saudação, um clique de atalho ou o uso de uma ferramenta em aba NUNCA gastam o log
// da primeira pergunta de verdade. (Antes a regra era "só se for a 1ª mensagem do usuário": qualquer coisa antes da pergunta
// fazia a pergunta nunca ser registrada.)
function logSearch(query, found, extra) {
    if (BSOFT_SIM) return null;   // simulador: nenhum log
    const conversa = getConversaAtiva();
    if (!conversa) return null;
    if (conversa.logTimestamp) {
        console.log("⏭️ Log ignorado (esta conversa já tem a 1ª pergunta registrada):", String(query).substring(0, 50));
        return null;
    }
    const ts = registrarLog(query, found, extra);
    if (!ts) return null;
    currentLogTimestamp = ts;
    perguntaPrimariaAtual = query;
    conversa.primeiraPergunta = query;
    conversa.logTimestamp = ts;
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

// Grava a resposta apresentada na linha de log da 1ª pergunta ("ts" = valor devolvido por logSearch).
function registrarRespostaNoLog(ts, dados) {
    if (BSOFT_SIM || !ts || !dados) return;
    const texto = String(dados.resposta || '').trim();
    if (!texto) return;
    const upd = { resposta: texto.slice(0, 12000), fonte: dados.fonte || 'ia', revisao: dados.revisao || 'pendente' };
    if (dados.modelo) upd.modelo = dados.modelo;
    sb.from('logs').update(upd).eq('timestamp', ts).then(({ error }) => { if (error) _avisarSqlPendente(error); });
}

// A que linha de log pertence o botão 👍/👎 clicado? Dentro de uma ferramenta em aba → ao registro dela; senão → à conversa do chat.
function _alvoFeedback(btn) {
    const ft = btn && btn.closest ? btn.closest('[data-ferr]') : null;
    if (ft) { const s = Ferr.sessao(ft.dataset.ferr); return { pergunta: s.pergunta || '?', ts: s.ts }; }
    const conversa = getConversaAtiva();
    return { pergunta: conversa?.primeiraPergunta || perguntaPrimariaAtual || lastQuery || "?", ts: conversa?.logTimestamp || currentLogTimestamp };
}

async function saveFeedback(logIndex, type, btn) {
    const feedbackArea = btn.parentElement;
    const { pergunta: perguntaParaLog, ts: timestampLog } = _alvoFeedback(btn);

    console.log("📝 Feedback associado à pergunta primária:", perguntaParaLog, "| timestamp:", timestampLog);

    if (type === 'positivo') {
        try {
            await sb.from('logs').update({feedback: "Positivo", pergunta: perguntaParaLog}).eq('timestamp', timestampLog);
            console.log("✅ Feedback POSITIVO enviado para Supabase");
        } catch(e) {
            console.error("Erro ao enviar feedback positivo:", e);
        }
        feedbackArea.innerHTML = "<span style='color:#166534;font-weight:700;'>👍 Obrigado pelo feedback positivo!</span>";
    } else {
        try {
            await sb.from('logs').update({feedback: "Negativo", pergunta: perguntaParaLog}).eq('timestamp', timestampLog);
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
        await sb.from('logs').update({feedback: "Negativo", pergunta: perguntaParaLog, motivo: motivo}).eq('timestamp', timestampLog);
        console.log("📝 Feedback detalhado enviado:", motivo);
        feedbackArea.innerHTML = "<span style='color:#dc2626;font-weight:700;'>⚠️ Feedback negativo registrado! Vamos melhorar.</span>";
    } catch(e) {
        console.error("Erro ao enviar feedback detalhado:", e);
        feedbackArea.innerHTML = "<span style='color:#dc2626;font-weight:700;'>Erro ao enviar. Tente novamente.</span>";
    }
}
