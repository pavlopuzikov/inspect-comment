"""
The LinkedIn cut: one 16:9 video that explains the tool end to end.

    manim render -qm linkedin.py LinkedIn        # 1920x1080, see SCALE below
    ./render.sh --linkedin                       # and the mp4 LinkedIn wants

Six beats, in the order a stranger needs them: what it is, why the usual design
note fails, the loop, what comes out, who it can be handed to, where to get it.

Every hold is set to how long the frame takes to READ, not to how long it takes
to notice. A monospace line runs about 12 characters a second, and the frames
here are dense: the copied review is thirteen lines of it and the descriptor
panel is five labelled rows. It is the mistake this cut made first time out, and
it is invisible while authoring, because by then you already know what every
frame says. When adding a beat, count its characters rather than trusting it to
feel right on the tenth viewing.

The scenes in scenes.py are README GIFs and are read on mute, at whatever size a
GitHub column happens to be. This is read in a feed, at full width, by someone
who has never heard of the tool, so it carries a title card, a stated problem
and an outro, and every type size is a step larger than the same idea in
scenes.py. It reuses the same MockPage, panel and dock, so the two never drift
into looking like different products.
"""

import os

from manim import (
    Scene, VGroup, Rectangle, RoundedRectangle, Line, Arrow,
    FadeIn, FadeOut, Create, AddTextLetterByLetter, Indicate,
    LEFT, RIGHT, UP, DOWN, rate_functions,
)

import scenes                       # imported for markdown_card, and it configures
import theme
from theme import (
    P, px, PXU, MONO, BODY, DISPLAY,
    CANVAS, INK, INK_DIM, INK_MUTE, LINE, PANEL, PANEL_TEXT, PANEL_DIM, PANEL_LINE,
    SCRIM_TEXT, ACCENT, SELECT, WARN, GOOD, HAIR, OUTLINE,
)
from parts import (
    MockPage, outline, section_outline, badge, dock, cursor, panel, place, t, box,
    comment_text, scrim, tag, tracked, shadow,
)

# 1280x720 design, rendered at 1920x1080. LinkedIn re-encodes whatever it is
# given, and it re-encodes 1080p far more kindly than it upscales 720p.
#
# This has to run AFTER `import scenes`, because scenes.py calls configure() at
# import to set itself up as a README GIF. Manim's own CLI quality flag does not
# help: it is applied before the scene module is imported, so the module wins
# and -qh silently renders at the module's size.
#
# IC_SCALE exists so a layout check does not cost a 1080p render. PXU is pinned
# to the design size, so a draft at 0.5 puts everything in exactly the same
# place, only smaller.
SCALE = float(os.environ.get("IC_SCALE", 1.5))
theme.configure(scale=SCALE)
theme.register_fonts()

GH = "github.com/pavlopuzikov/inspect-comment"


# ------------------------------------------------------------------ pieces ---


def chips(labels, size=11, y=None, x=640):
    """A row of outlined pills. The facts that fit in three words each."""
    row = VGroup()
    for label in labels:
        lt = tracked(label, size, INK_DIM, em=0.10)
        bg = RoundedRectangle(
            width=lt.width + px(26), height=px(28), corner_radius=px(14),
            fill_color=CANVAS, fill_opacity=1,
            stroke_color=LINE, stroke_width=HAIR,
        )
        lt.move_to(bg.get_center())
        row.add(VGroup(bg, lt))
    row.arrange(RIGHT, buff=px(10))
    if y is not None:
        row.move_to(P(x, y))
    return row


def listing(lines, size=13, lead=24, pad_x=30, pad_y=26, fill=PANEL, radius=14,
            min_width=None):
    """
    A dark card holding monospace lines, laid out at a fixed leading.

    Fixed leading rather than arrange(): a blank line has to become Text(" "),
    which manim renders to an SVG with no paths and therefore no bounding box,
    and arrange() chains off bounding boxes, so the first blank collapses
    everything below it into a pile at the origin. See docs/animations/README.
    """
    stack = VGroup()
    y = 0.0
    for entry in lines:
        s, col, wt = (entry + ("NORMAL",))[:3] if len(entry) == 2 else entry
        if not s:
            y += lead * 0.5
            continue
        line = t(s, size, col, MONO, weight=wt)
        line.move_to(P(0, y), aligned_edge=LEFT + UP)
        stack.add(line)
        y += lead

    bg = RoundedRectangle(
        width=max(stack.width + px(pad_x * 2), px(min_width or 0)),
        height=stack.height + px(pad_y * 2),
        corner_radius=px(radius), fill_color=fill, fill_opacity=1, stroke_width=0,
    )
    stack.move_to(bg.get_center()).align_to(bg, LEFT).shift(RIGHT * px(pad_x))
    card = VGroup(shadow(bg, spread=18, offset=14, opacity=0.35), bg, stack)
    card.stack = stack
    return card


