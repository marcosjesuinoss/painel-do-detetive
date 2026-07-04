/* =====================================
   ANÚNCIOS — AdMob (Capacitor)

   App ID no AndroidManifest.xml (meta-data com.google.android.gms.ads.APPLICATION_ID).

   Formatos:
   - Rewarded    → botão no menu; libera PRO temporário por 1 partida (ou 30 min)
   - Interstitial → ao iniciar novo jogo; cooldown de 30 min
   No PWA / browser: sem efeito (silencioso).
===================================== */

const ADMOB_REWARDED_ID     = "ca-app-pub-2620409279923135/6136997074";
const ADMOB_INTERSTITIAL_ID = "ca-app-pub-2620409279923135/3510833731";

const ADMOB_REWARDED_ID_TESTE     = "ca-app-pub-3940256099942544/5224354917";
const ADMOB_INTERSTITIAL_ID_TESTE = "ca-app-pub-3940256099942544/1033173712";

function _isCapacitor() {
  return !!(window.Capacitor && window.Capacitor.isNativePlatform());
}

function _getAdMob() {
  return window.Capacitor?.Plugins?.AdMob ?? null;
}

// ─── PRO TEMPORÁRIO ──────────────────────────────────────────────────────────
// Regras:
//  - Nunca saiu da partida original → congela em 00:00, mantém indefinido
//  - Saiu e voltou (ou nova partida) → timer corre; ao zerar, perde benefício
//  - Estado persistido no localStorage para sobreviver a reloads do WebView
// ─────────────────────────────────────────────────────────────────────────────

const _REWARDED_DURACAO_MS  = 30 * 60 * 1000;
const _CHAVE_PRO_TEMP       = "proTempEstado";

const _proTemp = {
  ativo: false,
  assistiuEm: 0,
  sessaoId: null,   // ID da sessão ativa quando o usuário assistiu
  nuncaSaiu: true,  // false se o usuário saiu da partida original
  temaAnterior: "", // className do documentElement antes de ativar
};

let _sessaoJogoAtual = _gerarSessaoId();

function _gerarSessaoId() {
  return Date.now() + "_" + Math.random();
}

function isPROTemp() {
  if (!_proTemp.ativo) return false;

  // Mesma sessão original, nunca saiu → benefício indefinido
  if (_proTemp.nuncaSaiu && _sessaoJogoAtual === _proTemp.sessaoId) return true;

  // Saiu ou sessão diferente → depende do timer
  if (Date.now() - _proTemp.assistiuEm < _REWARDED_DURACAO_MS) return true;

  // Timer esgotado → desativar
  _desativarPROTemp();
  return false;
}

function _salvarProTemp() {
  if (!_proTemp.ativo) {
    localStorage.removeItem(_CHAVE_PRO_TEMP);
    return;
  }
  try {
    localStorage.setItem(_CHAVE_PRO_TEMP, JSON.stringify({
      assistiuEm:   _proTemp.assistiuEm,
      temaAnterior: _proTemp.temaAnterior,
    }));
  } catch { /* storage cheio — silencioso */ }
}

function _restaurarProTemp() {
  const raw = localStorage.getItem(_CHAVE_PRO_TEMP);
  if (!raw) return;
  try {
    const salvo = JSON.parse(raw);
    if (!salvo?.assistiuEm) return;
    if (Date.now() - salvo.assistiuEm >= _REWARDED_DURACAO_MS) {
      localStorage.removeItem(_CHAVE_PRO_TEMP);
      return;
    }
    // Reload = usuário "saiu"; timer continua contando desde assistiuEm
    _proTemp.ativo        = true;
    _proTemp.assistiuEm   = salvo.assistiuEm;
    _proTemp.sessaoId     = null; // nova sessão após reload
    _proTemp.nuncaSaiu    = false;
    _proTemp.temaAnterior = salvo.temaAnterior || "";

    _aplicarVisualProTemp();

    // Agendar desativação quando o timer esgotar
    const restante = _REWARDED_DURACAO_MS - (Date.now() - _proTemp.assistiuEm);
    setTimeout(() => isPROTemp(), restante + 500);
  } catch {
    localStorage.removeItem(_CHAVE_PRO_TEMP);
  }
}

