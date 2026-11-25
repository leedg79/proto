// 박자 스케줄러 (메트로놈·반주 공용)
// 소리를 내는 시각은 오디오 하드웨어 시계(AudioContext.currentTime)로 정함
// 타이머는 "곧 울릴 박을 미리 예약하라"는 깨우기 용도로만 쓰므로,
// 타이머가 조금 늦게 깨어나도 실제 박자는 흔들리지 않음

export class BeatScheduler {
  constructor(ctx, { lookaheadSec = 0.12, wakeMs = 25 } = {}) {
    this.ctx = ctx;
    this.lookahead = lookaheadSec;
    this.wakeMs = wakeMs;
    this.bpm = 90;
    this.beatsPerBar = 4;
    this.onBeat = null;          // (time, beatIndex, beatInBar, barIndex) => void
    this._timer = null;
    this._nextTime = 0;
    this._beat = 0;
    this._pendingBpm = null;
  }

  get running() { return this._timer !== null; }

  // BPM 변경은 다음 박부터 적용
  setBpm(bpm) {
    const v = Math.max(30, Math.min(300, Math.round(bpm)));
    if (this.running) this._pendingBpm = v; else this.bpm = v;
  }

  start(atTime) {
    if (this.running) return;
    this._beat = 0;
    this._nextTime = Math.max(atTime ?? this.ctx.currentTime + 0.06, this.ctx.currentTime + 0.02);
    this._tick();
  }

  stop() {
    clearTimeout(this._timer);
    this._timer = null;
    this._pendingBpm = null;
  }

  _tick() {
    const horizon = this.ctx.currentTime + this.lookahead;
    while (this._nextTime < horizon) {
      const inBar = this._beat % this.beatsPerBar;
      const bar = Math.floor(this._beat / this.beatsPerBar);
      if (this.onBeat) this.onBeat(this._nextTime, this._beat, inBar, bar);
      if (this._pendingBpm != null) { this.bpm = this._pendingBpm; this._pendingBpm = null; }
      this._nextTime += 60 / this.bpm;
      this._beat += 1;
    }
    this._timer = setTimeout(() => this._tick(), this.wakeMs);
  }
}
