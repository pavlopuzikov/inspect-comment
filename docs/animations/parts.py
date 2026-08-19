"""
Reusable pieces: the mock page under review, and the tool's own chrome drawn
on top of it.

The mock page is deliberately a real-looking layout rather than grey boxes.
The whole point of the tool is that it names a specific element, so the frames
have to contain elements worth naming.
"""

from manim import (
    VGroup, Rectangle, RoundedRectangle, Circle, Line, Polygon, Text, MarkupText,
    LEFT, RIGHT, UP, DOWN, ORIGIN,
)

from theme import (
    P, px, MONO, BODY, DISPLAY,
    CANVAS, INK, INK_DIM, INK_MUTE, LINE,
    PANEL, PANEL_TEXT, PANEL_DIM, PANEL_LINE, ACCENT, SELECT, WARN,
    HAIR, BOX, OUTLINE,
)


def place(m, x, y):
    """Move a mobject so its top-left sits at slide coordinate (x, y)."""
    m.move_to(P(x, y) + (m.width / 2) * RIGHT + (m.height / 2) * DOWN)
    return m


# WHY every string is rendered at 8x and scaled back down.
#
# Manim lays text out through Pango and quantises glyph positions, and at the
# sizes used here (9px to 22px) that rounding is a large fraction of a word
# space. Spaces collapse: "server components" renders as "sever components",
# "the studio" as "thestudio". It is not a missing glyph and not a bad family.
# Measured across Georgia, Verdana, Cambria, Constantia, Segoe UI and Tahoma at
# 11px, 13px and 15px, every one of them breaks somewhere, and which size
# breaks moves per family, so picking a "good" font does not fix it. Verdana is
# the cleanest at 11px and the worst at 15px.
#
# Rendering at size*OVERSAMPLE gives Pango enough resolution to place glyphs
# correctly, and scaling the vector result back down is exact. At 8x every
# family tested renders with even word spacing at every size.
#
# This costs nothing: the SVG has the same number of paths either way, and the
# text cache keys on the string and the size, so 8x caches like any other.
OVERSAMPLE = 8


def t(s, size=14, color=INK, font=MONO, weight="NORMAL", **kw):
    """
    Text sized in CSS pixels. At this frame geometry manim's font_size and a CSS
    pixel happen to coincide, which is only true because PXU is 80; see theme.
    """
    m = Text(s, font=font, font_size=size * OVERSAMPLE, color=color,
             weight=weight, **kw)
    m.scale(1 / OVERSAMPLE)
    return m


def box(w, h, fill=None, stroke=None, sw=HAIR, r=None):
    kw = dict(
        width=px(w), height=px(h),
        fill_color=fill or CANVAS, fill_opacity=1 if fill else 0,
        stroke_color=stroke or LINE, stroke_width=sw if stroke else 0,
    )
    return RoundedRectangle(corner_radius=px(r), **kw) if r else Rectangle(**kw)


# ------------------------------------------------------------------ the page


