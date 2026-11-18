/* js/simulador-local/regras.js — Simulador LOCAL (simuladorlocal.html): as decisões que NÃO dependem do modelo de IA.
   Um modelo de 0,5B–1B rodando no processador do computador é lento (medido num i3-7100: ~3 tokens/s ao ler e ~2 ao escrever, e uma palavra tem ~2 tokens) e erra ao julgar. Por isso aqui:
     • o MODELO só faz o que sabe fazer: escrever as falas do cliente (prompt curto, sem a solução, para ler pouco texto a cada turno);
     • quem decide se o suporte orientou o essencial é uma REGRA (cobertura dos termos da solução na fala do suporte): instantânea, sem custo e sempre igual;
     • a dica também é por regra (3 níveis).
   Tudo aqui é função pura (sem tela, sem rede): dá para testar em Node (tools/bancada-desempenho/teste-simulador-local-logica.js).
   A frase final do cliente tem que ser igual à de SimLogica (js/simulador/logica.js): o teste confere. */
const SimLocalRegras = (() => {
    'use strict';
    const FRASE_FINAL = 'Deu certinho, muito obrigado pelo auxílio';
    // limites da cobertura (0 a 1) = fração dos termos essenciais da solução que o suporte já citou: no TOTAL e em CADA METADE da solução
    // (a 1ª metade costuma ser o caminho/diagnóstico e a 2ª a ação que resolve: só o menu, sem a ação, não basta — calibrado em 200 artigos reais, ver o teste)
    const LIM = { auto: 0.40, botao: 0.30, metadeAuto: 0.15, metadeBotao: 0.10, minTermos: 3 };
    const TAM_ESSENCIAL = 700;          // só o começo da solução vale como "o essencial" (o resto costuma ser aviso, exceção e variação)

    const semAcento = s => String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const limitar = (t, n) => { t = String(t == null ? '' : t).replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n).replace(/\s+\S*$/, '') : t; };
    // começo do texto, cortado no fim de uma frase quando dá
    const comeco = (t, n) => { t = String(t == null ? '' : t).replace(/\s+/g, ' ').trim(); if (t.length <= n) return t; const c = t.slice(0, n); const i = Math.max(c.lastIndexOf('. '), c.lastIndexOf('; '), c.lastIndexOf(': ')); return i > 120 ? c.slice(0, i + 1) : c; };

    // ═════════ termos da solução ═════════
    const PARADA = new Set(('que com para por uma uns umas dos das nos nas aos mas como mais seu sua seus suas voce voces vai vou foi sao ser tem ter esta esse essa isso aqui ali tambem ainda entao quer qual quais quando onde pelo pela ' +
        'sobre entre ate apos antes depois muito pouco todo toda todos todas cada outro outra outros outras mesmo mesma enquanto porque pois assim apenas somente sempre nunca ele ela eles elas dele dela nosso nossa porem alem ' +
        'seja sera estar estao era eram tinha podem pode poder deve devem deverao nao sim nem dois duas tres alguns algumas qualquer quaisquer sendo sido fazer feito faca basta caso casos conforme exemplo seguinte abaixo acima ' +
        'sistema clique clicar tela telas campo campos opcao opcoes deve preencha preencher selecione selecionar marque marcar informe informar acesse acessar abra abrir menu botao usuario usuarios cliente bsoft ponto passo passos ' +
        'item itens dados dado forma vez vezes ficar fica ficam utilize utilizar usar uso lembrando necessario importante observacao obs ex etc entrar entra vai ir va aparece aparecer aparecem').split(' '));
    // siglas e nomes curtos do dia a dia fiscal/transporte: valem mesmo com menos de 4 letras
    const CURTAS = new Set('cte mdfe nfe nfse ciot icms cst cfop gnre ncm rntrc antt cnpj cpf xml pdf ibge uf km pis cofins iss nf cf mdf cc cce csc irrf inss'.split(' '));
    const valeComoTermo = w => w.length >= 4 || CURTAS.has(w) || (/\d/.test(w) && w.length >= 2);
    const normalizarSiglas = t => t.replace(/\b(ct|mdf|nf|nfs|cf)\s*-\s*e\b/g, '$1e');        // "CT-e" → "cte"
    const radicalDe = w => (w.length > 5 ? w.slice(0, 5) : w);                                  // "emitir"≈"emitido", "manual"≈"manualmente"

    // texto → radicais (palavras sem acento, cortadas em 5 letras)
    function radicais(texto) {
        const saida = [];
        normalizarSiglas(semAcento(texto)).split(/[^a-z0-9]+/).forEach(w => { if (w && !PARADA.has(w) && valeComoTermo(w)) saida.push(radicalDe(w)); });
        return saida;
    }

    // Termos essenciais da solução: os do começo do texto (+ caminho do menu), menos os que já estão na dúvida do cliente (título).
    // Cada termo guarda uma palavra original para mostrar ("ainda não apareceu: «habilitado»").
    function essenciais(caso) {
        const base = comeco(caso && caso.conteudo, TAM_ESSENCIAL) + ' ' + String((caso && caso.caminho_menu) || '');
        const doTitulo = new Set(radicais(caso && caso.titulo));
        const vistos = new Map();
        normalizarSiglas(semAcento(base)).split(/[^a-z0-9]+/).forEach(w => {
            if (!w || PARADA.has(w) || !valeComoTermo(w)) return;
            const r = radicalDe(w);
            if (doTitulo.has(r)) return;
            if (!vistos.has(r)) vistos.set(r, { r, palavra: w, n: 0 });
            vistos.get(r).n++;
        });
        return Array.from(vistos.values());
    }

    // Quanto do essencial o suporte já disse (juntando TODAS as falas dele). Devolve { cob (0 a 1), ini, fim (cobertura de cada metade), total, achados, faltam }
    function avaliar(caso, hist) {
        const ess = essenciais(caso);
        const falas = (hist || []).filter(x => x && x.de === 'suporte' && x.texto).map(x => x.texto).join(' ');
        const dito = new Set(radicais(falas));
        const achados = ess.filter(t => dito.has(t.r)), faltam = ess.filter(t => !dito.has(t.r));
        const peso = l => l.reduce((s, t) => s + 1 + Math.min(1, (t.n - 1) * 0.25), 0);       // termo repetido na solução pesa um pouco mais
        const cob = ess.length ? peso(achados) / peso(ess) : 0;
        const meio = Math.ceil(ess.length / 2);
        const cobDe = l => l.length ? l.filter(t => dito.has(t.r)).length / l.length : 1;
        return { cob, ini: cobDe(ess.slice(0, meio)), fim: cobDe(ess.slice(meio)), meio, total: ess.length, achados, faltam, essenciais: ess };
    }
    // O suporte já orientou o essencial? modo 'auto' (o cliente decide sozinho) é mais exigente que 'botao' (a pessoa clicou em "Já orientei tudo")
    function veredito(caso, hist, modo) {
        const a = avaliar(caso, hist);
        const botao = modo === 'botao';
        const lim = botao ? LIM.botao : LIM.auto, limMeio = botao ? LIM.metadeBotao : LIM.metadeAuto;
        const minimo = Math.min(LIM.minTermos, Math.ceil(a.total * 0.6));
        const ok = a.total > 0 && a.cob >= lim && a.ini >= limMeio && a.fim >= limMeio && a.achados.length >= minimo;
        // o que falta: primeiro da metade que está mais descoberta
        const naIni = a.faltam.filter(t => a.essenciais.indexOf(t) < a.meio), naFim = a.faltam.filter(t => a.essenciais.indexOf(t) >= a.meio);
        const faltam = a.ini <= a.fim ? naIni.concat(naFim) : naFim.concat(naIni);
        const falta = ok ? '' : (faltam.length ? 'ainda não apareceu na orientação: ' + faltam.slice(0, 3).map(t => '«' + t.palavra + '»').join(', ') : '');
        return { ok, falta, cob: a.cob, ini: a.ini, fim: a.fim, achados: a.achados.length, total: a.total };
    }
    // texto no formato que SimLogica.interpretarJuiz entende
    const vereditoJson = v => JSON.stringify({ resolvido: v.ok, falta: v.falta });

    // ═════════ dica (3 níveis, sem IA) ═════════
    const primeiroNo = caminho => String(caminho || '').split(/\s*(?:>|\/|\||»)\s*/).map(s => s.trim()).filter(Boolean)[0] || '';
    function dica(caso, hist, nivel) {
        const cat = String((caso && caso.categoria) || '').trim();
        const no = primeiroNo(caso && caso.caminho_menu);
        const ainda = avaliar(caso, hist).faltam.slice().sort((x, y) => y.n - x.n || y.palavra.length - x.palavra.length);
        if (!(nivel > 1)) return cat ? 'Dica: o assunto é da área «' + cat + '». Pergunte ao cliente em qual tela ele está, o que tentou fazer e o que apareceu.' : 'Dica: pergunte ao cliente o que ele estava tentando fazer, em qual tela estava e o que apareceu.';
        if (nivel === 2) return no ? 'Dica: o caminho começa em «' + no + '». Peça para o cliente abrir essa área e contar o que vê.' : 'Dica: peça para o cliente descrever a tela passo a passo (menu, aba, botões) antes de orientar.';
        const dois = ainda.slice(0, 2).map(t => '«' + t.palavra + '»');
        return dois.length ? 'Dica: a solução passa por ' + dois.join(' e ') + '. Oriente o cliente nesse sentido, com suas palavras.' : 'Dica: reveja o que você já orientou; o cliente precisa saber a tela e a ação que resolvem.';
    }

    // ═════════ o prompt do cliente (compacto de propósito) ═════════
    // Regras para o modelo pequeno: instruções curtas e diretas, em português; a PARTE FIXA vem primeiro (o servidor reaproveita o que já leu: cada caso só lê o que muda);
    // a solução NÃO vai no prompt (ler 500 palavras a mais custaria minutos num PC fraco; quem confere a solução é a regra de cobertura).
    // Lições dos testes com modelos reais (0,5B e 1B), que o prompt já leva em conta:
    //  • SEM exemplo de conversa: os dois modelos COPIARAM o exemplo ("o botão de emitir não aparece") em casos que não tinham nada a ver;
    //  • SEM instrução narrada ("O atendente abriu o chat. Escreva…"): o Qwen repetia a frase como se fosse a fala ("O atendente abriu o chat. O cliente está…") — a abertura é uma saudação
    //    NATURAL do suporte, e o cliente (assistant) responde a ela;
    //  • SEM rótulo "Atendente:" nas falas do suporte: o modelo imitava o rótulo ("O atendente: Tenta fechar…");
    //  • em PRIMEIRA PESSOA e com um nome: sem nome vinha "[Nome]" e narração em terceira pessoa.
    const REGRAS_FIXAS = 'Você está no chat de suporte do sistema Bsoft TMS, de uma transportadora, pedindo ajuda para resolver um problema. A outra pessoa do chat é do suporte e responde você.\n' +
        'Escreva só o que você digitaria no chat: em primeira pessoa, em português do Brasil, informal, em 1 ou 2 frases curtas (no máximo 25 palavras). Não cumprimente de novo depois da primeira mensagem. Fale só do seu problema e não invente outros assuntos. ' +
        'Você não sabe a solução: não dê conselhos, não explique como resolver e não faça perguntas de atendente. Se o suporte perguntar algo, responda com um detalhe simples. Se ele explicar um passo, diga que vai tentar ou conte o que viu. Sem listas, sem aspas e sem colchetes.\n';
    const PERFIS = {
        normal: 'Seu jeito: educado, simples e direto.',
        leigo: 'Seu jeito: pouco jeito com sistema; descreve com palavras suas, meio confuso, e pergunta onde fica as coisas.',
        apressado: 'Seu jeito: com pressa; mensagens bem curtas e um pouco impacientes.'
    };
    // Primeira fala do suporte (invisível na tela): é o gancho natural para o cliente (a IA) abrir contando o problema
    const ABERTURA_DO_SUPORTE = 'Olá! Aqui é do suporte. Em que posso ajudar?';
    const NOMES = ['Marcos', 'Carla', 'Rafael', 'Juliana', 'Paulo', 'Fernanda', 'Anderson', 'Patrícia', 'Ricardo', 'Camila'];
    const nomeDoCaso = caso => { const k = caso && caso.id != null ? Number(caso.id) : Array.from(String((caso && caso.titulo) || '')).reduce((s, ch) => s + ch.charCodeAt(0), 0); return NOMES[Math.abs(Math.round(k)) % NOMES.length]; };

    function sistema(caso, perfil) {
        return REGRAS_FIXAS + (PERFIS[perfil] || PERFIS.normal) + '\nVocê é ' + nomeDoCaso(caso) + '. Seu problema: "' + limitar(caso && caso.titulo, 240) + '"';
    }
    // hist: [{ de: 'cliente' | 'suporte', texto }]. O cliente é o "assistant"; o suporte é o "user" (como no simulador original).
    // Nada do que já foi dito muda de um turno para o outro (senão o servidor teria que reler tudo): só se ACRESCENTA no fim.
    // Conversa muito longa: fica a abertura e as últimas falas (tira o par suporte+cliente mais antigo depois da abertura).
    function mensagens(caso, perfil, hist, nota) {
        const msgs = [{ role: 'system', content: sistema(caso, perfil) }, { role: 'user', content: ABERTURA_DO_SUPORTE }];
        let h = (hist || []).filter(x => x && x.texto);
        const MAX_CHARS = 3200;
        const tam = l => l.reduce((s, x) => s + String(x.texto).length, 0);
        while (h.length > 6 && tam(h) > MAX_CHARS && h[0].de === 'cliente') h = h.slice(0, 1).concat(h.slice(3));
        h.forEach((x, i) => msgs.push(x.de === 'cliente' ? { role: 'assistant', content: x.texto } : { role: 'user', content: limitar(x.texto, 700) + (nota && i === h.length - 1 ? '\n(' + nota + ')' : '') }));
        return msgs;
    }
    // Só o trecho fixo do prompt: o motor lê isto antes (aquecimento), com o computador parado, para o 1º cliente não esperar por ele
    const mensagensAquecimento = () => [{ role: 'system', content: REGRAS_FIXAS }, { role: 'user', content: ABERTURA_DO_SUPORTE }];
    // O aviso interno que o simulador cola quando o cliente "virou o suporte" é longo demais para um modelo pequeno: aqui vira uma frase só
    const NOTA_ECO = 'Responda ao que o atendente disse, como cliente: não repita a pergunta dele.';
    const notaCurta = nota => /devolveu a pergunta|repetiu a sua mensagem|falou como atendente/i.test(String(nota || '')) ? NOTA_ECO : '';

    // ═════════ o texto que o modelo devolve ═════════
    const ESTRANHO = /[぀-ヿ㐀-䶿一-鿿가-힯Ѐ-ӿ؀-ۿ]/;       // japonês/chinês/coreano/cirílico/árabe (o modelo pequeno às vezes "escapa" para outra língua)
    const INGLES = new Set('the and you your are is this that have can please hello thanks thank would could will what how when where which with'.split(' '));
    function pareceOutraLingua(t) {
        if (ESTRANHO.test(t)) return true;
        const w = semAcento(t).split(/[^a-z]+/).filter(Boolean);
        if (w.length < 4) return false;
        const n = w.filter(x => INGLES.has(x)).length;
        return n >= 2 && n / w.length >= 0.2;
    }
    // O modelo pequeno às vezes escorrega para o papel de ATENDENTE (dá conselho, oferece ajuda): essas frases não são de cliente e são descartadas.
    // ("Você pode me explicar…" é pedido de cliente e fica.)
    const VOZ_DE_ATENDENTE = /\bvoc[eê]\s+(?:pode|poderia|deve|deveria|precisa|tem que|vai precisar)\s+(?!me\b|nos\b|ver\b|explicar\b|mandar\b|passar\b|dizer\b|ajudar\b|enviar\b|falar\b|informar\b)|^(?:tente|tenta|verifique|verifica|confira|experimente|clique|acesse|abra|certifique|lembre|recomendo|sugiro|aguarde|entre em contato)\b|\b(?:posso|podemos)\s+(?:te\s+)?ajudar\b|\bestou aqui para\b|\bqualquer d[uú]vida\b|\bfico [àa] disposi[cç][aã]o\b|\bsinto muito\b/i;
    // O Llama 3.2 às vezes RECUSA o papel ("Desculpe, mas não posso atender a esse pedido."): isso não é fala de cliente
    const RECUSA = /\b(?:desculpe|sinto muito|lamento|sorry)\b[^.!?]{0,40}\b(?:n[aã]o posso|n[aã]o consigo|cannot|can't)\b|\bn[aã]o posso (?:atender|ajudar|cumprir|fazer isso|continuar|responder)\b|\bcomo (?:um )?(?:modelo de linguagem|assistente(?: virtual)?|ia\b|intelig[eê]ncia artificial)/i;
    // O Qwen 0,5B às vezes NARRA a cena em 3ª pessoa ("O atendente abriu o chat. O cliente está com problemas…"), escreve "[Nome]" literal ou fala como assistente
    const NARRACAO = /^(?:o|a)\s+(?:atendente|cliente|assistente|usu[aá]rio)\b|\bcomo (?:uma? )?assistente\b|\bn[aã]o tenho acesso\b/i;
    const PLACEHOLDER = /\[[^\]]{1,30}\]/;
    const SAUDACAO = /^\s*(?:ol[aá]|oi|opa|bom dia|boa tarde|boa noite)(?![\p{L}])[\s,!.:;-]*/iu;       // (\b não enxerga "á": por isso o (?![\p{L}]))
    // Fala crua do modelo → fala do cliente (uma só, curta, sem etiquetas). Devolve '' se não serve (outra língua, fala de atendente, vazia).
    // opc.abertura: é a 1ª mensagem (pode cumprimentar); nas outras a saudação é cortada (cliente de chat não diz "Olá!" a cada fala).
    function limparFala(bruto, opc) {
        const abertura = !!(opc && opc.abertura);
        let t = String(bruto == null ? '' : bruto).replace(/\r/g, '');
        t = t.replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/<think>[\s\S]*$/i, '').replace(/\[\s*ESTADO[^\]]*\]/gi, '').replace(/^\s*["“”'`]+/, '');
        t = t.replace(/^\s*(?:\*\*)?\s*(?:cliente|customer|client)\s*(?:\*\*)?\s*[:：]\s*(?:\*\*)?\s*/i, '');
        const corte = t.search(/\n\s*(?:\*\*)?\s*(?:atendente|suporte|agent|support|cliente|customer)\s*(?:\*\*)?\s*[:：]/i);       // o modelo continuou escrevendo os dois lados do diálogo
        if (corte > 0) t = t.slice(0, corte);
        t = t.split(/\n\s*\n/)[0].replace(/^\s*[-*•]\s+/, '').replace(/\*\*(.*?)\*\*/g, '$1').replace(/^["“”'`]+|["“”'`]+$/g, '').replace(/\s*\n\s*/g, ' ').trim();
        if (/^\s*(?:o\s+)?atendente\s*[:：]/i.test(t) || RECUSA.test(t) || PLACEHOLDER.test(t)) return '';
        let frases = (t.match(/[^.!?…]+[.!?…]*/g) || (t ? [t] : [])).map(s => s.trim()).filter(Boolean);
        frases = frases.filter(s => !VOZ_DE_ATENDENTE.test(s) && !NARRACAO.test(s));
        if (!abertura && frases.length) {
            const sem = frases[0].replace(SAUDACAO, '');
            if (sem.replace(/[^\p{L}]/gu, '').length >= 3) frases[0] = sem.charAt(0).toUpperCase() + sem.slice(1); else if (frases.length > 1) frases.shift();
        }
        t = frases.slice(0, 3).join(' ').trim();
        if (t.length > 260) t = t.slice(0, 260).replace(/\s+\S*$/, '') + '…';
        if (!t || t.length < 3 || pareceOutraLingua(t)) return '';
        return t;
    }
    const primeiraMinuscula = s => { s = String(s || '').trim().replace(/[.?!\s]+$/, ''); return s ? s.charAt(0).toLowerCase() + s.slice(1) : s; };
    // Quando o modelo não entrega nada que sirva: uma fala neutra e natural (o simulador segue em frente em vez de travar)
    function falaReserva(caso, hist) {
        const temFala = (hist || []).some(x => x && x.de === 'suporte' && x.texto);
        if (!temFala) return 'Oi, preciso de ajuda: ' + primeiraMinuscula(caso && caso.titulo).slice(0, 200) + '?';
        return 'Hum, não entendi direito. Pode explicar de outro jeito?';
    }

    return { FRASE_FINAL, LIM, TAM_ESSENCIAL, PERFIS, REGRAS_FIXAS, ABERTURA_DO_SUPORTE, nomeDoCaso, semAcento, radicais, essenciais, avaliar, veredito, vereditoJson, dica, sistema, mensagens, mensagensAquecimento, notaCurta, limparFala, pareceOutraLingua, falaReserva, comeco };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = SimLocalRegras;
