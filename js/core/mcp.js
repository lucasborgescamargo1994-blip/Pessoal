/* ═══════════════════════════════════════════════════════════════════════════
   js/core/mcp.js — IA (MCP = Multi-Cloud Provider)

   • Lê a configuração de config/mcp-config.js (o arquivo que você publica no GitHub);
   • confere se saiu uma configuração nova a cada 2 horas (enquanto a página estiver aberta);
   • monta a cadeia de modelos (principal → fallbacks) e faz as chamadas.
   Usado pelo app (index.html) e pela Área Administrativa (admin/).
   Funciona abrindo o arquivo direto do computador (file://), em localhost e no GitHub Pages:
   o arquivo de configuração é carregado por <script> (sem fetch), então não dá erro de CORS.
   ═══════════════════════════════════════════════════════════════════════════ */
const PROVIDER_PRESETS = {
    openrouter: { baseUrl:'https://openrouter.ai/api/v1', models:['inclusionai/ling-3.0-flash-sante:free','cohere/north-mini-code:free','nvidia/nemotron-3.5-lightning:free','nvidia/nemotron-3-ultra-550b-a55b:free','nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free','google/gemma-4-31b-it:free','nvidia/nemotron-3-super-120b-a12b:free','thinkingmachines/inkling:free'], defaultModel:'inclusionai/ling-3.0-flash-fin:free', chatEndpoint:'/chat/completions', headers:(k)=>({Authorization:`Bearer ${k}`,'Content-Type':'application/json','HTTP-Referer':window.location.origin,'X-Title':'Bsoft TMS Suporte'}), formatRequestBody:(m,msgs,c={})=>({model:m,messages:msgs,temperature:c.temperature||0.3,max_tokens:c.maxTokens||4096,...(c.responseFormat?{response_format:c.responseFormat}:{})}), parseResponse:(d)=>{if(d.error)throw new Error(d.error.message||'Erro OpenRouter');return{text:d.choices?.[0]?.message?.content||'',finishReason:d.choices?.[0]?.finish_reason||'',full:d};} },
    google: { baseUrl:'https://generativelanguage.googleapis.com/v1beta', models:['gemma-4-26b-a4b-it','gemini-2.0-flash','gemini-2.0-flash-lite','gemini-2.5-flash'], defaultModel:'gemma-4-26b-a4b-it', chatEndpoint:'/models/{model}:generateContent', headers:()=>({'Content-Type':'application/json'}), formatRequestBody:(m,msgs,c={})=>{const cnt=msgs.map(m=>({role:m.role==='assistant'?'model':'user',parts:[{text:typeof m.content==='string'?m.content:JSON.stringify(m.content)}]}));return{contents:cnt,generationConfig:{temperature:c.temperature||0.3,maxOutputTokens:c.maxTokens||4096,...(c.responseFormat?.type==='json_object'?{responseMimeType:'application/json'}:{})}};}, parseResponse:(d)=>{if(d.error)throw new Error(d.error.message||'Erro Google');const p=d.candidates?.[0]?.content?.parts||[];return{text:p.filter(p=>p.text).map(p=>p.text).join(''),finishReason:d.candidates?.[0]?.finishReason||'',full:d};}, buildUrl:(b,m,e)=>`${b}${e.replace('{model}',m)}` },
    custom: { baseUrl:'',models:[],defaultModel:'',chatEndpoint:'/chat/completions', headers:(k)=>({Authorization:`Bearer ${k}`,'Content-Type':'application/json'}), formatRequestBody:(m,msgs,c={})=>({model:m,messages:msgs,temperature:c.temperature||0.3,max_tokens:c.maxTokens||4096,...(c.responseFormat?{response_format:c.responseFormat}:{})}), parseResponse:(d)=>{if(d.error)throw new Error(d.error.message||'Erro API');return{text:d.choices?.[0]?.message?.content||'',finishReason:d.choices?.[0]?.finish_reason||'',full:d};} }
};
/* ═══════════ IDIOMA: SEMPRE português do Brasil ═══════════
   Modelos pequenos/grátis (principalmente os de código, como o North Mini, que costuma ser o fallback) respondem em inglês quando
   ninguém diz o idioma. Por isso TODA chamada à IA passa por mcpComIdioma(): a instrução vai no INÍCIO da primeira mensagem do
   usuário e no FIM da última (o fim é o que os modelos pequenos mais obedecem). É feito aqui, dentro de formatRequestBody, para valer
   para qualquer fluxo (chat, parâmetros, regras, relatórios, rascunho, painel admin) sem depender de cada um lembrar.
   Rede de segurança (se mesmo assim sair inglês): mcpPareceIngles() + mcpTraduzirParaPtBr() — usadas por _criarGuardaIdioma() em streaming.js. */
