// 음 높이·코드 감지 (순수 함수: 브라우저·테스트 공용)
// - YIN: 단음의 기본 주파수
// - 크로마: 스펙트럼을 12음 이름별 세기로 모아 코드 구성음 판정

const mod = n => ((n % 12) + 12) % 12;
export const freqToMidi = f => 69 + 12 * Math.log2(f / 440);
export const midiToFreq = m => 440 * Math.pow(2, (m - 69) / 12);

// YIN (de Cheveigné & Kawahara 2002) — buf: Float32Array, 결과 { freq, clarity(0~1), rms }
export function yin(buf, sampleRate, { fmin = 70, fmax = 1400, threshold = 0.15 } = {}) {
  const N = buf.length;
  let rms = 0;
  for (let i = 0; i < N; i++) rms += buf[i] * buf[i];
  rms = Math.sqrt(rms / N);
  const tauMin = Math.max(2, Math.floor(sampleRate / fmax));
  const tauMax = Math.min(Math.floor(sampleRate / fmin), Math.floor(N / 2));
  const W = N - tauMax;
  if (W < 64 || tauMax <= tauMin) return { freq: 0, clarity: 0, rms };
  const d = new Float32Array(tauMax + 1);
  for (let tau = 1; tau <= tauMax; tau++) {
    let s = 0;
    for (let i = 0; i < W; i++) { const x = buf[i] - buf[i + tau]; s += x * x; }
    d[tau] = s;
  }
  // 누적 평균 정규화
  const cm = new Float32Array(tauMax + 1);
  cm[0] = 1;
  let run = 0;
  for (let tau = 1; tau <= tauMax; tau++) { run += d[tau]; cm[tau] = run > 0 ? (d[tau] * tau) / run : 1; }
  let tau = -1;
  for (let t = tauMin; t <= tauMax; t++) {
    if (cm[t] < threshold) { while (t + 1 <= tauMax && cm[t + 1] < cm[t]) t++; tau = t; break; }
  }
  if (tau < 0) {
    // 문턱 아래가 없으면 가장 낮은 값(신뢰도 낮음)
    let best = tauMin;
    for (let t = tauMin; t <= tauMax; t++) if (cm[t] < cm[best]) best = t;
    if (cm[best] > 0.4) return { freq: 0, clarity: 1 - cm[best], rms };
    tau = best;
  }
  // 포물선 보간
  let better = tau;
  if (tau > 1 && tau < tauMax) {
    const a = cm[tau - 1], b = cm[tau], c = cm[tau + 1];
    const den = a + c - 2 * b;
    if (den !== 0) better = tau + (a - c) / (2 * den);
  }
  return { freq: sampleRate / better, clarity: Math.max(0, 1 - cm[tau]), rms };
}

// 주파수 → { midi(가장 가까운 음), cents(어긋남) }
export function nearestNote(freq) {
  if (!(freq > 0)) return null;
  const m = freqToMidi(freq);
  const midi = Math.round(m);
  return { midi, cents: Math.round((m - midi) * 100) };
}

// 크로마: mag(선형 세기 배열, 길이 = fftSize/2), sampleRate, fftSize → 12칸 정규화 배열
export function chroma(mag, sampleRate, fftSize, { fmin = 75, fmax = 2200 } = {}) {
  const c = new Float64Array(12);
  const binHz = sampleRate / fftSize;
  const lo = Math.max(1, Math.floor(fmin / binHz)), hi = Math.min(mag.length - 1, Math.ceil(fmax / binHz));
  for (let i = lo; i <= hi; i++) {
    const v = mag[i];
    if (!(v > 0)) continue;
    const m = freqToMidi(i * binHz);
    const pc = mod(Math.round(m));
    // 반음 경계 근처 칸은 덜 반영
    const w = 1 - Math.min(1, Math.abs(m - Math.round(m)) * 1.6);
    c[pc] += v * v * Math.max(0, w);
  }
  const total = c.reduce((a, x) => a + x, 0) || 1;
  return Array.from(c, x => x / total);
}
// dB 배열(AnalyserNode.getFloatFrequencyData) → 선형 세기
export function dbToMag(db) { const out = new Float32Array(db.length); for (let i = 0; i < db.length; i++) out[i] = Number.isFinite(db[i]) ? Math.pow(10, db[i] / 20) : 0; return out; }

// 코드 판정: 구성음 몫(배음 때문에 5도·3도가 섞여도 구성음 쪽이 커야 함)과 근음 존재
export function chordScore(ch, pcs, root = null) {
  const set = new Set(pcs.map(mod));
  const inSum = [...set].reduce((a, p) => a + ch[p], 0);
  const outMax = Math.max(...ch.map((v, p) => (set.has(p) ? 0 : v)));
  // 기타 보이싱은 5음을 빼는 일이 많아 구성음 전부를 요구하지 않음: 구성음 중 3개(3음 코드는 2개) 이상이 들려야 함
  const present = [...set].filter(p => ch[p] >= 0.05).length;
  const need = Math.min(set.size, set.size >= 4 ? 3 : 2);
  const rootOk = root == null || ch[mod(root)] >= 0.04;
  const ok = inSum >= 0.65 && rootOk && outMax < 0.18 && present >= need;
  return { ok, inSum, outMax, rootOk, present };
}
