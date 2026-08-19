# LinkedIn post

Draft copy for the launch post. The video is `docs/media/linkedin.mp4`, rendered
by `docs/animations/render.sh LinkedIn`.

| | |
| --- | --- |
| File | `docs/media/linkedin.mp4` |
| Format | 1920x1080, 16:9, h264 yuv420p, 30fps, no audio |
| Length | 56.8 seconds |
| Rebuild | `cd docs/animations && ./render.sh LinkedIn` |

LinkedIn re-encodes on upload, so upload the mp4 directly rather than a GIF or a
YouTube link. Native video is what gets played inline; a link gets a thumbnail.
There is no audio track, so the post has to carry the argument on its own, which
is why the copy repeats the video's opening line rather than avoiding it.

| Beat | In | Runs |
| --- | --- | --- |
| 1. What it is | 0:00 | 5.4s |
| 2. The note that fails | 0:05 | 9.0s |
| 3. The loop | 0:14 | 18.2s |
| 4. What comes out | 0:32 | 8.9s |
| 5. The handoff | 0:41 | 9.8s |
| 6. Where to get it | 0:51 | 5.6s |

## Post

> I kept sending the same useless design note.
>
> "Can you make the button on the left a bit darker?"
>
> Which button. On which page. Darker than what. By how much. That is four
> questions and two people before anyone touches the code, and at the end of it
> the contrast usually still fails.
>
> So I built inspect-comment. You click an element on a running page and type
> what is wrong with it. It captures everything else: the component name, the
> file and line, a CSS selector that resolves to exactly that element and
> nothing near it, the box model, and the WCAG contrast ratio against whatever
> is actually painted behind it. Then it hands you one markdown block for the
> whole review.
>
> Three things I cared about building it:
>
> React Server Components. Comparable tools walk the client fiber, which on a
> Next App Router page finds SegmentViewNode and nothing else, because a server
> component never gets a fiber at all. This reads _debugInfo too, so the note
> says ChapterTeaserCard rather than saying nothing.
>
> Contrast and focus order. They are the two accessibility failures you cannot
> see in a screenshot, and the two that a pass over the live DOM can actually
> settle.
>
> The agent receives it. There is an MCP server in the box, so Claude Code or
> Cursor gets the review as a tool call instead of a paste, and await_review
> blocks while you mark the page up.
>
> One file, zero dependencies, MIT. It runs from a script tag, a bookmarklet, or
> a paste into the console on a site you do not own.
>
> github.com/pavlopuzikov/inspect-comment

## Shorter, if the long one reads as too much

> "Can you make the button on the left a bit darker?"
>
> Which button. On which page. Darker than what.
>
> inspect-comment: click the element, type the opinion, and it fills in the
> component name, the file and line, an exact selector, the box model and the
> contrast ratio. The whole review copies as one markdown block, or goes
> straight to a coding agent over MCP.
>
> One file, zero dependencies, MIT.
>
> github.com/pavlopuzikov/inspect-comment

## Alt text for the video

Screen recording of a design review tool. A mock page is inspected: hovering
outlines an element and names it, clicking opens a panel showing the component
name, source file and line, CSS selector, box model and a failing contrast
ratio. A short comment is typed, the note is queued, a second element is marked
up, and the finished review is copied out as a single markdown block. The last
section shows the same review arriving at a coding agent over a local MCP
server.
