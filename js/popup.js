/* =====================================
   POPUPS
===================================== */

function abrirPopup() {
  abrirOverlayAcessivel("popupConfirmar", ".botao-confirmar");
}

function fecharPopup() {
  fecharOverlayAcessivel("popupConfirmar");
}

function confirmarNovaPartida() {
  localStorage.removeItem("estadoTabela");
  fecharPopup();
  iniciarPartidaLimpa();
}

function abrirPopupLimpar() {
  abrirOverlayAcessivel("popupLimpar", ".botao-confirmar");
}

function fecharPopupLimpar() {
  fecharOverlayAcessivel("popupLimpar");
}

function confirmarLimpar() {
  // "Limpar tabela" zera marcacoes e ESTADO DE SESSAO do assistente
  // (trincas/grupos, origens de duvida, pendencias do modo manual,
  // ultima mudanca narrada). PRESERVA configuracoes do popup do
  // assistente (ativo/automarcacao/nivel) - sao preferencias do usuario.
  // O reset de configuracoes (defaults) so acontece em "Novo Jogo" via
  // iniciarPartidaLimpa.
  localStorage.removeItem("estadoTabela");
  localStorage.removeItem("assistenteIAUltimaMudanca");

  // Limpar tabuleiro reseta a pilha de undo - nao faz sentido permitir
  // desfazer uma limpeza explicita (usuario ja confirmou no popup)
  if (typeof resetarPilhaUndo === "function") {
    resetarPilhaUndo();
  }

  if (typeof resetarGruposResposta === "function") {
    resetarGruposResposta();
  }
  if (typeof resetarOrigensDuvida === "function") {
    resetarOrigensDuvida();
  }
  if (typeof resetarPendenciasMarcacaoAssistenteIA === "function") {
    resetarPendenciasMarcacaoAssistenteIA();
  }
  if (typeof invalidarSnapshotAssistenteIA === "function") {
    invalidarSnapshotAssistenteIA();
  }
  if (typeof resetarHashRenderAssistenteIA === "function") {
    resetarHashRenderAssistenteIA();
  }
  // Limpa timer pendente de foco de inconsistencia (se usuario clicou
  // em alerta ha menos de 2.5s atras, o timer ainda esta agendado)
  if (typeof timerFocoInconsistenciaAssistenteIA !== "undefined" &&
      timerFocoInconsistenciaAssistenteIA) {
    clearTimeout(timerFocoInconsistenciaAssistenteIA);
    timerFocoInconsistenciaAssistenteIA = null;
  }

  fecharPopupLimpar();
  resetarMenu();
  resetarSelecoesGlobais();
  criarTabela();
  atualizarBotaoContinuar();
}

/* =====================================
   POPUP "MINHAS CARTAS"
=====================================
   Aparece ao iniciar partida nova (logo apos a tabela renderizar).
   Usuario marca as cartas que tem na mao - confirma -> as N celulas
   de J1 viram V e as demais colunas dessas linhas viram X (ninguem
   mais pode ter aquela carta). Vale FREE e PRO. Conta como 1 jogada
   de undo. */

let cartasMinhasSelecionadas = new Set();

function obterLimiteCartasJ1() {
  try {
    const raw = localStorage.getItem("assistenteCartasPorJogador");
    if (!raw) return 0;
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr) || arr.length === 0) return 0;
    const n = parseInt(arr[0], 10);
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch {
    return 0;
  }
}

function abrirPopupMinhasCartas() {
  // Pre-requisitos: cartas geradas e config de distribuicao salva
  const limite = obterLimiteCartasJ1();
  if (!limite || !Array.isArray(cartas) || cartas.length === 0) {
    return; // sem config valida, simplesmente nao abre
  }

  cartasMinhasSelecionadas = new Set();

  const elTotal = getEl("contadorCartasMinhasTotal");
  const elAtual = getEl("contadorCartasMinhasAtual");
  const elTexto = getEl("textoPopupMinhasCartas");
  if (elTotal) elTotal.textContent = String(limite);
  if (elAtual) elAtual.textContent = "0";
  if (elTexto) {
    elTexto.textContent = limite === 1
      ? "Selecione a carta que esta na sua mao."
      : `Selecione as ${limite} cartas que estao na sua mao.`;
  }

  // Constroi grade 3 colunas (Suspeitos / Armas / Locais)
  const grade = getEl("gradeMinhasCartas");
  if (!grade) return;
  grade.innerHTML = "";

  const tipos = ["Suspeitos", "Armas", "Locais"];
  tipos.forEach((tipo) => {
    const secao = document.createElement("div");
    secao.className = "secao-cartas-minhas";

    const h4 = document.createElement("h4");
    h4.textContent = tipo;
    secao.appendChild(h4);

    const ul = document.createElement("ul");
    cartas.forEach((c, idx) => {
      if (c.tipo !== tipo) return;
      const li = document.createElement("li");
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "carta-minha";
      btn.dataset.idx = String(idx);
      btn.textContent = c.nome;
      btn.addEventListener("click", () => toggleCartaMinha(idx, btn));
      li.appendChild(btn);
      ul.appendChild(li);
    });
    secao.appendChild(ul);
    grade.appendChild(secao);
  });

  atualizarBotaoConfirmarMinhasCartas();
  abrirOverlayAcessivel("popupMinhasCartas", ".popup-box .padrao");
}

