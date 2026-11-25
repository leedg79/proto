# 앱 아이콘 PNG 생성 (개발용, 앱 실행에는 필요 없음)
# 실행: python3 tools/make_icons.py
from PIL import Image, ImageDraw
import os

BG = (13, 17, 25)
LINE = (149, 162, 181)
ACCENT = (166, 243, 107)
OUT = os.path.join(os.path.dirname(__file__), "..", "icons")


def icon(size):
    s = 4  # 크게 그린 뒤 줄여서 경계를 부드럽게
    W = size * s
    im = Image.new("RGB", (W, W), BG)
    d = ImageDraw.Draw(im)
    pad = W * 0.2
    # 6개 줄
    for i in range(6):
        y = pad + i * (W - 2 * pad) / 5
        d.line([(pad * 0.7, y), (W - pad * 0.7, y)], fill=LINE, width=max(1, int(W * (0.006 + i * 0.0025))))
    # 프렛 2개
    for x in (W * 0.42, W * 0.66):
        d.line([(x, pad - W * 0.03), (x, W - pad + W * 0.03)], fill=(60, 72, 92), width=int(W * 0.012))
    # 음 위치 점
    r = W * 0.075
    for cx, cy in ((W * 0.54, pad + 1 * (W - 2 * pad) / 5), (W * 0.30, pad + 3 * (W - 2 * pad) / 5), (W * 0.78, pad + 4 * (W - 2 * pad) / 5)):
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=ACCENT)
    return im.resize((size, size), Image.LANCZOS)


os.makedirs(OUT, exist_ok=True)
icon(180).save(os.path.join(OUT, "apple-touch-icon.png"))
icon(192).save(os.path.join(OUT, "icon-192.png"))
icon(512).save(os.path.join(OUT, "icon-512.png"))
print("ok")
