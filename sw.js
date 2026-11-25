// 오프라인 실행용 서비스 워커
// 파일을 수정해 다시 배포할 때는 CACHE 이름의 숫자를 올려야 iPhone에 새 버전이 반영됨
const CACHE = "fretlab-v1.6.1";
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
  "./js/modules/scales/interval-core.js",
  "./js/modules/scales/interval-view.js",
  "./js/modules/scales/block-core.js",
  "./js/modules/scales/learning-view.js",
  "./js/modules/scales/transition-view.js",
  "./js/modules/scales/root-view.js",
  "./icons/icon.svg",
  "./icons/apple-touch-icon.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith("fretlab-") && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then(hit => {
      if (hit) return hit;
      return fetch(req).then(res => {
        if (res && res.status === 200 && res.type === "basic") {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
        }
        return res;
      }).catch(() => (req.mode === "navigate" ? caches.match("./index.html") : Response.error()));
    })
  );
});
