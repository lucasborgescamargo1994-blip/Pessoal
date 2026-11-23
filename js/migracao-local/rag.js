/* js/migracao-local/rag.js — Primeira emissão guiada com IA LOCAL (migracaolocal.html): tudo o que NÃO é o modelo.
   O modelo local (0,5B–1B, só no processador) lê MUITO devagar (medido num i3-7100: ~3 tokens/s ao ler, ~2 ao escrever) e erra ao escolher o que é relevante. Por isso:
     • o prompt é CURTO: um trecho do artigo (o pedaço que mais combina com a pergunta, não o artigo inteiro), o passo em que o cliente está e, no máximo, o último par de conversa;
       a busca usa SÓ a pergunta (o chat do MCP soma também as buscas do passo, e isso sempre traz algum artigo, até para "qual a cor do céu");
     • PRAZOS e obrigações NÃO passam pelo modelo: pergunta de prazo/obrigação com regra encontrada vira a própria regra, escrita como está em config/migracao-regras.js (sem inventar número);
     • pergunta que, sozinha, não acha nada no banco → "não consta, fale com o Suporte" (sem modelo); erro com um código que nenhum artigo tem → triagem padrão (sem modelo);
       pergunta de UMA palavra ("não consigo emitir") → pede detalhe (sem modelo e sem chutar um artigo);
     • BANCO DIRETO: quando o artigo achado tem como título (quase) a própria pergunta — ou, num erro, traz o código no título — o modelo só reescreveria, devagar e inventando passos
       (medido no Llama 1B): a resposta é o próprio trecho, na hora (`local.confiante`; no erro, em 3 partes). A pessoa pode ligar "A IA escreve TODA resposta" para testar o modelo mesmo assim;
     • O CLIENTE SÓ EMITE: os artigos do banco foram escritos para a EQUIPE ("altere a numeração inicial do talão…"); a frase que manda editar talão/numeração/certificado/regras/tabelas sai da resposta
       (do trecho do banco e do texto do modelo) e entra o aviso "esta etapa é do Suporte", com os números que o cliente informou no passo da numeração;
     • a resposta do modelo passa por travas: outra língua, recusa, "Não consta.", links, número/prazo que não estava no material, a MESMA frase repetida em ciclo, nome entre aspas que não está no material;
     • se o modelo não entregar nada que sirva (ou não estiver pronto), a resposta é o próprio trecho do banco ("resposta direta, sem IA").
   Tudo aqui é função pura (sem tela, sem rede): testável em Node (tools/bancada-desempenho/teste-migracao-local-logica.js). Usa MigLogica (js/migracao/logica.js). */
