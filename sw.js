// Versao do cache = versao completa do app. Quando bumpar aqui,
// atualizar tambem em index.html (2 lugares: footer e .versao-app) e
// em manifest.json - todos os 4 lugares devem casar exatamente.
//
// Regra de versionamento:
// - PATCH (3o numero): bumpa em CADA mudanca de codigo (qualquer arquivo
//   listado em STATIC_FILES). Eh o gatilho pra invalidar o cache do
//   navegador e o SW baixar arquivos frescos.
// - MINOR (2o numero): bumpa quando ha conjunto de features novas
//   relevantes (ex.: 1.3.x -> 1.4.0). Decisao manual. Reseta patch pra 0.
// - MAJOR (1o numero): bumpa em breaking changes ou refactor grande
//   (ex.: 1.x.x -> 2.0.0). Decisao manual.
//
// Exemplo: 1.3.232 -> 1.3.233 -> ... -> 1.3.500 -> 1.4.0 -> 1.4.1 -> ...
const CACHE_NAME = "painel-detetive-1.4.12";

const STATIC_FILES = [
  "./",
  "./index.html",
  "./privacidade.html",
  "./manifest.json",
  "./config/pro-features.json",
  "./css/style.css",
  "./css/base.css",
  "./css/layout.css",
  "./css/components.css",
  "./css/theme.css",
  "./css/animations.css",
  "./js/app.js",
  "./js/utils-pro.js",
  "./js/utils.js",
  "./js/jogadores.js",
  "./js/telas.js",
  "./js/partida.js",
  "./js/menu.js",
  "./js/popup.js",
  "./js/tema.js",
  "./js/accordion.js",
  "./js/estado.js",
  "./js/tabela.js",
  "./js/assistente-ia.js",
  "./js/pro.js",
  "./assets/icons/icon-180.png",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png",
  "./assets/icons/icon-512-maskable.png",
  "./assets/logo-detetive.png",
  "./assets/splash-completo.png"
];

self.addEventListener("install", event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(STATIC_FILES);
    })
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    fetch(event.request)
      .then(response => {
        if (!response || response.status !== 200) {
          return response;
        }

        const responseClone = response.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, responseClone);
        });

        return response;
      })
      .catch(() => {
        return caches.match(event.request).then(response => {
          if (response) {
            return response;
          }

          const aceitaHtml =
            event.request.mode === "navigate" ||
            (event.request.headers.get("accept") || "").includes("text/html");

          if (aceitaHtml) {
            return caches.match("./index.html");
          }

          return new Response("", {
            status: 404,
            statusText: "Not Found"
          });
        });
      })
  );
});













