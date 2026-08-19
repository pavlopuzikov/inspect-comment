// Hand-written types. There is no build step for the types on purpose: a TS
// consumer resolves this file and the bundler resolves the sibling .js, so the
// core stays a plain buildless script that also runs from a <script> tag.

export interface InspectCommentOptions {
  /** Hover outline colour. Default "#3a4a5c". */
  accent?: string;
  /** Selected outline colour. Default "#c23a12". */
  select?: string;
  /** KeyboardEvent.code toggled with Alt. Default "KeyC". */
  hotkey?: string;
  /** Persist the queue to sessionStorage. Default true. */
  storage?: boolean;
  /**
   * Capture console errors/warnings, unhandled rejections and failed fetches
   * and attach them to the review. Wraps console and fetch; fully restored by
   * destroy(). Default true.
   */
  capture?: boolean;
  /**
   * Mirror the queue into `<script type="application/json" id="inspect-comment-queue">`
   * so an agent driving the browser can read it without a copy-paste. Default true.
   */
  expose?: boolean;
  /**
   * Loopback origin of the MCP server in `mcp/server.mjs`. When one is
   * listening, copying a review also posts it there, so a coding agent can
   * fetch the notes instead of the reviewer pasting them.
   * Default "http://127.0.0.1:7391". Pass false to disable.
   */
  bridge?: string | false;
  /**
   * Offer a per-note screenshot button. Nothing is captured until the reviewer
   * presses it, which is also when the browser asks for screen-capture
   * permission. Default true.
   */
  screenshots?: boolean;
}

/** A PNG crop of one element, as the browser actually painted it. */
export interface Screenshot {
  /** `data:image/png;base64,...`, or null when the shot was stripped. */
  dataUrl: string | null;
  width: number;
  height: number;
  /** True when the element ran past a viewport edge and the crop is partial. */
  clipped: boolean;
}

/** One tab stop, in the order the browser will visit it. */
export interface FocusStop {
  /** 1-based position in the page's sequential focus navigation order. */
  index: number;
  element: string;
  /** The resolved tabIndex. Anything above 0 jumps the queue. */
  tabindex: number;
  name: string | null;
  /** True when the keyboard position disagrees with the position on screen. */
  outOfVisualOrder: boolean;
}

export interface CssChange {
  /** kebab-case property, e.g. "font-size". */
  prop: string;
  from: string;
  to: string;
}

export interface LogEntry {
  type: "error" | "warn" | "unhandled" | "network";
  text: string;
}

export interface ElementDescriptor {
  /** pathname + search + hash at capture time. */
  page: string;
  /**
   * Nearest components, outermost first. React (including Server Components),
   * Vue 2/3 and Angular; null when no framework is detected.
   */
  component: string | null;
  /** "File.tsx:12" when the toolchain exposes it (Svelte always does). */
  source: string | null;
  /** "<a>#id.semantic-class" */
  element: string;
  /** Nearest section id, data-component, or landmark tag. */
  section: string | null;
  /** The element's own text, trimmed to 100 chars. */
  text: string;
  /** Shortest CSS path that resolves to this element. */
  selector: string;
  /** False when the selector matches more than one node. */
  selectorUnique: boolean;
  /** Fallback locator, present only when the CSS selector is ambiguous. */
  xpath: string | null;
  /** The element's opening tag, truncated. */
  markup: string;
  /** Curated computed styles: size, spacing, type, colour. */
  box: string;
  /** Role, accessible name, and WCAG contrast ratio with a pass/fail flag. */
  a11y: string | null;
  /** True when `a11y` reports a contrast failure or a missing alt. */
  a11yWarn: boolean;
  /** Position in the page's focus order, or why the element has none. */
  focus: string | null;
  /** True when `focus` reports a positive tabindex or an unnamed control. */
  focusWarn: boolean;
  /** Present only once the reviewer pressed Shot for this element. */
  shot: Screenshot | null;
}

export interface QueueEntry {
  descriptor: ElementDescriptor;
  comment: string;
  /** Live CSS edits made while reviewing this element. */
  changes: CssChange[];
}

export interface InspectCommentApi {
  /** Merge new options. Colours apply immediately. */
  config(next: InspectCommentOptions): void;
  /** Snapshot of the queued comments. */
  readonly queue: QueueEntry[];
  /** Captured console errors, warnings and failed requests. */
  readonly logs: LogEntry[];
  /** Markdown for whatever is queued right now. */
  markdown(): string;
  /** The MCP server origin if one is answering, otherwise null. */
  readonly bridge: string | null;
  /** Every tab stop on the page, in the order the browser will visit them. */
  focusOrder(): FocusStop[];
  /** Push the current queue to the MCP server. False if none is listening. */
  send(): Promise<boolean>;
  /** Revert every live CSS edit without touching the queue. */
  resetStyles(): void;
  /** Remove the UI, restore console/fetch, revert edits, drop every listener. */
  destroy(): void;
}

/** Create an instance. Prefer `mount` unless you need more than one. */
export function createInspector(options?: InspectCommentOptions): InspectCommentApi;

/** Mount once. Repeat calls return the existing instance. Null during SSR. */
export function mount(options?: InspectCommentOptions): InspectCommentApi | null;

/** Destroy the mounted instance, if any. */
export function unmount(): void;

/** Describe an element without any UI. Useful in tests. */
export function describe(el: Element): ElementDescriptor;

/** Render queue entries as the review markdown block. */
export function toMarkdown(entries: QueueEntry[]): string;

/** An sRGB colour with a straight (non-premultiplied) alpha. */
export interface Rgba {
  r: number;
  g: number;
  b: number;
  a: number;
}

/**
 * The contrast maths, exported because it is independently useful and because
 * it is the part most worth testing. Composite with `blend` before measuring:
 * `contrastRatio` assumes both colours are opaque, and translucent text is the
 * case that gets contrast reporting wrong.
 */
export function blend(fg: Rgba, bg: Rgba): Rgba;

/** WCAG 2.x contrast ratio between two opaque colours, unrounded. */
export function contrastRatio(fg: Rgba, bg: Rgba): number;

/** The AA threshold for a size and weight: 3 for large text, otherwise 4.5. */
export function wcagRequirement(sizePx: number, weight: string | number): number;

declare global {
  interface Window {
    __inspectComment?: InspectCommentApi;
    InspectComment?: InspectCommentApi;
  }
}
