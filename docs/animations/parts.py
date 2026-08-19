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
    P, px, PXU, DESIGN_W, DESIGN_H, MONO, BODY, DISPLAY,
    CANVAS, INK, INK_DIM, INK_MUTE, LINE,
    PANEL, PANEL_TEXT, PANEL_DIM, PANEL_LINE, ACCENT, SELECT, WARN, BRAND,
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

# WHY the oversample is not simply always 8.
#
# manim renders every Text onto a Pango page of a fixed size, and a string whose
# advance runs past that page WRAPS. Nothing raises and nothing warns: the
# mobject is silently two lines tall, which lands as a layout bug somewhere else
# entirely. The threshold is a property of the page, not of the render, so it
# does not move with resolution: "inspect-comment" survives font_size 264 and
# wraps at 336 at 768, 1280 and 1920 pixels wide alike.
#
# 8x is therefore safe for body copy and not safe for a headline. Rather than
# pick a cutoff and hope, t() renders, measures, and halves the factor until the
# result is one line. Anything over about 30px hits this, which is every title
# card in linkedin.py and the mock page's h1.
_LINE_H = {}


def _one_line(size, font, weight):
    """The height of a single line at this size, cached per style."""
    key = (round(size, 3), font, weight)
    if key not in _LINE_H:
        _LINE_H[key] = Text("Mgy", font=font, font_size=size, weight=weight).height
    return _LINE_H[key]


def _fit(build, size, font, weight="NORMAL"):
    """
    Build at OVERSAMPLE, halving until the result is a single line.

    Shared by t() and tracked(): the wrap is a property of manim's Pango page,
    not of which mobject class asked for the text, and tracked() is the more
    exposed of the two because letter-spacing widens a string without making it
    look any closer to the limit.
    """
    factor = OVERSAMPLE
    while True:
        m = build(factor)
        if factor == 1 or m.height <= _one_line(size * factor, font, weight) * 1.6:
            break
        factor //= 2
    m.scale(1 / factor)
    return m


def t(s, size=14, color=INK, font=MONO, weight="NORMAL", **kw):
    """
    Text sized in CSS pixels. At this frame geometry manim's font_size and a CSS
    pixel happen to coincide, which is only true because PXU is 80; see theme.
    """
    return _fit(
        lambda f: Text(s, font=font, font_size=size * f, color=color,
                       weight=weight, **kw),
        size, font, weight,
    )


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
        # BRAND, not SELECT. The panel reports this button as 3.1:1 FAILS AA,
        # so the fill has to actually measure that against the label, and it has
        # to differ from the colour the tool paints its own selection in.
        cta = box(196, 44, fill=BRAND, r=22)
        place(cta, 90, 312)
        cta_t = t("READ THE CHAPTER", 11, "#f6f5f1")
        place(cta_t, 112, 328)
        self.cta = VGroup(cta, cta_t)
        g.add(h1, lede, self.cta)

        # cards: note 2 lands on the second one
        # 44px of clearance above the cards, not 20. An element's tag is drawn
        # above its top-left, so a section box that hugs its contents puts a
        # border straight through every tag inside it.
        self.cards_bounds = (74, 356, 1132, 220)
        cards = VGroup()
        titles = ("01 / The Long Table", "02 / Nine Objects", "03 / What Remains")
        # The third body is short on purpose: the panel is a fixed bottom-right
        # overlay, as it is in the tool, and it lands across this card. Covering
        # a card is honest, slicing a word in half looks like a render bug.
        bodies = ("Where the studio ate", "The working index", "A closing list")
        metas = ("12 min", "9 objects", "Closing")
        self.card_bounds = []
        for i, (ti, bo, me) in enumerate(zip(titles, bodies, metas)):
            x = 90 + i * 358
            c = box(340, 150, fill="#ffffff", stroke=LINE, r=10)
            place(c, x, 400)
            ct = t(ti, 14, INK, BODY, weight="SEMIBOLD")
            place(ct, x + 24, 428)
            cb = t(bo, 12, INK_MUTE, font=BODY)
            place(cb, x + 24, 456)
            # A card with its content in the top third and nothing under it
            # reads as an unfinished layout rather than as a card, and the
            # animation then looks like it is reviewing a broken page.
            crule = Line(P(x + 24, 508), P(x + 316, 508), stroke_width=HAIR, color=LINE)
            cm = t(me, 10, INK_MUTE)
            place(cm, x + 24, 520)
            arrow = t("->", 10, INK_MUTE)
            place(arrow, x + 300, 520)
            cards.add(VGroup(c, ct, cb, crule, cm, arrow))
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


