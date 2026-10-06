/* js/app/dados.js — Carregamento da base de conhecimento (Supabase) e vetorização. */
// ═══════════════════════════════════════════════════════════
//  CARREGAMENTO DE DADOS (APENAS BANCO - RÁPIDO)
// ═══════════════════════════════════════════════════════════
function scrollToBottom(force = false) {
    const s = document.getElementById('chatStream');
    if (force) { s.scrollTop = s.scrollHeight; return; }
    const n = s.scrollHeight - s.scrollTop - s.clientHeight < 120;
    if (n) s.scrollTop = s.scrollHeight;
}

// Mostra/esconde o botão flutuante "↓" sempre que o usuário não está vendo o final do chat --
// principalmente útil durante o streaming, já que a tela não acompanha mais a resposta sozinha
// (de propósito, pra não brigar com o scroll do usuário), então sem isso pareceria que a resposta
// travou na primeira linha quando na verdade ainda está sendo escrita mais abaixo.
function _atualizarBotaoScrollDown(streaming = false) {
    const s = document.getElementById('chatStream');
    const btn = document.getElementById('btnScrollDown');
    if (!s || !btn) return;
    const longeDoFim = s.scrollHeight - s.scrollTop - s.clientHeight > 120;
    btn.classList.toggle('show', longeDoFim);
    btn.classList.toggle('streaming', longeDoFim && streaming);
}

