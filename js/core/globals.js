/* js/core/globals.js — Estado global do app e constantes públicas (valores vêm de config/app-config.js). */

let filaSolucoes = [], lastQuery = "", attachedFileData = null, screenStream = null, isMinimized = false, isCallActive = false, silenceTimer, currentResults = [];
window.currentAudio = null;
let manualVetorizado = [], dadosParametros = [], dadosFuncionalidades = [], isVectorizing = true, bancoCompletoRaw = [], dadosRotinas = [];

const SCRIPT_URL = BSOFT_CONFIG.scriptUrl;
const SUPABASE_URL = BSOFT_CONFIG.supabaseUrl;
const SUPABASE_KEY = BSOFT_CONFIG.supabaseAnonKey;
// No simulador (?sim=1) o cliente é somente leitura: nada é gravado no banco.
const sb = criarClienteSupabase(SUPABASE_URL, SUPABASE_KEY, { somenteLeitura: window.BSOFT_SIM });

// Reconhecimento de voz (só Chrome/Edge). Em navegadores sem suporte fica null e só a chamada de voz deixa de funcionar.
const recognition = (function () {
    try {
        const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SR) return null;
        const r = new SR(); r.lang = 'pt-BR'; r.continuous = true; r.interimResults = false;
        return r;
    } catch (e) { return null; }
})();
