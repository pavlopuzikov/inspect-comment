"""
The three README animations.

    manim render -qm scenes.py TheLoop
    manim render -qm scenes.py OneClick
    manim render -qm scenes.py ServerComponents

Each is written to read at GIF speed: few words on screen at once, one idea per
beat, and long enough holds that a reader can finish a line before it moves.
"""

from manim import (
    Scene, VGroup, Rectangle, RoundedRectangle, Line, Text,
    FadeIn, FadeOut, Create, Write, AddTextLetterByLetter, Indicate,
    LEFT, RIGHT, UP, DOWN, rate_functions,
)

import theme
from theme import (
    P, px, PXU, MONO, BODY, DISPLAY,
    CANVAS, INK, INK_DIM, INK_MUTE, LINE, PANEL, PANEL_TEXT, PANEL_DIM,
    SCRIM_TEXT, ACCENT, SELECT, WARN, GOOD, HAIR, OUTLINE,
)
from parts import (
    MockPage, outline, section_outline, badge, dock, cursor, panel, place, t, box,
    comment_text, scrim, tag, shadow,
)

theme.configure()          # must run before any Scene; see theme.configure
theme.register_fonts()


# --------------------------------------------------------------- shared bits


def caption(s, y=678, color=INK_DIM, size=12):
    """
    A line of narration along the bottom.

    On a chip, not bare on the page. Bare text at this size and weight sits in
    the same visual register as the mock page's own footer, so a reader has to
    work out which of the two is the animation talking. The chip settles it.
    """
    c = t(s, size, color, MONO)
    bg = RoundedRectangle(
        width=c.width + px(28), height=px(30), corner_radius=px(15),
        fill_color="#ffffff", fill_opacity=0.94,
        stroke_color=LINE, stroke_width=HAIR,
    )
    c.move_to(bg.get_center())
    g = VGroup(bg, c)
    g.move_to(P(1280 / 2, y))
    return g


def mark_cross(size=6, color="#b4483a"):
    o = P(0, 0)
    return VGroup(
        Line(o + LEFT * px(size) + DOWN * px(size), o + RIGHT * px(size) + UP * px(size),
             stroke_width=2.2, color=color),
        Line(o + LEFT * px(size) + UP * px(size), o + RIGHT * px(size) + DOWN * px(size),
             stroke_width=2.2, color=color),
    )


def mark_tick(color=GOOD):
    o = P(0, 0)
    return VGroup(
        Line(o + LEFT * px(7) + UP * px(1), o + LEFT * px(2) + DOWN * px(5),
             stroke_width=2.2, color=color),
        Line(o + LEFT * px(2) + DOWN * px(5), o + RIGHT * px(7) + UP * px(6),
             stroke_width=2.2, color=color),
    )


def move_cursor(scene, c, x, y, run_time=0.9):
    scene.play(c.animate.move_to(P(x, y)), run_time=run_time,
               rate_func=rate_functions.ease_in_out_sine)


def click_pulse(scene, c):
    """A quick squeeze on the pointer, so the click reads without a sound cue."""
    scene.play(c.animate.scale(0.72), run_time=0.10)
    scene.play(c.animate.scale(1 / 0.72), run_time=0.10)


# ------------------------------------------------------------------ scene 1


