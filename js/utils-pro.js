// ======================================
//   UTILITARIOS DO MODO PRO
// ======================================

let configProFeatures = null;
let temaAtualPro = null;

function atualizarCoresSplash(variaveisTema) {
  if (!variaveisTema) return;

  const metaTheme = document.querySelector('meta[name="theme-color"]');
  const bg = variaveisTema["--bg-primario"] || "#0f172a";
  const bgEnd = variaveisTema["--bg-secundario"] || bg;
  const accent = variaveisTema["--accent-soft"] || variaveisTema["--accent"] || "#4ade80";
  const accentRgb = variaveisTema["--accent-rgb"] || "22, 163, 74";
  const text = variaveisTema["--text-primario"] || "#e8eef6";

  document.documentElement.style.setProperty("--splash-bg", bg);
  document.documentElement.style.setProperty("--splash-bg-end", bgEnd);
  document.documentElement.style.setProperty("--splash-accent", accent);
  document.documentElement.style.setProperty("--splash-glow", accentRgb);
  document.documentElement.style.setProperty("--splash-text", text);

  if (document.body) {
    document.body.style.setProperty("--splash-bg", bg);
    document.body.style.setProperty("--splash-bg-end", bgEnd);
    document.body.style.setProperty("--splash-accent", accent);
    document.body.style.setProperty("--splash-glow", accentRgb);
    document.body.style.setProperty("--splash-text", text);
  }

  if (metaTheme) {
    metaTheme.setAttribute("content", bg);
  }
}

// Carregar configuracao do PRO
async function carregarConfigPro() {
  try {
    const response = await fetch("./config/pro-features.json");
    if (!response.ok) {
      throw new Error(`Resposta inesperada ao carregar config PRO: ${response.status}`);
    }
    configProFeatures = await response.json();
    console.log("Config PRO carregada");

    if (typeof restaurarTemaPro === "function") {
      restaurarTemaPro();
    }

    if (typeof renderizarTemasAparencia === "function") {
      renderizarTemasAparencia();
    }

    if (typeof renderizarBeneficiosPRO === "function") {
      renderizarBeneficiosPRO();
    }

    if (typeof atualizarTelaSobre === "function") {
      atualizarTelaSobre();
    }

    return configProFeatures;
  } catch (erro) {
    console.warn("Aviso: Erro ao carregar config PRO:", erro);
    return null;
  }
}

// Verificar se uma feature esta disponivel para o usuario
function temFeaturePro(featureId) {
  const proStr = localStorage.getItem("modoPRO");

  try {
    const proDados = proStr ? JSON.parse(proStr) : { ativo: false };
    if (!proDados.ativo) {
      return false;
    }
  } catch {
    return false;
  }

  if (!configProFeatures) {
    console.warn("Aviso: Config PRO nao carregada ainda");
    return false;
  }

  return configProFeatures.features[featureId]?.ativo === true;
}

// Obter tema PRO pelo ID
function obterTemaPro(temaId) {
  if (!configProFeatures) return null;
  return configProFeatures.temas[temaId] || null;
}

// Listar todos os temas disponiveis para o usuario
function listarTemasDisponiveis() {
  if (!configProFeatures) return [];

  const proStr = localStorage.getItem("modoPRO");
  let modoPROAtivo = false;

  try {
    const proDados = proStr ? JSON.parse(proStr) : { ativo: false };
    modoPROAtivo = proDados.ativo === true;
  } catch {
    modoPROAtivo = false;
  }

  return Object.values(configProFeatures.temas).filter((tema) => {
    if (modoPROAtivo) {
      return tema.tipo === "pro";
    }

    return tema.tipo === "free";
  });
}

// Aplicar tema ao app
function aplicarTemaPro(temaId) {
  const tema = obterTemaPro(temaId);

  if (!tema) {
    console.error(`Tema "${temaId}" nao encontrado`);
    return false;
  }

  if (tema.tipo === "pro" && !temFeaturePro("temas")) {
    console.warn("Tema PRO nao disponivel sem modo PRO ativo");
    return false;
  }

  const usarClaro = document.body.classList.contains("light");
  const variaveisTema =
    usarClaro && tema["variaveis-light"] ? tema["variaveis-light"] : tema.variaveis;

  const root = document.documentElement;
  const body = document.body;
  Object.entries(variaveisTema).forEach(([chave, valor]) => {
    root.style.setProperty(chave, valor);
    if (body) {
      body.style.setProperty(chave, valor);
    }
  });

  atualizarCoresSplash(variaveisTema);

  document.documentElement.className = `tema-${temaId}`;
  localStorage.setItem("temaProSelecionado", temaId);
  temaAtualPro = tema;

  console.log(`Tema "${tema.nome}" aplicado`);
  return true;
}

