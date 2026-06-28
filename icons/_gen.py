"""Generate simple placeholder icons (red square with white >> mark)."""
from PIL import Image, ImageDraw, ImageFont
import os

OUT_DIR = os.path.dirname(os.path.abspath(__file__))
SIZES = [16, 48, 128]
RED = (204, 0, 0, 255)
WHITE = (255, 255, 255, 255)


def draw(size: int) -> Image.Image:
    img = Image.new("RGBA", (size, size), RED)
    d = ImageDraw.Draw(img)
    # Rounded look: draw two right-facing chevrons (>>)
    pad = max(2, size // 6)
    thick = max(1, size // 10)
    # First chevron
    p1 = [(pad, pad), (size // 2, size // 2), (pad, size - pad)]
    p2 = [(size // 2, pad), (size - pad, size // 2), (size // 2, size - pad)]
    d.line(p1, fill=WHITE, width=thick, joint="curve")
    d.line(p2, fill=WHITE, width=thick, joint="curve")
    return img


for s in SIZES:
    path = os.path.join(OUT_DIR, f"icon-{s}.png")
    draw(s).save(path)
    print("wrote", path)