class TheLoop(Scene):
    """Hover, click, comment, queue, repeat, copy. The whole product in one pass."""

    def construct(self):
        page = MockPage()
        self.play(FadeIn(page.group, shift=UP * px(10)), run_time=0.8)

        d = dock(active=False)
        self.play(FadeIn(d), run_time=0.4)

        cap = caption("Alt + C arms the inspector")
        self.play(FadeIn(cap), run_time=0.4)

        d_on = dock(active=True)
        self.play(FadeOut(d), FadeIn(d_on), run_time=0.3)

        c = cursor()
        c.move_to(P(640, 620))
        self.play(FadeIn(c), run_time=0.3)

        # ---- note 1: the CTA -------------------------------------------------
        move_cursor(self, c, 249, 340)
        sec = section_outline(page.hero_bounds, "#golden-era")
        hover = outline(page.cta_bounds, ACCENT, "<a>.cta")
        self.play(FadeIn(sec), FadeIn(hover), run_time=0.4)
        self.play(FadeOut(cap), run_time=0.3)

        cap = caption("click to select, the section it sits in is outlined too")
        self.play(FadeIn(cap), run_time=0.4)
        click_pulse(self, c)

        picked = outline(page.cta_bounds, SELECT, "<a>.cta")
        self.play(FadeOut(hover), FadeIn(picked), run_time=0.25)

        p1 = panel([
            ("Component", "ChaptersIndex > CtaButton", None),
            ("Selector", "#golden-era > a", None),
            ("Box", "196x44 pad 16 24", None),
            ("A11y", "3.1:1 FAILS AA", WARN),
        ], comment="")
        place(p1, 1280 - 16 - 340, 720 - 16 - 34 - 10 - p1.height * PXU)
        self.play(FadeIn(p1, shift=UP * px(12)), run_time=0.5)
        self.wait(0.7)

        self.play(FadeOut(cap), run_time=0.25)
        cap = caption("everything above was captured, you only type the comment")
        self.play(FadeIn(cap), run_time=0.4)

        note1 = comment_text(p1, "these behave as links but read as buttons")
        self.play(AddTextLetterByLetter(note1, run_time=1.7))
        self.wait(0.5)

        b1 = badge(1, page.cta_bounds)
        d_1 = dock(active=True, count=1)
        self.play(
            FadeOut(p1), FadeOut(note1), FadeOut(picked), FadeOut(sec),
            FadeIn(b1), FadeOut(d_on), FadeIn(d_1),
            run_time=0.5,
        )
        self.play(FadeOut(cap), run_time=0.25)

        cap = caption("queued, and straight back into inspect mode")
        self.play(FadeIn(cap), run_time=0.4)
        self.wait(0.4)

        # ---- note 2: a card --------------------------------------------------
        move_cursor(self, c, 560, 470)
        hover2 = outline(page.card_bounds[1], ACCENT, "<div>.card")
        sec2 = section_outline(page.cards_bounds, "ChaptersIndex")
        self.play(FadeIn(sec2), FadeIn(hover2), run_time=0.35)
        click_pulse(self, c)
        picked2 = outline(page.card_bounds[1], SELECT, "<div>.card")
        self.play(FadeOut(hover2), FadeIn(picked2), run_time=0.25)

        p2 = panel([
            ("Component", "ChaptersIndex > TeaserCard", None),
            ("Selector", "div:nth-of-type(2)", None),
            ("Box", "340x150 pad 20 24", None),
        ], comment="")
        place(p2, 1280 - 16 - 340, 720 - 16 - 34 - 10 - p2.height * PXU)
        self.play(FadeIn(p2, shift=UP * px(12)), run_time=0.4)

        note2 = comment_text(p2, "cards need more air between them")
        self.play(AddTextLetterByLetter(note2, run_time=1.3))
        self.wait(0.4)

        b2 = badge(2, page.card_bounds[1])
        d_2 = dock(active=True, count=2)
        self.play(
            FadeOut(p2), FadeOut(note2), FadeOut(picked2), FadeOut(sec2),
            FadeIn(b2), FadeOut(d_1), FadeIn(d_2),
            run_time=0.45,
        )
        self.play(FadeOut(cap), run_time=0.25)

        # ---- the payoff ------------------------------------------------------
        cap = caption("copy all, and the whole review comes out as one block")
        self.play(FadeIn(cap), run_time=0.4)
        move_cursor(self, c, 1215, 690, run_time=0.6)
        click_pulse(self, c)

        md = markdown_card()
        veil = scrim(0.62)
        self.play(
            FadeOut(c), FadeOut(d_2), FadeOut(cap),
            FadeIn(veil),
            run_time=0.45,
        )
        self.play(FadeIn(md, shift=UP * px(16)), run_time=0.5)
        # Fixed y, not relative to the card. Hung off the card's bottom edge it
        # lands in the middle of the card row, where the scrim is at its
        # lightest and the line is least readable.
        clip = t("copied to clipboard", 12, SCRIM_TEXT, MONO)
        clip.move_to(P(640, 630))
        self.play(FadeIn(clip), run_time=0.35)
        # No fade-out. This loops as a GIF, so the last frame is what a reader
        # lands on every time it restarts, and it should be the finished review.
        self.wait(3.6)