const MigLocalRag = (() => {
    'use strict';
    const L = () => MigLogica;
    const semAcento = s => String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const limitar = (t, n) => { t = String(t == null ? '' : t).replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n).replace(/\s+\S*$/, '') + '…' : t; };
    const SUPORTE = 'Opções do Sistema > Suporte';

    // ═════════ prompt (curto e FIXO: o servidor lê uma vez e reaproveita) ═════════
    // Medido no Llama 3.2 1B e no Qwen 2.5 0,5B (i3-7100): QUALQUER instrução de "se o material não responder, diga que não consta" faz o modelo pequeno responder "Não consta." a tudo;
    // pedir "passo a passo / lista" faz ele INVENTAR passos ("menu superior", "Salvar"); pedir "NO MÁXIMO 2 frases, com as palavras do TEXTO" faz ele copiar o essencial (fiel) e escrever pouco (menos tempo).
    // O que é do cliente (só emitir) e o que é do Suporte NÃO está aqui: as linhas de configuração saem da resposta depois (tirarConfig) e o aviso do Suporte é fixo.
    const SISTEMA = 'Você responde perguntas de clientes do Bsoft TMS (sistema para transportadoras) em português do Brasil, usando só o TEXTO. Responda em NO MÁXIMO 2 frases, com as palavras do TEXTO. Não acrescente nada que não esteja no TEXTO.';
    const MODO_ERRO = 'Responda em 3 partes curtas: Causa provável, Como corrigir, Se não resolver.';
    // só o trecho fixo: o motor lê isto antes (aquecimento), com o computador parado
    const mensagensAquecimento = () => [{ role: 'system', content: SISTEMA }, { role: 'user', content: 'Olá' }];

    // ═════════ o trecho do artigo que mais combina com a pergunta ═════════
    function unidades(texto) {
        const out = [];
        String(texto == null ? '' : texto).replace(/\r/g, '').split(/\n+/).forEach(l => {
            l = l.trim(); if (!l) return;
            if (l.length <= 240) out.push(l); else l.split(/(?<=[.!?;])\s+/).forEach(s => { s = s.trim(); if (s) out.push(s); });
        });
        return out;
    }
    // janela de linhas seguidas, com no máximo `max` caracteres, que cobre as palavras da pergunta (empate: a que começa mais cedo). Cada palavra pesa pela RARIDADE dentro do artigo:
    // "CT-e" aparece em todas as linhas de um manual de CT-e e não diz onde está a resposta; "emitir" aparece em poucas e diz.
    // opc.inicio: o título do artigo já é a pergunta ("Como emitir um CT-e?"): a resposta está no COMEÇO do artigo, mesmo que ele use outras palavras ("Acesse a tela… clique em adicionar")
    function melhorTrecho(texto, qTokens, max, opc) {
        const us = unidades(texto); if (!us.length) return '';
        const q = new Set(qTokens || []);
        const conj = us.map(u => new Set(L().tokens(u))), df = new Map();
        conj.forEach(s => s.forEach(t => df.set(t, (df.get(t) || 0) + 1)));
        const peso = t => { const d = df.get(t) || 0; return Math.log(1 + (us.length - d + 0.5) / (d + 0.5)); };
        const pont = conj.map((s, i) => { let p = i === 0 ? 0.4 : 0; q.forEach(t => { if (s.has(t)) p += peso(t); }); return p; });
        let melhor = { ini: 0, fim: 0, pt: -1 }, inicial = null;
        for (let i = 0; i < us.length; i++) {
            let len = 0, pt = 0;
            for (let j = i; j < us.length; j++) { len += us[j].length + 1; if (len > max && j > i) break; pt += pont[j]; if (i === 0) inicial = { ini: 0, fim: j, pt }; if (pt > melhor.pt) melhor = { ini: i, fim: j, pt }; }
        }
        // Os artigos do banco costumam abrir com a resposta direta e fechar com listas e exceções: só se afasta do começo quando outra janela é CLARAMENTE melhor (1,5×)
        if (inicial && melhor.ini > 0 && (melhor.pt < inicial.pt * 1.5 || (opc && opc.inicio))) melhor = inicial;
        let t = us.slice(melhor.ini, melhor.fim + 1).join('\n');
        let cortou = melhor.fim < us.length - 1;
        if (t.length > max) { t = t.slice(0, max).replace(/\s+\S*$/, ''); cortou = true; }
        return (melhor.ini > 0 ? '[…] ' : '') + t + (cortou ? ' […]' : '');
    }

    // ═════════ a pergunta e a busca ═════════
    // No modo erro a "pergunta" do chat é um pedido formatado ("DEU ERRO…\nDocumento/etapa: …\nMensagem de erro (copiada do sistema): …\nDiga a causa…"): a busca usa só a MENSAGEM
    function textoDaPergunta(pergunta, erro) {
        const p = String(pergunta || '');
        if (!erro) return p;
        const m = /Mensagem de erro \(copiada do sistema\):\s*([\s\S]*?)(?:\nO que a pessoa|\nDiga a causa|$)/.exec(p);
        return (m && m[1].trim()) || p;
    }
    const codigosDe = t => Array.from(new Set((String(t || '').match(/\b\d{3,4}\b/g) || []).filter(c => !/^(19|20)\d\d$/.test(c))));
    // Onde está a pergunta de verdade: quem conta uma história e pergunta no fim ("Emiti um CT-e ontem com o valor errado. Ainda consigo cancelar? Qual é o prazo?") quer a frase com "?".
    // Sem "?", vale a 1ª frase com assunto (como no chat do MCP).
    function focoDe(texto) {
        const limpa = L().anonimizar(texto).replace(/\[[^\]]*omitid[ao]\]/gi, ' ');
        const perguntas = (limpa.match(/[^?!.\n]*\?/g) || []).map(s => s.trim()).filter(s => L().tokens(s).length >= 1);
        if (perguntas.length) return perguntas.join(' ');
        return (limpa.split(/[?!.\n]+/).map(s => s.trim()).find(s => L().tokens(s).length >= 2)) || limpa.trim();
    }
    // O que a PERGUNTA (sozinha) acha no banco: a mesma busca do chat do MCP, mas SEM somar as buscas do passo
    function acharPelaPergunta(ix, texto) {
        const limpa = L().anonimizar(texto).replace(/\[[^\]]*omitid[ao]\]/gi, ' '), foco = focoDe(texto);
        const consultas = (foco && foco !== limpa.trim() ? [foco] : []).concat([limpa]);
        return L().conhecimento(ix, consultas, { banco: 4, rapida: 2, faq: 3 }, { minCobertura: 0.2 });
    }

    // ═════════ regras (prazos e obrigações) ═════════
    // Pergunta de PRAZO/OBRIGAÇÃO ("até quando posso cancelar?", "preciso de CIOT?"): quem responde é a regra conferida, não o modelo.
    // "Como emito…?" é passo a passo, não prazo (mesmo com "posso"/"preciso" no meio).
    const PRAZO = /\b(prazo|ate quando|quanto tempo|em quanto tempo|quantos? (dias|horas|anos|meses)|multa|penalidade|e obrigatori\w*|obrigatoriedade|vence|vencimento|expira)\b/;
    const POSSO = /\bainda (da|consigo|posso|e possivel|tem como)\b|\b(posso|consigo|da pra|tem como|e possivel)\b[^?.!]{0,40}\b(cancelar|corrigir|alterar|mudar|trocar|encerrar|inutilizar|substituir|complementar|emitir (depois|sem|antes|fora))\b/;
    const OBRIGACAO = /\b(preciso|precisa|precisamos|tenho que|tem que|devo)\s+(de|do|da|ter|emitir|fazer)\b/;
    function temIntencaoDeRegra(pergunta) {
        const q = semAcento(pergunta);
        if (PRAZO.test(q) || POSSO.test(q)) return true;
        if (/\bcomo\b/.test(q)) return false;
        return OBRIGACAO.test(q);
    }
    const dataBr = iso => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || '')); return m ? m[3] + '/' + m[2] + '/' + m[1] : String(iso || ''); };
    // a regra escrita para o cliente, fiel ao que está em config/migracao-regras.js (nada é resumido pelo modelo)
    function regraTexto(r) {
        const t = ['⏱️ **' + r.titulo + '**', r.regra];
        if (r.prazo) t.push('**Prazo:** ' + r.prazo);
        if ((r.detalhe || []).length) t.push((r.detalhe || []).map(d => '- ' + d).join('\n'));
        if (r.seNaoCumprir) t.push('**E se passar do prazo?** ' + r.seNaoCumprir);
        if (r.varia) t.push('⚠️ **Pode variar:** ' + r.varia);
        t.push('_Regra ' + (r.nivel === 'conferido' ? 'conferida' : 'orientativa') + (r.conferidoEm ? ' em ' + dataBr(r.conferidoEm) : '') + '. Confirme com o seu contador._');
        return t.join('\n\n');
    }
    // as regras que a PERGUNTA acha: só entram as de escore parecido com o da primeira (no máximo 2). Sem o título do passo na busca: quem pergunta "ainda consigo cancelar?"
    // no passo "Emitir o CT-e" quer a regra do cancelamento, não a de emitir (o chat do MCP soma o passo porque quem escolhe é o modelo; aqui a regra vira a resposta direta)
    function regrasDaPergunta(ix, texto) {
        if (!ix || !ix.regra) return [];
        const a = L().buscar(ix.regra, focoDe(texto), { max: 3, minCobertura: 0.25 });
        if (!a.length) return [];
        return a.filter(x => x.score >= a[0].score * 0.6).slice(0, 2);
    }

    // ═════════ "o que é…?" → o glossário da equipe (curado, em linguagem simples), sem modelo ═════════
    // Só pergunta de DEFINIÇÃO pura ("O que é CT-e? Qual a diferença entre CT-e e MDF-e?"), sem código de rejeição: "O que significa a rejeição 539?" é outra coisa (vai para os artigos).
    const DEFINICAO = /^\s*(?:(?:oi|ola|bom dia|boa tarde|boa noite)[,!.\s]+)?(?:(?:me )?(?:explica|explique)(?: o que)?\s+|pode explicar o que\s+)?(?:o que (?:e|sao|significa|quer dizer|seria)|qual (?:e )?a diferenca (?:entre|de)|significado de)\b/;
    const ehDefinicao = texto => DEFINICAO.test(semAcento(texto)) && !codigosDe(texto).length;
    // "O que é CT-e e MDF-e? Qual a diferença?" → o que vem depois de "o que é" (1ª frase), separado em "CT-e" e "MDF-e", e cada um procura o seu termo (juntos, a busca exigiria os dois num termo só)
    function termosDaPergunta(ix, texto) {
        if (!ix || !ix.termo) return [];
        const frase = String(texto || '').split(/[?!.\n]/)[0];
        const miolo = frase.replace(/^\s*(?:(?:oi|ol[aá]|bom dia|boa tarde|boa noite)[,\s]+)?(?:(?:me\s+)?(?:explica|explique)(?:\s+o que)?\s+|pode explicar o que\s+)?(?:o que\s+(?:[eé]|s[aã]o|significa|quer dizer|seria)|qual\s+(?:[eé]\s+)?a\s+diferen[cç]a\s+(?:entre|de)|significado de)\s+/i, '');
        const partes = miolo.split(/\s+(?:e|ou|x|versus|com)\s+|\s*,\s*/i).map(s => s.replace(/^(?:o|a|os|as|um|uma)\s+/i, '').trim()).filter(Boolean).slice(0, 3);
        const achados = [], vistos = new Set();
        (partes.length ? partes : [miolo]).forEach(p => L().buscar(ix.termo, p, { max: 1, minCobertura: 0.5 }).forEach(a => { if (!vistos.has(a.doc.chave)) { vistos.add(a.doc.chave); achados.push(a); } }));
        return achados.slice(0, 2);
    }
    function termoTexto(t) {
        const onde = t.bsoft && (t.bsoft.onde || []).length ? '\n\n📍 No Bsoft: ' + t.bsoft.onde.join(' · ') + (t.bsoft.nota ? '. ' + t.bsoft.nota : '') : (t.bsoft && t.bsoft.nota ? '\n\n' + t.bsoft.nota : '');
        return '📖 **' + t.termo + '**' + (t.sigla ? ' (' + t.sigla + ')' : '') + '\n\n' + t.simples + (t.exemplo ? '\n\n_Exemplo:_ ' + t.exemplo : '') + onde;
    }

    // ═════════ configuração do sistema → é com o Suporte (o cliente só emite), sem modelo ═════════
    const VERBO_CONFIG = '(?:instal|import|configur|cadastr|renov|atualiz|troc|alter|edit|defin|ajust|mud|coloc|subst)\\w*';
    const ITEM_CONFIG = '(?:certificados?|tokens?|tal[aã]o|tal[oõ]es|numera[cç][aã]o inicial|n[uú]mero inicial|regras? de c[aá]lculo|tabelas? de pre[cç]os?|par[aâ]metros?)';
    const MESMA_FRASE = new RegExp('\\b' + VERBO_CONFIG + '\\b[^?.!\\n]{0,60}\\b' + ITEM_CONFIG + '\\b|\\b' + ITEM_CONFIG + '\\b[^?.!\\n]{0,60}\\b' + VERBO_CONFIG + '\\b', 'i');
    const SO_ITEM = new RegExp('\\b' + ITEM_CONFIG + '\\b', 'i');
    const COMO_VERBO = new RegExp('\\b(?:como|onde|quero|preciso)\\b[^?.!\\n]{0,30}\\b' + VERBO_CONFIG + '\\b', 'i');
    const JA_FEZ = /\b(instalei|configurei|cadastrei|importei|atualizei|troquei|alterei|editei|ajustei|defini|coloquei|renovei)\b/i;      // "Instalei o certificado. Como emito o CT-e?" não é pedido de configuração
    // item e verbo de configuração na mesma frase, ou o item numa frase e o "como instalo?" na seguinte ("O sistema pediu o certificado digital. Como instalo?")
    function ehConfiguracao(texto) {
        const t = String(texto || '');
        if (JA_FEZ.test(t) || /\bcomo\b[^?.!\n]{0,20}\b(confer|verific|v[eê]|sei|saber)/i.test(t)) return false;
        const frases = t.split(/(?<=[.!?])\s+/);
        return frases.some((f, i) => MESMA_FRASE.test(f) || (SO_ITEM.test(f) && COMO_VERBO.test(frases[i + 1] || '')));
    }
    const CONFIG_RESPOSTA = '⚙️ Isso é **configuração do sistema**, e quem faz é o **Suporte Bsoft** (ou a Implantação) — você, como cliente, só emite. Para agilizar, abra o chamado em **' + SUPORTE + '** e leve: o documento/etapa em que parou, a mensagem exata que apareceu e um print da tela. Quando estiver pronto, volte a este passo e siga a emissão.';

    // ═════════ material ═════════
    const PESO_FONTE = { faq: 1.2, rapida: 1.15, banco: 1.0 };
    // quanto material cabe, conforme a velocidade medida (tokens lidos por segundo): PC lento = pouco texto (cada 100 caracteres custam ~25 tokens a ler)
    function orcamento(lerTps) {
        if (!(lerTps > 0) || lerTps < 10) return { docs: 1, chars: 480, nome: 'econômico' };
        if (lerTps < 40) return { docs: 2, chars: 800, nome: 'médio' };
        return { docs: 3, chars: 1400, nome: 'folgado' };
    }
    // lista única (banco, respostas aprovadas, FAQ) pela relevância; com código de rejeição na pergunta, o artigo que TEM o código sobe
    function candidatos(achados, codigos) {
        const lista = [];
        ['banco', 'rapida', 'faq'].forEach(f => ((achados || {})[f] || []).forEach(x => {
            let s = x.score * (PESO_FONTE[f] || 1);
            const tit = semAcento(x.doc.titulo), corpo = semAcento(x.doc.texto);
            (codigos || []).forEach(c => { if (tit.includes(c)) s *= 2.5; else if (corpo.includes(c)) s *= 1.4; });
            lista.push({ doc: x.doc, score: s, cobertura: x.cobertura });
        }));
        return lista.sort((a, b) => b.score - a.score);
    }
    function escolherMaterial(cands, texto, orc) {
        const qTok = L().tokens(L().anonimizar(texto));
        const topo = cands.slice(0, orc.docs);
        const porDoc = Math.floor(orc.chars / Math.max(1, topo.length));
        const qSet = new Set(qTok);
        return topo.map((c, i) => {
            const d = c.doc;
            const max = i === 0 ? Math.max(porDoc, Math.round(orc.chars * (topo.length > 1 ? 0.55 : 1))) : porDoc;
            const noTitulo = qSet.size ? Array.from(new Set(L().tokens(d.titulo))).filter(t => qSet.has(t)).length / qSet.size : 0;
            const trecho = melhorTrecho(d.texto, qTok, max, { inicio: noTitulo >= 0.6 }) || limitar(d.texto, max);
            return { chave: d.chave, titulo: d.titulo, fonte: d.fonte, caminho: d.caminho || '', trecho, noTitulo: Math.round(noTitulo * 100) / 100 };
        });
    }

    // ═════════ o que o cliente já informou (curto) ═════════
    function perfilCurto(o) {
        const p = o.perfil || {}, partes = [];
        try {
            // (só o que a pergunta usa: "vem de outro sistema; emite CT-e, MDF-e" gastava ~15 tokens de leitura em toda pergunta e não ajudava a responder)
            const pa = o.passoAtual && o.passoAtual.id, perg = semAcento(o.pergunta);
            if (pa === 'seguro' || /seguro|apolice|averba/.test(perg)) partes.push(p.seguro === 'configurar' ? 'seguro ainda NÃO configurado' : p.seguro === 'nao' ? 'não tem seguro' : 'seguro já configurado');
            const n = p.numeracao || {};
            if ((pa === 'numeracao' || /numera|sequencia|539|duplicidade/.test(perg)) && (n.cteNumero || n.mdfeNumero)) {
                if (n.cteNumero) partes.push('último CT-e ' + n.cteNumero + ' (série ' + (n.cteSerie || '?') + ') → o próximo no Bsoft deve ser ' + (parseInt(n.cteNumero, 10) + 1));
                if (n.mdfeNumero) partes.push('último MDF-e ' + n.mdfeNumero + ' (série ' + (n.mdfeSerie || '?') + ') → o próximo deve ser ' + (parseInt(n.mdfeNumero, 10) + 1));
            }
        } catch (e) { /* perfil incompleto: segue sem essa linha */ }
        return partes.join('; ');
    }

    // ═════════ resposta sem modelo ═════════
    const NAO_ENCONTREI = 'Não encontrei isso na base de conhecimento do Suporte Bsoft, e prefiro não te passar uma orientação errada. Tente escrever a pergunta com outras palavras (por exemplo, o nome do documento ou a mensagem exata que apareceu). Se continuar sem resposta, **fale com o Suporte** (' + SUPORTE + ').';
    // pergunta curta demais para achar o artigo certo ("não consigo emitir"): em vez de chutar um artigo (a busca traria "Como emitir uma NFS-e?"), pede o que falta, sem modelo
    const ESCLARECER = '🤔 Preciso de um pouco mais de detalhe para achar a resposta certa. Escreva a pergunta com mais palavras: **o que você quer fazer**, **em qual documento ou tela** (CT-e, MDF-e, CIOT, cadastro de…) e, se apareceu, a **mensagem exata** do erro. Assim eu procuro o artigo certo no banco de dados.';
    const ERRO_NAO_CONSTA = '**Esse erro não consta na base de conhecimento.** Não vou chutar uma causa. Confira, nesta ordem: (1) se o **talão e a numeração** estão certos; (2) se o cadastro de **pessoas, motorista e veículo** está completo; (3) se o **certificado digital** está válido; (4) a ordem de emissão: **CT-e → MDF-e → CIOT**. Se continuar, **fale com o Suporte** (' + SUPORTE + ') levando o **código e a mensagem exata** do erro, o documento e um print.';
    // O cliente só emite. Uma linha que o manda ajustar talão / numeração inicial / certificado / regras / tabelas (sem dizer que é com o Suporte) ensina a mexer no que não é dele:
    // a linha sai e entra o aviso (uma vez). Vale para o trecho do banco E para o texto do modelo. (Os artigos do banco foram escritos para a EQUIPE de suporte: "ajuste a numeração inicial…")
    const ENSINA_CONFIG = l => /(ajust|edit|alter|defin|habilit|corrij|mude|troque|instal|import|configur|cadastr)[^\n]{0,80}(numera[cç][aã]o inicial|n[uú]mero inicial|tal[aã]o|tal[oõ]es|certificado|regra de c[aá]lculo|regras de c[aá]lculo|tabela de pre[cç]o|par[aâ]metro)/i.test(l) && !/Suporte|Implanta|n[aã]o é algo|peça /i.test(l);
    const LINHA_SUPORTE = '🔒 **Esta etapa é feita pelo Suporte Bsoft**, não por você (ajuste de talão, numeração inicial, certificado, regras de cálculo ou tabelas). Peça em **' + SUPORTE + '**.';
    const SO_NUMERACAO = /numera[cç][aã]o|n[uú]mero inicial|sequ[eê]ncia/i;          // (só artigo de NUMERAÇÃO leva os números do cliente: "talão" aparece em qualquer configuração de talão, como a do DACTE)
    // o último número que o cliente disse ter emitido no sistema antigo (o que o Suporte vai pedir para acertar o talão); vem do que ele mesmo informou no passo da numeração
    function infoNumeracao(perfil) {
        const n = (perfil && perfil.numeracao) || {}, p = [];
        if (n.cteNumero) p.push('CT-e ' + n.cteNumero + ' (série ' + (n.cteSerie || '?') + ')');
        if (n.mdfeNumero) p.push('MDF-e ' + n.mdfeNumero + ' (série ' + (n.mdfeSerie || '?') + ')');
        return p.length ? 'Diga a eles o último número que você emitiu no sistema antigo: ' + p.join(' · ') + '.' : '';
    }
    // (por FRASE, não por linha: o modelo escreve parágrafos inteiros, e "instale o certificado. Depois clique em Novo" tem de perder só a 1ª frase)
    function tirarConfig(t, infoNum) {
        let n = 0; const tiradas = [];
        const linhas = String(t == null ? '' : t).split('\n').map(l => {
            const novas = l.split(/(?<=[.!?])\s+/).map(f => {
                if (!ENSINA_CONFIG(f)) return f;
                n++; tiradas.push(f);
                return n === 1 ? LINHA_SUPORTE : null;
            }).filter(f => f !== null);
            return novas.length ? novas.join(' ') : null;
        }).filter(l => l !== null);
        let texto = linhas.join('\n').replace(/\n{3,}/g, '\n\n');
        if (n && infoNum && SO_NUMERACAO.test(tiradas.join(' '))) texto = texto.replace(LINHA_SUPORTE, LINHA_SUPORTE + ' ' + infoNum);
        // sobra = letras que NÃO são o aviso (se o modelo só escreveu a etapa de configuração, a resposta virou só o aviso, sem dizer do que se trata: o trecho do banco, que leva o título, é melhor)
        const resto = texto.replace(LINHA_SUPORTE, '').replace(infoNum || '', '');
        return { texto, n, sobra: (resto.match(/\p{L}/gu) || []).length };
    }
    const semCortes = trecho => String(trecho || '').replace(/ ?\[…\]$/, ' […]');
    // ARTIGO DE CONFIGURAÇÃO: se QUALQUER frase do trecho manda mexer em talão/numeração/certificado/regras/tabelas, o trecho é um procedimento da EQUIPE de suporte inteiro (as frases seguintes
    // continuam o passo a passo: "Vai ter uma opção Imprime DACTE sem averbar? Marque sim e salve…") — tirar só a frase deixava o resto chegar ao cliente (achado com o Qwen/Llama de verdade).
    // Aqui o trecho INTEIRO vira o aviso do Suporte (+ os números do cliente, se for de numeração); null = o trecho não é de configuração.
    function blocoConfig(trecho, infoNum) {
        const frases = semCortes(trecho).split('\n').flatMap(l => l.split(/(?<=[.!?])\s+/));
        const tiradas = frases.filter(ENSINA_CONFIG);
        if (!tiradas.length) return null;
        return LINHA_SUPORTE + (infoNum && SO_NUMERACAO.test(tiradas.join(' ')) ? ' ' + infoNum : '');
    }
    // o trecho do banco como resposta: quando não há modelo, quando o modelo não serve, ou quando o artigo JÁ é a resposta (título = pergunta)
    function extrativa(material, aviso, infoNum) {
        if (!material || !material.length) return NAO_ENCONTREI;
        const m = material[0], bloco = blocoConfig(m.trecho, infoNum), c = { texto: bloco || semCortes(m.trecho), n: bloco ? 1 : 0 };
        // (se o artigo é de configuração, o "Onde fica" dele é a tela de configuração: não vai para o cliente)
        return '**' + m.titulo + '**\n\n' + c.texto + (m.caminho && !c.n ? '\n\n📍 Onde fica: ' + m.caminho : '') + '\n\n👉 Veja o artigo inteiro — e outros parecidos, se não for isso — em **Baseado em**.' + (aviso ? '\n\n_' + aviso + '_' : '');
    }
    // o mesmo para o modo ERRO: as 3 partes de sempre, montadas do próprio artigo (título = causa · trecho = como corrigir · Suporte = se não resolver)
    function extrativaErro(material, aviso, infoNum) {
        if (!material || !material.length) return ERRO_NAO_CONSTA;
        const m = material[0], bloco = blocoConfig(m.trecho, infoNum), c = { texto: bloco || semCortes(m.trecho), n: bloco ? 1 : 0 };
        return '**Causa provável:** ' + m.titulo.replace(/\.$/, '') + '.\n\n**Como corrigir:**\n' + c.texto + (m.caminho && !c.n ? '\n\n📍 Onde fica: ' + m.caminho : '') +
            '\n\n**Se não resolver:** fale com o **Suporte** (' + SUPORTE + ') levando o **código e a mensagem exata** do erro, o documento e um print.\n\n👉 Veja o artigo inteiro — e outros parecidos, se não for isso — em **Baseado em**.' + (aviso ? '\n\n_' + aviso + '_' : '');
    }
    const extrativaDe = (meta, aviso) => meta.erro ? extrativaErro(meta.material, aviso, meta.infoNum) : extrativa(meta.material, aviso, meta.infoNum);

    // ═════════ montagem ═════════
    // o = o que MigIA.perguntar passa (pergunta, historico, perfil, roteiro, passoAtual, achados, regras, modo…) · opc = { ix, lerTps, aviso }
    // Devolve as mensagens do chat e, em .local, o que o motor precisa para decidir (resposta direta, não encontrei, trecho do banco…).
    function montar(o, opc) {
        opc = opc || {};
        const erro = o.modo === 'erro', orc = orcamento(opc.lerTps);
        const pergunta = String(o.pergunta || ''), texto = textoDaPergunta(pergunta, erro), passo = o.passoAtual || null;
        const codigos = erro ? codigosDe(texto) : codigosDe(pergunta);
        const achados = opc.ix ? acharPelaPergunta(opc.ix, texto) : (o.achados || {});
        const cands = candidatos(achados, codigos);
        const material = escolherMaterial(cands, texto, orc);
        const regrasP = erro ? [] : regrasDaPergunta(opc.ix, texto);
        const infoNum = infoNumeracao(o.perfil);
        const local = { tipo: 'mentor', erro, orcamento: orc.nome, direta: '', diretaTipo: '', naoEncontrei: false, extrativa: '', material, permitidos: '', regrasIds: [], infoNum, confiante: false, materialConfig: false };
        const direta = (tipo, texto2) => { local.direta = texto2; local.diretaTipo = tipo; };
        // 0) configuração do sistema (certificado, talão, regras, tabelas) → é com o Suporte (fora do modo erro: lá a mensagem do erro pode citar o certificado e o artigo ajuda a triar)
        if (!erro && ehConfiguracao(texto)) direta('suporte', CONFIG_RESPOSTA);
        // 1) "o que é…?" → o glossário
        if (!local.direta && !erro && ehDefinicao(texto)) { const ts = termosDaPergunta(opc.ix, texto); if (ts.length) direta('glossario', ts.map(a => termoTexto(a.doc.termo)).join('\n\n---\n\n')); }
        // 2) prazo / obrigação com regra → a própria regra
        if (!local.direta && regrasP.length && temIntencaoDeRegra(texto)) { direta('regra', regrasP.map(a => regraTexto(a.doc.regra)).join('\n\n---\n\n')); local.regrasIds = regrasP.map(a => a.doc.regra.id); }
        // 3) erro com um código que NENHUM artigo tem → triagem padrão
        if (erro && codigos.length) {
            const base = cands.map(c => semAcento(c.doc.titulo + ' ' + c.doc.texto)).concat((o.regras || []).map(r => semAcento((r.titulo || '') + ' ' + (r.regra || '') + ' ' + (r.detalhe || []).join(' '))));
            if (!codigos.some(c => base.some(t => t.includes(c)))) direta('triagem', ERRO_NAO_CONSTA);
        }
        // 4) a pergunta, sozinha, não achou nada (e não há regra) → não encontrei
        if (!local.direta && !material.length && !regrasP.length) local.naoEncontrei = true;
        // 5) pergunta de UMA palavra só ("não consigo emitir"), fora do modo erro e sem conversa anterior para completar → pede detalhe, em vez de chutar um artigo
        const hist0 = (o.historico || []).filter(h => h && h.texto);
        if (!local.direta && !local.naoEncontrei && !erro && L().tokens(L().anonimizar(texto)).length < 2 && hist0.length < 2) direta('esclarecer', ESCLARECER);
        // "confiante": o banco JÁ tem a resposta — o artigo cujo título é (quase) a própria pergunta, ou, num erro, o artigo que traz o código. Aí o modelo só reescreveria (devagar, e inventando passos):
        // a ligação responde direto do banco, na hora, a não ser que a pessoa peça "IA em tudo".
        // (a pergunta traz um código de rejeição e o título do artigo traz o MESMO código — "Deu rejeição 539 ao autorizar o MDF-e…" × "Erro ou Rejeição SEFAZ 539: Duplicidade…" — vale também fora do modo erro)
        if (material.length) {
            const m0 = material[0];
            const codigoNoTitulo = codigos.length > 0 && codigos.some(c => semAcento(m0.titulo).includes(c));
            // (e o material de CONFIGURAÇÃO — procedimento da equipe de suporte — também vai direto: nada que o modelo escreva a partir dele serve ao cliente, e o modelo levaria minutos para chegar ao mesmo aviso)
            local.materialConfig = material.some(m => !!blocoConfig(m.trecho));
            local.confiante = codigoNoTitulo || (!erro && m0.noTitulo >= 0.6 && L().tokens(L().anonimizar(texto)).length >= 2) || local.materialConfig;
        }
        local.extrativa = extrativaDe(local, opc.aviso || '');
        // o prompt (curto: no processador de um PC comum cada 100 caracteres custam ~10 s de leitura)
        let u = '';
        if (passo) u += 'Passo do cliente: ' + limitar(passo.titulo, 90) + '\n';
        const perfil = perfilCurto(o); if (perfil) u += 'Dados do cliente: ' + perfil + '\n';
        const hist = (o.historico || []).filter(h => h && h.texto);
        if (L().tokens(texto).length < 3 && hist.length >= 2) {            // pergunta curtinha ("e depois?", "não entendi", "pode explicar melhor?"): leva o último par de conversa
            const q = hist[hist.length - 2], r = hist[hist.length - 1];
            if (q.papel === 'voce' && r.papel === 'ia') u += 'Conversa anterior: cliente: ' + limitar(L().anonimizar(q.texto), 140) + ' | assistente: ' + limitar(r.texto, 220) + '\n';
        }
        u += 'TEXTO:\n' + (material.length ? material.map((m, i) => (i + 1) + ') ' + m.titulo + ': ' + m.trecho.replace(/\n+/g, ' ')).join('\n') : '(nada encontrado)') + '\n\n';
        u += 'Pergunta: ' + limitar(L().anonimizar(texto).replace(/\n+/g, ' '), 420) + '\n\n';
        u += erro ? MODO_ERRO : 'Resposta em até 2 frases:';
        local.permitidos = semAcento([u, SUPORTE, (o.regras || []).map(r => (r.regra || '') + ' ' + (r.prazo || '') + ' ' + (r.detalhe || []).join(' ')).join(' ')].join(' '));
        const msgs = [{ role: 'system', content: SISTEMA }, { role: 'user', content: u }];
        Object.defineProperty(msgs, 'local', { value: local, enumerable: false });
        return msgs;
    }

    // ═════════ o que o modelo devolve ═════════
    const INGLES = new Set('the and you your are is this that have can please hello thanks thank would could will what how when where which with'.split(' '));
    const ESTRANHO = /[぀-ヿ㐀-䶿一-鿿가-힯Ѐ-ӿ؀-ۿ]/;
    function pareceOutraLingua(t) {
        if (ESTRANHO.test(t)) return true;
        const w = semAcento(t).split(/[^a-z]+/).filter(Boolean);
        if (w.length < 5) return false;
        const n = w.filter(x => INGLES.has(x)).length;
        return n >= 3 && n / w.length >= 0.15;
    }
    const RECUSA = /\b(?:desculpe|sinto muito|lamento|sorry)\b[^.!?]{0,40}\b(?:n[aã]o posso|n[aã]o consigo|cannot|can't)\b|\bn[aã]o posso (?:atender|ajudar|cumprir|responder)\b|\bcomo (?:um )?(?:modelo de linguagem|assistente virtual|intelig[eê]ncia artificial)\b/i;
    // o modelo pequeno diz "não consta" mesmo com a resposta no material (e, sem essa instrução, às vezes diz "não há informações"): isso não é resposta, o trecho do banco é melhor
    const NAO_RESPONDE = /^\W*(?:n[aã]o consta|n[aã]o h[aá] (?:informa|material|nada|dados)|n[aã]o (?:encontrei|sei|tenho)|o material n[aã]o|sem informa)/i;
    // o modelo pequeno entra em ciclo: escreve a MESMA frase (com pequenas trocas) nas partes da resposta. Conta as frases que repetem uma anterior:
    // ≥ 80% das palavras em comum, ou as 5 primeiras palavras iguais ("Alterar a numeração inicial para…" nas 3 partes do erro)
    const palavrasDe = s => new Set(semAcento(s).split(/[^a-z0-9]+/).filter(w => w.length > 2));
    function repeticoes(t) {
        const frases = String(t).split(/(?<=[.!?])\s+|\n+/).map(s => s.replace(/\*\*[^*]{1,30}\*\*:?/g, '').replace(/^[\s\-*\d.)]+/, '').trim()).filter(s => s.length >= 25);
        const vistas = []; let rep = 0;
        frases.forEach(s => {
            const w = palavrasDe(s); if (w.size < 4) return;
            const ini = semAcento(s).split(/[^a-z0-9]+/).filter(Boolean).slice(0, 5).join(' ');
            const igual = vistas.some(v => v.ini === ini || (() => { let c = 0; w.forEach(x => { if (v.w.has(x)) c++; }); return c / Math.min(w.size, v.w.size) >= 0.8; })());
            if (igual) rep++; else vistas.push({ w, ini });
        });
        return { rep, frases: frases.length };
    }
    // nomes entre aspas ("Salvar", "menu lateral") que não estão no material, no passo, no menu nem na pergunta: o modelo pequeno inventa botão e tela
    const ASPAS = /["“”«]([^"“”«»\n]{2,40})["“”»]/g;
    function nomesInventados(t, meta) {
        const base = (meta && meta.permitidos) || ''; if (!base) return [];
        return Array.from(new Set(Array.from(String(t).matchAll(ASPAS)).map(m => m[1].trim()).filter(n => !base.includes(semAcento(n)) && !base.includes(semAcento(n).replace(/s$/, ''))))).slice(0, 4);
    }
    const NUM_UN = /(\d+(?:[.,]\d+)?)\s*(dias?|horas?|h\b|anos?|meses|mês|%|reais)/gi;
    // texto cru do modelo → texto final. Devolve '' se não serve (o motor usa então o trecho do banco). meta = messages.local
    function finalizar(bruto, meta, finishReason) {
        let t = String(bruto == null ? '' : bruto).replace(/\r/g, '').trim();
        t = t.replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/<think>[\s\S]*$/i, '').replace(/^```(?:markdown|md|text)?\s*\n([\s\S]*?)\n```$/i, '$1').trim();
        t = t.replace(/https?:\/\/\S+/g, '').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
        if (meta && meta.materialConfig) return '';          // o texto de apoio era um procedimento de configuração da equipe: nada escrito a partir dele serve ao cliente (o motor usa o trecho do banco, que vira o aviso do Suporte)
        if (t.length < 20 || pareceOutraLingua(t) || RECUSA.test(t) || NAO_RESPONDE.test(t) || /\[[^\]\n]{1,30}\]/.test(t.replace(/\[…\]/g, ''))) return '';
        const rp = repeticoes(t); if (rp.rep >= 2 || (rp.rep >= 1 && rp.rep / Math.max(1, rp.frases) >= 0.3)) return '';
        if (nomesInventados(t, meta).length) return '';
        if (finishReason === 'length') {        // o modelo parou no limite de tokens: termina na última frase inteira (se ela ainda estiver na 2ª metade); senão, sinaliza o corte
            const i = Math.max(t.lastIndexOf('. '), t.lastIndexOf('.\n'), t.lastIndexOf('! '), t.lastIndexOf('? '));
            if (i > t.length * 0.5) t = t.slice(0, i + 1); else if (!/[.!?…\]]$/.test(t)) t += ' […]';
        }
        if (t.length > 1800) t = t.slice(0, 1800).replace(/\s+\S*$/, '') + '…';
        const avisos = [];
        if (meta && meta.permitidos) {
            const novos = Array.from(t.matchAll(NUM_UN)).filter(m => !meta.permitidos.includes(semAcento(m[1]))).map(m => m[0]);
            if (novos.length) avisos.push('⚠️ **Atenção:** o número/prazo (' + Array.from(new Set(novos)).slice(0, 3).join('; ') + ') não está no material que consultei. Confirme com o Suporte ou com o seu contador antes de agir.');
        }
        // linha que ensina a mexer em talão/numeração/certificado/regras sem mandar ao Suporte: sai e entra o aviso
        const sc = tirarConfig(t, meta && meta.infoNum);
        if (sc.n && sc.sobra < 25) return '';          // só sobrou o aviso do Suporte: sem contexto ele engana ("imprimir o DACTE é com o Suporte?"); o motor usa o trecho do banco (título + aviso)
        t = sc.texto;
        return avisos.length ? t + '\n\n' + avisos.join('\n\n') : t;
    }

    return { SISTEMA, MODO_ERRO, NAO_ENCONTREI, ESCLARECER, ERRO_NAO_CONSTA, CONFIG_RESPOSTA, LINHA_SUPORTE, SUPORTE, mensagensAquecimento, unidades, melhorTrecho, textoDaPergunta, codigosDe, focoDe, acharPelaPergunta, temIntencaoDeRegra, regraTexto, regrasDaPergunta, ehDefinicao, termosDaPergunta, termoTexto, ehConfiguracao,
        orcamento, candidatos, escolherMaterial, perfilCurto, extrativa, extrativaErro, extrativaDe, montar, finalizar, pareceOutraLingua, ENSINA_CONFIG, tirarConfig, blocoConfig, repeticoes, nomesInventados, infoNumeracao };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = MigLocalRag;
