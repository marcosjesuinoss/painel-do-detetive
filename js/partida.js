/* =====================================
   PARTIDA
===================================== */

let configuracaoDistribuicaoPendente = null;
let jogadoresMaisCartasSelecionados = new Set();

function obterConfiguracaoDistribuicaoCartas(numJogadores) {
  const num = parseInt(numJogadores, 10);

  if (num === 3) return { precisaSelecionar: false, cartasPorJogador: [8, 8, 8] };
  if (num === 4) return { precisaSelecionar: false, cartasPorJogador: [6, 6, 6, 6] };
  if (num === 5) {
    return {
      precisaSelecionar: true,
      quantidadeMaisCartas: 4,
      cartasMaior: 5,
      cartasMenor: 4,
    };
  }
  if (num === 6) return { precisaSelecionar: false, cartasPorJogador: [4, 4, 4, 4, 4, 4] };
  if (num === 7) {
    return {
      precisaSelecionar: true,
      quantidadeMaisCartas: 3,
      cartasMaior: 4,
      cartasMenor: 3,
    };
  }
  if (num === 8) return { precisaSelecionar: false, cartasPorJogador: [3, 3, 3, 3, 3, 3, 3, 3] };

  return null;
}

function salvarDistribuicaoCartasPartida(cartasPorJogador, jogadoresMaisCartas) {
  salvar("assistenteCartasPorJogador", JSON.stringify(cartasPorJogador));
  salvar("assistenteJogadoresMaisCartas", JSON.stringify(jogadoresMaisCartas || []));
}

function obterNomeJogadorPartida(indice) {
  return ler("nomeJogador" + (indice + 1)) || "J" + (indice + 1);
}

function fecharPopupDistribuicaoCartas() {
  jogadoresMaisCartasSelecionados = new Set();
  configuracaoDistribuicaoPendente = null;
  fecharOverlayAcessivel("popupDistribuicaoCartas");
}

function atualizarConfirmacaoPopupDistribuicaoCartas() {
  const btnConfirmar = getEl("btnConfirmarDistribuicaoCartas");
  const texto = getEl("textoPopupDistribuicaoCartas");
  const configuracao = configuracaoDistribuicaoPendente;

  if (!btnConfirmar || !texto || !configuracao) return;

  const selecionados = jogadoresMaisCartasSelecionados.size;
  const faltam = configuracao.quantidadeMaisCartas - selecionados;

  texto.textContent =
    faltam === 0
      ? "Selecao completa. O assistente vai usar essa distribuicao na deducao."
      : `Selecione ${configuracao.quantidadeMaisCartas} jogador(es). Faltam ${faltam}.`;

  btnConfirmar.disabled = faltam !== 0;
}

function alternarJogadorMaisCartas(indice) {
  const configuracao = configuracaoDistribuicaoPendente;
  if (!configuracao) return;

  if (jogadoresMaisCartasSelecionados.has(indice)) {
    jogadoresMaisCartasSelecionados.delete(indice);
  } else if (jogadoresMaisCartasSelecionados.size < configuracao.quantidadeMaisCartas) {
    jogadoresMaisCartasSelecionados.add(indice);
  }

  document.querySelectorAll(".item-jogador-cartas").forEach((botao) => {
    const idx = Number(botao.dataset.jogador);
    botao.classList.toggle("ativo", jogadoresMaisCartasSelecionados.has(idx));
  });

  atualizarConfirmacaoPopupDistribuicaoCartas();
}

function abrirPopupDistribuicaoCartas(numJogadores, configuracao) {
  const titulo = getEl("tituloPopupDistribuicaoCartas");
  const subtitulo = getEl("subtituloPopupDistribuicaoCartas");
  const lista = getEl("listaPopupDistribuicaoCartas");
  const texto = getEl("textoPopupDistribuicaoCartas");
  const btnConfirmar = getEl("btnConfirmarDistribuicaoCartas");

  if (!titulo || !subtitulo || !lista || !texto || !btnConfirmar) return;

  configuracaoDistribuicaoPendente = {
    ...configuracao,
    numJogadores: parseInt(numJogadores, 10),
  };
  jogadoresMaisCartasSelecionados = new Set();

  titulo.textContent = "Quais jogadores estao com mais cartas?";
  subtitulo.textContent =
    configuracao.numJogadores === 5
      ? "Em partidas com 5 jogadores, 4 jogadores ficam com 5 cartas e 1 jogador fica com 4."
      : "Em partidas com 7 jogadores, 3 jogadores ficam com 4 cartas e 4 jogadores ficam com 3.";
  texto.textContent = `Selecione ${configuracao.quantidadeMaisCartas} jogador(es).`;

  lista.innerHTML = "";

  for (let i = 0; i < configuracao.numJogadores; i++) {
    const botao = document.createElement("button");
    botao.type = "button";
    botao.className = "padrao item-jogador-cartas";
    botao.dataset.jogador = i;
    botao.textContent = obterNomeJogadorPartida(i);
    botao.onclick = () => alternarJogadorMaisCartas(i);
    lista.appendChild(botao);
  }

  btnConfirmar.disabled = true;
  abrirOverlayAcessivel("popupDistribuicaoCartas", ".item-jogador-cartas");
}

function prepararDistribuicaoCartasPartida(numJogadores) {
  const configuracao = obterConfiguracaoDistribuicaoCartas(numJogadores);
  if (!configuracao) return true;

  if (!configuracao.precisaSelecionar) {
    salvarDistribuicaoCartasPartida(configuracao.cartasPorJogador, []);
    return true;
  }

  abrirPopupDistribuicaoCartas(numJogadores, configuracao);
  return false;
}

function confirmarDistribuicaoCartasPartida() {
  const configuracao = configuracaoDistribuicaoPendente;
  if (!configuracao) return;

  const selecionados = Array.from(jogadoresMaisCartasSelecionados).sort((a, b) => a - b);
  if (selecionados.length !== configuracao.quantidadeMaisCartas) return;

  const cartasPorJogador = Array(configuracao.numJogadores).fill(configuracao.cartasMenor);
  selecionados.forEach((indice) => {
    cartasPorJogador[indice] = configuracao.cartasMaior;
  });

  salvarDistribuicaoCartasPartida(cartasPorJogador, selecionados);
  fecharPopupDistribuicaoCartas();
  iniciarPartidaLimpa(true);
}

function continuar() {
  if (!existeProgressoReal()) return;

  gerarCartas();
  criarTabela();
  mostrarTela("jogo");
}

function novaPartida() {
  if (existeProgressoReal()) {
    abrirPopup();
    return;
  }
  iniciarPartidaLimpa();
}

function iniciarPartidaLimpa(distribuicaoJaConfirmada = false) {
  gerarCartas();

  const elJogadores = getEl("jogadores");
  const jogadores = elJogadores?.value;

  if (!jogadores) {
    alert("Selecione a quantidade de jogadores.");
    return;
  }

  if (!distribuicaoJaConfirmada && !prepararDistribuicaoCartasPartida(jogadores)) {
    return;
  }

  salvar("numJogadores", jogadores);
  localStorage.removeItem("estadoTabela");
  localStorage.removeItem("assistenteIAUltimaMudanca");

  // Garantir que privacidade inicia desativada
  const area = getEl("areaRolagemJogo");
  if (area) area.classList.remove("privado");

  privacidadeAtiva = false;

  const icone = getEl("iconePrivacidade");
  if (icone) {
    icone.innerHTML = `
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    `;
  }

  resetarSelecoesGlobais();
  criarTabela();
  atualizarBotaoContinuar();
  mostrarTela("jogo");
}