// ─── TIMER DE EXIBIÇÃO ───────────────────────────────────────────────────────

let _timerIntervalId = null;

function _formatarTempo(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const mins  = Math.floor(total / 60);
  const secs  = total % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function _atualizarTimerDisplay() {
  const el = document.getElementById("proTempTimerLabel");
  if (!el) return;

  const restante = _REWARDED_DURACAO_MS - (Date.now() - _proTemp.assistiuEm);

  if (restante > 0) {
    el.textContent = `${_formatarTempo(restante)} restantes`;
    return;
  }

  // Timer chegou a 00:00 — verifica bônus de sessão
  if (_proTemp.nuncaSaiu && _sessaoJogoAtual === _proTemp.sessaoId) {
    // Nunca saiu da partida original → benefício indefinido, congela aqui
    el.textContent = "Ativo nesta partida";
  } else {
    // Saiu antes do fim → já expirou (isPROTemp chamou _desativarPROTemp)
    el.textContent = "00:00 restantes";
  }
}

function _iniciarTimerProTemp() {
  _pararTimerProTemp();
  _atualizarTimerDisplay();
  _timerIntervalId = setInterval(_atualizarTimerDisplay, 1000);
}

function _pararTimerProTemp() {
  if (_timerIntervalId !== null) {
    clearInterval(_timerIntervalId);
    _timerIntervalId = null;
  }
}

function _aplicarVisualProTemp() {
  document.body.classList.add("modo-pro", "modo-pro-temp");
  document.documentElement.className = "tema-verde";
  _iniciarTimerProTemp();
  if (typeof renderizarTemasAparencia === "function") renderizarTemasAparencia();
}

function _ativarPROTemp() {
  _proTemp.ativo        = true;
  _proTemp.assistiuEm   = Date.now();
  _proTemp.sessaoId     = _sessaoJogoAtual;
  _proTemp.nuncaSaiu    = true;
  _proTemp.temaAnterior = document.documentElement.className;

  _aplicarVisualProTemp();
  _salvarProTemp();

  // Para o caso de sair antes do timer, agendar verificação
  setTimeout(() => { if (_proTemp.ativo && !_proTemp.nuncaSaiu) isPROTemp(); },
    _REWARDED_DURACAO_MS + 500);
}

function _desativarPROTemp() {
  const temaRestaurar   = _proTemp.temaAnterior || "";
  _proTemp.ativo        = false;
  _proTemp.assistiuEm   = 0;
  _proTemp.sessaoId     = null;
  _proTemp.nuncaSaiu    = true;
  _proTemp.temaAnterior = "";

  _pararTimerProTemp();
  _salvarProTemp();

  document.body.classList.remove("modo-pro-temp");
  if (!(typeof isPRO === "function" && isPRO())) {
    document.body.classList.remove("modo-pro");
    document.documentElement.className = temaRestaurar || "tema-classico";
  }
  if (typeof renderizarTemasAparencia === "function") renderizarTemasAparencia();

  // Momento 2: PRO temp expirou — oferece reativar após 5s (pico de intenção)
  exibirSnackbarRewardedSeElegivel(5000);
}

// Chamado quando o usuário SAI da partida (irParaInicio, confirmarLimpar)
function notificarSaidaPartida() {
  // Cancela o timer do snackbar — será reiniciado quando o usuário voltar
  fecharSnackbarRewarded();

  if (!_proTemp.ativo) return;
  _proTemp.nuncaSaiu = false;
  _salvarProTemp();
  _atualizarTimerDisplay(); // troca "Ativo nesta partida" → contador imediatamente
  isPROTemp(); // verifica imediatamente se já expirou
}

// Chamado quando inicia NOVA partida (iniciarPartidaLimpa)
function notificarNovaPartida() {
  _sessaoJogoAtual = _gerarSessaoId();
  if (_proTemp.ativo) {
    _proTemp.nuncaSaiu = false;
    _salvarProTemp();
  }
  exibirSnackbarRewardedSeElegivel();
}

// ─── REWARDED ────────────────────────────────────────────────────────────────

// ─── rAF-driven shimmer sync ──────────────────────────────────────────────────
// CSS animation-delay tricks falham no Android WebView (Blink pode batchar
// remove+reinsert no mesmo task e não reiniciar a animação). A solução é
// desabilitar a animação CSS e controlar o transform via requestAnimationFrame:
// todos os elementos recebem o mesmo valor no mesmo callback → sync perfeito.

let _shimmerRafId = null;

function _shimmerEase(p) {
  return p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
}

function _shimmerFrame() {
  var t = Date.now() % 3500;
  var transform;
  if (t < 1400) {
    // 0%–40%: aguarda à esquerda (fora da área visível)
    transform = 'translateX(-120%) skewX(-20deg)';
  } else if (t < 2100) {
    // 40%–60%: desliza de -120% até 260% (ida, 700ms)
    var p1 = _shimmerEase((t - 1400) / 700);
    transform = 'translateX(' + (-120 + 380 * p1).toFixed(1) + '%) skewX(-20deg)';
  } else if (t < 2800) {
    // 60%–80%: desliza de volta até -120% (volta, 700ms)
    var p2 = _shimmerEase((t - 2100) / 700);
    transform = 'translateX(' + (260 - 380 * p2).toFixed(1) + '%) skewX(-20deg)';
  } else {
    // 80%–100%: aguarda à esquerda
    transform = 'translateX(-120%) skewX(-20deg)';
  }
  document.querySelectorAll('.btn-shimmer, .btn-pro-cta-shimmer').forEach(function(el) {
    el.style.transform = transform;
  });
  _shimmerRafId = requestAnimationFrame(_shimmerFrame);
}

function sincronizarShimmers() {
  if (_shimmerRafId !== null) return; // rAF já rodando — sync automático
  // Desabilita animação CSS; o rAF assume o controle do transform
  document.querySelectorAll('.btn-shimmer, .btn-pro-cta-shimmer').forEach(function(el) {
    el.style.animation = 'none';
  });
  _shimmerRafId = requestAnimationFrame(_shimmerFrame);
}

function abrirPopupOfertaRewarded() {
  if (!_isCapacitor()) return;
  if (typeof isPRO === "function" && isPRO()) return;
  if (isPROTemp()) return;
  abrirOverlayAcessivel("popupOfertaRewarded");
  sincronizarShimmers();
}

function fecharPopupOfertaRewarded() {
  fecharOverlayAcessivel("popupOfertaRewarded");
}

async function mostrarRewardedAnuncio() {
  if (!_isCapacitor()) return;
  if (isPROTemp()) return;

  const AdMob = _getAdMob();
  if (!AdMob) return;

  try {
    await AdMob.prepareRewardVideoAd({
      adId: ADMOB_REWARDED_ID,
      isTesting: false,
    });

    const listenerPromise = AdMob.addListener("onRewardedVideoAdReward", () => {
      _ativarPROTemp();
      listenerPromise.then((l) => l.remove()).catch(() => {});
    });

    await AdMob.showRewardVideoAd();
  } catch (e) {
    console.warn("[Anuncios] Erro ao exibir rewarded:", e);
  }
}

// ─── INTERSTICIAL ────────────────────────────────────────────────────────────

const _INTERSTITIAL_COOLDOWN_MS = 20 * 60 * 1000;
const _CHAVE_INTERSTITIAL_TS    = "anuncioInterstitialUltimoTs";
let   _interstitialPronto       = false;

async function _prepararInterstitial() {
  if (!_isCapacitor()) return;
  const AdMob = _getAdMob();
  if (!AdMob) return;
  try {
    await AdMob.prepareInterstitial({ adId: ADMOB_INTERSTITIAL_ID, isTesting: false });
    _interstitialPronto = true;
  } catch (e) {
    _interstitialPronto = false;
    console.warn("[Anuncios] Erro ao preparar interstitial:", e);
  }
}

async function mostrarInterstitialSeDisponivel() {
  if (!_isCapacitor()) return;
  if (typeof isPRO === "function" && isPRO()) return;
  if (isPROTemp()) return;

  const ultimoTs = parseInt(localStorage.getItem(_CHAVE_INTERSTITIAL_TS) || "0", 10);
  if (Date.now() - ultimoTs < _INTERSTITIAL_COOLDOWN_MS) return;
  if (!_interstitialPronto) return;

  const AdMob = _getAdMob();
  if (!AdMob) return;

  try {
    _interstitialPronto = false;
    await AdMob.showInterstitial();
    localStorage.setItem(_CHAVE_INTERSTITIAL_TS, String(Date.now()));
    setTimeout(_prepararInterstitial, 2000);
  } catch (e) {
    console.warn("[Anuncios] Erro ao exibir interstitial:", e);
  }
}

// ─── SNACKBAR REWARDED ───────────────────────────────────────────────────────

let _snackbarTimerIds = [];

function _limparTimersSnackbar() {
  _snackbarTimerIds.forEach(clearTimeout);
  _snackbarTimerIds = [];
}

function fecharSnackbarRewarded() {
  _limparTimersSnackbar();
  const el = document.getElementById("snackbarRewarded");
  if (el) el.classList.remove("visivel");
  const btnMenu = document.getElementById("btnMenu");
  if (btnMenu) btnMenu.classList.remove("pulsando-rewarded");
}

// Exibe o snackbar rewarded após `delayMs` ms se o usuário ainda for FREE.
// Momento 1 (nova partida): delay padrão de 2 min — usuário já engajado.
// Momento 2 (PRO temp expirou): delay curto de 5s — pico de intenção.
function exibirSnackbarRewardedSeElegivel(delayMs = 120000) {
  _limparTimersSnackbar();

  // Não exibir para PRO pago, PRO temp, ou fora do Capacitor
  if (typeof isPRO === "function" && isPRO()) return;
  if (isPROTemp()) return;
  if (!_isCapacitor()) return;

  const el = document.getElementById("snackbarRewarded");
  if (!el) return;

  _snackbarTimerIds.push(setTimeout(() => {
    if (isPROTemp() || (typeof isPRO === "function" && isPRO())) return;
    el.classList.add("visivel");
    const btnMenu = document.getElementById("btnMenu");
    if (btnMenu) btnMenu.classList.add("pulsando-rewarded");

    // Auto-fecha após 10s
    _snackbarTimerIds.push(setTimeout(fecharSnackbarRewarded, 10000));
  }, delayMs));
}

// ─── INICIALIZAÇÃO ───────────────────────────────────────────────────────────

async function inicializarAnuncios() {
  sincronizarShimmers();
  // Restaurar PRO temp persistido (sobrevive a reloads do WebView)
  _restaurarProTemp();

  if (!_isCapacitor()) {
    const btn = document.getElementById("btnMenuRewarded");
    if (btn) btn.style.display = "none";
    return;
  }

  const AdMob = _getAdMob();
  if (!AdMob) return;

  try {
    await AdMob.initialize({ requestTrackingAuthorization: false });
    _prepararInterstitial();
  } catch (e) {
    console.warn("[Anuncios] Erro ao inicializar AdMob:", e);
  }
}

// Verifica expiração quando app volta ao foco
document.addEventListener("visibilitychange", () => {
  if (!document.hidden && _proTemp.ativo && !_proTemp.nuncaSaiu) {
    isPROTemp();
  }
});
