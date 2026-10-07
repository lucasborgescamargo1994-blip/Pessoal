/* js/app/feedback-log.js — Log das perguntas, resposta apresentada e feedback (👍/👎).
   Fluxo de revisão (v28): TODA pergunta feita no chat vira uma linha em "logs" — a 1ª da conversa e também as seguintes (v28.3), para o log
   contar 100% do uso. Quando a resposta termina, ela é gravada NA LINHA DAQUELA PERGUNTA (colunas resposta/fonte/modelo, revisao = 'pendente').
   O 👍/👎 de cada resposta vai para a linha da própria resposta (data-log-ts no cartão). Na Área Administrativa (aba "Revisão") você aprova ou
   rejeita: aprovada vira uma "resposta rápida" (tabela respostas_rapidas).
   Junto da resposta vai a lista dos DADOS DO BANCO DE DADOS que a IA recebeu para montá-la (coluna fontes_banco, SQL 04): na Revisão, cada item
   pode ser aberto para corrigir o conteúdo na própria base. Ver fontesDoBanco() e registrarRespostaNoLog().
   No simulador (?sim=1) nada disso é gravado.
   As ferramentas em abas (SEFAZ, Regras, Relatórios, Parâmetros) têm o seu próprio registro: ver js/app/ferramentas.js. */

let currentLogTimestamp = null;
let perguntaPrimariaAtual = "";
let _avisouSqlPendente = false;
let _semColunaFontes = false;   // vira true quando o banco diz que a coluna fontes_banco (SQL 04) não existe: as próximas respostas nem tentam gravar as fontes

// Avisa uma vez só (no console) quando as colunas novas ainda não existem no Supabase.
function _avisarSqlPendente(error) {
    if (_avisouSqlPendente) return;
    _avisouSqlPendente = true;
    console.warn('[log] Não consegui gravar a resposta no log (as colunas novas ainda não existem?). Rode sql/02_respostas_rapidas_e_revisao.sql no Supabase. Detalhe:', error && error.message);
}
function _colunaAusente(error) {
    return !!error && (error.code === '42703' || error.code === 'PGRST204' || /column .* does not exist|could not find the .* column/i.test(error.message || ''));
}

// Lista compacta dos dados do banco de dados que entraram no prompt da IA — é o que a aba Revisão mostra em "Dados do banco de dados usados".
// Cada item: { tipo, id, titulo, pct }:
//   tipo   'banco' (artigo da base de conhecimento) | 'rr' (resposta rápida aprovada usada como conhecimento) | 'param' (Parâmetros) |
//          'func' (Funcionalidades) | 'rotina' (Rotinas) | 'repo' (documento do repositório) | 'ml' (conhecimento aprendido)
//   id     chave do registro na tabela de origem (null quando não há uma: repositório, aprendizado e rotinas — a tabela Rotinas não tem coluna id)
//   pct    relevância 0–100 (semelhança da busca)
//   chave  (só rotinas) o "Nome Interno" da rotina — é por ele que a Revisão encontra o registro na aba Banco de dados
// Recebe { artigos, aprovadas, parametros, funcionalidades, rotinas } exatamente como o chat os montou. Títulos cortados em 90 caracteres:
// o log guarda só o suficiente para achar e abrir o registro (o conteúdo é lido na hora, da própria base, quando alguém clica).
function fontesDoBanco(p) {
    p = p || {};
    const corta = (t, n) => String(t == null ? '' : t).replace(/\s+/g, ' ').trim().slice(0, n);
    const pct = x => Math.max(0, Math.min(100, Math.round((Number(x) || 0) * 100)));
    const out = [];
    (p.artigos || []).forEach(r => {
        const tipo = r.isRepositorio ? 'repo' : r.isML ? 'ml' : 'banco';
        // artigos vetorizados guardam o id em idSupabase; os da busca por palavra-chave vêm da linha crua do banco, onde o id é "id"
        const id = r.idSupabase != null ? r.idSupabase : (tipo === 'banco' && r.id != null ? r.id : null);
        out.push({ tipo, id, titulo: corta(r.erro || r.titulo || '(sem título)', 90), pct: pct(r.similaridade) });
    });
    (p.aprovadas || []).forEach(x => out.push({ tipo: 'rr', id: x.item.id, titulo: corta(x.item.pergunta, 90), pct: pct(x.score) }));
    (p.parametros || []).forEach(x => out.push({ tipo: 'param', id: x.item.id, titulo: corta(x.item['Descrição'] || x.item['Nome Interno'] || '(sem descrição)', 90), pct: pct(x.sim) }));
    (p.funcionalidades || []).forEach(x => out.push({ tipo: 'func', id: x.item.id, titulo: corta(x.item['Descrição'] || '(sem descrição)', 90), pct: pct(x.sim) }));
    (p.rotinas || []).forEach(x => out.push({ tipo: 'rotina', id: null, titulo: corta(x.item['Descrição'] || x.item['Nome Interno'] || '(sem descrição)', 90), pct: pct(x.sim), chave: corta(x.item['Nome Interno'], 80) }));
    return out;
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
// dados.fontes (opcional) = o que fontesDoBanco() devolveu. Vai na coluna fontes_banco (SQL 04): se ela ainda não existir, a resposta é gravada
// do mesmo jeito, só sem as fontes — gravar a resposta (e mandá-la para a Revisão) nunca pode depender da coluna nova.
function registrarRespostaNoLog(ts, dados) {
    if (BSOFT_SIM || !ts || !dados) return;
    const texto = String(dados.resposta || '').trim();
    if (!texto) return;
    const upd = { resposta: texto.slice(0, 12000), fonte: dados.fonte || 'ia', revisao: dados.revisao || 'pendente' };
    if (dados.modelo) upd.modelo = dados.modelo;
    const fontes = Array.isArray(dados.fontes) && !_semColunaFontes ? dados.fontes : null;   // [] = a IA não recebeu nenhum dado do banco (vale gravar)
    const gravar = async payload => (await sb.from('logs').update(payload).eq('timestamp', ts)).error;
    (async () => {
        if (fontes) {
            const erro = await gravar({ ...upd, fontes_banco: fontes });
            if (!erro) return;
            if (_colunaAusente(erro)) {
                _semColunaFontes = true;
                console.warn('[log] A coluna fontes_banco ainda não existe — a Revisão não vai mostrar quais dados do banco a IA usou. Rode sql/04_logs_fontes_banco.sql no Supabase. (A resposta é gravada normalmente.)');
            }
        }
        const erro = await gravar(upd);   // sem as fontes (coluna ausente ou qualquer falha da 1ª tentativa)
        if (erro) _avisarSqlPendente(erro);
    })().catch(e => console.warn('[log] falha ao gravar a resposta no log:', e));
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
