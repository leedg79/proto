// 마이크 입력 블록(128샘플)마다 고역 강조 에너지를 계산해 [시각, 에너지] 묶음으로 보냄
// 계산식은 onset-core.js의 blockEnergy와 같음
class OnsetEnergy extends AudioWorkletProcessor {
  constructor() { super(); this.last = 0; this.buf = []; }
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (ch && ch.length) {
      let s = 0, p = this.last;
      for (let i = 0; i < ch.length; i++) { const d = ch[i] - p; s += d * d; p = ch[i]; }
      this.last = p;
      this.buf.push(currentTime, s / ch.length);
      if (this.buf.length >= 8) { this.port.postMessage(this.buf); this.buf = []; }
    }
    return true;
  }
}
registerProcessor("onset-energy", OnsetEnergy);
