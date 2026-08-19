"""
Format, palette and primitives shared by the README animations.

The palette is not invented: ACCENT and SELECT are the tool's own default
outline colours, straight out of DEFAULTS in src/inspect-comment.js, so an
animation of the tool is drawn in the colours the tool actually paints.

The design size and the frame size are two different numbers on purpose. A
draft renders at a fraction of the resolution to be quick, and a CSS pixel has
to keep meaning the same thing when it does, so PXU is pinned to the design
size and never read back off manim's config.
"""

import os
from pathlib import Path

import numpy as np
from manim import config, register_font

# ------------------------------------------------------------------- format

DESIGN_W = 1280           # the card, in CSS pixels
DESIGN_H = 720
FRAME_W = 16.0            # the same card, in manim units
FRAME_H = 9.0

PXU = DESIGN_H / FRAME_H  # 80 px per manim unit

# ------------------------------------------------------------------ palette

CANVAS = "#f6f5f1"        # paper
INK = "#161512"
INK_DIM = "#484540"
INK_MUTE = "#6f6a60"
LINE = "#dcd8cd"
PANEL = "#161512"         # the tool's own panel is near-black
PANEL_TEXT = "#f6f5f1"
PANEL_DIM = "#918a7c"
PANEL_LINE = "#33322f"

ACCENT = "#3a4a5c"        # DEFAULTS.accent: the hover outline
SELECT = "#c23a12"        # DEFAULTS.select: the selected outline
WARN = "#d8a657"
GOOD = "#4a7c59"

# ------------------------------------------------------------------- strokes

HAIR = 1.0
BOX = 2.0
OUTLINE = 3.0

# --------------------------------------------------------------------- type

# DECISION: system families, not registered TTFs.
#
# manim's register_font() works, and the brand faces (JB Mono, General Sans, PP
# Display, sitting in the paperdeck project) render correctly through it. It is
# also catastrophically slow on Windows: measured at ~4.5s per unique string,
# against ~0.06s for a family Pango already knows. A scene here holds well over
# a hundred distinct strings, so that is the difference between a render that
# takes a minute and one that takes an hour and climbs past 5 GB of RSS.
#
# JetBrainsMono Nerd Font is JetBrains Mono with extra glyphs, so the monospace
# face, which carries almost all the type here, is the intended one anyway.
MONO = "JetBrainsMono Nerd Font"
BODY = "Georgia"                 # Segoe UI renders spurious intra-word gaps here
DISPLAY = "Bahnschrift"          # condensed, for headings

# Set IC_BRAND_FONTS=1 to render with the paperdeck faces instead. Correct, and
# very slow. Only worth it for a still or a one-off hero frame.
BRAND_FONTS = os.environ.get("IC_BRAND_FONTS") == "1"
if BRAND_FONTS:
    MONO, BODY, DISPLAY = "JB Mono", "General Sans", "PP Display"

FONTS = Path(os.environ.get(
    "IC_FONTS", Path.home() / "manim-paperdeck" / "paperdeck" / "fonts"))


def register_fonts():
    """
    Register the brand TTFs, but only when IC_BRAND_FONTS asked for them.

    Never exited: manim resolves fonts lazily while rendering, so a context that
    closes at the end of construct() unregisters them before any frame is drawn.
    """
    if not BRAND_FONTS or not FONTS.is_dir():
        return []
    import atexit
    from contextlib import ExitStack
    stack = ExitStack()
    atexit.register(stack.close)
    names = []
    for f in sorted(FONTS.glob("*.ttf")):
        stack.enter_context(register_font(str(f)))
        names.append(f.name)
    return names


# ----------------------------------------------------------------- geometry


def px(v: float) -> float:
    """CSS pixels to manim units."""
    return v / PXU


def P(x: float, y: float) -> np.ndarray:
    """A point in slide coordinates: (0, 0) is the top left of the frame."""
    return np.array([(x - DESIGN_W / 2) / PXU, (DESIGN_H / 2 - y) / PXU, 0.0])


def configure(output_file=None, scale=1.0, frame_rate=30, media_dir=None):
    """
    Apply the format to manim's global config.

    EVERY scene module has to call this, not just the ones that look like they
    need a custom size. Skip it and manim keeps its own defaults: a black
    background and a 14.22-unit frame. Nothing errors, the render simply comes
    out on black with every P() coordinate mapped against the wrong frame
    width, which reads as a layout bug rather than a missing call.

    output_file is optional. Left as None, manim names the file after the
    scene, which is what a multi-scene module wants.

    media_dir defaults away from any synced folder. OneDrive locks manim's SVG
    text cache mid-write, and manim then reads back a zero-byte file and dies
    on "no element found: line 1, column 0".
    """
    import tempfile

    config.pixel_width = int(DESIGN_W * scale)
    config.pixel_height = int(DESIGN_H * scale)
    config.frame_width = FRAME_W
    config.frame_height = FRAME_H
    config.frame_rate = frame_rate
    config.background_color = CANVAS
    config.media_dir = str(media_dir or os.environ.get(
        "IC_MEDIA_DIR", Path(tempfile.gettempdir()) / "inspect-comment-anim"))
    if output_file is not None:
        config.output_file = output_file
    _prune_text_cache(Path(config.media_dir) / "texts")


def _prune_text_cache(texts_dir: Path):
    """
    Delete zero-byte entries from manim's text cache.

    WHY: manim hashes each string to an SVG on disk and never re-checks a file
    it finds. Interrupt a render mid-write, which is easy to do because these
    take minutes, and the cache keeps a truncated file forever. Every later
    render of that exact string then dies on

        ParseError: no element found: line 1, column 0

    which names neither the file nor the string, so it reads as a code bug. One
    stat per cached file is cheap next to losing an afternoon to it.
    """
    if not texts_dir.is_dir():
        return
    for svg in texts_dir.glob("*.svg"):
        try:
            if svg.stat().st_size == 0:
                svg.unlink()
        except OSError:
            pass
