#!/usr/bin/env python3
"""Generate PWA icons (white circle on navigome blue) using only stdlib."""

import struct
import sys
import zlib
from pathlib import Path

BLUE = (0x3A, 0x86, 0xFF)
WHITE = (255, 255, 255)


def _chunk(tag: bytes, data: bytes) -> bytes:
    return (
        struct.pack(">I", len(data))
        + tag
        + data
        + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
    )


def make_icon(size: int, path: Path) -> None:
    cx = cy = size / 2 - 0.5
    r2 = (size * 0.30) ** 2
    rows = bytearray()
    for y in range(size):
        rows.append(0)  # filter: none
        dy2 = (y - cy) ** 2
        for x in range(size):
            inside = (x - cx) ** 2 + dy2 <= r2
            rows.extend(WHITE if inside else BLUE)
    ihdr = struct.pack(">IIBBBBB", size, size, 8, 2, 0, 0, 0)
    png = (
        b"\x89PNG\r\n\x1a\n"
        + _chunk(b"IHDR", ihdr)
        + _chunk(b"IDAT", zlib.compress(bytes(rows), 9))
        + _chunk(b"IEND", b"")
    )
    path.write_bytes(png)
    print(f"wrote {path} ({len(png)} bytes)")


def main() -> int:
    out = Path(__file__).resolve().parent.parent / "icons"
    out.mkdir(exist_ok=True)
    make_icon(192, out / "icon-192.png")
    make_icon(512, out / "icon-512.png")
    return 0


if __name__ == "__main__":
    sys.exit(main())
