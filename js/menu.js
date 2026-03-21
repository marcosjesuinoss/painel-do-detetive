/* =====================================
   MENU & PRIVACIDADE
===================================== */

function togglePrivacidade() {
  const area = getEl("areaRolagemJogo");
  const icone = getEl("iconePrivacidade");

  if (!area) return;
  area.classList.toggle("privado");
  privacidadeAtiva = area.classList.contains("privado");

  if (!icone) return;

  icone.style.opacity = "0";
  icone.style.transform = "scale(0.8)";

  setTimeout(() => {
    if (privacidadeAtiva) {
      icone.innerHTML = `
        <path d="M17.94 17.94A10.94 10.94 0 0112 19C5 19 1 12 1 12a21.77 21.77 0 015.06-6.94"/>
        <path d="M1 1l22 22"/>
      `;
    } else {
      icone.innerHTML = `
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
        <circle cx="12" cy="12" r="3"/>
      `;
    }

    icone.style.opacity = "1";
    icone.style.transform = "scale(1)";
  }, 150);
}

function toggleMenu() {
  const menu = getEl("menuLateral");
  const overlay = getEl("overlayMenu");
  const btn = getEl("btnMenu");

  if (!menu || !overlay || !btn) return;

  const aberto = menu.classList.contains("aberto");

  menu.classList.toggle("aberto", !aberto);
  overlay.classList.toggle("ativo", !aberto);
  btn.classList.toggle("ativo", !aberto);
}

function resetarMenu() {
  ["menuLateral", "overlayMenu", "btnMenu"].forEach((id) => {
    const el = getEl(id);
    if (el) el.classList.remove("aberto", "ativo");
  });
}

function irParaInicio() {
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
      <li>L\u00ea o que j\u00e1 est\u00e1 marcado na tabela em tempo real.</li>
      <li>Resume as \u00faltimas pistas realmente relevantes.</li>
      <li>Sugere a pr\u00f3xima pergunta para cortar mais possibilidades.</li>
      <li>Mostra um n\u00edvel de confian\u00e7a com base nas exclus\u00f5es atuais.</li>
      <li>No modo Pro, considera tamb\u00e9m que locais costumam ser escondidos quando o jogador pode revelar outra carta.</li>
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
