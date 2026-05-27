/* =====================================
   EVENTOS INICIAIS
===================================== */

function esconderSplash() {
  const splash = document.getElementById("splashScreen");
  if (!splash || splash.dataset.oculto === "true") return;

  splash.dataset.oculto = "true";
  splash.style.opacity = "0";
  setTimeout(() => splash.remove(), 400);
}

function executarEtapaInicial(nome, callback) {
  try {
    callback();
  } catch (erro) {
    console.error(`Falha na etapa inicial: ${nome}`, erro);
  }
}

// ============================================================================
// IA-031: LISTENERS DE RETOMADA DO JOGO (P9 - inicio)
// ============================================================================
// Registra handlers que disparam reidratacao quando o usuario volta de tela
// bloqueada, troca de aba/app, ou foco da janela. Coalesce eventos proximos
// via debounce simples - varios eventos viram 1 retomada.
//
// Nesta etapa (IA-031), o reidratarTelaJogoAoRetomar() eh um placeholder
// minimo: so dispara atualizarAssistenteIA() quando esta na tela "jogo".
// IA-033 vai expandir pra orquestrar validacao de distribuicao + recriar
// tabela + repintar + restaurar snapshot IA + overlay de loading.

let timerRetomadaJogoAssistenteIA = null;

function agendarRetomadaJogoComCarregamento(origem) {
  // Debounce 200ms: visibilitychange+focus+pageshow podem disparar em
  // sequencia. Coalesce em 1 unica retomada.
  if (timerRetomadaJogoAssistenteIA) {
    clearTimeout(timerRetomadaJogoAssistenteIA);
  }
  timerRetomadaJogoAssistenteIA = setTimeout(() => {
    timerRetomadaJogoAssistenteIA = null;
    try {
      reidratarTelaJogoAoRetomar(origem);
    } catch (erro) {
      console.error("Falha em reidratarTelaJogoAoRetomar:", erro);
    }
  }, 200);
}

// IA-034: flag anti-overlap. Multiplos eventos (visibilitychange + focus +
// pageshow) podem disparar em sequencia. Se uma reidratacao ja esta em curso,
// novos pedidos sao ignorados ate que termine (overlay esconda).
let reidratacaoEmAndamentoP9 = false;