class MockPage:
    """
    A landing page worth reviewing, plus named handles on the elements the
    animation selects. Coordinates are CSS pixels in a 1280x720 frame.
    """

    def __init__(self):
        g = VGroup()

        # browser chrome, so it reads as a page and not a slide
        chrome = box(1280, 44, fill="#ece9e2")
        place(chrome, 0, 0)
        dots = VGroup(*[
            Circle(radius=px(5), fill_color=c, fill_opacity=1, stroke_width=0)
            for c in ("#d4b1a4", "#ded5c2", "#c9cfc4")
        ]).arrange(RIGHT, buff=px(8))
        place(dots, 18, 17)
        url = box(360, 22, fill=CANVAS, r=11)
        place(url, 200, 11)
        url_t = t("atelier.studio/chapters/golden-era", 11, INK_MUTE)
        place(url_t, 216, 17)
        g.add(chrome, dots, url, url_t)

        # nav
        logo = t("ATELIER", 15, INK, weight="BOLD")
        place(logo, 90, 80)
        nav = VGroup(*[t(s, 12, INK_MUTE) for s in ("Work", "Chapters", "About")])
        nav.arrange(RIGHT, buff=px(26))
        place(nav, 1010, 82)
        rule = Line(P(90, 120), P(1190, 120), stroke_width=HAIR, color=LINE)
        g.add(logo, nav, rule)

        # hero: the section the first note belongs to
        self.hero_bounds = (74, 150, 1132, 240)   # x, y, w, h
        h1 = t("Golden Era", 46, INK, DISPLAY, weight="BOLD")
        place(h1, 90, 168)
        lede = VGroup(
            t("A reading of the decade that taught the studio to slow down,", 13, INK_DIM, font=BODY),
            t("told through nine objects and the people who kept them.", 13, INK_DIM, font=BODY),
        ).arrange(DOWN, buff=px(7), aligned_edge=LEFT)
        place(lede, 92, 232)

        # the CTA: note 1 lands here
        self.cta_bounds = (90, 312, 196, 44)
        cta = box(196, 44, fill=SELECT, r=22)
        place(cta, 90, 312)
        cta_t = t("READ THE CHAPTER", 11, "#f6f5f1")
        place(cta_t, 112, 328)
        self.cta = VGroup(cta, cta_t)
        g.add(h1, lede, self.cta)

        # cards: note 2 lands on the second one
        self.cards_bounds = (74, 380, 1132, 190)
        cards = VGroup()
        titles = ("01 / The Long Table", "02 / Nine Objects", "03 / What Remains")
        bodies = ("Where the studio ate", "The working index", "A closing inventory")
        self.card_bounds = []
        for i, (ti, bo) in enumerate(zip(titles, bodies)):
            x = 90 + i * 358
            c = box(340, 150, fill="#ffffff", stroke=LINE, r=10)
            place(c, x, 400)
            ct = t(ti, 14, INK, BODY, weight="SEMIBOLD")
            place(ct, x + 24, 428)
            cb = t(bo, 12, INK_MUTE, font=BODY)
            place(cb, x + 24, 456)
            cards.add(VGroup(c, ct, cb))
            self.card_bounds.append((x, 400, 340, 150))
        self.cards = cards
        g.add(cards)

        # footer
        frule = Line(P(90, 620), P(1190, 620), stroke_width=HAIR, color=LINE)
        foot = t("Atelier, since 1998", 11, INK_MUTE)
        place(foot, 90, 640)
        g.add(frule, foot)

        self.group = g


# ------------------------------------------------------------- tool chrome


def outline(bounds, color, label=None, dashed=False):
    """The tool's highlight: a coloured box with a tag above its top-left."""
    x, y, w, h = bounds
    r = Rectangle(
        width=px(w), height=px(h),
        stroke_color=color, stroke_width=OUTLINE,
        fill_color=color, fill_opacity=0.10,
    )
    place(r, x, y)
    g = VGroup(r)
    if label:
        pad_w, pad_h = 8, 16
        tag_t = t(label, 11, "#f6f5f1")
        bg = RoundedRectangle(
            width=tag_t.width + px(pad_w * 2), height=px(pad_h + 8),
            corner_radius=px(3), fill_color=PANEL, fill_opacity=1, stroke_width=0,
        )
        tag = VGroup(bg, tag_t)
        tag_t.move_to(bg.get_center())
        place(tag, x, y - (pad_h + 10))
        g.add(tag)
    return g


def section_outline(bounds, label):
    """The dashed enclosing-section box, so it is clear which region a note is in."""
    x, y, w, h = bounds
    r = Rectangle(
        width=px(w), height=px(h),
        stroke_color=ACCENT, stroke_width=HAIR,
        fill_color=ACCENT, fill_opacity=0.04,
    )
    place(r, x, y)
    lt = t(label, 10, "#f6f5f1")
    bg = RoundedRectangle(
        width=lt.width + px(14), height=px(18), corner_radius=px(2),
        fill_color=ACCENT, fill_opacity=1, stroke_width=0,
    )
    lt.move_to(bg.get_center())
    tag = VGroup(bg, lt)
    place(tag, x + w - (lt.width * 80 + 14), y)
    return VGroup(r, tag)