def kicker(s, y):
    m = tracked(s, 11, INK_MUTE, em=0.18)
    m.move_to(P(640, y))
    return m


def clear(scene, run_time=0.5):
    if scene.mobjects:
        scene.play(*[FadeOut(m) for m in scene.mobjects], run_time=run_time)


# ------------------------------------------------------------------- scene ---


class LinkedIn(Scene):

    def construct(self):
        self.beat_title()
        self.beat_problem()
        self.beat_loop()
        self.beat_output()
        self.beat_agent()
        self.beat_close()

    # -- 1. what it is ------------------------------------------------------

    def beat_title(self):
        word = t("inspect-comment", 42, INK, MONO, weight="BOLD")
        word.move_to(P(640, 274))
        rule = Line(P(566, 322), P(714, 322), stroke_width=HAIR, color=LINE)
        tag_line = t("Point at the element. Say what is wrong.", 17, INK_DIM, BODY)
        tag_line.move_to(P(640, 360))
        tag_two = t("Hand it to whoever fixes it, human or not.", 17, INK_DIM, BODY)
        tag_two.move_to(P(640, 388))
        row = chips(["ONE FILE", "ZERO DEPENDENCIES", "MIT"], y=456)

        self.play(FadeIn(word, shift=UP * px(10)), run_time=0.7)
        self.play(Create(rule), run_time=0.3)
        self.play(FadeIn(tag_line), run_time=0.4)
        self.play(FadeIn(tag_two), run_time=0.4)
        self.play(FadeIn(row, shift=UP * px(6)), run_time=0.5)
        self.wait(2.4)
        clear(self)

    # -- 2. why the usual note fails ----------------------------------------

    def beat_problem(self):
        k = kicker("THE DESIGN NOTE EVERYONE ACTUALLY SENDS", 168)
        self.play(FadeIn(k), run_time=0.4)

        quote = t("“can you make the button on the left a bit darker?”",
                  20, INK, BODY)
        bubble = RoundedRectangle(
            width=quote.width + px(64), height=px(86), corner_radius=px(18),
            fill_color="#ffffff", fill_opacity=1,
            stroke_color=LINE, stroke_width=HAIR,
        )
        quote.move_to(bubble.get_center())
        msg = VGroup(shadow(bubble, spread=10, offset=8, opacity=0.10), bubble, quote)
        msg.move_to(P(640, 272))
        self.play(FadeIn(msg, shift=UP * px(10)), run_time=0.6)
        self.wait(1.9)

        asks = ["which button?", "on which page?", "darker than what?", "by how much?"]
        row = VGroup()
        for a in asks:
            x = scenes.mark_cross(size=5)
            lab = t(a, 14, INK_MUTE, MONO)
            row.add(VGroup(x, lab).arrange(RIGHT, buff=px(10)))
        row.arrange(RIGHT, buff=px(38))
        row.move_to(P(640, 412))
        for item in row:
            self.play(FadeIn(item, shift=UP * px(5)), run_time=0.34)
        self.wait(1.5)

        verdict = t("Four questions, two people, and the contrast still fails.",
                    17, INK_DIM, BODY)
        verdict.move_to(P(640, 508))
        self.play(FadeIn(verdict), run_time=0.5)
        self.wait(2.4)
        clear(self)

    # -- 3. the loop --------------------------------------------------------

    def beat_loop(self):
        page = MockPage()
        self.play(FadeIn(page.group, shift=UP * px(8)), run_time=0.7)

        d_off = dock(active=False)
        self.play(FadeIn(d_off), run_time=0.35)
        cap = scenes.caption("Alt + C arms the inspector")
        self.play(FadeIn(cap), run_time=0.35)
        d_on = dock(active=True)
        self.play(FadeOut(d_off), FadeIn(d_on), run_time=0.3)

        c = cursor()
        c.move_to(P(640, 600))
        self.play(FadeIn(c), run_time=0.3)

        scenes.move_cursor(self, c, 249, 340)
        sec = section_outline(page.hero_bounds, "#golden-era")
        hover = outline(page.cta_bounds, ACCENT, "<a>.cta")
        self.play(FadeIn(sec), FadeIn(hover), run_time=0.4)

        self.play(FadeOut(cap), run_time=0.25)
        cap = scenes.caption("click it, and everything about it is already captured")
        self.play(FadeIn(cap), run_time=0.35)
        scenes.click_pulse(self, c)

        picked = outline(page.cta_bounds, SELECT, "<a>.cta")
        self.play(FadeOut(hover), FadeIn(picked), run_time=0.25)

        p = panel([
            ("Component", "ChaptersIndex > CtaButton", None),
            ("Source", "CtaButton.tsx:41", None),
            ("Selector", "#golden-era > a", None),
            ("Box", "196x44 pad 16 24", None),
            ("A11y", "3.1:1 FAILS AA", WARN),
        ], comment="")
        place(p, 1280 - 16 - 340, 720 - 16 - 34 - 10 - p.height * PXU)
        self.play(FadeIn(p, shift=UP * px(12)), run_time=0.5)
        # Five labelled rows, and the whole argument of the tool is that you did
        # not have to write any of them. That needs reading, not glancing at.
        self.wait(2.4)

        self.play(FadeOut(cap), run_time=0.25)
        cap = scenes.caption("the only thing you type is the opinion")
        self.play(FadeIn(cap), run_time=0.35)

        note = comment_text(p, "these behave as links but read as buttons")
        self.play(AddTextLetterByLetter(note, run_time=1.8))
        self.wait(1.3)

        b1 = badge(1, page.cta_bounds)
        d1 = dock(active=True, count=1)
        self.play(
            FadeOut(p), FadeOut(note), FadeOut(picked), FadeOut(sec),
            FadeIn(b1), FadeOut(d_on), FadeIn(d1),
            run_time=0.5,
        )
        self.play(FadeOut(cap), run_time=0.25)

        # The second note is deliberately fast. The point of showing it at all
        # is that the loop repeats without ceremony, not that a card is worth
        # reviewing, so it plays at the speed the reviewer would work at.
        cap = scenes.caption("queued, and straight back in. Walk the whole page.")
        self.play(FadeIn(cap), run_time=0.35)
        scenes.move_cursor(self, c, 560, 470, run_time=0.7)
        sec2 = section_outline(page.cards_bounds, "ChaptersIndex")
        hov2 = outline(page.card_bounds[1], ACCENT, "<div>.card")
        self.play(FadeIn(sec2), FadeIn(hov2), run_time=0.3)
        scenes.click_pulse(self, c)
        pick2 = outline(page.card_bounds[1], SELECT, "<div>.card")
        self.play(FadeOut(hov2), FadeIn(pick2), run_time=0.2)

        p2 = panel([
            ("Component", "ChaptersIndex > TeaserCard", None),
            ("Selector", "div:nth-of-type(2)", None),
            ("Box", "340x150 pad 20 24", None),
        ], comment="")
        place(p2, 1280 - 16 - 340, 720 - 16 - 34 - 10 - p2.height * PXU)
        self.play(FadeIn(p2, shift=UP * px(10)), run_time=0.35)
        note2 = comment_text(p2, "cards need more air between them")
        self.play(AddTextLetterByLetter(note2, run_time=1.2))
        self.wait(1.0)

        b2 = badge(2, page.card_bounds[1])
        d2 = dock(active=True, count=2)
        self.play(
            FadeOut(p2), FadeOut(note2), FadeOut(pick2), FadeOut(sec2),
            FadeIn(b2), FadeOut(d1), FadeIn(d2),
            run_time=0.45,
        )
        self.play(FadeOut(cap), run_time=0.25)

        cap = scenes.caption("one keystroke copies the whole review")
        self.play(FadeIn(cap), run_time=0.35)
        scenes.move_cursor(self, c, 1215, 690, run_time=0.55)
        scenes.click_pulse(self, c)
        self._loop_tail = (c, d2, cap)

    # -- 4. what comes out --------------------------------------------------

    def beat_output(self):
        c, d2, cap = self._loop_tail
        veil = scrim(0.66)
        self.play(FadeOut(c), FadeOut(d2), FadeOut(cap), FadeIn(veil), run_time=0.45)

        md = scenes.markdown_card()
        md.move_to(P(640, 326))
        self.play(FadeIn(md, shift=UP * px(14)), run_time=0.55)

        # Fixed y. Hung off the card it lands across the card row, which is the
        # brightest part of the scrimmed page and the worst ground for it.
        line = t("no screenshot, no “the button on the left”, no round trip",
                 14, SCRIM_TEXT, BODY)
        line.move_to(P(640, 628))
        self.play(FadeIn(line), run_time=0.4)
        # The longest hold in the cut, and it should be. This is the artifact the
        # whole thing exists to produce, it is thirteen lines of monospace, and a
        # viewer who cannot finish it has been shown the payoff and denied it.
        self.wait(7.0)
        clear(self, 0.6)

    # -- 5. who it can be handed to -----------------------------------------

    def beat_agent(self):
        title = t("Or hand it straight to the agent", 26, INK, DISPLAY, weight="BOLD")
        title.move_to(P(640, 92))
        sub = t("the bundled MCP server delivers the review, so nothing is pasted anywhere",
                15, INK_MUTE, BODY)
        sub.move_to(P(640, 130))
        self.play(FadeIn(title, shift=DOWN * px(8)), run_time=0.5)
        self.play(FadeIn(sub), run_time=0.4)

        browser = listing([
            ("you, in the browser", PANEL_DIM),
            ("", None),
            ("2 notes queued", PANEL_TEXT, "BOLD"),
            ("1 contrast failure", WARN),
            ("copy all", PANEL_DIM),
        ], size=14, lead=26, min_width=330)
        browser.move_to(P(320, 372))

        agent = listing([
            ("your agent, with no browser", PANEL_DIM),
            ("", None),
            ("> await_review", PANEL_TEXT, "BOLD"),
            ("  2 notes received", PANEL_DIM),
            ("  editing CtaButton.tsx:41", GOOD),
        ], size=14, lead=26, min_width=330)
        agent.move_to(P(960, 372))

        self.play(FadeIn(browser, shift=UP * px(8)), run_time=0.5)

        arrow = Arrow(
            start=browser.get_right() + RIGHT * px(14),
            end=agent.get_left() + LEFT * px(14),
            buff=0, stroke_width=2.4, color=ACCENT,
            max_tip_length_to_length_ratio=0.14,
        )
        wire = t("127.0.0.1:7391", 12, INK_MUTE, MONO)
        wire.next_to(arrow, UP, buff=px(10))
        self.play(Create(arrow), FadeIn(wire), run_time=0.55)
        self.play(FadeIn(agent, shift=UP * px(8)), run_time=0.5)
        self.wait(2.8)

        cmd = listing(
            [("claude mcp add inspect-comment -- npx -y inspect-comment-mcp", PANEL_TEXT)],
            size=14, lead=24, pad_y=20, fill="#0f0e0d",
        )
        cmd.move_to(P(640, 588))
        self.play(FadeIn(cmd, shift=UP * px(8)), run_time=0.5)
        self.wait(3.4)
        clear(self, 0.55)

    # -- 6. where to get it -------------------------------------------------

    def beat_close(self):
        word = t("inspect-comment", 34, INK, MONO, weight="BOLD")
        word.move_to(P(640, 268))
        url = t(GH, 17, INK_DIM, MONO)
        url.move_to(P(640, 322))
        row = chips(["ONE FILE", "ZERO DEPENDENCIES", "MIT"], y=406)
        last = t("Works on any page you can open, including ones you do not own.",
                 15, INK_MUTE, BODY)
        last.move_to(P(640, 474))

        self.play(FadeIn(word, shift=UP * px(8)), run_time=0.5)
        self.play(FadeIn(url), run_time=0.4)
        self.play(FadeIn(row, shift=UP * px(6)), run_time=0.45)
        self.play(FadeIn(last), run_time=0.4)
        self.wait(3.8)
