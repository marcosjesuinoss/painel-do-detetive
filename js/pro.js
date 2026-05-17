/* =====================================
   MODO PRO
===================================== */

/**
 * Ativa o Modo PRO
 */
function confirmarAtivarPRO() {
  salvar(
    "modoPRO",
    JSON.stringify({
      ativo: true,
      dataAtivacao: new Date().toISOString(),
    }),
  );

  fecharPopupAtivarPRO();
  atualizarStatusPRO();

  mostrarNotificacao("PRO Ativado com Sucesso!");
}

/**
 * Cancela o Modo PRO
 */
function confirmarCancelarPRO() {
  salvar(
    "modoPRO",
    JSON.stringify({
      ativo: false,
      dataCancelamento: new Date().toISOString(),
    }),
  );

  fecharPopupCancelarPRO();
  atualizarStatusPRO();

  mostrarNotificacao("PRO Cancelado");
}

/**
 * Atualiza os elementos visuais conforme status do PRO
 */
function atualizarStatusPRO() {
  const proDados = lerPRO();
  const statusEl = getEl("statusPRO");
  const statusTexto = getEl("statusTexto");
  const btnAtivar = getEl("btnAtivarPRO");
  const btnCancelar = getEl("btnCancelarPRO");
  const btnMenuPRO = getEl("btnMenuPRO");
  const assistenteIAMenu = getEl("assistenteIAMenu");
  const precoBox = document.querySelector("#pro .preco-box");
  const infoPro = document.querySelector("#pro .info-pro");

  if (!statusEl || !statusTexto || !btnAtivar || !btnCancelar) return;

  const statusIcon = statusEl.querySelector(".status-icon");
  const statusH2 = statusEl.querySelector("h2");

  if (proDados.ativo) {
    // PRO ATIVO
    statusEl.classList.remove("inativo");
    statusEl.classList.add("ativo");

    if (statusIcon) statusIcon.textContent = "ATIVO";
    if (statusH2) statusH2.textContent = "Modo PRO Ativo!";

    if (proDados.dataAtivacao) {
      statusTexto.textContent = `Ativado em ${new Date(proDados.dataAtivacao).toLocaleDateString("pt-BR")}`;
    } else {
      statusTexto.textContent = "Modo PRO ativo com recursos exclusivos liberados";
    }

    btnAtivar.style.display = "none";
    btnCancelar.style.display = "block";
    if (precoBox) precoBox.style.display = "none";
    if (infoPro) infoPro.style.display = "none";

    if (btnMenuPRO) {
      btnMenuPRO.style.display = "none";
      btnMenuPRO.disabled = true;
    }

    if (assistenteIAMenu) {
      assistenteIAMenu.style.display = "grid";
    }
    if (typeof atualizarAssistenteIA === "function") {
      atualizarAssistenteIA();
    }

    aplicarEfeitosPRO();
  } else {
    // PRO INATIVO
    statusEl.classList.add("inativo");
    statusEl.classList.remove("ativo");

    if (statusIcon) statusIcon.textContent = "";
    if (statusH2) statusH2.textContent = "Desbloqueie o Poder Total";
    statusTexto.textContent =
      "Ative o Modo PRO e ganhe acesso a recursos exclusivos";

    btnAtivar.style.display = "block";
    btnCancelar.style.display = "none";
    if (precoBox) precoBox.style.display = "block";
    if (infoPro) infoPro.style.display = "block";

    if (btnMenuPRO) {
      btnMenuPRO.textContent = "Ativar Modo PRO";
      btnMenuPRO.style.display = "block";
      btnMenuPRO.disabled = false;
      btnMenuPRO.style.opacity = "";
    }

    if (assistenteIAMenu) {
      assistenteIAMenu.style.display = "none";
    }

    removerEfeitosPRO();
  }

  if (typeof renderizarBeneficiosPRO === "function") {
    renderizarBeneficiosPRO();
  }

  if (typeof atualizarAlertaDuplicidadePRO === "function") {
    atualizarAlertaDuplicidadePRO();
  }
  if (proDados.ativo && typeof atualizarAssistenteIA === "function") {
    atualizarAssistenteIA();
  }
}

/**
 * Le o status do PRO do localStorage
 */
function lerPRO() {
  const proStr = ler("modoPRO");

  if (!proStr) {
    return { ativo: false };
  }

  try {
    return JSON.parse(proStr);
  } catch {
    return { ativo: false };
  }
}

