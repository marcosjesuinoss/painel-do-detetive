/* =====================================
   VERIFICAR PROGRESSO REAL
===================================== */

function existeProgressoReal() {
  try {
    const estado = JSON.parse(localStorage.getItem("estadoTabela") || "{}");
    return Object.values(estado).some(valor => valor !== "");
  } catch {
    return false;
  }
}

/* =====================================
   CONTROLE DO BOTÃO CONTINUAR
===================================== */

function atualizarBotaoContinuar() {
  const btn = document.getElementById("btnContinuar");
  if (!btn) return;

  btn.classList.toggle("botao-desativado", !existeProgressoReal());
}