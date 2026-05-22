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
  // "Limpar tabela" zera apenas as marcacoes; preserva a config do
  // assistente conforme o usuario tinha. O reset de config (defaults)
  // acontece apenas em "Novo Jogo" via iniciarPartidaLimpa.
  localStorage.removeItem("estadoTabela");
  fecharPopupLimpar();
  resetarMenu();
  resetarSelecoesGlobais();
  criarTabela();
  atualizarBotaoContinuar();
}