const MCP_IDIOMA_TXT = 'IDIOMA OBRIGATÓRIO: escreva TODA a resposta em português do Brasil (pt-BR), mesmo que a pergunta, o material de apoio ou o código estejam em inglês ou em outro idioma. NUNCA responda em inglês. Mantenha exatamente como estão: nomes de telas/menus/campos do sistema, códigos, fórmulas, trechos de regra e o formato pedido (ex.: JSON).';
function mcpComIdioma(msgs, cfg) {
    if ((cfg && cfg.idioma === false) || !Array.isArray(msgs) || !msgs.length) return msgs;
    const ult = msgs.map(m => m && m.role).lastIndexOf('user'), pri = msgs.findIndex(m => m && m.role === 'user');
    if (ult < 0) return msgs;
    const tem = c => (typeof c === 'string' ? c.includes('IDIOMA OBRIGATÓRIO') : Array.isArray(c) && c.some(p => p && typeof p.text === 'string' && p.text.includes('IDIOMA OBRIGATÓRIO')));
    if (tem(msgs[ult].content)) return msgs;   // já tem (as chamadas passam por camadas): não duplica
    const out = msgs.slice();
    const comFim = c => (typeof c === 'string' ? c + '\n\n' + MCP_IDIOMA_TXT : Array.isArray(c) ? c.concat([{ type: 'text', text: MCP_IDIOMA_TXT }]) : c);
    const comInicio = c => (typeof c === 'string' ? MCP_IDIOMA_TXT + '\n\n' + c : Array.isArray(c) ? [{ type: 'text', text: MCP_IDIOMA_TXT }].concat(c) : c);
    // fim da última mensagem do usuário (o que os modelos pequenos mais obedecem) + começo da primeira (vale também quando é a mesma mensagem)
    out[ult] = Object.assign({}, msgs[ult], { content: comFim(msgs[ult].content) });
    if (pri >= 0) out[pri] = Object.assign({}, out[pri], { content: comInicio(out[pri].content) });
    return out;
}
Object.keys(PROVIDER_PRESETS).forEach(k => { const p = PROVIDER_PRESETS[k], orig = p.formatRequestBody; p.formatRequestBody = (m, msgs, c) => orig(m, mcpComIdioma(msgs, c), c); });