def badge(n, bounds):
    """The numbered marker left on every queued element."""
    x, y, w, h = bounds
    r = Rectangle(
        width=px(w), height=px(h),
        stroke_color=SELECT, stroke_width=HAIR,
        fill_color=SELECT, fill_opacity=0.05,
    )
    place(r, x, y)
    nt = t(str(n), 11, "#f6f5f1")
    bg = RoundedRectangle(
        width=px(18), height=px(18), corner_radius=px(2),
        fill_color=SELECT, fill_opacity=1, stroke_width=0,
    )
    nt.move_to(bg.get_center())
    chip = VGroup(bg, nt)
    place(chip, x, y)
    return VGroup(r, chip)


# Pango units per manim unit of extra advance, measured once rather than
# derived. The documented unit is "1024ths of a point", but what a point is
# worth here depends on manim's DPI handling and on OVERSAMPLE, and assuming
# 1024 directly overshoots by about 3.8x. Measuring costs one Text render at
# import and cannot drift when manim changes how it sizes Pango.
_PANGO_K = None


def _pango_k():
    global _PANGO_K
    if _PANGO_K is None:
        sample, size, probe = "MMMMMMMMMM", 11, 8192
        def w(sp):
            m = MarkupText(f'<span letter_spacing="{sp}">{sample}</span>',
                           font=MONO, font_size=size * OVERSAMPLE)
            return m.scale(1 / OVERSAMPLE).width
        per_char_per_unit = (w(probe) - w(0)) / probe / len(sample)
        _PANGO_K = 1.0 / per_char_per_unit
    return _PANGO_K


def tracked(s, size, color, em=0.08, font=MONO):
    """
    Text with CSS letter-spacing. manim's Text has no such argument, so this
    goes through MarkupText and a Pango letter_spacing span.

    Pango's spacing is an absolute advance, not a multiple of the font size, so
    it has to be scaled by OVERSAMPLE alongside the glyphs; otherwise the
    tracking is divided away when the result is scaled back down.
    """
    spacing = int(em * px(size) * _pango_k())
    m = MarkupText(
        f'<span letter_spacing="{spacing}">{s}</span>',
        font=font, font_size=size * OVERSAMPLE, color=color,
    )
    m.scale(1 / OVERSAMPLE)
    return m


def shadow(shape, spread=6, offset=6, opacity=0.25, steps=5):
    """
    A soft drop shadow under a rounded rect.

    manim has no blur, so this fakes one the way a designer would: concentric
    copies, each a little larger and a little fainter, offset downward. Five
    steps is enough that the falloff reads as a blur rather than as rings.
    """
    g = VGroup()
    for i in range(steps, 0, -1):
        f = i / steps
        ring = shape.copy()
        ring.set_stroke(width=0)
        ring.set_fill(color="#000000", opacity=opacity / steps)
        ring.scale((shape.width + px(spread * 2) * f) / shape.width)
        ring.shift(DOWN * px(offset) * f)
        g.add(ring)
    return g


# The real chrome, from the CSS in src/inspect-comment.js:
#   button { font: 11px/1 inherit; letter-spacing: 0.08em; text-transform:
#            uppercase; border-radius: 999px; padding: 9px 12px;
#            background: #161512; box-shadow: 0 6px 20px rgba(0,0,0,0.25) }
#   .toggle[data-active] { background: var(--accent) }
#   .count { background: var(--select); padding: 9px 10px }
#   .dock { gap: 6px }
# 11px text on a line-height of 1, with 9px of padding above and below, is a
# 29px pill. radius 999px on a 29px box is simply half the height.
DOCK_H = 29
DOCK_R = DOCK_H / 2


