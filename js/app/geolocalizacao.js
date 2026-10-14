/* js/app/geolocalizacao.js — Chat: "latitude e longitude de <endereço>", respondido na tela com o OpenStreetMap (Nominatim), sem IA. */
// ═══════════════════════════════════════════════════════════
//  LATITUDE E LONGITUDE DE UM ENDEREÇO (handleChat)
// ═══════════════════════════════════════════════════════════
// Exemplos que o chat entende (ver Geo.interpretar):
//   latitude e longitude de AC ALTO PARAISO, 10 10, CENTRO — ALTO PARAÍSO - PR        (o endereço como o Bsoft mostra: RUA, NÚMERO, BAIRRO — CIDADE - UF)
//   AC ALTO PARAISO, 10 10, CENTRO — ALTO PARAÍSO - PR                                 (só o endereço nesse formato também vale)
//   coordenadas de Av. Brasil, 1000, Zona 01, Maringá - PR   |   lat/long de Rua XV de Novembro 100 Curitiba PR   |   latitude e longitude de Alto Paraíso - PR
// A busca é feita em ordem, parando na primeira que achar:
//   1) Rua + Bairro + Cidade + Estado     2) Bairro + Cidade + Estado     3) Cidade + Estado
// (sem bairro, o passo 1 vira Rua + Cidade + Estado; sem rua, começa no 2; o número da casa não entra na busca. Extra, só quando há rua E bairro e os dois primeiros passos falharam:
// "Rua + Cidade + Estado" antes de cair para a cidade, com aviso de que o bairro não conferiu — a rua é bem mais precisa que o centro da cidade.)
// Quem responde é o serviço público Nominatim (https://nominatim.openstreetmap.org, dados © colaboradores do OpenStreetMap, licença ODbL) — o navegador consulta direto, só o endereço digitado
// é enviado. Regras do serviço respeitadas aqui: no máximo 1 consulta por segundo (fila com intervalo), mesma consulta não é repetida na sessão (cache em memória, inclusive a que ainda está em
// andamento), atribuição na resposta. A IA NÃO participa: ela não consulta mapas e nunca deve inventar coordenadas (regra 13 do prompt, em chat.js).
// Cada resultado é CONFERIDO antes de ser aceito: o estado precisa ser o informado e o município também (senão "Alto Paraíso" do Paraná poderia voltar com o de Goiás ou com um povoado de mesmo nome
// em outra cidade); se não bate, a busca desce para o passo seguinte. Resultado que não é bem o pedido (povoado com o nome da cidade, estação com o nome do bairro, rua em outro bairro) só vale como
// último recurso e vem com aviso no cartão.
// Só intercepta o chat quando há um endereço com CIDADE e UF (ou o formato completo do Bsoft): perguntas de "como fazer" sobre latitude/longitude do sistema continuam indo para a IA, e uma frase
// que parece pedido mas cuja "cidade" o mapa não conhece (ex.: "latitude errada para Londrina - PR") volta para a IA em vez de virar um cartão "não encontrei".
// Fluxo na tela (v28.14): reconhecido o endereço, ANTES de calcular o chat pergunta "Deseja informar mais um endereço para calcular a distância?", já com o campo do endereço 2 e o botão Executar
// (campo vazio, ou "Não, só este endereço" = calcula só o endereço 1). Com os dois: calcula o 1, depois o 2, e mostra as coordenadas de cada um e os links da rota (Google Maps e
// OpenStreetMap). NENHUMA distância em km é mostrada aqui (a em linha reta poderia ser usada como se fosse a real): quem quer o km abre a rota no mapa. O cartão é enxuto de propósito: endereço
// entendido em 1 linha pequena, latitude e longitude lado a lado, sem o passo a passo da busca (o "Encontrado por" já diz qual das buscas achou).
// Log: grava UMA linha por pedido, quando o cálculo roda (Executar): "Geolocalização - CIDADE/UF (nível)" ou "Geolocalização rota - CIDADE/UF (nível) → CIDADE/UF (nível)" — a rua e o número não vão para a tabela logs.
const Geo = (() => {
    const NOMINATIM = 'https://nominatim.openstreetmap.org/search';
    const cfg = { espacoMs: 1100, tempoMs: 12000 };   // espaçamento entre consultas (política do Nominatim: máx. 1 por segundo) e tempo limite de cada uma
    const UFS = {
        AC: 'Acre', AL: 'Alagoas', AP: 'Amapá', AM: 'Amazonas', BA: 'Bahia', CE: 'Ceará', DF: 'Distrito Federal', ES: 'Espírito Santo', GO: 'Goiás', MA: 'Maranhão', MT: 'Mato Grosso',
        MS: 'Mato Grosso do Sul', MG: 'Minas Gerais', PA: 'Pará', PB: 'Paraíba', PR: 'Paraná', PE: 'Pernambuco', PI: 'Piauí', RJ: 'Rio de Janeiro', RN: 'Rio Grande do Norte',
        RS: 'Rio Grande do Sul', RO: 'Rondônia', RR: 'Roraima', SC: 'Santa Catarina', SP: 'São Paulo', SE: 'Sergipe', TO: 'Tocantins'
    };
    const NIVEIS = {
        1: { curto: 'rua', precisao: 'ponto sobre a rua (não é o número exato)', zoom: 17 },
        2: { curto: 'bairro', precisao: 'centro do bairro (aproximado)', zoom: 14 },
        3: { curto: 'cidade', precisao: 'centro da cidade (aproximado)', zoom: 11 }
    };
    // (curtos de propósito: cada um tem que caber numa linha só no cartão)
    const AVISOS = {
        povoado: 'só achei um povoado/distrito com esse nome, não o município — confira no mapa.',
        bairro: 'só achei um local com o nome do bairro, não o bairro em si — confira no mapa.',
        rua_outro_bairro: 'rua achada na cidade, mas o bairro não bateu com o do mapa — confira se é a rua certa.'
    };

    // ── texto ────────────────────────────────────────────────────────────────
    const semAcento = s => Array.from(String(s == null ? '' : s)).map(c => c.normalize('NFD').replace(/\p{M}/gu, '')).join('');   // 1 caractere -> 1 caractere (os índices continuam valendo no texto original)
    const chave = s => semAcento(s).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    const chaveBairro = s => chave(s).replace(/\b0+(\d)/g, '$1');   // "Zona 01" = "Zona 1"
    const semEsp = s => s.replace(/ /g, '');
    const mesmo = (a, b) => a === b || (!!a && !!b && semEsp(a) === semEsp(b));   // "Santana do Livramento" = "Sant'Ana do Livramento"
    const inclui = (lista, x) => !!x && lista.some(y => mesmo(y, x));
    const escRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const NOMES_ESTADO = Object.entries(UFS).map(([uf, nome]) => [uf, chave(nome)]).sort((a, b) => b[1].length - a[1].length);
    const palavras = s => chave(s).split(' ').filter(Boolean);

    // palavras que pedem as coordenadas (inclui "lat-long" e a grafia comum "cordenadas")
    const RE_PALAVRA = /\b(?:latitude|longitude|co?ordenadas?|geolocaliza\w*|lat\s*[-\/.,]?\s*(?:e\s+)?(?:long?|lng)|gps)\b/gi;
    const temPalavra = t => new RegExp(RE_PALAVRA.source, 'i').test(semAcento(t));
    // pergunta de COMO FAZER algo no sistema (ex.: "como preencher a latitude do cliente"): vai para a IA, a não ser que traga o endereço completo no formato do Bsoft.
    // Só vale para o texto FORA do endereço (senão "Campo Grande" ou "Rua da Tela" seriam barradas).
    const COMO_FAZER = /\b(?:como|onde|porque|por que|preench\w*|cadastr\w*|configur\w*|campos?|tela|rotina|parametros?|funcionalidades?|sistema|rejeic\w*|erro|ajuda)\b/;
    // o endereço como o Bsoft mostra: "RUA, NÚMERO, BAIRRO — CIDADE - UF" (o travessão é o longo, —)
    const FORMATO_BSOFT = /^[^—\n]*,[^—\n]*\s—\s+[^—\n]+?\s-\s*[A-Za-z]{2}$/;
    // palavras que NÃO são nome de cidade (frase de suporte que só termina em "- PR")
    const NAO_CIDADE = new Set(['errada', 'errado', 'erro', 'erros', 'esta', 'estao', 'nao', 'nem', 'funciona', 'funcionam', 'obrigatoria', 'obrigatorio', 'vazia', 'vazio', 'invalida', 'invalido', 'zerada', 'zerado', 'cliente', 'clientes', 'veiculo', 'veiculos', 'posto', 'motorista', 'motoristas', 'empresa', 'placa', 'caminhao', 'parou', 'preciso', 'quero', 'com', 'sem', 'que', 'como', 'mas', 'quando', 'onde', 'qual', 'quais', 'preencher', 'consigo', 'emitir', 'ajuda', 'cadastro', 'remetente', 'destinatario', 'rejeicao', 'estado', 'ciot', 'cte', 'mdfe']);
    const NAO_RUA = new Set(['nao', 'consigo', 'emitir', 'erro', 'preciso', 'quero', 'ajuda', 'rejeicao', 'esta', 'estao', 'funciona', 'como', 'onde', 'qual']);
    const LIGACAO = new Set(['e', 'ou', 'de', 'do', 'da', 'dos', 'das', 'para', 'pra', 'pro', 'no', 'na', 'em', 'o', 'a', 'um', 'uma', 'endereco', 'local', 'localizacao', 'lugar', 'ponto', 'seguinte', 'abaixo', 'informado', 'cadastrado', 'desse', 'dessa', 'deste', 'desta', 'esse', 'essa', 'este', 'esta', 'cliente', 'empresa', 'destino', 'entrega', 'origem', 'remetente', 'destinatario', 'filial', 'matriz', 'unidade']);
    const RUIDO = new Set(['qual', 'quais', 'me', 'passa', 'passe', 'diga', 'dizer', 'informe', 'informar', 'forneca', 'fornecer', 'mostre', 'mostrar', 'ache', 'achar', 'busque', 'buscar', 'encontre', 'encontrar', 'preciso', 'quero', 'gostaria', 'pode', 'poderia', 'voce', 'vc', 'por', 'favor', 'pf', 'pfv', 'a', 'o', 'da', 'de', 'do', 'as', 'os', 'sao', 'e', 'seria', 'consegue', 'consulta', 'consultar', 'veja', 'ver']);

    function limparPontas(s) { return String(s || '').replace(/^[\s:,;.\-–—?!]+/, '').replace(/[\s:,;.\-–—?!]+$/, ''); }
    function tirarDoInicio(s, conjunto) { const p = String(s || '').trim().split(/\s+/); while (p.length && conjunto.has(chave(p[0]))) p.shift(); return p.join(' '); }
    function tirarDoFim(s, conjunto) { const p = String(s || '').trim().split(/\s+/); while (p.length && conjunto.has(chave(p[p.length - 1]))) p.pop(); return p.join(' '); }
    function tirarCortesias(s) { return String(s || '').replace(/(?:[\s,.;:-]+(?:por favor|pf|pfv|obrigad[oa]|valeu|vlw))+[\s.!?]*$/i, ''); }
    function normalizarTexto(s) {
        return String(s == null ? '' : s).replace(/\s+/g, ' ').trim()
            .replace(/[‐-–−―]/g, '-')   // hífen "parecido", en-dash, sinal de menos -> "-" (só o travessão longo — separa o endereço da cidade)
            .replace(/\s*-{2,}\s*/g, ' - ');
    }

    // Os pedaços de texto que podem ser o endereço: o que vem DEPOIS das palavras de coordenadas e, se nada servir, o que vem ANTES.
    function candidatos(t) {
        const base = semAcento(t).toLowerCase(), re = new RegExp(RE_PALAVRA.source, 'gi');
        let m, primeiro = -1, ultimoFim = -1;
        while ((m = re.exec(base))) { if (primeiro < 0) primeiro = m.index; ultimoFim = m.index + m[0].length; }
        if (primeiro < 0) return [];
        let depois = limparPontas(tirarDoInicio(limparPontas(t.slice(ultimoFim)), LIGACAO));
        const dp = depois.lastIndexOf(':');
        if (dp > -1 && depois.slice(0, dp).trim().split(/\s+/).length <= 6) depois = limparPontas(tirarDoInicio(depois.slice(dp + 1), LIGACAO));   // "…desse endereço: RUA…"
        depois = tirarCortesias(depois);
        let antes = limparPontas(tirarDoFim(tirarDoInicio(limparPontas(t.slice(0, primeiro)), RUIDO), RUIDO));
        antes = tirarCortesias(limparPontas(tirarDoFim(antes, RUIDO)));
        return [depois, antes].filter(Boolean);
    }

    // ── endereço ─────────────────────────────────────────────────────────────
    const COMPLEMENTO = /^(?:apto?|apartamento|ap|sala|bloco|bl|casa|loja|andar|cj|conj|conjunto|fundos|lote|lt|quadra|qd|km|torre|galpao|box)$/;
    // "10", "10 10", "10-A", "S/N", "nº 10", "10 apto 12", "Sala 3", "Apto 12", "Bloco B": número da casa ou complemento (não é bairro)
    function ehNumero(t) {
        const w = palavras(t);
        if (!w.length) return false;
        if (w.join('') === 'sn' || w.join(' ') === 'sem numero') return true;
        let i = 0;
        if (/^(?:n|no|num|numero)$/.test(w[0]) && w.length > 1) i = 1;
        else if (COMPLEMENTO.test(w[0]) && w.length > 1) { return w.slice(1).every(x => /^[a-z]?\d+[a-z]?$|^[a-z]{1,2}$/.test(x)); }
        if (!/^\d+[a-z]?$/.test(w[i])) return false;
        return w.slice(i + 1).every(x => /^\d+[a-z]?$/.test(x) || /^[a-z]$/.test(x) || COMPLEMENTO.test(x));
    }
    const ehLogradouro = t => /^(?:r|rua|av|avenida|al|alameda|tv|trav|travessa|rod|rodovia|est|estrada|estr|pc|pca|praca|lgo|largo|vl|viela|bc|beco|ac|acesso|via|marginal|anel|linha)\b/.test(chave(t)) || /^(?:br|pr|sp|mg|rs|sc|go|ms|mt|ba|pe|ce|rj|es|to|ma|pa)\s?\d{2,3}\b/.test(chave(t));
    const ABREV = Object.assign(Object.create(null), { r: 'Rua', av: 'Avenida', al: 'Alameda', tv: 'Travessa', trav: 'Travessa', rod: 'Rodovia', est: 'Estrada', estr: 'Estrada', pc: 'Praça', pca: 'Praça', lgo: 'Largo', vl: 'Viela', bc: 'Beco', ac: 'Acesso' });
    function expandirRua(rua) {
        const m = /^(\S+?)\.?(\s+|$)(.*)$/.exec(rua.trim());
        if (!m) return rua;
        const c = chave(m[1]);
        return ABREV[c] ? (ABREV[c] + (m[3] ? ' ' + m[3] : '')) : rua;
    }
    const RE_COD_RODOVIA = /\b(br|ac|al|ap|am|ba|ce|df|es|go|ma|mt|ms|mg|pa|pb|pr|pe|pi|rj|rn|rs|ro|rr|sc|sp|se|to) ?(\d{2,3})\b/;
    const codigoRodovia = rua => { const m = RE_COD_RODOVIA.exec(chave(rua)); return m ? m[1] + m[2] : ''; };   // "Rodovia BR-376" -> "br376"

    // "RUA, NÚMERO, BAIRRO — CIDADE - UF"  ou  "Rua X, 123 - Bairro, Cidade - UF"  ou  "Rua X 123 Cidade PR"  ou  "Cidade - UF"  ->  { rua, ruaExp, numero, bairro, cidade, uf, estado } (ou null)
    function parsear(txt) {
        let s = normalizarTexto(txt);
        if ((s.match(/—/g) || []).length > 1) return null;   // dois endereços no mesmo pedido: não dá para responder só um sem avisar
        s = s.replace(/^[^\p{L}\p{N}]+/u, '').replace(/[^\p{L}\p{N}]+$/u, '');   // aspas, parênteses, emoji e pontuação nas pontas
        const limparFim = x => x.replace(/[\s,\-\/;:.]+$/, '');
        s = limparFim(s.replace(/\bcep\b\.?:?\s*/gi, '').replace(/\b\d{5}-?\d{3}\b/g, ' ')).replace(/\s+/g, ' ');
        s = limparFim(limparFim(s).replace(/(?:[\s,\-]+(?:brasil|brazil)|\s*,\s*br)\s*$/i, ''));
        if (!s) return null;
        let uf = null, resto = s;
        const mUf = /(?:^|[\s,\-—\/])([A-Za-z]{2})$/.exec(s);
        if (mUf && UFS[mUf[1].toUpperCase()]) { uf = mUf[1].toUpperCase(); resto = s.slice(0, mUf.index); }
        else {
            const b = semAcento(s).toLowerCase();
            for (const [sigla, nome] of NOMES_ESTADO) {
                const m = new RegExp('(?:^|[\\s,\\-—/])' + escRe(nome).replace(/ /g, '\\s+') + '$').exec(b);
                if (m) { uf = sigla; resto = s.slice(0, m.index); break; }
            }
        }
        if (!uf) return null;
        resto = resto.replace(/[\s,\-—\/]+$/, '').trim();
        if (!resto) return null;
        let cidade, esq = '', rua = '', numero = '', bairro = '';
        const iDash = resto.lastIndexOf('—');
        if (iDash > -1) { cidade = resto.slice(iDash + 1); esq = resto.slice(0, iDash); }
        else {
            const partes = resto.split(/\s*,\s*|\s+-\s+/).map(x => x.trim()).filter(Boolean);
            cidade = partes.pop() || '';
            esq = partes.join(', ');
            if (!esq) {   // sem nenhum separador: "Rua das Flores 123 Londrina" (rua, número, cidade) ou só "Londrina"
                const w = cidade.split(/\s+/);
                if (w.length > 1 && ehLogradouro(w[0])) {
                    const i = w.findIndex((x, k) => k > 0 && /^\d+[a-z]?$/i.test(x));
                    if (i > 0 && i < w.length - 1) { rua = w.slice(0, i).join(' '); numero = w[i]; cidade = w.slice(i + 1).join(' '); }
                    else return null;   // rua e cidade grudadas e sem número para separar: não dá para saber onde uma acaba
                }
            }
        }
        cidade = limparPontas(cidade).replace(/^(?:em\s+)?(?:(?:na|no|a|o)\s+)?(?:cidade|municipio|município)\s+d[eoa]s?\s+/i, '').replace(/^em\s+/i, '');   // "na cidade de X", "em X" -> X ("Cidade Gaúcha" e "Cidade Ocidental" são nomes de cidade: ficam como estão)
        const wc = palavras(cidade);
        if (cidade.length < 2 || !/\p{L}/u.test(cidade) || /\d/.test(cidade) || wc.length > 5 || wc.some(x => NAO_CIDADE.has(x))) return null;
        const toks = esq.split(',').flatMap(x => x.split(/\s+-\s+/)).map(x => x.trim()).filter(Boolean);
        if (toks.length === 1) {
            if (ehLogradouro(toks[0])) rua = toks[0]; else if (ehNumero(toks[0])) numero = numero || toks[0]; else bairro = toks[0];
        } else if (toks.length > 1) {
            rua = toks[0];
            toks.slice(1).forEach(t => { if (ehNumero(t)) numero = numero || t; else bairro = t; });   // o BAIRRO é o último pedaço que não é número nem complemento
        }
        if (rua.includes(':')) rua = rua.slice(rua.lastIndexOf(':') + 1).trim();   // "desse endereço: Rua X"
        const mn = /^(.*\S)\s+(?:n[º°o]?\.?\s*)?(\d+[a-z]?)$/i.exec(rua);   // número colado no fim da rua ("Rua Sete de Setembro 100"): sai da rua (o número não entra na busca)
        if (mn && mn[1].split(/\s+/).length >= 2 && !/^(?:br|[a-z]{2}|km|n[º°o]?)$/i.test(mn[1].split(/\s+/).pop())) { numero = numero || mn[2]; rua = mn[1]; }
        return { rua, ruaExp: rua ? expandirRua(rua) : '', numero, bairro, cidade, uf, estado: UFS[uf] };
    }

    // Texto do chat -> endereço entendido (ou null: a pergunta segue o caminho normal, com a IA).
    // incerto = só cidade (sem rua nem bairro) achada num texto livre: o chat só aceita se o mapa realmente conhecer essa cidade.
    function interpretar(texto) {
        const t = normalizarTexto(texto);
        if (!t || t.length > 300) return null;
        if (temPalavra(t)) {
            for (const c of candidatos(t)) {
                const p = parsear(c);
                if (!p) continue;
                const i = t.indexOf(c), fora = chave(i >= 0 ? t.slice(0, i) + ' ' + t.slice(i + c.length) : t);
                if (COMO_FAZER.test(fora) && !FORMATO_BSOFT.test(c)) continue;   // pergunta de "como fazer", não pedido de coordenadas
                return { ...p, original: c, incerto: !p.rua && !p.bairro && !FORMATO_BSOFT.test(c) };
            }
            return null;
        }
        const nu = t.replace(/^[^\p{L}\p{N}]+/u, '').replace(/[^\p{L}\p{N}]+$/u, '');   // aspas, parênteses ou emoji em volta do endereço
        if (nu.length <= 160 && FORMATO_BSOFT.test(nu)) {
            const primeiro = nu.split(',')[0];
            if (primeiro.includes(':') || palavras(primeiro).length > 6 || palavras(primeiro).some(x => NAO_RUA.has(x))) return null;   // "Erro no cadastro: Rua A, …" não é só o endereço
            const p = parsear(t);
            if (p && p.rua) return { ...p, original: t, incerto: false };
        }
        return null;
    }

    // ── consulta ao Nominatim ────────────────────────────────────────────────
    const dormir = ms => new Promise(r => setTimeout(r, ms));
    let vez = Promise.resolve(), ultimaConsulta = 0;
    function esperarVez() {   // uma consulta por vez, com intervalo mínimo entre elas
        const p = vez.then(async () => { const falta = ultimaConsulta + cfg.espacoMs - Date.now(); if (falta > 0) await dormir(falta); ultimaConsulta = Date.now(); });
        vez = p.catch(() => {});
        return p;
    }
    const cache = new Map();   // consulta -> Promise do resultado. Só em memória: some ao fechar a aba (endereços não ficam guardados no navegador)
    const erro = (tipo, status) => { const e = new Error(tipo); e.tipo = tipo; e.status = status; return e; };
    function consultar(q) {
        const url = NOMINATIM + '?format=jsonv2&addressdetails=1&extratags=1&limit=15&countrycodes=br&accept-language=pt-BR&q=' + encodeURIComponent(q);
        if (cache.has(url)) return cache.get(url);
        const prom = (async () => {
            await esperarVez();
            const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
            const to = ctl ? setTimeout(() => ctl.abort(), cfg.tempoMs) : null;   // vale também para a leitura do corpo da resposta
            try {
                let resp;
                try { resp = await fetch(url, ctl ? { signal: ctl.signal } : undefined); }
                catch (e) { throw erro(e && e.name === 'AbortError' ? 'tempo' : 'rede'); }
                if (resp.status === 429) throw erro('limite', 429);
                if (resp.status === 403) throw erro('bloqueio', 403);
                if (!resp.ok) throw erro('http', resp.status);
                let j;
                try { j = await resp.json(); } catch (e) { throw erro(e && e.name === 'AbortError' ? 'tempo' : 'http', resp.status); }
                if (!Array.isArray(j)) throw erro('http', resp.status);
                return j;
            } finally { if (to) clearTimeout(to); }
        })();
        if (cache.size >= 60) cache.delete(cache.keys().next().value);
        cache.set(url, prom);
        prom.catch(() => { if (cache.get(url) === prom) cache.delete(url); });   // falha não fica guardada: a próxima tentativa consulta de novo
        return prom;
    }

    // As tentativas, na ordem pedida (cada uma só roda se a anterior não achou)
    function tentativas(p) {
        const L = [], fim = [p.cidade, p.estado, 'Brasil'];
        if (p.rua) {
            const rotulo = p.bairro ? 'Rua + Bairro + Cidade + Estado' : 'Rua + Cidade + Estado';
            L.push({ nivel: 1, rotulo, rua: p.ruaExp, q: [p.ruaExp, p.bairro].filter(Boolean).concat(fim).join(', ') });
            if (chave(p.ruaExp) !== chave(p.rua)) L.push({ nivel: 1, rotulo, variante: 'como foi digitada', rua: p.rua, q: [p.rua, p.bairro].filter(Boolean).concat(fim).join(', ') });
        }
        if (p.bairro) L.push({ nivel: 2, rotulo: 'Bairro + Cidade + Estado', q: [p.bairro].concat(fim).join(', ') });
        if (p.rua && p.bairro) L.push({ nivel: 1, rotulo: 'Rua + Cidade + Estado', semBairro: true, rua: p.ruaExp, q: [p.ruaExp].concat(fim).join(', ') });
        L.push({ nivel: 3, rotulo: 'Cidade + Estado', q: fim.join(', ') });
        return L;
    }

    const PALAVRAS_RUA = new Set(['rua', 'r', 'avenida', 'av', 'alameda', 'al', 'travessa', 'tv', 'trav', 'rodovia', 'rod', 'estrada', 'est', 'estr', 'praca', 'pc', 'pca', 'largo', 'lgo', 'viela', 'vl', 'beco', 'bc', 'acesso', 'ac', 'via', 'marginal', 'de', 'da', 'do', 'das', 'dos', 'e']);
    const municipio = a => { const m = a.city || a.municipality || a.town || a.village || ''; return m ? [chave(m)] : []; };   // o município do resultado (um distrito vem com city = o município dele)
    const bairrosDe = a => [a.suburb, a.neighbourhood, a.quarter, a.city_district, a.district].map(chaveBairro).filter(Boolean);
    const categoria = r => r.category || r.class || '';
    // O resultado serve? (estado e município conferem; no passo 1 a rua; no 2 o bairro). Devolve null, ou { r, forte, aviso }.
    function avaliar(r, t, p) {
        const a = r.address || {};
        const iso = a['ISO3166-2-lvl4'];
        if (iso ? iso !== 'BR-' + p.uf : chave(a.state) !== chave(p.estado)) return null;
        const kc = chave(p.cidade), kcB = chaveBairro(p.cidade), comps = String(r.display_name || '').split(',').map(chaveBairro);
        const muni = municipio(a);
        const cidadeOk = muni.length ? inclui(muni, kc) : inclui(comps, kcB);
        const kb = p.bairro ? chaveBairro(p.bairro) : '';
        if (t.nivel === 3) {
            if (cidadeOk) return { r, forte: true };
            return mesmo(comps[0], kcB) ? { r, forte: false, aviso: 'povoado' } : null;   // distrito/povoado com o nome informado (só vale se não houver o município em si)
        }
        if (!cidadeOk) return null;
        if (t.nivel === 2) {
            if (!(inclui(comps, kb) || inclui(bairrosDe(a), kb))) return null;
            const lugar = categoria(r) === 'place' || categoria(r) === 'boundary';   // o bairro de verdade, e não uma estação/prédio que leva o nome dele
            return lugar ? { r, forte: true } : { r, forte: false, aviso: 'bairro' };
        }
        const cod = codigoRodovia(t.rua);
        if (cod) {   // rodovia pedida pelo código (BR-376): o OSM guarda o código em extratags.ref e o nome da rodovia no road
            const refs = String((r.extratags || {}).ref || '').split(';').map(x => x.replace(/[^a-z0-9]/gi, '').toLowerCase()).filter(Boolean);
            if (refs.length ? !refs.includes(cod) : categoria(r) !== 'highway') return null;
        } else {
            const road = chave(a.road || a.pedestrian || a.footway || a.path || a.cycleway || '');
            if (!road) return null;
            const pal = chave(t.rua).split(' ').filter(w => w.length >= 2 && !PALAVRAS_RUA.has(w));
            if (pal.length && pal.filter(w => road.includes(w)).length < Math.max(1, Math.ceil(pal.length / 2))) return null;
        }
        if (t.semBairro) return { r, forte: false, aviso: 'rua_outro_bairro' };
        const bs = bairrosDe(a), noBairro = inclui(bs, kb) || inclui(comps, kb);
        if (kb && bs.length && !noBairro) return null;   // a rua existe na cidade, mas em OUTRO bairro: não serve para este endereço
        return { r, forte: !kb || noBairro };
    }
    function escolher(lista, t, p) {
        const ok = (lista || []).map(r => avaliar(r, t, p)).filter(Boolean);
        return ok.find(x => x.forte) || ok[0] || null;   // { r, forte, aviso } — forte:false = vale só como último recurso
    }
    const numeroValido = v => (typeof v === 'number' || (typeof v === 'string' && v.trim() !== '')) && isFinite(Number(v));
    const NO_BRASIL = (lat, lon) => lat >= -34.5 && lat <= 6 && lon >= -74.5 && lon <= -28;

    // Procura em ordem; devolve { ok, nivel, lat, lon, nome, rotulo, aviso, tentativas:[{rotulo,variante,estado:'achou'|'nao'|'erro'}], erro }
    async function buscar(p, aoTentar) {
        const log = [];
        for (const t of tentativas(p)) {
            if (aoTentar) { try { aoTentar(t); } catch (e) { /* só aviso de tela */ } }
            let lista;
            try { lista = await consultar(t.q); }
            catch (e) { log.push({ rotulo: t.rotulo, variante: t.variante, estado: 'erro' }); return { ok: false, erro: e.tipo || 'rede', tentativas: log }; }
            const esc1 = escolher(lista, t, p), r = esc1 ? esc1.r : null;
            const lat = r && numeroValido(r.lat) ? Number(r.lat) : NaN, lon = r && numeroValido(r.lon) ? Number(r.lon) : NaN;
            if (r && NO_BRASIL(lat, lon)) {
                log.push({ rotulo: t.rotulo, variante: t.variante, estado: 'achou' });
                return { ok: true, nivel: t.nivel, rotulo: t.rotulo, variante: t.variante, lat, lon, nome: r.display_name || '', aviso: esc1.aviso || '', tentativas: log };
            }
            log.push({ rotulo: t.rotulo, variante: t.variante, estado: 'nao' });
        }
        return { ok: false, erro: null, tentativas: log };
    }

    // ── resposta na tela ─────────────────────────────────────────────────────
    const fmt = n => Number(n).toFixed(6);
    async function copiar(texto) {
        try { if (navigator.clipboard && navigator.clipboard.writeText) { await navigator.clipboard.writeText(texto); return true; } } catch (e) { /* tenta o jeito antigo */ }
        try {
            const ta = document.createElement('textarea'); ta.value = texto; ta.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0';
            document.body.appendChild(ta); ta.select(); const ok = document.execCommand('copy'); ta.remove(); return !!ok;
        } catch (e) { return false; }
    }
    const MSG_ERRO = {
        rede: 'Não consegui falar com o serviço de mapas (OpenStreetMap). Confira a conexão com a internet e tente de novo.',
        tempo: 'O serviço de mapas (OpenStreetMap) demorou demais para responder. Tente de novo daqui a pouco.',
        limite: 'O serviço de mapas (OpenStreetMap) limitou as consultas por agora. Espere um minuto e tente de novo.',
        bloqueio: 'O serviço de mapas (OpenStreetMap) recusou a consulta feita por este endereço do sistema. Se você abriu o sistema por arquivo (duplo clique), tente pelo endereço publicado (GitHub Pages) ou fale com quem mantém o sistema.',
        http: 'O serviço de mapas (OpenStreetMap) respondeu com erro. Tente de novo daqui a pouco.',
        naoconsultado: 'Este endereço não chegou a ser consultado porque o endereço 1 não pôde ser calculado. Tente de novo.'
    };
    const CAB = 'background:#eff6ff;padding:8px 15px;border-bottom:1px solid #bfdbfe;font-size:11px;color:#1e40af;font-weight:600;';
    const ATRIBUICAO = `<div class="answer-section" style="font-size:11px;color:var(--text-muted,#6b7280);">Dados © colaboradores do <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> (licença ODbL), consultados no serviço Nominatim: só os endereços digitados são enviados a esse serviço. As coordenadas são aproximadas — confira no mapa antes de usar.</div>`;
    function btn(txt, valor) { return `<button type="button" data-geo-copiar="${esc(valor)}" style="padding:5px 11px;border:1.5px solid #bfdbfe;border-radius:8px;background:#fff;color:#1e40af;font-size:12px;font-weight:600;cursor:pointer;">${esc(txt)}</button>`; }
    // O endereço entendido, por extenso e numa linha só (fonte pequena): "Endereço entendido: Rua: … · Número: … · Bairro: … · Cidade: … · Estado: Paraná (PR)". rotulo = "Endereço 1"/"Endereço 2" quando há dois.
    const linhaEndereco = (p, rotulo) => `<div class="answer-section" style="padding-top:7px;padding-bottom:7px;"><div class="section-content" style="font-size:11.5px;line-height:1.45;"><b>📌 ${esc(rotulo || 'Endereço entendido')}:</b> `
        + [['Rua', p.rua], ['Número', p.numero], ['Bairro', p.bairro], ['Cidade', p.cidade], ['Estado', p.estado + ' (' + p.uf + ')']].filter(x => x[1]).map(x => `<b>${x[0]}:</b> ${esc(x[1])}`).join(' · ') + `</div></div>`;
    // As seções de UM endereço (entendido + coordenadas/erro). rotulo = "Endereço 1"/"Endereço 2" quando há dois.
    function secoesEndereco(p, r, rotulo) {
        const pre = rotulo ? rotulo + ' — ' : '';
        let h = linhaEndereco(p, rotulo);
        if (r.ok) {
            const nv = NIVEIS[r.nivel], par = fmt(r.lat) + ', ' + fmt(r.lon);
            h += `<div class="answer-section"><div class="section-label how">🧭 ${esc(pre)}coordenadas</div><div class="section-content">`
                + `<div style="font-family:ui-monospace,Consolas,monospace;font-size:15px;line-height:1.7;"><b>Latitude:</b> ${fmt(r.lat)} &nbsp;&nbsp; <b>Longitude:</b> ${fmt(r.lon)}</div>`
                + `<div style="display:flex;flex-wrap:wrap;align-items:center;gap:6px 10px;margin:8px 0;">${btn('📋 Copiar latitude', fmt(r.lat))}${btn('📋 Copiar longitude', fmt(r.lon))}${btn('📋 Copiar “latitude, longitude”', par)}`
                + `<span style="font-size:12.5px;"><a href="https://www.openstreetmap.org/?mlat=${fmt(r.lat)}&amp;mlon=${fmt(r.lon)}#map=${nv.zoom}/${fmt(r.lat)}/${fmt(r.lon)}" target="_blank" rel="noopener noreferrer">🗺️ Ver no OpenStreetMap</a> · <a href="https://www.google.com/maps?q=${fmt(r.lat)},${fmt(r.lon)}" target="_blank" rel="noopener noreferrer">📍 Abrir no Google Maps</a></span></div>`
                + `<div style="font-size:12px;">Encontrado por: <b>${esc(r.rotulo)}</b>${r.variante ? ' (' + esc(r.variante) + ')' : ''} · Precisão: ${esc(nv.precisao)}.</div>`
                + (r.nome ? `<div style="font-size:12px;color:var(--text-muted,#6b7280);margin-top:4px;">Local encontrado: ${esc(r.nome)}</div>` : '')
                + (r.aviso && AVISOS[r.aviso] ? `<div style="margin-top:4px;color:#b45309;font-size:10.5px;line-height:1.35;"><b>⚠️ Atenção:</b> ${esc(AVISOS[r.aviso])}</div>` : '')
                + `</div></div>`;
        } else if (r.erro) {
            h += `<div class="answer-section"><div class="section-label tip">⚠️ ${esc(pre)}não foi possível consultar</div><div class="section-content">${esc(MSG_ERRO[r.erro] || MSG_ERRO.http)}</div></div>`;
        } else {
            h += `<div class="answer-section"><div class="section-label tip">❌ ${esc(pre)}não encontrei</div><div class="section-content">Nenhuma das buscas achou esse endereço no OpenStreetMap. Confira a grafia da cidade e o estado (UF) — ou escreva só <b>Cidade - UF</b> — e tente de novo.</div></div>`;
        }
        return h;
    }
    // Só os links da rota: os quilômetros NÃO são mostrados aqui (uma distância em linha reta poderia ser usada como se fosse a real) — quem quer ver o km abre a rota no mapa.
    function secaoRota(r1, r2) {
        const a = fmt(r1.lat) + ',' + fmt(r1.lon), b = fmt(r2.lat) + ',' + fmt(r2.lon);
        return `<div class="answer-section"><div class="section-label how">🧭 Rota entre os dois endereços</div><div class="section-content">`
            + `<div style="display:flex;flex-wrap:wrap;gap:6px;">`
            + `<a href="https://www.google.com/maps/dir/?api=1&amp;origin=${a}&amp;destination=${b}&amp;travelmode=driving" target="_blank" rel="noopener noreferrer" style="padding:7px 13px;border-radius:8px;background:#2563eb;color:#fff;font-size:13px;font-weight:700;text-decoration:none;">🧭 Ver rota no Maps (Total KM Percurso)</a>`
            + `<a href="https://www.openstreetmap.org/directions?engine=fossgis_osrm_car&amp;route=${fmt(r1.lat)}%2C${fmt(r1.lon)}%3B${fmt(r2.lat)}%2C${fmt(r2.lon)}" target="_blank" rel="noopener noreferrer" style="padding:7px 13px;border-radius:8px;border:1.5px solid #bfdbfe;background:#fff;color:#1e40af;font-size:13px;font-weight:700;text-decoration:none;">🗺️ Rota no OpenStreetMap</a>`
            + `</div></div></div>`;
    }
    function ligarCopiar(c) {
        c.addEventListener('click', ev => {
            const b = ev.target.closest('[data-geo-copiar]'); if (!b) return;
            if (!b.dataset.rotulo) b.dataset.rotulo = b.textContent;   // o texto original fica guardado: cliques seguidos não deixam o botão preso em "Copiado"
            copiar(b.dataset.geoCopiar).then(ok => { b.textContent = ok ? '✓ Copiado' : '⚠ Não consegui copiar'; clearTimeout(b._geoT); b._geoT = setTimeout(() => { b.textContent = b.dataset.rotulo; }, 1600); });
        });
    }
    function montarCard(p, r) {   // resultado de UM endereço
        const c = document.createElement('div');
        c.className = 'answer-card geo-card';
        c.innerHTML = `<div style="${CAB}">📍 Latitude e longitude • OpenStreetMap (Nominatim)</div>` + secoesEndereco(p, r, '') + ATRIBUICAO;
        ligarCopiar(c);
        return c;
    }
    function montarCardRota(p1, r1, p2, r2) {   // dois endereços: coordenadas de cada um e os links da rota (sem quilômetros)
        const c = document.createElement('div');
        c.className = 'answer-card geo-card';
        c.innerHTML = `<div style="${CAB}">📍 Latitude, longitude e rota entre dois endereços • OpenStreetMap (Nominatim)</div>`
            + secoesEndereco(p1, r1, 'Endereço 1') + secoesEndereco(p2, r2, 'Endereço 2') + (r1.ok && r2.ok ? secaoRota(r1, r2) : '') + ATRIBUICAO;
        ligarCopiar(c);
        return c;
    }
    // A pergunta que vem ANTES de calcular: "Deseja informar mais um endereço para calcular a distância?" (campo do endereço 2 + Executar)
    function montarPergunta(p) {
        const c = document.createElement('div');
        c.className = 'answer-card geo-card geo-pergunta';
        const estiloBtn = 'padding:8px 16px;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;';
        c.innerHTML = `<div style="${CAB}">📍 Latitude e longitude • endereço 1</div>`
            + linhaEndereco(p, 'Endereço 1')
            + `<div class="answer-section"><div class="section-label tip">❓ Pergunta</div><div class="section-content">`
            + `<b>Deseja informar mais um endereço para calcular a distância?</b>`
            + `<div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:8px;align-items:center;">`
            + `<input type="text" data-geo-end2 aria-label="Endereço 2" placeholder="Endereço 2 — RUA, NÚMERO, BAIRRO — CIDADE - UF" maxlength="300" style="flex:1 1 280px;min-width:200px;padding:9px 11px;border:1.5px solid #bfdbfe;border-radius:8px;font-size:13px;background:#fff;color:inherit;">`
            + `<button type="button" data-geo-acao="executar" style="${estiloBtn}background:#2563eb;color:#fff;">▶ Executar</button>`
            + `<button type="button" data-geo-acao="so1" style="${estiloBtn}background:#fff;color:#1e40af;border:1.5px solid #bfdbfe;">Não, só este endereço</button>`
            + `</div>`
            + `<div style="font-size:12px;color:var(--text-muted,#6b7280);margin-top:6px;">Com o endereço 2, o sistema calcula a latitude e a longitude dos dois e mostra os links da rota (para ver o trajeto e os km no mapa). Deixe o campo vazio e clique em <b>Executar</b> para calcular só o endereço 1.</div>`
            + `<div data-geo-aviso style="font-size:12.5px;margin-top:6px;color:#b91c1c;"></div>`
            + `</div></div>`;
        return c;
    }

    // ── o fluxo no chat ──────────────────────────────────────────────────────
    const cidadeLog = p => (p.cidade.length <= 40 && !/[\d,]/.test(p.cidade)) ? p.cidade : '';   // defesa: nunca grava rua/número/bairro no log, mesmo que a leitura do endereço falhe
    const nivelLog = r => r.ok ? NIVEIS[r.nivel].curto : r.erro ? 'erro' : 'não achou';
    // Mostra o resultado (um ou dois endereços), grava no histórico da conversa e no log. r2 = null quando só há o endereço 1.
    function entregar(p1, r1, p2, r2, conversa0) {
        const dois = !!p2;
        const mesmaConversa = !conversa0 || typeof getConversaAtiva !== 'function' || getConversaAtiva() === conversa0;
        const pt = (p, r) => r.ok ? `${fmt(r.lat)}, ${fmt(r.lon)} (${esc(p.cidade)}/${esc(p.uf)}, ${esc(NIVEIS[r.nivel].curto)})` : (r.erro ? 'não consegui consultar' : 'não encontrei');
        let resumo;
        if (!dois) {
            resumo = r1.ok
                ? `📍 <b>Latitude:</b> ${fmt(r1.lat)} · <b>Longitude:</b> ${fmt(r1.lon)} · encontrado por ${esc(r1.rotulo)} (${esc(NIVEIS[r1.nivel].curto)}) — ${esc(p1.cidade)}/${esc(p1.uf)}.`
                : (r1.erro ? '📍 ' + esc(MSG_ERRO[r1.erro] || MSG_ERRO.http) : '📍 Não encontrei coordenadas para esse endereço.');
        } else {
            resumo = `📍 <b>Endereço 1:</b> ${pt(p1, r1)} · <b>Endereço 2:</b> ${r2 ? pt(p2, r2) : 'não consultado'}.`;
        }
        if (mesmaConversa) {
            const s = document.getElementById('chatStream');
            if (s) {
                const card = dois ? montarCardRota(p1, r1, p2, r2 || { ok: false, erro: 'naoconsultado', tentativas: [] }) : montarCard(p1, r1); s.appendChild(card);
                try { card.scrollIntoView({ block: 'start' }); } catch (e) { scrollToBottom(true); }   // o cartão é alto: mostra o começo dele, não o fim
            }
            adicionarMensagemNaConversa('ai', resumo);
        } else if (conversa0 && Array.isArray(conversa0.mensagens)) {   // a pessoa trocou de conversa durante a busca: o resultado fica na conversa em que foi pedido
            conversa0.mensagens.push({ sender: 'ai', text: resumo, timestamp: Date.now() });
            try { salvarConversas(); } catch (e) { /* sem salvar não perde nada da tela */ }
        }
        const rotuloLog = !dois
            ? 'Geolocalização - ' + cidadeLog(p1) + '/' + p1.uf + ' (' + nivelLog(r1) + ')'
            : 'Geolocalização rota - ' + cidadeLog(p1) + '/' + p1.uf + ' (' + nivelLog(r1) + ') → ' + cidadeLog(p2) + '/' + p2.uf + ' (' + (r2 ? nivelLog(r2) : 'não consultado') + ')';
        try { logSearch(rotuloLog, !!(r1.ok && (!dois || (r2 && r2.ok))), { fonte: 'ferramenta' }); } catch (e) { console.warn('[geolocalização] log', e); }
        try {
            const plano = resumo.replace(/<[^>]*>/g, '');
            if (typeof isCallActive !== 'undefined' && isCallActive && typeof speak === 'function') speak(plano);
            if (document.hidden && typeof _enviarNotificacaoNavegador === 'function') _enviarNotificacaoNavegador('📍 Suporte Bsoft TMS respondeu', plano, 'bsoft-ia-resposta');
        } catch (e) { /* voz e notificação são extras */ }
    }
    // O clique em "Executar": lê o endereço 2 (se houver), calcula 1 e 2 na ordem e mostra o resultado.
    async function executar(card, p1, conversa0, txt2) {
        const aviso = card.querySelector('[data-geo-aviso]'), campo = card.querySelector('[data-geo-end2]');
        const dizer = (t, cor) => { if (aviso) { aviso.textContent = t; aviso.style.color = cor || '#b91c1c'; } };
        let p2 = null;
        if (String(txt2 || '').trim()) {
            p2 = interpretar(txt2) || parsear(txt2);
            if (!p2) { dizer('Não consegui entender o endereço 2. Escreva como RUA, NÚMERO, BAIRRO — CIDADE - UF (ou só Cidade - UF, com o estado).'); return; }
        }
        card.dataset.geoFeito = '1';
        if (campo) campo.disabled = true;
        Array.from(card.querySelectorAll('button')).forEach(b => { b.disabled = true; });
        try {
            dizer('📍 Calculando o endereço 1…', '#1e40af');
            const r1 = await buscar(p1, t => dizer('📍 Endereço 1: ' + t.rotulo + (t.variante ? ' (' + t.variante + ')' : '') + '…', '#1e40af'));
            let r2 = null;
            if (p2 && !r1.erro) r2 = await buscar(p2, t => dizer('📍 Endereço 2: ' + t.rotulo + (t.variante ? ' (' + t.variante + ')' : '') + '…', '#1e40af'));
            dizer(p2 ? '✅ Os dois endereços foram calculados — resultado abaixo.' : '✅ Calculado — resultado abaixo.', '#166534');
            entregar(p1, r1, p2, r2, conversa0);
        } catch (e) {
            console.warn('[geolocalização]', e);
            dizer('Não consegui concluir o cálculo. Tente de novo.');
            card.dataset.geoFeito = ''; if (campo) campo.disabled = false;
            Array.from(card.querySelectorAll('button')).forEach(b => { b.disabled = false; });
        }
    }
    // Chamado pelo handleChat com o que Geo.interpretar devolveu: mostra a pergunta do usuário e, ANTES de calcular, pergunta se há um segundo endereço (para a distância).
    // Devolve false (sem ter mostrado nada) quando o pedido era incerto e o mapa não conhece a cidade: o handleChat segue o caminho normal, com a IA.
    async function responder(query, p) {
        let bolha = false;
        const mostrarBolha = () => {
            if (bolha) return; bolha = true;
            const input = document.getElementById('searchInput'); if (input) input.value = '';
            const w = document.getElementById('welcomeMsg'); if (w) w.remove();
            appendMessage('user', esc(query)); adicionarMensagemNaConversa('user', query);
        };
        let ld = null;
        try {
            const conversa0 = typeof getConversaAtiva === 'function' ? getConversaAtiva() : null;
            if (p.incerto) {   // só uma cidade num texto livre: confere em silêncio se o mapa a conhece antes de tratar como pedido (a consulta fica no cache e não se repete)
                ld = appendLoadingCard('📍 Conferindo o endereço…');
                let r;
                try { r = await buscar(p); } catch (e) { console.warn('[geolocalização]', e); r = { ok: false, erro: 'http', tentativas: [] }; }
                ld.remove(); ld = null;
                if (!r.ok && !r.erro) return false;
                if (r.erro) { mostrarBolha(); entregar(p, r, null, null, conversa0); return r; }   // sem conexão etc.: mostra o erro direto
            }
            mostrarBolha();
            const s = document.getElementById('chatStream');
            if (s) {
                const card = montarPergunta(p); s.appendChild(card);
                const acionar = txt => { if (card.dataset.geoFeito) return; card._geoPromessa = executar(card, p, conversa0, txt); };
                card.addEventListener('click', ev => {
                    const b = ev.target.closest && ev.target.closest('[data-geo-acao]'); if (!b) return;
                    const campo = card.querySelector('[data-geo-end2]');
                    acionar(b.dataset.geoAcao === 'so1' ? '' : (campo ? campo.value : ''));
                });
                card.addEventListener('keydown', ev => {
                    if (ev.key !== 'Enter' || !ev.target || !ev.target.hasAttribute || !ev.target.hasAttribute('data-geo-end2')) return;
                    ev.preventDefault(); acionar(ev.target.value);
                });
                try { card.scrollIntoView({ block: 'start' }); } catch (e) { scrollToBottom(true); }
                try { const campo = card.querySelector('[data-geo-end2]'); if (campo && campo.focus) campo.focus({ preventScroll: true }); } catch (e) { /* foco é só conforto */ }
            }
            return { pendente: true };
        } catch (e) {
            console.warn('[geolocalização]', e);
            if (ld) { try { ld.remove(); } catch (e2) { /* já saiu */ } }
            return bolha ? undefined : false;
        }
    }
    // ── o atalho "Pesquisa Latitude/Longitude" da tela inicial ───────────────
    // Abre no chat um cartão com o campo do endereço (e o botão Pesquisar). Daí em diante é o mesmo fluxo de quando o pedido é digitado: pergunta se há um 2º endereço, calcula, mostra.
    let buscaAberta = null;
    function abrirPesquisa() {
        const s = document.getElementById('chatStream'); if (!s) return null;
        const w = document.getElementById('welcomeMsg'); if (w) w.remove();
        if (buscaAberta && buscaAberta.isConnected === true && !buscaAberta.dataset.geoFeito) {   // já tem uma esperando o endereço: só leva até ela
            try { buscaAberta.scrollIntoView({ block: 'start' }); const f = buscaAberta.querySelector('[data-geo-end1]'); if (f && f.focus) f.focus({ preventScroll: true }); } catch (e) { /* conforto */ }
            return buscaAberta;
        }
        const c = document.createElement('div');
        c.className = 'answer-card geo-card geo-busca';
        const estiloBtn = 'padding:8px 16px;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;background:#2563eb;color:#fff;';
        c.innerHTML = `<div style="${CAB}">📍 Pesquisa Latitude/Longitude • OpenStreetMap (Nominatim)</div>`
            + `<div class="answer-section"><div class="section-label tip">📍 Qual endereço?</div><div class="section-content">`
            + `<div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;">`
            + `<input type="text" data-geo-end1 aria-label="Endereço" placeholder="RUA, NÚMERO, BAIRRO — CIDADE - UF" maxlength="300" style="flex:1 1 320px;min-width:200px;padding:9px 11px;border:1.5px solid #bfdbfe;border-radius:8px;font-size:13px;background:#fff;color:inherit;">`
            + `<button type="button" data-geo-acao="pesquisar" style="${estiloBtn}">🔎 Pesquisar</button></div>`
            + `<div style="font-size:12px;color:var(--text-muted,#6b7280);margin-top:6px;">Ex.: <i>AC ALTO PARAISO, 10 10, CENTRO — ALTO PARAÍSO - PR</i> (ou só <i>Cidade - UF</i>). Depois você poderá informar um segundo endereço para ver a rota.</div>`
            + `<div data-geo-aviso style="font-size:12.5px;margin-top:6px;color:#b91c1c;"></div>`
            + `</div></div>`;
        const aviso = t => { const a = c.querySelector('[data-geo-aviso]'); if (a) a.textContent = t; };
        const pesquisar = async txt => {
            const t = String(txt || '').trim();
            if (!t || c.dataset.geoFeito) { if (!t) aviso('Digite o endereço (RUA, NÚMERO, BAIRRO — CIDADE - UF) para pesquisar.'); return; }
            const p = interpretar(t) || interpretar('latitude e longitude de ' + t);
            if (!p) { aviso('Não consegui entender o endereço. Escreva como RUA, NÚMERO, BAIRRO — CIDADE - UF (ou só Cidade - UF, com o estado).'); return; }
            p.incerto = false;   // foi a própria pessoa que pediu: não precisa conferir antes se é uma frase solta
            c.dataset.geoFeito = '1';
            const campo = c.querySelector('[data-geo-end1]'); if (campo) campo.disabled = true;
            Array.from(c.querySelectorAll('button')).forEach(b => { b.disabled = true; });
            aviso('');
            const query = /latitude|longitude|coordenad/i.test(semAcento(t)) ? t : 'latitude e longitude de ' + t;
            try { await responder(query, p); }
            catch (e) { console.warn('[geolocalização]', e); c.dataset.geoFeito = ''; if (campo) campo.disabled = false; Array.from(c.querySelectorAll('button')).forEach(b => { b.disabled = false; }); aviso('Não consegui concluir. Tente de novo.'); }
        };
        c.addEventListener('click', ev => { const b = ev.target.closest && ev.target.closest('[data-geo-acao]'); if (!b) return; const f = c.querySelector('[data-geo-end1]'); c._geoPromessa = pesquisar(f ? f.value : ''); });
        c.addEventListener('keydown', ev => {
            if (ev.key !== 'Enter' || !ev.target || !ev.target.hasAttribute || !ev.target.hasAttribute('data-geo-end1')) return;
            ev.preventDefault(); c._geoPromessa = pesquisar(ev.target.value);
        });
        s.appendChild(c); buscaAberta = c;
        try { c.scrollIntoView({ block: 'start' }); } catch (e) { scrollToBottom(true); }
        try { const f = c.querySelector('[data-geo-end1]'); if (f && f.focus) f.focus({ preventScroll: true }); } catch (e) { /* foco é só conforto */ }
        return c;
    }
    return { interpretar, parsear, tentativas, avaliar, escolher, buscar, responder, abrirPesquisa, config: cfg, limparCache: () => cache.clear() };
})();
