'use strict';
// GERAÇÃO DE REGRA (Criar Regra › Ct-e / Conhecimento Nova Versão) — AGENTE DE REGRAS × gerador CLÁSSICO, com a IA DE VERDADE (?sim=1: nada vai ao banco; gasta chamadas de IA).
// Abre o assistente da Nova Versão no navegador, escreve o pedido (e a regra colada, quando há), manda gerar e lê a regra que o cartão mostra — o caminho exato de quem usa. O mesmo pedido é gerado nos dois modos
// (Personalizar › "Usar o Agente de IA para gerar regras" ligado e desligado) e JULGADO pelas mesmas conferências (js/app/regra-cte-passos.js): problemas que sobraram + o que o pedido exigia / proibia.
// A IA varia a cada resposta: um cenário só diz pouco; rode mais de uma vez (--rodadas=2) antes de concluir.
// Uso (servidor do projeto na 8080 → tools\servidor-local.bat):
//   Code.exe teste-regras-agente.js [--so=1,3,4] [--modos=classico,agente] [--rodadas=1] [--url=…] [--porta=9565] [--saida=arquivo.json] [--codigo]   (--codigo imprime a regra de cada geração)
const fs = require('fs');
const L = require('./lib-cdp.js');
const { execSync } = require('child_process');
const arg = (n, d) => { const a = process.argv.find(x => x.startsWith('--' + n + '=')); return a ? a.slice(n.length + 3) : (process.argv.includes('--' + n) ? true : d); };
const URL = arg('url', 'http://localhost:8080/index.html?sim=1'), PORTA = +arg('porta', 9565), SO = arg('so', null), MODOS = String(arg('modos', 'classico,agente')).split(','), RODADAS = +arg('rodadas', 1), SAIDA = arg('saida', null), CODIGO = !!arg('codigo', false);

