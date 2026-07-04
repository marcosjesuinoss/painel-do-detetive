/* =====================================
   TELAS
===================================== */

function mostrarTela(id) {
  if (id !== "ajuda" && typeof fecharTodosAccordions === "function") {
    fecharTodosAccordions();
  }

  document
    .querySelectorAll(".tela")
    .forEach((t) => t.classList.remove("ativa"));

  const tela = getEl(id);
  if (tela) {
    tela.classList.add("ativa");
    tela.scrollTop = 0;
  }

  if (id === "inicio") {
    atualizarBotaoContinuar();
  }

  if (id === "sobre") {
    atualizarTelaSobre();
  }
}
