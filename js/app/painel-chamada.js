/* js/app/painel-chamada.js — Tela das chamadas de voz (voz ao vivo e conversa rápida).
   Reaproveita o painel #voiceCallPanel da chamada antiga (avatar, status, legenda, "Encerrar Chamada") e acrescenta por cima: legenda da resposta, fontes
   consultadas, botões (silenciar, fone, interromper, ver no chat) e o relógio. Quem usa só chama montar()/fase()/legendas; as regras de cada conversa ficam
   em js/app/voz-ao-vivo.js e js/app/conversa-voz.js. Estilos: css/voz-ao-vivo.css. */
'use strict';
const PainelChamada = (() => {
    const $id = id => document.getElementById(id);
    const limpar = s => String(s || '').replace(/\s+/g, ' ').trim();
    const TEXTOS = { conectando: 'Conectando…', ouvindo: 'Ouvindo…', pensando: 'Pensando…', consultando: 'Consultando a base…', falando: 'Falando…', mudo: 'Microfone desligado' };
    let H = null;   // o que a conversa em andamento quer receber: { aoMudo, aoFone, aoChat, aoInterromper }

    // o = { aoMudo, aoFone, aoChat, aoInterromper (opcional: mostra o botão ✋), semFone, aviso }
    function montar(o) {
        const p = $id('voiceCallPanel'); if (!p) return false;
        H = o || {};
        p.style.display = 'flex'; p.classList.remove('minimized'); p.classList.add('voz-ao-vivo');
        const mi = $id('minimizeIcon'); if (mi) mi.textContent = '🔳 Minimizar';
        const tr = $id('callTranscript'); if (tr) tr.textContent = '';
        const velho = $id('vozExtras'); if (velho) velho.remove();
        const extra = document.createElement('div'); extra.id = 'vozExtras';
        extra.innerHTML = `<p id="vozResposta" class="voz-resposta" aria-live="polite"></p>
            <div id="vozFontes" class="voz-fontes" hidden></div>
            <div class="voz-barra">
                <button type="button" id="vozMudo" class="voz-btn" aria-pressed="false" title="Desliga o microfone sem encerrar a ligação">🎙️ Silenciar</button>
                <button type="button" id="vozAlto" class="voz-btn" aria-pressed="false" title="Sem fone de ouvido, o microfone pode ouvir a própria voz da IA. Com fone, você pode interrompê-la falando."></button>
                ${H.aoInterromper ? '<button type="button" id="vozInterromper" class="voz-btn voz-btn-int" title="Corta a fala da IA agora (também vale tocar no círculo)" hidden>✋ Interromper</button>' : ''}
                <button type="button" id="vozChat" class="voz-btn" title="Escreve a resposta completa da última pergunta no chat">💬 Ver no chat</button>
                <span id="vozTempo" class="voz-tempo" role="timer">00:00</span>
            </div>
            <p class="voz-aviso"></p>`;
        extra.querySelector('.voz-aviso').textContent = H.aviso || '';
        p.insertBefore(extra, $id('endCallBtn'));
        $id('vozMudo').onclick = () => { if (H.aoMudo) H.aoMudo(); };
        $id('vozAlto').onclick = () => { if (H.aoFone) H.aoFone(); };
        $id('vozChat').onclick = () => { if (H.aoChat) H.aoChat(); };
        const bi = $id('vozInterromper'); if (bi) bi.onclick = () => H.aoInterromper();
        const av = $id('callAvatar'); if (av && H.aoInterromper) { av.style.cursor = 'pointer'; av.title = 'Toque para interromper a IA'; av.onclick = () => H.aoInterromper(); }
        semFone(!!H.semFone);
        return true;
    }
    function desmontar() {
        const p = $id('voiceCallPanel'); if (p) { p.style.display = 'none'; p.classList.remove('minimized', 'voz-ao-vivo'); }
        const x = $id('vozExtras'); if (x) x.remove();
        const av = $id('callAvatar'); if (av) { av.classList.remove('call-avatar-falando', 'voz-ouvindo'); av.style.removeProperty('--nivel'); av.style.cursor = ''; av.title = ''; av.onclick = null; }
        H = null;
    }

    // f: 'conectando' | 'ouvindo' | 'pensando' | 'consultando' | 'falando'  ·  o = { mudo, texto }
    function fase(f, o = {}) {
        const st = $id('callStatus'); if (st) st.textContent = (o.mudo && f === 'ouvindo') ? TEXTOS.mudo : (o.texto || TEXTOS[f] || '');
        const av = $id('callAvatar'); if (av) { av.classList.toggle('call-avatar-falando', f === 'falando'); av.classList.toggle('voz-ouvindo', f === 'ouvindo' && !o.mudo); }
        const bi = $id('vozInterromper'); if (bi) bi.hidden = !(f === 'falando' || f === 'pensando');
    }
    function legendaFala(t) { const el = $id('callTranscript'); if (!el) return; const x = limpar(t); el.textContent = x ? 'Você: ' + (x.length > 180 ? '…' + x.slice(-177) : x) : ''; }
    function legendaResposta(t) { const el = $id('vozResposta'); if (!el) return; const x = limpar(t); el.textContent = x.length > 320 ? '…' + x.slice(-317) : x; }
    function fontes(titulos) {
        const el = $id('vozFontes'); if (!el) return;
        const vistos = new Set();   // artigo e resposta aprovada costumam ter o mesmo título: mostra uma vez só
        const lista = (titulos || []).map(limpar).filter(t => { const k = t.toLowerCase(); if (!t || vistos.has(k)) return false; vistos.add(k); return true; }).slice(0, 3).map(t => t.length > 70 ? t.slice(0, 67) + '…' : t);
        if (!lista.length) { el.hidden = true; el.textContent = ''; return; }
        el.hidden = false; el.innerHTML = '📚 <b>Consultado no banco:</b> ' + lista.map(esc).join(' · ');
    }
    function tempo(texto, urgente) { const el = $id('vozTempo'); if (!el) return; el.textContent = texto; el.classList.toggle('is-fim', !!urgente); }
    function nivel(n) { const av = $id('callAvatar'); if (av) av.style.setProperty('--nivel', Math.max(0, Math.min(1, n || 0)).toFixed(2)); }
    function mudo(sim) { const b = $id('vozMudo'); if (b) { b.setAttribute('aria-pressed', String(!!sim)); b.textContent = sim ? '🔇 Microfone desligado' : '🎙️ Silenciar'; } }
    function semFone(sim) {
        const b = $id('vozAlto'); if (!b) return;
        b.setAttribute('aria-pressed', String(!sim));
        b.textContent = sim ? '🔊 Sem fone: não me interrompe' : '🎧 Com fone: pode interromper';
    }
    // "Com fone / sem fone": é uma característica de quem está ligando (e não de uma conversa), então vale para as duas chamadas.
    // padraoSemFone = o que vale enquanto a pessoa nunca escolheu (a voz ao vivo corta eco melhor que a conversa rápida).
    const LS_FONE = 'bsoft_voz_fone';
    function lerFone(padraoSemFone) { try { const v = localStorage.getItem(LS_FONE); return v === 'sem' ? true : v === 'com' ? false : !!padraoSemFone; } catch (e) { return !!padraoSemFone; } }
    function gravarFone(semFoneSim) { try { localStorage.setItem(LS_FONE, semFoneSim ? 'sem' : 'com'); } catch (e) { /* sem armazenamento: vale só nesta chamada */ } }
    return { montar, desmontar, fase, legendaFala, legendaResposta, fontes, tempo, nivel, mudo, semFone, lerFone, gravarFone };
})();
window.PainelChamada = PainelChamada;