const CENARIOS = [
    { id: 1, titulo: 'Do zero: frete por tarifa × peso + ICMS demonstrativo com pedágio na base',
      pedido: 'Calcular o frete multiplicando a tarifa digitada pelo peso total das notas em kg. ICMS demonstrativo: a base de cálculo é o frete somado ao pedágio.',
      esperado: [['frete = tarifa × peso', /def\("valorFrete",[^;]*(?:tarifaDigitada[^;]*merc_quantKg|merc_quantKg[^;]*tarifaDigitada)/], ['base com frete e pedágio', /def\("baseCalculo",[^;]*valorPedagioConhecimento/], ['valor do ICMS definido', /def\("valorICMS"/]],
      proibido: [['def do totalPrestacao que ninguém pediu', /def\(\s*["']totalPrestacao["']/]] },
    { id: 2, titulo: 'Editar: regra de cálculo inverso + somar seguro e pedágio na base',
      regra: 'inverso', pedido: 'Somar o seguro e o pedágio na base de cálculo.',
      esperado: [['seguro na base', /def\("baseCalculo",[^;]*valorSeguro|baseCalculo[^;]*valorSeguro/], ['pedágio na base', /valorPedagioConhecimento/], ['continua inverso (divisão por (100 − alíquota)/100)', /inverso|\/\s*\(*\s*\(\s*100\s*-\s*obt\(\s*["']aliquota["']\s*\)\s*\)?\s*\/\s*100/], ['preservou o totalPrestacao', /def\("totalPrestacao"/]],
      proibido: [] },
    { id: 3, titulo: 'O caso real de 14/10/2026: validar o peso e impedir de salvar',
      pedido: 'Valide o peso total das notas: se passar de 30 toneladas, avise o usuário e impeça de salvar o Ct-e.',
      esperado: [['avisa com alert()', /alert\(/]],
      proibido: [['função inventada (msg/preventSave/bloquear/impedirSalvar)', /\b(?:msg|mensagem|preventSave|bloquear|impedirSalvar|setError)\s*\(/], ['throw new Error para travar', /throw new Error/]] },
    { id: 4, titulo: 'IBS/CBS (só no artigo da equipe): base reduzindo PIS e Cofins',
      pedido: 'Calcular a base de cálculo de IBS e CBS reduzindo da base o PIS (0,65%) e a Cofins (3%) sobre o total da prestação.',
      esperado: [['usa o campo do artigo (bloco_impostos_conhecimento[base_calculo_cbs_ibs])', /bloco_impostos_conhecimento\[base_calculo_cbs_ibs\]/], ['não deixa a base negativa (Math.max(0, …))', /Math\.max\(\s*0/], ['alíquota do PIS 0,65', /0[.,]65/]],
      proibido: [] },
    { id: 5, titulo: 'Acumulador global (obtGlob/defGlob, só no manual de funções)',
      pedido: 'Guarde o peso total das notas num acumulador global chamado pesoAcumulado e some nele o peso a cada cálculo.',
      esperado: [['usa defGlob()', /defGlob\(/], ['usa obtGlob()', /obtGlob\(/]],
      proibido: [] },
    { id: 6, titulo: 'Advalorem em campo personalizado (Tipos Valores Outros) somado no total',
      pedido: 'Crie o cálculo do advalorem no campo personalizado "advalorem" (Tipos Valores Outros): 1% do valor total das notas; e some o advalorem no total da prestação.',
      esperado: [['define outrosValores[advalorem]', /def\("outrosValores\[advalorem\]"/], ['sobre o valor total das notas (merc_valor[])', /merc_valor\[\]/], ['soma no totalPrestacao', /def\("totalPrestacao"[^;]*outrosValores\[advalorem\]/]],
      proibido: [['obt("advalorem") sem outrosValores[]', /obt\(\s*["']advalorem["']\s*\)/]] },
];

(async () => {
    const proc = await L.lancar({ porta: PORTA, gpu: false, w: 1366, h: 900, args: ['--headless=new'] });
    const c = await L.abrirPagina(PORTA);
    const consoleAgente = [];
    await c.send('Page.enable'); await c.send('Runtime.enable'); await c.send('Network.enable');
    c.on('Runtime.consoleAPICalled', p => { const t = p.args.map(a => a.value !== undefined ? String(a.value) : (a.description || '')).join(' '); if (/\[regras\]/.test(t)) consoleAgente.push(t.slice(0, 300)); });
    const erros = []; c.on('Runtime.exceptionThrown', p => erros.push((p.exceptionDetails.exception && p.exceptionDetails.exception.description || p.exceptionDetails.text).slice(0, 300)));
    await c.send('Emulation.setDeviceMetricsOverride', { width: 1366, height: 900, deviceScaleFactor: 1, mobile: false });
    await c.send('Page.addScriptToEvaluateOnNewDocument', { source: "try{localStorage.setItem('bsoft_usuario_nome','Teste Agente'); localStorage.removeItem('bsoft_v27_prefs')}catch(e){}" });
    await L.navegar(c, URL);
    for (let i = 0; i < 400; i++) { await L.sleep(400); if (await c.eval("typeof isVectorizing !== 'undefined' && !isVectorizing && bancoCompletoRaw.length > 100 && typeof AgenteRegras !== 'undefined' && typeof mostrarWizardRegraCteNova === 'function'").catch(() => false)) break; }
    await L.sleep(1500);
    console.log('versão do agente de regras: ' + await c.eval('AgenteRegras.VERSAO') + ' · ligado: ' + await c.eval('AgenteRegras.ativo()'));
    // o chat entrega os artigos ao motor (a 1ª vez leva alguns segundos) e o manual de funções da equipe serve de "documentação" para as duas conferências
    const prep = await c.eval("AgenteChat.prepararMotor().then(() => ({ ok: true, manual: (Agente.regrasIA.referencia() || {}).titulo || null })).catch(e => ({ ok: false, erro: String(e && e.message || e) }))");
    console.log('motor preparado: ' + JSON.stringify(prep));
    await c.eval(`window.__gerarRegra = async (pedido, regraKey, modo) => {
        Prefs.set({ agenteRegras: modo === 'agente' }, { quiet: true });
        window._cteTabelaCustom = [];
        const ant = document.querySelectorAll('.answer-card').length;
        mostrarWizardRegraCteNova('');
        await new Promise(r => setTimeout(r, 500));
        const desc = document.getElementById('wCteDescricao'); if (!desc) return { erro: 'o assistente não abriu (wCteDescricao)' };
        desc.value = pedido;
        const regra = regraKey ? REGRAS_PREDEFINIDAS_CODE_CLASSICA[regraKey] : '';
        // a regra base da Nova Versão entra pelo campo do passo 1 (wCteColarRegra) e vai para a área de montagem — de lá segue para a IA como "REGRA JA MONTADA"
        if (regra) { const colar = document.getElementById('wCteColarRegra'); if (!colar) return { erro: 'o campo de colar a regra (wCteColarRegra) não existe' }; colar.value = regra; _nvColarInput(); await new Promise(r => setTimeout(r, 300)); }
        const t0 = performance.now();
        await enviarWizardRegraDnd();
        const ms = Math.round(performance.now() - t0);
        const cards = Array.from(document.querySelectorAll('.answer-card'));
        const card = cards.length > ant ? cards[cards.length - 1] : null;
        if (!card) return { erro: 'nenhum cartão novo (a geração foi bloqueada ou o assistente não gerou)', ms };
        const blocos = Array.from(card.querySelectorAll('pre.regra-code')).map(p => p.innerText);   // (innerText: o cartão troca as quebras de linha por <br> mesmo dentro do <pre>; textContent juntaria tudo numa linha só)
        const texto = (card.querySelector('.section-content') || card).innerText || '';
        const selo = (card.querySelector('.feedback-area span:last-child') || {}).innerText || '';
        const doc = ((Agente.regrasIA.referencia() || {}).conteudo || '') + '\\n' + Agente.regrasIA.apoio(pedido, { max: 2 }).map(a => a.texto).join('\\n');   // o mesmo que o agente teria à mão: o manual de funções + os artigos do assunto (vale para os DOIS modos)
        const juiz = cod => { try { return _cnProblemasDaResposta('\`\`\`\\n' + cod + '\\n\`\`\`', { agente: true, original: regra || '', pedido, docs: doc }); } catch (e) { return ['(juiz falhou: ' + e.message + ')']; } };
        const cod = blocos.join('\\n');
        return { ms, blocos, texto, selo, regraOriginal: regra || '', problemas: blocos.length ? juiz(cod) : ['(sem código na resposta)'], erroCartao: /Não consegui gerar a regra/.test(texto) };
    }; 0`);

    const resultados = [];
    for (const cen of CENARIOS) {
        if (SO && !String(SO).split(',').map(Number).includes(cen.id)) continue;
        for (let rod = 1; rod <= RODADAS; rod++) for (const modo of MODOS) {
            consoleAgente.length = 0;
            console.log('\n══ ' + cen.id + '. ' + cen.titulo + ' · ' + (modo === 'agente' ? 'AGENTE' : 'CLÁSSICO') + (RODADAS > 1 ? ' · rodada ' + rod : ''));
            let r;
            try { r = await Promise.race([c.eval('window.__gerarRegra(' + JSON.stringify(cen.pedido) + ',' + JSON.stringify(cen.regra || '') + ',' + JSON.stringify(modo) + ')'), L.sleep(420000).then(() => ({ erro: 'tempo esgotado (7 min)' }))]); }
            catch (e) { r = { erro: String(e.message || e).slice(0, 200) }; }
            if (r.erro) { console.log('   ✘ ' + r.erro); resultados.push({ id: cen.id, modo, rod, erro: r.erro }); continue; }
            const cod = r.blocos.join('\n');
            const ex = cen.esperado.map(([n, re]) => [n, re.test(cod)]), pr = cen.proibido.map(([n, re]) => [n, re.test(cod)]);
            const exOk = ex.filter(x => x[1]).length, prViol = pr.filter(x => x[1]).length;
            console.log('   ' + (r.ms / 1000).toFixed(1) + ' s · selo: ' + r.selo.replace(/\s+/g, ' ') + ' · ' + r.blocos.length + ' bloco(s) de código · ' + (r.erroCartao ? 'ERRO NO CARTÃO' : 'ok'));
            if (modo === 'agente' && consoleAgente.length) console.log('   ' + consoleAgente[consoleAgente.length - 1].replace(/%c/g, '').replace(/color:[^ ]+;font-weight:\d+;?/, '').trim());
            console.log('   o pedido exigia: ' + exOk + '/' + ex.length + (ex.some(x => !x[1]) ? '  (faltou: ' + ex.filter(x => !x[1]).map(x => x[0]).join('; ') + ')' : ''));
            console.log('   o que não podia aparecer: ' + (prViol ? 'APARECEU → ' + pr.filter(x => x[1]).map(x => x[0]).join('; ') : 'nada'));
            console.log('   conferências (as mesmas para os dois modos): ' + (r.problemas.length ? r.problemas.length + ' problema(s): ' + r.problemas.map(p => p.slice(0, 110)).join(' | ') : 'regra limpa'));
            if (CODIGO) console.log('   ┌─ regra gerada\n' + cod.split('\n').map(l => '   │ ' + l).join('\n') + '\n   └─');
            if (arg('texto', false)) console.log('   ┌─ texto do cartão (depois do código)\n' + String(r.texto).split('\n').filter(l => l.trim()).slice(0, 40).map(l => '   │ ' + l.slice(0, 220)).join('\n') + '\n   └─');
            resultados.push({ id: cen.id, modo, rod, ms: r.ms, selo: r.selo, exOk, exTotal: ex.length, violacoes: prViol, problemas: r.problemas, erroCartao: r.erroCartao, codigo: cod });
        }
    }
    console.log('\n══════ RESUMO ══════');
    MODOS.forEach(m => {
        const l = resultados.filter(x => x.modo === m && !x.erro);
        if (!l.length) { console.log((m === 'agente' ? 'AGENTE  ' : 'CLÁSSICO') + ' nenhum resultado'); return; }
        const soma = f => l.reduce((s, x) => s + f(x), 0);
        console.log((m === 'agente' ? 'AGENTE  ' : 'CLÁSSICO') + ' ' + l.length + ' geração(ões) · exigências atendidas ' + soma(x => x.exOk) + '/' + soma(x => x.exTotal) + ' · proibições violadas ' + soma(x => x.violacoes) + ' · problemas nas conferências ' + soma(x => x.problemas.length) + ' · gerações limpas ' + l.filter(x => !x.problemas.length).length + '/' + l.length + ' · tempo médio ' + (soma(x => x.ms) / l.length / 1000).toFixed(1) + ' s');
    });
    console.log('erros de JavaScript na página: ' + (erros.length ? erros.slice(0, 3).join(' | ') : 'nenhum'));
    if (SAIDA) { fs.writeFileSync(SAIDA, JSON.stringify(resultados, null, 1)); console.log('resultados em ' + SAIDA); }
    c.fechar(); try { execSync('taskkill /F /T /PID ' + proc.pid, { stdio: 'ignore' }); } catch (e) { /* ok */ }
    process.exit(0);
})().catch(e => { console.error(String(e && e.stack || e)); process.exit(1); });