// 08/09/2026: conferi ao vivo no catálogo da OpenRouter e vários modelos grátis usados aqui
// tinham saído do ar (a versão :free foi descontinuada, ou o nome mudou) — por isso a chamada de
// fallback dava 404. Troquei pelos que confirmei funcionando de verdade (chamada real, resposta
// válida) nessa mesma data. Como o catálogo grátis da OpenRouter muda com frequência, se algum
// desses parar de funcionar de novo no futuro, é só repetir essa conferência.
const MODEL_LABELS = {
    'inclusionai/ling-3.0-flash-sante:free':          'Ling 3.0 Flash Sante ⭐ (principal)',
    'cohere/north-mini-code:free':             		  'North Mini Code (secundário)',
    'nvidia/nemotron-3-super-120b-a12b:free':         'Nemotron 3 Super',
    'nvidia/nemotron-3-ultra-550b-a55b:free':         'Nemotron Ultra 550B',
    'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free': 'Nemotron Nano 30B Reasoning',
    'nvidia/nemotron-3.5-lightning:free':             'Nemotron 3.5 Lightning',
    'google/gemma-4-31b-it:free':                     'Gemma 4 31B',
    'thinkingmachines/inkling:free':                  'Inkling',
    'gemma-4-26b-a4b-it':                             'Gemma 4 26B (fallback padrão)',
    'gemini-2.0-flash':                               'Gemini 2.0 Flash',
    'gemini-2.0-flash-lite':                          'Gemini 2.0 Flash Lite',
    'gemini-2.5-flash':                               'Gemini 2.5 Flash',
};

/* ── Rótulos amigáveis dos modelos (usados no painel administrativo) ── */
Object.assign(MODEL_LABELS, {
    'inclusionai/ling-3.0-flash-fin:free': 'Ling 3.0 Flash Fin',
    'inclusionai/ling-3.0-flash-vl:free': 'Ling 3.0 Flash VL',
    'inclusionai/ling-3.0-flash-sante:free': 'Ling 3.0 Flash Sante',
    'cohere/north-mini-code:free': 'North Mini Code',
    'google/gemma-4-26b-a4b-it:free': 'Gemma 4 26B',
});

/* ═══════════ CONFIGURAÇÃO (arquivo config/mcp-config.js) ═══════════ */
let MCP_CFG = null;                  // configuração ativa (normalizada)
let DEFAULT_MCP_CONFIG = null;       // { provider, model, apiKey, baseUrl } — provedor padrão + modelo do rascunho (nome mantido por compatibilidade)
let mcpConfig = null;                // modelo "prioritário" (se ativado) ou igual ao padrão — nome mantido por compatibilidade
let JINA_KEY = '';                   // chave dos embeddings
let _VISION_MODELS = [];             // modelos com visão (Analisar tela)
const MCP_ESTADO = { hash: '', origem: '', aplicadoEm: 0 };
const MCP_VERIFICACAO = { intervaloMs: 2 * 60 * 60 * 1000, ultima: Date.now(), emAndamento: false, ultimoResultado: null, desligado: false };

const mcpJuntar = c => Array.isArray(c) ? c.join('') : String(c == null ? '' : c);
const mcpChaveArray = c => Array.isArray(c) ? c.map(String) : (c ? [String(c)] : []);
function mcpDividirChave(s, n = 14) { s = String(s || '').trim(); const p = []; for (let i = 0; i < s.length; i += n) p.push(s.slice(i, i + n)); return p; }
function mcpRotuloProvedor(tipo) { return tipo === 'google' ? 'Google' : tipo === 'custom' ? 'Custom' : 'OpenRouter'; }

