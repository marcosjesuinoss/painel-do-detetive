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
  localStorage.removeItem("assistenteIAUltimaMudanca");

  // IA-020: ao limpar tabela, reseta config do assistente para defaults
  // (ativo, automarcacao, nivelExplicacao=objetiva). Mesma logica de
  // iniciarPartidaLimpa em partida.js - usuario espera inicio "do zero".
  if (typeof resetarConfiguracaoAssistenteIA === "function") {
    resetarConfiguracaoAssistenteIA();
  }
  if (typeof resetarPendenciasMarcacaoAssistenteIA === "function") {
    resetarPendenciasMarcacaoAssistenteIA();
  }

  fecharPopupLimpar();
  resetarMenu();
  resetarSelecoesGlobais();
  criarTabela();
  atualizarBotaoContinuar();
}