def pill(label, fill, pad_x):
    lt = tracked(label, 11, "#f6f5f1")
    bg = RoundedRectangle(
        width=lt.width + px(pad_x * 2), height=px(DOCK_H), corner_radius=px(DOCK_R),
        fill_color=fill, fill_opacity=1, stroke_width=0,
    )
    lt.move_to(bg.get_center())
    return VGroup(shadow(bg), bg, lt)


def dock(active=False, count=None):
    """The toggle pill, and the queue-count chip once anything is queued."""
    # The product uses a middot, not a slash.
    label = "CLICK AN ELEMENT · ESC" if active else "INSPECT + COMMENT"
    parts = VGroup(pill(label, ACCENT if active else PANEL, 12))
    if count:
        parts.add(pill(str(count), SELECT, 10))
        parts.arrange(RIGHT, buff=px(6))

    parts.move_to(P(1280 - 16, 720 - 16) + LEFT * parts.width / 2 + UP * parts.height / 2)
    return parts


def cursor():
    """A pointer, drawn rather than imported so it inherits the palette."""
    pts = [
        [0, 0, 0], [0, -0.26, 0], [0.068, -0.196, 0],
        [0.116, -0.30, 0], [0.157, -0.282, 0], [0.11, -0.18, 0], [0.196, -0.175, 0],
    ]
    c = Polygon(*pts, fill_color=INK, fill_opacity=1,
                stroke_color=CANVAS, stroke_width=1.4)
    c.scale(1.15)
    return c


def panel(lines, comment=None, changes=None, width=340):
    """
    The tool's comment panel: descriptor above, comment box below.

    `lines` are (label, value, colour) triples. The colour carries the one piece
    of judgement in the whole capture, which is whether contrast passes.
    """
    pad = 14
    body = VGroup()

    eyebrow = tracked("SELECTED ELEMENT", 10, PANEL_DIM, em=0.14)
    body.add(eyebrow)

    desc = VGroup()
    for label, value, col in lines:
        row = VGroup(
            t(f"{label}", 11, PANEL_DIM),
            t(value, 11, col or PANEL_TEXT),
        ).arrange(RIGHT, buff=px(10))
        desc.add(row)
    desc.arrange(DOWN, buff=px(5), aligned_edge=LEFT)
    body.add(desc)

    if changes:
        ch = VGroup(tracked("SUGGESTED CSS", 10, PANEL_DIM, em=0.14))
        for prop, frm, to in changes:
            ch.add(VGroup(
                t(f"{prop}", 11, PANEL_DIM),
                t(frm, 11, PANEL_TEXT),
                t("->", 11, PANEL_DIM),
                t(to, 11, WARN),
            ).arrange(RIGHT, buff=px(8)))
        ch.arrange(DOWN, buff=px(5), aligned_edge=LEFT)
        body.add(ch)

    if comment is not None:
        field = RoundedRectangle(
            width=px(width - pad * 2), height=px(52), corner_radius=px(8),
            fill_color="#0f0e0d", fill_opacity=1,
            stroke_color=PANEL_LINE, stroke_width=HAIR,
        )
        # The field is a fixed width, so the comment has to be measured against
        # it rather than estimated from a per-character guess, which was wrong by
        # enough to run the text past the panel edge.
        ct = t(comment, 11, PANEL_TEXT)
        room = field.width - px(20)
        if ct.width > room:
            ct.scale(room / ct.width)
        ct.move_to(field.get_corner(UP + LEFT) + RIGHT * (ct.width / 2 + px(10)) + DOWN * px(16))
        body.add(VGroup(field, ct))

    body.arrange(DOWN, buff=px(10), aligned_edge=LEFT)

    bg = RoundedRectangle(
        width=px(width), height=body.height + px(pad * 2), corner_radius=px(12),
        fill_color=PANEL, fill_opacity=1, stroke_width=0,
    )
    body.move_to(bg.get_center())
    # left-align the stack inside the panel
    body.shift(RIGHT * (px(pad) + body.width / 2 - bg.width / 2 + px(pad) / 2))
    return VGroup(shadow(bg, spread=14, offset=12, opacity=0.4), bg, body)