function mcpPadrao() {
    return {
        versao: 1, atualizadoEm: '', atualizadoPor: '',
        provedor: { tipo: 'openrouter', baseUrl: 'https://openrouter.ai/api/v1', chave: [] },
        cadeia: [],
        rascunho: { ativo: true, modelo: 'cohere/north-mini-code:free' },
        prioritario: { ativo: false, tipo: 'openrouter', baseUrl: '', chave: [], modelo: '' },
        visao: [],
        embeddings: { modelo: 'jina-embeddings-v3', chave: [] },
        // usarNoContexto/contextoMax: além de responder direto, as respostas aprovadas entram no prompt da IA como conhecimento (até "contextoMax" delas)
        respostasRapidas: { ativo: true, limiarLexical: 0.8, limiarSemantico: 0.92, minTermos: 2, usarNoContexto: true, contextoMax: 3 },
    };
}
// Aceita o objeto do arquivo (mesmo incompleto/com erro de digitação) e devolve sempre um objeto completo.
function mcpNormalizar(raw) {
    const d = mcpPadrao(), r = (raw && typeof raw === 'object') ? raw : {};
    const out = {
        versao: parseInt(r.versao, 10) || 1,
        atualizadoEm: String(r.atualizadoEm || ''),
        atualizadoPor: String(r.atualizadoPor || ''),
        provedor: Object.assign({}, d.provedor, r.provedor || {}),
        cadeia: (Array.isArray(r.cadeia) ? r.cadeia : []).filter(x => x && x.modelo).map(x => ({ modelo: String(x.modelo).trim(), ativo: x.ativo !== false })),
        rascunho: Object.assign({}, d.rascunho, r.rascunho || {}),
        prioritario: Object.assign({}, d.prioritario, r.prioritario || {}),
        visao: (Array.isArray(r.visao) ? r.visao : []).map(String).filter(Boolean),
        embeddings: Object.assign({}, d.embeddings, r.embeddings || {}),
        respostasRapidas: Object.assign({}, d.respostasRapidas, r.respostasRapidas || {}),
    };
    out.provedor.chave = mcpChaveArray(out.provedor.chave);
    out.prioritario.chave = mcpChaveArray(out.prioritario.chave);
    out.embeddings.chave = mcpChaveArray(out.embeddings.chave);
    out.rascunho.ativo = out.rascunho.ativo !== false;
    out.prioritario.ativo = out.prioritario.ativo === true;
    out.respostasRapidas.ativo = out.respostasRapidas.ativo !== false;
    ['limiarLexical', 'limiarSemantico'].forEach(k => { const v = Number(out.respostasRapidas[k]); out.respostasRapidas[k] = (v > 0 && v <= 1) ? v : d.respostasRapidas[k]; });
    out.respostasRapidas.minTermos = Math.max(1, parseInt(out.respostasRapidas.minTermos, 10) || d.respostasRapidas.minTermos);
    out.respostasRapidas.usarNoContexto = out.respostasRapidas.usarNoContexto !== false;
    out.respostasRapidas.contextoMax = Math.min(6, Math.max(1, parseInt(out.respostasRapidas.contextoMax, 10) || d.respostasRapidas.contextoMax));   // (sem clamp(): este arquivo carrega antes de util.js)
    return out;
}
// Impressão digital do CONTEÚDO (ignora versão/data/autor): é ela que decide se a configuração mudou.
function mcpHash(cfg) {
    const base = JSON.stringify([cfg.provedor, cfg.cadeia, cfg.rascunho, cfg.prioritario, cfg.visao, cfg.embeddings, cfg.respostasRapidas]);
    let h = 5381; for (let i = 0; i < base.length; i++) h = ((h * 33) ^ base.charCodeAt(i)) >>> 0;
    return h.toString(36);
}
// Texto do arquivo config/mcp-config.js a partir de uma configuração (usado pela Área Administrativa).
function mcpSerializar(cfg) {
    const c = mcpNormalizar(cfg);
    const cab = [
        '/* ═══════════════════════════════════════════════════════════════════════════',
        '   CONFIGURAÇÃO DA IA (MCP = Multi-Cloud Provider)',
        '',
        '   Este é o arquivo que a Área Administrativa edita (aba "IA / MCP" → Salvar).',
        '   Depois de salvar, é só subir este arquivo no GitHub: o sistema confere uma nova versão a cada',
        '   2 horas (enquanto estiver aberto) e passa a usar a configuração atualizada sozinho.',
        '',
        '   Se for editar à mão: mantenha o formato JSON válido (aspas duplas, sem vírgula sobrando no fim).',
        '   As chaves ficam divididas em pedaços ("chave": [ ... ]) — o sistema junta os pedaços.',
        '   Atenção: qualquer chave num sistema que roda no navegador pode ser vista por quem abrir o',
        '   DevTools; use só chaves gratuitas/limitadas (ver README).',
        '   ═══════════════════════════════════════════════════════════════════════════ */',
    ].join('\n');
    return cab + '\nwindow.BSOFT_MCP_CONFIG = ' + JSON.stringify(c, null, 2) + ';\n';
}
function mcpExtrairJson(texto) {
    const i = texto.indexOf('{', Math.max(0, texto.indexOf('BSOFT_MCP_CONFIG')));
    const j = texto.lastIndexOf('}');
    if (i < 0 || j <= i) return null;
    try { return JSON.parse(texto.slice(i, j + 1)); } catch (e) { return null; }
}

