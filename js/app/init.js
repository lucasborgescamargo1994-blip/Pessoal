/* js/app/init.js — Inicialização do app (DOMContentLoaded). */

// Simulador (?sim=1): o painel administrativo conversa com este iframe por mensagens.
// Só aceita mensagens vindas da janela pai (event.source) — a origem de file:// é "null", então não dá para filtrar por origem.
function _iniciarPonteSimulador() {
    window.addEventListener('message', (e) => {
        if (e.source !== window.parent) return;
        const d = e.data || {};
        if (d.tipo === 'bsoft:sim:mcp' && d.config) {
            mcpAplicar(mcpNormalizar(d.config), 'simulador');
            console.info('[simulação] usando a configuração de IA em edição no painel.');
        } else if (d.tipo === 'bsoft:sim:perguntar' && d.texto) {
            document.getElementById('searchInput').value = String(d.texto);
            handleChat();
        } else if (d.tipo === 'bsoft:sim:novaConversa') {
            novaConversa();
        }
    });
}
function simEnviarAoPainel(msg) { try { if (window.BSOFT_SIM && window.parent !== window) window.parent.postMessage(msg, '*'); } catch (e) { /* sem pai */ } }

window.addEventListener('DOMContentLoaded', async () => {
    if (BSOFT_SIM) _iniciarPonteSimulador();
    carregarConversas();
    carregarMLKnowledge();

    const searchInput = document.getElementById('searchInput');
    const sendBtn = document.getElementById('sendBtn');
    document.getElementById('chatStream')?.addEventListener('scroll', () => _atualizarBotaoScrollDown());
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && document.getElementById('builderModalOverlay')?.classList.contains('active')) _fecharBuilderModal(); });
    searchInput.disabled = false;
    searchInput.placeholder = "Carregando banco de dados... (digite sua pergunta enquanto carrega)";
    sendBtn.disabled = true;

    console.log("🔄 Carregando banco de dados...");
    await loadData();
    console.log("✅ Banco de dados carregado! Chat liberado.");
    carregarRespostasRapidas();   // índice das respostas rápidas aprovadas (não bloqueia o chat)

    if (!BSOFT_SIM) {
        _statusCarregar(); setInterval(_statusCarregar, 5 * 60000); // status SEFAZ/ANTT -- mesmo intervalo da Edge Function agendada
        // Navegador reduz/pausa setInterval quando a aba fica em segundo plano por um tempo (economia
        // de bateria/CPU) -- então, deixando só o setInterval acima, quem volta pra aba depois de um
        // tempo podia ver um status desatualizado até o próximo disparo. Isso aqui reforça: sempre que
        // a aba volta a ficar visível, atualiza na hora (evento real do navegador, não sofre esse
        // throttling).
        document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') _statusCarregar(); });
        renderNovidades(); // inicializa painel de novidades
        _subscribeChat(chatSessionId); // escuta mensagens em tempo real para o usuário
        _pedirPermissaoNotificacao();
        backfillDeviceId();
    }

    console.log("📁 Iniciando carregamento do repositório em segundo plano...");
    carregarDadosRepositorio().then(() => {
        console.log("✅ Repositório carregado e vetorizado!");
        const badge = document.getElementById('statusBadge');
        if (badge && !isVectorizing) {
            const repoCount = manualVetorizado.filter(item => item.isRepositorio).length;
            badge.innerText = `IA Pronta (${manualVetorizado.length}) [+${repoCount} repo]`;
        }
    }).catch(e => {
        console.warn("⚠️ Repositório carregado com erros (não afeta o chat):", e);
    });

    searchInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter" && !isVectorizing && !sendBtn.disabled) {
            handleChat();
        }
    });

    simEnviarAoPainel({ tipo: 'bsoft:sim:pronto', artigos: manualVetorizado.length });

    // Recarrega a página a cada 12 horas para garantir que o usuário receba atualizações
    if (!BSOFT_SIM) setTimeout(() => location.reload(), 12 * 60 * 60 * 1000);
});
