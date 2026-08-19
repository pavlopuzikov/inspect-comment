"""
One still frame containing every composed element, for checking layout without
waiting on a full render.

    manim render -s -qm probe.py Probe
"""

from manim import Scene, config

import theme
from theme import WARN, SELECT
from parts import MockPage, outline, section_outline, badge, dock, cursor, panel, place

theme.configure("probe")
theme.register_fonts()


class Probe(Scene):
    def construct(self):
        page = MockPage()
        self.add(page.group)
        self.add(section_outline(page.hero_bounds, "#golden-era"))
        self.add(outline(page.cta_bounds, SELECT, "<a>.cta"))
        self.add(badge(1, page.card_bounds[1]))
        self.add(dock(active=True, count=2))

        c = cursor()
        c.move_to(theme.P(240, 300))
        self.add(c)

        p = panel(
            [("Component", "ChaptersIndex > CtaButton", None),
             ("Source", "CtaButton.tsx:41", None),
             ("Element", "<a>.cta", None),
             ("Section", "#golden-era", None),
             ("Selector", "#golden-era > a", None),
             ("Box", "196x44 pad 16 24", None),
             ("A11y", "3.1:1 FAILS AA", WARN)],
            comment="these read as buttons but behave as links",
            changes=[("background-color", "#c23a12", "#8f2a0d")],
        )
        place(p, 1280 - 16 - 340, 720 - 16 - 34 - 10 - p.height * theme.PXU)
        self.add(p)
