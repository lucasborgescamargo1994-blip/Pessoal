/* js/app/tutorial-regras.js — Tutorial passo a passo do criador de regras. */
// ═══════════════════════════════════════════════════════════
//  TUTORIAL PASSO A PASSO DO CRIADOR DE REGRAS
// ═══════════════════════════════════════════════════════════
// Passo a passo guiado pra quem tem dificuldade de usar o criador de regras (muito leigo em
// informática entra na empresa) -- destaca um pedaço da tela por vez, com selo numerado, seta
// piscando e um cartão explicando o que fazer. Abre sozinho na primeira vez que a pessoa entra no
// criador de regras (controlado pelo localStorage) e sempre pode ser reaberto pelo botão "🎓 Ver
// tutorial passo a passo". Os mesmos passos servem pros 3 criadores (Ct-e/Contrato/Faturamento) --
// o prefixo dos ids muda, e um passo cujo alvo não existe na ferramenta atual (ex.: "Monte com um
// clique" não existe em Contrato de Frete/Faturamento) é pulado automaticamente.
const _TOUR_LOCALSTORAGE_KEY='bsoft_tour_regra_oculto';
let _tourEstado=null;
function _prefixoTour(tipo){ return tipo==='cte'?'Cte':tipo==='cfd'?'Cfd':'Fat'; }
const _TOUR_PASSOS=[
    {
        alvo:p=>[`#w${p}SecaoColar`,`#w${p}SecaoPredefinidas`],
        titulo:'Comece por aqui',
        texto:'Cole uma regra que o cliente já usa, ou clique em uma das "Regras pré-existentes" prontas.\n\nIsso já preenche a área de montagem sozinho, prontinho pra ajustar do seu jeito.'
    },
    {
        alvo:p=>[`#w${p}SecaoOpcional`],
        titulo:'Monte com um clique (opcional)',
        texto:'Se algum desses cálculos prontos servir pra sua regra, é só marcar a caixinha.\n\nSe nenhum servir, sem problema — pode seguir pro próximo passo sem marcar nada.'
    },
    {
        alvo:p=>[`#w${p}SecaoMontar`,`#w${p}BlocosContainer`],
        titulo:'Monte sua regra arrastando os campos',
        texto:'1) Se o "Campo a definir" ainda estiver vazio, arraste um dos "Campos disponíveis" até ele.\n\n2) Arraste uma ação (Somar, Subtrair...) pra área de montagem pra deixar ela ativa, depois arraste um campo pro quadro azul — é ali que o cálculo é montado.'
    },
    {
        alvo:()=>['[data-tour="condicao"]'],
        titulo:'Definir condição? (opcional)',
        texto:'Use só se o cálculo precisar valer apenas em um caso — por exemplo, "somente se a tarifa for maior que zero".\n\nSe não precisar de condição, deixe desmarcado e siga em frente.'
    },
    {
        alvo:p=>[`#w${p}ValorInput`,`#w${p}ValorChip`],
        titulo:'Usar um número fixo na regra',
        texto:'Precisa de um número fixo no cálculo (por exemplo, dividir por 1000)? Digite o número na caixinha e arraste "Arrastar valor" pro quadro azul.'
    },
    {
        alvo:p=>[`#w${p}BtnGerar`],
        titulo:'Pronto! Gerar a regra',
        texto:'Clique aqui pra gerar o código da regra.\n\nDepois é só copiar, colar no Bsoft TMS e salvar.'
    }
];
function _iniciarTourBuilder(tipo){
    const prefixo=_prefixoTour(tipo);
    const passos=_TOUR_PASSOS
        .map(p=>({...p, seletores:p.alvo(prefixo)}))
        .filter(p=>p.seletores.every(sel=>document.querySelector(sel)));
    if(!passos.length)return;
    _tourEstado={prefixo, passos, indice:0, naoMostrarNovamente:false};
    _tourRenderPasso();
}
function _tourProximoPasso(){
    if(!_tourEstado)return;
    if(_tourEstado.indice>=_tourEstado.passos.length-1){ _tourFechar(); return; }
    _tourEstado.indice++;
    _tourRenderPasso();
}
function _tourPassoAnterior(){
    if(!_tourEstado||_tourEstado.indice<=0)return;
    _tourEstado.indice--;
    _tourRenderPasso();
}
function _tourToggleNaoMostrar(marcado){
    if(_tourEstado)_tourEstado.naoMostrarNovamente=marcado;
}
function _tourLimparDom(){
    document.querySelectorAll('.tour-alvo-ativo').forEach(el=>el.classList.remove('tour-alvo-ativo'));
    document.querySelectorAll('.tour-dim, .tour-badge, .tour-arrow, .tour-card').forEach(el=>el.remove());
}
function _tourFechar(){
    if(_tourEstado&&_tourEstado.naoMostrarNovamente){
        try{ localStorage.setItem(_TOUR_LOCALSTORAGE_KEY,'1'); }catch(e){}
    }
    _tourLimparDom();
    _tourEstado=null;
}
function _tourRenderPasso(){
    _tourLimparDom();
    if(!_tourEstado)return;
    const passo=_tourEstado.passos[_tourEstado.indice];
    const alvos=passo.seletores.map(sel=>document.querySelector(sel)).filter(Boolean);
    if(!alvos.length){ _tourProximoPasso(); return; } // segurança -- se o alvo sumiu do DOM, pula o passo
    alvos[0].scrollIntoView({block:'center'});
    alvos.forEach(el=>el.classList.add('tour-alvo-ativo'));

    const rects=alvos.map(el=>el.getBoundingClientRect());
    const pad=6;
    const uniao={
        left:Math.min(...rects.map(r=>r.left))-pad,
        top:Math.min(...rects.map(r=>r.top))-pad,
        right:Math.max(...rects.map(r=>r.right))+pad,
        bottom:Math.max(...rects.map(r=>r.bottom))+pad
    };
    const vw=window.innerWidth, vh=window.innerHeight;

    // 4 painéis escurecem tudo, menos a "janela" ao redor do(s) alvo(s) do passo atual
    const painel=(l,t,w,h)=>{
        const d=document.createElement('div');
        d.className='tour-dim';
        d.style.cssText=`left:${l}px;top:${t}px;width:${Math.max(0,w)}px;height:${Math.max(0,h)}px;`;
        document.body.appendChild(d);
    };
    painel(0,0,vw,uniao.top);
    painel(0,uniao.bottom,vw,vh-uniao.bottom);
    painel(0,uniao.top,uniao.left,uniao.bottom-uniao.top);
    painel(uniao.right,uniao.top,vw-uniao.right,uniao.bottom-uniao.top);

    // selo numerado no canto do destaque
    const badgeLeft=Math.max(8,uniao.left-6), badgeTop=Math.max(8,uniao.top-14);
    const badge=document.createElement('div');
    badge.className='tour-badge';
    badge.textContent=String(_tourEstado.indice+1);
    badge.style.cssText=`left:${badgeLeft}px;top:${badgeTop}px;`;
    document.body.appendChild(badge);

    // seta piscando apontando pro selo -- em cima se tiver espaço, senão embaixo do destaque
    const temEspacoAcima=uniao.top>90;
    const seta=document.createElement('div');
    seta.className='tour-arrow'+(temEspacoAcima?'':' dir-up');
    seta.textContent=temEspacoAcima?'▼':'▲';
    seta.style.cssText=`left:${badgeLeft+2}px;top:${temEspacoAcima?(badgeTop-34):(uniao.bottom+8)}px;`;
    document.body.appendChild(seta);

    // cartão de explicação -- tenta à direita do destaque, depois esquerda, depois embaixo, depois em cima
    const totalPassos=_tourEstado.passos.length;
    const card=document.createElement('div');
    card.className='tour-card';
    card.innerHTML=`
        <button class="tour-card-fechar" onclick="_tourFechar()" title="Fechar tutorial">✕</button>
        <div class="tour-card-passo">Passo ${_tourEstado.indice+1} de ${totalPassos}</div>
        <div class="tour-card-titulo">${escapeHtml(passo.titulo)}</div>
        <div class="tour-card-texto">${escapeHtml(passo.texto)}</div>
        <label class="tour-card-naomostrar"><input type="checkbox" onchange="_tourToggleNaoMostrar(this.checked)" ${_tourEstado.naoMostrarNovamente?'checked':''}> Não mostrar este tutorial novamente</label>
        <div class="tour-card-rodape">
            <button class="tour-card-pular" onclick="_tourFechar()">Pular tutorial</button>
            <div class="tour-card-nav">
                ${_tourEstado.indice>0?'<button class="tour-card-btn voltar" onclick="_tourPassoAnterior()">◀ Voltar</button>':''}
                <button class="tour-card-btn proximo" onclick="_tourProximoPasso()">${_tourEstado.indice>=totalPassos-1?'Concluir ✓':'Próximo ▶'}</button>
            </div>
        </div>`;
    document.body.appendChild(card);
    const cw=card.offsetWidth, ch=card.offsetHeight, gap=16;
    let cardLeft, cardTop;
    if(uniao.right+gap+cw<=vw){ cardLeft=uniao.right+gap; cardTop=Math.min(Math.max(8,uniao.top),vh-ch-8); }
    else if(uniao.left-gap-cw>=0){ cardLeft=uniao.left-gap-cw; cardTop=Math.min(Math.max(8,uniao.top),vh-ch-8); }
    else if(uniao.bottom+gap+ch<=vh){ cardLeft=Math.min(Math.max(8,uniao.left),vw-cw-8); cardTop=uniao.bottom+gap; }
    else { cardLeft=Math.min(Math.max(8,uniao.left),vw-cw-8); cardTop=Math.max(8,uniao.top-gap-ch); }
    card.style.left=cardLeft+'px';
    card.style.top=cardTop+'px';
}
function mostrarWizardRegraDnd(queryOriginal){
    _wizardRegraDndQuery=queryOriginal;
    window._cteAcaoSel=null;
    window._cteBlocos=[{destino:'',expr:null}];
    window._cteExtras=[];
    window._cteOpcionaisBase=null;
    document.getElementById('builderModalBody').innerHTML='';
    const card=document.createElement('div');
    card.id='wizardRegraDndCard';
    card.className='builder-card';
    const opcoesHtml=CTE_OPCOES_MONTAGEM.map((grupo,grupoIdx)=>`<div style="margin-bottom:8px;">
      <div style="font-size:10.5px;color:#6b7280;font-weight:700;margin:6px 0 3px;">${grupo.titulo}</div>
      ${grupo.itens.map(item=>`<label style="display:flex;align-items:center;gap:6px;font-size:12px;color:#374151;padding:4px 8px;cursor:pointer;border-radius:6px;">
        <input type="checkbox" id="wCteOpc_${item.id}" class="wCteOpcCheckbox" data-grupo="${item.grupoExclusivo||grupoIdx}" onchange="_cteOpcaoClicada(this)">${escapeHtml(item.label)}
      </label>${item.entrada?_cteEntradaOpcaoHtml(item):''}`).join('')}
    </div>`).join('');
    card.innerHTML=`<div style="flex-shrink:0;background:#eff6ff;padding:10px 15px;border-bottom:1px solid #bfdbfe;font-size:12px;color:#1e40af;font-weight:700;">📄 Assistente — Ct-e / Conhecimento <span style="font-weight:500;">(arrastar campos)</span></div>
<div class="builder-grid">
  <div class="builder-grid-side">
    <button id="wCteBtnTutorial" onclick="_iniciarTourBuilder('cte')" class="tour-btn-abrir">🎓 Ver tutorial passo a passo</button>
    <div class="wizard-section" id="wCteSecaoColar">
      <div class="wizard-label">📋 Colar regra existente do sistema</div>
      <textarea id="wCteColarRegra" class="wizard-textarea" placeholder="Cole aqui uma regra já pronta do sistema..." style="min-height:90px;font-family:monospace;font-size:11.5px;" oninput="_cteColarRegraInput()"></textarea>
      <div style="font-size:10.5px;color:#2563eb;margin-top:4px;">🔄 A área de montagem ao lado é atualizada automaticamente conforme você cola ou edita aqui.</div>
    </div>
    <div class="wizard-section" id="wCteSecaoPredefinidas">
      <div class="wizard-label">📋 Regras pré-existentes (padrão)</div>
      <div style="font-size:11px;color:#6b7280;margin-bottom:6px;">Clique pra gerar direto, sem IA:</div>
      <div style="display:flex;flex-direction:column;gap:6px;">
        <button onclick="_cteUsarPredefinida('regra_base_icms_demo')" style="width:100%;text-align:left;padding:9px 12px;background:#f9fafb;border:1.5px solid #d1d5db;border-radius:8px;cursor:pointer;font-size:12.5px;color:#374151;font-weight:600;">👑 REGRA BASE PARA: ICMS DEMONSTRATIVO, SIMPLES NACIONAL, SEM TABELA, COM TABELA</button>
        <button onclick="_cteUsarPredefinida('regra_base_icms_inverso')" style="width:100%;text-align:left;padding:9px 12px;background:#f9fafb;border:1.5px solid #d1d5db;border-radius:8px;cursor:pointer;font-size:12.5px;color:#374151;font-weight:600;">👑 REGRA BASE PARA: CÁLCULO INVERSO, SIMPLES NACIONAL, SEM TABELA, COM TABELA</button>
        <button onclick="_cteUsarPredefinida('regra_base_icms_somar')" style="width:100%;text-align:left;padding:9px 12px;background:#f9fafb;border:1.5px solid #d1d5db;border-radius:8px;cursor:pointer;font-size:12.5px;color:#374151;font-weight:600;">👑 REGRA BASE PARA: SOMAR ICMS, SIMPLES NACIONAL, SEM TABELA, COM TABELA</button>
        <button onclick="_cteUsarPredefinida('peso_cubado_gris')" style="width:100%;text-align:left;padding:9px 12px;background:#f9fafb;border:1.5px solid #d1d5db;border-radius:8px;cursor:pointer;font-size:12.5px;color:#374151;font-weight:600;">📐 Frete Calculado Peso KG ou Peso Cubado</button>
      </div>
    </div>
    <div class="wizard-section" id="wCteSecaoOpcional">
      <div class="wizard-label">🧱 Monte com um clique (opcional)</div>
      <div style="font-size:11px;color:#6b7280;margin-bottom:4px;">Marque as opções que quiser montar automaticamente na área de montagem. Marcar sobrepõe (sem duplicar) o que já estiver montado pro mesmo "Campo a definir" — o resto continua intacto.</div>
      ${opcoesHtml}
    </div>
    <div class="wizard-section" style="border:none;">
      <div class="wizard-label">✏️ Ou descreva em texto livre <span style="font-size:10px;color:#9ca3af;font-weight:400;">(a IA monta — use pra editar uma regra existente ou algo fora do padrão de contas simples)</span></div>
      <textarea id="wCteRegraCola" class="wizard-textarea" placeholder="Cole aqui a regra existente que deseja editar (opcional)..." style="min-height:60px;"></textarea>
      <textarea id="wCteDescricao" class="wizard-textarea" placeholder="Descreva o que necessita..." style="min-height:70px;margin-top:8px;"></textarea>
      <button id="wCteBtnEnviar" class="wizard-submit" onclick="enviarWizardRegraDnd()" style="margin-top:8px;">🚀 Gerar com IA</button>
    </div>
  </div>
  <div class="builder-grid-main">${_cteHtmlAreaMontagem()}</div>
</div>`;
    document.getElementById('builderModalBody').appendChild(card);
    _cteRenderBlocos();
    _abrirBuilderModal('cte');
}
// HTML da área de montagem (ações, campos, "Utiliza Valores outros", valor fixo, área de arrastar e prévia). É compartilhado pelo montador de Ct-e clássico
// (acima) e pela "Nova Versão" (js/app/regra-cte-passos.js, passo 4): os dois mostram exatamente a mesma coisa e usam os mesmos ids.
function _cteHtmlAreaMontagem(){
    const chipsHtml=_cteMontarPaletteHtml();
    return `
    <div class="wizard-section" id="wCteSecaoMontar" style="border:none;position:sticky;top:0;z-index:2;background:var(--surface);border-bottom:2px solid #bfdbfe;box-shadow:0 4px 8px -6px rgba(0,0,0,.2);">
      <div class="wizard-label">🧩 Monte sua regra arrastando os campos</div>
      <div style="font-size:12.5px;color:#1e40af;font-weight:700;margin-bottom:6px;">1. Clique ou arraste a ação pra ativar (fica destacada, vale pro próximo campo arrastado):</div>
      <div style="display:flex;gap:6px;margin-bottom:10px;flex-wrap:wrap;">
        <button class="_cte-acao-btn" data-acao="+" onclick="_cteClicarAcao('+')" draggable="true" ondragstart="_cteAcaoDragStart(event,'+')" style="padding:8px 14px;background:#f3f4f6;color:#374151;border:2px solid #e5e7eb;border-radius:8px;cursor:pointer;font-size:12.5px;font-weight:700;">➕ Somar</button>
        <button class="_cte-acao-btn" data-acao="-" onclick="_cteClicarAcao('-')" draggable="true" ondragstart="_cteAcaoDragStart(event,'-')" style="padding:8px 14px;background:#f3f4f6;color:#374151;border:2px solid #e5e7eb;border-radius:8px;cursor:pointer;font-size:12.5px;font-weight:700;">➖ Subtrair</button>
        <button class="_cte-acao-btn" data-acao="*" onclick="_cteClicarAcao('*')" draggable="true" ondragstart="_cteAcaoDragStart(event,'*')" style="padding:8px 14px;background:#f3f4f6;color:#374151;border:2px solid #e5e7eb;border-radius:8px;cursor:pointer;font-size:12.5px;font-weight:700;">✖️ Multiplicar</button>
        <button class="_cte-acao-btn" data-acao="/" onclick="_cteClicarAcao('/')" draggable="true" ondragstart="_cteAcaoDragStart(event,'/')" style="padding:8px 14px;background:#f3f4f6;color:#374151;border:2px solid #e5e7eb;border-radius:8px;cursor:pointer;font-size:12.5px;font-weight:700;">➗ Dividir</button>
        <span style="width:1px;background:#e5e7eb;margin:2px 2px;"></span>
        <button class="_cte-acao-btn" data-acao=">" onclick="_cteClicarAcao('&gt;')" draggable="true" ondragstart="_cteAcaoDragStart(event,'&gt;')" style="padding:8px 14px;background:#f3f4f6;color:#92400e;border:2px solid #fde68a;border-radius:8px;cursor:pointer;font-size:12.5px;font-weight:700;" title="Usar pra montar uma condição">&gt; Maior que</button>
        <button class="_cte-acao-btn" data-acao="<" onclick="_cteClicarAcao('&lt;')" draggable="true" ondragstart="_cteAcaoDragStart(event,'&lt;')" style="padding:8px 14px;background:#f3f4f6;color:#92400e;border:2px solid #fde68a;border-radius:8px;cursor:pointer;font-size:12.5px;font-weight:700;" title="Usar pra montar uma condição">&lt; Menor que</button>
        <button class="_cte-acao-btn" data-acao="==" onclick="_cteClicarAcao('==')" draggable="true" ondragstart="_cteAcaoDragStart(event,'==')" style="padding:8px 14px;background:#f3f4f6;color:#92400e;border:2px solid #fde68a;border-radius:8px;cursor:pointer;font-size:12.5px;font-weight:700;" title="Usar pra montar uma condição">== Igual</button>
        <button class="_cte-acao-btn" data-acao=">=" onclick="_cteClicarAcao('&gt;=')" draggable="true" ondragstart="_cteAcaoDragStart(event,'&gt;=')" style="padding:8px 14px;background:#f3f4f6;color:#92400e;border:2px solid #fde68a;border-radius:8px;cursor:pointer;font-size:12.5px;font-weight:700;" title="Usar pra montar uma condição">&gt;= Maior ou igual</button>
        <button class="_cte-acao-btn" data-acao="<=" onclick="_cteClicarAcao('&lt;=')" draggable="true" ondragstart="_cteAcaoDragStart(event,'&lt;=')" style="padding:8px 14px;background:#f3f4f6;color:#92400e;border:2px solid #fde68a;border-radius:8px;cursor:pointer;font-size:12.5px;font-weight:700;" title="Usar pra montar uma condição">&lt;= Menor ou igual</button>
      </div>
      <div style="font-size:12.5px;color:#1e40af;font-weight:700;margin-bottom:6px;">2. Campos disponíveis (arraste para a área abaixo):</div>
      <div id="wCteCamposPalette" style="display:flex;flex-wrap:wrap;gap:6px;padding:10px;border:1.5px dashed #d1d5db;border-radius:8px;margin-bottom:10px;max-height:170px;overflow-y:auto;">${chipsHtml}</div>
      <div style="background:#fdf2f8;border:1.5px solid #f9a8d4;border-radius:8px;padding:10px 12px;margin-bottom:10px;">
        <label style="display:flex;align-items:center;gap:6px;font-size:12px;color:#9d174d;cursor:pointer;font-weight:800;text-transform:uppercase;letter-spacing:.3px;">
          <input type="checkbox" id="wCteOutrosValoresCheck" onchange="_cteToggleOutrosValores(this.checked)"> Utiliza Valores outros (campos personalizados)?
        </label>
        <div id="wCteOutrosValoresWrap" style="display:none;margin-top:8px;">
          <input type="text" id="wCteOutrosValoresInput" oninput="_cteRenderPalette()" placeholder="coloque aqui o nome interno dos campos separados por vírgula" style="width:100%;padding:7px 10px;border:1.5px solid #f9a8d4;border-radius:6px;font-size:12px;font-family:monospace;background:white;color:#9d174d;">
          <div id="wCteOutrosValoresChips" style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;max-height:70px;overflow-y:auto;"></div>
        </div>
      </div>
      <div style="font-size:11px;color:#6b7280;margin-bottom:6px;">Ou digite um valor numérico (ex: 100, 0.02) e arraste-o pra área de montagem — útil pra dividir/multiplicar um campo por um número fixo:</div>
      <div style="display:flex;gap:8px;align-items:center;">
        <input type="text" id="wCteValorInput" inputmode="decimal" placeholder="Ex: 100" oninput="_cteValorInputChange()" style="width:110px;padding:7px 10px;border:1.5px solid #d1d5db;border-radius:6px;font-size:12px;font-family:monospace;">
        <span id="wCteValorChip" draggable="true" ondragstart="_cteValorDragStart(event)" style="display:inline-flex;align-items:center;gap:4px;padding:7px 12px;background:#fff7ed;border:1.5px solid #fdba74;border-radius:16px;font-size:12px;font-family:monospace;cursor:not-allowed;user-select:none;color:#9a3412;opacity:.4;transition:opacity .15s;">🔢 Arrastar valor</span>
      </div>
    </div>
    <div class="wizard-section" style="border:none;">
      <div style="font-size:12.5px;color:#1e40af;font-weight:700;margin-bottom:6px;">3. Área de montagem — arraste um campo (ou valor) sobre outro pra combinar com a ação selecionada:</div>
      <div id="wCteBlocosContainer"></div>
      <button onclick="_cteAdicionarBloco()" style="width:100%;padding:8px;background:white;border:1.5px dashed #3b82f6;border-radius:8px;color:#1e40af;cursor:pointer;font-size:12.5px;font-weight:700;margin-bottom:12px;">➕ Definir mais um campo</button>
      <div id="wCteExtrasContainer"></div>
      <div style="font-size:11px;color:#6b7280;margin-bottom:6px;">Prévia da regra (uma linha por campo definido):</div>
      <div id="wCteRegraPreview" style="padding:8px 10px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;font-family:monospace;font-size:11.5px;color:#374151;margin-bottom:10px;white-space:pre-wrap;word-break:break-all;">// defina um campo (nome + arraste algo pra área de montagem)</div>
      <div style="display:flex;gap:8px;">
        <button onclick="_cteLimparCanvas()" style="padding:8px 14px;background:#fef2f2;color:#991b1b;border:1.5px solid #fecaca;border-radius:8px;cursor:pointer;font-size:12.5px;font-weight:600;">🗑️ Limpar tudo</button>
        <button id="wCteBtnGerar" onclick="_cteGerarRegraCustom()" style="flex:1;padding:8px 14px;background:#3b82f6;color:white;border:none;border-radius:8px;cursor:pointer;font-size:13px;font-weight:700;">🚀 Gerar Regra Montada</button>
      </div>
    </div>
  `;
}
function _cteSelecionarAcao(acao){
    window._cteAcaoSel=acao;
    document.querySelectorAll('._cte-acao-btn').forEach(b=>{
        const ativo=b.dataset.acao===acao;
        b.style.background=ativo?'var(--primary)':'#f3f4f6';
        b.style.color=ativo?'white':'#374151';
        b.style.borderColor=ativo?'var(--primary)':'#e5e7eb';
    });
    // Atualiza também o selo "Ação ativa"/aviso dentro dos quadros de soltar -- sem isso, clicar
    // no botão (em vez de arrastar) deixava o selo desatualizado, já que só o clique não redesenha
    // os blocos sozinho.
    if(document.getElementById('wCteBlocosContainer'))_cteRenderBlocos();
}
// Só no CLIQUE: clicar na ação que já está ativa desmarca ela (volta pra nenhuma selecionada).
// Arrastar a mesma ação de novo não desmarca -- continua só selecionando, sem alternar.
function _cteClicarAcao(acao){
    _cteSelecionarAcao(window._cteAcaoSel===acao?null:acao);
}
// Arrastar uma ação (em vez de clicar) tem o MESMO efeito de _cteSelecionarAcao -- só ativa ela
// (destaca na fileira) pro próximo campo/valor arrastado usar. Os handlers de drop (canvas,
// condição, destino) reconhecem o prefixo "acao:" e chamam _cteSelecionarAcao direto, em vez de
// tentar montar um termo com isso.
function _cteAcaoDragStart(e,acao){
    e.dataTransfer.setData('text/plain','acao:'+acao);
    e.dataTransfer.effectAllowed='copy';
}
function _cteDragStart(e){
    e.dataTransfer.setData('text/plain','campo:'+e.target.dataset.campo);
    e.dataTransfer.effectAllowed='copy';
}
function _cteValorInputChange(){
    const val=(document.getElementById('wCteValorInput')?.value||'').trim();
    const chip=document.getElementById('wCteValorChip');
    if(!chip)return;
    const valido=val!==''&&!isNaN(Number(val.replace(',','.')));
    chip.style.opacity=valido?'1':'.4';
    chip.style.cursor=valido?'grab':'not-allowed';
}
function _cteValorDragStart(e){
    const val=(document.getElementById('wCteValorInput')?.value||'').trim();
    const norm=val.replace(',','.');
    if(!val||isNaN(Number(norm))){e.preventDefault();return;}
    e.dataTransfer.setData('text/plain','valor:'+norm);
    e.dataTransfer.effectAllowed='copy';
}
function _cteRenderBlocos(){
    const cont=document.getElementById('wCteBlocosContainer');
    if(!cont)return;
    cont.innerHTML=window._cteBlocos.map((bloco,idx)=>{
        let canvasConteudo;
        if(bloco.termos&&bloco.termos.length){
            canvasConteudo=bloco.termos.map((t,tIdx)=>{
                const sep=tIdx>0?`<span style="font-size:11.5px;color:#2563eb;font-weight:700;margin:0 3px;">${escapeHtml(_ACAO_NOMES[t.acao]||t.acao||'')}</span>`:'';
                const label=_termoParaLabel(t.termo);
                const daTabela=_ehCampoTabelaPrecos(t.termo), daCte=_ehCampoCte(t.termo), daOutros=_ehCampoOutrosValores(t.termo);
                const corBorda=daOutros?'#f9a8d4':daTabela?'#fbbf24':daCte?'#86efac':'#93c5fd', corFundo=daOutros?'#fdf2f8':daTabela?'#fffbeb':daCte?'#f0fdf4':'white', corTexto=daOutros?'#9d174d':daTabela?'#92400e':daCte?'#166534':'#1e40af', corX=daOutros?'#be185d':daTabela?'#b45309':daCte?'#15803d':'#2563eb';
                return `${sep}<span title="${escapeHtml(t.termo)}" style="display:inline-flex;align-items:center;gap:3px;padding:3px 4px 3px 9px;margin:2px 0;background:${corFundo};border:1px solid ${corBorda};border-radius:12px;font-size:11.5px;font-family:monospace;color:${corTexto};">${escapeHtml(label)}<button onclick="_cteRemoverTermo(${idx},${tIdx})" title="Remover este item" style="border:none;background:none;color:${corX};cursor:pointer;font-size:13px;padding:0 4px;line-height:1;font-weight:700;">✕</button></span>`;
            }).join('')+_acaoPreviaTrailingHtml(window._cteAcaoSel,'#2563eb');
        }else if(bloco.expr){
            canvasConteudo=`<span style="font-family:monospace;font-size:12.5px;color:#1e40af;word-break:break-all;">${escapeHtml(bloco.expr)}</span>`;
        }else{
            canvasConteudo=`<span style="color:#9ca3af;font-size:12px;">Arraste campos aqui</span>`;
        }
        const btnLimparExpr=bloco.expr
            ?`<div style="text-align:right;margin-top:4px;"><button onclick="_cteLimparExprBloco(${idx})" title="Remover tudo o que foi arrastado aqui (mantém o nome do campo)" style="padding:3px 8px;background:none;border:1px dashed #93c5fd;border-radius:6px;color:#2563eb;cursor:pointer;font-size:10.5px;">🧹 limpar o que foi arrastado</button></div>`
            :'';
        const btnRemover=window._cteBlocos.length>1
            ?`<button onclick="_cteRemoverBloco(${idx})" title="Remover esta definição" style="padding:7px 10px;background:#fef2f2;color:#991b1b;border:1.5px solid #fecaca;border-radius:6px;cursor:pointer;font-size:12px;">🗑️</button>`
            :'';
        let condSecao=`<label style="display:flex;align-items:center;gap:6px;font-size:11px;color:#92400e;cursor:pointer;margin:6px 0 8px;">
                <input type="checkbox" ${idx===0?'data-tour="condicao"':''} ${bloco.temCondicao?'checked':''} onchange="_cteToggleCondicao(${idx},this.checked)"> Definir condição?
            </label>`;
        if(bloco.temCondicao){
            const condTermos=(bloco.condicao&&bloco.condicao.termos)||[];
            const condConteudo=condTermos.length
                ?condTermos.map((t,tIdx)=>{
                    const sep=tIdx>0?`<span style="font-size:11.5px;color:#b45309;font-weight:700;margin:0 3px;">${escapeHtml(_ACAO_NOMES[t.acao]||t.acao||'')}</span>`:'';
                    const label=_termoParaLabel(t.termo);
                    const daTabela=_ehCampoTabelaPrecos(t.termo), daCte=_ehCampoCte(t.termo), daOutros=_ehCampoOutrosValores(t.termo);
                    const corBorda=daOutros?'#f9a8d4':daTabela?'#fbbf24':daCte?'#86efac':'#fcd34d', corFundo=daOutros?'#fce7f3':daTabela?'#fef3c7':daCte?'#dcfce7':'white', corTexto=daOutros?'#9d174d':daCte?'#166534':'#92400e', corX=daOutros?'#be185d':daCte?'#15803d':'#b45309';
                    return `${sep}<span title="${escapeHtml(t.termo)}" style="display:inline-flex;align-items:center;gap:3px;padding:3px 4px 3px 9px;margin:2px 0;background:${corFundo};border:1px solid ${corBorda};border-radius:12px;font-size:11.5px;font-family:monospace;color:${corTexto};">${escapeHtml(label)}<button onclick="_cteRemoverTermoCondicao(${idx},${tIdx})" title="Remover este item" style="border:none;background:none;color:${corX};cursor:pointer;font-size:13px;padding:0 4px;line-height:1;font-weight:700;">✕</button></span>`;
                }).join('')+_acaoPreviaTrailingHtml(window._cteAcaoSel,'#b45309')
                :`<span style="color:#b45309;font-size:12px;">Arraste campos aqui pra montar a condição</span>`;
            condSecao+=`<div style="margin:0 0 10px;padding-left:8px;border-left:3px solid #fbbf24;">
                <div style="font-size:10.5px;color:#92400e;margin-bottom:4px;">Condição — SE isso for verdade, o campo é definido:</div>
                <div ondragover="_cteCanvasDragOver(event)" ondrop="_cteCondicaoDrop(event,${idx})" style="position:relative;min-height:44px;padding:8px;border:1.5px dashed #f59e0b;border-radius:8px;background:#fffbeb;display:flex;align-items:center;flex-wrap:wrap;">
                    ${_acaoBadgeHtml(window._cteAcaoSel,'#fbbf24','#92400e')}
                    ${condConteudo}
                </div>
            </div>`;
        }
        return `<div style="border:1.5px solid #e5e7eb;border-radius:8px;padding:10px;margin-bottom:10px;">
            <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px;">
                <label style="font-size:11px;color:#374151;white-space:nowrap;">Campo a definir:</label>
                <input type="text" value="${escapeHtml(_termoParaLabel(bloco.destino))}" title="${escapeHtml(bloco.destino)}" placeholder="digite ou arraste um campo aqui"
                    ondragover="_cteDestinoDragOver(event)" ondrop="_cteDestinoDrop(event,${idx})" oninput="_cteDestinoInput(event,${idx})"
                    style="flex:1;padding:7px 10px;border:1.5px solid #3b82f6;border-radius:6px;font-size:12px;font-family:monospace;background:#eff6ff;color:#1e40af;font-weight:600;outline:none;">
                ${btnRemover}
            </div>
            ${condSecao}
            <div ondragover="_cteCanvasDragOver(event)" ondrop="_cteCanvasDrop(event,${idx})" style="position:relative;min-height:50px;padding:10px;border:1.5px dashed #3b82f6;border-radius:8px;background:#eff6ff;display:flex;align-items:center;flex-wrap:wrap;">
                ${_acaoBadgeHtml(window._cteAcaoSel,'#93c5fd','#1e40af')}
                ${canvasConteudo}
            </div>
            ${btnLimparExpr}
        </div>`;
    }).join('');
    _cteRenderExtras();
    _cteAtualizarPreview();
}
function _cteCanvasDragOver(e){e.preventDefault();e.dataTransfer.dropEffect='copy';}
function _cteCanvasDrop(e,idx){
    e.preventDefault();
    const raw=e.dataTransfer.getData('text/plain');
    if(!raw)return;
    if(raw.startsWith('acao:')){ _cteSelecionarAcao(raw.slice(5)); _cteRenderBlocos(); return; }
    const termo=_fatTermoParaExpressao(raw);
    if(termo===null)return;
    const bloco=window._cteBlocos[idx];
    _seedTermosBase(bloco);
    if(bloco.termos.length&&!window._cteAcaoSel){ alert('Selecione uma ação antes de arrastar outro campo.'); return; }
    bloco.termos.push({termo, acao: bloco.termos.length?window._cteAcaoSel:null});
    _recalcExprDeTermos(bloco);
    _cteRenderBlocos();
}
// Liga/desliga a condição de um campo — ao ligar, cria a área de montagem da condição (vazia se
// for a primeira vez); ao desligar, só esconde (não perde o que já tinha montado, caso reative).
function _cteToggleCondicao(idx,marcado){
    const bloco=window._cteBlocos[idx];
    if(!bloco)return;
    bloco.temCondicao=marcado;
    if(marcado&&!bloco.condicao)bloco.condicao={termos:[],expr:null};
    _cteRenderBlocos();
}
// Arrastar campo/valor pra área de montagem da CONDIÇÃO (mesmo mecanismo do valor, só que guarda
// em bloco.condicao ao invés de no próprio bloco) — usa a mesma ação selecionada (>, <, ==, etc.).
function _cteCondicaoDrop(e,idx){
    e.preventDefault();
    const raw=e.dataTransfer.getData('text/plain');
    if(!raw)return;
    if(raw.startsWith('acao:')){ _cteSelecionarAcao(raw.slice(5)); _cteRenderBlocos(); return; }
    const termo=_fatTermoParaExpressao(raw);
    if(termo===null)return;
    const bloco=window._cteBlocos[idx];
    if(!bloco.condicao)bloco.condicao={termos:[],expr:null};
    if(bloco.condicao.termos.length&&!window._cteAcaoSel){ alert('Selecione uma ação antes de arrastar outro campo.'); return; }
    bloco.condicao.termos.push({termo, acao: bloco.condicao.termos.length?window._cteAcaoSel:null});
    _recalcExprDeTermos(bloco.condicao);
    _cteRenderBlocos();
}
function _cteRemoverTermoCondicao(idx,termoIdx){
    const bloco=window._cteBlocos[idx];
    if(!bloco||!bloco.condicao||!bloco.condicao.termos)return;
    bloco.condicao.termos.splice(termoIdx,1);
    _recalcExprDeTermos(bloco.condicao);
    _cteRenderBlocos();
}
function _cteDestinoDragOver(e){e.preventDefault();e.dataTransfer.dropEffect='copy';}
function _cteDestinoDrop(e,idx){
    e.preventDefault();
    const raw=e.dataTransfer.getData('text/plain');
    if(!raw)return;
    if(raw.startsWith('acao:')){ _cteSelecionarAcao(raw.slice(5)); _cteRenderBlocos(); return; }
    const nome=raw.startsWith('campo:')?raw.slice(6):raw.startsWith('valor:')?raw.slice(6):raw;
    window._cteBlocos[idx].destino=nome;
    _cteRenderBlocos();
}
function _cteDestinoInput(e,idx){
    window._cteBlocos[idx].destino=_labelParaTermoInterno(e.target.value);
    _cteAtualizarPreview();
}
function _cteAdicionarBloco(){
    window._cteBlocos.push({destino:'',expr:null});
    _cteRenderBlocos();
}
function _cteRemoverBloco(idx){
    if(window._cteBlocos.length<=1)return;
    window._cteBlocos.splice(idx,1);
    _cteRenderBlocos();
}
// Remove só um item arrastado dentro do campo (idx = bloco, termoIdx = posição do item na área de
// montagem) — o resto do que já estava montado nesse campo continua intacto, sem perder tudo.
function _cteRemoverTermo(idx,termoIdx){
    const bloco=window._cteBlocos[idx];
    if(!bloco||!bloco.termos)return;
    bloco.termos.splice(termoIdx,1);
    _recalcExprDeTermos(bloco);
    _cteRenderBlocos();
}
// Limpa só o que foi arrastado num campo (mantém o nome do "Campo a definir" e os demais campos).
function _cteLimparExprBloco(idx){
    const bloco=window._cteBlocos[idx];
    if(!bloco)return;
    bloco.expr=null;
    bloco.termos=[];
    _cteRenderBlocos();
}
// Linhas "extras" vêm de uma regra colada/pré-definida carregada no canvas (ver _parseRegraParaBlocos)
// que não cabem no modelo campo=expressão (chamada de método, bloco if) — mostradas como estão,
// só de leitura, com a posição onde entram na regra final (antes de qual campo, ou no final).
function _cteRenderExtras(){
    const cont=document.getElementById('wCteExtrasContainer');
    if(!cont)return;
    const extras=window._cteExtras||[];
    const visiveis=extras.map((ex,idx)=>({ex,idx,texto:_semLinhasComentario(ex.linha)})).filter(({texto})=>texto);
    if(!visiveis.length){ cont.innerHTML=''; return; }
    cont.innerHTML=visiveis.map(({ex,idx,texto})=>{
        const posLabel=ex.antesDe?`executa antes de definir <b>"${escapeHtml(ex.antesDe)}"</b>`:'executa no final da regra';
        return `<div style="border:1.5px dashed #f59e0b;border-radius:8px;padding:8px 10px;margin-bottom:8px;background:#fffbeb;">
            <div style="font-size:10.5px;color:#92400e;margin-bottom:4px;">⚡ Linha extra da regra original (mantida como está — ${posLabel}):</div>
            <pre style="margin:0 0 6px;font-family:monospace;font-size:11.5px;color:#78350f;white-space:pre-wrap;word-break:break-all;">${escapeHtml(texto)}</pre>
            <button onclick="_cteRemoverExtra(${idx})" style="padding:4px 10px;background:#fef2f2;color:#991b1b;border:1px solid #fecaca;border-radius:6px;cursor:pointer;font-size:11px;">🗑️ Remover esta linha</button>
        </div>`;
    }).join('');
}
function _cteRemoverExtra(idx){
    if(!window._cteExtras)return;
    const [removida]=window._cteExtras.splice(idx,1);
    // A base das opções "monte com um clique" também esquece a linha removida — senão marcar/desmarcar uma opção (ou mudar o número da
    // redução) a traria de volta na regra logo em seguida.
    const base=window._cteOpcionaisBase;
    if(removida&&base&&base.extras){
        const i=base.extras.findIndex(e=>e.linha===removida.linha&&e.antesDe===removida.antesDe);
        if(i!==-1)base.extras.splice(i,1);
    }
    _cteRenderExtras();
    _cteAtualizarPreview();
    _cteSincronizarEntradasOpcao();   // o aviso de "outra definição numa linha extra" (ver CTE_OPCOES_MONTAGEM › conflitoCampo) pode ter deixado de valer
}
function _cteLinhasValidas(){
    const extras=window._cteExtras||[];
    const usadas=new Set(); // evita repetir a mesma extra quando 2 campos têm o mesmo nome (comum
    // no Ct-e, ex.: "baseCalculo" definido condicionalmente duas vezes) — cada extra só entra uma
    // vez, na primeira ocorrência ainda não usada daquele nome, na ordem em que apareciam na regra.
    const linhas=[];
    window._cteBlocos.forEach(b=>{
        if(b.destino&&b.destino.trim()){
            const idxExtra=extras.findIndex((ex,i)=>!usadas.has(i)&&ex.antesDe===b.destino.trim());
            if(idxExtra!==-1){ linhas.push(extras[idxExtra].linha); usadas.add(idxExtra); }
        }
        if(b.destino&&b.destino.trim()&&b.expr){
            const linhaDef=`def("${b.destino.trim()}", ${b.expr});`;
            if(b.temCondicao&&b.condicao&&b.condicao.expr){
                linhas.push(`if (${b.condicao.expr}) {`);
                linhas.push(`    ${linhaDef}`);
                linhas.push(`}`);
            }else{
                linhas.push(linhaDef);
            }
        }
    });
    // Sobrou alguma extra sem usar (era pra ir no final, ou o campo que ela precedia foi
    // renomeado/removido) — entra no final da regra de qualquer forma, nada fica de fora.
    extras.forEach((ex,i)=>{ if(!usadas.has(i)) linhas.push(ex.linha); });
    return linhas;
}
function _cteAtualizarPreview(){
    const linhas=_cteLinhasValidas();
    const preview=document.getElementById('wCteRegraPreview');
    if(preview)preview.textContent=linhas.length?linhas.join('\n'):'// defina um campo (nome + arraste algo pra área de montagem)';
    if(typeof _cnAtualizarAvisoIcms==='function')_cnAtualizarAvisoIcms(linhas);   // "Nova Versão": avisa na hora se a regra montada altera o valor do ICMS (no clássico não faz nada)
}
function _cteLimparCanvas(){
    window._cteBlocos=[{destino:'',expr:null}];
    window._cteExtras=[];
    window._cteOpcionaisBase=null; _cteDesmarcarOpcionais();
    const colar=document.getElementById('wCteColarRegra');
    if(colar)colar.value='';
    _cteRenderBlocos();
}
function _cteGerarRegraCustom(){
    const linhas=_cteLinhasValidas();
    if(linhas.length===0){alert('Defina ao menos um campo: dê um nome e arraste ao menos um campo pra área de montagem dele.');return;}
    if(typeof _cnBloqueiaReducaoIcms==='function'&&_cnBloqueiaReducaoIcms({soCodigo:true}))return;   // "Nova Versão": não gera regra que altere o valor do ICMS (no clássico não faz nada)
    _renderizarCardRegraCteDndSemIA(linhas.join('\n'));
}
// Ao escolher uma regra pré-definida, ao invés de já gerar o resultado final, preenche o canvas
// com os campos/definições dela — o usuário parte dessa base pronta e edita/adiciona o que precisar.
// Chave da regra pré-definida -> id da opção (checkbox, ver CTE_OPCOES_MONTAGEM) que já vem
// marcada ao selecioná-la — as 3 variações "REGRA BASE PARA: ..." usam o MESMO código
// (_CTE_CODIGO_REGRA_BASE) e só diferem em qual delas já vem ativa.
const CTE_REGRA_PRE_OPCAO={
    regra_base_icms_demo:['frete_tonelada','icms_demonstrativo'],
    regra_base_icms_inverso:['frete_tonelada','icms_inverso'],
    regra_base_icms_somar:['frete_tonelada','icms_somar']
};
function _cteUsarPredefinida(chave){
    const codigo=REGRAS_PREDEFINIDAS_CODE[chave];
    if(!codigo)return;
    const colar=document.getElementById('wCteColarRegra');
    if(colar)colar.value=codigo; // mantém o campo de colar em sincronia com o que foi carregado
    const {blocos,extras}=_parseRegraParaBlocos(codigo);
    window._cteBlocos=(blocos.length?blocos:[{destino:'',expr:null}]).map(_seedTermosBase);
    window._cteExtras=extras;
    window._cteOpcionaisBase=null; _cteDesmarcarOpcionais();
    const opcoesPreMarcadas=(CTE_REGRA_PRE_OPCAO[chave]||[]).filter(id=>document.getElementById('wCteOpc_'+id));
    if(opcoesPreMarcadas.length){
        opcoesPreMarcadas.forEach(id=>{ document.getElementById('wCteOpc_'+id).checked=true; });
        _cteAplicarOpcionais(); // já mescla as opções marcadas em cima da base recém-carregada e renderiza
    }else{
        _cteRenderBlocos();
    }
    const cont=document.getElementById('wCteBlocosContainer');
    if(cont)cont.scrollIntoView({behavior:'smooth',block:'nearest'});
}
// Campo "colar regra existente" — a cada edição (colar, digitar, apagar), reprocessa o texto e
// já monta os campos/definições na área de montagem, ao vivo, sem precisar clicar em nada.
function _cteColarRegraInput(){
    const texto=(document.getElementById('wCteColarRegra')?.value||'').trim();
    if(!texto){
        window._cteBlocos=[{destino:'',expr:null}];
        window._cteExtras=[];
        _cteRenderBlocos();
        return;
    }
    const {blocos,extras}=_parseRegraParaBlocos(texto);
    window._cteBlocos=(blocos.length?blocos:[{destino:'',expr:null}]).map(_seedTermosBase);
    window._cteExtras=extras;
    window._cteOpcionaisBase=null; _cteDesmarcarOpcionais();
    _cteRenderBlocos();
}
// Desmarca as opções (checkbox) de "monte com um clique" e esquece a base salva pra elas — chamado
// sempre que o canvas é substituído por inteiro (regra pré-definida, colar regra, limpar), pra não
// deixar um checkbox marcado "mentindo" sobre o que está na área de montagem.
function _cteDesmarcarOpcionais(){
    document.querySelectorAll('.wCteOpcCheckbox').forEach(c=>{c.checked=false;});
    document.querySelectorAll('input[id^="wCteOpcEntrada_"]').forEach(i=>{i.value='';});   // os campos de valor das opções (ex.: % de redução) voltam em branco junto
    _cteSincronizarEntradasOpcao();
}
// Chamado ao clicar em qualquer checkbox de "monte com um clique" — no máximo 1 marcado por
// grupo (ex.: só pode ter 1 jeito de calcular o valorFrete ativo por vez), pra não correr o risco
// de marcar 2 opções que mexem no mesmo campo sem querer e quebrar o cálculo. Continua sendo
// possível deixar um grupo inteiro sem nada marcado (clicando de novo desmarca), já que isso aqui
// é sempre opcional.
function _cteOpcaoClicada(chk){
    if(chk.checked){
        document.querySelectorAll('.wCteOpcCheckbox[data-grupo="'+chk.dataset.grupo+'"]').forEach(irmao=>{
            if(irmao!==chk) irmao.checked=false;
        });
    }
    _cteAplicarOpcionais();
    // opção que pede um número (ex.: % de redução): ao marcar, o cursor já cai no campo
    if(chk.checked){ const inp=document.getElementById('wCteOpcEntrada_'+chk.id.replace('wCteOpc_','')); if(inp) inp.focus(); }
}
// ── Opções que pedem um número (ex.: "Redução Base de cálculo?" -> % de redução, de 0 a 100) ──
// HTML do campo de valor que aparece embaixo da caixinha (escondido até a opção ser marcada).
function _cteEntradaOpcaoHtml(item){
    const e=item.entrada;
    return `<div id="wCteOpcEntradaWrap_${item.id}" style="display:none;margin:0 0 6px 30px;">
        <div style="display:flex;align-items:center;gap:6px;">
            <input type="text" id="wCteOpcEntrada_${item.id}" inputmode="decimal" autocomplete="off" maxlength="8" aria-label="${escapeHtml(e.rotulo)}" placeholder="${escapeHtml(e.placeholder||'')}" oninput="_cteOpcaoEntradaMudou('${item.id}')" style="width:96px;padding:6px 9px;border:1.5px solid #d1d5db;border-radius:6px;font-size:12px;font-family:monospace;">
            <span style="font-size:12px;color:#374151;font-weight:700;">${escapeHtml(e.sufixo||'')}</span>
        </div>
        <div id="wCteOpcEntradaMsg_${item.id}" role="status" style="font-size:10.5px;line-height:1.35;margin-top:4px;color:#92400e;"></div>
    </div>`;
}
// Número digitado já normalizado (texto com ponto, sem zeros à esquerda) — ou null se o campo estiver vazio, inválido ou fora da faixa.
// Só aceita número simples (até 3 dígitos + até 4 casas, vírgula ou ponto): sem sinal, sem notação científica e sem "020", que no JS seria octal.
function _cteLerEntradaOpcao(item){
    const inp=document.getElementById('wCteOpcEntrada_'+item.id);
    if(!inp||!item.entrada)return null;
    const bruto=String(inp.value||'').trim().replace(',','.');
    if(!/^\d{1,3}(\.\d{1,4})?$/.test(bruto))return null;
    const n=Number(bruto);
    if(!(n>=item.entrada.min&&n<=item.entrada.max))return null;
    return String(n);
}
// Mostra/esconde o campo de valor conforme a caixinha estar marcada e atualiza a mensagem de baixo:
// vazio (âmbar) / inválido (vermelho) / aplicado (verde) / aplicado mas com outra definição do mesmo campo numa "linha extra" (vermelho).
function _cteSincronizarEntradasOpcao(){
    _cteGruposOpcoes().forEach(grupo=>grupo.itens.forEach(item=>{
        if(!item.entrada)return;
        const chk=document.getElementById('wCteOpc_'+item.id), wrap=document.getElementById('wCteOpcEntradaWrap_'+item.id);
        const msg=document.getElementById('wCteOpcEntradaMsg_'+item.id), inp=document.getElementById('wCteOpcEntrada_'+item.id);
        if(!chk||!wrap)return;
        wrap.style.display=chk.checked?'block':'none';
        if(!chk.checked||!msg||!inp)return;
        const e=item.entrada, v=_cteLerEntradaOpcao(item), vazio=!String(inp.value||'').trim();
        let texto, cor;
        if(v!==null){
            texto=e.ok.replace(/\{valor\}/g,v); cor='#166534';
            if(item.conflitoCampo){
                const re=new RegExp('def\\(\\s*["\']'+item.conflitoCampo+'["\']');
                if((window._cteExtras||[]).some(x=>re.test(_semLinhasComentario(x.linha)))){ texto=e.conflito; cor='#b91c1c'; }
            }
        }else if(vazio){ texto=e.vazio; cor='#92400e'; }
        else{ texto=e.invalido; cor='#b91c1c'; }
        msg.textContent=texto; msg.style.color=cor;
        const erro=v===null&&!vazio;
        inp.style.borderColor=erro?'#ef4444':'#d1d5db';
        inp.setAttribute('aria-invalid',erro?'true':'false');
    }));
}
// A cada tecla no campo de valor de uma opção: se ela está marcada, refaz a regra com o número digitado.
function _cteOpcaoEntradaMudou(id){
    const chk=document.getElementById('wCteOpc_'+id);
    if(chk&&chk.checked)_cteAplicarOpcionais();
    else _cteSincronizarEntradasOpcao();
}
// Aplica (mescla) todas as opções marcadas em cima de uma base — a primeira vez que isso roda
// depois de um "canvas novo" (regra pré-definida/colar/limpar), a base é o que estava no canvas
// naquele momento; daí em diante, marcar/desmarcar qualquer checkbox sempre recalcula do zero a
// partir dessa MESMA base + o conjunto atual de marcados — assim o resultado nunca depende da
// ordem em que os checkboxes foram clicados, só de quais estão marcados agora.
function _cteAplicarOpcionais(){
    if(!window._cteOpcionaisBase){
        window._cteOpcionaisBase={blocos:_clonarBlocos(window._cteBlocos||[]), extras:(window._cteExtras||[]).map(e=>({...e}))};
    }
    let blocos=_clonarBlocos(window._cteOpcionaisBase.blocos);
    let extras=window._cteOpcionaisBase.extras.map(e=>({...e}));
    // As opções são aplicadas NA ORDEM desta lista (não na ordem dos cliques): é isso que garante, por exemplo, que a redução da base
    // de cálculo (última do grupo de ICMS) sempre sobreponha o cálculo de ICMS marcado, qualquer que seja a ordem em que foram marcados.
    _cteGruposOpcoes().forEach(grupo=>{
        grupo.itens.forEach(item=>{
            const chk=document.getElementById('wCteOpc_'+item.id);
            if(chk && chk.checked){
                let codigo=item.codigo;
                if(item.entrada){
                    // opção com campo de valor (ex.: % de redução): marcada, mas só entra na regra quando o número digitado for válido
                    const valor=_cteLerEntradaOpcao(item);
                    if(valor===null)return;
                    codigo=codigo.replace(/\{valor\}/g,valor);
                }
                if(item.modo==='somar'){
                    ({blocos,extras}=_aplicarSomaTermo(blocos,extras,item.campoAlvo,item.termoNovo));
                }else if(item.modo==='somarEm'){
                    ({blocos,extras}=_aplicarSomaEmCampo(blocos,extras,item.campoAlvo,item.termoNovo));
                }else if(item.modo==='inserirApos'){
                    ({blocos,extras}=_inserirOpcaoAposAncora(blocos,extras,codigo,item.ancoraDestino,{ancoraUltima:item.ancoraUltima,substituirExistentes:item.substituirExistentes}));
                }else{
                    ({blocos,extras}=_mesclarOpcaoRegra(blocos,extras,codigo,{antesDe:item.antesDe}));
                }
            }
        });
    });
    window._cteBlocos=blocos.length?blocos:[{destino:'',expr:null}];
    window._cteExtras=extras;
    _cteRenderBlocos();
    _cteSincronizarEntradasOpcao();   // campos de valor das opções (aparecem/somem e mostram se o número digitado foi aplicado)
}
// Foto da área de montagem pro botão "Voltar" do cartão da regra gerada. opcionaisBase = a área ANTES das opções "monte com um clique" serem
// aplicadas: guardada pro "Voltar" (sem ela, desmarcar uma opção depois de voltar não conseguiria devolver o que ela tinha sobreposto, ex.: a
// Base de Cálculo original).
function _cteEstadoCanvasParaVoltar(){
    const _opBase=window._cteOpcionaisBase;
    return {acaoSel:window._cteAcaoSel,blocos:_clonarBlocos(window._cteBlocos),extras:(window._cteExtras||[]).map(e=>({...e})),
        opcionaisBase:_opBase?{blocos:_clonarBlocos(_opBase.blocos),extras:(_opBase.extras||[]).map(e=>({...e}))}:null};
}
function _renderizarCardRegraCteDndSemIA(codigo){
    // veio do assistente "Ct-e / Conhecimento Nova Versão" (js/app/regra-cte-passos.js)? Então o "Voltar" reabre ele, na tela em que estava
    const _nova=!!document.getElementById('wizardRegraNovaCard');
    const wCard=document.getElementById('wizardRegraDndCard')||document.getElementById('wizardRegraNovaCard');
    const _estadoForm=wCard?_capturarEstadoForm(wCard):null;
    const _cteExtraVoltar=_cteEstadoCanvasParaVoltar();
    const _extraNova=_nova?{cteNova:{passo:_cnPasso,manualOk:_cnManualOk}}:{};
    if(wCard)wCard.remove();
    _fecharBuilderModal();
    const s=Ferr.stream('regra');
    const c=document.createElement('div');c.className='answer-card';
    const ts=Date.now();
    c.id='_regraResultCard_'+ts;
    window['_regraVoltar_'+ts]={tipo:_nova?'cte-nova':'cte-dnd',query:_wizardRegraDndQuery,estadoForm:_estadoForm,cteExtraDnd:_cteExtraVoltar,..._extraNova};
    const escaped=codigo.replace(/</g,'&lt;').replace(/>/g,'&gt;');
    let h=`<div style="background:#eff6ff;padding:8px 15px;border-bottom:1px solid #bfdbfe;font-size:11px;color:#1e40af;font-weight:600;">📄 Regra de Ct-e — montada sem IA</div>`;
    h+=`<div class="answer-section"><div class="section-content"><div style="position:relative;margin:8px 0;"><pre class="regra-code">${escaped}</pre><button onclick="copiarRegra(this)" style="position:absolute;top:8px;right:8px;background:#313244;color:#a6e3a1;border:none;border-radius:5px;padding:3px 10px;font-size:11px;cursor:pointer;font-weight:600;">📋 Copiar</button></div></div></div>`;
    h+=`<div class="feedback-area"><button onclick="_voltarParaWizardRegra(${ts})" style="display:flex;align-items:center;gap:6px;padding:6px 14px;border:1.5px solid #1e40af;border-radius:8px;background:white;color:#1e40af;cursor:pointer;font-size:13px;font-weight:600;">🔙 Voltar</button>${ferrBotaoNovoHtml('regra')}</div>`;
    c.innerHTML=h;
    s.appendChild(c);
    ferrRolar('regra', true);
    ferrConversa('regra', 'ai',codigo);
    ferrLog('regra', 'Criar Regra Ct-e (montada sem IA)',true);
}
async function enviarWizardRegraDnd(){
    // "Nova Versão": não chama a IA para uma regra que altere o valor do ICMS (nem quando o pedido escrito é reduzir o ICMS) — ver _cnBloqueiaReducaoIcms
    if(document.getElementById('wizardRegraNovaCard')&&typeof _cnBloqueiaReducaoIcms==='function'&&_cnBloqueiaReducaoIcms())return;
    const btn=document.getElementById('wCteBtnEnviar');
    if(btn){btn.disabled=true;btn.textContent='⏳ Gerando...';}
    // Antes só lia o campo "regra existente" (wCteRegraCola) e a descrição — o que já estava
    // montado na área de arrastar campos (via drag, checkboxes "monte com um clique", ou uma
    // regra base carregada) nunca ia pra IA, então ela gerava do zero e esse trabalho se perdia.
    // Agora manda os DOIS: o estado de verdade da área de montagem (_cteLinhasValidas — a mesma
    // fonte usada pelo "Gerar Regra Montada" sem IA) e o campo separado de colar regra (que é um
    // campo à parte, não ligado à área de montagem), com instrução pra IA unir tudo.
    const _nova=!!document.getElementById('wizardRegraNovaCard');   // "Ct-e / Conhecimento Nova Versão" (js/app/regra-cte-passos.js): mesma IA, mesmo pedido
    const regraCola=(document.getElementById('wCteRegraCola')?.value||'').trim();
    const descricao=(document.getElementById('wCteDescricao')?.value||'').trim();
    const canvasTxt=_cteLinhasValidas().join('\n');
    // Na Nova Versão a pessoa informa os campos personalizados do cliente na tela 2, em DOIS grupos que a IA precisa distinguir: os do Ct-e / Contrato de Frete (Tipos Valores Outros,
    // "outros valores" do Ct-e: outrosValores[nome] — a documentação geral abaixo cita outro formato, o do montador usa este) e os da Tabela de Preços (tabelaPrecos.nome, SEM obt).
    const nomesOutros=_nova?_cteNomesOutrosValores():[];
    const nomesTabela=_nova?(window._cteTabelaCustom||[]):[];
    const configTxt=[
        canvasTxt?'REGRA JA MONTADA NA AREA DE ARRASTAR CAMPOS (una com a solicitacao abaixo -- NAO descarte o que ja foi montado, so ajuste/complete conforme pedido):\n'+canvasTxt:'',
        regraCola?'\nREGRA EXISTENTE PARA EDITAR (colada separadamente):\n'+regraCola:'',
        nomesOutros.length?'\nCAMPOS PERSONALIZADOS DO CT-E (Tipos Valores Outros; nomes internos informados pelo usuario): '+nomesOutros.join(', ')+'\nNo Ct-e eles sao "outros valores": para LER use obt("outrosValores[nome]") e para DEFINIR use def("outrosValores[nome]", valor), trocando "nome" pelo nome interno. Isso vale mais que a documentacao geral.':'',
        nomesTabela.length?'\nCAMPOS PERSONALIZADOS DA TABELA DE PRECOS (Tabela de preços Valores Outros; nomes internos informados pelo usuario): '+nomesTabela.join(', ')+'\nSao campos da tabela de precos do cliente: sao lidos SEM obt(), direto na forma tabelaPrecos.nome (ex.: tabelaPrecos.'+nomesTabela[0]+'). NUNCA use obt() nem outrosValores para eles.':'',
        descricao?'\nSOLICITACAO: '+descricao:'',
        _wizardRegraDndQuery?'\nCONTEXTO: '+_wizardRegraDndQuery:''
    ].filter(Boolean).join('\n');
    const sysMsg='Voce e um especialista em regras de Ct-e / Conhecimento do Bsoft TMS.\nGere APENAS o codigo da regra pronto para uso, entre triple backticks.\n\nUNIR REGRA JA MONTADA COM A SOLICITACAO:\nSe a mensagem do usuario tiver uma secao "REGRA JA MONTADA NA AREA DE ARRASTAR CAMPOS", essa e a regra que o usuario ja construiu manualmente (arrastando campos, marcando opcoes, carregando uma regra base) -- ela e o PONTO DE PARTIDA. NUNCA descarte nem reescreva do zero o que ja esta montado. Una com a "SOLICITACAO": mantenha tudo que ja esta la e so adicione, ajuste ou complete exatamente o que foi pedido. O resultado final tem que conter TANTO o que ja estava montado QUANTO o que foi solicitado, numa unica regra coerente.\n\nDEFINICAO DE CAMPOS OCULTOS ($SV):\nPara definir um campo oculto sem gerar erro de "campo nao encontrado", SEMPRE verifique se o elemento existe antes de usar $SV():\nif (document.getElementsByName(\'NOMECAMPO\').length > 0) {\n   $SV(\'NOMECAMPO\', obt("nomeInterno"));\n}\nNUNCA use $SV() direto sem essa verificacao.\n\nCONDICAO BASEADA EM CST (TAMBEM USANDO $SV):\nPara definir uma condicao que depende do CST (Codigo de Situacao Tributaria) do Ct-e, use $SV() dentro do if -- e a UNICA forma que funciona corretamente pra checar o CST, NAO use obt() nem comparacao direta pra isso. Exemplo real (zera aliquota, base de calculo e valor do ICMS quando o CST for 40):\nif ($SV("dados_CST", \'40\'))\ndef("aliquota", 0);\ndef("baseCalculo", 0);\ndef("valorICMS", 0);\nUse sempre esse mesmo padrao -- if ($SV("dados_CST", \'XX\')) -- trocando XX pelo CST desejado, toda vez que a regra precisar de uma condicao baseada em qual CST esta sendo usado.\n\nITERAR SOBRE NOTAS/MERCADORIAS SEM SABER A QUANTIDADE (try/catch):\nPara somar, filtrar ou ajustar algo em cima de cada nota/mercadoria do Ct-e SEM SABER quantas existem (o Ct-e pode ter 1 ou varias notas), percorra os indices de 1 ate um numero alto (ex.: 50) dentro de um try/catch -- o catch simplesmente ignora os indices que nao existem, sem gerar erro nem travar a regra numa quantidade fixa de notas. Exemplo real (desconta do peso as mercadorias da especie 23, seja qual for a quantidade de notas):\npeso = obt("merc_quantKg[]");\nfor (i = 1; i <= 50; i++) {\n   try {\n      if ( obt("merc_especie[" + i + "]") == 23 ) peso = peso - obt("merc_quantKg[" + i + "]");\n   } catch (e) { }\n}\nUse esse padrao sempre que precisar iterar sobre campos indexados (ex.: merc_*[i]) sem travar o resultado a uma quantidade fixa de notas.\n\n'+(_nova&&typeof CN_ICMS_PROMPT!=='undefined'?CN_ICMS_PROMPT:'')+'DOCUMENTACAO:\n'+CONTEXTO_REGRAS;
    const wCard=document.getElementById('wizardRegraDndCard')||document.getElementById('wizardRegraNovaCard');
    const _estadoForm=wCard?_capturarEstadoForm(wCard):null;
    // O "Voltar" da Nova Versão volta com tudo (área de montagem incluída) e na tela em que a pessoa estava; o do montador clássico segue como sempre (só os campos).
    const _voltarNova=_nova?{cteExtraDnd:_cteEstadoCanvasParaVoltar(),cteNova:{passo:_cnPasso,manualOk:_cnManualOk}}:{};
    if(wCard)wCard.remove();
    _fecharBuilderModal();
    ferrMsg('regra', 'system','📄 <strong>Gerando regra de Ct-e...</strong>');
    const ld=ferrCarregando('regra', '📄 Elaborando regra de Ct-e...');
    const li=Date.now();
    try{
        const result=await callMCPSemPensamento([{role:'system',content:sysMsg},{role:'user',content:'Monte a regra conforme a solicitacao abaixo.\n'+configTxt}],{temperature:0.15,maxTokens: REGRAS_MAX_TOKENS});
        ld.remove();
        // Nova Versão: se, mesmo com a trava no pedido, a IA escreveu uma regra que altera o valor do ICMS, o cartão abre com um alerta em cima
        const textoRegra=(_nova&&typeof _cnAvisoIcmsNaResposta==='function')?_cnAvisoIcmsNaResposta(result.text):result.text;
        renderizarCardRegra(textoRegra,li,result._iaUsada,result._iaModelo,_nova?'cte-nova':'cte-dnd',{query:_wizardRegraDndQuery,estadoForm:_estadoForm,..._voltarNova});
        ferrConversa('regra', 'ai',textoRegra);
    }catch(e){
        ld.remove();
        // Nova Versão: o erro traz o "Voltar" (a janela já fechou e a pessoa não pode perder o que montou); o montador clássico segue com a mensagem simples de sempre.
        if(_nova&&typeof _cnCardErroIA==='function')_cnCardErroIA({query:_wizardRegraDndQuery,estadoForm:_estadoForm,..._voltarNova});
        else ferrMsg('regra', 'ai','❌ Erro ao gerar regra. Tente novamente.');
    }
}