// Coloca uma configuração em uso: atualiza as variáveis globais que o resto do sistema lê.
function mcpAplicar(cfg, origem) {
    MCP_CFG = cfg;
    const chave = mcpJuntar(cfg.provedor.chave);
    DEFAULT_MCP_CONFIG = { provider: cfg.provedor.tipo, model: cfg.rascunho.modelo, apiKey: chave, baseUrl: cfg.provedor.baseUrl };
    const p = cfg.prioritario;
    mcpConfig = (p.ativo && p.modelo)
        ? { provider: p.tipo, model: p.modelo, apiKey: mcpJuntar(p.chave) || chave, baseUrl: p.baseUrl || (PROVIDER_PRESETS[p.tipo] || {}).baseUrl || '' }
        : Object.assign({}, DEFAULT_MCP_CONFIG);
    JINA_KEY = mcpJuntar(cfg.embeddings.chave);
    _VISION_MODELS = cfg.visao.slice();
    MCP_ESTADO.hash = mcpHash(cfg); MCP_ESTADO.origem = origem; MCP_ESTADO.aplicadoEm = Date.now();
    try { localStorage.setItem('bsoft_mcp_estado', JSON.stringify({ versao: cfg.versao, hash: MCP_ESTADO.hash, em: MCP_ESTADO.aplicadoEm, origem })); } catch (e) { /* sem localStorage */ }
    try { window.dispatchEvent(new CustomEvent('bsoft:mcp-aplicado', { detail: { versao: cfg.versao, origem } })); } catch (e) { /* ok */ }
}
if (!window.BSOFT_MCP_CONFIG) console.error('[MCP] config/mcp-config.js não foi carregado — a IA não terá chave nem modelos até o arquivo existir.');
mcpAplicar(mcpNormalizar(window.BSOFT_MCP_CONFIG), 'arquivo');
try { localStorage.removeItem('bsoft_mcp_config_v2'); } catch (e) { /* configuração antiga por navegador: não vale mais, a fonte é o arquivo */ }