def markdown_card():
    """The copied review, as it lands on the clipboard."""
    lines = [
        ("# Review: /chapters/golden-era", PANEL_TEXT, "BOLD"),
        ("Viewport 1280x720 @2x  2 items", PANEL_DIM, "NORMAL"),
        ("", PANEL_DIM, "NORMAL"),
        ("## 1. ChaptersIndex > CtaButton", PANEL_TEXT, "BOLD"),
        ("- Selector: #golden-era > a", PANEL_DIM, "NORMAL"),
        ("- Box: 196x44  padding 16px 24px  radius 999px", PANEL_DIM, "NORMAL"),
        ("- A11y: role link  contrast 3.1:1 FAILS AA (needs 4.5)", WARN, "NORMAL"),
        ("**Comment:** these behave as links but read as buttons", PANEL_TEXT, "NORMAL"),
        ("", PANEL_DIM, "NORMAL"),
        ("## 2. ChaptersIndex > TeaserCard", PANEL_TEXT, "BOLD"),
        ("- Selector: div:nth-of-type(2)", PANEL_DIM, "NORMAL"),
        ("- Box: 340x150  padding 20px 24px", PANEL_DIM, "NORMAL"),
        ("**Comment:** cards need more air between them", PANEL_TEXT, "NORMAL"),
    ]
    # WHY the lines are placed by hand instead of stack.arrange(DOWN):
    #
    # A blank line has to become Text(" "), and manim renders that to an SVG with
    # no paths, so the mobject has no points and no bounding box. arrange() walks
    # the list with next_to() against the previous item, so the first blank
    # collapses the chain and every line after it lands back near the origin,
    # stacked on top of the ones above. It does not raise, it just overlaps.
    #
    # Fixed leading is what a monospace listing wants anyway. arrange() spaces by
    # bounding box, so a line with no descender sits tighter than one with
    # parentheses in it, and a code block drawn that way visibly breathes.
    LEAD = 20          # px between baselines
    BLANK = 10         # px a blank line is worth

    stack = VGroup()
    y = 0.0
    for s, col, wt in lines:
        if not s:
            y += BLANK
            continue
        line = t(s, 12, col, MONO, weight=wt)
        line.move_to(P(0, y), aligned_edge=LEFT + UP)
        stack.add(line)
        y += LEAD

    bg = RoundedRectangle(
        width=stack.width + px(56), height=stack.height + px(48),
        corner_radius=px(14), fill_color=PANEL, fill_opacity=0.985, stroke_width=0,
    )
    stack.move_to(bg.get_center())
    card = VGroup(shadow(bg, spread=18, offset=14, opacity=0.45), bg, stack)
    card.move_to(P(640, 352))
    return card


# ------------------------------------------------------------------ scene 2


