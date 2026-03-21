/* =====================================
   TEMA
===================================== */

function atualizarBotaoTema(modo) {
  document
    .querySelectorAll(".botao-tema")
    .forEach((btn) =>
      btn.classList.toggle("tema-ativo", btn.dataset.tema === modo),
    );
}

function aplicarTema() {
  const modo = ler("temaEscolhido") || "auto";

  const sistemaClaro = window.matchMedia(
    "(prefers-color-scheme: light)",
  ).matches;

  const usarClaro = modo === "light" || (modo === "auto" && sistemaClaro);

  document.body.classList.toggle("light", usarClaro);
  atualizarBotaoTema(modo);

  try {
    if (typeof restaurarTemaPro === "function") {
      restaurarTemaPro();
    }
  } catch (erro) {
    console.error("Falha ao restaurar tema PRO:", erro);
  }

  try {
    if (typeof renderizarTemasAparencia === "function") {
      renderizarTemasAparencia();
    }
  } catch (erro) {
    console.error("Falha ao renderizar temas:", erro);
  }
}

function setTema(modo) {
  salvar("temaEscolhido", modo);
  aplicarTema();
}

const mediaTemaClaro = window.matchMedia("(prefers-color-scheme: light)");
if (mediaTemaClaro && typeof mediaTemaClaro.addEventListener === "function") {
  mediaTemaClaro.addEventListener("change", () => {
    if ((ler("temaEscolhido") || "auto") === "auto") {
      aplicarTema();
    }
  });
}
