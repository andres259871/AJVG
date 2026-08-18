from PIL import Image, ImageDraw
import math

NAVY = (15, 23, 38)      # background
GOLD = (216, 175, 108)   # accent
GOLD_SOFT = (233, 201, 150)

def make_icon(size, filename, padding_ratio=0.18):
    img = Image.new("RGB", (size, size), NAVY)
    draw = ImageDraw.Draw(img)

    cx, cy = size / 2, size / 2
    pad = size * padding_ratio
    r = size / 2 - pad

    ring_width = max(2, size * 0.035)
    draw.ellipse(
        [cx - r, cy - r, cx + r, cy + r],
        outline=GOLD,
        width=int(ring_width),
    )

    # small tick marks at 12, 3, 6, 9
    tick_len = r * 0.12
    for angle_deg in [0, 90, 180, 270]:
        angle = math.radians(angle_deg - 90)
        x1 = cx + math.cos(angle) * (r - ring_width)
        y1 = cy + math.sin(angle) * (r - ring_width)
        x2 = cx + math.cos(angle) * (r - ring_width - tick_len)
        y2 = cy + math.sin(angle) * (r - ring_width - tick_len)
        draw.line([x1, y1, x2, y2], fill=GOLD, width=int(ring_width * 0.8))

    # clock hands pointing slightly off-center (a moment, not a fixed time)
    hand_len_long = r * 0.55
    hand_len_short = r * 0.34
    angle_long = math.radians(-60)
    angle_short = math.radians(40)

    x_long = cx + math.cos(angle_long) * hand_len_long
    y_long = cy + math.sin(angle_long) * hand_len_long
    x_short = cx + math.cos(angle_short) * hand_len_short
    y_short = cy + math.sin(angle_short) * hand_len_short

    draw.line([cx, cy, x_long, y_long], fill=GOLD_SOFT, width=int(ring_width * 0.9))
    draw.line([cx, cy, x_short, y_short], fill=GOLD_SOFT, width=int(ring_width * 0.9))

    center_r = ring_width * 0.9
    draw.ellipse(
        [cx - center_r, cy - center_r, cx + center_r, cy + center_r],
        fill=GOLD,
    )

    img.save(filename)

make_icon(512, "icon-512.png")
make_icon(192, "icon-192.png")
make_icon(180, "apple-touch-icon.png", padding_ratio=0.20)
make_icon(32, "favicon-32.png", padding_ratio=0.12)

print("done")
