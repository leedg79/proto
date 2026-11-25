# 음원 만들기: FluidR3_GM(gleitz/midi-js-soundfonts) 악기 파일에서 필요한 음만 3반음 간격으로 뽑아 sounds/<악기>/<midi>.mp3로 저장
# 출처: https://github.com/gleitz/midi-js-soundfonts (FluidR3 GM, Frank Wen, MIT / CC BY 3.0)
import base64, json, os, re, sys, urllib.request

SRC = "https://raw.githubusercontent.com/gleitz/midi-js-soundfonts/gh-pages/FluidR3_GM/{}-mp3.js"
INSTRUMENTS = {
    "guitar": ("electric_guitar_clean", 40, 88),   # E2 ~ E6
    "acoustic": ("acoustic_guitar_steel", 40, 79),  # E2 ~ G5 (코드 반주)
    "bass": ("electric_bass_finger", 28, 55),       # E1 ~ G3
}
NAMES = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"]
name_of = lambda m: f"{NAMES[m % 12]}{m // 12 - 1}"

def main(out_dir, cache_dir):
    index = {}
    for key, (inst, lo, hi) in INSTRUMENTS.items():
        cache = os.path.join(cache_dir, inst + ".js")
        if not os.path.exists(cache):
            urllib.request.urlretrieve(SRC.format(inst), cache)
        text = open(cache, encoding="utf-8").read()
        notes = dict(re.findall(r'"([A-G]b?\d)":\s*"data:audio/mp3;base64,([^"]+)"', text))
        d = os.path.join(out_dir, key)
        os.makedirs(d, exist_ok=True)
        kept = []
        for m in range(lo, hi + 1, 3):
            b64 = notes.get(name_of(m))
            if not b64:
                continue
            open(os.path.join(d, f"{m}.mp3"), "wb").write(base64.b64decode(b64))
            kept.append(m)
        index[key] = kept
    json.dump(index, open(os.path.join(out_dir, "index.json"), "w"))
    print(json.dumps(index))

if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
