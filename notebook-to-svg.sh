#!/usr/bin/env bash
# notebook-to-svg.sh — turn a notebook page photo into a theme-aware inline SVG.
# Paper becomes transparent; ink inherits the active page color via fill="currentColor".
#
# usage:
#     ./notebook-to-svg.sh <input.jpg|input.png> > <output.svg>
#
# Embed in HTML: wrap the SVG in a div (e.g. class="notebook-svg") and set color on
# that wrapper so fill="currentColor" follows your theme.
#
# Tunable knobs (override via env vars at call time):
#     LEVEL      paper crush range. raise the low end if the photo is dim.
#                default: 30%,75%
#     THRESHOLD  ink/no-ink cutoff. lower keeps thinner ink, higher drops it.
#                default: 60%
#     TURDSIZE   potrace -t. drop noise specks smaller than N px.
#                default: 8
#     SMOOTH     potrace -O. corner smoothing in [0, 1.334]. higher = rounder.
#                default: 0.4
#     MAX_WIDTH  pre-resize cap (px) to keep SVG path count and size in check.
#                default: 1500
#
# Requires: ImageMagick (magick or convert) and potrace
#   macOS:  brew install potrace imagemagick  → magick
#   Debian/Docker: apt install imagemagick     → often convert (IM6)

set -euo pipefail

LEVEL="${LEVEL:-30%,75%}"
THRESHOLD="${THRESHOLD:-60%}"
TURDSIZE="${TURDSIZE:-8}"
SMOOTH="${SMOOTH:-0.4}"
MAX_WIDTH="${MAX_WIDTH:-1500}"

if [ "$#" -ne 1 ]; then
    echo "usage: $0 <input.jpg|input.png> > <output.svg>" >&2
    exit 64
fi

IN="$1"
if [ ! -f "$IN" ]; then
    echo "input not found: $IN" >&2
    exit 66
fi

if command -v magick >/dev/null 2>&1; then
    MAGICK=magick
elif command -v convert >/dev/null 2>&1; then
    MAGICK=convert
else
    echo "missing tool: magick or convert (ImageMagick)" >&2
    echo "  macOS: brew install potrace imagemagick" >&2
    echo "  Debian: apt install imagemagick potrace" >&2
    exit 69
fi

for tool in potrace sed awk; do
    if ! command -v "$tool" >/dev/null 2>&1; then
        echo "missing tool: $tool" >&2
        exit 69
    fi
done

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

PBM="$TMP/page.pbm"
RAW="$TMP/raw.svg"

# 1. Photo -> 1-bit PBM. Auto-orient handles EXIF rotation. Resize caps the
#    raster resolution so potrace doesn't emit thousands of tiny paths.
#    Grayscale + level + threshold crushes paper to white and ink to black.
"$MAGICK" "$IN" \
    -auto-orient \
    -resize "${MAX_WIDTH}x>" \
    -colorspace Gray \
    -level "$LEVEL" \
    -threshold "$THRESHOLD" \
    "$PBM"

# 2. PBM -> SVG. -s = SVG output. -t drops noise specks. -O smooths corners.
potrace "$PBM" -s -t "$TURDSIZE" -O "$SMOOTH" -o "$RAW"

# 3. Clean for inline HTML embed:
#    - strip XML prolog + DOCTYPE (both lines of the DOCTYPE block)
#    - swap fill="#000000" / "#000" / "black" -> fill="currentColor"
#    - drop the <metadata>…</metadata> attribution block
#    - drop blank lines so the embedded markup stays tight
sed -e '/^<?xml/d' \
    -e '/<!DOCTYPE/d' \
    -e '/svg10\.dtd/d' \
    -e 's/fill="#000000"/fill="currentColor"/g' \
    -e 's/fill="#000"/fill="currentColor"/g' \
    -e 's/fill="black"/fill="currentColor"/g' \
    "$RAW" \
| awk '
    /<metadata>/ { skip=1; next }
    /<\/metadata>/ { skip=0; next }
    skip { next }
    { print }
  ' \
| sed -e '/^[[:space:]]*$/d'
