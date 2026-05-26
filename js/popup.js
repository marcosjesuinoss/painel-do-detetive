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
  // "Limpar tabela" zera marcacoes e ESTADO DE SESSAO do assistente
  // (trincas/grupos, origens de duvida, pendencias do modo manual,
  // ultima mudanca narrada). PRESERVA configuracoes do popup do
  // assistente (ativo/automarcacao/nivel) - sao preferencias do usuario.
  // O reset de configuracoes (defaults) so acontece em "Novo Jogo" via
  // iniciarPartidaLimpa.
  localStorage.removeItem("estadoTabela");
  localStorage.removeItem("assistenteIAUltimaMudanca");

  if (typeof resetarGruposResposta === "function") {
    resetarGruposResposta();
  }
  if (typeof resetarOrigensDuvida === "function") {
    resetarOrigensDuvida();
  }
  if (typeof resetarPendenciasMarcacaoAssistenteIA === "function") {
    resetarPendenciasMarcacaoAssistenteIA();
  }
  if (typeof invalidarSnapshotAssistenteIA === "function") {
    invalidarSnapshotAssistenteIA();
  }
  if (typeof resetarHashRenderAssistenteIA === "function") {
    resetarHashRenderAssistenteIA();
  }
  // Limpa timer pendente de foco de inconsistencia (se usuario clicou
  // em alerta ha menos de 2.5s atras, o timer ainda esta agendado)
  if (typeof timerFocoInconsistenciaAssistenteIA !== "undefined" &&
      timerFocoInconsistenciaAssistenteIA) {
    clearTimeout(timerFocoInconsistenciaAssistenteIA);
    timerFocoInconsistenciaAssistenteIA = null;
  }

  fecharPopupLimpar();
  resetarMenu();
  resetarSelecoesGlobais();
  criarTabela();
  atualizarBotaoContinuar();
}
