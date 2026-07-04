/* =====================================
   MODO PRO
===================================== */

/**
 * Atualiza os elementos visuais conforme status do PRO
 */
function atualizarStatusPRO() {
  const proDados = lerPRO();
  const statusEl = getEl("statusPRO");
  const statusTexto = getEl("statusTexto");
  const btnMenuPRO = getEl("btnMenuPRO");
  const assistenteIAMenu = getEl("assistenteIAMenu");
  // Wrapper das secoes que so aparecem no estado INATIVO (preco + CTA +
  // bullets) e a checklist de beneficios (so faz sentido quando o usuario
  // ainda nao comprou - se ja comprou, ele ja sabe o que tem).
  const ctaSection = getEl("proCtaSection");
  const checklist = getEl("beneficiosGridPRO");
  const checklistLabel = getEl("proChecklistLabel");
  const obrigadoCard = getEl("proObrigadoCard");

  if (!statusEl || !statusTexto) return;

  const statusH2 = statusEl.querySelector("h2");

  if (proDados.ativo) {
    statusEl.classList.remove("inativo");
    statusEl.classList.add("ativo");

    if (statusH2) statusH2.textContent = "Modo PRO Ativo";

    if (proDados.dataAtivacao) {
      const data = new Date(proDados.dataAtivacao).toLocaleDateString("pt-BR");
      statusTexto.textContent = `Ativado em ${data}.`;
    } else {
      statusTexto.textContent = "Aproveite os recursos exclusivos do PRO.";
    }

    if (ctaSection) ctaSection.style.display = "none";
    if (checklist) checklist.style.display = "";
    if (checklistLabel) checklistLabel.textContent = "Seus recursos ativos";
    if (obrigadoCard) obrigadoCard.style.display = "";

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
    // PRO INATIVO - mostra hero + checklist + CTA com preco + bullets
    statusEl.classList.add("inativo");
    statusEl.classList.remove("ativo");

    if (statusH2) statusH2.textContent = "Desbloqueie o Poder Total";
    statusTexto.textContent =
      "Ative o Modo PRO e ganhe acesso a recursos exclusivos";

    if (ctaSection) ctaSection.style.display = "";
    if (checklist) checklist.style.display = "";
    if (checklistLabel) checklistLabel.textContent = "Recursos exclusivos";
    if (obrigadoCard) obrigadoCard.style.display = "none";

    if (btnMenuPRO) {
      // Atualiza so o <span> do label (nao o do shimmer) pra NAO destruir o icone SVG do botao.
      const spanMenuPRO = btnMenuPRO.querySelector("span:not(.btn-pro-cta-shimmer)");
      if (spanMenuPRO) spanMenuPRO.textContent = "Ativar Modo PRO";
      else btnMenuPRO.textContent = "Ativar Modo PRO";
      // display vazio (nao "block") pra preservar o display:flex do
      // .btn-menu-pro (icone + label centralizados).
      btnMenuPRO.style.display = "";
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
 * Aplica efeitos visuais quando PRO esta ativo
 */
function aplicarEfeitosPRO() {
  document.body.classList.add("modo-pro");

  setTimeout(() => {
    restaurarTemaPro();
    if (typeof renderizarTemasAparencia === "function") renderizarTemasAparencia();
  }, 100);
}

/**
 * Remove efeitos PRO
 */
function removerEfeitosPRO() {
  // PRO temporário gerencia seu próprio visual; não sobrescrever
  if (typeof isPROTemp === "function" && isPROTemp()) return;

  document.body.classList.remove("modo-pro");

  // Restaurar tema classico
  setTimeout(() => {
    if (typeof isPROTemp === "function" && isPROTemp()) return;
    aplicarTemaPro("classico");
    if (typeof renderizarTemasAparencia === "function") renderizarTemasAparencia();
  }, 100);
}

/**
 * Inicializa a tela PRO ao carregar
 */
function inicializarTelaPRO() {
  atualizarStatusPRO();
  if (typeof reiniciarAnimacaoEntradaPRO === "function") {
    reiniciarAnimacaoEntradaPRO();
  }
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

  // Atualiza o label do botao SEM destruir o icone SVG interno - escreve
  // no <span> do label (nao o do shimmer) se existir, senao cai pro textContent (fallback legado).
  const definirLabelBotaoPro = (texto) => {
    const span = botaoProEl.querySelector("span:not(.btn-pro-cta-shimmer)");
    if (span) span.textContent = texto;
    else botaoProEl.textContent = texto;
  };

  if (proDados.ativo) {
    cardProEl.classList.add("pro-ativo", "card-pro-conquista");
    cardProEl.classList.remove("card-pro-oferta");

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
      <span class="card-pro-badge card-pro-badge-ativo">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <polyline points="20 6 9 17 4 12" />
        </svg>
        Pro Ativo
      </span>
      <span class="card-pro-titulo">Tudo isto \u00e9 seu</span>
      <ul class="card-pro-vantagens">
        ${listaRecursosHtml}
      </ul>
    `;

    definirLabelBotaoPro("Ver recursos Pro");
    botaoProEl.style.display = "none";
  } else {
    cardProEl.classList.remove("pro-ativo");
    // Marca como bloco de oferta - CSS aplica destaque (borda accent,
    // glow, badge) so neste estado FREE.
    cardProEl.classList.add("card-pro-oferta");

    textoProEl.innerHTML = `
      <span class="card-pro-badge">Modo Pro</span>
      <span class="card-pro-titulo">Eleve seu jogo</span>
      <p class="card-pro-sub">
        Deixe a intelig\u00eancia artificial deduzir cartas, sugerir as
        perguntas certas e apontar erros em tempo real.
      </p>
      <ul class="card-pro-vantagens">
        <li>Assistente de IA que deduz sozinho</li>
        <li>Sugest\u00e3o da pr\u00f3xima pergunta certeira</li>
        <li>Marca\u00e7\u00e3o autom\u00e1tica e alerta de erros</li>
        <li>Temas exclusivos e sem an\u00fancios</li>
      </ul>
    `;

    definirLabelBotaoPro("Ativar Modo Pro");
    // display vazio (nao "block") pra preservar o display:flex do
    // .btn-menu-pro (icone + label). "block" inline venceria o flex.
    botaoProEl.style.display = "";
  }
}

// Atualizar status ao mostrar a tela PRO
document.addEventListener("DOMContentLoaded", () => {
  const observerPRO = new MutationObserver(() => {
    const telaPRO = getEl("pro");
    if (telaPRO && telaPRO.classList.contains("ativa")) {
      inicializarTelaPRO();
      if (typeof sincronizarShimmers === "function") sincronizarShimmers();
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

  if (typeof inicializarPagamento === "function") inicializarPagamento();
  if (typeof inicializarAnuncios === "function") inicializarAnuncios();
});










