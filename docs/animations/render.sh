#!/usr/bin/env bash
# Render every scene to an optimised GIF in docs/media/.
#
#   ./render.sh             all three README scenes
#   ./render.sh TheLoop     just one
#   ./render.sh LinkedIn    the 16:9 social cut, as mp4
#
# manim emits MP4; GitHub will not play a repo-relative <video> in a README but
# renders a GIF inline anywhere, so for the README scenes the MP4 is an
# intermediate and the GIF is the artifact. The two-pass palette is what keeps
# flat colour flat: a single pass quantises the paper background into visible
# banding.

set -euo pipefail

cd "$(dirname "$0")"
OUT="../media"
QUALITY="-qm"          # 1280x720 source; the GIF is 800 wide, so 1080p buys nothing

# 800 and 12, not 960 and 16. GitHub renders a README at about 860px, so
# anything past that is only ever downscaled by the browser, and these scenes
# are mostly long holds on static frames where the extra frames cost bytes and
# show nothing. Together the two took the-loop.gif from 3.3M to 2.0M.
#
# 128 colours is the floor, not a target. Dropping to 64 saves another 400K and
# puts visible dither into the flat paper background, which is the exact banding
# the two-pass palette below exists to prevent.
GIF_WIDTH=800
GIF_FPS=12

# WHY --media_dir on the CLI and not just theme.configure(): manim parses its
# own config AFTER importing the scene module, so anything the module sets for
# media_dir is overwritten before a frame is written. The scratch dir is passed
# here so the mp4s land where this script goes looking for them.
SCRATCH="${IC_MEDIA_DIR:-${TMPDIR:-/tmp}/inspect-comment-anim}"

mkdir -p "$OUT" "$SCRATCH"

SCENES=("${@:-}")
if [ -z "${SCENES[0]:-}" ]; then
  SCENES=(TheLoop OneClick ServerComponents)
fi

# Lowercase-with-dashes, so TheLoop becomes the-loop.gif
slug() {
  sed -E 's/([a-z0-9])([A-Z])/\1-\2/g' <<<"$1" | tr '[:upper:]' '[:lower:]'
}

# LinkedIn lives in its own module and ships as mp4, not gif. It is 1920x1080
# and about 43 seconds, which as a GIF would run to tens of megabytes, and
# nothing outside a README needs a GIF anyway.
module_for() {
  if [ "$1" = "LinkedIn" ]; then echo linkedin.py; else echo scenes.py; fi
}

for scene in "${SCENES[@]}"; do
  echo "==> $scene"
  manim render $QUALITY --format mp4 --media_dir "$SCRATCH" "$(module_for "$scene")" "$scene"

  # Most recent, not first found: rendering the same scene at another size
  # leaves an older file of the same name elsewhere in the scratch tree, and
  # -print -quit would happily return that one.
  mp4=$(find "$SCRATCH" -name "${scene}.mp4" -printf "%T@ %p\n" 2>/dev/null \
        | sort -rn | head -1 | cut -d" " -f2-)
  if [ -z "$mp4" ]; then
    echo "    no mp4 found for $scene, skipping" >&2
    continue
  fi

  if [ "$scene" = "LinkedIn" ]; then
    out="$OUT/linkedin.mp4"
    # Re-encoded rather than copied. manim writes a high-bitrate intermediate,
    # and LinkedIn re-encodes on upload regardless, so handing it a clean
    # yuv420p h264 is the difference between one generation of loss and two.
    # yuv420p specifically: manim can emit yuv444p, which Safari will not play.
    ffmpeg -v error -y -i "$mp4" \
      -c:v libx264 -preset slow -crf 20 -pix_fmt yuv420p -movflags +faststart \
      -r 30 "$out"
    printf "    %s  %s  %s\n" "$out" "$(du -h "$out" | cut -f1)" \
      "$(ffprobe -v error -select_streams v -show_entries stream=width,height \
         -of csv=p=0 "$out")"
    continue
  fi

  gif="$OUT/$(slug "$scene").gif"
  pal=$(mktemp -t icpal.XXXXXX).png

  ffmpeg -v error -y -i "$mp4" \
    -vf "fps=$GIF_FPS,scale=$GIF_WIDTH:-1:flags=lanczos,palettegen=max_colors=128:stats_mode=diff" \
    "$pal"
  ffmpeg -v error -y -i "$mp4" -i "$pal" \
    -lavfi "fps=$GIF_FPS,scale=$GIF_WIDTH:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=3:diff_mode=rectangle" \
    "$gif"
  rm -f "$pal"

  printf "    %s  %s\n" "$gif" "$(du -h "$gif" | cut -f1)"
done
