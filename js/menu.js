/* =====================================
   MENU
===================================== */

function toggleMenu() {
  const menu = getEl("menuLateral");
  const overlay = getEl("overlayMenu");
  const btn = getEl("btnMenu");

  if (!menu || !overlay || !btn) return;

  const aberto = menu.classList.contains("aberto");

  menu.classList.toggle("aberto", !aberto);
  overlay.classList.toggle("ativo", !aberto);
  btn.classList.toggle("ativo", !aberto);
  // body.menu-aberto -> CSS oculta os demais botoes do rodape (V/X/?/
  // Limpar/Undo) pra evitar marcacoes enquanto o menu esta aberto.
  document.body.classList.toggle("menu-aberto", !aberto);

  // ESC fecha o menu (acessibilidade). Listener so ativo enquanto aberto.
  if (!aberto) {
    document.addEventListener("keydown", _fecharMenuPorEsc);
  } else {
    document.removeEventListener("keydown", _fecharMenuPorEsc);
  }

  // Se o toast rewarded estiver visível ao abrir o menu, fecha — mas não
  // cancela o timer pendente (usuário pode abrir o menu antes dos 2 min)
  if (!aberto && typeof fecharSnackbarRewarded === "function") {
    const snackbar = document.getElementById("snackbarRewarded");
    if (snackbar && snackbar.classList.contains("visivel")) {
      fecharSnackbarRewarded();
    }
  }

  // IA-029: quando o menu ABRE, forca um update do assistente. Enquanto
  // o menu esta fechado, atualizarAssistenteIA pula o render (etapa 2) -
  // este trigger garante que ao abrir os cards refletem o estado atual.
  if (!aberto && typeof atualizarAssistenteIA === "function") {
    atualizarAssistenteIA();
  }
}

function _fecharMenuPorEsc(ev) {
  if (ev.key !== "Escape") return;
  const menu = getEl("menuLateral");
  if (menu && menu.classList.contains("aberto")) {
    toggleMenu();
  }
}

function resetarMenu() {
  ["menuLateral", "overlayMenu", "btnMenu"].forEach((id) => {
    const el = getEl(id);
    if (el) el.classList.remove("aberto", "ativo");
  });
  document.body.classList.remove("menu-aberto");
  document.removeEventListener("keydown", _fecharMenuPorEsc);
}

function irParaInicio() {
  if (typeof notificarSaidaPartida === "function") notificarSaidaPartida();
  resetarMenu();
  mostrarTela("inicio");
}

let toastAjudaIA = null;
let timerAjudaIA = null;
let limparEventosAjudaIA = null;

function fecharAjudaAssistenteIA() {
  if (timerAjudaIA) {
    clearTimeout(timerAjudaIA);
    timerAjudaIA = null;
  }

  if (typeof limparEventosAjudaIA === "function") {
    limparEventosAjudaIA();
    limparEventosAjudaIA = null;
  }

  if (toastAjudaIA) {
    toastAjudaIA.remove();
    toastAjudaIA = null;
  }
}

function montarToastAjudaAssistenteIA() {
  const toast = document.createElement("div");
  toast.className = "toast-ia-ajuda toast-ia-ajuda-destaque";
  toast.innerHTML = `
    <div class="toast-ia-cabecalho">
      <strong>Como o assistente funciona</strong>
    </div>
    <ul class="toast-ia-lista">
      <li>Analisa suas marca\u00e7\u00f5es em tempo real e deduz cartas automaticamente.</li>
      <li>Sugere a pr\u00f3xima pergunta pra eliminar mais hip\u00f3teses.</li>
      <li>Mostra n\u00edvel de confian\u00e7a (Alta, M\u00e9dia, Baixa) baseado nas exclus\u00f5es atuais.</li>
      <li>Alerta inconsist\u00eancias: marca\u00e7\u00f5es contradit\u00f3rias ou imposs\u00edveis (graves) e situa\u00e7\u00f5es de aten\u00e7\u00e3o (leves).</li>
      <li>Conjunto de "?": selecione coluna + 3 linhas e toque "?" pra registrar "o jogador mostrou uma destas 3".</li>
      <li>Considera que locais costumam ser escondidos quando o jogador tamb\u00e9m pode revelar suspeito ou arma.</li>
    </ul>
  `;
  return toast;
}

function posicionarToastAjudaAssistenteIA(botao) {
  if (!toastAjudaIA || !botao) return;

  const rect = botao.getBoundingClientRect();
  const margem = 12;
  const espacamento = 8;
  const larguraToast = toastAjudaIA.offsetWidth;
  const alturaToast = toastAjudaIA.offsetHeight;
  const larguraTela = window.innerWidth;
  const alturaTela = window.innerHeight;

  let left = rect.right - larguraToast;
  left = Math.max(margem, Math.min(left, larguraTela - larguraToast - margem));

  let top = rect.bottom + espacamento;
  if (top + alturaToast > alturaTela - margem) {
    top = Math.max(margem, rect.top - alturaToast - espacamento);
  }

  toastAjudaIA.style.left = `${left}px`;
  toastAjudaIA.style.top = `${top}px`;
}

function mostrarAjudaAssistenteIA(event) {
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }

  if (toastAjudaIA) {
    fecharAjudaAssistenteIA();
    return;
  }

  const botao = event?.currentTarget || event?.target || null;

  toastAjudaIA = montarToastAjudaAssistenteIA();
  document.body.appendChild(toastAjudaIA);
  posicionarToastAjudaAssistenteIA(botao);

  timerAjudaIA = setTimeout(() => {
    fecharAjudaAssistenteIA();
  }, 10000);

  const eventos = ["pointerdown", "touchstart", "wheel", "keydown", "resize", "scroll"];
  const fecharPorGesto = (evt) => {
    const alvo = evt?.target;
    if (
      alvo &&
      typeof alvo.closest === "function" &&
      alvo.closest(".ia-info-geral")
    ) {
      return;
    }
    fecharAjudaAssistenteIA();
  };

  setTimeout(() => {
    eventos.forEach((ev) =>
      window.addEventListener(ev, fecharPorGesto, {
        once: true,
        capture: true,
      }),
    );

    limparEventosAjudaIA = () => {
      eventos.forEach((ev) =>
        window.removeEventListener(ev, fecharPorGesto, { capture: true }),
      );
    };
  }, 0);
}