/**
 * Verifica se PRO esta ativo
 */
function isPRO() {
  return lerPRO().ativo === true;
}

/**
 * Acao do botao PRO no menu lateral
 */
function acaoBotaoMenuPRO() {
  resetarMenu();
  mostrarTela("pro");
}

/**
 * Abre popup de ativacao
 */
function abrirAtivarPRO() {
  abrirOverlayAcessivel("popupAtivarPRO", ".popup-acoes .play");
}

/**
 * Fecha popup de ativacao
 */
function fecharPopupAtivarPRO() {
  fecharOverlayAcessivel("popupAtivarPRO");
}

/**
 * Abre popup de cancelamento
 */
function abrirCancelarPRO() {
  abrirOverlayAcessivel("popupCancelarPRO", ".popup-acoes .play, .popup-acoes .padrao");
}

/**
 * Fecha popup de cancelamento
 */
function fecharPopupCancelarPRO() {
  fecharOverlayAcessivel("popupCancelarPRO");
}

/**
 * Aplica efeitos visuais quando PRO esta ativo
 */
function aplicarEfeitosPRO() {
  document.body.classList.add("modo-pro");

  // Restaurar tema salvo ou aplicar tema padrao PRO
  setTimeout(() => {
    restaurarTemaPro();
  }, 100);
}

/**
 * Remove efeitos PRO
 */
function removerEfeitosPRO() {
  document.body.classList.remove("modo-pro");

  // Restaurar tema classico
  setTimeout(() => {
    aplicarTemaPro("classico");
  }, 100);
}

/**
 * Inicializa a tela PRO ao carregar
 */
function inicializarTelaPRO() {
  atualizarStatusPRO();
}

/**
 * Atualiza a tela Sobre baseada no status PRO
 */
function atualizarTelaSobre() {
  const proDados = lerPRO();
  const cardProEl = document.querySelector(".card-pro");
  const textoProEl = document.querySelector(".card-pro .texto-pro");
  const botaoProEl = document.querySelector(".card-pro .play");

  if (!textoProEl || !botaoProEl || !cardProEl) return;

  if (proDados.ativo) {
    cardProEl.classList.add("pro-ativo");

    let listaRecursosHtml = `
      <li>Assistente IA</li>
      <li>Alerta de carta encontrada</li>
      <li>Alerta de duplicidade</li>
      <li>Temas sofisticados</li>
      <li>Sem an\u00fancios</li>
    `;

    if (typeof gerarListaRecursosSobrePROHTML === "function") {
      listaRecursosHtml = gerarListaRecursosSobrePROHTML();
    }

    textoProEl.innerHTML = `
      <span class="pro-sobre-titulo">No modo Pro voc\u00ea tem</span>
      <ul class="pro-sobre-lista">
        ${listaRecursosHtml}
      </ul>
    `;

    botaoProEl.textContent = "Ver recursos Pro";
    botaoProEl.style.display = "none";
  } else {
    cardProEl.classList.remove("pro-ativo");

    textoProEl.innerHTML =
      "Quer elevar sua experi\u00eancia? Utilize o <strong>Modo Pro</strong> e tenha o aux\u00edlio de uma IA para analisar pistas e solucionar o jogo com mais intelig\u00eancia.";
    botaoProEl.textContent = "Ativar Modo Pro";
    botaoProEl.style.display = "block";
  }
}

// Atualizar status ao mostrar a tela PRO
document.addEventListener("DOMContentLoaded", () => {
  const observerPRO = new MutationObserver(() => {
    const telaPRO = getEl("pro");
    if (telaPRO && telaPRO.classList.contains("ativa")) {
      inicializarTelaPRO();
    }
  });

  const config = { attributes: true, attributeFilter: ["class"] };
  const telasPRO = document.querySelectorAll("#pro");
  telasPRO.forEach((el) => observerPRO.observe(el, config));

  const observerSobre = new MutationObserver(() => {
    const telaSobre = getEl("sobre");
    if (telaSobre && telaSobre.classList.contains("ativa")) {
      atualizarTelaSobre();
    }
  });

  const telasSobre = document.querySelectorAll("#sobre");
  telasSobre.forEach((el) => observerSobre.observe(el, config));

  inicializarTelaPRO();
  atualizarTelaSobre();
});