function toggleCartaMinha(idx, btn) {
  const limite = obterLimiteCartasJ1();

  if (cartasMinhasSelecionadas.has(idx)) {
    cartasMinhasSelecionadas.delete(idx);
    btn.classList.remove("selecionada");
  } else {
    // Bloqueia se ja atingiu o limite - usuario precisa desmarcar
    // alguma outra antes de selecionar uma nova
    if (cartasMinhasSelecionadas.size >= limite) {
      btn.classList.remove("bloqueada");
      void btn.offsetWidth; // reflow pra reiniciar a animacao
      btn.classList.add("bloqueada");
      setTimeout(() => btn.classList.remove("bloqueada"), 340);
      return;
    }
    cartasMinhasSelecionadas.add(idx);
    btn.classList.add("selecionada");
  }

  const elAtual = getEl("contadorCartasMinhasAtual");
  if (elAtual) elAtual.textContent = String(cartasMinhasSelecionadas.size);
  atualizarBotaoConfirmarMinhasCartas();
}

function atualizarBotaoConfirmarMinhasCartas() {
  const btn = getEl("btnConfirmarMinhasCartas");
  if (!btn) return;
  const limite = obterLimiteCartasJ1();
  const pronto = cartasMinhasSelecionadas.size === limite && limite > 0;
  btn.disabled = !pronto;
  btn.classList.toggle("botao-desativado", !pronto);
}

function pularMinhasCartas() {
  fecharOverlayAcessivel("popupMinhasCartas");
  cartasMinhasSelecionadas = new Set();
  // Trigger tooltip da trinca (PRO, 1x por partida nova) - so dispara
  // se as condicoes baterem (PRO + flag nao setado + btnMaybe existe).
  if (typeof mostrarTooltipTrincaPro === "function") {
    setTimeout(mostrarTooltipTrincaPro, 200);
  }
}

function confirmarMinhasCartas() {
  if (cartasMinhasSelecionadas.size === 0) return;
  const limite = obterLimiteCartasJ1();
  if (cartasMinhasSelecionadas.size !== limite) return; // defesa extra

  const jogadores = parseInt(localStorage.getItem("numJogadores") || "3", 10);

  // Marcacoes do popup NAO entram na pilha de undo (decisao do produto:
  // sao informacoes que o usuario forneceu explicitamente sobre a propria
  // mao - desfazer 1 a 1 ou via "Limpar tabuleiro" pra refazer).
  //
  // Aplica em batch direto no estado, sem passar por marcarCelula.
  // - Linhas SELECIONADAS: V em col 0 + X nas demais colunas da linha
  //   (ninguem mais pode ter aquela carta).
  // - Linhas NAO SELECIONADAS: X em col 0 (J1 nao tem essa carta - eh
  //   informacao certa, ja que o usuario escolheu suas N cartas).
  const estado = lerEstadoTabela();
  const totalCartas = Array.isArray(cartas) ? cartas.length : 0;

  for (let row = 0; row < totalCartas; row++) {
    if (cartasMinhasSelecionadas.has(row)) {
      estado[`${row}-0`] = "V";
      for (let col = 1; col < jogadores; col++) {
        estado[`${row}-${col}`] = "X";
      }
    } else {
      // Preenche J1 com X mesmo nas cartas nao selecionadas
      estado[`${row}-0`] = "X";
    }
  }
  localStorage.setItem("estadoTabela", JSON.stringify(estado));

  // Re-renderiza todas as celulas afetadas (linhas selecionadas: todas
  // as colunas; nao selecionadas: apenas col 0)
  for (let row = 0; row < totalCartas; row++) {
    const ehSelecionada = cartasMinhasSelecionadas.has(row);
    const colMax = ehSelecionada ? jogadores : 1;
    for (let col = 0; col < colMax; col++) {
      const chave = `${row}-${col}`;
      const cel = document.querySelector(`[data-key="${chave}"]`);
      if (cel) renderizarEstado(cel, estado[chave]);
    }
  }

  // Helpers de UI dependentes de V/X
  if (typeof atualizarEstadoVisualCartasEncontradas === "function") {
    atualizarEstadoVisualCartasEncontradas();
  }
  if (typeof atualizarDestaqueCartaOculta === "function") {
    atualizarDestaqueCartaOculta();
  }
  if (typeof atualizarAlertaDuplicidadePRO === "function") {
    atualizarAlertaDuplicidadePRO();
  }
  if (typeof atualizarBotaoContinuar === "function") {
    atualizarBotaoContinuar();
  }
  if (typeof agendarAtualizacaoAssistenteIA === "function") {
    agendarAtualizacaoAssistenteIA();
  }

  fecharOverlayAcessivel("popupMinhasCartas");
  cartasMinhasSelecionadas = new Set();
  // Trigger tooltip da trinca (PRO, 1x por partida nova)
  if (typeof mostrarTooltipTrincaPro === "function") {
    setTimeout(mostrarTooltipTrincaPro, 200);
  }
}