class OneClick(Scene):
    """What a single click actually captures, field by field."""

    def construct(self):
        title = t("One click captures all of this", 22, INK, DISPLAY, weight="BOLD")
        title.move_to(P(640, 62))
        sub = t("no typing, no screenshot, no \u201cthe button on the left\u201d", 12, INK_MUTE, BODY)
        sub.move_to(P(640, 96))
        self.play(FadeIn(title, shift=DOWN * px(8)), run_time=0.5)
        self.play(FadeIn(sub), run_time=0.35)

        # The element under review, drawn large and alone, sitting on the
        # vertical centre of the rows it explains rather than near the top.
        # Shifted right of where the columns naturally fall. The value column
        # is the widest thing on screen and it runs rightward, so laying the
        # element out at the left margin leaves the whole block sitting in the
        # left two thirds with a dead strip down the right.
        SPINE_X, ROW_X, VALUE_X = 534, 594, 698
        ROW_Y, ROW_STEP = 178, 96
        rows_mid = ROW_Y + ROW_STEP * 2

        el_bg = box(240, 56, fill=SELECT, r=28)
        el_t = t("READ THE CHAPTER", 12, "#f6f5f1")
        el = VGroup(el_bg, el_t)
        el_t.move_to(el_bg.get_center())
        el.move_to(P(358, rows_mid))
        ring = Rectangle(
            width=px(248), height=px(64),
            stroke_color=SELECT, stroke_width=OUTLINE, fill_opacity=0,
        ).move_to(el.get_center())
        el_tag = tag("<a>.cta", PANEL)
        el_tag.next_to(ring, UP, buff=px(6)).align_to(ring, LEFT)
        self.play(FadeIn(el), Create(ring), FadeIn(el_tag), run_time=0.6)

        # Values are segments, not one string, because only part of the a11y
        # line is a finding. Amber on "role link" says the role is wrong, which
        # it is not, and that is the one row a reader will read closely.
        fields = [
            ("Component", [("ChaptersIndex > CtaButton", INK)],
             "the tree above it, server components included"),
            ("Source", [("CtaButton.tsx:41", INK)],
             "file and line, where the toolchain exposes it"),
            ("Selector", [("#golden-era > a", INK)],
             "the shortest path that resolves to only this"),
            ("Box", [("196x44  padding 16px 24px  radius 999px", INK)],
             "the numbers, not an adjective"),
            ("A11y", [("role link", INK), ("contrast 3.1:1 FAILS AA", WARN)],
             "the one review question with a right answer"),
        ]

        # WHY the label column is placed and not arranged: arrange() packs each
        # row to its own label width, so five labels of five different lengths
        # give five different value positions. A field listing has to read as a
        # column or the eye has nothing to run down.
        spine = Line(P(SPINE_X, ROW_Y - 6), P(SPINE_X, ROW_Y + ROW_STEP * 4 + 6),
                     stroke_width=HAIR, color=LINE)
        stem = Line(ring.get_right(), P(SPINE_X, rows_mid), stroke_width=HAIR, color=LINE)
        self.play(Create(stem), Create(spine), run_time=0.45)

        last_value = None
        for i, (label, segs, note) in enumerate(fields):
            y = ROW_Y + i * ROW_STEP
            tick = Line(P(SPINE_X, y), P(ROW_X - 10, y), stroke_width=HAIR, color=LINE)

            lab = t(label, 13, INK_MUTE, MONO)
            place(lab, ROW_X, y - 9)
            value = VGroup(*[t(v, 13, col, MONO,
                              weight="BOLD" if col is WARN else "NORMAL")
                             for v, col in segs]).arrange(RIGHT, buff=px(14))
            place(value, VALUE_X, y - 9)
            hint = t(note, 11, INK_MUTE, BODY)
            place(hint, VALUE_X, y + 14)

            self.play(Create(tick), run_time=0.16)
            self.play(FadeIn(lab, shift=RIGHT * px(6)),
                      FadeIn(value, shift=RIGHT * px(6)), run_time=0.3)
            self.play(FadeIn(hint), run_time=0.22)
            self.wait(0.5)
            last_value = value

        self.play(Indicate(last_value[1], color=WARN, scale_factor=1.06), run_time=0.9)

        close = t("and it leaves as one line of markdown, not as a screenshot", 12, INK_DIM, BODY)
        close.move_to(P(640, 648))
        self.play(FadeIn(close), run_time=0.45)

        self.wait(1.5)
        self.play(*[FadeOut(m) for m in self.mobjects], run_time=0.6)


# ------------------------------------------------------------------ scene 3