// Restaurar tema salvo ao carregar app
function restaurarTemaPro() {
  if (!configProFeatures) {
    return false;
  }

  const temaSalvo = localStorage.getItem("temaProSelecionado");

  if (temaSalvo && listarTemasDisponiveis().some((t) => t.id === temaSalvo)) {
    return aplicarTemaPro(temaSalvo);
  }

  if (typeof lerPRO === "function" && lerPRO().ativo === true) {
    return aplicarTemaPro("verde");
  }

  return aplicarTemaPro("classico");
}

// Obter tema atual
function obterTemaAtual() {
  return temaAtualPro;
}

// ======================================
//   FUNCAO AUXILIAR: IA
// ======================================

// Placeholder para futuro sistema de IA
function temAcessoAIA() {
  return temFeaturePro("ia");
}

// Placeholder para futuro sistema sem anuncios
function temAcessoSemAnuncios() {
  return temFeaturePro("semAnuncios");
}
// Lista todos os recursos PRO ativos no config
function listarRecursosPROAtivos() {
  if (!configProFeatures || !configProFeatures.features) return [];

  const ordemPreferencial = [
    "ia",
    "alertaCartaEncontrada",
    "alertaDuplicidade",
    "temas",
    "semAnuncios",
  ];

  return Object.entries(configProFeatures.features)
    .filter(([, feature]) => feature?.ativo === true)
    .map(([id, feature]) => ({
      id,
      nome: feature.nome || id,
      descricao: feature.descricao || "Recurso exclusivo do Modo PRO",
    }))
    .sort((a, b) => {
      const ia = ordemPreferencial.indexOf(a.id);
      const ib = ordemPreferencial.indexOf(b.id);

      const pa = ia === -1 ? Number.MAX_SAFE_INTEGER : ia;
      const pb = ib === -1 ? Number.MAX_SAFE_INTEGER : ib;

      if (pa !== pb) return pa - pb;
      return a.nome.localeCompare(b.nome, "pt-BR");
    });
}

function obterVisualRecursoPRO(featureId) {
  const visuais = {
    ia: { icone: "&#129302;" },
    alertaCartaEncontrada: { icone: "&#128161;" },
    alertaDuplicidade: { icone: "&#9888;" },
    temas: { icone: "&#10024;" },
    semAnuncios: { icone: "&#127919;" },
  };

  return visuais[featureId] || { icone: "&#11088;" };
}

function listarRecursosPROComVisual() {
  return listarRecursosPROAtivos().map((recurso) => ({
    ...recurso,
    ...obterVisualRecursoPRO(recurso.id),
  }));
}

function gerarListaRecursosSobrePROHTML() {
  const recursos = listarRecursosPROComVisual();

  if (recursos.length === 0) {
    return "<li>Recursos PRO indisponiveis no momento.</li>";
  }

  return recursos.map((recurso) => `<li>${recurso.nome}</li>`).join("");
}

