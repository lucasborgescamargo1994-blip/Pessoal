/* js/app/tela-arquivo-voz.js — Compartilhar tela, anexos e chamada de voz. */
// ═══════════════════════════════════════════════════════════
//  TELA / ARQUIVO / VOZ
// ═══════════════════════════════════════════════════════════
async function toggleScreenShare() { const b = document.getElementById('btnScreen'); if (screenStream) { screenStream.getTracks().forEach(t => t.stop()); screenStream = null; b.style.color = ""; return; } try { screenStream = await navigator.mediaDevices.getDisplayMedia({ video: { cursor: "always" }, audio: false }); b.style.color = "var(--primary)"; } catch (err) {} }
document.addEventListener('paste', (e) => { for (let item of e.clipboardData.items) { if (item.type.indexOf("image") !== -1) handleFileUpload(item.getAsFile()); } });
function handleFileUpload(file) {
    if (!file) return;
    const r = new FileReader();
    r.onload = (e) => {
        const base64Url = e.target.result;
        if (file.type.startsWith('image/')) {
            const welcome = document.getElementById('welcomeMsg');
            if (welcome) welcome.remove();
            appendMessage('user', `<em>📎 ${file.name || 'Imagem anexada'}</em>`);
            adicionarMensagemNaConversa('user', `📎 ${file.name || 'Imagem anexada'}`);
            _executarAnaliseImagem(base64Url, file.name || 'Imagem');
        } else {
            attachedFileData = { mime_type: file.type, data: base64Url.split(',')[1] };
            appendMessage('user', `<em>📎 ${file.name || 'Arquivo'}</em>`);
        }
    };
    r.readAsDataURL(file);
}
// ═══════════════════════════════════════════════════════════
// CHAMADA DE VOZ — conversa por voz com a IA (ouvir → pensar → falar → ouvir de novo)
// Voz da IA: hexgrad/kokoro-82m via OpenRouter — tem voz de verdade em português ("pf_dora" e
// "pm_alex", nomes de voz do catálogo do modelo). Não é grátis feito o Flux TTS, mas o custo é
// irrisório (bem menos de um centavo por resposta). Se a chamada falhar por qualquer motivo (rede,
// limite, provedor fora do ar), cai automaticamente pra voz nativa do navegador em pt-BR, pra
// chamada nunca ficar muda.
// ═══════════════════════════════════════════════════════════
const VOICE_CALL_MODEL = 'hexgrad/kokoro-82m';
const VOICE_CALL_VOICE = 'pf_dora';
let callFase = 'ouvindo'; // 'ouvindo' | 'pensando' | 'falando' | 'encerrada'
let callAudioAtual = null; // <audio> da fala da IA tocando agora, se houver
let _callFalaAcumulada = ''; // junta os pedaços finais de uma fala longa (com pausas) antes de enviar
let _callPrimeiraPergunta = true; // controla a saudação de abertura ("Olá, espero que esteja bem...") só na 1ª pergunta da chamada
let _callAudioGeracao = 0; // conta qual foi a última fala pedida — descarta em silêncio uma fala que
// termine de gerar atrasada (ex: a de espera) depois que uma mais nova (a resposta de verdade) já
// tiver assumido, pra nunca atropelar ou tocar por cima de outra.

function _callSetFase(fase, textoParaMostrar) {
    callFase = fase;
    const st = document.getElementById('callStatus');
    if (st) st.textContent = fase === 'ouvindo' ? 'Ouvindo...' : fase === 'pensando' ? 'Pensando...' : fase === 'falando' ? 'Falando...' : '';
    const av = document.getElementById('callAvatar');
    if (av) av.classList.toggle('call-avatar-falando', fase === 'falando');
    if (textoParaMostrar !== undefined) {
        const tr = document.getElementById('callTranscript');
        if (tr) tr.innerText = textoParaMostrar ? (textoParaMostrar.length > 220 ? textoParaMostrar.slice(0, 217) + '...' : textoParaMostrar) : '(Diga sua dúvida)';
    }
}