class ServerComponents(Scene):
    """
    Why the component name is the hard part on an App Router page, and what
    reading _debugInfo gets you that walking the fiber alone does not.
    """

    def construct(self):
        title = t("Naming a React Server Component", 22, INK, DISPLAY, weight="BOLD")
        title.move_to(P(640, 60))
        sub = t("every comparable tool walks the client fiber, which on App Router finds nothing useful",
                12, INK_MUTE, BODY)
        sub.move_to(P(640, 96))
        rule = Line(P(90, 128), P(1190, 128), stroke_width=HAIR, color=LINE)
        self.play(FadeIn(title, shift=DOWN * px(8)), run_time=0.5)
        self.play(FadeIn(sub), Create(rule), run_time=0.4)

        L, R = 330, 950
        HEAD_Y, TOP_Y, STEP, VERDICT_Y = 170, 224, 58, 528

        # The divider stops where the content stops. Running it to the frame
        # edge draws a long line through empty paper and makes the lower third
        # look like something failed to render.
        div = Line(P(640, 152), P(640, VERDICT_Y + 40), stroke_width=HAIR, color=LINE)
        left_h = t("walking fiber.return", 13, INK_MUTE, MONO, weight="BOLD")
        left_h.move_to(P(L, HEAD_Y))
        right_h = t("+ reading fiber._debugInfo", 13, ACCENT, MONO, weight="BOLD")
        right_h.move_to(P(R, HEAD_Y))
        self.play(Create(div), FadeIn(left_h), FadeIn(right_h), run_time=0.5)

        def node(label, col, dim=False, w=None):
            txt = t(label, 12, INK_MUTE if dim else INK, MONO)
            bg = RoundedRectangle(
                width=px(w) if w else txt.width + px(28), height=px(34),
                corner_radius=px(6),
                fill_color=CANVAS, fill_opacity=1,
                stroke_color=col, stroke_width=HAIR if dim else 1.6,
            )
            txt.move_to(bg.get_center())
            return VGroup(bg, txt)

        # A fixed node width on each side, so the two stacks read as two lists
        # rather than as ragged debris, and a link between each pair, because
        # what is being shown is a walk up a chain and not a set of labels.
        def column(labels, x, width, top=TOP_Y):
            g, links = VGroup(), VGroup()
            for i, (lab, col, dim) in enumerate(labels):
                n = node(lab, col, dim=dim, w=width)
                n.move_to(P(x, top + i * STEP))
                g.add(n)
                if i:
                    links.add(Line(g[i - 1].get_bottom(), n.get_top(),
                                   stroke_width=HAIR, color=LINE))
            return g, links

        left_nodes, left_links = column([
            ("SegmentViewNode", LINE, True),
            ("ClientSegmentRoot", LINE, True),
            ("InnerLayoutRouter", LINE, True),
            ("__next_root_layout__", LINE, True),
        ], L, 230)

        for i, n in enumerate(left_nodes):
            anims = [FadeIn(n, shift=UP * px(6))]
            if i:
                anims.append(Create(left_links[i - 1]))
            self.play(*anims, run_time=0.24)

        verdict_l = t("no component name", 13, INK_MUTE, MONO, weight="BOLD")
        verdict_l.move_to(P(L + 14, VERDICT_Y))
        # Drawn marks, not the letters x and v. At this size a glyph reads as a
        # typo in the sentence rather than as a mark against it. Both are
        # anchored to their own verdict rather than to a column centre: the two
        # verdicts are very different lengths, so a fixed offset puts one of the
        # marks a long way from the words it belongs to.
        cross = mark_cross()
        cross.next_to(verdict_l, LEFT, buff=px(14))
        self.play(FadeIn(verdict_l), Create(cross), run_time=0.45)
        self.wait(0.8)

        right_nodes, right_links = column([
            ("HomePage", ACCENT, False),
            ("ChaptersIndex", ACCENT, False),
            ("ChapterTeaserCard", SELECT, False),
        ], R, 230)

        for i, n in enumerate(right_nodes):
            anims = [FadeIn(n, shift=UP * px(6))]
            if i:
                anims.append(Create(right_links[i - 1]))
            self.play(*anims, run_time=0.3)

        note = VGroup(
            t("server components never get a fiber of their own,", 11, INK_MUTE, BODY),
            t("their names are recorded on _debugInfo instead", 11, INK_MUTE, BODY),
        ).arrange(DOWN, buff=px(5))
        note.move_to(P(R, 428))
        self.play(FadeIn(note), run_time=0.5)

        verdict_r = t("HomePage > ChaptersIndex > ChapterTeaserCard", 12, INK, MONO, weight="BOLD")
        verdict_r.move_to(P(R + 14, VERDICT_Y))
        tick = mark_tick()
        tick.next_to(verdict_r, LEFT, buff=px(14))
        self.play(FadeIn(verdict_r), Create(tick), run_time=0.5)
        self.play(Indicate(verdict_r, color=SELECT, scale_factor=1.04), run_time=0.9)

        close = t("the component name is the whole point of a design note", 12, INK_DIM, BODY)
        close.move_to(P(640, 640))
        self.play(FadeIn(close), run_time=0.45)

        self.wait(2.0)
        self.play(*[FadeOut(m) for m in self.mobjects], run_time=0.6)
