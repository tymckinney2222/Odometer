/* Odometer — service worker
   Strategy:
   - HTML (navigation): network-first, fall back to cache when offline.
     This guarantees you always get the newest app when online, but it still
     opens offline.
   - Static assets (icons, manifest): cache-first for speed.
   Bump CACHE_VERSION on each deploy to retire old caches.
*/
var CACHE_VERSION = "odometer-v1";
var CORE_ASSETS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/maskable-192.png",
  "./icons/maskable-512.png",
  "./icons/apple-touch-icon.png",
  "./icons/favicon-32.png"
];

self.addEventListener("install", function(e){
  e.waitUntil(
    caches.open(CACHE_VERSION).then(function(cache){
      return cache.addAll(CORE_ASSETS).catch(function(){ /* ignore individual misses */ });
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", function(e){
  e.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.map(function(k){
        if(k !== CACHE_VERSION){ return caches.delete(k); }
      }));
    }).then(function(){ return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function(e){
  var req = e.request;
  if(req.method !== "GET"){ return; }

  var accept = req.headers.get("accept") || "";
  var isHTML = req.mode === "navigate" || accept.indexOf("text/html") !== -1;

  if(isHTML){
    // Network-first for pages
    e.respondWith(
      fetch(req).then(function(res){
        var copy = res.clone();
        caches.open(CACHE_VERSION).then(function(c){ c.put(req, copy); });
        return res;
      }).catch(function(){
        return caches.match(req).then(function(hit){
          return hit || caches.match("./index.html");
        });
      })
    );
    return;
  }

  // Cache-first for everything else (icons, manifest, etc.)
  e.respondWith(
    caches.match(req).then(function(hit){
      if(hit){ return hit; }
      return fetch(req).then(function(res){
        var copy = res.clone();
        caches.open(CACHE_VERSION).then(function(c){ c.put(req, copy); });
        return res;
      }).catch(function(){ return hit; });
    })
  );
});