// Tira marcação (negrito, código, tags) do texto antes de mandar pra voz — sem isso a IA "leria"
// os símbolos em voz alta. Bloco de código vira um aviso curto em vez de ser lido palavra por palavra.
function _prepararTextoParaFala(texto) {
    return String(texto || '')
        .replace(/```[\s\S]*?```/g, ' Trecho de código, veja na tela. ')
        .replace(/<[^>]*>/g, '')
        .replace(/[*_#`]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

// Núcleo comum de "gera e toca" — manda `texto` pra Flux TTS e toca o áudio que voltar, sempre com
// a MESMA voz (o motivo de existir essa função em vez de repetir o fetch em cada lugar que fala é
// justamente esse: fala de espera e resposta de verdade usam sempre a voz da OpenRouter, nunca a do
// navegador, pra não trocar de "pessoa" no meio da ligação). Se enquanto essa chamada de rede
// estava em andamento uma fala MAIS NOVA foi pedida (ex: a resposta de verdade chegou enquanto a
// fala de espera ainda estava sendo gerada), essa aqui se descarta sozinha sem tocar nada.
// Devolve true se chegou a tocar, false se falhou (chamador decide se quer reserva).
async function _gerarEFalar(texto, aoTerminarVoltarAOuvir) {
    const minhaGeracao = ++_callAudioGeracao;
    try {
        const resp = await fetch(`${DEFAULT_MCP_CONFIG.baseUrl.replace(/\/+$/, '')}/audio/speech`, {
            method: 'POST',
            headers: PROVIDER_PRESETS.openrouter.headers(DEFAULT_MCP_CONFIG.apiKey),
            body: JSON.stringify({ model: VOICE_CALL_MODEL, input: texto, voice: VOICE_CALL_VOICE, response_format: 'mp3' })
        });
        if (!resp.ok) {
            let msg = `HTTP ${resp.status}`;
            try { const j = await resp.json(); msg = j?.error?.message || msg; } catch (e) {}
            throw new Error(msg);
        }
        const blob = await resp.blob();
        if (!isCallActive || minhaGeracao !== _callAudioGeracao) return true; // chamada encerrou, ou outra fala mais nova já assumiu — não é falha, só descarta
        const url = URL.createObjectURL(blob);
        if (callAudioAtual) { try { callAudioAtual.pause(); } catch (e) {} }
        callAudioAtual = new Audio(url);
        callAudioAtual.onended = () => { URL.revokeObjectURL(url); callAudioAtual = null; if (aoTerminarVoltarAOuvir) _callVoltarAOuvir(); };
        callAudioAtual.onerror = () => { URL.revokeObjectURL(url); callAudioAtual = null; if (aoTerminarVoltarAOuvir) _callVoltarAOuvir(); };
        await callAudioAtual.play();
        return true;
    } catch (e) {
        console.warn('[chamada de voz] Flux TTS falhou:', e.message);
        return false;
    }
}

// Fala curta e imediata assim que a pergunta chega, ENQUANTO a resposta de verdade ainda está
// sendo buscada (embedding + busca vetorial + streaming da IA, que pode levar vários segundos) —
// tira a sensação de demora, tipo um atendente humano dizendo "só um instante, já verifico". Se a
// Flux TTS falhar aqui, não tem problema: fica sem fala de espera nessa vez, mas a resposta de
// verdade (que tem reserva pra voz do navegador) continua chegando normalmente. Não conta como
// "voltar a ouvir": a fase continua 'pensando' até a resposta de verdade chegar e falar de verdade.
async function _falarPreencherEspera(pergunta) {
    if (!isCallActive) return;
    const assunto = pergunta.length > 140 ? pergunta.slice(0, 140) + '...' : pergunta;
    const texto = _callPrimeiraPergunta
        ? `Olá! Espero que esteja tudo bem. Vou pesquisar sobre ${assunto}. Aguarde um momento enquanto verifico no sistema pra trazer sua resposta.`
        : `Certo, vou verificar sobre ${assunto}. Só um momento.`;
    _callPrimeiraPergunta = false;
    const tr = document.getElementById('callTranscript');
    if (tr) tr.innerText = texto;
    await _gerarEFalar(texto, false);
}

async function speak(texto) {
    if (!isCallActive) return;
    const textoLimpo = _prepararTextoParaFala(texto).slice(0, 4000);
    if (!textoLimpo) { _callVoltarAOuvir(); return; }
    _callSetFase('falando', textoLimpo);
    const ok = await _gerarEFalar(textoLimpo, true);
    if (!ok) {
        console.warn('[chamada de voz] caindo pra voz do navegador nessa resposta');
        _speakComVozDoNavegador(textoLimpo);
    }
}

function _speakComVozDoNavegador(texto) {
    if (!isCallActive || !('speechSynthesis' in window)) { _callVoltarAOuvir(); return; }
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(texto);
    u.lang = 'pt-BR';
    u.onend = _callVoltarAOuvir;
    u.onerror = _callVoltarAOuvir;
    window.speechSynthesis.speak(u);
}

// Volta a ouvir depois de falar (ou depois de um erro) — só se a chamada continuar ativa.
function _callVoltarAOuvir() {
    if (!isCallActive) return;
    _callSetFase('ouvindo', '');
    try { recognition.start(); } catch (e) {} // já pode estar rodando — ignora o erro nesse caso
}

function toggleVoice() {
    if (!(window.SpeechRecognition || window.webkitSpeechRecognition)) {
        alert('Seu navegador não tem suporte a reconhecimento de voz. Tente pelo Google Chrome no computador ou celular.');
        return;
    }
    isCallActive = true;
    _callFalaAcumulada = '';
    _callPrimeiraPergunta = true;
    const painel = document.getElementById('voiceCallPanel');
    painel.style.display = 'flex';
    painel.classList.remove('minimized');
    const mi = document.getElementById('minimizeIcon'); if (mi) mi.textContent = '🔳 Minimizar';
    _callSetFase('ouvindo', '');
    try { recognition.start(); } catch (e) {}
}

function endVoiceCall() {
    isCallActive = false;
    callFase = 'encerrada';
    clearTimeout(silenceTimer);
    try { recognition.stop(); } catch (e) {}
    window.speechSynthesis.cancel();
    if (callAudioAtual) { try { callAudioAtual.pause(); } catch (e) {} callAudioAtual = null; }
    const painel = document.getElementById('voiceCallPanel');
    painel.style.display = 'none';
    painel.classList.remove('minimized');
}

// Minimiza pra uma pastilha no canto — a chamada continua ouvindo/falando normalmente por trás,
// só a tela cheia sai do caminho pra dar pra usar o resto do sistema durante a ligação.
function toggleMinimizeCall() {
    const painel = document.getElementById('voiceCallPanel');
    const minimizado = painel.classList.toggle('minimized');
    const mi = document.getElementById('minimizeIcon'); if (mi) mi.textContent = minimizado ? '🔼 Restaurar' : '🔳 Minimizar';
}

recognition.onspeechstart = () => { clearTimeout(silenceTimer); };
// Modo "continuous" finaliza cada pausa da fala como um resultado separado — se só olhasse o
// último (como antes), uma frase com uma pausa no meio perdia o começo. Agora acumula todo pedaço
// final até dar silêncio de verdade, e mostra prévia ao vivo (interim) enquanto a pessoa ainda fala.
recognition.onresult = (event) => {
    let interim = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
        const r = event.results[i];
        if (r.isFinal) _callFalaAcumulada += r[0].transcript;
        else interim += r[0].transcript;
    }
    _callSetFase('ouvindo', (_callFalaAcumulada + interim).trim());
    clearTimeout(silenceTimer);
    silenceTimer = setTimeout(() => {
        const t = _callFalaAcumulada.trim();
        _callFalaAcumulada = '';
        if (t) processarFalaFinal(t);
    }, 2000);
};
// SpeechRecognition às vezes para sozinho (silêncio prolongado, limite do navegador) mesmo sem
// ninguém ter mandado parar — se isso acontecer enquanto devia estar ouvindo, reinicia sozinho
// pra chamada não morrer silenciosamente.
recognition.onend = () => { if (isCallActive && callFase === 'ouvindo') { try { recognition.start(); } catch (e) {} } };
recognition.onerror = (event) => {
    if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        alert('Permissão de microfone negada — libere o microfone pro navegador pra usar a chamada de voz.');
        endVoiceCall();
    }
    // 'no-speech' e outros erros passageiros: só deixa o onend cuidar de reiniciar.
};

function processarFalaFinal(t) {
    const texto = (t || '').trim();
    if (!texto) { _callVoltarAOuvir(); return; }
    const norm = texto.toLowerCase();
    const FRASES_ENCERRAR = ['tchau', 'até mais', 'até logo', 'encerrar a chamada', 'encerrar chamada', 'finalizar chamada', 'desligar a chamada', 'pode desligar'];
    if (FRASES_ENCERRAR.some(f => norm.includes(f))) { endVoiceCall(); return; }
    recognition.stop();
    _callSetFase('pensando', texto);
    // Sem timer de "desistir" aqui de propósito — a resposta às vezes demora mesmo (busca +
    // streaming da IA), e cortar por tempo já mandou aviso errado em respostas que só estavam
    // lentas. Se a pergunta cair num fluxo que realmente não fala de volta (abre um assistente
    // visual que não dá pra usar por voz), a chamada fica esperando; "Encerrar Chamada" resolve.
    _falarPreencherEspera(texto); // fala "só um momento" na hora, sem esperar a IA — roda em paralelo com o handleChat abaixo
    document.getElementById('searchInput').value = texto;
    handleChat();
}
