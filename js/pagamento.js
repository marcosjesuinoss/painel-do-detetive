/* =====================================
   PAGAMENTO — RevenueCat (Capacitor)

   Antes de publicar, preencha:
   - REVENUECAT_API_KEY  → RevenueCat dashboard › Project › API Keys › Public (Android)
   - ENTITLEMENT_ID      → ID do entitlement criado no RevenueCat (ex: "pro")
   - PRODUCT_ID          → ID do produto criado no Google Play Console
===================================== */

const REVENUECAT_API_KEY = "PREENCHER_CHAVE_REVENUECAT";
const ENTITLEMENT_ID = "pro";

function _isCapacitor() {
  return !!(window.Capacitor && window.Capacitor.isNativePlatform());
}

function _getPurchases() {
  return window.Capacitor?.Plugins?.Purchases ?? null;
}

async function inicializarPagamento() {
  if (!_isCapacitor()) return;
  const Purchases = _getPurchases();
  if (!Purchases) return;
  try {
    await Purchases.configure({ apiKey: REVENUECAT_API_KEY });
    await _sincronizarEntitlementPRO();
  } catch (e) {
    console.warn("[Pagamento] Erro ao inicializar:", e);
  }
}

async function _sincronizarEntitlementPRO() {
  const Purchases = _getPurchases();
  if (!Purchases) return false;
  try {
    const result = await Purchases.getCustomerInfo();
    const ativo = !!result?.customerInfo?.entitlements?.active?.[ENTITLEMENT_ID];
    if (ativo) _gravarProAtivado();
    return ativo;
  } catch (e) {
    console.warn("[Pagamento] Erro ao verificar entitlement:", e);
    return false;
  }
}

async function comprarPRO() {
  if (!_isCapacitor()) {
    mostrarNotificacao("Pagamento disponível apenas no app Android.");
    return;
  }
  const Purchases = _getPurchases();
  if (!Purchases) {
    mostrarNotificacao("Serviço de pagamento indisponível. Tente novamente.");
    return;
  }

  const btnAtivar = getEl("btnAtivarPRO");
  if (btnAtivar) btnAtivar.disabled = true;

  try {
    const ofertasResult = await Purchases.getOfferings();
    const pacote = ofertasResult?.current?.availablePackages?.[0];
    if (!pacote) {
      mostrarNotificacao("Produto não encontrado. Tente novamente mais tarde.");
      return;
    }
    const { customerInfo } = await Purchases.purchasePackage({ aPackage: pacote });
    const ativo = !!customerInfo?.entitlements?.active?.[ENTITLEMENT_ID];
    if (ativo) {
      _gravarProAtivado();
      mostrarNotificacao("PRO Ativado com Sucesso!");
    }
  } catch (e) {
    if (e?.code !== "PURCHASE_CANCELLED") {
      mostrarNotificacao("Erro no pagamento. Tente novamente.");
      console.warn("[Pagamento] Erro na compra:", e);
    }
  } finally {
    if (btnAtivar) btnAtivar.disabled = false;
  }
}

async function restaurarComprasPRO() {
  if (!_isCapacitor()) {
    mostrarNotificacao("Disponível apenas no app Android.");
    return;
  }
  const Purchases = _getPurchases();
  if (!Purchases) return;
  try {
    const { customerInfo } = await Purchases.restorePurchases();
    const ativo = !!customerInfo?.entitlements?.active?.[ENTITLEMENT_ID];
    if (ativo) {
      _gravarProAtivado();
      mostrarNotificacao("PRO restaurado com sucesso!");
    } else {
      mostrarNotificacao("Nenhuma compra encontrada nesta conta.");
    }
  } catch (e) {
    mostrarNotificacao("Erro ao restaurar. Tente novamente.");
    console.warn("[Pagamento] Erro ao restaurar:", e);
  }
}

function _gravarProAtivado() {
  salvar("modoPRO", JSON.stringify({ ativo: true, dataAtivacao: new Date().toISOString() }));
  if (typeof atualizarStatusPRO === "function") atualizarStatusPRO();
  if (typeof atualizarTelaSobre === "function") atualizarTelaSobre();
}
