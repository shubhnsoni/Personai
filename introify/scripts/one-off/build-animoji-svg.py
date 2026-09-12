"""Export bounce/sun/et WebP clips as 46-frame filmstrips for the SVG player."""
from __future__ import annotations

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
WEBP = ROOT / "public" / "bots" / "animoji"
OUT = ROOT / "public" / "bots" / "animoji" / "coded"
FACES = ("bounce", "sun", "et")


def frames_of(name: str) -> list[Image.Image]:
    im = Image.open(WEBP / f"{name}.webp")
    out = []
    for index in range(im.n_frames):
        im.seek(index)
        out.append(im.convert("RGBA"))
    return out


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for name in FACES:
        frames = frames_of(name)
        width, height = frames[0].size
        sheet = Image.new("RGBA", (width * len(frames), height), (0, 0, 0, 0))
        for index, frame in enumerate(frames):
            sheet.paste(frame, (index * width, 0), frame)
        dest = OUT / f"{name}.webp"
        sheet.save(dest, "WEBP", quality=90, method=6)
        print(name, len(frames), dest.stat().st_size)


if __name__ == "__main__":
    main()
