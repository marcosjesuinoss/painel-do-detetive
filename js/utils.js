/* =====================================
   UTILITÁRIOS
===================================== */
let privacidadeAtiva = false; // usado por menu.js

function getEl(id) {
  return document.getElementById(id);
}

// ================================
//   ACESSIBILIDADE: POPUPS
// ================================

let popupAtivo = null;
let ultimoFocoPopup = null;

function obterElementosFocaveis(container) {
  if (!container) return [];
  const seletor =
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
  return Array.from(container.querySelectorAll(seletor))
    .filter((el) => !el.hasAttribute("disabled") && el.tabIndex !== -1);
}

function abrirOverlayAcessivel(popupId, firstFocusSelector) {
  const popup = document.getElementById(popupId);
  if (!popup) return;

  popup.classList.add("ativo");
  popup.setAttribute("aria-hidden", "false");

  popupAtivo = popup;
  ultimoFocoPopup = document.activeElement;

  const focaveis = obterElementosFocaveis(popup);
  let primeiro = focaveis[0];

  if (firstFocusSelector) {
    const preferido = popup.querySelector(firstFocusSelector);
    if (preferido) primeiro = preferido;
  }

  if (primeiro) {
    primeiro.focus();
  }

  function onKeyDown(e) {
    if (e.key === "Tab") {
      if (focaveis.length === 0) {
        e.preventDefault();
        return;
      }

      const atual = document.activeElement;
      let idx = focaveis.indexOf(atual);

      if (e.shiftKey) {
        idx = idx <= 0 ? focaveis.length - 1 : idx - 1;
      } else {
        idx = idx === focaveis.length - 1 ? 0 : idx + 1;
      }

      e.preventDefault();
      focaveis[idx].focus();
    }

    if (e.key === "Escape") {
      e.preventDefault();
      fecharOverlayAcessivel(popupId);
    }
  }

  popup._trapHandler = onKeyDown;
  popup.addEventListener("keydown", onKeyDown);
}

function fecharOverlayAcessivel(popupId) {
  const popup = document.getElementById(popupId);
  if (!popup) return;

  popup.classList.remove("ativo");
  popup.setAttribute("aria-hidden", "true");

  if (popup._trapHandler) {
    popup.removeEventListener("keydown", popup._trapHandler);
    delete popup._trapHandler;
  }

  if (ultimoFocoPopup && document.contains(ultimoFocoPopup)) {
    ultimoFocoPopup.focus();
  }

  popupAtivo = null;
}

function salvar(chave, valor) {
  localStorage.setItem(chave, valor);
}

function ler(chave) {
  return localStorage.getItem(chave);
}

function abrirFormulario() {
  abrirOverlayAcessivel("popupSugestao", ".popup-box .play");
}

function fecharPopupSugestao() {
  fecharOverlayAcessivel("popupSugestao");
}

function confirmarSugestao() {
  window.open(
    "https://docs.google.com/forms/d/e/1FAIpQLScuR5uFUDzG1lYRztYhejuXKm2zZaeTHJSRehWHdqHAsmOG8g/viewform?usp=header",
    "_blank",
  );
  fecharPopupSugestao();
}