/* ═══════════ ATUALIZAÇÃO A CADA 2 HORAS ═══════════ */
function mcpUrlArquivo() { const tag = document.querySelector('script[data-mcp-config]'); return tag ? tag.src.split('?')[0] : null; }
function mcpCarregarPorScript(url) {   // não usa fetch: funciona até em file:// (sem erro de CORS)
    return new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = url; s.charset = 'utf-8';
        s.onload = () => { const novo = window.BSOFT_MCP_CONFIG; s.remove(); resolve(novo); };
        s.onerror = () => { s.remove(); reject(new Error('não consegui carregar ' + url.split('?')[0])); };
        document.head.appendChild(s);
    });
}
async function mcpBuscarArquivo() {
    const base = mcpUrlArquivo();
    if (!base) throw new Error('tag do mcp-config.js não encontrada na página');
    const url = base + '?t=' + Date.now();   // o ?t= fura o cache do navegador/CDN: sempre traz a versão publicada
    if (location.protocol !== 'file:') {
        try {   // caminho preferido: só LÊ o texto e interpreta como JSON (não executa código)
            const r = await fetch(url, { cache: 'no-store' });
            if (r.ok) { const obj = mcpExtrairJson(await r.text()); if (obj) return obj; }
        } catch (e) { /* cai para o <script> */ }
    }
    return mcpCarregarPorScript(url);
}
async function mcpVerificar() {
    if (MCP_VERIFICACAO.emAndamento) return MCP_VERIFICACAO.ultimoResultado;
    MCP_VERIFICACAO.emAndamento = true;
    try {
        const novo = mcpNormalizar(await mcpBuscarArquivo());
        MCP_VERIFICACAO.ultima = Date.now();
        const mudou = mcpHash(novo) !== MCP_ESTADO.hash;
        if (mudou) { console.info(`%c🔄 [MCP] Configuração da IA atualizada para a versão ${novo.versao}.`, 'color:#7c3aed;font-weight:700'); mcpAplicar(novo, 'atualizacao'); }
        else console.info(`[MCP] Configuração conferida (versão ${novo.versao}) — sem mudanças.`);
        return (MCP_VERIFICACAO.ultimoResultado = { ok: true, mudou, versao: novo.versao });
    } catch (e) {
        console.warn('[MCP] Não consegui conferir atualização da configuração:', e.message);
        return (MCP_VERIFICACAO.ultimoResultado = { ok: false, erro: e.message });
    } finally { MCP_VERIFICACAO.emAndamento = false; }
}
function mcpAgendarVerificacao() {
    const vencida = () => !MCP_VERIFICACAO.desligado && Date.now() - MCP_VERIFICACAO.ultima >= MCP_VERIFICACAO.intervaloMs;
    // logo depois de abrir, confere uma vez (o ?t= fura o cache do GitHub Pages, que pode guardar o arquivo por alguns minutos)
    setTimeout(() => { if (!MCP_VERIFICACAO.desligado) mcpVerificar(); }, 4000);
    setInterval(() => { if (vencida()) mcpVerificar(); }, 5 * 60 * 1000);   // tique leve; só busca quando completar 2 h
    // timers de aba em segundo plano são adiados pelo navegador: ao voltar para a aba, confere na hora se já venceu
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && vencida()) mcpVerificar(); });
}
// o simulador recebe o rascunho direto do painel administrativo; e a própria Área Administrativa (<html data-admin>) confere sob demanda
if (!window.BSOFT_SIM && !document.documentElement.hasAttribute('data-admin')) mcpAgendarVerificacao();

/* ═══════════ CHAMADAS ═══════════ */
async function callMCPAPI(provider,model,apiKey,baseUrl,messages,config={}){
    const preset=PROVIDER_PRESETS[provider];if(!preset)throw new Error(`Provedor "${provider}" não suportado`);
    let url=baseUrl||preset.baseUrl;
    if(provider==='google'){url=preset.buildUrl(url,model,preset.chatEndpoint)+`?key=${apiKey}`;}
    else{url=url.replace(/\/+$/,'')+preset.chatEndpoint;}
    const headers=preset.headers(apiKey);
    const body=preset.formatRequestBody(model,messages,config);
    const response=await fetch(url,{method:'POST',headers,body:JSON.stringify(body)});
    const data=await response.json();
    if(!response.ok){const err=new Error(`[${provider}] ${data.error?.message||data.error?.code||`HTTP ${response.status}`}`);err.status=response.status;throw err;}
    return preset.parseResponse(data);
}

// Cadeia de tentativa (principal → fallbacks). Modelo "prioritário" (opcional) vem antes; modelos repetidos são ignorados.
function mcpMontarCadeia() {
    const c = MCP_CFG, chave = mcpJuntar(c.provedor.chave);
    const padrao = { provider: c.provedor.tipo, apiKey: chave, baseUrl: c.provedor.baseUrl, label: mcpRotuloProvedor(c.provedor.tipo) };
    const passos = [], vistos = new Set(), p = c.prioritario;
    if (p.ativo && p.modelo) {
        passos.push({ model: p.modelo, provider: p.tipo, apiKey: mcpJuntar(p.chave) || chave, baseUrl: p.baseUrl || (PROVIDER_PRESETS[p.tipo] || {}).baseUrl || '', label: mcpRotuloProvedor(p.tipo), prioritario: true });
        vistos.add(p.modelo);
    }
    c.cadeia.forEach(x => {
        if (x.ativo === false || !x.modelo || vistos.has(x.modelo)) return;
        vistos.add(x.modelo);
        passos.push({ model: x.modelo, provider: padrao.provider, apiKey: padrao.apiKey, baseUrl: padrao.baseUrl, label: padrao.label });
    });
    return passos;
}