function ehCriacaoRegra(query) {
    const q = query.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');
    const padroes = [
        'criar regra','criacao de regra','nova regra','regra de calculo',
        'regra de frete','regra empresa','configurar regra','fazer regra',
        'montar regra','regra calculo','como fazer regra','preciso de regra',
        'preciso criar','quero criar regra','regra icms','regra transporte',
        'calculo de frete regra','calculo inverso icms','simples nacional regra'
    ];
    return padroes.some(p => q.includes(p)) ||
           /criar.{0,20}regra|regra.{0,20}criar|nova.{0,10}regra/.test(q) ||
           /\bregras?\b/.test(q);
}

function mostrarWizardContrato(queryOriginal){
    _wizardContratoQuery=queryOriginal;
    const s=Ferr.stream('regra');
    const wCard=document.getElementById('wizardContratoCard');if(wCard)wCard.remove();
    const card=document.createElement('div');
    card.id='wizardContratoCard';
    card.className='answer-card';
    card.innerHTML=`<div style="background:#f5f3ff;padding:8px 15px;border-bottom:1px solid #ddd6fe;font-size:11px;color:#5b21b6;font-weight:600;">🚛 Assistente — Contrato de Frete</div><div style="padding:12px 15px 4px;"><div class="wizard-section"><div class="wizard-label">📋 Regra existente (opcional)</div><textarea id="wCfRegraCola" class="wizard-textarea" placeholder="Cole aqui a regra existente que deseja editar/modificar..." style="min-height:70px;"></textarea><div style="font-size:11px;color:#6b7280;margin:8px 0 4px;">Ou selecione uma predefinida como base:</div><div style="display:flex;flex-direction:column;gap:3px;"><label class="wizard-radio-label"><input type="radio" name="wCfRegraPre" value="" checked> Nenhuma (criar do zero)</label><label class="wizard-radio-label"><input type="radio" name="wCfRegraPre" value="combinado_motorista"> Combinado Motorista</label><label class="wizard-radio-label"><input type="radio" name="wCfRegraPre" value="combinado_motorista_frete_minimo"> Combinado Motorista — Com alerta e bloqueio abaixo do frete mínimo</label></div></div><div class="wizard-section"><div class="wizard-label">⚙️ Configurações da Regra</div><div class="wizard-subsection"><b>Frete líquido</b><div style="display:flex;flex-direction:column;gap:3px;margin:6px 0 8px;"><label class="wizard-radio-label"><input type="radio" name="wCfFreteOpcao" value="personalizar" checked onchange="wCfToggleFrete(this.value)"> Personalizar descontos</label><label class="wizard-radio-label"><input type="radio" name="wCfFreteOpcao" value="manter" onchange="wCfToggleFrete(this.value)"> Manter da regra existente</label></div><b style="font-size:11px;color:#374151;">Valor total origem, selecionar descontos:</b><div id="wDescontoChecks" style="margin-top:8px;"><div class="wizard-cbx-grid"><label class="wizard-radio-label"><input type="checkbox" name="wCfDesconto" value="outrosDescontos"> Outros Descontos</label><label class="wizard-radio-label"><input type="checkbox" name="wCfDesconto" value="totalDescontoINSS" checked> Valor Desconto INSS</label><label class="wizard-radio-label"><input type="checkbox" name="wCfDesconto" value="totalDescontoSEST" checked> Desconto SEST/SENAT (Valor)</label><label class="wizard-radio-label"><input type="checkbox" name="wCfDesconto" value="descontoIRRF" checked> Desconto IRRF</label><label class="wizard-radio-label"><input type="checkbox" name="wCfDesconto" value="descontoSeguro"> Desconto de Seguro</label><label class="wizard-radio-label"><input type="checkbox" name="wCfDesconto" value="valorPedagio"> Valor de Pedágio</label><label class="wizard-radio-label"><input type="checkbox" name="wCfDesconto" value="valorCombustivel"> Combustível</label></div></div></div></div><div class="wizard-section" style="border:none;"><div class="wizard-label">📝 O que precisa criar/alterar na regra?</div><textarea id="wCfDescricao" class="wizard-textarea" placeholder="Descreva o que necessita que crie ou modifique na regra..." style="min-height:100px;"></textarea></div><div style="padding:12px 15px 20px;"><button id="wCfBtnEnviar" class="wizard-submit" onclick="enviarWizardContrato()">🚀 Gerar Regra com IA</button></div></div>`;
    s.appendChild(card);
    ferrRolar('regra', true);
}