// A tabela Rotinas tem ~3.800 linhas -- passa do limite padrão de 1000 por consulta do Supabase/
// PostgREST, então precisa paginar com .range() até vir uma página incompleta (mesmo padrão já
// usado no editor de banco, função dbeLoadTable). Devolve {data:[...]} pra encaixar direto no
// Promise.allSettled de loadData(), igual as outras consultas da lista.
async function _carregarRotinasCompleto(){
    let todas=[], from=0; const lote=1000;
    while(true){
        const {data,error}=await sb.from('Rotinas').select('*').range(from, from+lote-1);
        if(error)throw error;
        todas=todas.concat(data||[]);
        if(!data||data.length<lote)break;
        from+=lote;
    }
    return {data:todas};
}
// Parametros (1287 linhas) passa do limite de 1000 por consulta do Supabase: select('*') simples cortava o resto sem avisar. Ordena por id pra paginar sem repetir/pular linha.
async function _carregarTabelaCompleta(tabela){
    let todas=[], from=0; const lote=1000;
    while(true){
        const {data,error}=await sb.from(tabela).select('*').order('id',{ascending:true}).range(from, from+lote-1);
        if(error)throw error;
        todas=todas.concat(data||[]);
        if(!data||data.length<lote)break;
        from+=lote;
    }
    return {data:todas};
}
async function loadData() {
    const b = document.getElementById('statusBadge');
    try {
        b.innerText = `Carregando banco de dados...`;
        const [rB, rP, rF, rL, rM, rR] = await Promise.allSettled([
            sb.from('BancoDados').select('id, titulo, conteudo, como_emitir, categoria'), // embedding vem do cache local
            _carregarTabelaCompleta('Parametros'),
            _carregarTabelaCompleta('Funcionalidades'),
            sb.from('logs').select('pergunta, timestamp, created_at').order('created_at', {ascending: false}).limit(100),
            sb.from('machine_learning').select('*'),
            _carregarRotinasCompleto() // telas/funções do sistema (~3.800 linhas -- passa do limite de 1000 por consulta do Supabase, por isso pagina) -- usado em "Analisar tela" e no chat pra confirmar nome oficial e caminho técnico de uma rotina
        ]);
        if (rP.status === 'fulfilled' && rP.value.data) dadosParametros = rP.value.data;
        if (rF.status === 'fulfilled' && rF.value.data) dadosFuncionalidades = rF.value.data;
        if (rR.status === 'fulfilled' && rR.value.data) dadosRotinas = rR.value.data;
        if (rL.status === 'fulfilled' && rL.value.data) popularBarraEmAlta(rL.value.data);
        if (rM.status === 'fulfilled' && rM.value.data && Array.isArray(rM.value.data)) {
            rM.value.data.forEach(item => {
                const e = mlKnowledge.find(k => k.erro === item.erro);
                if (!e && item.erro && item.solucao) {
                    mlKnowledge.push({
                        id: 'ml_remote_' + Date.now() + Math.random(),
                        erro: item.erro, solucao: item.solucao,
                        fonte: item.fonte || 'Internet', similaridade: 0,
                        dataCriacao: item.data || new Date().toISOString(),
                        confirmado: true, feedbackNegativo: false
                    });
                }
            });
            salvarMLKnowledge();
        }
        if (rB.status !== 'fulfilled' || rB.value.error) throw new Error("Falha ao buscar BancoDados");
        let dados = rB.value.data;
        if (!Array.isArray(dados)) throw new Error("Formato inválido");

        // Se cache local vazio, baixa embeddings do Supabase uma única vez por dispositivo.
        // Pgvector retorna o vetor como string "[0.1,0.2,...]" — por isso parseamos antes de usar.
        if (Object.keys(_embCacheMem).length === 0 && dados.length > 0) {
            b.innerText = 'Baixando vetores do servidor...';
            try {
                const { data: embRows } = await sb.from('BancoDados').select('id, embedding');
                let seeded = 0;
                (embRows || []).forEach(r => {
                    if (!r.embedding) return;
                    let vec = r.embedding;
                    if (typeof vec === 'string') { try { vec = JSON.parse(vec); } catch(e) { return; } }
                    // Só aceita vetores Jina (1024 dims) — ignora vetores Gemini antigos (3072 dims)
                    if (Array.isArray(vec) && vec.length === 1024) { _saveEmbToCache(r.id, vec); seeded++; }
                });
                console.log(`[cache] ${seeded} vetores Jina carregados do Supabase`);
            } catch(e) { console.warn('[cache] Falha ao baixar vetores:', e); }
        }

        dados = dados.map(row => ({
            ...row,
            erro: row.titulo || '',
            solucao: row.conteudo || '',
            'como emitir': row.como_emitir || '',
            vetor: _getEmbFromCache(row.id) // lê do localStorage — zero egress Supabase
        }));
        bancoCompletoRaw = dados;
        b.innerText = "Vetorizando base...";
        const { linhasComVetor, linhasSemVetor, chaves } = carregarVetoresExistentes(dados);
        if (manualVetorizado.length > 0) {
            liberarChat(linhasSemVetor.length > 0 ? "parcial" : "completo");
        }
        if (linhasSemVetor.length > 0) {
            vetorizarEmBackground(linhasSemVetor, chaves);
        } else if (manualVetorizado.length === 0) {
            b.innerText = "Sem dados";
            liberarChat("vazio");
        }
    } catch (error) {
        console.error("Erro loadData:", error);
        document.getElementById('statusBadge').innerText = "Erro de Conexão";
        liberarChat("erro");
    }
}
function popularBarraEmAlta(logsData){try{const isO=Array.isArray(logsData)&&logsData.length>0&&typeof logsData[0]==='object'&&!Array.isArray(logsData[0]);const rows=Array.isArray(logsData)?logsData:[];if(!rows.length)return;const cont={};const po=[];const agora=Date.now();const seteD=7*24*60*60*1000;rows.forEach((row)=>{let p="",ts=0;if(isO){p=(row.pergunta||row.Pergunta||"").toString().trim();if(row.data){const d=new Date(row.data);if(!isNaN(d.getTime()))ts=d.getTime();}}else{p=(row[1]||"").toString().trim();}if(!p||p.length<3||p.toUpperCase().startsWith("FEEDBACK")||p==="Pendente")return;if(!cont[p]){cont[p]={freq:0};po.push(p);}cont[p].freq++;if((agora-ts)<seteD&&ts>0)cont[p].recente=true;});if(Object.keys(cont).length===0)return;const u4=po.filter(p=>cont[p].recente).slice(0,4);const su4=new Set(u4);const rec=Object.entries(cont).filter(([k])=>!su4.has(k)&&cont[k].freq>=2).sort((a,b)=>b[1].freq-a[1].freq).map(([k])=>k);let lf=[...u4,...rec].filter((v,i,a)=>a.indexOf(v)===i).slice(0,8);const bar=document.getElementById('topTermsBar');if(!bar||!lf.length)return;bar.innerHTML='<span>Em alta:</span>';lf.forEach(t=>{const a=document.createElement('a');a.textContent=t.length>35?t.substring(0,33)+'…':t;a.title=t;a.onclick=()=>fillAndSend(t);bar.appendChild(a);});}catch(e){}}
function carregarVetoresExistentes(dados){if(!dados.length)return{linhasComVetor:0,linhasSemVetor:[],chaves:[]};const chaves=Object.keys(dados[0]);const cv=chaves.find(k=>k.toLowerCase().trim()==='vetor'||k.toLowerCase().trim()==='embedding');const ce=chaves.find(k=>k.toLowerCase().trim()==='erro'||k.toLowerCase().trim()==='titulo');const cs=chaves.find(k=>k.toLowerCase().trim()==='solucao'||k.toLowerCase().trim()==='solução'||k.toLowerCase().trim()==='conteudo');const cc=chaves.find(k=>k.toLowerCase().trim()==='categoria');const cem=chaves.find(k=>{const kn=k.toLowerCase().trim();return kn==='como emitir'||kn==='como_emitir'||kn==='emissao'||kn==='emissão'||kn==='emitir';});if(!cv)return{linhasComVetor:0,linhasSemVetor:[],chaves};let lcv=0;const lsv=[];dados.forEach((linha,i)=>{const te=linha[ce]||"";const ts=linha[cs]||"";const tc=cc?(linha[cc]||""):"";const tem=cem?(linha[cem]||""):"";if(!te&&!ts)return;const tc2=`DÚVIDA: ${te} | PROCEDIMENTO: ${ts}${tem?' | COMO EMITIR: '+tem:''}${tc?' | CATEGORIA: '+tc:''}`;const ve=linha[cv];let veArray=null;if(Array.isArray(ve)){veArray=ve;}else if(ve&&typeof ve==='string'&&ve.trim().startsWith('[')){try{veArray=JSON.parse(ve);}catch(e){veArray=null;}}
// Confere se o conteúdo mudou desde a última vetorização (ver _hashConteudo/_saveEmbToCache) --
// hash diferente do salvo = registro foi editado, vetor em cache tá desatualizado, trata como se
// não tivesse vetor (cai em linhasSemVetor e revetoriza sozinho). Hash ainda não registrado (cache
// de antes dessa checagem existir) não força revetorização à toa -- só grava o hash de agora como
// referência pra próxima vez.
if(veArray&&veArray.length>0&&linha.id!=null){
    const hashAtual=_hashConteudo(tc2);
    const hashSalvo=_getEmbHashFromCache(linha.id);
    if(hashSalvo&&hashSalvo!==hashAtual)veArray=null;
    else if(!hashSalvo)_saveEmbToCache(linha.id,veArray,hashAtual);
}
if(veArray&&veArray.length>0){manualVetorizado.push({texto:tc2,erro:te,solucao:ts,emitir:tem,categoria:tc,vetor:veArray,idSupabase:linha.id});lcv++;}else{lsv.push({linha,textoCompleto:tc2,textoErro:te,textoSolucao:ts,textoEmitir:tem,textoCategoria:tc,indexPlanilha:i+2,chaveVetor:cv,chaves,idSupabase:linha.id});}});return{linhasComVetor:lcv,linhasSemVetor:lsv,chaves};}
async function vetorizarEmBackground(lsv,chaves){
    const b=document.getElementById('statusBadge');
    const overlay=document.getElementById('vecOverlay');
    const vecBar=document.getElementById('vecBar');
    const vecStatus=document.getElementById('vecStatus');
    const manyItems = lsv.length > 5;
    if(manyItems && overlay){ overlay.classList.add('visible'); }
    const _updOverlay=(i,total)=>{
        const pct=Math.round((i/total)*100);
        if(vecBar) vecBar.style.width=Math.max(2,pct)+'%';
        if(vecStatus) vecStatus.textContent=`Instalando registro ${i} de ${total} (${pct}% concluído)`;
    };
    const _hideOverlay=()=>{
        if(!overlay)return;
        overlay.classList.add('hiding');
        setTimeout(()=>{ overlay.classList.remove('visible','hiding'); },500);
    };
    let es=0;
    for(let i=0;i<lsv.length;i++){
        if(es>5){b.innerText='IA Pronta ⚠️';break;}
        const item=lsv[i];
        b.innerText=`Vet. ${i+1}/${lsv.length}`;
        if(manyItems) _updOverlay(i+1,lsv.length);
        await new Promise(r=>setTimeout(r,500));
        const nv=await gerarEmbeddingComRetry(item.textoCompleto);
        if(nv){
            manualVetorizado.push({texto:item.textoCompleto,erro:item.textoErro,solucao:item.textoSolucao,emitir:item.textoEmitir||"",categoria:item.textoCategoria,vetor:nv,idSupabase:item.idSupabase});
            salvarVetorNoSupabase(item.idSupabase,nv,_hashConteudo(item.textoCompleto));
            es=0;
        } else{es++;await new Promise(r=>setTimeout(r,10000));}
    }
    if(manyItems) _updOverlay(lsv.length,lsv.length);
    await new Promise(r=>setTimeout(r,800));
    _hideOverlay();
    document.getElementById('statusBadge').innerText=`IA Pronta (${manualVetorizado.length})`;
    document.getElementById('statusBadge').className="badge";
}
function liberarChat(modo="completo"){
    const b = document.getElementById('statusBadge');
    const w = document.getElementById('welcomeMsg');
    const si = obterSaudacao();
    const sendBtn = document.getElementById('sendBtn');
    const searchInput = document.getElementById('searchInput');
    isVectorizing = false;
    sendBtn.disabled = false;
    searchInput.placeholder = "Digite sua dúvida...";
    const pi = ` [${mcpConfig.provider}/${mcpConfig.model.split('/').pop()}]`;
    if(modo === "completo"){
        b.innerText = `IA Pronta (${manualVetorizado.length})${pi}`;
        b.className = "badge";
        if(w) w.innerHTML = _welcomeHero(si, 'Sou o assistente IA <b>Bsoft TMS</b>. Escolha um atalho abaixo ou digite exatamente qual é a sua dúvida.', `<span class="hero-pill"><b>${manualVetorizado.length}</b> artigos na base</span><span class="hero-pill">IA: <b>${escapeHtml(String(mcpConfig.model).split('/').pop())}</b></span><span class="hero-pill">${si.dataCompleta}</span>`) + _menuBtnsHtml();
    }
    else if(modo === "parcial"){
        b.innerText = `IA Pronta (${manualVetorizado.length} +)${pi}`;
        b.className = "badge";
        if(w) w.innerHTML = _welcomeHero(si, 'Já posso ajudar! Escolha um atalho abaixo ou digite sua dúvida.', `<span class="hero-pill"><b>${manualVetorizado.length}</b> artigos disponíveis</span><span class="hero-pill warn">⏳ Novos artigos sendo vetorizados…</span>`) + _menuBtnsHtml();
    }
    else if(modo === "vazio"){
        b.innerText = "Banco vazio";
        b.className = "badge-loading";
        if(w) w.innerHTML = _welcomeHero(si, 'Nenhum dado encontrado no banco, mas posso tentar ajudar com conhecimento geral.', `<span class="hero-pill">IA: <b>${escapeHtml(String(mcpConfig.model).split('/').pop())}</b></span>`) + _menuBtnsHtml();
    }
    else{
        b.innerText = "Modo Offline";
        b.className = "badge-loading";
        if(w) w.innerHTML = _welcomeHero(si, '⚠️ Não consegui conectar ao banco de dados. Posso tentar ajudar com conhecimento geral — digite sua dúvida.<br><button class="retry-btn" onclick="location.reload()">🔄 Tentar novamente</button>') + _menuBtnsHtml();
    }
}
function salvarVetorNoSupabase(id,vetor,hash){if(!id)return;_saveEmbToCache(id,vetor,hash);sb.from('BancoDados').update({embedding:vetor}).eq('id',id).then(({error})=>{if(error)console.error('Erro ao salvar vetor:',error);});}


