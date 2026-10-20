var CACHE_NAME = "nuvio-vidaa-5399d472eb604445";
var ASSETS = [
  "./",
  "./index.html",
  "./vidaa.html",
  "./manifest.json",
  "./boot-guard.5399d472eb604445.js",
  "./core-js.bundle.5399d472eb604445.js",
  "./nuvio.env.5399d472eb604445.js",
  "./app.bundle.5399d472eb604445.js",
  "./assets/runtime/legacy-features.5399d472eb604445.js",
  "./assets/runtime/plugin-worker.js",
  "./assets/libs/qrcode-generator.5399d472eb604445.js",
  "./assets/libs/quickjs-emscripten.global.js",
  "./assets/libs/ass.min.js",
  "./assets/libs/hls.min.js",
  "./assets/libs/dash.all.min.js",
  "./css/bundle.5399d472eb604445.css"
];

self.addEventListener("install", function (e) {
  e.waitUntil(
    caches
      .open(CACHE_NAME)
      .then(function (cache) {
        return cache.addAll(
          ASSETS.map(function (asset) {
            return new Request(asset, { cache: "reload" });
          })
        );
      })
      .then(function () {
        return self.skipWaiting();
      })
      .catch(function (err) {
        console.warn("[SW] Cache install warning:", err);
      })
  );
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches
      .keys()
      .then(function (names) {
        return Promise.all(
          names
            .filter(function (n) {
              return n.indexOf("nuvio-vidaa-") === 0 && n !== CACHE_NAME;
            })
            .map(function (n) {
              return caches.delete(n);
            })
        );
      })
      .then(function () {
        return self.clients.claim();
      })
  );
});

self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET") return;
  if (req.url.indexOf(self.location.origin) !== 0) return;

  // Never touch media range requests or video stream files
  if (req.headers && req.headers.get("range")) return;
  if (/\.(mkv|mp4|m4v|webm|m3u8|ts|mpd|mov)(\?|$)/i.test(req.url)) return;

  var normalizedRequest = req;
  if (req.url.indexOf("?") !== -1) {
    var url = new URL(req.url);
    url.search = "";
    normalizedRequest = new Request(url.toString());
  }

  function updateCacheFromNetwork() {
    return fetch(req, { cache: "no-store" }).then(function (response) {
      if (!response || !response.ok) {
        throw new Error("App resource unavailable");
      }
      if (response && response.status === 200) {
        var clone = response.clone();
        return caches
          .open(CACHE_NAME)
          .then(function (cache) {
            return cache.put(normalizedRequest, clone);
          })
          .then(function () {
            return response;
          })
          .catch(function () {
            return response;
          });
      }
      return response;
    });
  }

  var isAppShellRequest =
    req.mode === "navigate" ||
    req.destination === "document" ||
    req.destination === "script" ||
    req.destination === "worker" ||
    req.destination === "style" ||
    req.destination === "font" ||
    req.destination === "image" ||
    /\.(html|js|css|wasm)(\?|$)/i.test(req.url);

  if (isAppShellRequest) {
    e.respondWith(
      // Check the network at app launch; reuse this build's cache when offline.
      updateCacheFromNetwork().catch(function (error) {
        return caches.open(CACHE_NAME).then(function (cache) {
          return cache.match(normalizedRequest).then(function (cached) {
            if (cached) return cached;
            if (req.mode === "navigate" || req.destination === "document") {
              return cache.match("./index.html");
            }
            throw error;
          });
        });
      })
    );
    return;
  }

  e.respondWith(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.match(normalizedRequest).then(function (response) {
        return response || fetch(req);
      });
    })
  );
});
