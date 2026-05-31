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

// ============================================================================
// IA-032 (P9): garantirIntegridadeDistribuicaoCartasPartida()
// ============================================================================
// Valida e (se necessario) reconstroi assistenteCartasPorJogador no localStorage
// quando o jogo eh retomado apos pausa. Critico em 5/7 jogadores onde a
// distribuicao depende de selecao manual do usuario.
//
// Retorno: { valido, motivo, reconstruiu }
//   - valido: true se ao final dos checks/repairs o estado eh consistente
//   - motivo: string descrevendo o estado ("ok", "reconstruido-deterministico",
//             "reconstruido-coerencia", "fallback-degradado", "sem-partida",
//             "configuracao-invalida")
//   - reconstruiu: true se gravou de volta no localStorage (caller pode
//                  decidir invalidar caches/recriar UI)
//
// Esta funcao NAO modifica pendencias, tabela ou IA - eh apenas storage repair.
// IA-033 chama isso como parte da orquestracao de reidratacao.

function garantirIntegridadeDistribuicaoCartasPartida() {
  const numJogadores = parseInt(localStorage.getItem("numJogadores") || "0", 10);
  if (!numJogadores || numJogadores < 3 || numJogadores > 8) {
    return { valido: true, motivo: "sem-partida", reconstruiu: false };
  }

  const configuracao = obterConfiguracaoDistribuicaoCartas(numJogadores);
  if (!configuracao) {
    return { valido: false, motivo: "configuracao-invalida", reconstruiu: false };
  }

  // Le cartasPorJogador atual
  let cartasPorJogador = null;
  try {
    const raw = JSON.parse(
      localStorage.getItem("assistenteCartasPorJogador") || "null",
    );
    if (Array.isArray(raw) && raw.length === numJogadores) {
      const parsed = raw.map((v) => parseInt(v, 10));
      if (parsed.every((v) => Number.isFinite(v) && v > 0)) {
        cartasPorJogador = parsed;
      }
    }
  } catch {}

  // Caso 1: distribuicao deterministica (3/4/6/8 jogadores)
  if (!configuracao.precisaSelecionar) {
    const esperado = configuracao.cartasPorJogador;
    const igual =
      cartasPorJogador && esperado.every((v, i) => v === cartasPorJogador[i]);
    if (igual) {
      return { valido: true, motivo: "ok", reconstruiu: false };
    }
    localStorage.setItem(
      "assistenteCartasPorJogador",
      JSON.stringify(esperado),
    );
    localStorage.setItem("assistenteJogadoresMaisCartas", JSON.stringify([]));
    return {
      valido: true,
      motivo: "reconstruido-deterministico",
      reconstruiu: true,
    };
  }

  // Caso 2: 5 ou 7 jogadores - precisa selecao manual (assistenteJogadoresMaisCartas)
  let maisCartas = [];
  try {
    const raw = JSON.parse(
      localStorage.getItem("assistenteJogadoresMaisCartas") || "[]",
    );
    if (Array.isArray(raw)) {
      maisCartas = raw
        .map((v) => parseInt(v, 10))
        .filter((v) => Number.isFinite(v) && v >= 0 && v < numJogadores);
    }
  } catch {}

  const maisCartasValido =
    maisCartas.length === configuracao.quantidadeMaisCartas &&
    new Set(maisCartas).size === maisCartas.length; // sem duplicatas

  if (cartasPorJogador && maisCartasValido) {
    // Cross-check: cartasPorJogador deve refletir os indices em maisCartas
    const esperado = Array(numJogadores).fill(configuracao.cartasMenor);
    maisCartas.forEach((i) => {
      esperado[i] = configuracao.cartasMaior;
    });
    const igual = esperado.every((v, i) => v === cartasPorJogador[i]);
    if (igual) {
      return { valido: true, motivo: "ok", reconstruiu: false };
    }
    // Incoerencia entre as 2 chaves - prioriza maisCartas como verdade
    localStorage.setItem(
      "assistenteCartasPorJogador",
      JSON.stringify(esperado),
    );
    return {
      valido: true,
      motivo: "reconstruido-coerencia",
      reconstruiu: true,
    };
  }

  // Fallback degradado: maisCartas perdido ou invalido. Assume os N primeiros
  // jogadores ficam com mais cartas. Usuario pode ter que refazer a selecao
  // manualmente se isso nao corresponder ao jogo real, mas pelo menos o
  // assistente sai do estado quebrado.
  const maisCartasFallback = [];
  for (let i = 0; i < configuracao.quantidadeMaisCartas; i++) {
    maisCartasFallback.push(i);
  }
  const esperado = Array(numJogadores).fill(configuracao.cartasMenor);
  maisCartasFallback.forEach((i) => {
    esperado[i] = configuracao.cartasMaior;
  });
  localStorage.setItem(
    "assistenteCartasPorJogador",
    JSON.stringify(esperado),
  );
  localStorage.setItem(
    "assistenteJogadoresMaisCartas",
    JSON.stringify(maisCartasFallback),
  );
  return { valido: true, motivo: "fallback-degradado", reconstruiu: true };
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

  // Fix pre-existente: obterConfiguracaoDistribuicaoCartas() NAO inclui
  // numJogadores no retorno. Usar o parametro recebido aqui, nao
  // configuracao.numJogadores (que estava undefined - quebrava o loop).
  const numJog = parseInt(numJogadores, 10);

  configuracaoDistribuicaoPendente = {
    ...configuracao,
    numJogadores: numJog,
  };
  jogadoresMaisCartasSelecionados = new Set();

  titulo.textContent = "Quais jogadores estao com mais cartas?";
  subtitulo.textContent =
    numJog === 5
      ? "Em partidas com 5 jogadores, 4 jogadores ficam com 5 cartas e 1 jogador fica com 4."
      : "Em partidas com 7 jogadores, 3 jogadores ficam com 4 cartas e 4 jogadores ficam com 3.";
  texto.textContent = `Selecione ${configuracao.quantidadeMaisCartas} jogador(es).`;

  lista.innerHTML = "";

  for (let i = 0; i < numJog; i++) {
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

  // FREE: o popup so existe pra alimentar o assistente (PRO). Sem PRO,
  // salva uma distribuicao default (primeiros N jogadores com mais cartas)
  // e segue direto pra partida. Usuario nao perde nada porque nao tem
  // assistente pra usar essa info.
  const proAtivo = typeof isPRO === "function" && isPRO();
  if (!proAtivo) {
    const num = parseInt(numJogadores, 10);
    const maisCartas = [];
    for (let i = 0; i < configuracao.quantidadeMaisCartas; i++) {
      maisCartas.push(i);
    }
    const dist = Array(num).fill(configuracao.cartasMenor);
    maisCartas.forEach((i) => {
      dist[i] = configuracao.cartasMaior;
    });
    salvarDistribuicaoCartasPartida(dist, maisCartas);
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

  // IA-034: dispara reidratacao explicita (valida distribuicao + invalida
  // caches IA + recria tabela + atualiza assistente). Cobre o caso de
  // localStorage corrompido entre sessoes ou estado IA fora de fase.
  if (typeof retomarJogoComCarregamento === "function") {
    retomarJogoComCarregamento("continuar");
  }
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

  // IA-020/022: nova partida sempre reseta config do assistente para
  // defaults (ativo, automarcacao, nivelExplicacao=objetiva) e tambem
  // limpa pendencias de marcacao, grupos de resposta e origens de duvida.
  // NAO afeta "continuar".
  if (typeof resetarConfiguracaoAssistenteIA === "function") {
    resetarConfiguracaoAssistenteIA();
  }
  if (typeof resetarPendenciasMarcacaoAssistenteIA === "function") {
    resetarPendenciasMarcacaoAssistenteIA();
  }
  if (typeof resetarGruposResposta === "function") {
    resetarGruposResposta();
  }
  if (typeof resetarOrigensDuvida === "function") {
    resetarOrigensDuvida();
  }
  // IA-028: reseta hash do skip-render pra garantir 1o render na nova partida
  if (typeof resetarHashRenderAssistenteIA === "function") {
    resetarHashRenderAssistenteIA();
  }

  // Reseta pilha de undo - nova partida nao deve permitir desfazer
  // jogadas da partida anterior
  if (typeof resetarPilhaUndo === "function") {
    resetarPilhaUndo();
  }

  // Reseta flags dos tooltips educativos - reaparecem a cada partida
  // nova. NAO sao resetados em "Continuar" nem em "Limpar tabela" (so
  // iniciarPartidaLimpa passa por aqui).
  // - freeVTooltipNestaPartida: tooltip de 1o V no FREE
  // - proTrincaTooltipNestaPartida: tooltip de trinca de ? no PRO
  // - freeVTooltipMostrado: chave legada (lifetime) de versoes antigas
  localStorage.removeItem("freeVTooltipNestaPartida");
  localStorage.removeItem("proTrincaTooltipNestaPartida");
  localStorage.removeItem("freeVTooltipMostrado");

  resetarSelecoesGlobais();
  criarTabela();
  atualizarBotaoContinuar();
  mostrarTela("jogo");

  // Popup "Minhas cartas" so em partida nova - usuario seleciona quais
  // cartas estao na propria mao. Confirmar marca V em J1 + X nas outras
  // colunas dessas linhas (auto-marcacao). Tem botao "Pular" pra quem
  // nao quer usar. Em "Continuar partida" o popup NAO aparece.
  if (typeof abrirPopupMinhasCartas === "function") {
    abrirPopupMinhasCartas();
  }

  // Fallback: se o popup "Minhas cartas" nao abriu (sem config valida),
  // ainda dispara o tooltip da trinca PRO. As funcoes de close do popup
  // ja chamam isso quando o popup eh fechado normalmente.
  const popupAberto = document.getElementById("popupMinhasCartas")?.classList.contains("ativo");
  if (!popupAberto && typeof mostrarTooltipTrincaPro === "function") {
    setTimeout(mostrarTooltipTrincaPro, 300);
  }
}
