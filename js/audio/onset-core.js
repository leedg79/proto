// 어택(소리 시작점) 감지 — 순수 함수(브라우저·테스트 공용)
// 128샘플 블록마다 고역 강조 에너지(1차 차분 제곱 평균)를 구하고,
// 천천히 따라가는 평균보다 크게 튀어 오르는 순간을 어택으로 봄
// (피킹 순간의 고역 성분이 가장 뚜렷하고, 울리고 있는 음·벤딩·비브라토는 고역이 크게 늘지 않음)

// 블록 에너지: last = 앞 블록의 마지막 샘플
export function blockEnergy(buf, last = 0) {
  let sum = 0, prev = last;
  for (let i = 0; i < buf.length; i++) { const d = buf[i] - prev; sum += d * d; prev = buf[i]; }
  return { e: sum / buf.length, last: prev };
}

// opts: minGap(초, 이 간격 안의 두 번째 어택은 무시), ratio(평균 대비 배수), floor(절대 최소 에너지), rise(바로 앞 블록 대비 배수)
export class OnsetDetector {
  constructor({ minGap = 0.05, ratio = 4, floor = 2e-6, rise = 1.8, alpha = 0.03 } = {}) {
    Object.assign(this, { minGap, ratio, floor, rise, alpha });
    this.avg = 0; this.prev = 0; this.lastOnset = -1; this.peak = 0;
  }
  setFloor(f) { this.floor = f; }
  // t: 블록 시작 시각(초), e: 블록 에너지 → 어택이면 시각, 아니면 null
  push(t, e) {
    let hit = null;
    const base = Math.max(this.avg * this.ratio, this.floor);
    if (e > base && e > this.prev * this.rise && (this.lastOnset < 0 || t - this.lastOnset >= this.minGap)) {
      hit = t; this.lastOnset = t;
    }
    // 평균(울리고 있는 소리의 수준)은 어택 순간의 큰 값을 덜 반영
    const a = e > this.avg * 4 ? this.alpha * 0.5 : this.alpha;
    this.avg = this.avg * (1 - a) + e * a;
    this.prev = e;
    return hit;
  }
}

// 버퍼 전체를 블록 단위로 돌려 어택 시각 목록(테스트·오프라인용)
export function detectOnsets(samples, sampleRate, opts = {}, block = 128) {
  const det = new OnsetDetector(opts);
  const out = [];
  let last = 0;
  for (let i = 0; i + block <= samples.length; i += block) {
    const r = blockEnergy(samples.subarray(i, i + block), last);
    last = r.last;
    const hit = det.push(i / sampleRate, r.e);
    if (hit != null) out.push(hit);
  }
  return out;
}

// 소음 수준(초 단위 무음 구간 에너지들) → 감지 최소 에너지
export function floorFromNoise(energies) {
  if (!energies.length) return 2e-6;
  const sorted = [...energies].sort((a, b) => a - b);
  const p90 = sorted[Math.floor(sorted.length * 0.9)];
  return Math.max(2e-6, p90 * 8);
}
