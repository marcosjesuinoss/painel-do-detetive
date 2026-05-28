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
    "sugestoes",
    "marcacaoAutomatica",
    "alertaDuplicidade",
    "trincaDuvida",
    "temas",
    "undoEstendido",
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
  // SVG inline (Feather-style, stroke). String pronta pra injetar.
  const SVG_ATTRS = 'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"';
  const visuais = {
    // IA - cpu/cerebro
    ia: {
      svg: `<svg ${SVG_ATTRS}>
        <rect x="4" y="4" width="16" height="16" rx="2" />
        <rect x="9" y="9" width="6" height="6" />
        <line x1="9" y1="1" x2="9" y2="4" /><line x1="15" y1="1" x2="15" y2="4" />
        <line x1="9" y1="20" x2="9" y2="23" /><line x1="15" y1="20" x2="15" y2="23" />
        <line x1="20" y1="9" x2="23" y2="9" /><line x1="20" y1="14" x2="23" y2="14" />
        <line x1="1" y1="9" x2="4" y2="9" /><line x1="1" y1="14" x2="4" y2="14" />
      </svg>`,
    },
    // Sugestoes inteligentes - balao de chat com asterisco (insight)
    sugestoes: {
      svg: `<svg ${SVG_ATTRS}>
        <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="10" y1="11" x2="14" y2="11" />
      </svg>`,
    },
    // Marcacao automatica - check em sequencia
    marcacaoAutomatica: {
      svg: `<svg ${SVG_ATTRS}>
        <polyline points="9 11 12 14 22 4" />
        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
      </svg>`,
    },
    // Deteccao de inconsistencias - triangulo de alerta
    alertaDuplicidade: {
      svg: `<svg ${SVG_ATTRS}>
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>`,
    },
    // Trinca de "?" - layers (3 sobrepostos)
    trincaDuvida: {
      svg: `<svg ${SVG_ATTRS}>
        <polygon points="12 2 2 7 12 12 22 7 12 2" />
        <polyline points="2 17 12 22 22 17" />
        <polyline points="2 12 12 17 22 12" />
      </svg>`,
    },
    // Undo estendido - seta circular de rotacao
    undoEstendido: {
      svg: `<svg ${SVG_ATTRS}>
        <path d="M3 7v6h6" />
        <path d="M21 17a9 9 0 0 0-15-6.7L3 13" />
      </svg>`,
    },
    // Temas premium - paleta
    temas: {
      svg: `<svg ${SVG_ATTRS}>
        <circle cx="13.5" cy="6.5" r=".5" fill="currentColor" />
        <circle cx="17.5" cy="10.5" r=".5" fill="currentColor" />
        <circle cx="8.5" cy="7.5" r=".5" fill="currentColor" />
        <circle cx="6.5" cy="12.5" r=".5" fill="currentColor" />
        <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.83 0 1.5-.67 1.5-1.5 0-.39-.15-.74-.39-1.01-.23-.26-.38-.62-.38-1.01 0-.83.67-1.5 1.5-1.5H16c3.31 0 6-2.69 6-6 0-4.96-4.49-9-10-9z" />
      </svg>`,
    },
    // Sem anuncios - placa cortada
    semAnuncios: {
      svg: `<svg ${SVG_ATTRS}>
        <rect x="2" y="4" width="20" height="14" rx="2" ry="2" />
        <line x1="2" y1="20" x2="22" y2="20" />
        <line x1="5" y1="4" x2="19" y2="18" />
      </svg>`,
    },
  };

  return visuais[featureId] || {
    svg: `<svg ${SVG_ATTRS}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>`,
  };
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
      <li class="pro-checklist-item pro-checklist-vazio">
        Recursos PRO indisponiveis no momento.
      </li>
    `;
    return;
  }

  // Checklist vertical (estilo Stripe/Linear) - cada item tem icone SVG
  // da feature + check accent + nome + descricao. Renderizado como <ul>.
  container.innerHTML = recursos
    .map((recurso) => `
      <li class="pro-checklist-item" data-feature="${recurso.id}">
        <span class="pro-checklist-icone">${recurso.svg || ""}</span>
        <div class="pro-checklist-conteudo">
          <strong class="pro-checklist-nome">${recurso.nome}</strong>
          <span class="pro-checklist-descricao">${recurso.descricao}</span>
        </div>
        <svg class="pro-checklist-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </li>
    `)
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