// IA-033: orquestrador completo da reidratacao apos retomada do jogo.
// Mostra overlay -> valida distribuicao -> recria tabela -> atualiza assistente
// -> esconde overlay (com minimo de 300ms pra evitar flash).
//
// IA-034: aceita opts.ignorarFiltros pra entrada via API publica
// (retomarJogoComCarregamento) onde a chamada eh explicita do usuario
// e nao deve ser bloqueada pelos filtros de tela/tempo.
function reidratarTelaJogoAoRetomar(origem, opts) {
  if (reidratacaoEmAndamentoP9) return; // IA-034: coalesce

  const ignorarFiltros = !!(opts && opts.ignorarFiltros);

  // Filtro 1: so reage se o usuario esta na tela do jogo
  if (!ignorarFiltros) {
    const tela = document.getElementById("jogo");
    if (!tela || !tela.classList.contains("ativa")) return;
  }

  // Filtro 2: ignora retomadas muito curtas (< 3s desde a ultima saida).
  // Eventos como focus quando o usuario so passa o mouse sobre a janela
  // nao precisam disparar reidratacao pesada.
  if (!ignorarFiltros) {
    try {
      const ultimaSaida = parseInt(
        localStorage.getItem("jogoUltimaSaida") || "0",
        10,
      );
      const agora = Date.now();
      if (ultimaSaida && agora - ultimaSaida < 3000) return;
    } catch {}
  }

  reidratacaoEmAndamentoP9 = true;
  const inicio = Date.now();
  mostrarOverlayRetomada();

  // Defere o trabalho pesado pra proximo frame pra dar tempo do overlay
  // pintar na tela antes (evita "freeze" percebido).
  requestAnimationFrame(() => {
    try {
      // 1. Valida e (se necessario) reconstroi distribuicao de cartas
      let resultadoDist = null;
      if (typeof garantirIntegridadeDistribuicaoCartasPartida === "function") {
        try {
          resultadoDist = garantirIntegridadeDistribuicaoCartasPartida();
        } catch (erro) {
          console.error(
            "Falha em garantirIntegridadeDistribuicaoCartasPartida:",
            erro,
          );
        }
      }

      // 2. Invalida caches da IA (snapshot + hash de skip-render)
      if (typeof invalidarSnapshotAssistenteIA === "function") {
        invalidarSnapshotAssistenteIA();
      }
      if (typeof resetarHashRenderAssistenteIA === "function") {
        resetarHashRenderAssistenteIA();
      }

      // 3. Atualiza visual da tabela. Estrategia inteligente pra evitar
      // GPU pressure desnecessario (iOS Safari perde shadows/gradients sob
      // stress):
      //   - Tabela vazia OU distribuicao reconstruida -> criarTabela completo
      //   - Caso comum (mesma partida continuando) -> apenas refresh dos
      //     visuais sem reinjetar DOM (muito mais leve)
      const area = document.getElementById("tabela");
      const tabelaExiste = !!(area && area.children.length > 0);
      const precisaRecriar =
        !tabelaExiste || (resultadoDist && resultadoDist.reconstruiu);

      if (precisaRecriar && typeof criarTabela === "function") {
        try {
          criarTabela();
        } catch (erro) {
          console.error("Falha em criarTabela durante reidratacao:", erro);
        }
      } else {
        // Refresh leve - apenas atualiza classes/destaques sem recriar DOM
        try {
          if (typeof atualizarEstadoVisualCartasEncontradas === "function")
            atualizarEstadoVisualCartasEncontradas();
          if (typeof atualizarDestaqueCartaOculta === "function")
            atualizarDestaqueCartaOculta();
          if (typeof atualizarAlertaDuplicidadePRO === "function")
            atualizarAlertaDuplicidadePRO();
          if (typeof atualizarDestaques === "function") atualizarDestaques();
          if (typeof atualizarBotoes === "function") atualizarBotoes();
          if (typeof atualizarBotaoContinuar === "function")
            atualizarBotaoContinuar();
        } catch (erro) {
          console.error("Falha no refresh visual leve da reidratacao:", erro);
        }
      }

      // 4. Forca update do assistente (rerruna deducoes + render dos cards
      // se menu visivel)
      if (typeof atualizarAssistenteIA === "function") {
        atualizarAssistenteIA();
      }

      console.log(
        `[reidratacao] origem=${origem} dist=${resultadoDist ? resultadoDist.motivo : "n/a"}${resultadoDist && resultadoDist.reconstruiu ? " (rebuild)" : ""}`,
      );
    } finally {
      // Min duration 300ms pro overlay nao piscar - se o trabalho foi rapido,
      // aguarda completar antes de esconder
      const decorrido = Date.now() - inicio;
      const espera = Math.max(0, 300 - decorrido);
      setTimeout(() => {
        esconderOverlayRetomada();
        reidratacaoEmAndamentoP9 = false; // IA-034: libera para proxima
      }, espera);
    }
  });
}

// IA-034: API publica pra outros modulos pedirem reidratacao explicitamente
// (continuar do menu, recovery flows, etc.). Pula filtros de tela/tempo -
// caller eh responsavel por estar no contexto certo. Coalesce via
// reidratacaoEmAndamentoP9 garante que chamadas simultaneas nao duplicam.
function retomarJogoComCarregamento(origem) {
  reidratarTelaJogoAoRetomar(origem, { ignorarFiltros: true });
}

function mostrarOverlayRetomada() {
  const overlay = document.getElementById("overlayRetomada");
  if (!overlay) return;

  // Texto adapta ao modo (PRO menciona o assistente, FREE soh tabela).
  // Re-aplicado sempre - se PRO mudou desde a ultima exibicao, atualiza.
  const txt = overlay.querySelector(".overlay-retomada-texto");
  if (txt) {
    const isProAtivo = typeof isPRO === "function" && isPRO();
    txt.textContent = isProAtivo
      ? "Carregando informações da tabela e iniciando assistente de IA..."
      : "Carregando informações da tabela...";
  }

  overlay.hidden = false;
  overlay.setAttribute("aria-hidden", "false");

  // Fix iOS Safari: forca restart da animacao do spinner. Em transicoes
  // como troca de tema, o navegador pode pausar animacoes CSS - o truque
  // de remover/restaurar a propriedade animation re-dispara.
  const spinner = overlay.querySelector(".overlay-retomada-spinner");
  if (spinner) {
    spinner.style.animation = "none";
    // Forca reflow pra garantir que a remocao "tomou efeito"
    void spinner.offsetWidth;
    spinner.style.animation = ""; // remove o override inline, volta ao CSS
  }
}

function esconderOverlayRetomada() {
  const overlay = document.getElementById("overlayRetomada");
  if (!overlay) return;
  overlay.hidden = true;
  overlay.setAttribute("aria-hidden", "true");

  // Defesa contra bug iOS Safari: apos overlay sumir, alguns elementos
  // (botoes de acao, células, cards) podem ficar sem shadows/gradients
  // ate o proximo repaint manual. Forcamos repaint adicionando+removendo
  // uma classe vazia no body, que dispara recalc de estilo sem efeito visual.
  try {
    document.body.classList.add("forcar-repaint-pos-retomada");
    // leitura de offsetHeight forca o navegador a fazer reflow sincrono
    void document.body.offsetHeight;
    requestAnimationFrame(() => {
      document.body.classList.remove("forcar-repaint-pos-retomada");
    });
  } catch {}
}