function renderizarBeneficiosPRO() {
  const container = getEl("beneficiosGridPRO");
  if (!container) return;

  const recursos = listarRecursosPROComVisual();

  if (recursos.length === 0) {
    container.innerHTML = `
      <div class="card-beneficio">
        <span class="badge-pro">PRO</span>
        <div class="icone-beneficio">&#9888;</div>
        <h3>Recursos indisponiveis</h3>
        <p>Nao foi possivel carregar os recursos PRO no momento.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = recursos
    .map(
      (recurso) => `
        <div class="card-beneficio" data-feature="${recurso.id}">
          <span class="badge-pro">PRO</span>
          <div class="icone-beneficio">${recurso.icone}</div>
          <h3>${recurso.nome}</h3>
          <p>${recurso.descricao}</p>
        </div>
      `,
    )
    .join("");
}

// ======================================
//   UTILIDADES
// ======================================

/**
 * Mostra notificacao temporaria compactada
 */
function mostrarNotificacao(mensagem) {
  const notificacao = document.createElement("div");
  notificacao.textContent = mensagem;
  notificacao.style.cssText = `
    position: fixed;
    bottom: 25px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(var(--accent-rgb, 22, 163, 74), 0.95);
    color: white;
    border: 1px solid rgba(255, 255, 255, 0.14);
    box-shadow: 0 10px 24px rgba(var(--accent-rgb, 22, 163, 74), 0.24);
    padding: 8px 16px;
    border-radius: 8px;
    font-size: 12px;
    font-weight: 600;
    z-index: 1000;
    animation: deslizarCima 0.3s ease;
    white-space: nowrap;
  `;

  document.body.appendChild(notificacao);

  setTimeout(() => {
    notificacao.style.animation = "deslizarBaixo 0.3s ease";
    setTimeout(() => notificacao.remove(), 300);
  }, 2000);
}

// ======================================
//   RENDERIZACAO DE TEMAS EM APARENCIAS
// ======================================

/**
 * Renderiza os cards de temas PRO na tela de Aparencias
 */
function renderizarTemasAparencia() {
  const container = getEl("containerTemasAparencia");
  const secaoTemas = getEl("secaoTemasAparencia");

  if (!container || !configProFeatures) return;

  const temAcceso = temFeaturePro("temas");
  if (!temAcceso) {
    if (secaoTemas) secaoTemas.style.display = "none";
    return;
  }

  if (secaoTemas) secaoTemas.style.display = "block";

  container.innerHTML = "";

  const temasDisponiveis = listarTemasDisponiveis();
  const temaSelecionado =
    localStorage.getItem("temaProSelecionado") || "classico";

  temasDisponiveis.forEach((tema) => {
    const usarClaro = document.body.classList.contains("light");
    const varsPreview =
      usarClaro && tema["variaveis-light"] ? tema["variaveis-light"] : tema.variaveis;

    const card = document.createElement("div");
    card.className = `card-tema ${temaSelecionado === tema.id ? "selecionado" : ""}`;
    card.innerHTML = `
      <div class="tema-preview" style="background: ${varsPreview["--gradient-principal"]}"></div>
      <h4 class="tema-nome">${tema.nome}</h4>
      <button class="btn-selecionar-tema" data-tema="${tema.id}" type="button">
        ${temaSelecionado === tema.id ? "Selecionado" : "Usar tema"}
      </button>
    `;

    const btnSelecionar = card.querySelector(".btn-selecionar-tema");
    btnSelecionar.addEventListener("click", (e) => {
      e.preventDefault();
      selecionarTemaPRO(tema.id);
    });

    container.appendChild(card);
  });
}

/**
 * Seleciona e aplica um tema PRO da tela de Aparencias
 */
function selecionarTemaPRO(temaId) {
  // Aplicar tema via utilitario
  const sucesso = aplicarTemaPro(temaId);

  if (sucesso) {
    // Atualizar visual dos cards
    renderizarTemasAparencia();
    mostrarNotificacao(`Tema "${temaId.toUpperCase()}" aplicado!`);
  }
}

/**
 * Inicializa a tela de Aparencias com temas PRO
 */
function inicializarTemasAparencia() {
  renderizarTemasAparencia();
}

// ======================================
//   INICIALIZACAO
// ======================================

// Carregar config quando o app inicia
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", carregarConfigPro);
} else {
  carregarConfigPro();
}

// Inicializar temas ao mostrar a tela de Aparencias
document.addEventListener("DOMContentLoaded", () => {
  const telaAparencia = getEl("aparencia");
  if (telaAparencia) {
    const observer = new MutationObserver(() => {
      if (telaAparencia.classList.contains("ativa")) {
        // Pequeno delay para garantir que a config foi carregada
        setTimeout(() => {
          inicializarTemasAparencia();
        }, 100);
      }
    });

    const config = { attributes: true, attributeFilter: ["class"] };
    observer.observe(telaAparencia, config);

    // Inicializar na primeira carga
    inicializarTemasAparencia();
  }
});