async function callCurrentMCP(messages, config = {}) {
    const passos = mcpMontarCadeia();
    const _tlog = (modelo, t, total, status, extra = '') => console.log(
        `%c⏱️ [IA] ${modelo} tentativa ${t}: ${status} em ${total.toFixed(0)}ms${extra}`,
        status === '✅ OK' ? 'color:#16a34a;font-weight:600' : 'color:#dc2626;font-weight:600'
    );
    for (let i = 0; i < passos.length; i++) {
        const p = passos[i];
        console.log(`%c⏱️ [IA] ${i === 0 ? 'Tentando' : 'Falhou → tentando'} ${p.model}...`, 'color:#7c3aed;font-weight:600');
        for (let t = 1; t <= 2; t++) {   // 2 tentativas por modelo
            try {
                if (t > 1) { console.warn(`[IA] ${p.model} — nova tentativa 2/2...`); await new Promise(r => setTimeout(r, p.prioritario ? 2000 : 1500)); }
                const _tm = performance.now();
                const res = await callMCPAPI(p.provider, p.model, p.apiKey, p.baseUrl, messages, config);
                _tlog(p.model, t, performance.now() - _tm, '✅ OK', ` — via ${p.label}`);
                return { ...res, _iaUsada: p.label, _iaModelo: p.model };
            } catch (e) {
                _tlog(p.model, t, 0, `❌ erro (${e.status || e.message?.substring(0, 40) || '?'})`);
            }
        }
    }
    throw new Error('Todos os provedores falharam.');
}

// Modelos gratuitos com suporte a visão (multimodal) — para "analisar tela" e análise de imagem (lista em config/mcp-config.js)
async function callMCPVision(messages, config = {}) {
    for (const model of _VISION_MODELS) {
        for (let t = 1; t <= 2; t++) {
            try {
                if (t > 1) await new Promise(r => setTimeout(r, 1500));
                const res = await callMCPAPI('openrouter', model, DEFAULT_MCP_CONFIG.apiKey, DEFAULT_MCP_CONFIG.baseUrl, messages, config);
                console.log(`%c🖼️ [Vision] OK — modelo: ${model}`, 'color:#16a34a;font-weight:600');
                return res;
            } catch (e) {
                console.warn(`🖼️ [Vision] ${model} tentativa ${t}: erro ${e.status || e.message?.substring(0, 40) || '?'}`);
            }
        }
    }
    throw new Error('Nenhum modelo de visão disponível.');
}
async function callMCPSemPensamento(messages, config = {}, maxTentativas = 3) {
    for (let t = 1; t <= maxTentativas; t++) {
        const result = await callCurrentMCP(messages, config);
        const { texto, eraPensamento } = filtrarPensamentoAlto(result.text);
        if (!eraPensamento) {
            const truncado = result.finishReason === 'length' || result.finishReason === 'MAX_TOKENS';
            const finalText = truncado ? await _continuarResposta(messages, texto, config, 3, result.text) : texto;
            return { ...result, text: finalText };
        }
        console.warn('[AntiPensamento] tentativa ' + t + '/' + maxTentativas + ' — reprocessando...');
        if (t < maxTentativas) await new Promise(r => setTimeout(r, 1200));
    }
    throw new Error('Resposta nao obtida apos ' + maxTentativas + ' tentativas.');
}

