/* =====================================
   ANÚNCIOS — AdMob (Capacitor)

   Antes de publicar, preencha:
   - ADMOB_BANNER_ID → AdMob dashboard › seu app › Blocos de anúncios › Banner
   O App ID do AdMob vai no AndroidManifest.xml (meta-data com.google.android.gms.ads.APPLICATION_ID).

   Comportamento:
   - Banner aparece no rodapé APENAS em modo FREE (não PRO)
   - Banner é removido ao ativar PRO
   - No PWA / browser: sem efeito (silencioso)
===================================== */

const ADMOB_BANNER_ID = "ca-app-pub-2620409279923135/3428449007";

// IDs de teste do AdMob — usar durante desenvolvimento
const ADMOB_BANNER_ID_TESTE = "ca-app-pub-3940256099942544/6300978111";

function _isCapacitor() {
  return !!(window.Capacitor && window.Capacitor.isNativePlatform());
}

function _getAdMob() {
  return window.Capacitor?.Plugins?.AdMob ?? null;
}

async function inicializarAnuncios() {
  if (!_isCapacitor()) return;
  if (typeof isPRO === "function" && isPRO()) return;

  const AdMob = _getAdMob();
  if (!AdMob) return;

  try {
    await AdMob.initialize({ requestTrackingAuthorization: false });
    await mostrarBannerAnuncio();
  } catch (e) {
    console.warn("[Anuncios] Erro ao inicializar AdMob:", e);
  }
}

async function mostrarBannerAnuncio() {
  if (!_isCapacitor()) return;
  if (typeof isPRO === "function" && isPRO()) return;

  const AdMob = _getAdMob();
  if (!AdMob) return;

  try {
    await AdMob.showBanner({
      adId: ADMOB_BANNER_ID,
      adSize: "BANNER",
      position: "BOTTOM_CENTER",
      margin: 0,
      isTesting: false,
    });
  } catch (e) {
    console.warn("[Anuncios] Erro ao mostrar banner:", e);
  }
}

async function ocultarBannerAnuncio() {
  if (!_isCapacitor()) return;

  const AdMob = _getAdMob();
  if (!AdMob) return;

  try {
    await AdMob.removeBanner();
  } catch {
    // silencioso — banner pode nao existir ainda
  }
}
