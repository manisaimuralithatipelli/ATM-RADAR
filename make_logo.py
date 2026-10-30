import sys
from PIL import Image
src = Image.open(sys.argv[1]).convert("RGB")
square = src.crop((240, 224, 1040, 1024))
for name, size in [("logo-128", 128), ("logo-180", 180), ("favicon-48", 48)]:
    square.resize((size, size), Image.LANCZOS).save(f"public/images/{name}.png", optimize=True)