TAG_H = 20


def tag(label, fill, size=11, pad_x=8):
    """The small dark chip a label sits in. One definition, so every tag in
    every scene is the same height and the same corner."""
    lt = t(label, size, "#f6f5f1")
    bg = RoundedRectangle(
        width=lt.width + px(pad_x * 2), height=px(TAG_H),
        corner_radius=px(3), fill_color=fill, fill_opacity=1, stroke_width=0,
    )
    lt.move_to(bg.get_center())
    return VGroup(bg, lt)


def outline(bounds, color, label=None, dashed=False):
    """The tool's highlight: a coloured box with a tag above its top-left."""
    x, y, w, h = bounds
    r = Rectangle(
        width=px(w), height=px(h),
        stroke_color=color, stroke_width=OUTLINE,
        # 0.10 of a slate blue over white is just grey, and a grey wash reads as
        # a disabled state rather than as a highlight. The outline carries the
        # signal; the fill only has to separate the element from the page.
        fill_color=color, fill_opacity=0.07,
    )
    place(r, x, y)
    g = VGroup(r)
    if label:
        g.add(place(tag(label, PANEL), x, y - (TAG_H + 5)))
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
    lab = tag(label, ACCENT, size=10, pad_x=7)
    # Inset off both borders. Flush against the corner the chip and the border
    # share an edge, which reads as a rendering seam rather than as a label.
    place(lab, x + w - lab.width * PXU - 6, y + 6)
    return VGroup(r, lab)


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
        width=px(20), height=px(20), corner_radius=px(10),
        fill_color=SELECT, fill_opacity=1, stroke_width=0,
    )
    nt.move_to(bg.get_center())
    chip = VGroup(bg, nt)
    # Outside the top-left corner, not on it. Sitting on the corner the marker
    # covers the first characters of whatever it marks, which on the CTA is the
    # label the note is about.
    place(chip, x - 26, y)
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
    # _pango_k was measured at font_size = size * OVERSAMPLE, so the spacing it
    # yields is correct only at that factor. _fit may render at a smaller one,
    # and Pango's spacing is an absolute advance, so it has to move with the
    # factor or the tracking changes when a long string is stepped down.
    def build(f):
        spacing = int(em * px(size) * _pango_k() * f / OVERSAMPLE)
        return MarkupText(
            f'<span letter_spacing="{spacing}">{s}</span>',
            font=font, font_size=size * f, color=color,
        )

    return _fit(build, size, font)


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

    field = None
    if comment is not None:
        field = RoundedRectangle(
            width=px(width - pad * 2), height=px(52), corner_radius=px(8),
            fill_color="#0f0e0d", fill_opacity=1,
            stroke_color=PANEL_LINE, stroke_width=HAIR,
        )
        body.add(field)

    body.arrange(DOWN, buff=px(10), aligned_edge=LEFT)

    bg = RoundedRectangle(
        width=px(width), height=body.height + px(pad * 2), corner_radius=px(12),
        fill_color=PANEL, fill_opacity=1, stroke_width=0,
    )
    body.move_to(bg.get_center())
    # Left-align the stack against the padding box. The old expression added
    # pad*1.5, which left the content a few pixels off the optical left edge and
    # made the panel look like it had a wider right margin than left.
    body.align_to(bg, LEFT).shift(RIGHT * px(pad))
    g = VGroup(shadow(bg, spread=14, offset=12, opacity=0.4), bg, body)
    g.bg, g.field = bg, field
    if comment:
        g.add(comment_text(g, comment))
    return g


def comment_text(p, s, size=11):
    """
    A line of typed comment, laid inside a panel's comment field.

    WHY this is not two lines at the call site: the obvious anchor for it is
    p[0], and p[0] is the shadow, not the panel. The shadow is wider than the
    panel and sits lower, so text placed against it lands outside the field near
    the panel's bottom edge, which is exactly where it was landing.
    """
    m = t(s, size, PANEL_TEXT)
    room = p.field.width - px(20)
    if m.width > room:
        m.scale(room / m.width)
    m.move_to(p.field.get_corner(UP + LEFT)
              + RIGHT * (m.width / 2 + px(10)) + DOWN * px(16))
    return m


def scrim(opacity=0.62, color="#0f0e0d"):
    """A full-frame wash, for the beats where the page is context and the thing
    on top of it is the subject."""
    return Rectangle(
        width=px(DESIGN_W) + 0.2, height=px(DESIGN_H) + 0.2,
        fill_color=color, fill_opacity=opacity, stroke_width=0,
    )
