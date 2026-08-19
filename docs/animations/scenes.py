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
    ACCENT, SELECT, WARN, GOOD, HAIR, OUTLINE,
)
from parts import (
    MockPage, outline, section_outline, badge, dock, cursor, panel, place, t, box,
)

theme.configure()          # must run before any Scene; see theme.configure
theme.register_fonts()


# --------------------------------------------------------------- shared bits


def caption(s, y=676, color=INK_MUTE, size=13):
    """A line of narration along the bottom, outside the mock page's content."""
    c = t(s, size, color, MONO)
    c.move_to(P(1280 / 2, y))
    return c


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
        move_cursor(self, c, 200, 300)
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

        note1 = t("these behave as links but read as buttons", 11, PANEL_TEXT, MONO)
        note1.move_to(p1[0].get_corner(DOWN + LEFT) + RIGHT * (note1.width / 2 + px(24)) + UP * px(34))
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

        note2 = t("cards need more air between them", 11, PANEL_TEXT, MONO)
        note2.move_to(p2[0].get_corner(DOWN + LEFT) + RIGHT * (note2.width / 2 + px(24)) + UP * px(34))
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
        self.play(
            FadeOut(c), FadeOut(d_2),
            FadeIn(md, shift=UP * px(24)),
            run_time=0.7,
        )
        # No fade-out. This loops as a GIF, so the last frame is what a reader
        # lands on every time it restarts, and it should be the finished review.
        self.wait(3.4)


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
    card = VGroup(bg, stack)
    card.move_to(P(640, 360))
    return card


# ------------------------------------------------------------------ scene 2


class OneClick(Scene):
    """What a single click actually captures, field by field."""

    def construct(self):
        title = t("One click captures all of this", 22, INK, DISPLAY, weight="BOLD")
        title.move_to(P(640, 70))
        self.play(FadeIn(title, shift=DOWN * px(8)), run_time=0.6)

        # the element under review, drawn large and alone
        el_bg = box(260, 60, fill=SELECT, r=30)
        el_t = t("READ THE CHAPTER", 12, "#f6f5f1")
        el = VGroup(el_bg, el_t)
        el_t.move_to(el_bg.get_center())
        el.move_to(P(300, 380))
        ring = Rectangle(
            width=px(268), height=px(68),
            stroke_color=SELECT, stroke_width=OUTLINE, fill_opacity=0,
        ).move_to(el.get_center())
        self.play(FadeIn(el), Create(ring), run_time=0.6)

        fields = [
            ("Component", "ChaptersIndex > CtaButton", INK, "the tree above it, server components included"),
            ("Source", "CtaButton.tsx:41", INK, "file and line, where the toolchain exposes it"),
            ("Selector", "#golden-era > a", INK, "the shortest path that resolves to only this"),
            ("Box", "196x44  padding 16px 24px  radius 999px", INK, "the numbers, not an adjective"),
            ("A11y", "role link  contrast 3.1:1 FAILS AA", WARN, "the one review question with a right answer"),
        ]

        rows = VGroup()
        for label, value, col, _ in fields:
            row = VGroup(
                t(label, 13, INK_MUTE, MONO),
                t(value, 13, col, MONO, weight="BOLD" if col is WARN else "NORMAL"),
            ).arrange(RIGHT, buff=px(14), aligned_edge=DOWN)
            rows.add(row)
        rows.arrange(DOWN, buff=px(52), aligned_edge=LEFT)
        # buff leaves room for each row's note, which hangs below it and is not
        # part of the group, so arrange() cannot account for it.
        place(rows, 620, 212)

        notes = [t(n, 11, INK_MUTE, BODY) for *_, n in fields]

        for i, (row, note) in enumerate(zip(rows, notes)):
            connector = Line(
                ring.get_right() + RIGHT * px(6),
                row.get_left() + LEFT * px(10),
                stroke_width=HAIR, color=LINE,
            )
            note.next_to(row, DOWN, buff=px(6), aligned_edge=LEFT)
            self.play(Create(connector), run_time=0.22)
            self.play(FadeIn(row, shift=RIGHT * px(8)), run_time=0.3)
            self.play(FadeIn(note), run_time=0.25)
            if i == len(fields) - 1:
                self.play(Indicate(row[1], color=WARN, scale_factor=1.06), run_time=0.8)
            self.wait(0.55)

        self.wait(1.6)
        self.play(*[FadeOut(m) for m in self.mobjects], run_time=0.6)


