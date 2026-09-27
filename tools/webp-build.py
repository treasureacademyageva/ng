#!/usr/bin/env python3
"""Generate .webp siblings for heavy photographic images and report savings.
Originals are kept as fallbacks (referenced via <picture>). Excludes logo/icon/
og-cover/shop/partner art where webp gain is small or files are pinned."""
import os, glob
from PIL import Image

EXCLUDE_PREFIX = ("logo", "icon-", "og-cover", "shop-", "favicon")
THRESHOLD = 120 * 1024  # only convert originals bigger than this
MAX_DIM = 860           # enough for the site's displayed cards/hero at phone and desktop sizes
QUALITY = 62            # photographic WebPs land around 60–100 KB instead of 140–260 KB

def convert(path):
    im = Image.open(path)
    has_alpha = im.mode in ("RGBA", "LA") or (im.mode == "P" and "transparency" in im.info)
    im = im.convert("RGBA" if has_alpha else "RGB")
    im.thumbnail((MAX_DIM, MAX_DIM), Image.Resampling.LANCZOS)
    out = os.path.splitext(path)[0] + ".webp"
    im.save(out, "WEBP", quality=QUALITY, method=6)
    return out

total_before = total_after = 0
made = []
for path in sorted(glob.glob("assets/img/*.png") + glob.glob("assets/img/*.jpg") + glob.glob("assets/img/*.jpeg")):
    name = os.path.basename(path)
    if name.startswith(EXCLUDE_PREFIX):
        continue
    if os.path.getsize(path) < THRESHOLD:
        continue
    before = os.path.getsize(path)
    out = convert(path)
    after = os.path.getsize(out)
    total_before += before; total_after += after
    made.append((name, before, after))
    print(f"{name:26} {before//1024:4}KB -> {after//1024:4}KB  ({100-after*100//before}% smaller)")

print(f"\n{len(made)} files: {total_before//1024}KB -> {total_after//1024}KB  saved {(total_before-total_after)//1024}KB")