function registrarSaidaJogoAssistenteIA() {
  try {
    localStorage.setItem("jogoUltimaSaida", String(Date.now()));
  } catch {}
}

document.addEventListener("DOMContentLoaded", () => {
  executarEtapaInicial("botoes-voltar", () => {
    document
      .querySelectorAll(".btn-voltar")
      .forEach((btn) =>
        btn.addEventListener("click", () => mostrarTela(btn.dataset.destino)),
      );
  });

  executarEtapaInicial("atalhos-inicio", () => {
    getEl("btnNovoJogo")?.addEventListener("click", () =>
      mostrarTela("novoJogo"),
    );

    getEl("btnContinuar")?.addEventListener("click", continuar);
    getEl("btnIniciar")?.addEventListener("click", novaPartida);
    getEl("btnIniciarPersonalizado")?.addEventListener("click", novaPartida);
  });

  executarEtapaInicial("estado-inicial", () => {
    atualizarJogadores();
    aplicarTema();
    atualizarBotaoContinuar();
  });

  executarEtapaInicial("botao-undo", () => {
    document.getElementById("btnUndo")?.addEventListener("click", () => {
      if (typeof aplicarUndo === "function") aplicarUndo();
    });
    // Estado inicial do botao reflete pilha persistida (ex.: usuario fechou
    // o app no meio do jogo - ao voltar, undo continua disponivel)
    if (typeof atualizarBotaoUndo === "function") atualizarBotaoUndo();
  });

  executarEtapaInicial("service-worker", () => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("./sw.js")
        .then((reg) => {
          console.log("Service Worker registrado");
          reg.update();

          reg.addEventListener("updatefound", () => {
            const newWorker = reg.installing;
            newWorker.addEventListener("statechange", () => {
              if (newWorker.state === "installed") {
                if (navigator.serviceWorker.controller) {
                  window.location.reload();
                }
              }
            });
          });
        })
        .catch((err) => console.log("Erro ao registrar SW:", err));
    }
  });

  executarEtapaInicial("acoes-jogo", () => {
    document.getElementById("btnTrue")?.addEventListener("click", () => {
      if (celulaSelecionada) marcarCelula(celulaSelecionada, "V");
    });

    document.getElementById("btnFalse")?.addEventListener("click", () => {
      if (celulaSelecionada) {
        marcarCelula(celulaSelecionada, "X");
        return;
      }

      const linhasAtivas = Object.values(linhasSelecionadas).filter(
        (l) => l !== null,
      );

      if (colunaSelecionada !== null && linhasAtivas.length === 3) {
        aplicarTrincaX();
      }
    });

    document.getElementById("btnMaybe")?.addEventListener("click", () => {
      if (celulaSelecionada) {
        marcarCelula(celulaSelecionada, "?");
        return;
      }

      const linhasAtivas = Object.values(linhasSelecionadas).filter(
        (l) => l !== null,
      );

      if (colunaSelecionada !== null && linhasAtivas.length === 3) {
        aplicarTrincaResposta();
      }
    });

    document.getElementById("btnClearSel")?.addEventListener("click", () => {
      // Prioridade em DUAS etapas:
      //  1) Se ha uma celula selecionada (mesmo com linha/coluna juntas),
      //     primeiro apaga o conteudo da celula.
      //  2) Proximo clique (ja sem celula), reseta selecoes de linha/coluna.
      if (celulaSelecionada) {
        marcarCelula(celulaSelecionada, "");
      } else {
        const temColuna = colunaSelecionada !== null;
        const temLinha = Object.values(linhasSelecionadas).some((l) => l !== null);
        if (temColuna || temLinha) {
          resetarSelecoesGlobais();
          atualizarDestaques();
        }
      }
    });
  });

  executarEtapaInicial("listeners-retomada", () => {
    // IA-031: 4 fontes de evento de retomada/saida
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        agendarRetomadaJogoComCarregamento("visibilitychange-visible");
      } else {
        registrarSaidaJogoAssistenteIA();
      }
    });
    window.addEventListener("pageshow", () => {
      agendarRetomadaJogoComCarregamento("pageshow");
    });
    window.addEventListener("focus", () => {
      agendarRetomadaJogoComCarregamento("focus");
    });
    window.addEventListener("pagehide", () => {
      registrarSaidaJogoAssistenteIA();
    });
  });

  setTimeout(esconderSplash, 1400);
});
