/* admin/js/analise-core.js — Núcleo da "Análise de Logs": normaliza as linhas de log (do Supabase ou de uma planilha) e calcula o que as
   telas mostram. Sem DOM e sem rede: por isso o MESMO código roda na aba "Análise" do painel Administração e (copiado entre os marcadores
   NÚCLEO) no arquivo "Análise de Logs.html". Se mudar aqui, copie para lá.

   Horário: tudo é mostrado em horário de Brasília (UTC−3, sem horário de verão desde 2019). A data vem de created_at (relógio do servidor,
   confiável); se faltar, da coluna timestamp (relógio do computador do usuário, já em horário de Brasília — por isso o "Z" dela é ignorado).
   created_at é UTC, mas o Supabase o devolve SEM fuso ("2026-10-08T11:18:06.865777" = 08:18 em Brasília): ver lerCriadoEm. Nas outras colunas de
   data (planilhas: data, data_hora…) o texto SEM fuso vale como está escrito; texto COM fuso (Z, +00, -03:00) é convertido. */
const AnaliseLogs = (function () {
    'use strict';
    const FUSO_MS = -3 * 3600000;                         // Brasília = UTC−3
    const DIAS_SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
    const NAO_IDENTIFICADO = 'Não identificado';
    const p2 = n => String(n).padStart(2, '0');

    /* ───────────── texto ───────────── */
    const semAcento = s => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '');
    // chave de comparação: sem acento, minúscula, só letras/números ("CT-e?" e "cte" continuam diferentes, mas "Cancelar CT-e" = "cancelar ct e")
    const chaveTexto = s => semAcento(s).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

    /* ───────────── data e hora ───────────── */
    const RE_ISO = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s]+(\d{1,2}):(\d{2})(?::(\d{2})(?:[.,]\d+)?)?)?\s*(Z|[+-]\d{2}(?::?\d{2})?)?$/i;
    const RE_BR = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[T\s]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/;

    function zonaMin(z) {
        if (!z || /^z$/i.test(z)) return 0;
        const m = /^([+-])(\d{2}):?(\d{2})?$/.exec(z);
        return m ? (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3] || 0)) : 0;
    }
    function dataValida(a, mo, d, h, mi, s) {
        if (a < 2000 || a > 2100 || mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59 || s > 59) return false;
        return new Date(Date.UTC(a, mo - 1, d)).getUTCDate() === d;   // recusa 31/02
    }
    // ms = relógio de parede de Brasília lido como se fosse UTC (campos lidos com getUTC*)
    function montarData(ms) {
        const d = new Date(ms);
        return { ms, dia: d.getUTCFullYear() + '-' + p2(d.getUTCMonth() + 1) + '-' + p2(d.getUTCDate()), hora: d.getUTCHours(), min: d.getUTCMinutes(), dow: d.getUTCDay() };
    }
    // Lê a data/hora de uma célula: texto ISO ("2026-08-20 14:03:22.123+00"), texto brasileiro ("20/08/2026 14:03") ou Date (Excel).
    // opcoes.parede = o texto já é horário de Brasília mesmo que traga "Z"/"+00" (coluna "timestamp" dos logs). Devolve null se não entender.
    function lerDataHora(v, opcoes) {
        if (v === null || v === undefined || v === '') return null;
        const parede = !!(opcoes && opcoes.parede);
        let a, mo, d, h = 0, mi = 0, s = 0, deslocar = 0;
        if (v instanceof Date) {
            if (isNaN(v)) return null;
            a = v.getFullYear(); mo = v.getMonth() + 1; d = v.getDate(); h = v.getHours(); mi = v.getMinutes(); s = v.getSeconds();   // célula do Excel: vale o que aparece na planilha
        } else if (typeof v === 'string') {
            const t = v.trim();
            let m = RE_ISO.exec(t);
            if (m) {
                a = +m[1]; mo = +m[2]; d = +m[3]; h = +(m[4] || 0); mi = +(m[5] || 0); s = +(m[6] || 0);
                if (m[7] && !parede) deslocar = FUSO_MS - zonaMin(m[7]) * 60000;   // instante com fuso → relógio de Brasília
            } else if ((m = RE_BR.exec(t))) {
                d = +m[1]; mo = +m[2]; a = +m[3]; h = +(m[4] || 0); mi = +(m[5] || 0); s = +(m[6] || 0);
            } else return null;
        } else return null;
        if (!dataValida(a, mo, d, h, mi, s)) return null;
        return montarData(Date.UTC(a, mo - 1, d, h, mi, s) + deslocar);
    }
    // A coluna created_at guarda o relógio do SERVIDOR, que é UTC, mas o Supabase a entrega SEM fuso ("2026-10-08T11:18:06.865777" = 08:18 em Brasília). Lida "como está escrito"
    // adiantava tudo em 3 h (o 1º atendimento das 08:18 virava 11h nos horários de pico e a noite caía no dia seguinte). Com fuso explícito (Z, +00) lerDataHora já converte.
    // Sem fuso: dado lido direto do Supabase (doSupabase) é UTC com certeza; em planilha exportada vale a leitura (UTC ou já em Brasília) que mais se aproxima da coluna "timestamp" da
    // MESMA linha (relógio do usuário, horário de Brasília) e, sem ela, UTC. Data sem hora (meia-noite exata) fica como está: não dá para saber que horas eram.
    function lerCriadoEm(v, timestamp, doSupabase) {
        const q = lerDataHora(v);
        if (!q) return null;
        const m = typeof v === 'string' ? RE_ISO.exec(v.trim()) : null;
        if (m && m[7]) return q;                          // fuso explícito: já convertido
        if (q.ms % 86400000 === 0) return q;              // só a data
        const utc = montarData(q.ms + FUSO_MS);
        if (doSupabase) return utc;
        const t = lerDataHora(timestamp, { parede: true });
        return t && Math.abs(q.ms - t.ms) < Math.abs(utc.ms - t.ms) ? q : utc;
    }

    /* dias são textos "AAAA-MM-DD" (ordenam como texto) */
    const diaParaMs = k => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(k || ''); return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) : NaN; };
    const msParaDia = ms => { const d = new Date(ms); return d.getUTCFullYear() + '-' + p2(d.getUTCMonth() + 1) + '-' + p2(d.getUTCDate()); };
    const somarDias = (k, n) => msParaDia(diaParaMs(k) + n * 86400000);
    const formatarDia = k => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(k || ''); return m ? m[3] + '/' + m[2] + '/' + m[1] : ''; };
    const formatarDiaCurto = k => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(k || ''); return m ? m[3] + '/' + m[2] : ''; };
    const diaSemana = k => { const ms = diaParaMs(k); return isNaN(ms) ? '' : DIAS_SEMANA[new Date(ms).getUTCDay()]; };
    function formatarDataHora(l) { return l && l.dia ? formatarDia(l.dia) + ' ' + p2(l.hora) + ':' + p2(l.min) : '—'; }

    /* ───────────── assunto (categoria) ─────────────
       Regras por palavras, na ordem: a primeira que casar vence. O texto é comparado sem acento/maiúscula e por PALAVRA
       (\b), senão "conferir" cairia em NF-e (tem "nfe") e "como lançar os custos" em manutenção (tem "os"). */
    const REGRAS_CATEGORIA = [
        { re: /\b(cte|ctes|ct e|conhecimentos?)\b/, padrao: 'CT-e - Emissão e Dúvidas Gerais', sub: [
            { re: /\bsubcontrat/, cat: 'CT-e - Subcontratação' },
            { re: /\b(recomp|anula|substitu)/, cat: 'CT-e - Anulação/Substituição' },
            { re: /\bcancel/, cat: 'CT-e - Cancelamento' }] },
        { re: /\b(mdfe|mdfes|mdf e|manifestos?)\b/, cat: 'MDF-e - Emissão e Encerramento' },
        { re: /\b(nfse|nfs e|nfe|nf e|nota fiscal|notas fiscais|cnae)\b/, cat: 'NF-e / NFS-e - Configuração e Emissão' },
        { re: /\b(frete|tabela|regra|calcul)|\bkm\b/, cat: 'Tabela de Frete & Regras de Cálculo' },
        { re: /\b(pneu|manuten|plano|ordem de servico|ordens de servico)/, bruto: /\bOS\b/, cat: 'Gestão de Frota & Manutenção' },   // "OS" só em maiúsculas (senão pega o artigo "os")
        { re: /\b(motorist|veicul|proprietari)/, cat: 'Cadastros (Veículos e Motoristas)' },
        { re: /\b(averb|seguro)/, cat: 'Averbação de Seguro' },
        { re: /\b(fatura|boleto|duplicata|financ)/, cat: 'Financeiro & Faturamento' },
        { re: /\b(usuari|permiss)/, cat: 'Gestão de Usuários e Permissões' },
    ];
    const CAT_TESTE = 'Testes / Entradas Curtas', CAT_OUTROS = 'Outros / Dúvidas Operacionais';
    function categorizar(pergunta) {
        const bruto = String(pergunta == null ? '' : pergunta);
        const t = chaveTexto(bruto);
        for (const r of REGRAS_CATEGORIA) {
            if (r.re.test(t) || (r.bruto && r.bruto.test(bruto))) {
                if (r.sub) { const s = r.sub.find(x => x.re.test(t)); return s ? s.cat : r.padrao; }
                return r.cat;
            }
        }
        if (bruto.trim().length < 5 || /^(teste|testando|test|qa)\b/.test(t)) return CAT_TESTE;
        return CAT_OUTROS;
    }

    /* ───────────── linhas ───────────── */
    function minusculas(r) { const o = {}; for (const k in r) if (Object.prototype.hasOwnProperty.call(r, k)) o[String(k).trim().toLowerCase()] = r[k]; return o; }
    const vazio = v => v === null || v === undefined || String(v).trim() === '';
    function pegar(r, nomes) { for (const n of nomes) if (!vazio(r[n])) return r[n]; return undefined; }
    // true / false / null (null = o log não diz — não conta como falha)
    function lerBool(v) {
        if (v === true || v === false) return v;
        if (typeof v === 'number') return v === 1 ? true : v === 0 ? false : null;
        if (typeof v === 'string') {
            const s = semAcento(v).toLowerCase().trim();
            if (['true', 't', '1', 'sim', 's', 'yes', 'y', 'verdadeiro'].includes(s)) return true;
            if (['false', 'f', '0', 'nao', 'n', 'no', 'falso'].includes(s)) return false;
        }
        return null;
    }

    // brutas = linhas do Supabase ou de uma planilha (cabeçalhos em qualquer caixa). opcoes.origem = 'supabase' quando vêm direto do banco (created_at sem fuso = UTC).
    // Devolve { linhas, info }.
    function normalizarLinhas(brutas, opcoes) {
        const doSupabase = !!(opcoes && opcoes.origem === 'supabase');
        const linhas = [], info = { lidas: 0, semPergunta: 0, ignoradas: 0, semData: 0 };
        (brutas || []).forEach(b => {
            if (!b) return;
            info.lidas++;
            const r = minusculas(b);
            const pBruta = pegar(r, ['pergunta', 'query', 'mensagem']);
            const pergunta = String(pBruta === undefined ? '' : pBruta).replace(/\s+/g, ' ').trim();
            if (!pergunta) { info.semPergunta++; return; }
            if (/^feedback\b/i.test(pergunta) || pergunta === 'Pendente') { info.ignoradas++; return; }   // sobras de versões antigas do sistema
            let q = vazio(r.created_at) ? lerDataHora(pegar(r, ['data', 'data_hora', 'datahora'])) : lerCriadoEm(r.created_at, r.timestamp, doSupabase);
            if (!q) q = lerDataHora(r.timestamp, { parede: true });
            if (!q) info.semData++;
            let usuario = pegar(r, ['usuario_windows', 'usuario', 'usuário', 'user', 'login']);
            usuario = (usuario === undefined || String(usuario).trim().toLowerCase() === 'nan') ? NAO_IDENTIFICADO : String(usuario).trim();
            const catPlanilha = pegar(r, ['categoria_refinada', 'categoria', 'assunto']);
            const fonte = pegar(r, ['fonte', 'origem']);
            linhas.push({
                id: r.id === undefined ? null : r.id,
                pergunta, chave: chaveTexto(pergunta),
                encontrou: lerBool(pegar(r, ['encontrou', 'sucesso', 'found'])),
                usuario, uchave: chaveTexto(usuario),
                ms: q ? q.ms : null, dia: q ? q.dia : null, hora: q ? q.hora : null, min: q ? q.min : null, dow: q ? q.dow : null,
                categoria: catPlanilha !== undefined ? String(catPlanilha).trim() : categorizar(pergunta),
                fonte: fonte === undefined ? '' : String(fonte).toLowerCase().trim(),
                feedback: r.feedback === undefined || r.feedback === null ? '' : String(r.feedback).trim(),
            });
        });
        return { linhas, info };
    }

    /* ───────────── filtro ─────────────
       f = { de, ate ("AAAA-MM-DD"), usuario (nome), categoria, fonte, texto (contém, sem acento), chaveExata (pergunta igual), soComData } */
    function filtrar(linhas, f) {
        f = f || {};
        const de = f.de || '', ate = f.ate || '', uch = f.usuario ? chaveTexto(f.usuario) : '', txt = f.texto ? chaveTexto(f.texto) : '', exata = f.chaveExata || '';
        return linhas.filter(l => {
            if ((f.soComData || de || ate) && l.dia === null) return false;
            if (de && l.dia < de) return false;
            if (ate && l.dia > ate) return false;
            if (uch && l.uchave !== uch) return false;
            if (f.categoria && l.categoria !== f.categoria) return false;
            if (f.fonte && l.fonte !== f.fonte) return false;
            if (exata) { if (l.chave !== exata) return false; }
            else if (txt && l.chave.indexOf(txt) < 0) return false;
            return true;
        });
    }

    /* ───────────── números ───────────── */
    const taxaDe = (ok, falha) => (ok + falha) ? ok / (ok + falha) : null;   // null = os logs não dizem se encontrou
    function resumir(linhas) {
        let ok = 0, falha = 0, semInfo = 0;
        const us = new Set(), ps = new Set(), dias = new Set();
        for (const l of linhas) {
            if (l.encontrou === true) ok++; else if (l.encontrou === false) falha++; else semInfo++;
            us.add(l.uchave); ps.add(l.chave); if (l.dia) dias.add(l.dia);
        }
        return { total: linhas.length, ok, falha, semInfo, taxa: taxaDe(ok, falha), usuarios: us.size, perguntas: ps.size, diasAtivos: dias.size };
    }
    // o texto/nome que aparece na tela: a grafia mais usada dentro do grupo (empate: a primeira vista)
    function maisUsado(contagem) { let melhor = '', n = -1; contagem.forEach((q, txt) => { if (q > n) { n = q; melhor = txt; } }); return melhor; }
    const somar = (mapa, chave) => mapa.set(chave, (mapa.get(chave) || 0) + 1);

    function porCategoria(linhas) {
        const mapa = new Map();
        for (const l of linhas) {
            let c = mapa.get(l.categoria); if (!c) mapa.set(l.categoria, c = { categoria: l.categoria, total: 0, ok: 0, falha: 0, semInfo: 0 });
            c.total++; if (l.encontrou === true) c.ok++; else if (l.encontrou === false) c.falha++; else c.semInfo++;
        }
        return Array.from(mapa.values()).map(c => Object.assign(c, { taxa: taxaDe(c.ok, c.falha) })).sort((a, b) => b.total - a.total || a.categoria.localeCompare(b.categoria, 'pt-BR'));
    }
    function porUsuario(linhas) {
        const mapa = new Map();
        for (const l of linhas) {
            let u = mapa.get(l.uchave); if (!u) mapa.set(l.uchave, u = { uchave: l.uchave, nomes: new Map(), total: 0, ok: 0, falha: 0, semInfo: 0, cats: new Map() });
            u.total++; somar(u.nomes, l.usuario); somar(u.cats, l.categoria);
            if (l.encontrou === true) u.ok++; else if (l.encontrou === false) u.falha++; else u.semInfo++;
        }
        return Array.from(mapa.values()).map(u => ({ uchave: u.uchave, usuario: maisUsado(u.nomes), total: u.total, ok: u.ok, falha: u.falha, semInfo: u.semInfo, taxa: taxaDe(u.ok, u.falha), topCategoria: maisUsado(u.cats) || 'N/A' }))
            .sort((a, b) => b.total - a.total || a.usuario.localeCompare(b.usuario, 'pt-BR'));
    }
    // perguntas que se repetem (mesma pergunta depois de tirar acento/maiúscula/pontuação)
    function recorrentes(linhas, limite) {
        const mapa = new Map();
        for (const l of linhas) {
            if (!l.chave) continue;
            let q = mapa.get(l.chave); if (!q) mapa.set(l.chave, q = { chave: l.chave, textos: new Map(), cats: new Map(), usuarios: new Set(), total: 0, ok: 0, falha: 0, primeiro: null, ultimo: null });
            q.total++; somar(q.textos, l.pergunta); somar(q.cats, l.categoria); q.usuarios.add(l.uchave);
            if (l.encontrou === true) q.ok++; else if (l.encontrou === false) q.falha++;
            if (l.dia) { if (!q.primeiro || l.dia < q.primeiro) q.primeiro = l.dia; if (!q.ultimo || l.dia > q.ultimo) q.ultimo = l.dia; }
        }
        const lista = Array.from(mapa.values()).map(q => ({ chave: q.chave, pergunta: maisUsado(q.textos), categoria: maisUsado(q.cats), total: q.total, usuarios: q.usuarios.size, ok: q.ok, falha: q.falha, taxa: taxaDe(q.ok, q.falha), primeiro: q.primeiro, ultimo: q.ultimo }))
            .sort((a, b) => b.total - a.total || a.pergunta.localeCompare(b.pergunta, 'pt-BR'));
        return limite ? lista.slice(0, limite) : lista;
    }
    // um ponto por dia entre de..ate (dias sem consulta valem 0 — senão o gráfico "pula" os buracos). Sem de/ate: do 1º ao último dia com dados.
    function serieDiaria(linhas, de, ate) {
        const mapa = new Map(); let min = null, max = null;
        for (const l of linhas) {
            if (!l.dia) continue;
            let c = mapa.get(l.dia); if (!c) mapa.set(l.dia, c = { total: 0, ok: 0, falha: 0 });
            c.total++; if (l.encontrou === true) c.ok++; else if (l.encontrou === false) c.falha++;
            if (min === null || l.dia < min) min = l.dia; if (max === null || l.dia > max) max = l.dia;
        }
        const ini = de || min, fim = ate || max;
        if (!ini || !fim || ini > fim) return [];
        const saida = []; let k = ini;
        for (let guarda = 0; k <= fim && guarda < 4000; guarda++, k = somarDias(k, 1)) { const c = mapa.get(k); saida.push({ dia: k, total: c ? c.total : 0, ok: c ? c.ok : 0, falha: c ? c.falha : 0 }); }
        return saida;
    }
    function porHora(linhas) {
        const h = new Array(24).fill(0);
        for (const l of linhas) if (l.hora !== null && l.hora >= 0 && l.hora < 24) h[l.hora]++;
        return h;
    }
    function limitesDatas(linhas) {
        let min = null, max = null;
        for (const l of linhas) { if (!l.dia) continue; if (min === null || l.dia < min) min = l.dia; if (max === null || l.dia > max) max = l.dia; }
        return { min, max };
    }
    // o que aparece nas listas de escolha dos filtros (usuários, assuntos e as perguntas mais repetidas)
    function opcoesFiltro(linhas, maxPerguntas) {
        const us = porUsuario(linhas).map(u => ({ nome: u.usuario, uchave: u.uchave, total: u.total }));
        const cats = porCategoria(linhas).map(c => ({ nome: c.categoria, total: c.total }));
        const perguntas = recorrentes(linhas, maxPerguntas || 300).map(q => ({ chave: q.chave, texto: q.pergunta, total: q.total }));
        return { usuarios: us, categorias: cats, perguntas };
    }
    // prioridade de "o que alimentar na IA primeiro" (c = item de porCategoria)
    function prioridade(c) {
        const taxaBaixa = c.taxa !== null && c.taxa < 0.9;
        if ((c.total >= 20 && taxaBaixa) || c.falha >= 5) return 'alta';
        if (c.total >= 10) return 'media';
        return 'baixa';
    }

    return { esc, semAcento, chaveTexto, lerDataHora, categorizar, normalizarLinhas, filtrar, resumir, porCategoria, porUsuario, recorrentes, serieDiaria, porHora, limitesDatas, opcoesFiltro, prioridade,
        somarDias, formatarDia, formatarDiaCurto, diaSemana, formatarDataHora, diaParaMs, NAO_IDENTIFICADO };
})();
