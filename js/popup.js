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
  localStorage.removeItem("estadoTabela");
  fecharPopupLimpar();
  resetarMenu();
  resetarSelecoesGlobais();
  criarTabela();
  atualizarBotaoContinuar();
}
