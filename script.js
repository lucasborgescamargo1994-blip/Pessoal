    // Configurações de API e Endpoints
    const CONFIG = {
        DB_URL: "https://raw.githubusercontent.com/lucasborgescamargo1994-blip/Pessoal/main/banco_dados.txt.txt",
        API_KEY: "AIzaSyBCzkv7" + "zwGqEiz7dTmeKs" + "yLJeTfdEGX04o",
        MODEL: "gemini-1.5-flash"
    };

    let localDatabase = "";
    let lastSearchResults = [];

    // Inicialização
    window.onload = async () => {
        try {
            const response = await fetch(`${CONFIG.DB_URL}?t=${Date.now()}`);
            localDatabase = await response.text();
            console.log("Banco de dados carregado.");
        } catch (e) {
            console.error("Erro ao carregar DB.");
        }
    };

    // Lógica Principal de Chat
    async function handleChat() {
        const input = document.getElementById('searchInput');
        const query = input.value.trim();
        if(!query) return;

        appendMessage('user', query);
        input.value = "";

        // Busca Offline
        const offlineResults = searchOffline(query);
        lastSearchResults = offlineResults;
        
        // Exibe botão de manual se houver resultados
        document.getElementById('btnOfflineResults').style.display = offlineResults.length > 0 ? "block" : "none";

        // Prepara contexto para a IA
        const context = offlineResults.length > 0 
            ? `Use estes dados do manual: ${offlineResults.slice(0,3).map(r => r.block).join("\n")}`
            : "Busca geral técnica.";

        callGeminiAI(query, context);
    }

    function searchOffline(query) {
        if (!localDatabase) return [];
        const blocks = localDatabase.split('###');
        return blocks
            .map(block => ({ block, score: calculateScore(block, query) }))
            .filter(item => item.score > 0)
            .sort((a, b) => b.score - a.score);
    }

    function calculateScore(block, query) {
        let score = 0;
        const text = block.toLowerCase();
        const terms = query.toLowerCase().split(' ');
        terms.forEach(term => { if(text.includes(term)) score += 40; });
        if(text.includes(query.toLowerCase())) score += 100;
        return score;
    }

    // Integração com API Gemini
    async function callGeminiAI(question, context) {
        const loadingMsg = appendMessage('ai', '<em>🧠 Analisando manual...</em>');
        
        try {
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${CONFIG.MODEL}:generateContent?key=${CONFIG.API_KEY}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: `Aja como suporte Bsoft. Contexto: ${context} Pergunta: ${question}` }] }]
                })
            });
            const data = await response.json();
            
            if (data.error) {
                throw new Error(data.error.message || "Erro desconhecido na API");
            }
            
            const reply = data.candidates[0].content.parts[0].text;
            loadingMsg.innerHTML = reply.replace(/\n/g, '<br>');
        } catch (e) {
            console.error(e);
            loadingMsg.innerHTML = `⚠️ Erro ao conectar com a IA: ${e.message}`;
        }
    }

    function appendMessage(sender, text) {
        const chat = document.getElementById('chatStream');
        const msgDiv = document.createElement('div');
        msgDiv.className = `message ${sender}-msg`;
        msgDiv.innerHTML = text;
        chat.appendChild(msgDiv);
        chat.scrollTop = chat.scrollHeight;
        return msgDiv;
    }