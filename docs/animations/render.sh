#!/usr/bin/env bash
# Render every scene to an optimised GIF in docs/media/.
#
#   ./render.sh            all three scenes
#   ./render.sh TheLoop    just one
#
# manim emits MP4; GitHub will not play a repo-relative <video> in a README but
# renders a GIF inline anywhere, so the MP4 is an intermediate and the GIF is
# the artifact. The two-pass palette is what keeps flat colour flat: a single
# pass quantises the paper background into visible banding.

set -euo pipefail

cd "$(dirname "$0")"
OUT="../media"
QUALITY="-qm"          # 1280x720 source; the GIF is 960 wide, so 1080p buys nothing
GIF_WIDTH=960
GIF_FPS=16

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

for scene in "${SCENES[@]}"; do
  echo "==> $scene"
  manim render $QUALITY --format mp4 scenes.py "$scene"

  mp4=$(find "${IC_MEDIA_DIR:-${TMPDIR:-/tmp}/inspect-comment-anim}" \
        -name "${scene}.mp4" -print -quit 2>/dev/null || true)
  if [ -z "$mp4" ]; then
    echo "    no mp4 found for $scene, skipping gif" >&2
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