function extrairTermos(texto) {
    const sw = new Set(["como","que","qual","quais","para","com","sem","não","mas","por","mais","uma","isso","este","esta","esse","essa","num","numa","meu","minha","meus","minhas","tem","ter","ser","foi","vai","vou","tenho","posso","pode","quero","preciso","saber","sobre","nao","onde","quando","porque","pois","também","ainda","mesmo","tipo","ah","e","o","a","os","as","um","uns","umas","no","na","nos","nas","do","da","dos","das","de","em"]);
    return texto.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9 ]/g," ").split(/\s+/).filter(t => t.length > 2 && !sw.has(t));
}

function buildContextoSistema(query, dc) {
    const s = SISTEMA_BSOFT_TMS;
    const termos = extrairTermos(query);
    const qt = query.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    let ctx = `Sistema: ${s.descricao}\nPrimeiros passos: ${s.primeiros_passos.join(' | ')}\nRegras: ${s.regras_gerais.join(' | ')}\n\n`;
    ctx += `=== DOCUMENTOS ===\n`;
    for (const [tipo, info] of Object.entries(s.documentos_principais)) {
        const isAlvo = dc && tipo.toLowerCase() === dc.toLowerCase();
        if (isAlvo) {
            ctx += `[${tipo}] ${info.nome_completo}`;
            if (info.emissao) ctx += ` | Emissão: ${info.emissao}`;
            if (info.cancelamento_sefaz) ctx += ` | Cancelamento: ${info.cancelamento_sefaz}`;
            if (info.funcionalidades_relacionadas) ctx += ` | Relacionados: ${info.funcionalidades_relacionadas.join(', ')}`;
            ctx += '\n';
        } else {
            ctx += `[${tipo}] ${info.nome_completo} | Emissão: ${info.emissao || ''}\n`;
        }
    }
    ctx += '\n';
    const todosC = Object.entries(s.caminhos_rapidos);
    let caminhos;
    if (termos.length > 0) {
        const scored = todosC.map(([nome, path]) => {
            const txt = (nome + ' ' + path).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            return { nome, path, score: termos.reduce((acc, t) => acc + (txt.includes(t) ? 1 : 0), 0) };
        });
        caminhos = scored.filter(c => c.score > 0).sort((a, b) => b.score - a.score);
        if (caminhos.length < 5) caminhos = todosC.map(([n, p]) => ({ nome: n, path: p }));
    } else {
        caminhos = todosC.map(([n, p]) => ({ nome: n, path: p }));
    }
    ctx += `=== CAMINHOS DO MENU ===\n`;
    caminhos.forEach(c => { ctx += `${c.nome}: ${c.path}\n`; });
    ctx += '\n';
    if (/menu|onde fica|como acess|caminho|naveg/.test(qt)) {
        ctx += `=== ESTRUTURA MENUS ===\n`;
        Object.entries(s.estrutura_menus).forEach(([m, items]) => { ctx += `${m}: ${items.join(', ')}\n`; });
        ctx += '\n';
    }
    if (s.taloes_configuracoes && /talao|taloes|tala|serie|seri|numeracao|numeração/.test(qt)) {
        ctx += `=== TALÕES ===\n${s.taloes_configuracoes.join('\n')}\n\n`;
    }
    return ctx;
}