async function enviarWizardContrato(){
    const btn=document.getElementById('wCfBtnEnviar');
    if(btn){btn.disabled=true;btn.textContent='⏳ Gerando...';}
    const regraCola=(document.getElementById('wCfRegraCola')?.value||'').trim();
    const regraPre=document.querySelector('input[name="wCfRegraPre"]:checked')?.value||'';
    const freteOpcao=document.querySelector('input[name="wCfFreteOpcao"]:checked')?.value||'personalizar';
    const descontos=[...document.querySelectorAll('input[name="wCfDesconto"]:checked')].map(c=>c.value);
    const descricao=(document.getElementById('wCfDescricao')?.value||'').trim();
    // Build the valor= line that goes before def("freteLiquido", valor)
    // Se "manter", usa a linha original do predefinido sem aplicar os checkboxes
    const vFreteLiqOriginal='valor =  obt("valorTotalOrigem")  + obt("outrosAcrescimos") - obt("outrosDescontos") - obt("totalDescontoINSS") - obt("totalDescontoSEST")  - obt("descontoIRRF");';
    let vFreteLiq='valor =  obt("valorTotalOrigem")  + obt("outrosAcrescimos")';
    descontos.forEach(d=>{vFreteLiq+=' - obt("'+d+'")';});
    vFreteLiq+=';';
    const vFreteLiqEfetivo=freteOpcao==='manter'?vFreteLiqOriginal:vFreteLiq;
    let configTxt='';
    let sysMsg='';
    if((regraPre==='combinado_motorista'||regraPre==='combinado_motorista_frete_minimo')&&!regraCola){
        const isFreteminimo = regraPre==='combinado_motorista_frete_minimo';
        const regraCompleta=[
            'def("tarifaMotoristaCalculada", 0);',
            'valor = (obt("valorTotalOrigem") * 0.2) * (obt("descontoINSS") / 100)',
            'def("totalDescontoINSS", valor);',
            'valor = (obt("valorTotalOrigem") * 0.2) * (obt("descontoSEST") / 100)',
            'def("totalDescontoSEST", valor);',
            'valorBase = (((obt("valorTotalOrigem"))*0.10)- obt("totalDescontoINSS"));',
            'def("baseCalculoIRRF", valorBase);',
            'IRRF.defineDescontoIRRF();',
            vFreteLiqEfetivo,
            'def("freteLiquido", valor);',
            'valor = obt("freteLiquido")  - obt("descontoQuebraPeso");',
            'def("saldo", valor - obt("valorAdiantamento"));',
            'def("resultado", obt("totalPrestacaoTerceiraAba") - obt("valorTotalOrigem"));',
            ...(isFreteminimo ? [
                'if (obt("valorTotalOrigem") < obt("freteMinimo_valor")) {',
                '    alert("Valor abaixo do frete mínimo, será preenchido com valor do frete mínimo");',
                '    def("valorTotalOrigem", obt("freteMinimo_valor"));',
                '}'
            ] : [])
        ].join('\n');
        const label = isFreteminimo ? 'Combinado Motorista — Com alerta e bloqueio abaixo do frete mínimo' : 'Combinado Motorista';
        configTxt=[
            `CONFIGURACAO (Contrato de Frete — ${label}):`,
            'REGRA COMPLETA OBRIGATORIA — copiar EXATAMENTE linha por linha, sem alterar, adicionar ou remover nada:\n'+regraCompleta,
            descricao?'\nAPLIQUE ALEM DISSO: '+descricao:'',
            _wizardContratoQuery?'\nCONTEXTO: '+_wizardContratoQuery:''
        ].filter(Boolean).join('\n');
        sysMsg='Voce e um especialista em regras de Contrato de Frete do Bsoft TMS.\nREGRA CRITICA: A REGRA COMPLETA OBRIGATORIA deve ser copiada linha por linha EXATAMENTE como esta. Nao altere, adicione nem remova nada. Se houver APLIQUE ALEM DISSO, incorpore as modificacoes mantendo o restante intacto.\nGere APENAS o codigo da regra pronto para uso, entre triple backticks.\n\nDEFINICAO DE CAMPOS OCULTOS ($SV):\nPara definir um campo oculto sem gerar erro de "campo nao encontrado", SEMPRE verifique se o elemento existe antes de usar $SV():\nif (document.getElementsByName(\'NOMECAMPO\').length > 0) {\n   $SV(\'NOMECAMPO\', obt("nomeInterno"));\n}\nNUNCA use $SV() direto sem essa verificacao.\n\nDOCUMENTACAO:\n'+CONTEXTO_CONTRATO_FRETE;
    }else{
        // Generic path: paste existing rule or criar do zero
        if(freteOpcao==='manter'){
            configTxt=[
                'CONFIGURACAO DO USUARIO (Contrato de Frete):',
                '- Frete liquido: MANTER DA REGRA BASE — nao alterar o calculo de freteLiquido existente',
                regraCola?'\nREGRA EXISTENTE PARA EDITAR:\n'+regraCola:'',
                descricao?'\nSOLICITACAO: '+descricao:'',
                _wizardContratoQuery?'\nCONTEXTO: '+_wizardContratoQuery:''
            ].filter(Boolean).join('\n');
        }else{
            const linhas=[];
            if(descontos.includes('totalDescontoINSS')){linhas.push('valor = (obt("valorTotalOrigem") * 0.2) * (obt("descontoINSS") / 100)');linhas.push('def("totalDescontoINSS", valor);');}
            if(descontos.includes('totalDescontoSEST')){linhas.push('valor = (obt("valorTotalOrigem") * 0.2) * (obt("descontoSEST") / 100)');linhas.push('def("totalDescontoSEST", valor);');}
            if(descontos.includes('descontoIRRF')){const inssB=descontos.includes('totalDescontoINSS')?' - obt("totalDescontoINSS")':'';linhas.push('valorBase = (((obt("valorTotalOrigem"))*0.10)'+inssB+');');linhas.push('def("baseCalculoIRRF", valorBase);');linhas.push('IRRF.defineDescontoIRRF();');}
            linhas.push(vFreteLiq);
            linhas.push('def("freteLiquido", valor);');
            const freteLiqBloco=linhas.join('\n');
            configTxt=[
                'CONFIGURACAO DO USUARIO (Contrato de Frete):',
                '- BLOCO FRETE LIQUIDO OBRIGATORIO — incluir EXATAMENTE nessa posicao na regra:\n'+freteLiqBloco,
                regraCola?'\nREGRA EXISTENTE PARA EDITAR:\n'+regraCola:'',
                descricao?'\nSOLICITACAO: '+descricao:'',
                _wizardContratoQuery?'\nCONTEXTO: '+_wizardContratoQuery:''
            ].filter(Boolean).join('\n');
        }
        sysMsg='Voce e um especialista em regras de Contrato de Frete do Bsoft TMS.\nREGRA CRITICA: O BLOCO FRETE LIQUIDO OBRIGATORIO deve ser copiado EXATAMENTE no lugar correto da regra. Nao altere, adicione nem remova linhas desse bloco.\nGere APENAS o codigo da regra pronto para uso, entre triple backticks.\n\nDEFINICAO DE CAMPOS OCULTOS ($SV):\nPara definir um campo oculto sem gerar erro de "campo nao encontrado", SEMPRE verifique se o elemento existe antes de usar $SV():\nif (document.getElementsByName(\'NOMECAMPO\').length > 0) {\n   $SV(\'NOMECAMPO\', obt("nomeInterno"));\n}\nNUNCA use $SV() direto sem essa verificacao.\n\nDOCUMENTACAO:\n'+CONTEXTO_CONTRATO_FRETE;
    }
    const wCard=document.getElementById('wizardContratoCard');
    const _estadoForm=wCard?_capturarEstadoForm(wCard):null;
    if(wCard)wCard.remove();
    ferrMsg('regra', 'system','🚛 <strong>Gerando regra de Contrato de Frete...</strong>');
    const ld=ferrCarregando('regra', '🚛 Elaborando regra de contrato...');
    const li=Date.now();
    try{
        const result=await callMCPSemPensamento([{role:'system',content:sysMsg},{role:'user',content:'Monte a regra conforme as configuracoes abaixo.\n'+configTxt}],{temperature:0.15,maxTokens: REGRAS_MAX_TOKENS});
        ld.remove();
        renderizarCardRegra(result.text,li,result._iaUsada,result._iaModelo,'contrato',{query:_wizardContratoQuery,estadoForm:_estadoForm});
        ferrConversa('regra', 'ai',result.text);
    }catch(e){ld.remove();ferrMsg('regra', 'ai','❌ Erro ao gerar regra. Tente novamente.');}
}

