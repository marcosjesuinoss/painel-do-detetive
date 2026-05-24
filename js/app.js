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

  setTimeout(esconderSplash, 1400);
});