# ------------------------------------------------------------------ scene 3


class ServerComponents(Scene):
    """
    Why the component name is the hard part on an App Router page, and what
    reading _debugInfo gets you that walking the fiber alone does not.
    """

    def construct(self):
        title = t("Naming a React Server Component", 22, INK, DISPLAY, weight="BOLD")
        title.move_to(P(640, 66))
        sub = t("every comparable tool walks the client fiber, which on App Router finds nothing useful",
                12, INK_MUTE, BODY)
        sub.move_to(P(640, 104))
        self.play(FadeIn(title, shift=DOWN * px(8)), run_time=0.5)
        self.play(FadeIn(sub), run_time=0.4)

        div = Line(P(640, 150), P(640, 640), stroke_width=HAIR, color=LINE)
        left_h = t("walking fiber.return", 13, INK_MUTE, MONO, weight="BOLD")
        left_h.move_to(P(320, 178))
        right_h = t("+ reading fiber._debugInfo", 13, ACCENT, MONO, weight="BOLD")
        right_h.move_to(P(960, 178))
        self.play(Create(div), FadeIn(left_h), FadeIn(right_h), run_time=0.5)

        def node(label, col, dim=False):
            txt = t(label, 12, INK_MUTE if dim else INK, MONO)
            bg = RoundedRectangle(
                width=txt.width + px(28), height=px(34), corner_radius=px(6),
                fill_color=CANVAS, fill_opacity=1,
                stroke_color=col, stroke_width=HAIR if dim else 1.6,
            )
            txt.move_to(bg.get_center())
            return VGroup(bg, txt)

        left_nodes = VGroup(
            node("SegmentViewNode", LINE, dim=True),
            node("ClientSegmentRoot", LINE, dim=True),
            node("InnerLayoutRouter", LINE, dim=True),
            node("__next_root_layout__", LINE, dim=True),
        ).arrange(DOWN, buff=px(16))
        left_nodes.move_to(P(320, 330))

        for n in left_nodes:
            self.play(FadeIn(n, shift=UP * px(6)), run_time=0.22)

        verdict_l = t("no component name", 13, INK_MUTE, MONO, weight="BOLD")
        verdict_l.move_to(P(320, 500))
        cross = t("x", 15, "#b4483a", MONO, weight="BOLD")
        cross.next_to(verdict_l, LEFT, buff=px(8))
        self.play(FadeIn(verdict_l), FadeIn(cross), run_time=0.4)
        self.wait(0.8)

        right_nodes = VGroup(
            node("HomePage", ACCENT),
            node("ChaptersIndex", ACCENT),
            node("ChapterTeaserCard", SELECT),
        ).arrange(DOWN, buff=px(16))
        right_nodes.move_to(P(960, 320))

        for n in right_nodes:
            self.play(FadeIn(n, shift=UP * px(6)), run_time=0.3)

        arrow_note = t("server components never get a fiber of their own,", 11, INK_MUTE, BODY)
        arrow_note2 = t("their names are recorded on _debugInfo instead", 11, INK_MUTE, BODY)
        arrow_note.move_to(P(960, 452))
        arrow_note2.move_to(P(960, 472))
        self.play(FadeIn(arrow_note), FadeIn(arrow_note2), run_time=0.5)

        verdict_r = t("HomePage > ChaptersIndex > ChapterTeaserCard", 13, INK, MONO, weight="BOLD")
        verdict_r.move_to(P(960, 522))
        self.play(FadeIn(verdict_r), run_time=0.5)
        self.play(Indicate(verdict_r, color=SELECT, scale_factor=1.04), run_time=0.9)

        self.wait(2.2)
        self.play(*[FadeOut(m) for m in self.mobjects], run_time=0.6)