// ─── Contrato de Frete — Montador visual (arrastar e soltar) ───
// Mesma lógica/mecânica do montador de Faturamento, adaptada aos campos de Contrato de Frete.
// Reaproveita _fatTermoParaExpressao (genérica, sem estado próprio) e os helpers de
// captura/restauração de formulário (_capturarEstadoForm/_restaurarEstadoForm/_voltarParaWizardRegra).
// Interpreta um código de regra pronto (linhas def(...), atribuições temporárias "valor = ...",
// chamadas de método, blocos if) e devolve blocos {destino,expr} prontos pro canvas de arrastar —
// usado ao clicar numa regra pré-definida, pra já começar com uma base ao invés do zero.
// Variáveis temporárias (valor=, valorBase=...) são inlinadas direto na expressão do def() que as
// consome (troca de nome por token, com parênteses, exceto quando o def() usa só a variável pura).
// Linhas que não viram um bloco (chamada de método, bloco if) entram em "extras": {antesDe, linha}
// — antesDe é o campo cujo def() vem logo depois (ou null = vai no final) — mantidas como estão,
// coladas na posição certa ao montar a regra final, ao invés de simplesmente descartadas.
// Normaliza aspas tipográficas ("inteligentes"/curvas — comuns ao copiar regra de Word, e-mail,
// chat etc.) para aspas retas comuns antes de qualquer outro parse — sem isso, até o próprio
// def("campo", ...) deixa de ser reconhecido se vier com aspas curvas coladas do sistema de testes.
function _normalizarAspasRegra(codigo){
    if(!codigo)return codigo;
    return codigo
        .replace(/[‘’‚‛]/g,"'")
        .replace(/[“”„‟]/g,'"');
}
// Tenta reconhecer o padrão "if (condição) def(campo, valor);" — com ou sem chaves — como um
// CAMPO CONDICIONAL (o mesmo modelo do checkbox "Definir condição?" da área de montagem), ao
// invés de virar uma linha "extra" sem interação. Só reconhece quando o corpo do if é EXATAMENTE
// um único def() — nada de else, nem mais de uma linha dentro — por segurança: qualquer coisa
// mais complexa (efeito colateral, reatribuição condicional, if/else) continua indo pra "extras",
// preservada como estava, sem risco de montar errado.
// Devolve {campo, valorExpr, condExpr, novoIndex} em caso de sucesso, ou null (chamador cai no
// tratamento padrão de linha/bloco).
function _tentarIfDef(linhas, i){
    const linha=linhas[i].trim();
    const mIf=linha.match(/^if\s*\((.+)\)\s*(\{)?\s*$/);
    if(!mIf)return null;
    const condTexto=mIf[1].trim();
    let corpo, proximoIndex;
    if(mIf[2]){
        // Com chave — junta linhas até achar o fechamento correspondente (só entende 1 nível).
        let j=i+1;
        const corpoLinhas=[];
        let profundidade=1;
        while(j<linhas.length && profundidade>0){
            const l=linhas[j];
            profundidade+=(l.match(/\{/g)||[]).length-(l.match(/\}/g)||[]).length;
            if(profundidade>0){ corpoLinhas.push(l); }
            else{
                const idxFecha=l.lastIndexOf('}');
                const antes=l.slice(0,idxFecha).trim();
                if(antes)corpoLinhas.push(antes);
            }
            j++;
        }
        if(profundidade!==0)return null; // chave nunca fechou — sintaxe incompleta, não arrisca
        const restoMesmaLinha=linhas[j-1].slice(linhas[j-1].lastIndexOf('}')+1).trim();
        if(restoMesmaLinha.startsWith('else'))return null;
        if(linhas[j] && linhas[j].trim().startsWith('else'))return null; // if/else — não mexe
        corpo=corpoLinhas.filter(l=>l.trim()).map(l=>l.trim());
        proximoIndex=j;
    }else{
        // Sem chave — só a próxima linha não vazia é o corpo (uma única declaração).
        let j=i+1;
        while(j<linhas.length && !linhas[j].trim())j++;
        if(j>=linhas.length)return null;
        corpo=[linhas[j].trim()];
        proximoIndex=j+1;
    }
    if(corpo.length!==1)return null; // corpo com mais de 1 linha — não é o padrão simples, não mexe
    const mDefCorpo=corpo[0].match(/^def\(\s*["']([^"']+)["']\s*,\s*(.+)\)\s*;?\s*$/);
    if(!mDefCorpo)return null; // corpo não é um def() — não mexe
    return { campo:mDefCorpo[1], valorExpr:mDefCorpo[2].trim(), condExpr:condTexto, novoIndex:proximoIndex };
}
function _parseRegraParaBlocos(codigo){
    const linhas=_normalizarAspasRegra(codigo||'').split('\n');
    const tempVars={};
    const blocos=[];
    const extras=[];
    let bufferExtra=[];
    let i=0;
    // Troca nomes de variável temporária conhecidos (tempVars) pelo texto da expressão que eles
    // guardam — usado tanto pro valor quanto pra condição de um def()/if(), e também ao GRAVAR uma
    // nova tempVar (assim uma tempVar que usa outra já definida antes fica sempre com o texto já
    // expandido por completo, sem depender de substituição encadeada em múltiplas passadas).
    function substituirTempVars(expr){
        Object.keys(tempVars).forEach(nome=>{
            if(expr===nome){ expr=tempVars[nome]; }
            else{ expr=expr.replace(new RegExp('\\b'+nome+'\\b','g'), '('+tempVars[nome]+')'); }
        });
        return expr;
    }
    while(i<linhas.length){
        const linhaOriginal=linhas[i];
        const linha=linhaOriginal.trim();
        if(!linha){ i++; continue; }
        const mDef=linha.match(/^def\(\s*["']([^"']+)["']\s*,\s*(.+)\)\s*;?\s*$/);
        if(mDef){
            const campo=mDef[1];
            let expr=substituirTempVars(mDef[2].trim());
            expr=expr.replace(/obt\(\s*"([^"]+)"\s*\)/g, "obt('$1')").trim();
            blocos.push({destino:campo, expr});
            if(bufferExtra.length){ extras.push({antesDe:campo, linha:bufferExtra.join('\n')}); bufferExtra=[]; }
            i++; continue;
        }
        // Aceita "nome = valor" e também "var nome = valor" / "let nome = valor" / "const nome =
        // valor" (var é comum nas regras de Ct-e, ex.: "var inverso = ...") — o prefixo é só
        // descartado, o resto funciona igual.
        const mVar=linha.match(/^(?:var\s+|let\s+|const\s+)?(\w+)\s*=\s*(.+?);?\s*$/);
        if(mVar && !linha.startsWith('if')){
            const nome=mVar[1];
            let expr=substituirTempVars(mVar[2].replace(/;$/,'').trim());
            expr=expr.replace(/obt\(\s*"([^"]+)"\s*\)/g, "obt('$1')");
            tempVars[nome]=expr;
            i++; continue;
        }
        // "if (condição) def(campo, valor);" (com ou sem chaves) — tenta reconhecer como campo
        // condicional antes de cair no tratamento genérico de linha/bloco abaixo.
        if(/^if\s*\(/.test(linha)){
            const ifDef=_tentarIfDef(linhas, i);
            if(ifDef){
                let expr=substituirTempVars(ifDef.valorExpr);
                expr=expr.replace(/obt\(\s*"([^"]+)"\s*\)/g, "obt('$1')").trim();
                let condicaoRaw=substituirTempVars(ifDef.condExpr);
                condicaoRaw=condicaoRaw.replace(/obt\(\s*"([^"]+)"\s*\)/g, "obt('$1')").trim();
                blocos.push({destino:ifDef.campo, expr, temCondicao:true, condicaoRaw});
                if(bufferExtra.length){ extras.push({antesDe:ifDef.campo, linha:bufferExtra.join('\n')}); bufferExtra=[]; }
                i=ifDef.novoIndex; continue;
            }
            // Não reconheceu o padrão simples (else, mais de 1 linha no corpo, etc.) — cai no
            // tratamento padrão de bloco/linha abaixo, sem perder nada.
        }
        // Linha não representável no canvas (chamada de método, if/bloco) — guarda como está,
        // consumindo o bloco { ... } inteiro quando a linha abre uma chave.
        if(/\{\s*$/.test(linha)){
            const buf=[linhaOriginal];
            let depth=(linha.match(/\{/g)||[]).length-(linha.match(/\}/g)||[]).length;
            while(depth>0 && i+1<linhas.length){
                i++; buf.push(linhas[i]);
                depth+=(linhas[i].match(/\{/g)||[]).length-(linhas[i].match(/\}/g)||[]).length;
            }
            const blocoTexto=buf.join('\n');
            // Se uma variável temporária já conhecida for reatribuída dentro desse bloco (ex.: um
            // if/else que muda o valor conforme a condição), ela deixa de ser confiável pra
            // substituir em linhas seguintes — o valor real depende da condição, que não dá pra
            // "abrir" com segurança aqui (evita trocar um def() por um valor errado/desatualizado).
            Object.keys(tempVars).forEach(nome=>{
                if(new RegExp('\\b'+nome+'\\s*=(?!=)').test(blocoTexto)) delete tempVars[nome];
            });
            bufferExtra.push(blocoTexto);
        }else{
            bufferExtra.push(linhaOriginal);
        }
        i++;
    }
    if(bufferExtra.length) extras.push({antesDe:null, linha:bufferExtra.join('\n')});
    return {blocos, extras};
}
const CONTRATO_FRETE_CAMPOS=[
    {label:'Tolerância',campo:'tolerancia'},
    {label:'Tarifa do Motorista (calculada)',campo:'tarifaMotoristaCalculada'},
    {label:'Peso de Coleta',campo:'pesoColeta'},
    {label:'Tarifa (kg)',campo:'tarifaMotoristaDigitada'},
    {label:'Valor do Contrato',campo:'valorTotalOrigem'},
    {label:'Diária',campo:'diariaFrete'},
    {label:'Outros Descontos',campo:'outrosDescontos'},
    {label:'Outros Acréscimos',campo:'outrosAcrescimos'},
    {label:'Valor Tonelada',campo:'outrosValoresCF[valorTon]'},
    {label:'Desconto INSS (%)',campo:'descontoINSS'},
    {label:'Valor Desconto INSS',campo:'totalDescontoINSS'},
    {label:'Desconto SEST (%)',campo:'descontoSEST'},
    {label:'Desconto SEST/SENAT (Valor)',campo:'totalDescontoSEST'},
    {label:'Base Cálculo IR',campo:'baseCalculoIRRF'},
    {label:'Desconto IRRF',campo:'descontoIRRF'},
    {label:'Desconto Seguro',campo:'descontoSeguro'},
    {label:'Pedágio',campo:'valorPedagio'},
    {label:'Frete Líquido',campo:'freteLiquido'},
    {label:'Adiantamento',campo:'valorAdiantamento'},
    {label:'Nro. Parcelas',campo:'nroParcelas'},
    {label:'Combustível',campo:'valorCombustivel'},
    {label:'Peso Chegada',campo:'pesoChegada'},
    {label:'Desconto Quebra Peso',campo:'descontoQuebraPeso'},
    {label:'Saldo',campo:'saldo'},
    {label:'Saldo Combustível',campo:'saldoCombustivel'},
    {label:'Complemento',campo:'valorComplemento'},
    {label:'Resultado',campo:'resultado'},
    {label:'Total Prestação (3ª aba)',campo:'totalPrestacaoTerceiraAba'}
];
let _wizardContratoDndQuery='';
function _cfdChip(c,corBorda,corFundo,corTexto){
    return `<span class="_cfd-chip" draggable="true" data-campo="${c.campo}" title="${escapeHtml(c.campo)}" ondragstart="_cfdDragStart(event)" style="display:inline-block;padding:6px 12px;background:${corFundo};border:1.5px solid ${corBorda};border-radius:16px;font-size:12px;cursor:grab;user-select:none;color:${corTexto};">${escapeHtml(c.label)}</span>`;
}
function _cfdNomesOutrosValores(){
    const chk=document.getElementById('wCfdOutrosValoresCheck');
    if(!chk||!chk.checked)return [];
    const raw=document.getElementById('wCfdOutrosValoresInput')?.value||'';
    return raw.split(',').map(s=>s.trim()).filter(Boolean);
}
function _cfdMontarPaletteHtml(){
    return CONTRATO_FRETE_CAMPOS.map(c=>_cfdChip(c,'#d1d5db','white','#374151')).join('');
}
// Chips dos campos personalizados ("Utiliza Valores outros") — ficam numa área PRÓPRIA, logo
// abaixo do campo onde a pessoa acabou de digitar os nomes, sem precisar rolar a paleta grande.
function _cfdMontarChipsOutrosHtml(){
    return _cfdNomesOutrosValores().map(nome=>_cfdChip({label:nome,campo:'outrosValores['+nome+']'},'#f9a8d4','#fdf2f8','#9d174d')).join('');
}
function _cfdRenderPalette(){
    const wrap=document.getElementById('wCfdCamposPalette');
    if(wrap)wrap.innerHTML=_cfdMontarPaletteHtml();
    const chipsOutros=document.getElementById('wCfdOutrosValoresChips');
    if(chipsOutros)chipsOutros.innerHTML=_cfdMontarChipsOutrosHtml();
}
function _cfdToggleOutrosValores(marcado){
    const wrap=document.getElementById('wCfdOutrosValoresWrap');
    if(wrap)wrap.style.display=marcado?'block':'none';
    _cfdRenderPalette();
}
function mostrarWizardContratoDnd(queryOriginal){
    _wizardContratoDndQuery=queryOriginal;
    window._cfdAcaoSel=null;
    window._cfdBlocos=[{destino:'',expr:null}];
    window._cfdExtras=[];
    document.getElementById('builderModalBody').innerHTML='';
    const card=document.createElement('div');
    card.id='wizardContratoDndCard';
    card.className='builder-card';
    const chipsHtml=_cfdMontarPaletteHtml();
    card.innerHTML=`<div style="flex-shrink:0;background:#f5f3ff;padding:10px 15px;border-bottom:1px solid #ddd6fe;font-size:12px;color:#5b21b6;font-weight:700;">🚛 Assistente — Contrato de Frete <span style="font-weight:500;">(arrastar campos)</span></div>
<div class="builder-grid">
  <div class="builder-grid-side">
    <button id="wCfdBtnTutorial" onclick="_iniciarTourBuilder('cfd')" class="tour-btn-abrir">🎓 Ver tutorial passo a passo</button>
    <div class="wizard-section" id="wCfdSecaoColar">
      <div class="wizard-label">📋 Colar regra existente do sistema</div>
      <textarea id="wCfdColarRegra" class="wizard-textarea" placeholder="Cole aqui uma regra já pronta do sistema..." style="min-height:90px;font-family:monospace;font-size:11.5px;" oninput="_cfdColarRegraInput()"></textarea>
      <div style="font-size:10.5px;color:#7c3aed;margin-top:4px;">🔄 A área de montagem ao lado é atualizada automaticamente conforme você cola ou edita aqui.</div>
    </div>
    <div class="wizard-section" id="wCfdSecaoPredefinidas">
      <div class="wizard-label">📋 Regras pré-existentes (padrão)</div>
      <div style="font-size:11px;color:#6b7280;margin-bottom:6px;">Clique pra gerar direto, sem IA:</div>
      <div style="display:flex;flex-direction:column;gap:6px;">
        <button onclick="_cfdUsarPredefinida('combinado_motorista')" style="width:100%;text-align:left;padding:9px 12px;background:#f9fafb;border:1.5px solid #d1d5db;border-radius:8px;cursor:pointer;font-size:12.5px;color:#374151;font-weight:600;">🤝 Combinado Motorista</button>
        <button onclick="_cfdUsarPredefinida('combinado_motorista_frete_minimo')" style="width:100%;text-align:left;padding:9px 12px;background:#f9fafb;border:1.5px solid #d1d5db;border-radius:8px;cursor:pointer;font-size:12.5px;color:#374151;font-weight:600;">🤝 Combinado Motorista — com alerta e bloqueio abaixo do frete mínimo</button>
        <button onclick="_cfdUsarPredefinida('combinado_motorista_perc_adiantamento')" style="width:100%;text-align:left;padding:9px 12px;background:#f9fafb;border:1.5px solid #d1d5db;border-radius:8px;cursor:pointer;font-size:12.5px;color:#374151;font-weight:600;">🤝 COMBINADO MOTORISTA % ADIANTAMENTO</button>
      </div>
    </div>
    <div class="wizard-section" style="border:none;">
      <div class="wizard-label">✏️ Ou descreva em texto livre <span style="font-size:10px;color:#9ca3af;font-weight:400;">(a IA monta — use pra editar uma regra existente ou algo fora do padrão de contas simples)</span></div>
      <textarea id="wCfdRegraCola" class="wizard-textarea" placeholder="Cole aqui a regra existente que deseja editar (opcional)..." style="min-height:60px;"></textarea>
      <textarea id="wCfdDescricao" class="wizard-textarea" placeholder="Descreva o que necessita..." style="min-height:70px;margin-top:8px;"></textarea>
      <button id="wCfdBtnEnviar" class="wizard-submit" onclick="enviarWizardContratoDnd()" style="margin-top:8px;">🚀 Gerar com IA</button>
    </div>
  </div>
  <div class="builder-grid-main">
    <div class="wizard-section" id="wCfdSecaoMontar" style="border:none;position:sticky;top:0;z-index:2;background:var(--surface);border-bottom:2px solid #ddd6fe;box-shadow:0 4px 8px -6px rgba(0,0,0,.2);">
      <div class="wizard-label">🧩 Monte sua regra arrastando os campos</div>
      <div style="font-size:12.5px;color:#5b21b6;font-weight:700;margin-bottom:6px;">1. Clique ou arraste a ação pra ativar (fica destacada, vale pro próximo campo arrastado):</div>
      <div style="display:flex;gap:6px;margin-bottom:10px;flex-wrap:wrap;">
        <button class="_cfd-acao-btn" data-acao="+" onclick="_cfdClicarAcao('+')" draggable="true" ondragstart="_cfdAcaoDragStart(event,'+')" style="padding:8px 14px;background:#f3f4f6;color:#374151;border:2px solid #e5e7eb;border-radius:8px;cursor:pointer;font-size:12.5px;font-weight:700;">➕ Somar</button>
        <button class="_cfd-acao-btn" data-acao="-" onclick="_cfdClicarAcao('-')" draggable="true" ondragstart="_cfdAcaoDragStart(event,'-')" style="padding:8px 14px;background:#f3f4f6;color:#374151;border:2px solid #e5e7eb;border-radius:8px;cursor:pointer;font-size:12.5px;font-weight:700;">➖ Subtrair</button>
        <button class="_cfd-acao-btn" data-acao="*" onclick="_cfdClicarAcao('*')" draggable="true" ondragstart="_cfdAcaoDragStart(event,'*')" style="padding:8px 14px;background:#f3f4f6;color:#374151;border:2px solid #e5e7eb;border-radius:8px;cursor:pointer;font-size:12.5px;font-weight:700;">✖️ Multiplicar</button>
        <button class="_cfd-acao-btn" data-acao="/" onclick="_cfdClicarAcao('/')" draggable="true" ondragstart="_cfdAcaoDragStart(event,'/')" style="padding:8px 14px;background:#f3f4f6;color:#374151;border:2px solid #e5e7eb;border-radius:8px;cursor:pointer;font-size:12.5px;font-weight:700;">➗ Dividir</button>
        <span style="width:1px;background:#e5e7eb;margin:2px 2px;"></span>
        <button class="_cfd-acao-btn" data-acao=">" onclick="_cfdClicarAcao('&gt;')" draggable="true" ondragstart="_cfdAcaoDragStart(event,'&gt;')" style="padding:8px 14px;background:#f3f4f6;color:#92400e;border:2px solid #fde68a;border-radius:8px;cursor:pointer;font-size:12.5px;font-weight:700;" title="Usar pra montar uma condição">&gt; Maior que</button>
        <button class="_cfd-acao-btn" data-acao="<" onclick="_cfdClicarAcao('&lt;')" draggable="true" ondragstart="_cfdAcaoDragStart(event,'&lt;')" style="padding:8px 14px;background:#f3f4f6;color:#92400e;border:2px solid #fde68a;border-radius:8px;cursor:pointer;font-size:12.5px;font-weight:700;" title="Usar pra montar uma condição">&lt; Menor que</button>
        <button class="_cfd-acao-btn" data-acao="==" onclick="_cfdClicarAcao('==')" draggable="true" ondragstart="_cfdAcaoDragStart(event,'==')" style="padding:8px 14px;background:#f3f4f6;color:#92400e;border:2px solid #fde68a;border-radius:8px;cursor:pointer;font-size:12.5px;font-weight:700;" title="Usar pra montar uma condição">== Igual</button>
        <button class="_cfd-acao-btn" data-acao=">=" onclick="_cfdClicarAcao('&gt;=')" draggable="true" ondragstart="_cfdAcaoDragStart(event,'&gt;=')" style="padding:8px 14px;background:#f3f4f6;color:#92400e;border:2px solid #fde68a;border-radius:8px;cursor:pointer;font-size:12.5px;font-weight:700;" title="Usar pra montar uma condição">&gt;= Maior ou igual</button>
        <button class="_cfd-acao-btn" data-acao="<=" onclick="_cfdClicarAcao('&lt;=')" draggable="true" ondragstart="_cfdAcaoDragStart(event,'&lt;=')" style="padding:8px 14px;background:#f3f4f6;color:#92400e;border:2px solid #fde68a;border-radius:8px;cursor:pointer;font-size:12.5px;font-weight:700;" title="Usar pra montar uma condição">&lt;= Menor ou igual</button>
      </div>
      <div style="font-size:12.5px;color:#5b21b6;font-weight:700;margin-bottom:6px;">2. Campos disponíveis (arraste para a área abaixo):</div>
      <div id="wCfdCamposPalette" style="display:flex;flex-wrap:wrap;gap:6px;padding:10px;border:1.5px dashed #d1d5db;border-radius:8px;margin-bottom:10px;max-height:170px;overflow-y:auto;">${chipsHtml}</div>
      <div style="background:#fdf2f8;border:1.5px solid #f9a8d4;border-radius:8px;padding:10px 12px;margin-bottom:10px;">
        <label style="display:flex;align-items:center;gap:6px;font-size:12px;color:#9d174d;cursor:pointer;font-weight:800;text-transform:uppercase;letter-spacing:.3px;">
          <input type="checkbox" id="wCfdOutrosValoresCheck" onchange="_cfdToggleOutrosValores(this.checked)"> Utiliza Valores outros (campos personalizados)?
        </label>
        <div id="wCfdOutrosValoresWrap" style="display:none;margin-top:8px;">
          <input type="text" id="wCfdOutrosValoresInput" oninput="_cfdRenderPalette()" placeholder="coloque aqui o nome interno dos campos separados por vírgula" style="width:100%;padding:7px 10px;border:1.5px solid #f9a8d4;border-radius:6px;font-size:12px;font-family:monospace;background:white;color:#9d174d;">
          <div id="wCfdOutrosValoresChips" style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;max-height:70px;overflow-y:auto;"></div>
        </div>
      </div>
      <div style="font-size:11px;color:#6b7280;margin-bottom:6px;">Ou digite um valor numérico (ex: 100, 0.02) e arraste-o pra área de montagem — útil pra dividir/multiplicar um campo por um número fixo:</div>
      <div style="display:flex;gap:8px;align-items:center;">
        <input type="text" id="wCfdValorInput" inputmode="decimal" placeholder="Ex: 100" oninput="_cfdValorInputChange()" style="width:110px;padding:7px 10px;border:1.5px solid #d1d5db;border-radius:6px;font-size:12px;font-family:monospace;">
        <span id="wCfdValorChip" draggable="true" ondragstart="_cfdValorDragStart(event)" style="display:inline-flex;align-items:center;gap:4px;padding:7px 12px;background:#fff7ed;border:1.5px solid #fdba74;border-radius:16px;font-size:12px;font-family:monospace;cursor:not-allowed;user-select:none;color:#9a3412;opacity:.4;transition:opacity .15s;">🔢 Arrastar valor</span>
      </div>
    </div>
    <div class="wizard-section" style="border:none;">
      <div style="font-size:12.5px;color:#5b21b6;font-weight:700;margin-bottom:6px;">3. Área de montagem — arraste um campo (ou valor) sobre outro pra combinar com a ação selecionada:</div>
      <div id="wCfdBlocosContainer"></div>
      <button onclick="_cfdAdicionarBloco()" style="width:100%;padding:8px;background:white;border:1.5px dashed #7c3aed;border-radius:8px;color:#5b21b6;cursor:pointer;font-size:12.5px;font-weight:700;margin-bottom:12px;">➕ Definir mais um campo</button>
      <div id="wCfdExtrasContainer"></div>
      <div style="font-size:11px;color:#6b7280;margin-bottom:6px;">Prévia da regra (uma linha por campo definido):</div>
      <div id="wCfdPreview" style="padding:8px 10px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;font-family:monospace;font-size:11.5px;color:#374151;margin-bottom:10px;white-space:pre-wrap;word-break:break-all;">// defina um campo (nome + arraste algo pra área de montagem)</div>
      <div style="display:flex;gap:8px;">
        <button onclick="_cfdLimparCanvas()" style="padding:8px 14px;background:#fef2f2;color:#991b1b;border:1.5px solid #fecaca;border-radius:8px;cursor:pointer;font-size:12.5px;font-weight:600;">🗑️ Limpar tudo</button>
        <button id="wCfdBtnGerar" onclick="_cfdGerarRegraCustom()" style="flex:1;padding:8px 14px;background:#7c3aed;color:white;border:none;border-radius:8px;cursor:pointer;font-size:13px;font-weight:700;">🚀 Gerar Regra Montada</button>
      </div>
    </div>
  </div>
</div>`;
    document.getElementById('builderModalBody').appendChild(card);
    _cfdRenderBlocos();
    _abrirBuilderModal('cfd');
}
function _cfdSelecionarAcao(acao){
    window._cfdAcaoSel=acao;
    document.querySelectorAll('._cfd-acao-btn').forEach(b=>{
        const ativo=b.dataset.acao===acao;
        b.style.background=ativo?'var(--primary)':'#f3f4f6';
        b.style.color=ativo?'white':'#374151';
        b.style.borderColor=ativo?'var(--primary)':'#e5e7eb';
    });
    if(document.getElementById('wCfdBlocosContainer'))_cfdRenderBlocos();
}
function _cfdClicarAcao(acao){
    _cfdSelecionarAcao(window._cfdAcaoSel===acao?null:acao);
}
function _cfdAcaoDragStart(e,acao){
    e.dataTransfer.setData('text/plain','acao:'+acao);
    e.dataTransfer.effectAllowed='copy';
}
function _cfdDragStart(e){
    e.dataTransfer.setData('text/plain','campo:'+e.target.dataset.campo);
    e.dataTransfer.effectAllowed='copy';
}
function _cfdValorInputChange(){
    const val=(document.getElementById('wCfdValorInput')?.value||'').trim();
    const chip=document.getElementById('wCfdValorChip');
    if(!chip)return;
    const valido=val!==''&&!isNaN(Number(val.replace(',','.')));
    chip.style.opacity=valido?'1':'.4';
    chip.style.cursor=valido?'grab':'not-allowed';
}
function _cfdValorDragStart(e){
    const val=(document.getElementById('wCfdValorInput')?.value||'').trim();
    const norm=val.replace(',','.');
    if(!val||isNaN(Number(norm))){e.preventDefault();return;}
    e.dataTransfer.setData('text/plain','valor:'+norm);
    e.dataTransfer.effectAllowed='copy';
}
function _cfdRenderBlocos(){
    const cont=document.getElementById('wCfdBlocosContainer');
    if(!cont)return;
    cont.innerHTML=window._cfdBlocos.map((bloco,idx)=>{
        let canvasConteudo;
        if(bloco.termos&&bloco.termos.length){
            canvasConteudo=bloco.termos.map((t,tIdx)=>{
                const sep=tIdx>0?`<span style="font-size:11.5px;color:#7c3aed;font-weight:700;margin:0 3px;">${escapeHtml(_ACAO_NOMES[t.acao]||t.acao||'')}</span>`:'';
                const label=_termoParaLabel(t.termo);
                const daOutros=_ehCampoOutrosValores(t.termo);
                const corBorda=daOutros?'#f9a8d4':'#c4b5fd', corFundo=daOutros?'#fdf2f8':'white', corTexto=daOutros?'#9d174d':'#5b21b6', corX=daOutros?'#be185d':'#9333ea';
                return `${sep}<span title="${escapeHtml(t.termo)}" style="display:inline-flex;align-items:center;gap:3px;padding:3px 4px 3px 9px;margin:2px 0;background:${corFundo};border:1px solid ${corBorda};border-radius:12px;font-size:11.5px;font-family:monospace;color:${corTexto};">${escapeHtml(label)}<button onclick="_cfdRemoverTermo(${idx},${tIdx})" title="Remover este item" style="border:none;background:none;color:${corX};cursor:pointer;font-size:13px;padding:0 4px;line-height:1;font-weight:700;">✕</button></span>`;
            }).join('')+_acaoPreviaTrailingHtml(window._cfdAcaoSel,'#7c3aed');
        }else if(bloco.expr){
            canvasConteudo=`<span style="font-family:monospace;font-size:12.5px;color:#5b21b6;word-break:break-all;">${escapeHtml(bloco.expr)}</span>`;
        }else{
            canvasConteudo=`<span style="color:#9ca3af;font-size:12px;">Arraste campos aqui</span>`;
        }
        const btnLimparExpr=bloco.expr
            ?`<div style="text-align:right;margin-top:4px;"><button onclick="_cfdLimparExprBloco(${idx})" title="Remover tudo o que foi arrastado aqui (mantém o nome do campo)" style="padding:3px 8px;background:none;border:1px dashed #c4b5fd;border-radius:6px;color:#7c3aed;cursor:pointer;font-size:10.5px;">🧹 limpar o que foi arrastado</button></div>`
            :'';
        const btnRemover=window._cfdBlocos.length>1
            ?`<button onclick="_cfdRemoverBloco(${idx})" title="Remover esta definição" style="padding:7px 10px;background:#fef2f2;color:#991b1b;border:1.5px solid #fecaca;border-radius:6px;cursor:pointer;font-size:12px;">🗑️</button>`
            :'';
        let condSecao=`<label style="display:flex;align-items:center;gap:6px;font-size:11px;color:#92400e;cursor:pointer;margin:6px 0 8px;">
                <input type="checkbox" ${idx===0?'data-tour="condicao"':''} ${bloco.temCondicao?'checked':''} onchange="_cfdToggleCondicao(${idx},this.checked)"> Definir condição?
            </label>`;
        if(bloco.temCondicao){
            const condTermos=(bloco.condicao&&bloco.condicao.termos)||[];
            const condConteudo=condTermos.length
                ?condTermos.map((t,tIdx)=>{
                    const sep=tIdx>0?`<span style="font-size:11.5px;color:#b45309;font-weight:700;margin:0 3px;">${escapeHtml(_ACAO_NOMES[t.acao]||t.acao||'')}</span>`:'';
                    const label=_termoParaLabel(t.termo);
                    const daOutros=_ehCampoOutrosValores(t.termo);
                    const corBorda=daOutros?'#f9a8d4':'#fcd34d', corFundo=daOutros?'#fce7f3':'white', corTexto=daOutros?'#9d174d':'#92400e', corX=daOutros?'#be185d':'#b45309';
                    return `${sep}<span title="${escapeHtml(t.termo)}" style="display:inline-flex;align-items:center;gap:3px;padding:3px 4px 3px 9px;margin:2px 0;background:${corFundo};border:1px solid ${corBorda};border-radius:12px;font-size:11.5px;font-family:monospace;color:${corTexto};">${escapeHtml(label)}<button onclick="_cfdRemoverTermoCondicao(${idx},${tIdx})" title="Remover este item" style="border:none;background:none;color:${corX};cursor:pointer;font-size:13px;padding:0 4px;line-height:1;font-weight:700;">✕</button></span>`;
                }).join('')+_acaoPreviaTrailingHtml(window._cfdAcaoSel,'#b45309')
                :`<span style="color:#b45309;font-size:12px;">Arraste campos aqui pra montar a condição</span>`;
            condSecao+=`<div style="margin:0 0 10px;padding-left:8px;border-left:3px solid #fbbf24;">
                <div style="font-size:10.5px;color:#92400e;margin-bottom:4px;">Condição — SE isso for verdade, o campo é definido:</div>
                <div ondragover="_cfdCanvasDragOver(event)" ondrop="_cfdCondicaoDrop(event,${idx})" style="position:relative;min-height:44px;padding:8px;border:1.5px dashed #f59e0b;border-radius:8px;background:#fffbeb;display:flex;align-items:center;flex-wrap:wrap;">
                    ${_acaoBadgeHtml(window._cfdAcaoSel,'#fbbf24','#92400e')}
                    ${condConteudo}
                </div>
            </div>`;
        }
        return `<div style="border:1.5px solid #e5e7eb;border-radius:8px;padding:10px;margin-bottom:10px;">
            <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px;">
                <label style="font-size:11px;color:#374151;white-space:nowrap;">Campo a definir:</label>
                <input type="text" value="${escapeHtml(_termoParaLabel(bloco.destino))}" title="${escapeHtml(bloco.destino)}" placeholder="digite ou arraste um campo aqui"
                    ondragover="_cfdDestinoDragOver(event)" ondrop="_cfdDestinoDrop(event,${idx})" oninput="_cfdDestinoInput(event,${idx})"
                    style="flex:1;padding:7px 10px;border:1.5px solid #7c3aed;border-radius:6px;font-size:12px;font-family:monospace;background:#f5f3ff;color:#5b21b6;font-weight:600;outline:none;">
                ${btnRemover}
            </div>
            ${condSecao}
            <div ondragover="_cfdCanvasDragOver(event)" ondrop="_cfdCanvasDrop(event,${idx})" style="position:relative;min-height:50px;padding:10px;border:1.5px dashed #7c3aed;border-radius:8px;background:#f5f3ff;display:flex;align-items:center;flex-wrap:wrap;">
                ${_acaoBadgeHtml(window._cfdAcaoSel,'#c4b5fd','#5b21b6')}
                ${canvasConteudo}
            </div>
            ${btnLimparExpr}
        </div>`;
    }).join('');
    _cfdRenderExtras();
    _cfdAtualizarPreview();
}
function _cfdCanvasDragOver(e){e.preventDefault();e.dataTransfer.dropEffect='copy';}
function _cfdCanvasDrop(e,idx){
    e.preventDefault();
    const raw=e.dataTransfer.getData('text/plain');
    if(!raw)return;
    if(raw.startsWith('acao:')){ _cfdSelecionarAcao(raw.slice(5)); _cfdRenderBlocos(); return; }
    const termo=_fatTermoParaExpressao(raw);
    if(termo===null)return;
    const bloco=window._cfdBlocos[idx];
    _seedTermosBase(bloco);
    if(bloco.termos.length&&!window._cfdAcaoSel){ alert('Selecione uma ação antes de arrastar outro campo.'); return; }
    bloco.termos.push({termo, acao: bloco.termos.length?window._cfdAcaoSel:null});
    _recalcExprDeTermos(bloco);
    _cfdRenderBlocos();
}
// Liga/desliga a condição de um campo — ao ligar, cria a área de montagem da condição (vazia se
// for a primeira vez); ao desligar, só esconde (não perde o que já tinha montado, caso reative).
function _cfdToggleCondicao(idx,marcado){
    const bloco=window._cfdBlocos[idx];
    if(!bloco)return;
    bloco.temCondicao=marcado;
    if(marcado&&!bloco.condicao)bloco.condicao={termos:[],expr:null};
    _cfdRenderBlocos();
}
// Arrastar campo/valor pra área de montagem da CONDIÇÃO (mesmo mecanismo do valor, só que guarda
// em bloco.condicao ao invés de no próprio bloco) — usa a mesma ação selecionada (>, <, ==, etc.).
function _cfdCondicaoDrop(e,idx){
    e.preventDefault();
    const raw=e.dataTransfer.getData('text/plain');
    if(!raw)return;
    if(raw.startsWith('acao:')){ _cfdSelecionarAcao(raw.slice(5)); _cfdRenderBlocos(); return; }
    const termo=_fatTermoParaExpressao(raw);
    if(termo===null)return;
    const bloco=window._cfdBlocos[idx];
    if(!bloco.condicao)bloco.condicao={termos:[],expr:null};
    if(bloco.condicao.termos.length&&!window._cfdAcaoSel){ alert('Selecione uma ação antes de arrastar outro campo.'); return; }
    bloco.condicao.termos.push({termo, acao: bloco.condicao.termos.length?window._cfdAcaoSel:null});
    _recalcExprDeTermos(bloco.condicao);
    _cfdRenderBlocos();
}
function _cfdRemoverTermoCondicao(idx,termoIdx){
    const bloco=window._cfdBlocos[idx];
    if(!bloco||!bloco.condicao||!bloco.condicao.termos)return;
    bloco.condicao.termos.splice(termoIdx,1);
    _recalcExprDeTermos(bloco.condicao);
    _cfdRenderBlocos();
}
function _cfdDestinoDragOver(e){e.preventDefault();e.dataTransfer.dropEffect='copy';}
function _cfdDestinoDrop(e,idx){
    e.preventDefault();
    const raw=e.dataTransfer.getData('text/plain');
    if(!raw)return;
    if(raw.startsWith('acao:')){ _cfdSelecionarAcao(raw.slice(5)); _cfdRenderBlocos(); return; }
    const nome=raw.startsWith('campo:')?raw.slice(6):raw.startsWith('valor:')?raw.slice(6):raw;
    window._cfdBlocos[idx].destino=nome;
    _cfdRenderBlocos();
}
function _cfdDestinoInput(e,idx){
    window._cfdBlocos[idx].destino=_labelParaTermoInterno(e.target.value);
    _cfdAtualizarPreview();
}
function _cfdAdicionarBloco(){
    window._cfdBlocos.push({destino:'',expr:null});
    _cfdRenderBlocos();
}
function _cfdRemoverBloco(idx){
    if(window._cfdBlocos.length<=1)return;
    window._cfdBlocos.splice(idx,1);
    _cfdRenderBlocos();
}
// Remove só um item arrastado dentro do campo (idx = bloco, termoIdx = posição do item na área de
// montagem) — o resto do que já estava montado nesse campo continua intacto, sem perder tudo.
function _cfdRemoverTermo(idx,termoIdx){
    const bloco=window._cfdBlocos[idx];
    if(!bloco||!bloco.termos)return;
    bloco.termos.splice(termoIdx,1);
    _recalcExprDeTermos(bloco);
    _cfdRenderBlocos();
}
// Limpa só o que foi arrastado num campo (mantém o nome do "Campo a definir" e os demais campos).
function _cfdLimparExprBloco(idx){
    const bloco=window._cfdBlocos[idx];
    if(!bloco)return;
    bloco.expr=null;
    bloco.termos=[];
    _cfdRenderBlocos();
}
// Linhas "extras" vêm de uma regra pré-definida carregada no canvas (ver _parseRegraParaBlocos)
// que não cabem no modelo campo=expressão (chamada de método, bloco if) — mostradas como estão,
// só de leitura, com a posição onde entram na regra final (antes de qual campo, ou no final).
function _cfdRenderExtras(){
    const cont=document.getElementById('wCfdExtrasContainer');
    if(!cont)return;
    const extras=window._cfdExtras||[];
    const visiveis=extras.map((ex,idx)=>({ex,idx,texto:_semLinhasComentario(ex.linha)})).filter(({texto})=>texto);
    if(!visiveis.length){ cont.innerHTML=''; return; }
    cont.innerHTML=visiveis.map(({ex,idx,texto})=>{
        const posLabel=ex.antesDe?`executa antes de definir <b>"${escapeHtml(ex.antesDe)}"</b>`:'executa no final da regra';
        return `<div style="border:1.5px dashed #f59e0b;border-radius:8px;padding:8px 10px;margin-bottom:8px;background:#fffbeb;">
            <div style="font-size:10.5px;color:#92400e;margin-bottom:4px;">⚡ Linha extra da regra original (mantida como está — ${posLabel}):</div>
            <pre style="margin:0 0 6px;font-family:monospace;font-size:11.5px;color:#78350f;white-space:pre-wrap;word-break:break-all;">${escapeHtml(texto)}</pre>
            <button onclick="_cfdRemoverExtra(${idx})" style="padding:4px 10px;background:#fef2f2;color:#991b1b;border:1px solid #fecaca;border-radius:6px;cursor:pointer;font-size:11px;">🗑️ Remover esta linha</button>
        </div>`;
    }).join('');
}
function _cfdRemoverExtra(idx){
    if(!window._cfdExtras)return;
    window._cfdExtras.splice(idx,1);
    _cfdRenderExtras();
    _cfdAtualizarPreview();
}
function _cfdLinhasValidas(){
    const extras=window._cfdExtras||[];
    const usadas=new Set(); // evita repetir a mesma extra quando 2 campos têm o mesmo nome — cada
    // extra só entra uma vez, na primeira ocorrência ainda não usada daquele nome, na ordem em que
    // apareciam na regra.
    const linhas=[];
    window._cfdBlocos.forEach(b=>{
        if(b.destino&&b.destino.trim()){
            const idxExtra=extras.findIndex((ex,i)=>!usadas.has(i)&&ex.antesDe===b.destino.trim());
            if(idxExtra!==-1){ linhas.push(extras[idxExtra].linha); usadas.add(idxExtra); }
        }
        if(b.destino&&b.destino.trim()&&b.expr){
            const linhaDef=`def("${b.destino.trim()}", ${b.expr});`;
            if(b.temCondicao&&b.condicao&&b.condicao.expr){
                linhas.push(`if (${b.condicao.expr}) {`);
                linhas.push(`    ${linhaDef}`);
                linhas.push(`}`);
            }else{
                linhas.push(linhaDef);
            }
        }
    });
    extras.forEach((ex,i)=>{ if(!usadas.has(i)) linhas.push(ex.linha); });
    return linhas;
}
function _cfdAtualizarPreview(){
    const linhas=_cfdLinhasValidas();
    const preview=document.getElementById('wCfdPreview');
    if(preview)preview.textContent=linhas.length?linhas.join('\n'):'// defina um campo (nome + arraste algo pra área de montagem)';
}
function _cfdLimparCanvas(){
    window._cfdBlocos=[{destino:'',expr:null}];
    window._cfdExtras=[];
    const colar=document.getElementById('wCfdColarRegra');
    if(colar)colar.value='';
    _cfdRenderBlocos();
}
function _cfdGerarRegraCustom(){
    const linhas=_cfdLinhasValidas();
    if(linhas.length===0){alert('Defina ao menos um campo: dê um nome e arraste ao menos um campo pra área de montagem dele.');return;}
    _renderizarCardRegraContratoDndSemIA(linhas.join('\n'));
}
// Algumas regras pré-definidas dependem de um campo personalizado ("Utiliza Valores outros") que
// não existe sozinho no sistema -- ao escolher essa regra, já marca o checkbox e preenche o nome
// interno do campo, pra o chip correspondente já aparecer pronto pra arrastar, sem o usuário
// precisar descobrir e digitar esse nome por conta própria.
const CFD_REGRA_PRE_OUTROS_VALORES={
    combinado_motorista_perc_adiantamento:{
        nomes:['percAdiantamento'],
        aviso:'ATENÇÃO, VERIFICAR EM Transporte > Configurações > Tipos Valores Outros, se está configurado o campo com nome interno percAdiantamento e descrição % Adiantamento e se ele está ativo.'
    }
};
// Ao escolher uma regra pré-definida, ao invés de já gerar o resultado final, preenche o canvas
// com os campos/definições dela — o usuário parte dessa base pronta e edita/adiciona o que precisar.
function _cfdUsarPredefinida(chave){
    const codigo=REGRAS_PREDEFINIDAS_CONTRATO[chave];
    if(!codigo)return;
    const colar=document.getElementById('wCfdColarRegra');
    if(colar)colar.value=codigo; // mantém o campo de colar em sincronia com o que foi carregado
    const {blocos,extras}=_parseRegraParaBlocos(codigo);
    window._cfdBlocos=(blocos.length?blocos:[{destino:'',expr:null}]).map(_seedTermosBase);
    window._cfdExtras=extras;
    const outrosValoresPre=CFD_REGRA_PRE_OUTROS_VALORES[chave];
    if(outrosValoresPre&&outrosValoresPre.nomes&&outrosValoresPre.nomes.length){
        const chk=document.getElementById('wCfdOutrosValoresCheck');
        const input=document.getElementById('wCfdOutrosValoresInput');
        if(chk)chk.checked=true;
        if(input)input.value=outrosValoresPre.nomes.join(', ');
        _cfdToggleOutrosValores(true);
        if(outrosValoresPre.aviso)alert(outrosValoresPre.aviso);
    }
    _cfdRenderBlocos();
    const cont=document.getElementById('wCfdBlocosContainer');
    if(cont)cont.scrollIntoView({behavior:'smooth',block:'nearest'});
}
// Campo "colar regra existente" — a cada edição (colar, digitar, apagar), reprocessa o texto e
// já monta os campos/definições na área de montagem, ao vivo, sem precisar clicar em nada.
function _cfdColarRegraInput(){
    const texto=(document.getElementById('wCfdColarRegra')?.value||'').trim();
    if(!texto){
        window._cfdBlocos=[{destino:'',expr:null}];
        window._cfdExtras=[];
        _cfdRenderBlocos();
        return;
    }
    const {blocos,extras}=_parseRegraParaBlocos(texto);
    window._cfdBlocos=(blocos.length?blocos:[{destino:'',expr:null}]).map(_seedTermosBase);
    window._cfdExtras=extras;
    _cfdRenderBlocos();
}
function _renderizarCardRegraContratoDndSemIA(codigo){
    const wCard=document.getElementById('wizardContratoDndCard');
    const _estadoForm=wCard?_capturarEstadoForm(wCard):null;
    const _cfdExtra={acaoSel:window._cfdAcaoSel,blocos:_clonarBlocos(window._cfdBlocos),extras:(window._cfdExtras||[]).map(e=>({...e}))};
    if(wCard)wCard.remove();
    _fecharBuilderModal();
    const s=Ferr.stream('regra');
    const c=document.createElement('div');c.className='answer-card';
    const ts=Date.now();
    c.id='_regraResultCard_'+ts;
    window['_regraVoltar_'+ts]={tipo:'contrato-dnd',query:_wizardContratoDndQuery,estadoForm:_estadoForm,cfdExtra:_cfdExtra};
    const escaped=codigo.replace(/</g,'&lt;').replace(/>/g,'&gt;');
    let h=`<div style="background:#f5f3ff;padding:8px 15px;border-bottom:1px solid #ddd6fe;font-size:11px;color:#5b21b6;font-weight:600;">🚛 Regra de Contrato de Frete — montada sem IA</div>`;
    h+=`<div class="answer-section"><div class="section-content"><div style="position:relative;margin:8px 0;"><pre class="regra-code">${escaped}</pre><button onclick="copiarRegra(this)" style="position:absolute;top:8px;right:8px;background:#313244;color:#a6e3a1;border:none;border-radius:5px;padding:3px 10px;font-size:11px;cursor:pointer;font-weight:600;">📋 Copiar</button></div></div></div>`;
    h+=`<div class="feedback-area"><button onclick="_voltarParaWizardRegra(${ts})" style="display:flex;align-items:center;gap:6px;padding:6px 14px;border:1.5px solid #1e40af;border-radius:8px;background:white;color:#1e40af;cursor:pointer;font-size:13px;font-weight:600;">🔙 Voltar</button>${ferrBotaoNovoHtml('regra')}</div>`;
    c.innerHTML=h;
    s.appendChild(c);
    ferrRolar('regra', true);
    ferrConversa('regra', 'ai',codigo);
    ferrLog('regra', 'Criar Regra Contrato de Frete (montada sem IA)',true);
}
async function enviarWizardContratoDnd(){
    const btn=document.getElementById('wCfdBtnEnviar');
    if(btn){btn.disabled=true;btn.textContent='⏳ Gerando...';}
    // Idem Ct-e: manda os DOIS — o estado de verdade da área de montagem (_cfdLinhasValidas) E o
    // campo separado "regra existente" (wCfdRegraCola, não ligado à área de montagem) — senão
    // qualquer um dos dois que o usuário tivesse preenchido se perdia ao gerar com IA.
    const regraCola=(document.getElementById('wCfdRegraCola')?.value||'').trim();
    const descricao=(document.getElementById('wCfdDescricao')?.value||'').trim();
    const canvasTxt=_cfdLinhasValidas().join('\n');
    const configTxt=[
        canvasTxt?'REGRA JA MONTADA NA AREA DE ARRASTAR CAMPOS (una com a solicitacao abaixo -- NAO descarte o que ja foi montado, so ajuste/complete conforme pedido):\n'+canvasTxt:'',
        regraCola?'\nREGRA EXISTENTE PARA EDITAR (colada separadamente):\n'+regraCola:'',
        descricao?'\nSOLICITACAO: '+descricao:'',
        _wizardContratoDndQuery?'\nCONTEXTO: '+_wizardContratoDndQuery:''
    ].filter(Boolean).join('\n');
    const sysMsg='Voce e um especialista em regras de Contrato de Frete do Bsoft TMS.\nGere APENAS o codigo da regra pronto para uso, entre triple backticks.\n\nUNIR REGRA JA MONTADA COM A SOLICITACAO:\nSe a mensagem do usuario tiver uma secao "REGRA JA MONTADA NA AREA DE ARRASTAR CAMPOS", essa e a regra que o usuario ja construiu manualmente (arrastando campos, marcando opcoes, carregando uma regra base) -- ela e o PONTO DE PARTIDA. NUNCA descarte nem reescreva do zero o que ja esta montado. Una com a "SOLICITACAO": mantenha tudo que ja esta la e so adicione, ajuste ou complete exatamente o que foi pedido. O resultado final tem que conter TANTO o que ja estava montado QUANTO o que foi solicitado, numa unica regra coerente.\n\nDEFINICAO DE CAMPOS OCULTOS ($SV):\nPara definir um campo oculto sem gerar erro de "campo nao encontrado", SEMPRE verifique se o elemento existe antes de usar $SV():\nif (document.getElementsByName(\'NOMECAMPO\').length > 0) {\n   $SV(\'NOMECAMPO\', obt("nomeInterno"));\n}\nNUNCA use $SV() direto sem essa verificacao.\n\nDOCUMENTACAO:\n'+CONTEXTO_CONTRATO_FRETE;
    const wCard=document.getElementById('wizardContratoDndCard');
    const _estadoForm=wCard?_capturarEstadoForm(wCard):null;
    if(wCard)wCard.remove();
    _fecharBuilderModal();
    ferrMsg('regra', 'system','🚛 <strong>Gerando regra de Contrato de Frete...</strong>');
    const ld=ferrCarregando('regra', '🚛 Elaborando regra de contrato...');
    const li=Date.now();
    try{
        const result=await callMCPSemPensamento([{role:'system',content:sysMsg},{role:'user',content:'Monte a regra conforme a solicitacao abaixo.\n'+configTxt}],{temperature:0.15,maxTokens: REGRAS_MAX_TOKENS});
        ld.remove();
        renderizarCardRegra(result.text,li,result._iaUsada,result._iaModelo,'contrato-dnd',{query:_wizardContratoDndQuery,estadoForm:_estadoForm});
        ferrConversa('regra', 'ai',result.text);
    }catch(e){ld.remove();ferrMsg('regra', 'ai','❌ Erro ao gerar regra. Tente novamente.');}
}

const FATURAMENTO_CAMPOS=['notaFiscal','freteValor','valorICMS','valoresOutros','valoresPedagio','outrosDescontos','pesoColeta','pesoChegadaReal','descontoQuebraPesoReal','totalPrestacao','tolerancia','tarifaMotoristaDigitada','regraFrete'];
const FATURAMENTO_REGRA_PADRAO=`def("totalPrestacao", obt('freteValor') + obt('valorICMS'));`;

let _wizardFaturamentoQuery='';
function _fatChip(c,corBorda,corFundo,corTexto){
    return `<span class="_fat-chip" draggable="true" data-campo="${c.campo}" title="${escapeHtml(c.campo)}" ondragstart="_fatDragStart(event)" style="display:inline-block;padding:6px 12px;background:${corFundo};border:1.5px solid ${corBorda};border-radius:16px;font-size:12px;font-family:monospace;cursor:grab;user-select:none;color:${corTexto};">${escapeHtml(c.label)}</span>`;
}
function _fatNomesOutrosValores(){
    const chk=document.getElementById('wFatOutrosValoresCheck');
    if(!chk||!chk.checked)return [];
    const raw=document.getElementById('wFatOutrosValoresInput')?.value||'';
    return raw.split(',').map(s=>s.trim()).filter(Boolean);
}
function _fatMontarPaletteHtml(){
    return FATURAMENTO_CAMPOS.map(c=>_fatChip({label:c,campo:c},'#d1d5db','white','#374151')).join('');
}
// Chips dos campos personalizados ("Utiliza Valores outros") — ficam numa área PRÓPRIA, logo
// abaixo do campo onde a pessoa acabou de digitar os nomes, sem precisar rolar a paleta grande.
function _fatMontarChipsOutrosHtml(){
    return _fatNomesOutrosValores().map(nome=>_fatChip({label:nome,campo:'outrosValores['+nome+']'},'#f9a8d4','#fdf2f8','#9d174d')).join('');
}
function _fatRenderPalette(){
    const wrap=document.getElementById('wFatCamposPalette');
    if(wrap)wrap.innerHTML=_fatMontarPaletteHtml();
    const chipsOutros=document.getElementById('wFatOutrosValoresChips');
    if(chipsOutros)chipsOutros.innerHTML=_fatMontarChipsOutrosHtml();
}
function _fatToggleOutrosValores(marcado){
    const wrap=document.getElementById('wFatOutrosValoresWrap');
    if(wrap)wrap.style.display=marcado?'block':'none';
    _fatRenderPalette();
}
function mostrarWizardFaturamento(queryOriginal){
    _wizardFaturamentoQuery=queryOriginal;
    window._fatAcaoSel=null;
    window._fatBlocos=[{destino:'',expr:null}];
    window._fatExtras=[];
    document.getElementById('builderModalBody').innerHTML='';
    const card=document.createElement('div');
    card.id='wizardFaturamentoCard';
    card.className='builder-card';
    const chipsHtml=_fatMontarPaletteHtml();
    card.innerHTML=`<div style="flex-shrink:0;background:#ecfdf5;padding:10px 15px;border-bottom:1px solid #a7f3d0;font-size:12px;color:#065f46;font-weight:700;">💰 Assistente — Regra de Faturamento</div>
<div class="builder-grid">
  <div class="builder-grid-side">
    <button id="wFatBtnTutorial" onclick="_iniciarTourBuilder('fat')" class="tour-btn-abrir">🎓 Ver tutorial passo a passo</button>
    <div class="wizard-section" id="wFatSecaoColar">
      <div class="wizard-label">📋 Colar regra existente do sistema</div>
      <textarea id="wFatColarRegra" class="wizard-textarea" placeholder="Cole aqui uma regra já pronta do sistema..." style="min-height:90px;font-family:monospace;font-size:11.5px;" oninput="_fatColarRegraInput()"></textarea>
      <div style="font-size:10.5px;color:#059669;margin-top:4px;">🔄 A área de montagem ao lado é atualizada automaticamente conforme você cola ou edita aqui.</div>
    </div>
    <div class="wizard-section" id="wFatSecaoPredefinidas">
      <div class="wizard-label">📋 Regra pré-existente (padrão)</div>
      <button onclick="_fatUsarPredefinida()" style="width:100%;text-align:left;padding:9px 12px;background:#f9fafb;border:1.5px solid #d1d5db;border-radius:8px;cursor:pointer;font-size:12.5px;color:#374151;font-weight:600;">💰 Regra Faturamento Padrão</button>
    </div>
    <div class="wizard-section" style="border:none;">
      <div class="wizard-label">✏️ Ou descreva em texto livre <span style="font-size:10px;color:#9ca3af;font-weight:400;">(a IA monta — use pra editar uma regra existente ou algo fora do padrão de contas simples)</span></div>
      <textarea id="wFatRegraCola" class="wizard-textarea" placeholder="Cole aqui a regra existente que deseja editar (opcional)..." style="min-height:60px;"></textarea>
      <textarea id="wFatDescricao" class="wizard-textarea" placeholder="Descreva o que necessita..." style="min-height:70px;margin-top:8px;"></textarea>
      <button id="wFatBtnEnviar" class="wizard-submit" onclick="enviarWizardFaturamento()" style="margin-top:8px;">🚀 Gerar com IA</button>
    </div>
  </div>
  <div class="builder-grid-main">
    <div class="wizard-section" id="wFatSecaoMontar" style="border:none;position:sticky;top:0;z-index:2;background:var(--surface);border-bottom:2px solid #a7f3d0;box-shadow:0 4px 8px -6px rgba(0,0,0,.2);">
      <div class="wizard-label">🧩 Monte sua regra arrastando os campos</div>
      <div style="font-size:12.5px;color:#065f46;font-weight:700;margin-bottom:6px;">1. Clique ou arraste a ação pra ativar (fica destacada, vale pro próximo campo arrastado):</div>
      <div style="display:flex;gap:6px;margin-bottom:10px;flex-wrap:wrap;">
        <button class="_fat-acao-btn" data-acao="+" onclick="_fatClicarAcao('+')" draggable="true" ondragstart="_fatAcaoDragStart(event,'+')" style="padding:8px 14px;background:#f3f4f6;color:#374151;border:2px solid #e5e7eb;border-radius:8px;cursor:pointer;font-size:12.5px;font-weight:700;">➕ Somar</button>
        <button class="_fat-acao-btn" data-acao="-" onclick="_fatClicarAcao('-')" draggable="true" ondragstart="_fatAcaoDragStart(event,'-')" style="padding:8px 14px;background:#f3f4f6;color:#374151;border:2px solid #e5e7eb;border-radius:8px;cursor:pointer;font-size:12.5px;font-weight:700;">➖ Subtrair</button>
        <button class="_fat-acao-btn" data-acao="*" onclick="_fatClicarAcao('*')" draggable="true" ondragstart="_fatAcaoDragStart(event,'*')" style="padding:8px 14px;background:#f3f4f6;color:#374151;border:2px solid #e5e7eb;border-radius:8px;cursor:pointer;font-size:12.5px;font-weight:700;">✖️ Multiplicar</button>
        <button class="_fat-acao-btn" data-acao="/" onclick="_fatClicarAcao('/')" draggable="true" ondragstart="_fatAcaoDragStart(event,'/')" style="padding:8px 14px;background:#f3f4f6;color:#374151;border:2px solid #e5e7eb;border-radius:8px;cursor:pointer;font-size:12.5px;font-weight:700;">➗ Dividir</button>
        <span style="width:1px;background:#e5e7eb;margin:2px 2px;"></span>
        <button class="_fat-acao-btn" data-acao=">" onclick="_fatClicarAcao('&gt;')" draggable="true" ondragstart="_fatAcaoDragStart(event,'&gt;')" style="padding:8px 14px;background:#f3f4f6;color:#92400e;border:2px solid #fde68a;border-radius:8px;cursor:pointer;font-size:12.5px;font-weight:700;" title="Usar pra montar uma condição">&gt; Maior que</button>
        <button class="_fat-acao-btn" data-acao="<" onclick="_fatClicarAcao('&lt;')" draggable="true" ondragstart="_fatAcaoDragStart(event,'&lt;')" style="padding:8px 14px;background:#f3f4f6;color:#92400e;border:2px solid #fde68a;border-radius:8px;cursor:pointer;font-size:12.5px;font-weight:700;" title="Usar pra montar uma condição">&lt; Menor que</button>
        <button class="_fat-acao-btn" data-acao="==" onclick="_fatClicarAcao('==')" draggable="true" ondragstart="_fatAcaoDragStart(event,'==')" style="padding:8px 14px;background:#f3f4f6;color:#92400e;border:2px solid #fde68a;border-radius:8px;cursor:pointer;font-size:12.5px;font-weight:700;" title="Usar pra montar uma condição">== Igual</button>
        <button class="_fat-acao-btn" data-acao=">=" onclick="_fatClicarAcao('&gt;=')" draggable="true" ondragstart="_fatAcaoDragStart(event,'&gt;=')" style="padding:8px 14px;background:#f3f4f6;color:#92400e;border:2px solid #fde68a;border-radius:8px;cursor:pointer;font-size:12.5px;font-weight:700;" title="Usar pra montar uma condição">&gt;= Maior ou igual</button>
        <button class="_fat-acao-btn" data-acao="<=" onclick="_fatClicarAcao('&lt;=')" draggable="true" ondragstart="_fatAcaoDragStart(event,'&lt;=')" style="padding:8px 14px;background:#f3f4f6;color:#92400e;border:2px solid #fde68a;border-radius:8px;cursor:pointer;font-size:12.5px;font-weight:700;" title="Usar pra montar uma condição">&lt;= Menor ou igual</button>
      </div>
      <div style="font-size:12.5px;color:#065f46;font-weight:700;margin-bottom:6px;">2. Campos disponíveis (arraste para a área abaixo):</div>
      <div id="wFatCamposPalette" style="display:flex;flex-wrap:wrap;gap:6px;padding:10px;border:1.5px dashed #d1d5db;border-radius:8px;margin-bottom:10px;max-height:170px;overflow-y:auto;">${chipsHtml}</div>
      <div style="background:#fdf2f8;border:1.5px solid #f9a8d4;border-radius:8px;padding:10px 12px;margin-bottom:10px;">
        <label style="display:flex;align-items:center;gap:6px;font-size:12px;color:#9d174d;cursor:pointer;font-weight:800;text-transform:uppercase;letter-spacing:.3px;">
          <input type="checkbox" id="wFatOutrosValoresCheck" onchange="_fatToggleOutrosValores(this.checked)"> Utiliza Valores outros (campos personalizados)?
        </label>
        <div id="wFatOutrosValoresWrap" style="display:none;margin-top:8px;">
          <input type="text" id="wFatOutrosValoresInput" oninput="_fatRenderPalette()" placeholder="coloque aqui o nome interno dos campos separados por vírgula" style="width:100%;padding:7px 10px;border:1.5px solid #f9a8d4;border-radius:6px;font-size:12px;font-family:monospace;background:white;color:#9d174d;">
          <div id="wFatOutrosValoresChips" style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;max-height:70px;overflow-y:auto;"></div>
        </div>
      </div>
      <div style="font-size:11px;color:#6b7280;margin-bottom:6px;">Ou digite um valor numérico (ex: 100, 0.02) e arraste-o pra área de montagem — útil pra dividir/multiplicar um campo por um número fixo:</div>
      <div style="display:flex;gap:8px;align-items:center;">
        <input type="text" id="wFatValorInput" inputmode="decimal" placeholder="Ex: 100" oninput="_fatValorInputChange()" style="width:110px;padding:7px 10px;border:1.5px solid #d1d5db;border-radius:6px;font-size:12px;font-family:monospace;">
        <span id="wFatValorChip" draggable="true" ondragstart="_fatValorDragStart(event)" style="display:inline-flex;align-items:center;gap:4px;padding:7px 12px;background:#fff7ed;border:1.5px solid #fdba74;border-radius:16px;font-size:12px;font-family:monospace;cursor:not-allowed;user-select:none;color:#9a3412;opacity:.4;transition:opacity .15s;">🔢 Arrastar valor</span>
      </div>
    </div>
    <div class="wizard-section" style="border:none;">
      <div style="font-size:12.5px;color:#065f46;font-weight:700;margin-bottom:6px;">3. Área de montagem — arraste um campo (ou valor) sobre outro pra combinar com a ação selecionada:</div>
      <div id="wFatBlocosContainer"></div>
      <button onclick="_fatAdicionarBloco()" style="width:100%;padding:8px;background:white;border:1.5px dashed #10b981;border-radius:8px;color:#059669;cursor:pointer;font-size:12.5px;font-weight:700;margin-bottom:12px;">➕ Definir mais um campo</button>
      <div id="wFatExtrasContainer"></div>
      <div style="font-size:11px;color:#6b7280;margin-bottom:6px;">Prévia da regra (uma linha por campo definido):</div>
      <div id="wFatPreview" style="padding:8px 10px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;font-family:monospace;font-size:11.5px;color:#374151;margin-bottom:10px;white-space:pre-wrap;word-break:break-all;">// defina um campo (nome + arraste algo pra área de montagem)</div>
      <div style="display:flex;gap:8px;">
        <button onclick="_fatLimparCanvas()" style="padding:8px 14px;background:#fef2f2;color:#991b1b;border:1.5px solid #fecaca;border-radius:8px;cursor:pointer;font-size:12.5px;font-weight:600;">🗑️ Limpar tudo</button>
        <button id="wFatBtnGerar" onclick="_fatGerarRegraCustom()" style="flex:1;padding:8px 14px;background:#059669;color:white;border:none;border-radius:8px;cursor:pointer;font-size:13px;font-weight:700;">🚀 Gerar Regra Montada</button>
      </div>
    </div>
  </div>
</div>`;
    document.getElementById('builderModalBody').appendChild(card);
    _fatRenderBlocos();
    _abrirBuilderModal('fat');
}

// ─── Montador visual (arrastar e soltar) da regra de Faturamento ───
function _fatSelecionarAcao(acao){
    window._fatAcaoSel=acao;
    document.querySelectorAll('._fat-acao-btn').forEach(b=>{
        const ativo=b.dataset.acao===acao;
        b.style.background=ativo?'var(--primary)':'#f3f4f6';
        b.style.color=ativo?'white':'#374151';
        b.style.borderColor=ativo?'var(--primary)':'#e5e7eb';
    });
    if(document.getElementById('wFatBlocosContainer'))_fatRenderBlocos();
}
function _fatClicarAcao(acao){
    _fatSelecionarAcao(window._fatAcaoSel===acao?null:acao);
}
function _fatAcaoDragStart(e,acao){
    e.dataTransfer.setData('text/plain','acao:'+acao);
    e.dataTransfer.effectAllowed='copy';
}
function _fatDragStart(e){
    e.dataTransfer.setData('text/plain','campo:'+e.target.dataset.campo);
    e.dataTransfer.effectAllowed='copy';
}
// Chip de valor numérico (área "digite um valor e arraste"): só arrasta se o campo tiver um
// número válido — vírgula é aceita ao digitar mas sempre convertida pra ponto (o sistema TMS
// não aceita vírgula). Ficam esmaecidos/"not-allowed" até ter um número válido digitado.
function _fatValorInputChange(){
    const val=(document.getElementById('wFatValorInput')?.value||'').trim();
    const chip=document.getElementById('wFatValorChip');
    if(!chip)return;
    const valido=val!==''&&!isNaN(Number(val.replace(',','.')));
    chip.style.opacity=valido?'1':'.4';
    chip.style.cursor=valido?'grab':'not-allowed';
}
function _fatValorDragStart(e){
    const val=(document.getElementById('wFatValorInput')?.value||'').trim();
    const norm=val.replace(',','.');
    if(!val||isNaN(Number(norm))){e.preventDefault();return;}
    e.dataTransfer.setData('text/plain','valor:'+norm);
    e.dataTransfer.effectAllowed='copy';
}
// Rótulo completo (ícone + nome) de cada ação, igual aparece nos botões de arrastar -- usado pra
// mostrar dentro da área de montagem qual ação está ativa no momento (senão arrastar uma ação não
// deixa rastro nenhum visível ali, dando a falsa impressão de que não funcionou).
const _ACAO_LABELS={'+':'➕ Somar','-':'➖ Subtrair','*':'✖️ Multiplicar','/':'➗ Dividir','>':'> Maior que','<':'< Menor que','==':'== Igual','>=':'>= Maior ou igual','<=':'<= Menor ou igual'};
// Só o nome (sem ícone/símbolo) -- usado como conector entre os campos já soltos na área de
// montagem (ex.: "Tarifa Final" Somar "Pedágio"), pra ficar claro em palavras o que a regra tá
// fazendo ali, em vez de só o simbolo matemático cru.
const _ACAO_NOMES={'+':'Somar','-':'Subtrair','*':'Multiplicar','/':'Dividir','>':'Maior que','<':'Menor que','==':'Igual','>=':'Maior ou igual','<=':'Menor ou igual'};
// Mostra o nome da ação ativa logo depois do ÚLTIMO campo já soltado, mesmo com só 1 campo ainda
// -- assim já fica visual qual ação vai ser usada no próximo campo arrastado, sem precisar esperar
// soltar o segundo pra descobrir. Um pouco apagado (opacity) pra diferenciar de um conector "de
// verdade" (que já une 2 campos) de um que é só a prévia do que vai acontecer a seguir.
function _acaoPreviaTrailingHtml(acaoSel,corTexto){
    if(!acaoSel)return '';
    return `<span style="font-size:11.5px;color:${corTexto};font-weight:700;margin:0 3px;opacity:.55;">${escapeHtml(_ACAO_NOMES[acaoSel]||acaoSel)}</span>`;
}
// Selo mostrado no canto de cada quadro de soltar: "Ação ativa: X" no tema de quem chamou
// (Ct-e/Contrato/Faturamento, canvas ou condição) -- ou, se ainda não tiver nenhuma ação
// escolhida, um aviso em VERMELHO (sempre vermelho, independente do tema) pedindo pra escolher
// uma antes. Compartilhado pelos 3 criadores pra não repetir esse if 6 vezes.
function _acaoBadgeHtml(acaoSel,corBorda,corTexto){
    if(!acaoSel){
        return `<span style="position:absolute;top:-9px;left:10px;background:#fef2f2;border:1px solid #ef4444;border-radius:10px;padding:1px 8px;font-size:10px;color:#dc2626;font-weight:700;white-space:nowrap;">⚠️ Selecione uma ação antes</span>`;
    }
    return `<span style="position:absolute;top:-9px;left:10px;background:white;border:1px solid ${corBorda};border-radius:10px;padding:1px 8px;font-size:10px;color:${corTexto};font-weight:700;white-space:nowrap;">Ação ativa: ${escapeHtml(_ACAO_LABELS[acaoSel]||acaoSel)}</span>`;
}
// Converte o texto recebido no drop em um termo pra expressão: campo vira obt('campo'),
// valor numérico entra puro (sem obt) — é assim que se divide/multiplica por um número fixo.
function _fatTermoParaExpressao(raw){
    if(raw.startsWith('campo:')){
        const campo=raw.slice(6);
        // Campo com "." no nome (ex.: "tabelaPrecos.percSeguro") é propriedade externa — entra
        // como está, sem obt(); só campo do sistema (sem ponto) usa obt('campo').
        return campo.includes('.') ? campo : `obt('${campo}')`;
    }
    if(raw.startsWith('valor:')){
        const n=raw.slice(6);
        return /^-?\d+(\.\d+)?$/.test(n)?n:null;
    }
    return raw?`obt('${raw}')`:null;
}
// Extrai o nome pra mostrar num chip da área de montagem: obt('campo') ou obt("campo") vira só
// "campo" (aceita as duas aspas — ambas funcionam na regra), valor numérico fica como está —
// usado tanto no Contrato de Frete quanto no Faturamento.
// Mapa único campo->rótulo amigável, juntando as listas de campos de cada ferramenta (Ct-e,
// Tabela de Preços, Contrato de Frete) — usado só pra EXIBIR um nome mais fácil de entender na
// área de montagem; o nome interno (o que realmente monta a regra, dentro de obt('...') ou puro
// tipo "tabelaPrecos.x") nunca muda. Nenhum campo se repete entre as listas, então um mapa só
// (sem separar por ferramenta) é seguro.
const _ROTULOS_CAMPOS=(()=>{
    const mapa={};
    [CTE_CAMPOS, TABELA_PRECOS_CAMPOS, CONTRATO_FRETE_CAMPOS].forEach(lista=>{
        (lista||[]).forEach(c=>{ mapa[c.campo]=c.label; });
    });
    return mapa;
})();
function _termoParaLabel(termo){
    const m=termo.match(/^obt\(\s*["']([^"']*)["']\s*\)$/);
    const nome=m?m[1]:termo;
    if(_ROTULOS_CAMPOS[nome])return _ROTULOS_CAMPOS[nome];
    // "outrosValores[nomeInterno]" (campo personalizado, ver checkbox "Utiliza Valores outros")
    // mostra só o nome interno no chip — o resto ("outrosValores[...]") já fica visível no title.
    const mOutros=nome.match(/^outrosValores\[([^\]]*)\]$/);
    if(mOutros)return mOutros[1];
    return nome;
}
// Caminho inverso de _termoParaLabel -- usado no campo "Campo a definir", que mostra o rótulo
// amigável mas continua guardando o nome interno (o que realmente vai pro def(...) da regra).
// Se o texto digitado bater EXATAMENTE com o rótulo de algum campo conhecido, resolve pro nome
// interno; senão mantém o texto como está (permite digitar um nome de campo customizado, que não
// tem rótulo nenhum pra "traduzir").
function _labelParaTermoInterno(texto){
    const achou=Object.keys(_ROTULOS_CAMPOS).find(k=>_ROTULOS_CAMPOS[k]===texto);
    return achou||texto;
}
// Um termo de campo da Tabela de Preços entra puro na regra, sem obt() (ver _fatTermoParaExpressao)
// — usado pra destacar esses chips com a mesma cor âmbar da paleta "Campos disponíveis", separando
// visualmente dos campos do Ct-e (que continuam azuis) na área de montagem.
function _ehCampoTabelaPrecos(termo){
    return termo.startsWith('tabelaPrecos.');
}
// Um termo limpo tipo obt('campo') ou obt("campo") — SÓ isso, nada mais junto — é um campo do
// Ct-e "puro"; usado junto com _ehCampoTabelaPrecos pra colorir o chip (verde) na área de
// montagem igual a paleta. Número solto, expressão composta (ex.: "(100) - (obt('x'))") ou campo
// não identificado ficam de fora dos dois — não são um campo só, então continuam neutros.
function _ehCampoCte(termo){
    return /^obt\(\s*["'][^"']*["']\s*\)$/.test(termo);
}
// Campo personalizado digitado pelo usuário no checkbox "Utiliza Valores outros" — monta
// obt('outrosValores[nomeInterno]'). Checar ANTES de _ehCampoCte nos templates de chip: como é
// um obt(...) limpo também, bateria nos dois; esse aqui é mais específico e tem prioridade —
// usa uma cor própria (rosa) igual nas 3 ferramentas, diferente da cor nativa de cada uma.
function _ehCampoOutrosValores(termo){
    return /^obt\(\s*["']outrosValores\[[^\]]*\]["']\s*\)$/.test(termo);
}
// Tira as linhas de comentário (começam com "//") de uma "linha extra" (ver _parseRegraParaBlocos)
// — usado só pra EXIBIR dentro da caixa "⚡ Linha extra...": o comentário nunca aparece ali (mesmo
// quando vem misturado com código de verdade, tipo "//comentário" + "montaObs()" juntos na mesma
// extra), pra não arriscar o usuário achar que precisa mexer nele e acabar apagando à toa. O
// comentário continua preservado normalmente na regra final gerada (que usa ex.linha original,
// sem essa filtragem) — só o que aparece NA TELA muda. Se não sobrar nada (extra 100% comentário),
// a caixa inteira some.
function _semLinhasComentario(texto){
    return (texto||'').split('\n').filter(l=>!l.trim().startsWith('//')).join('\n').trim();
}
// Recalcula bloco.expr a partir de bloco.termos (lista de itens arrastados) depois de
// adicionar ou remover um item — intercala a ação de cada termo com o que já foi acumulado.
function _recalcExprDeTermos(bloco){
    if(!bloco.termos||!bloco.termos.length){ bloco.expr=null; return; }
    bloco.expr=bloco.termos.reduce((acc,t,i)=> i===0?t.termo:`(${acc}) ${t.acao} ${t.termo}`, null);
}
// Clona uma lista de blocos (usado ao capturar/restaurar estado pro botão Voltar) preservando
// "termos" e "condicao" como estruturas próprias — evita que a cópia guardada e a em uso
// compartilhem referência.
function _clonarBlocos(blocos){
    return (blocos||[]).map(b=>({
        ...b,
        termos: b.termos?b.termos.map(t=>({...t})):b.termos,
        condicao: b.condicao?{...b.condicao, termos:b.condicao.termos?b.condicao.termos.map(t=>({...t})):b.condicao.termos}:b.condicao
    }));
}
// Mescla o código de UMA opção (checkbox de "monte com um clique") no acumulado de blocos/extras
// que já está na área de montagem — sobrepõe (sem duplicar) qualquer definição já existente pro(s)
// MESMO "Campo a definir": a(s) definição(ões) nova(s) entra(m) bem na posição da primeira
// ocorrência antiga (não no final), pra manter a ordem de execução da regra — um campo lido mais
// adiante via obt() precisa continuar sendo definido antes dele, não depois. Genérica (não depende
// de qual ferramenta chamou) — reaproveitável por Ct-e/Contrato/Faturamento se precisar.
// opcoes (opcional): { antesDe: lista de destinos } — quando NÃO há nada pra sobrepor, o código novo entra antes do primeiro bloco cujo
// destino esteja na lista (ex.: a redução da base de cálculo entra antes de "valorICMS", que é calculado em cima dela) em vez de ir pro final.
function _mesclarOpcaoRegra(blocosAcumulados, extrasAcumuladas, codigoOpcao, opcoes){
    opcoes=opcoes||{};
    const {blocos:novosBlocos, extras:novasExtras}=_parseRegraParaBlocos(codigoOpcao);
    novosBlocos.forEach(_seedTermosBase);
    const destinos=new Set(novosBlocos.map(b=>b.destino));
    let blocos=[]; let inserido=false;
    (blocosAcumulados||[]).forEach(b=>{
        if(destinos.has(b.destino)){
            if(!inserido){ blocos.push(...novosBlocos); inserido=true; }
        }else{ blocos.push(b); }
    });
    if(!inserido){
        const idxRef=opcoes.antesDe?blocos.findIndex(b=>opcoes.antesDe.includes(b.destino)):-1;
        if(idxRef===-1) blocos.push(...novosBlocos); else blocos.splice(idxRef,0,...novosBlocos);
    }
    const novasExtrasLigadas=novasExtras.filter(e=>e.antesDe!==null);
    const novasExtrasSoltas=novasExtras.filter(e=>e.antesDe===null);
    // Cada extra acumulada ancorada num destino que está sendo substituído descrevia o trecho
    // antigo que está saindo — a opção nova normalmente já traz seu próprio comentário no lugar
    // (1 pra 1). Mas se a opção nova trouxer MENOS comentários "ligados" do que havia acumulado
    // pra esses destinos (inclusive zero, ex.: uma opção de cálculo de ICMS que não define
    // valorFrete, mesclada depois de uma que já tinha comentário de frete mínimo ali do lado) — o
    // que sobra não pode simplesmente desaparecer: fica preservado, na mesma posição relativa, pra
    // nunca perder comentário nenhum da regra (só troca de verdade o que realmente tem substituto).
    let extras=[]; let usadosNovos=0;
    (extrasAcumuladas||[]).forEach(e=>{
        if(e.antesDe!==null && destinos.has(e.antesDe)){
            if(usadosNovos<novasExtrasLigadas.length){ extras.push(novasExtrasLigadas[usadosNovos]); usadosNovos++; }
            else{ extras.push(e); }
        }else{ extras.push(e); }
    });
    if(usadosNovos<novasExtrasLigadas.length){ extras.push(...novasExtrasLigadas.slice(usadosNovos)); }
    extras.push(...novasExtrasSoltas);
    return {blocos, extras};
}
// Insere um bloco de código NOVO logo depois de um destino "âncora" já existente na área de
// montagem (ex.: Substituição Tributária tem que entrar dentro do bloco de cálculo do ICMS, não lá
// no final da regra, depois de Total Serviço). Diferente de _mesclarOpcaoRegra (substitui pelo
// destino em comum) e _aplicarSomaTermo (soma dentro de 1 campo só): aqui os destinos do código
// novo são TODOS NOVOS (não existem ainda), então a posição não dá pra descobrir por destino em
// comum -- é fixada pela âncora. Se a âncora ainda não existir na área de montagem (ex.: nenhum
// cálculo de ICMS foi montado ainda), cai no mesmo comportamento de sempre: insere no final, sem
// sumir com nada.
// opcoes (opcional): { ancoraUltima: usa a ÚLTIMA definição da âncora em vez da primeira (o código novo lê o valor FINAL dela);
// substituirExistentes: tira antes os blocos que já definiam os MESMOS destinos do código novo, pra não ficar duplicado }.
function _inserirOpcaoAposAncora(blocosAcumulados, extrasAcumuladas, codigoOpcao, destinoAncora, opcoes){
    opcoes=opcoes||{};
    const {blocos:novosBlocos, extras:novasExtras}=_parseRegraParaBlocos(codigoOpcao);
    novosBlocos.forEach(_seedTermosBase);
    let blocosBase=blocosAcumulados||[];
    if(opcoes.substituirExistentes){
        const destinosNovos=new Set(novosBlocos.map(b=>b.destino));
        blocosBase=blocosBase.filter(b=>!destinosNovos.has(b.destino));
    }
    let idxAncora=blocosBase.findIndex(b=>b.destino===destinoAncora);
    if(opcoes.ancoraUltima){ for(let i=blocosBase.length-1;i>=0;i--){ if(blocosBase[i].destino===destinoAncora){ idxAncora=i; break; } } }
    const blocos=idxAncora===-1
        ?[...blocosBase, ...novosBlocos]
        :[...blocosBase.slice(0,idxAncora+1), ...novosBlocos, ...blocosBase.slice(idxAncora+1)];
    const extras=[...(extrasAcumuladas||[]), ...novasExtras];
    return {blocos, extras};
}
// Acrescenta 1 termo a um campo que já está (ou não) na área de montagem, SEM substituir o que já
// tiver lá — ao contrário de _mesclarOpcaoRegra (troca o bloco inteiro), aqui é sempre um
// acréscimo (ex.: "somar obt('valorICMS') no totalPrestacao", mantendo valorFrete/outros/etc. que
// já estavam montados). Se o termo já estiver presente não duplica; se o campo ainda não existir,
// cria um bloco novo só com esse termo. Genérica, igual _mesclarOpcaoRegra.
function _aplicarSomaTermo(blocosAcumulados, extrasAcumuladas, campoAlvo, termoNovo){
    const idx=(blocosAcumulados||[]).findIndex(b=>b.destino===campoAlvo);
    if(idx===-1){
        const novoBloco={destino:campoAlvo, expr:null, termos:[{termo:termoNovo.termo, acao:null}]};
        _recalcExprDeTermos(novoBloco);
        return {blocos:[...(blocosAcumulados||[]), novoBloco], extras:extrasAcumuladas};
    }
    const blocos=blocosAcumulados.map((b,i)=>i!==idx?b:{...b, termos:(b.termos||[]).map(t=>({...t}))});
    const jaTem=blocos[idx].termos.some(t=>t.termo===termoNovo.termo);
    if(!jaTem) blocos[idx].termos.push({...termoNovo});
    _recalcExprDeTermos(blocos[idx]);
    return {blocos, extras:extrasAcumuladas};
}
// Versão do "Ct-e / Conhecimento Nova Versão" (opções "Somar X no Y", modo:'somarEm'): soma 1 termo em TODAS as definições do campo que realmente calculam algo
// — as que só valem um número fixo (ex.: "se a alíquota é 0, baseCalculo = 0") ficam como estão, senão a base de uma regra com 2 definições ficaria errada.
// Se a regra não calcula esse campo, NÃO inventa uma definição (def("totalPrestacao", só_o_termo) apagaria o cálculo do sistema, e somar o campo nele mesmo acumularia a
// cada execução): devolve tudo como estava, e quem chama avisa que a opção ficou sem efeito (ver _cnOpcaoSemEfeito, em regra-cte-passos.js).
function _aplicarSomaEmCampo(blocosAcumulados, extrasAcumuladas, campoAlvo, termoNovo){
    const fixo=b=>{ const e=String(b.expr==null?'':b.expr).trim(); return !e||/^\(*\s*-?\d+([.,]\d+)?\s*\)*$/.test(e); };
    const blocos=(blocosAcumulados||[]).map(b=>{
        if(b.destino!==campoAlvo||fixo(b))return b;
        const novo={...b, termos:(b.termos||[]).map(t=>({...t}))};
        _seedTermosBase(novo);
        if(!novo.termos.some(t=>t.termo===termoNovo.termo)) novo.termos.push({...termoNovo});
        _recalcExprDeTermos(novo);
        return novo;
    });
    return {blocos, extras:extrasAcumuladas};
}
// ─── Decompõe uma expressão em termos individuais (usado pra "abrir" o valor de um campo vindo
// de uma regra pré-definida em chips arrastáveis/removíveis individuais — mesma granularidade de
// quando o usuário monta arrastando campo por campo) ───
// Só decompõe o que é seguro sem arriscar mudar o resultado: sempre abre o lado ESQUERDO de cada
// operador (é a "espinha" da conta, já foi calculado da esquerda pra direita) e só abre o lado
// DIREITO quando ele tem o MESMO nível de precedência do operador atual (+/- com +/-, * ou / com
// * ou /) — nos outros casos (ex.: uma subexpressão "*" dentro de uma soma, tipo "a - b*c"), esse
// pedaço vira 1 termo só, com o texto original, pra não arriscar trocar o resultado da conta.
function _tokenizarExpressao(expr){
    const tokens=[]; let i=0; const n=expr.length;
    while(i<n){
        const c=expr[i];
        if(/\s/.test(c)){ i++; continue; }
        // Operadores de comparação (usados em condições) — os de 2 caracteres primeiro, senão
        // ">=" seria lido como ">" seguido de um "=" não reconhecido.
        if(expr.startsWith('==',i)){ tokens.push({tipo:'==',inicio:i,fim:i+2}); i+=2; continue; }
        if(expr.startsWith('>=',i)){ tokens.push({tipo:'>=',inicio:i,fim:i+2}); i+=2; continue; }
        if(expr.startsWith('<=',i)){ tokens.push({tipo:'<=',inicio:i,fim:i+2}); i+=2; continue; }
        if(c==='>'||c==='<'){ tokens.push({tipo:c,inicio:i,fim:i+1}); i++; continue; }
        if('()+-*/'.includes(c)){ tokens.push({tipo:c,inicio:i,fim:i+1}); i++; continue; }
        if(expr.startsWith("obt('",i)){
            const fimAspas=expr.indexOf("')",i+5);
            if(fimAspas===-1)return null;
            tokens.push({tipo:'obt',inicio:i,fim:fimAspas+2});
            i=fimAspas+2; continue;
        }
        // Mesma coisa com aspas duplas — ambas funcionam na regra, então o tokenizador aceita as
        // duas direto (além da normalização já feita antes em _parseRegraParaBlocos).
        if(expr.startsWith('obt("',i)){
            const fimAspas=expr.indexOf('")',i+5);
            if(fimAspas===-1)return null;
            tokens.push({tipo:'obt',inicio:i,fim:fimAspas+2});
            i=fimAspas+2; continue;
        }
        const mNum=/^\d+(\.\d+)?/.exec(expr.slice(i));
        if(mNum){ tokens.push({tipo:'num',inicio:i,fim:i+mNum[0].length}); i+=mNum[0].length; continue; }
        // Qualquer outra coisa — propriedade externa ("tabelaPrecos.percSeguro"), chamada de função
        // ("Math.ceil(...)"), campo não identificado da regra, etc. — vira 1 termo "livre" só,
        // igual um obt(...)/número (folha), SEM travar a tokenização inteira: só os operadores
        // continuam sendo o ponto de separação daqui pra frente, então "obt('a') + campoQualquer"
        // vira 2 itens mesmo sem reconhecer "campoQualquer". Consome até o próximo operador/espaço
        // do MESMO nível — rastreia parênteses (profundidade própria) pra não cortar no meio de uma
        // chamada de função nem "comer" um ")" que fecha um agrupamento de fora (ex.: em
        // "Math.ceil(x/100) + obt('a')" o "/" de dentro do parêntese não separa nada, só o "+" de
        // fora separa; o resultado fica com a chamada inteira como 1 termo).
        let j=i, prof=0;
        while(j<n){
            const cj=expr[j];
            if(cj==='('){ prof++; j++; continue; }
            if(cj===')'){
                if(prof===0)break;
                prof--; j++; continue;
            }
            if(prof===0){
                if(/\s/.test(cj))break;
                if(expr.startsWith('==',j)||expr.startsWith('>=',j)||expr.startsWith('<=',j))break;
                if('><+-*/'.includes(cj))break;
            }
            j++;
        }
        if(j===i)return null; // segurança — não deveria acontecer (sempre avança ao menos 1 char)
        tokens.push({tipo:'livre',inicio:i,fim:j});
        i=j; continue;
    }
    return tokens;
}
function _parseExpressaoAST(tokens){
    let pos=0;
    const ver=()=>tokens[pos];
    const pega=(tipo)=>{ const t=tokens[pos]; if(!t||(tipo&&t.tipo!==tipo))return null; pos++; return t; };
    function parseFactor(){
        const t=ver(); if(!t)return null;
        if(t.tipo==='-'){ pega('-'); const f=parseFactor(); if(!f)return null; return {tipo:'folha',inicio:t.inicio,fim:f.fim}; }
        if(t.tipo==='('){ pega('('); const e=parseExpr(); if(!e)return null; if(!pega(')'))return null; return e; }
        if(t.tipo==='obt'||t.tipo==='num'||t.tipo==='livre'){ pega(t.tipo); return {tipo:'folha',inicio:t.inicio,fim:t.fim}; }
        return null;
    }
    function parseTerm(){
        let no=parseFactor(); if(!no)return null;
        while(ver()&&(ver().tipo==='*'||ver().tipo==='/')){
            const opTok=pega(ver().tipo); const direita=parseFactor(); if(!direita)return null;
            no={tipo:'binop',op:opTok.tipo,esquerda:no,direita,inicio:no.inicio,fim:direita.fim};
        }
        return no;
    }
    function parseExpr(){
        let no=parseTerm(); if(!no)return null;
        while(ver()&&(ver().tipo==='+'||ver().tipo==='-')){
            const opTok=pega(ver().tipo); const direita=parseTerm(); if(!direita)return null;
            no={tipo:'binop',op:opTok.tipo,esquerda:no,direita,inicio:no.inicio,fim:direita.fim};
        }
        return no;
    }
    // Nível de condição: no máximo UMA comparação (>, <, ==, >=, <=) no topo — é assim que as
    // condições dos "if" são escritas nas regras (não há encadeamento tipo "a < b < c").
    function parseCondExpr(){
        let no=parseExpr(); if(!no)return null;
        if(ver()&&['>','<','==','>=','<='].includes(ver().tipo)){
            const opTok=pega(ver().tipo); const direita=parseExpr(); if(!direita)return null;
            no={tipo:'binop',op:opTok.tipo,esquerda:no,direita,inicio:no.inicio,fim:direita.fim};
        }
        return no;
    }
    const raiz=parseCondExpr();
    if(!raiz||pos!==tokens.length)return null; // sobrou token não consumido -> sintaxe não coberta
    return raiz;
}
// Reconstrói o texto de uma subárvore do zero, sempre com parênteses explícitos em cada lado —
// NUNCA fatia o texto original pra isso (fatiar pode incluir parênteses "soltos" que sobraram de
// um agrupamento interno já resolvido pelo parser, corrompendo o texto). Garante um texto válido
// que pode ser embutido em qualquer lugar sem mudar o resultado.
function _renderizarNode(node, expr){
    if(node.tipo==='folha') return expr.slice(node.inicio,node.fim).trim();
    return `(${_renderizarNode(node.esquerda,expr)}) ${node.op} (${_renderizarNode(node.direita,expr)})`;
}
// Verdadeiro só nas combinações comprovadamente seguras pra abrir o lado direito em 2 itens ao
// invés de 1 (ver _achatarNoAST): "+" por fora com "+" ou "-" por dentro, ou "*" por fora com "*"
// ou "/" por dentro — em QUALQUER outra combinação (ex.: "-" por fora, ou "*" por fora com "+"
// por dentro) reabrir troca o resultado da conta (testado e confirmado com valores reais).
function _seguroAbrirUmNivel(op, opDireita){
    return (op==='+' && (opDireita==='+'||opDireita==='-'))
        || (op==='*' && (opDireita==='*'||opDireita==='/'));
}
// Decompõe uma árvore em termos individuais: sempre abre o lado ESQUERDO por completo (é a
// "espinha" da conta, sempre seguro — é assim que a conta já foi calculada da esquerda pra
// direita). O lado DIREITO normalmente vira só 1 item — uma folha fica com seu texto puro,
// qualquer coisa mais complexa (outra conta) é reconstruída já entre parênteses, como um bloco
// fechado — EXCETO quando _seguroAbrirUmNivel confirma que dá pra abrir esse lado direito em 2
// itens sem mudar o resultado (ex.: "baseCalculo * (aliquota/100)" vira 3 itens ao invés de 2).
// Só abre 1 nível de cada vez (não desce recursivamente dentro do que acabou de abrir) — isso é
// proposital: já foram encontrados casos reais onde abrir mais fundo trocava o resultado, então
// aqui fica só no que já foi verificado matematicamente como seguro.
function _achatarNoAST(node, expr, saida){
    if(node.tipo==='folha'){ saida.push({termo:expr.slice(node.inicio,node.fim).trim(), acao:null}); return; }
    _achatarNoAST(node.esquerda, expr, saida);
    if(node.direita.tipo==='binop' && _seguroAbrirUmNivel(node.op, node.direita.op)){
        const {esquerda:esqD, direita:dirD, op:opD}=node.direita;
        const termoEsqD=esqD.tipo==='folha' ? expr.slice(esqD.inicio,esqD.fim).trim() : `(${_renderizarNode(esqD,expr)})`;
        const termoDirD=dirD.tipo==='folha' ? expr.slice(dirD.inicio,dirD.fim).trim() : `(${_renderizarNode(dirD,expr)})`;
        saida.push({termo:termoEsqD, acao:node.op});
        saida.push({termo:termoDirD, acao:opD});
        return;
    }
    const termoDireita=node.direita.tipo==='folha'
        ? expr.slice(node.direita.inicio,node.direita.fim).trim()
        : `(${_renderizarNode(node.direita,expr)})`;
    saida.push({termo:termoDireita, acao:node.op});
}
// Ponto de entrada: tenta decompor 'expr' em termos individuais; se a sintaxe não for reconhecida
// devolve null e quem chamou usa a expressão inteira como 1 termo só (mais seguro que arriscar
// montar errado).
function _decomporExpressao(expr){
    if(!expr)return null;
    const tokens=_tokenizarExpressao(expr);
    if(!tokens||!tokens.length)return null;
    const ast=_parseExpressaoAST(tokens);
    if(!ast)return null;
    const saida=[];
    _achatarNoAST(ast, expr, saida);
    return saida;
}
// Blocos vindos de uma regra pré-definida (ver _parseRegraParaBlocos) chegam só com "expr" —
// não foram montados arrastando, então não têm "termos". Sem isso, arrastar algo novo pra esse
// campo recalculava expr só a partir do novo item e apagava o valor original da regra.
// Aqui a expressão original é decomposta nos campos/valores individuais que a compõem — cada um
// vira seu próprio item na área de montagem, editável e removível igual a qualquer campo
// arrastado — e arrastar algo novo passa a ACRESCENTAR, não apagar.
function _seedTermosBase(bloco){
    if(!bloco.termos||!bloco.termos.length){
        bloco.termos = bloco.expr ? (_decomporExpressao(bloco.expr) || [{termo:bloco.expr, acao:null}]) : [];
    }
    // Idem pra condição: quando ela vem de um "if (...) def(...)" reconhecido pelo parser
    // (ver _tentarIfDef), decompõe nos campos/valores individuais também, editáveis do mesmo jeito.
    if(bloco.condicaoRaw && (!bloco.condicao || !bloco.condicao.termos || !bloco.condicao.termos.length)){
        bloco.condicao = { termos: _decomporExpressao(bloco.condicaoRaw) || [{termo:bloco.condicaoRaw, acao:null}], expr: bloco.condicaoRaw };
    }
    return bloco;
}
// Renderiza a lista de blocos (um por campo a definir) a partir de window._fatBlocos.
// Cada bloco tem seu campo de destino (verde, aceita digitar OU arrastar) e sua própria
// área de montagem — vira uma linha def("destino", expressao); na regra final.
function _fatRenderBlocos(){
    const cont=document.getElementById('wFatBlocosContainer');
    if(!cont)return;
    cont.innerHTML=window._fatBlocos.map((bloco,idx)=>{
        let canvasConteudo;
        if(bloco.termos&&bloco.termos.length){
            canvasConteudo=bloco.termos.map((t,tIdx)=>{
                const sep=tIdx>0?`<span style="font-size:11.5px;color:#059669;font-weight:700;margin:0 3px;">${escapeHtml(_ACAO_NOMES[t.acao]||t.acao||'')}</span>`:'';
                const label=_termoParaLabel(t.termo);
                const daOutros=_ehCampoOutrosValores(t.termo);
                const corBorda=daOutros?'#f9a8d4':'#6ee7b7', corFundo=daOutros?'#fdf2f8':'white', corTexto=daOutros?'#9d174d':'#065f46', corX=daOutros?'#be185d':'#059669';
                return `${sep}<span title="${escapeHtml(t.termo)}" style="display:inline-flex;align-items:center;gap:3px;padding:3px 4px 3px 9px;margin:2px 0;background:${corFundo};border:1px solid ${corBorda};border-radius:12px;font-size:11.5px;font-family:monospace;color:${corTexto};">${escapeHtml(label)}<button onclick="_fatRemoverTermo(${idx},${tIdx})" title="Remover este item" style="border:none;background:none;color:${corX};cursor:pointer;font-size:13px;padding:0 4px;line-height:1;font-weight:700;">✕</button></span>`;
            }).join('')+_acaoPreviaTrailingHtml(window._fatAcaoSel,'#059669');
        }else if(bloco.expr){
            canvasConteudo=`<span style="font-family:monospace;font-size:12.5px;color:#065f46;word-break:break-all;">${escapeHtml(bloco.expr)}</span>`;
        }else{
            canvasConteudo=`<span style="color:#9ca3af;font-size:12px;">Arraste campos aqui</span>`;
        }
        const btnLimparExpr=bloco.expr
            ?`<div style="text-align:right;margin-top:4px;"><button onclick="_fatLimparExprBloco(${idx})" title="Remover tudo o que foi arrastado aqui (mantém o nome do campo)" style="padding:3px 8px;background:none;border:1px dashed #6ee7b7;border-radius:6px;color:#059669;cursor:pointer;font-size:10.5px;">🧹 limpar o que foi arrastado</button></div>`
            :'';
        const btnRemover=window._fatBlocos.length>1
            ?`<button onclick="_fatRemoverBloco(${idx})" title="Remover esta definição" style="padding:7px 10px;background:#fef2f2;color:#991b1b;border:1.5px solid #fecaca;border-radius:6px;cursor:pointer;font-size:12px;">🗑️</button>`
            :'';
        let condSecao=`<label style="display:flex;align-items:center;gap:6px;font-size:11px;color:#92400e;cursor:pointer;margin:6px 0 8px;">
                <input type="checkbox" ${idx===0?'data-tour="condicao"':''} ${bloco.temCondicao?'checked':''} onchange="_fatToggleCondicao(${idx},this.checked)"> Definir condição?
            </label>`;
        if(bloco.temCondicao){
            const condTermos=(bloco.condicao&&bloco.condicao.termos)||[];
            const condConteudo=condTermos.length
                ?condTermos.map((t,tIdx)=>{
                    const sep=tIdx>0?`<span style="font-size:11.5px;color:#b45309;font-weight:700;margin:0 3px;">${escapeHtml(_ACAO_NOMES[t.acao]||t.acao||'')}</span>`:'';
                    const label=_termoParaLabel(t.termo);
                    const daOutros=_ehCampoOutrosValores(t.termo);
                    const corBorda=daOutros?'#f9a8d4':'#fcd34d', corFundo=daOutros?'#fce7f3':'white', corTexto=daOutros?'#9d174d':'#92400e', corX=daOutros?'#be185d':'#b45309';
                    return `${sep}<span title="${escapeHtml(t.termo)}" style="display:inline-flex;align-items:center;gap:3px;padding:3px 4px 3px 9px;margin:2px 0;background:${corFundo};border:1px solid ${corBorda};border-radius:12px;font-size:11.5px;font-family:monospace;color:${corTexto};">${escapeHtml(label)}<button onclick="_fatRemoverTermoCondicao(${idx},${tIdx})" title="Remover este item" style="border:none;background:none;color:${corX};cursor:pointer;font-size:13px;padding:0 4px;line-height:1;font-weight:700;">✕</button></span>`;
                }).join('')+_acaoPreviaTrailingHtml(window._fatAcaoSel,'#b45309')
                :`<span style="color:#b45309;font-size:12px;">Arraste campos aqui pra montar a condição</span>`;
            condSecao+=`<div style="margin:0 0 10px;padding-left:8px;border-left:3px solid #fbbf24;">
                <div style="font-size:10.5px;color:#92400e;margin-bottom:4px;">Condição — SE isso for verdade, o campo é definido:</div>
                <div ondragover="_fatCanvasDragOver(event)" ondrop="_fatCondicaoDrop(event,${idx})" style="position:relative;min-height:44px;padding:8px;border:1.5px dashed #f59e0b;border-radius:8px;background:#fffbeb;display:flex;align-items:center;flex-wrap:wrap;">
                    ${_acaoBadgeHtml(window._fatAcaoSel,'#fbbf24','#92400e')}
                    ${condConteudo}
                </div>
            </div>`;
        }
        return `<div style="border:1.5px solid #e5e7eb;border-radius:8px;padding:10px;margin-bottom:10px;">
            <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px;">
                <label style="font-size:11px;color:#374151;white-space:nowrap;">Campo a definir:</label>
                <input type="text" value="${escapeHtml(_termoParaLabel(bloco.destino))}" title="${escapeHtml(bloco.destino)}" placeholder="digite ou arraste um campo aqui"
                    ondragover="_fatDestinoDragOver(event)" ondrop="_fatDestinoDrop(event,${idx})" oninput="_fatDestinoInput(event,${idx})"
                    style="flex:1;padding:7px 10px;border:1.5px solid #10b981;border-radius:6px;font-size:12px;font-family:monospace;background:#f0fdf4;color:#065f46;font-weight:600;outline:none;">
                ${btnRemover}
            </div>
            ${condSecao}
            <div ondragover="_fatCanvasDragOver(event)" ondrop="_fatCanvasDrop(event,${idx})" style="position:relative;min-height:50px;padding:10px;border:1.5px dashed #10b981;border-radius:8px;background:#f0fdf4;display:flex;align-items:center;flex-wrap:wrap;">
                ${_acaoBadgeHtml(window._fatAcaoSel,'#6ee7b7','#065f46')}
                ${canvasConteudo}
            </div>
            ${btnLimparExpr}
        </div>`;
    }).join('');
    _fatRenderExtras();
    _fatAtualizarPreview();
}
function _fatCanvasDragOver(e){e.preventDefault();e.dataTransfer.dropEffect='copy';}
function _fatCanvasDrop(e,idx){
    e.preventDefault();
    const raw=e.dataTransfer.getData('text/plain');
    if(!raw)return;
    if(raw.startsWith('acao:')){ _fatSelecionarAcao(raw.slice(5)); _fatRenderBlocos(); return; }
    const termo=_fatTermoParaExpressao(raw);
    if(termo===null)return;
    const bloco=window._fatBlocos[idx];
    _seedTermosBase(bloco);
    if(bloco.termos.length&&!window._fatAcaoSel){ alert('Selecione uma ação antes de arrastar outro campo.'); return; }
    bloco.termos.push({termo, acao: bloco.termos.length?window._fatAcaoSel:null});
    _recalcExprDeTermos(bloco);
    _fatRenderBlocos();
}
// Liga/desliga a condição de um campo — ao ligar, cria a área de montagem da condição (vazia se
// for a primeira vez); ao desligar, só esconde (não perde o que já tinha montado, caso reative).
function _fatToggleCondicao(idx,marcado){
    const bloco=window._fatBlocos[idx];
    if(!bloco)return;
    bloco.temCondicao=marcado;
    if(marcado&&!bloco.condicao)bloco.condicao={termos:[],expr:null};
    _fatRenderBlocos();
}
// Arrastar campo/valor pra área de montagem da CONDIÇÃO (mesmo mecanismo do valor, só que guarda
// em bloco.condicao ao invés de no próprio bloco) — usa a mesma ação selecionada (>, <, ==, etc.).
function _fatCondicaoDrop(e,idx){
    e.preventDefault();
    const raw=e.dataTransfer.getData('text/plain');
    if(!raw)return;
    if(raw.startsWith('acao:')){ _fatSelecionarAcao(raw.slice(5)); _fatRenderBlocos(); return; }
    const termo=_fatTermoParaExpressao(raw);
    if(termo===null)return;
    const bloco=window._fatBlocos[idx];
    if(!bloco.condicao)bloco.condicao={termos:[],expr:null};
    if(bloco.condicao.termos.length&&!window._fatAcaoSel){ alert('Selecione uma ação antes de arrastar outro campo.'); return; }
    bloco.condicao.termos.push({termo, acao: bloco.condicao.termos.length?window._fatAcaoSel:null});
    _recalcExprDeTermos(bloco.condicao);
    _fatRenderBlocos();
}
function _fatRemoverTermoCondicao(idx,termoIdx){
    const bloco=window._fatBlocos[idx];
    if(!bloco||!bloco.condicao||!bloco.condicao.termos)return;
    bloco.condicao.termos.splice(termoIdx,1);
    _recalcExprDeTermos(bloco.condicao);
    _fatRenderBlocos();
}
function _fatDestinoDragOver(e){e.preventDefault();e.dataTransfer.dropEffect='copy';}
function _fatDestinoDrop(e,idx){
    e.preventDefault();
    const raw=e.dataTransfer.getData('text/plain');
    if(!raw)return;
    if(raw.startsWith('acao:')){ _fatSelecionarAcao(raw.slice(5)); _fatRenderBlocos(); return; }
    const nome=raw.startsWith('campo:')?raw.slice(6):raw.startsWith('valor:')?raw.slice(6):raw;
    window._fatBlocos[idx].destino=nome;
    _fatRenderBlocos();
}
function _fatDestinoInput(e,idx){
    window._fatBlocos[idx].destino=_labelParaTermoInterno(e.target.value);
    _fatAtualizarPreview();
}
function _fatAdicionarBloco(){
    window._fatBlocos.push({destino:'',expr:null});
    _fatRenderBlocos();
}
function _fatRemoverBloco(idx){
    if(window._fatBlocos.length<=1)return;
    window._fatBlocos.splice(idx,1);
    _fatRenderBlocos();
}
// Remove só um item arrastado dentro do campo — o resto do que já estava montado continua intacto.
function _fatRemoverTermo(idx,termoIdx){
    const bloco=window._fatBlocos[idx];
    if(!bloco||!bloco.termos)return;
    bloco.termos.splice(termoIdx,1);
    _recalcExprDeTermos(bloco);
    _fatRenderBlocos();
}
// Limpa só o que foi arrastado num campo (mantém o nome do "Campo a definir" e os demais campos).
function _fatLimparExprBloco(idx){
    const bloco=window._fatBlocos[idx];
    if(!bloco)return;
    bloco.expr=null;
    bloco.termos=[];
    _fatRenderBlocos();
}
// Linhas "extras" vêm de uma regra colada/pré-definida carregada no canvas (ver _parseRegraParaBlocos)
// que não cabem no modelo campo=expressão (chamada de método, bloco if) — mostradas como estão,
// só de leitura, com a posição onde entram na regra final (antes de qual campo, ou no final).
function _fatRenderExtras(){
    const cont=document.getElementById('wFatExtrasContainer');
    if(!cont)return;
    const extras=window._fatExtras||[];
    const visiveis=extras.map((ex,idx)=>({ex,idx,texto:_semLinhasComentario(ex.linha)})).filter(({texto})=>texto);
    if(!visiveis.length){ cont.innerHTML=''; return; }
    cont.innerHTML=visiveis.map(({ex,idx,texto})=>{
        const posLabel=ex.antesDe?`executa antes de definir <b>"${escapeHtml(ex.antesDe)}"</b>`:'executa no final da regra';
        return `<div style="border:1.5px dashed #f59e0b;border-radius:8px;padding:8px 10px;margin-bottom:8px;background:#fffbeb;">
            <div style="font-size:10.5px;color:#92400e;margin-bottom:4px;">⚡ Linha extra da regra original (mantida como está — ${posLabel}):</div>
            <pre style="margin:0 0 6px;font-family:monospace;font-size:11.5px;color:#78350f;white-space:pre-wrap;word-break:break-all;">${escapeHtml(texto)}</pre>
            <button onclick="_fatRemoverExtra(${idx})" style="padding:4px 10px;background:#fef2f2;color:#991b1b;border:1px solid #fecaca;border-radius:6px;cursor:pointer;font-size:11px;">🗑️ Remover esta linha</button>
        </div>`;
    }).join('');
}
function _fatRemoverExtra(idx){
    if(!window._fatExtras)return;
    window._fatExtras.splice(idx,1);
    _fatRenderExtras();
    _fatAtualizarPreview();
}
function _fatLinhasValidas(){
    const extras=window._fatExtras||[];
    const usadas=new Set(); // evita repetir a mesma extra quando 2 campos têm o mesmo nome — cada
    // extra só entra uma vez, na primeira ocorrência ainda não usada daquele nome, na ordem em que
    // apareciam na regra.
    const linhas=[];
    window._fatBlocos.forEach(b=>{
        if(b.destino&&b.destino.trim()){
            const idxExtra=extras.findIndex((ex,i)=>!usadas.has(i)&&ex.antesDe===b.destino.trim());
            if(idxExtra!==-1){ linhas.push(extras[idxExtra].linha); usadas.add(idxExtra); }
        }
        if(b.destino&&b.destino.trim()&&b.expr){
            const linhaDef=`def("${b.destino.trim()}", ${b.expr});`;
            if(b.temCondicao&&b.condicao&&b.condicao.expr){
                linhas.push(`if (${b.condicao.expr}) {`);
                linhas.push(`    ${linhaDef}`);
                linhas.push(`}`);
            }else{
                linhas.push(linhaDef);
            }
        }
    });
    extras.forEach((ex,i)=>{ if(!usadas.has(i)) linhas.push(ex.linha); });
    return linhas;
}
function _fatAtualizarPreview(){
    const linhas=_fatLinhasValidas();
    const preview=document.getElementById('wFatPreview');
    if(preview)preview.textContent=linhas.length?linhas.join('\n'):'// defina um campo (nome + arraste algo pra área de montagem)';
}
function _fatLimparCanvas(){
    window._fatBlocos=[{destino:'',expr:null}];
    window._fatExtras=[];
    const colar=document.getElementById('wFatColarRegra');
    if(colar)colar.value='';
    _fatRenderBlocos();
}
function _fatGerarRegraCustom(){
    const linhas=_fatLinhasValidas();
    if(linhas.length===0){alert('Defina ao menos um campo: dê um nome e arraste ao menos um campo pra área de montagem dele.');return;}
    _renderizarCardRegraSemIA(linhas.join('\n'));
}
// Preenche o canvas com a regra padrão ao invés de já gerar o resultado — o usuário parte dessa
// base pronta e edita/adiciona o que precisar (mesmo tratamento do Contrato de Frete).
function _fatUsarPredefinida(){
    const colar=document.getElementById('wFatColarRegra');
    if(colar)colar.value=FATURAMENTO_REGRA_PADRAO; // mantém o campo de colar em sincronia
    const {blocos,extras}=_parseRegraParaBlocos(FATURAMENTO_REGRA_PADRAO);
    window._fatBlocos=(blocos.length?blocos:[{destino:'',expr:null}]).map(_seedTermosBase);
    window._fatExtras=extras;
    _fatRenderBlocos();
}
// Campo "colar regra existente" — a cada edição (colar, digitar, apagar), reprocessa o texto e
// já monta os campos/definições na área de montagem, ao vivo, sem precisar clicar em nada.
function _fatColarRegraInput(){
    const texto=(document.getElementById('wFatColarRegra')?.value||'').trim();
    if(!texto){
        window._fatBlocos=[{destino:'',expr:null}];
        window._fatExtras=[];
        _fatRenderBlocos();
        return;
    }
    const {blocos,extras}=_parseRegraParaBlocos(texto);
    window._fatBlocos=(blocos.length?blocos:[{destino:'',expr:null}]).map(_seedTermosBase);
    window._fatExtras=extras;
    _fatRenderBlocos();
}
function _renderizarCardRegraSemIA(codigo){
    const wCard=document.getElementById('wizardFaturamentoCard');
    const _estadoForm=wCard?_capturarEstadoForm(wCard):null;
    const _fatExtra={acaoSel:window._fatAcaoSel,blocos:_clonarBlocos(window._fatBlocos),extras:(window._fatExtras||[]).map(e=>({...e}))};
    if(wCard)wCard.remove();
    _fecharBuilderModal();
    const s=Ferr.stream('regra');
    const c=document.createElement('div');c.className='answer-card';
    const ts=Date.now();
    c.id='_regraResultCard_'+ts;
    window['_regraVoltar_'+ts]={tipo:'faturamento',query:_wizardFaturamentoQuery,estadoForm:_estadoForm,fatExtra:_fatExtra};
    const escaped=codigo.replace(/</g,'&lt;').replace(/>/g,'&gt;');
    let h=`<div style="background:#ecfdf5;padding:8px 15px;border-bottom:1px solid #a7f3d0;font-size:11px;color:#065f46;font-weight:600;">💰 Regra de Faturamento — montada sem IA</div>`;
    h+=`<div class="answer-section"><div class="section-content"><div style="position:relative;margin:8px 0;"><pre class="regra-code">${escaped}</pre><button onclick="copiarRegra(this)" style="position:absolute;top:8px;right:8px;background:#313244;color:#a6e3a1;border:none;border-radius:5px;padding:3px 10px;font-size:11px;cursor:pointer;font-weight:600;">📋 Copiar</button></div></div></div>`;
    h+=`<div class="feedback-area"><button onclick="_voltarParaWizardRegra(${ts})" style="display:flex;align-items:center;gap:6px;padding:6px 14px;border:1.5px solid #1e40af;border-radius:8px;background:white;color:#1e40af;cursor:pointer;font-size:13px;font-weight:600;">🔙 Voltar</button>${ferrBotaoNovoHtml('regra')}</div>`;
    c.innerHTML=h;
    s.appendChild(c);
    ferrRolar('regra', true);
    ferrConversa('regra', 'ai',codigo);
    ferrLog('regra', 'Criar Regra Faturamento (montada sem IA)',true);
}

async function enviarWizardFaturamento(){
    const btn=document.getElementById('wFatBtnEnviar');
    if(btn){btn.disabled=true;btn.textContent='⏳ Gerando...';}
    // Idem Ct-e/Contrato de Frete: manda os DOIS — o estado de verdade da área de montagem
    // (_fatLinhasValidas) E o campo separado "regra existente" (wFatRegraCola, não ligado à área
    // de montagem) — senão qualquer um dos dois que o usuário tivesse preenchido se perdia ao
    // gerar com IA.
    const regraCola=(document.getElementById('wFatRegraCola')?.value||'').trim();
    const descricao=(document.getElementById('wFatDescricao')?.value||'').trim();
    const canvasTxt=_fatLinhasValidas().join('\n');
    const configTxt=[
        canvasTxt?'REGRA JA MONTADA NA AREA DE ARRASTAR CAMPOS (una com a solicitacao abaixo -- NAO descarte o que ja foi montado, so ajuste/complete conforme pedido):\n'+canvasTxt:'',
        regraCola?'\nREGRA EXISTENTE PARA EDITAR (colada separadamente):\n'+regraCola:'',
        descricao?'\nSOLICITACAO: '+descricao:'',
        _wizardFaturamentoQuery?'\nCONTEXTO: '+_wizardFaturamentoQuery:''
    ].filter(Boolean).join('\n');
    const sysMsg='Voce e um especialista em regras de Faturamento do Bsoft TMS.\nGere APENAS o codigo da regra pronto para uso, entre triple backticks, seguindo EXATAMENTE a sintaxe documentada abaixo (metodo $V para campos texto, metodo obt para campos valor). Use APENAS os campos documentados — NAO invente campos que nao estejam listados.\n\nUNIR REGRA JA MONTADA COM A SOLICITACAO:\nSe a mensagem do usuario tiver uma secao "REGRA JA MONTADA NA AREA DE ARRASTAR CAMPOS", essa e a regra que o usuario ja construiu manualmente -- ela e o PONTO DE PARTIDA. NUNCA descarte nem reescreva do zero o que ja esta montado. Una com a "SOLICITACAO": mantenha tudo que ja esta la e so adicione, ajuste ou complete exatamente o que foi pedido.\n\nDOCUMENTACAO:\n'+CONTEXTO_FATURAMENTO;
    const wCard=document.getElementById('wizardFaturamentoCard');
    const _estadoForm=wCard?_capturarEstadoForm(wCard):null;
    if(wCard)wCard.remove();
    _fecharBuilderModal();
    ferrMsg('regra', 'system','💰 <strong>Gerando regra de Faturamento...</strong>');
    const ld=ferrCarregando('regra', '💰 Elaborando regra de faturamento...');
    const li=Date.now();
    try{
        const result=await callMCPSemPensamento([{role:'system',content:sysMsg},{role:'user',content:'Monte a regra conforme a solicitacao abaixo.\n'+configTxt}],{temperature:0.15,maxTokens: REGRAS_MAX_TOKENS});
        ld.remove();
        renderizarCardRegra(result.text,li,result._iaUsada,result._iaModelo,'faturamento',{query:_wizardFaturamentoQuery,estadoForm:_estadoForm});
        ferrConversa('regra', 'ai',result.text);
    }catch(e){ld.remove();ferrMsg('regra', 'ai','❌ Erro ao gerar regra. Tente novamente.');}
}

async function gerarRespostaCriacaoRegra(pergunta) {
    ferrMsg('regra', 'system', '⚙️ <strong>Assistente de Criação de Regras</strong>');
    ferrConversa('regra', 'system', '⚙️ Assistente de Criação de Regras ativado');
    const ld = ferrCarregando('regra', "⚙️ Elaborando configuração de regra...");
    const li = Date.now();
    const systemMsg = `Você é um especialista em configuração de regras de frete do sistema Bsoft TMS. Responda de forma clara e objetiva, gerando o código de cálculo pronto para uso quando necessário. Use APENAS as funções def(), obt() e $SV() documentadas abaixo. Formate o código entre triple backticks.\n\nDEFINIÇÃO DE CAMPOS OCULTOS ($SV):\nPara definir um campo oculto sem gerar erro de "campo não encontrado", SEMPRE verifique se o elemento existe antes de usar $SV():\nif (document.getElementsByName('NOMECAMPO').length > 0) {\n   $SV('NOMECAMPO', obt("nomeInterno"));\n}\nNUNCA use $SV() direto sem essa verificação.\n\nDOCUMENTAÇÃO DO SISTEMA:\n${CONTEXTO_REGRAS}`;
    try {
        const result = await callMCPSemPensamento(
            [{ role: 'system', content: systemMsg }, { role: 'user', content: pergunta }],
            { temperature: 0.2, maxTokens: REGRAS_MAX_TOKENS }
        );
        ld.remove();
        renderizarCardRegra(result.text, li, result._iaUsada, result._iaModelo);
        ferrConversa('regra', 'ai', result.text);
    } catch(e) {
        ld.remove();
        ferrMsg('regra', 'ai', '❌ Erro ao gerar resposta. Tente novamente.');
        ferrConversa('regra', 'ai', '❌ Erro no assistente de regras.');
    }
}

// ─── "Voltar" nos wizards de Criar Regra — captura/restaura o formulário inteiro ───
// Captura todo input/textarea/select dentro de um container: por id (texto/textarea/select)
// e por name+value (radio/checkbox marcados). Arquivos (type=file) não dá pra restaurar
// por limitação do navegador — tratados à parte (ver extra do CT-e, com o base64 já lido).
function _capturarEstadoForm(containerEl) {
    const estado = { porId: {}, radios: {}, checkboxes: [] };
    if (!containerEl) return estado;
    containerEl.querySelectorAll('input,textarea,select').forEach(el => {
        if (el.type === 'radio') {
            if (el.checked) estado.radios[el.name] = el.value;
        } else if (el.type === 'checkbox') {
            if (el.checked) estado.checkboxes.push(el.id ? ('#' + el.id) : (el.name + '=' + el.value));
        } else if (el.type === 'file') {
            // ignorado — restaurado à parte quando aplicável (ex: imagens do CT-e)
        } else if (el.id) {
            estado.porId[el.id] = el.value;
        }
    });
    return estado;
}
function _restaurarEstadoForm(containerEl, estado) {
    if (!containerEl || !estado) return;
    // Radios primeiro — dispara 'change' pra abrir/fechar seções dependentes (wOnRegraPreChange etc.)
    Object.entries(estado.radios || {}).forEach(([name, val]) => {
        const el = containerEl.querySelector(`input[name="${name}"][value="${CSS.escape(val)}"]`);
        if (el) { el.checked = true; el.dispatchEvent(new Event('change', { bubbles: true })); }
    });
    (estado.checkboxes || []).forEach(chave => {
        let el;
        if (chave.startsWith('#')) el = document.getElementById(chave.slice(1));
        else { const [name, value] = chave.split('='); el = containerEl.querySelector(`input[name="${name}"][value="${CSS.escape(value)}"]`); }
        if (el) el.checked = true;
    });
    Object.entries(estado.porId || {}).forEach(([id, val]) => {
        const el = document.getElementById(id);
        if (el) el.value = val;
    });
}
// Reabre o wizard de origem (cte/contrato/faturamento) com tudo que o usuário tinha
// preenchido, pra não perder o trabalho parcial caso precise ajustar algo.
function _voltarParaWizardRegra(ts) {
    const dados = window['_regraVoltar_' + ts];
    if (!dados) return;
    const cardResultado = document.getElementById('_regraResultCard_' + ts); if (cardResultado) cardResultado.remove();
    const mapaCardId = { cte: 'wizardRegraCard', 'cte-dnd': 'wizardRegraDndCard', 'cte-nova': 'wizardRegraNovaCard', contrato: 'wizardContratoCard', 'contrato-dnd': 'wizardContratoDndCard', faturamento: 'wizardFaturamentoCard' };
    if (dados.tipo === 'cte') mostrarWizardRegra(dados.query || '');
    else if (dados.tipo === 'cte-dnd') mostrarWizardRegraDnd(dados.query || '');
    else if (dados.tipo === 'cte-nova') mostrarWizardRegraCteNova(dados.query || '');   // "Ct-e / Conhecimento Nova Versão" (js/app/regra-cte-passos.js)
    else if (dados.tipo === 'contrato') mostrarWizardContrato(dados.query || '');
    else if (dados.tipo === 'contrato-dnd') mostrarWizardContratoDnd(dados.query || '');
    else if (dados.tipo === 'faturamento') mostrarWizardFaturamento(dados.query || '');
    else return;
    const wCard = document.getElementById(mapaCardId[dados.tipo]);
    if (wCard) _restaurarEstadoForm(wCard, dados.estadoForm);
    if (dados.tipo === 'cte' && dados.cteExtra) {
        if (dados.cteExtra.cteB64) {
            _wizardCteBase64 = dados.cteExtra.cteB64;
            const zone = document.getElementById('wCteZone'), prev = document.getElementById('wCtePreview');
            if (zone) zone.style.borderColor = '#16a34a';
            if (prev) prev.innerHTML = `<img src="${dados.cteExtra.cteB64}" style="max-width:100%;max-height:130px;border-radius:6px;margin-top:6px;">`;
        }
        if (dados.cteExtra.tabelaB64) {
            _wizardTabelaBase64 = dados.cteExtra.tabelaB64;
            const zone = document.getElementById('wTabelaZone'), prev = document.getElementById('wTabelaPreview');
            if (zone) zone.style.borderColor = '#16a34a';
            if (prev) prev.innerHTML = `<img src="${dados.cteExtra.tabelaB64}" style="max-width:100%;max-height:130px;border-radius:6px;margin-top:6px;">`;
        }
    }
    if ((dados.tipo === 'cte-dnd' || dados.tipo === 'cte-nova') && dados.cteExtraDnd) {
        window._cteBlocos = (dados.cteExtraDnd.blocos && dados.cteExtraDnd.blocos.length) ? _clonarBlocos(dados.cteExtraDnd.blocos) : [{destino:'',expr:null}];
        window._cteExtras = (dados.cteExtraDnd.extras || []).map(e => ({...e}));
        const ob = dados.cteExtraDnd.opcionaisBase;   // base das opções "monte com um clique" (ver _renderizarCardRegraCteDndSemIA)
        window._cteOpcionaisBase = ob ? { blocos: _clonarBlocos(ob.blocos), extras: (ob.extras || []).map(e => ({...e})) } : null;
        _cteSelecionarAcao(dados.cteExtraDnd.acaoSel || null);
        _cteRenderBlocos();
    }
    if (dados.tipo === 'cte-dnd' || dados.tipo === 'cte-nova') _cteSincronizarEntradasOpcao();   // campo de valor das opções marcadas (ex.: % de redução) volta a aparecer
    if (dados.tipo === 'cte-nova') _cnAposRestaurar(dados.cteNova);   // realinha as telas do assistente com o que foi restaurado e volta à tela em que estava
    if (dados.tipo === 'contrato-dnd' && dados.cfdExtra) {
        window._cfdBlocos = (dados.cfdExtra.blocos && dados.cfdExtra.blocos.length) ? _clonarBlocos(dados.cfdExtra.blocos) : [{destino:'',expr:null}];
        window._cfdExtras = (dados.cfdExtra.extras || []).map(e => ({...e}));
        _cfdSelecionarAcao(dados.cfdExtra.acaoSel || null);
        _cfdRenderBlocos();
    }
    if (dados.tipo === 'faturamento' && dados.fatExtra) {
        window._fatBlocos = (dados.fatExtra.blocos && dados.fatExtra.blocos.length) ? _clonarBlocos(dados.fatExtra.blocos) : [{destino:'',expr:null}];
        window._fatExtras = (dados.fatExtra.extras || []).map(e => ({...e}));
        _fatSelecionarAcao(dados.fatExtra.acaoSel || null);
        _fatRenderBlocos();
    }
}

function renderizarCardRegra(texto, li, iaUsada, iaModelo, tipoRegra, estadoVoltar) {
    const s = Ferr.stream('regra');
    const c = document.createElement('div');
    c.className = 'answer-card';
    const formatado = texto
        .replace(/```[\w]*\n?([\s\S]*?)```/g, (_,code) => {
            const escaped = code.replace(/</g,'&lt;').replace(/>/g,'&gt;');
            return `<div style="position:relative;margin:8px 0;"><pre class="regra-code">${escaped}</pre><button onclick="copiarRegra(this)" style="position:absolute;top:8px;right:8px;background:#313244;color:#a6e3a1;border:none;border-radius:5px;padding:3px 10px;font-size:11px;cursor:pointer;font-weight:600;transition:all .15s;">📋 Copiar</button></div>`;
        })
        .replace(/\*\*(.*?)\*\*/g,'<b>$1</b>')
        .replace(/\n/g,'<br>');
    const modelo = (iaModelo||'').split('/').pop();
    const _rBadgeCfg = (iaUsada||'OpenRouter')==='Gemini'
        ? {emoji:'🌐',color:'#7c3aed',bg:'#f5f3ff',border:'#ddd6fe'}
        : (iaUsada||'OpenRouter')==='Custom'
        ? {emoji:'🔌',color:'#059669',bg:'#f0fdf4',border:'#bbf7d0'}
        : {emoji:'⚡',color:'#0369a1',bg:'#f0f9ff',border:'#bae6fd'};
    const badge = `<span style="font-size:10px;color:${_rBadgeCfg.color};background:${_rBadgeCfg.bg};padding:2px 7px;border-radius:10px;border:1px solid ${_rBadgeCfg.border};font-weight:600;">${_rBadgeCfg.emoji} ${iaUsada||'OpenRouter'}${modelo?' · '+modelo:''}</span>`;
    const ts = Date.now();
    if (tipoRegra && estadoVoltar) { c.id = '_regraResultCard_' + ts; window['_regraVoltar_' + ts] = { tipo: tipoRegra, ...estadoVoltar }; }
    const btnVoltar = (tipoRegra && estadoVoltar) ? `<button onclick="_voltarParaWizardRegra(${ts})" style="display:flex;align-items:center;gap:6px;padding:6px 14px;border:1.5px solid #1e40af;border-radius:8px;background:white;color:#1e40af;cursor:pointer;font-size:13px;font-weight:600;">🔙 Voltar</button>` : '';
    let h = `<div style="background:#f0fdf4;padding:8px 15px;border-bottom:1px solid #bbf7d0;font-size:11px;color:#166534;font-weight:600;">⚙️ Assistente de Criação de Regras — Bsoft TMS</div>`;
    h += `<div class="answer-section"><div class="section-content">${formatado}</div></div>`;
    h += `<div class="feedback-area"><span>Ajudou?</span><button class="feedback-btn" onclick="saveFeedback(${li},'positivo',this)">👍</button><button class="feedback-btn" onclick="saveFeedback(${li},'negativo',this)">👎</button>${btnVoltar}${ferrBotaoNovoHtml('regra')}<span style="margin-left:auto;">${badge}</span></div>`;
    c.innerHTML = h;
    s.appendChild(c);
    ferrRolar('regra', true);
}

function copiarRegra(btn) {
    const pre = btn.previousElementSibling;
    navigator.clipboard.writeText(pre.innerText).then(() => {
        btn.textContent = '✅ Copiado!';
        btn.style.background = '#166534';
        btn.style.color = 'white';
        setTimeout(() => { btn.textContent = '📋 Copiar'; btn.style.background = '#313244'; btn.style.color = '#a6e3a1'; }, 2200);
    }).catch(() => {
        const sel = window.getSelection(); const r = document.createRange();
        r.selectNodeContents(pre); sel.removeAllRanges(); sel.addRange(r);
        document.execCommand('copy');
        sel.removeAllRanges();
        btn.textContent = '✅ Copiado!'; btn.style.background = '#166534';
        setTimeout(() => { btn.textContent = '📋 Copiar'; btn.style.background = '#313244'; }, 2200);
    });
}
