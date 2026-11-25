// 오프라인 실행용 서비스 워커
// 파일을 수정해 다시 배포할 때는 CACHE 이름의 숫자를 올려야 iPhone에 새 버전이 반영됨
const CACHE = "fretlab-v1.7.0";
const ASSETS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./css/app.css",
  "./js/app.js",
  "./js/data/catalog.js",
  "./js/core/clock.js",
  "./js/core/storage.js",
  "./js/core/session.js",
  "./js/core/journal.js",
  "./js/core/backup.js",
  "./js/audio/context.js",
  "./js/audio/scheduler.js",
  "./js/audio/metronome.js",
  "./js/theory/notes.js",
  "./js/render/fretboard.js",
  "./js/modules/notes/finder-core.js",
  "./js/modules/notes/finder-view.js",
  "./js/theory/chords.js",
  "./js/theory/voicings.js",
  "./js/render/chordbox.js",
  "./js/modules/chords/prompts.js",
  "./js/modules/chords/random-core.js",
  "./js/modules/chords/random-view.js",
  "./js/modules/chords/dictionary-view.js",
  "./js/modules/chords/bpm-core.js",
  "./js/modules/chords/bpm-view.js",
  "./js/modules/chords/play-core.js",
  "./js/modules/chords/play-view.js",
  "./js/render/chordsheet.js",
  "./js/theory/scales.js",
  "./js/render/scaleboard.js",
  "./js/modules/scales/common.js",
  "./js/modules/scales/block-core.js",
  "./js/modules/scales/drill-core.js",
  "./js/modules/scales/seg-player.js",
  "./js/modules/scales/drill-settings.js",
  "./js/modules/scales/shape-view.js",
  "./js/modules/scales/rootcycle-view.js",
  "./js/modules/scales/start-view.js",
  "./js/modules/scales/mode-view.js",
  "./js/modules/scales/transition-view.js",
  "./js/modules/scales/root-view.js",
  "./icons/icon.svg",
  "./icons/apple-touch-icon.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

self.addEventListener("install", event => {
  // 브라우저 HTTP 캐시를 거치지 않고 서버에서 새로 받아 저장 (예전 파일이 새 캐시에 섞이는 것 방지)
  event.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(ASSETS.map(u => new Request(u, { cache: "reload" }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith("fretlab-") && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// 온라인: 서버에서 최신 파일을 받아 쓰고 캐시도 갱신(4초 안에 응답이 없으면 캐시 사용)
// 오프라인: 캐시에 저장된 파일로 실행
self.addEventListener("fetch", event => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  const fromCache = () => caches.match(req, { ignoreSearch: true })
    .then(hit => hit || (req.mode === "navigate" ? caches.match("./index.html") : Response.error()));
  const fromNet = fetch(req, { cache: "no-cache" }).then(res => {
    if (res && res.status === 200 && res.type === "basic") {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(req, copy));
    }
    return res;
  });
  event.respondWith(new Promise(resolve => {
    let done = false;
    const timer = setTimeout(() => { if (!done) { done = true; resolve(fromCache()); } }, 4000);
    fromNet.then(res => { if (!done) { done = true; clearTimeout(timer); resolve(res); } })
      .catch(() => { if (!done) { done = true; clearTimeout(timer); resolve(fromCache()); } });
  }));
});
