# README animations

Source for the GIFs in the main README. Manim Community, no relationship to the
tool itself: nothing here ships in the package, and `docs/` is excluded from the
`files` list in `package.json`.

```bash
pip install manim            # 0.21 or later
./render.sh                  # all three, into ../media/
./render.sh TheLoop          # just one
manim render -s -qm probe.py Probe   # one still, to check layout fast
```

| Scene | What it argues |
| --- | --- |
| `TheLoop` | The whole product in one pass: hover, click, comment, queue, copy. |
| `OneClick` | What a single click captures, field by field. |
| `ServerComponents` | Why naming a React Server Component is the hard part, and what reading `_debugInfo` gets you. |

## Four things that will bite

Every one of these fails silently. None of them raises, and none of them looks
like the thing that is actually wrong, so they are written down here.

**Every scene module must call `theme.configure()`.** Not just the ones that
look like they need a custom size. Skip it and manim keeps its own defaults: a
black background and a 14.22-unit frame. Nothing errors. The render simply comes
out on black with every `theme.P()` coordinate mapped against the wrong frame
width, which reads as a layout bug rather than a missing call.

**Word spaces collapse below about 16px.** "server components" renders as
"sever components", "the studio" as "thestudio". It is not a missing glyph and
not a bad font. Manim lays text out through Pango and quantises glyph positions,
and at these sizes the rounding is a large fraction of a word space. Measured
across Georgia, Verdana, Cambria, Constantia, Segoe UI and Tahoma at 11px, 13px
and 15px: every family breaks somewhere, and *which* size breaks moves per
family, so picking a better font does not fix it. Verdana is the cleanest at
11px and the worst at 15px. `parts.t()` renders every string at 8x and scales
the vector result back down, which fixes it for every family at every size and
costs nothing, because the SVG has the same path count either way.

**A blank line breaks `arrange()`.** An empty string has to become `Text(" ")`,
and manim renders that to an SVG with no paths, so the mobject has no points and
no bounding box. `arrange()` walks the list with `next_to()` against the
previous item, so the first blank collapses the chain and everything after it
lands back near the origin, stacked on top of the lines above. Place lines at a
fixed leading instead, which is what a monospace listing wants anyway:
`arrange()` spaces by bounding box, so a line with no descender sits tighter
than one with parentheses in it.

**The text cache poisons itself.** Manim hashes every string to an SVG under
`media_dir/texts/` and never re-checks a file it finds there. Interrupt a render
mid-write, which is easy when a scene takes minutes, and the truncated file is
cached forever. Every later render of that one string then dies on

```
ParseError: no element found: line 1, column 0
```

which names neither the file nor the string, so it reads convincingly like a bug
in this code. `theme.configure()` deletes zero-byte entries on startup. If you
hit it anyway, delete the whole `media_dir`.

## Fonts

The palette is the tool's own: `ACCENT` and `SELECT` in `theme.py` are the
defaults from `src/inspect-comment.js`, so an animation of the tool is drawn in
the colours the tool actually paints.

The typefaces are system families, deliberately. `manim.register_font()` works
and the brand faces render correctly through it, but it is catastrophically slow
on Windows: measured at roughly 4.5s per unique string, against 0.06s for a
family Pango already knows. A scene here holds well over a hundred distinct
strings, so that is the difference between a render that takes a minute and one
that takes an hour and climbs past 5 GB of RSS. Set `IC_BRAND_FONTS=1` to opt
into the brand faces anyway; it is only worth it for a one-off still.

If you do register TTFs, note that family names are not typeface names. The
paperdeck faces declare `JB Mono`, `JB Mono Med`, `General Sans`,
`General Sans Med`, `General Sans Semi` and `PP Display`. Each file is a single
weight, so a heavier cut is a different family, never a `weight=` argument.

## Geometry

Everything is authored in CSS pixels on a 1280x720 frame and converted by
`theme.P()` and `theme.px()`. `PXU` is pinned to the design size rather than read
back off manim's config, so rendering a draft at lower resolution does not change
where anything sits.

At this frame geometry manim's `font_size` and a CSS pixel happen to coincide,
which is convenient and is only true because `PXU` is 80. Change the frame and
that stops holding.

`render.sh` passes `--media_dir` on the command line rather than relying on
`theme.configure()`, because manim parses its own config after importing the
scene module and would overwrite it.
