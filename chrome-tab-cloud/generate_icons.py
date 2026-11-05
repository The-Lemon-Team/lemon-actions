import struct
import zlib
import math

def create_cloud_png(size, filepath):
    width, height = size, size
    # Create RGBA buffer
    raw_data = bytearray()
    
    # Cloud circles center and radii relative to size
    circles = [
        (0.35 * width, 0.58 * height, 0.22 * width),
        (0.52 * width, 0.44 * height, 0.26 * width),
        (0.68 * width, 0.54 * height, 0.22 * width),
        (0.40 * width, 0.64 * height, 0.20 * width),
        (0.60 * width, 0.64 * height, 0.20 * width),
    ]

    for y in range(height):
        raw_data.append(0)  # filter type 0 (None)
        for x in range(width):
            # Check distance to cloud circles
            min_dist = 999999
            in_cloud = False
            for cx, cy, r in circles:
                d = math.hypot(x - cx, y - cy)
                if d <= r:
                    in_cloud = True
                    break
            
            # Bottom flat fill
            if not in_cloud and 0.25 * width <= x <= 0.75 * width and 0.54 * height <= y <= 0.76 * height:
                in_cloud = True

            if in_cloud:
                # Sky blue gradient with highlight
                norm_y = y / height
                r_col = int(56 + norm_y * 40)
                g_col = int(140 + norm_y * 50)
                b_col = int(245)
                alpha = 245
            else:
                r_col, g_col, b_col, alpha = 0, 0, 0, 0
                
            raw_data.extend([r_col, g_col, b_col, alpha])

    # Compress IDAT
    compressed = zlib.compress(raw_data)

    def png_chunk(tag, data):
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xffffffff)

    png_bytes = b"\x89PNG\r\n\x1a\n"
    # IHDR
    png_bytes += png_chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0))
    # IDAT
    png_bytes += png_chunk(b"IDAT", compressed)
    # IEND
    png_bytes += png_chunk(b"IEND", b"")

    with open(filepath, "wb") as f:
        f.write(png_bytes)

for s in [16, 48, 128]:
    create_cloud_png(s, f"chrome-tab-cloud/icons/icon{s}.png")
print("Icons generated successfully!")