// brutoAnterior = o texto da parte cortada EXATAMENTE como a IA mandou (com o espaço/quebra de linha do fim). filtrarPensamentoAlto() faz trim(), então sem isso a emenda colava
// palavras e linhas: "def(\"x\"," + "obt(...)" → "def(\"x\",obt(...)" e, pior, "//comentário\n" + "if (...)" → "//comentárioif (...)" (o código vira comentário).
async function _continuarResposta(messagesOriginais, textoTruncado, config, maxContinuacoes = 3, brutoAnterior = textoTruncado) {
    let texto = textoTruncado;
    let bruto = String(brutoAnterior == null ? textoTruncado : brutoAnterior);
    let msgs = messagesOriginais;
    for (let i = 1; i <= maxContinuacoes; i++) {
        try {
            console.warn(`[Continuação ${i}/${maxContinuacoes}] Resposta truncada detectada — continuando automaticamente...`);
            const contMsgs = [
                ...msgs,
                { role: 'assistant', content: texto },
                { role: 'user', content: 'Continue exatamente de onde parou, sem repetir nada.' }
            ];
            const cont = await callCurrentMCP(contMsgs, config);
            const { texto: cont_texto } = filtrarPensamentoAlto(cont.text);
            const contBruto = String(cont.text || '');
            texto = texto + (bruto.match(/\s*$/)[0] + contBruto.match(/^\s*/)[0]) + cont_texto;   // emenda com o espaço/quebra que existia na divisa
            bruto = contBruto;
            // para se a continuação também não foi cortada
            const novamenteTruncado = cont.finishReason === 'length' || cont.finishReason === 'MAX_TOKENS';
            if (!novamenteTruncado) break;
            msgs = contMsgs;
        } catch(e) {
            console.warn('[Continuação] Falhou:', e.message);
            break;
        }
    }
    return texto;
}

/* ═══════════ IDIOMA: rede de segurança (detectar inglês e traduzir) ═══════════ */
// Palavras bem típicas de cada idioma (fora as que existem nos dois: a, as, no, me, for, in...). Conta quantas aparecem na resposta.
const _MCP_EN = new Set('the and you your with this that are will can please click then from which when have has was were not also into should would could there their they been these those than about after before only other just here what where how select enter open following below above need needs make sure using used use'.split(' '));
const _MCP_PT = new Set('que para com uma não por mais como dos das nos nas seu sua seus suas você vocês está estão são foi ser tem ter pode podem então também quando onde qual quais isso este esta esse essa ele ela eles elas aqui já até sobre entre depois antes ainda clique selecione abra acesse deve precisa tela campo menu'.split(' '));
function mcpPareceIngles(texto) {
    let t = String(texto || '').replace(/```[\s\S]*?```/g, ' ').replace(/`[^`]*`/g, ' ').replace(/https?:\/\/\S+/g, ' ');
    if (t.replace(/\s+/g, ' ').trim().length < 100) return false;   // curto demais para decidir
    let en = 0, pt = 0;
    (t.toLowerCase().match(/[a-zà-ú]+/g) || []).forEach(w => { if (_MCP_EN.has(w)) en++; else if (_MCP_PT.has(w)) pt++; });
    return en >= 4 && en >= 2.5 * (pt + 1);
}
// Traduz uma resposta (Markdown) para português do Brasil usando a mesma cadeia de modelos. Lança erro se nenhum modelo responder.
async function mcpTraduzirParaPtBr(texto) {
    const r = await callMCPSemPensamento([{ role: 'user', content: 'Traduza o texto abaixo para português do Brasil (pt-BR). Mantenha EXATAMENTE a formatação Markdown (títulos, listas, negrito, tabelas), os números, os nomes de telas, menus e campos do sistema, os códigos, as fórmulas e os links. Não explique, não comente e não acrescente nada: responda somente com o texto traduzido.\n\n=== TEXTO ===\n' + String(texto || '') }], { temperature: 0.1, maxTokens: 16000 });
    return String((r && r.text) || '').trim();
}
