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

function reidratarTelaJogoAoRetomar(origem) {
  // IA-031: placeholder minimo. IA-033 expande pra orquestrador completo
  // (validar distribuicao, recriar tabela, repintar, restaurar snapshot IA,
  // overlay de loading).

  // Filtro 1: so reage se o usuario esta na tela do jogo
  const tela = document.getElementById("jogo");
  if (!tela || !tela.classList.contains("ativa")) return;

  // Filtro 2: ignora retomadas muito curtas (< 3s desde a ultima saida).
  // Eventos como focus quando o usuario so passa o mouse sobre a janela
  // nao precisam disparar reidratacao pesada.
  try {
    const ultimaSaida = parseInt(
      localStorage.getItem("jogoUltimaSaida") || "0",
      10,
    );
    const agora = Date.now();
    if (ultimaSaida && agora - ultimaSaida < 3000) return;
  } catch {}

  // IA-032: valida e (se necessario) reconstroi distribuicao de cartas
  let resultadoDist = null;
  if (typeof garantirIntegridadeDistribuicaoCartasPartida === "function") {
    try {
      resultadoDist = garantirIntegridadeDistribuicaoCartasPartida();
    } catch (erro) {
      console.error("Falha em garantirIntegridadeDistribuicaoCartasPartida:", erro);
    }
  }

  // Toast visual temporario - IA-031 nao tem efeito perceptivel sem isso
  // em mobile (sem console acessivel). Sera removido na IA-033 quando o
  // overlay real de loading entrar em cena.
  const sufixoDist = resultadoDist
    ? ` | dist: ${resultadoDist.motivo}${resultadoDist.reconstruiu ? " (rebuild)" : ""}`
    : "";
  mostrarToastRetomadaP9TEMP(`retomada: ${origem}${sufixoDist}`);

  // Se houve rebuild, invalida cache do snapshot da IA e reseta hash do skip
  // pra forcar render fresco (snapshot le cartasPorJogador).
  if (resultadoDist && resultadoDist.reconstruiu) {
    if (typeof invalidarSnapshotAssistenteIA === "function") {
      invalidarSnapshotAssistenteIA();
    }
    if (typeof resetarHashRenderAssistenteIA === "function") {
      resetarHashRenderAssistenteIA();
    }
  }

  // Acao minima da IA-031: forca update do assistente (que rerruna deducoes
  // + render dos cards se menu visivel). Suficiente pra ressincronizar
  // visual com localStorage no caso comum.
  if (typeof atualizarAssistenteIA === "function") {
    atualizarAssistenteIA();
  }
}

// IA-031 TEMP: toast visual de debug pra validacao em mobile (sem console).
// Sera removido quando IA-033 introduzir overlay de loading real.
function mostrarToastRetomadaP9TEMP(texto) {
  try {
    const toast = document.createElement("div");
    toast.textContent = texto;
    toast.style.cssText = [
      "position:fixed",
      "bottom:20px",
      "left:50%",
      "transform:translateX(-50%)",
      "background:rgba(0,0,0,0.85)",
      "color:#fff",
      "padding:8px 14px",
      "border-radius:8px",
      "font-size:13px",
      "z-index:99999",
      "font-family:sans-serif",
      "pointer-events:none",
      "transition:opacity 0.3s",
      "opacity:1",
      "max-width:80vw",
      "text-align:center",
    ].join(";");
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = "0";
    }, 1500);
    setTimeout(() => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 1900);
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

  executarEtapaInicial("icone-privacidade", () => {
    const area = getEl("areaRolagemJogo");
    const icone = getEl("iconePrivacidade");

    if (area && icone) {
      const ativo = area.classList.contains("privado");

      icone.innerHTML = ativo
        ? '<path d="M17.94 17.94A10.94 10.94 0 0112 19C5 19 1 12 1 12a21.77 21.77 0 015.06-6.94"/><path d="M1 1l22 22"/>'
        : '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>';
    }
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
      if (celulaSelecionada) {
        marcarCelula(celulaSelecionada, "");
      } else {
        resetarSelecoesGlobais();
        atualizarDestaques();
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
