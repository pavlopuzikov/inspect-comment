/*!
 * inspect-comment 2.0, dev-only element inspector + comment queue.
 *
 * Hover to highlight, click to select, type a comment, queue it, keep going.
 * "Copy all" emits one markdown review block naming each element precisely
 * enough for a designer or an AI coding agent to act on without guessing.
 *
 *   import { mount } from "./inspect-comment.js";
 *   const api = mount();          // api.destroy() to remove
 *
 * No dependencies. Works on any page; the React component name capture simply
 * stays silent when there is no React on the page.
 */

// DECISION: one ESM implementation is the only source of truth. The React
// component and the IIFE bundle in dist/ are both thin wrappers over this file,
// because the previous vanilla/React copy-paste pair had already diverged
// (differing traversal depth, one missing the clipboard fallback) after a
// single commit.

const HOST_ATTR = "data-inspect-comment";
const QUEUE_KEY = "inspect-comment:queue";
const POS_KEY = "inspect-comment:toggle-pos";
const EXPOSE_ID = "inspect-comment-queue";

const DEFAULTS = {
  accent: "#3a4a5c",
  select: "#c23a12",
  hotkey: "KeyC", // with Alt
  storage: true,
  // Capture console errors, unhandled rejections and failed fetches alongside
  // the notes. Wraps console.error/warn and fetch; fully restored on destroy().
  capture: true,
  // Mirror the queue into a <script type="application/json"> in the page, so an
  // agent driving the browser can read the review without a copy-paste step.
  expose: true,
};

// Live-editable properties, in the order a designer reaches for them.
const TWEAKABLE = [
  ["fontSize", "size"],
  ["fontWeight", "weight"],
  ["lineHeight", "line-height"],
  ["letterSpacing", "tracking"],
  ["color", "color"],
  ["backgroundColor", "background"],
  ["padding", "padding"],
  ["margin", "margin"],
  ["gap", "gap"],
  ["borderRadius", "radius"],
];

const KEBAB = (prop) => prop.replace(/[A-Z]/g, (m) => "-" + m.toLowerCase());

/* ------------------------------------------------------------------ *
 * Element description
 * ------------------------------------------------------------------ */

// WHY: React attaches its fiber under a per-build random suffix, so the key has
// to be discovered rather than hardcoded. Both the modern and legacy names are
// checked so this keeps working on older React too.
function reactFiber(el) {
  for (const key in el) {
    if (key.startsWith("__reactFiber$") || key.startsWith("__reactInternalInstance$")) {
      return el[key];
    }
  }
  return null;
}

// Framework wrappers that are noise in a review note. User components almost
// never collide with these exact names.
const IGNORED_COMPONENTS = new Set([
  "Fragment", "Suspense", "StrictMode", "Profiler", "SuspenseList",
  "AppRouter", "ClientPageRoot", "ClientSegmentRoot", "NonIndex", "HotReload",
  "AsyncMetadata", "AsyncMetadataOutlet", "ServerRoot", "RSCComponent",
  "root", "ReactDevOverlay", "LinkComponent", "MetadataBoundary",
]);

// The rest of the framework's internals follow naming conventions, and there
// are too many to enumerate (Next alone contributes SegmentViewNode,
// InnerScrollAndFocusHandlerOld, __next_root_layout_boundary__, ...).
const INTERNAL_COMPONENT = /^__|(?:Boundary|Provider|Context|Router|Handler|HandlerOld|Node|Outlet)$/;

function isNoise(name) {
  return IGNORED_COMPONENTS.has(name) || INTERNAL_COMPONENT.test(name);
}

// WHY: a React Server Component never gets a fiber of its own, so walking
// `.return` on an App Router page finds nothing but Next's own boundaries. The
// server components that produced a node are recorded on `fiber._debugInfo`
// instead, which is where names like "Hero" and "HomePage" actually live.
function fiberNames(node) {
  // Innermost first: the fiber's own type, then the owners that rendered it.
  const names = [];
  const own = fiberName(node);
  if (own) names.push(own);
  const info = node._debugInfo;
  if (Array.isArray(info)) {
    for (let i = info.length - 1; i >= 0; i--) {
      const d = info[i];
      if (d && typeof d.name === "string" && d.name) names.push(d.name);
    }
  }
  return names;
}

function fiberName(fiber) {
  const t = fiber.type;
  if (typeof t === "function") return t.displayName || t.name || null;
  if (t && typeof t === "object") {
    // forwardRef stores the component on .render, memo on .type.
    const inner = t.render || t.type;
    if (typeof inner === "function") return t.displayName || inner.displayName || inner.name || null;
    return typeof t.displayName === "string" ? t.displayName : null;
  }
  return null; // host elements (string type) and internal symbols
}

// Returns e.g. "ChaptersIndex > ChapterTeaserCard", nearest component last.
function componentPath(el, limit = 3) {
  let fiber;
  try {
    fiber = reactFiber(el);
  } catch {
    return null;
  }
  if (!fiber) {
    const marked = el.closest("[data-component]");
    return marked ? marked.getAttribute("data-component") : null;
  }

  const kept = [];
  let node = fiber;
  let hops = 0;
  while (node && kept.length < limit && hops < 80) {
    for (const name of fiberNames(node)) {
      if (isNoise(name) || kept[kept.length - 1] === name) continue;
      kept.push(name);
      if (kept.length >= limit) break;
    }
    node = node.return;
    hops++;
  }
  // Collected innermost-first while walking outward; report outermost-first.
  return kept.length ? kept.reverse().join(" > ") : null;
}

// TRADEOFF: React 19 dropped _debugSource from elements, so file:line is a
// bonus when the toolchain still provides it, never something the output
// promises. Absence is silent.
function sourceLocation(el) {
  try {
    const fiber = reactFiber(el);
    if (!fiber) return null;
    const src = fiber._debugSource || (fiber._debugOwner && fiber._debugOwner._debugSource);
    if (!src || !src.fileName) return null;
    const file = src.fileName.split(/[\\/]/).pop();
    return src.lineNumber ? `${file}:${src.lineNumber}` : file;
  } catch {
    return null;
  }
}

/* ---- other frameworks ---------------------------------------------- *
 * React is the deep case (server components need _debugInfo). Vue, Svelte
 * and Angular each expose their own hook, so a component name is available
 * on any of the big four rather than React only.
 * ------------------------------------------------------------------- */

function vueComponentPath(el, limit = 3) {
  const names = [];

  // Vue 3: every host element carries __vueParentComponent.
  let node = el;
  let vc = null;
  while (node && !vc) {
    vc = node.__vueParentComponent;
    node = node.parentElement;
  }
  if (vc) {
    for (let c = vc; c && names.length < limit; c = c.parent) {
      const t = c.type || {};
      const name = t.__name || t.name || fileStem(t.__file);
      if (name && names[0] !== name) names.unshift(name);
    }
    return names.length ? names.join(" > ") : null;
  }

  // Vue 2: __vue__ on the element, $parent to walk up.
  node = el;
  let v2 = null;
  while (node && !v2) {
    v2 = node.__vue__;
    node = node.parentElement;
  }
  if (v2) {
    for (let c = v2; c && names.length < limit; c = c.$parent) {
      const o = c.$options || {};
      const name = o.name || fileStem(o.__file);
      if (name && names[0] !== name) names.unshift(name);
    }
    return names.length ? names.join(" > ") : null;
  }
  return null;
}

function fileStem(path) {
  if (!path) return null;
  return path.split(/[\\/]/).pop().replace(/\.(vue|jsx?|tsx?|svelte)$/, "");
}

// Svelte's dev build records the authoring location on the node itself, which
// is the one framework that hands over file:line for free.
function svelteSource(el) {
  for (let node = el; node; node = node.parentElement) {
    const loc = node.__svelte_meta && node.__svelte_meta.loc;
    if (loc && loc.file) return loc.file.split(/[\\/]/).pop() + (loc.line ? ":" + loc.line : "");
  }
  return null;
}

function angularComponent(el) {
  const ng = window.ng;
  if (!ng || typeof ng.getComponent !== "function") return null;
  for (let node = el; node; node = node.parentElement) {
    try {
      const c = ng.getComponent(node);
      if (c && c.constructor && c.constructor.name) return c.constructor.name;
    } catch {
      /* not a component host */
    }
  }
  return null;
}

/* ---- accessibility -------------------------------------------------- */

const IMPLICIT_ROLE = {
  a: "link", button: "button", nav: "navigation", main: "main", header: "banner",
  footer: "contentinfo", aside: "complementary", form: "form", img: "img",
  h1: "heading", h2: "heading", h3: "heading", h4: "heading", h5: "heading", h6: "heading",
  ul: "list", ol: "list", li: "listitem", table: "table", select: "combobox",
  textarea: "textbox", dialog: "dialog", section: "region",
};

function accessibleName(el) {
  const label = el.getAttribute("aria-label");
  if (label && label.trim()) return label.trim();

  const by = el.getAttribute("aria-labelledby");
  if (by) {
    const text = by
      .split(/\s+/)
      .map((id) => {
        const n = document.getElementById(id);
        return n ? n.textContent.trim() : "";
      })
      .filter(Boolean)
      .join(" ");
    if (text) return text;
  }
  const title = el.getAttribute("title");
  return title && title.trim() ? title.trim() : null;
}

function parseRgb(value) {
  const m = /^rgba?\(([^)]+)\)$/.exec(value || "");
  if (!m) return null;
  const p = m[1].split(",").map((v) => parseFloat(v));
  if (p.length < 3 || p.some(Number.isNaN)) return null;
  return { r: p[0], g: p[1], b: p[2], a: p[3] === undefined ? 1 : p[3] };
}

function luminance({ r, g, b }) {
  const f = (c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

// The nearest ancestor that actually paints something, since a transparent
// background means the text sits on whatever is behind it.
function effectiveBackground(el) {
  for (let node = el; node && node !== document.documentElement; node = node.parentElement) {
    const c = parseRgb(getComputedStyle(node).backgroundColor);
    if (c && c.a > 0) return c;
  }
  return { r: 255, g: 255, b: 255, a: 1 };
}

// WHY: none of the comparable tools compute this, and "is this text actually
// readable" is one of the few design-review questions with a right answer.
function contrastOf(el, cs) {
  const fg = parseRgb(cs.color);
  if (!fg) return null;
  const bg = effectiveBackground(el);
  const [l1, l2] = [luminance(fg), luminance(bg)];
  const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  const size = parseFloat(cs.fontSize);
  const bold = parseInt(cs.fontWeight, 10) >= 700;
  const large = size >= 24 || (size >= 18.66 && bold);
  const required = large ? 3 : 4.5;
  return { ratio: Math.round(ratio * 10) / 10, required, pass: ratio + 0.05 >= required };
}

function a11ySummary(el, cs, hasText) {
  const bits = [];
  const role = el.getAttribute("role") || IMPLICIT_ROLE[el.tagName.toLowerCase()];
  if (role) bits.push("role " + role);

  const name = accessibleName(el);
  if (name) bits.push(`name "${name.slice(0, 60)}"`);

  if (el.tagName === "IMG" && el.getAttribute("alt") === null) bits.push("MISSING alt");
  if (el.hasAttribute("disabled")) bits.push("disabled");
  const ti = el.getAttribute("tabindex");
  if (ti) bits.push("tabindex " + ti);

  if (hasText) {
    const c = contrastOf(el, cs);
    if (c) bits.push(`contrast ${c.ratio}:1${c.pass ? "" : ` FAILS AA (needs ${c.required})`}`);
  }
  return bits.length ? bits.join(" · ") : null;
}

/* ---- extra locators -------------------------------------------------- */

function xPath(el) {
  const parts = [];
  for (let node = el; node && node.nodeType === 1 && parts.length < 12; node = node.parentElement) {
    if (node.id) {
      parts.unshift(`//*[@id="${node.id}"]`);
      return parts.join("/");
    }
    let i = 1;
    for (let sib = node.previousElementSibling; sib; sib = sib.previousElementSibling) {
      if (sib.tagName === node.tagName) i++;
    }
    parts.unshift(`${node.tagName.toLowerCase()}[${i}]`);
  }
  return "/" + parts.join("/");
}

// Just the opening tag: the full outerHTML of a section is unusable in a note.
function markup(el) {
  const html = el.outerHTML || "";
  const open = html.slice(0, html.indexOf(">") + 1) || html.slice(0, 120);
  return open.length > 180 ? open.slice(0, 180) + "…" : open;
}

// Tailwind utility prefixes. Anything matching these carries no meaning in a
// review note, and printing four of them (".flex.min-h-\[calc(...)\].flex-col")
// actively buries the useful identifiers.
const UTILITY_CLASS = new RegExp(
  "^(?:" +
    "[mp][trblxyse]?|w|h|size|min-w|max-w|min-h|max-h|gap|space|inset|top|right|bottom|left|" +
    "z|order|col|row|grid|flex|basis|grow|shrink|items|justify|self|content|place|" +
    "text|font|leading|tracking|whitespace|break|truncate|indent|align|list|decoration|underline|" +
    "bg|from|via|to|border|divide|rounded|shadow|opacity|ring|outline|" +
    "transition|duration|ease|delay|animate|transform|translate|rotate|scale|skew|origin|" +
    "cursor|select|resize|overflow|overscroll|scroll|snap|touch|will|appearance|pointer|" +
    "fill|stroke|sr|not|visible|invisible|static|fixed|absolute|relative|sticky|" +
    "block|inline|hidden|table|contents|flow|isolate|object|aspect|container|columns|" +
    "filter|blur|brightness|contrast|grayscale|saturate|sepia|invert|backdrop|mix|" +
    "uppercase|lowercase|capitalize|italic|antialiased|tabular|oldstyle|caret|accent" +
  ")(?:-|$)"
);

function semanticClasses(el, limit = 4) {
  const kept = [];
  for (const c of el.classList) {
    // Variant prefixes (sm:, hover:), arbitrary values ([...]), and fractions
    // are always utilities.
    if (c.includes(":") || c.includes("[") || c.includes("/")) continue;
    if (UTILITY_CLASS.test(c)) continue;
    kept.push(c);
    if (kept.length >= limit) break;
  }
  return kept;
}

function isUnique(selector, el) {
  if (!selector) return false;
  try {
    const matches = document.querySelectorAll(selector);
    return matches.length === 1 && matches[0] === el;
  } catch {
    return false;
  }
}

// WHY: builds upward and returns as soon as the path resolves to exactly this
// element, so a selector is the shortest one that actually works rather than a
// fixed six levels of "div > div > div".
function cssPath(el, maxDepth = 8) {
  const parts = [];
  let node = el;
  let depth = 0;

  while (node && node.nodeType === 1 && node !== document.documentElement && depth < maxDepth) {
    let stop = false;
    if (node.id) {
      parts.unshift("#" + CSS.escape(node.id));
      stop = true;
    } else {
      let sel = node.tagName.toLowerCase();
      const parent = node.parentElement;
      if (parent) {
        const same = Array.prototype.filter.call(parent.children, (c) => c.tagName === node.tagName);
        if (same.length > 1) sel += `:nth-of-type(${same.indexOf(node) + 1})`;
      }
      parts.unshift(sel);
    }

    const candidate = parts.join(" > ");
    if (isUnique(candidate, el)) return { selector: candidate, unique: true };
    if (stop) break;

    node = node.parentElement;
    depth++;
  }

  const selector = parts.join(" > ");
  return { selector, unique: isUnique(selector, el) };
}

const SECTION_SELECTOR =
  "section[id], [data-component], main[id], article[id], [aria-labelledby], section, article, header, footer, nav";

// The enclosing region a note belongs to. Named ones are preferred, but any
// section/article counts so the highlight always has something to draw.
function sectionEl(el) {
  const found = el.closest(SECTION_SELECTOR);
  return found && found !== el ? found : null;
}

// WHY the `!== el` guard: closest() matches the element itself, so selecting a
// <section id="pricing"> used to print `Section: #pricing` directly under
// `Element: <section>#pricing`. sectionEl() above already guards this; the two
// have to agree or the note disagrees with the highlight drawn on the page.
function sectionContext(el) {
  let ctxEl = el.closest(
    "section[id], [data-component], main[id], article[id], [aria-labelledby], header, footer, nav"
  );
  if (ctxEl === el) ctxEl = el.parentElement && el.parentElement.closest(
    "section[id], [data-component], main[id], article[id], [aria-labelledby], header, footer, nav"
  );
  if (!ctxEl) return null;
  if (ctxEl.id) return "#" + ctxEl.id;
  return ctxEl.getAttribute("data-component") || ctxEl.tagName.toLowerCase();
}

function sectionLabelFor(el) {
  if (el.id) return "#" + el.id;
  const named = el.getAttribute("data-component");
  if (named) return named;
  const component = componentPath(el, 1);
  return component || el.tagName.toLowerCase();
}

// Prefer the element's own text over the concatenated text of everything
// beneath it, so selecting a section does not dump the whole page into a note.
function ownText(el) {
  let direct = "";
  for (const node of el.childNodes) {
    if (node.nodeType === 3) direct += node.nodeValue;
  }
  direct = direct.replace(/\s+/g, " ").trim();
  const all = (el.textContent || "").replace(/\s+/g, " ").trim();
  const text = direct || all;
  return text.length > 100 ? text.slice(0, 100) + "…" : text;
}

function toHex(color) {
  const m = /^rgba?\(([^)]+)\)$/.exec(color);
  if (!m) return color;
  const parts = m[1].split(",").map((v) => parseFloat(v));
  const [r, g, b, a] = parts;
  if (a !== undefined && a < 1) return color;
  const hex = (n) => Math.round(n).toString(16).padStart(2, "0");
  return "#" + hex(r) + hex(g) + hex(b);
}

function edges(a, b, c, d) {
  const v = [a, b, c, d].map((x) => (parseFloat(x) ? x : "0"));
  if (v[0] === v[1] && v[1] === v[2] && v[2] === v[3]) return v[0];
  if (v[0] === v[2] && v[1] === v[3]) return `${v[0]} ${v[1]}`;
  return v.join(" ");
}

// A curated slice of the computed style. Enough to make "this spacing is off"
// or "this colour is wrong" actionable; not the full 300-property dump.
function computedBox(el) {
  const cs = getComputedStyle(el);
  const r = el.getBoundingClientRect();
  const out = [`${Math.round(r.width)}x${Math.round(r.height)}`];

  const pad = edges(cs.paddingTop, cs.paddingRight, cs.paddingBottom, cs.paddingLeft);
  if (pad !== "0") out.push("padding " + pad);
  const mar = edges(cs.marginTop, cs.marginRight, cs.marginBottom, cs.marginLeft);
  if (mar !== "0") out.push("margin " + mar);
  if (parseFloat(cs.gap)) out.push("gap " + cs.gap);

  const family = (cs.fontFamily || "").split(",")[0].replace(/["']/g, "").trim();
  const lh = cs.lineHeight && cs.lineHeight !== "normal" ? "/" + cs.lineHeight : "";
  out.push(`${cs.fontSize}${lh} ${cs.fontWeight}${family ? " " + family : ""}`);

  out.push("color " + toHex(cs.color));
  const bg = cs.backgroundColor;
  if (bg && bg !== "rgba(0, 0, 0, 0)" && bg !== "transparent") out.push("bg " + toHex(bg));
  if (parseFloat(cs.borderRadius)) out.push("radius " + cs.borderRadius);
  if (cs.display && cs.display !== "block" && cs.display !== "inline") out.push(cs.display);

  return out.join(" · ");
}

/* ------------------------------------------------------------------ *
 * Console + network capture
 *
 * WHY: half of "this looks wrong" is actually "this is broken", and the
 * evidence is sitting in a console the reviewer never opens. Capturing errors
 * alongside the notes means the agent gets the stack trace with the complaint
 * instead of asking for it.
 * ------------------------------------------------------------------ */

const LOG_LIMIT = 25;
const logs = [];
let logRestore = null;

function pushLog(type, text) {
  if (!text) return;
  const entry = { type, text: String(text).slice(0, 300) };
  const last = logs[logs.length - 1];
  if (last && last.type === entry.type && last.text === entry.text) return; // collapse repeats
  logs.push(entry);
  if (logs.length > LOG_LIMIT) logs.shift();
}

function formatArg(a) {
  if (a instanceof Error) return a.message;
  if (typeof a === "object" && a !== null) {
    try {
      return JSON.stringify(a);
    } catch {
      return "[object]";
    }
  }
  return String(a);
}

function startCapture() {
  if (logRestore) return;
  const originals = {};

  for (const level of ["error", "warn"]) {
    originals[level] = console[level];
    console[level] = function (...args) {
      pushLog(level, args.map(formatArg).join(" "));
      return originals[level].apply(this, args);
    };
  }

  const onError = (e) => pushLog("error", e.message);
  const onRejection = (e) => pushLog("unhandled", formatArg(e.reason));
  window.addEventListener("error", onError, true);
  window.addEventListener("unhandledrejection", onRejection, true);

  // Failed requests are the other half of the story. Wrap rather than use
  // PerformanceObserver, which cannot see the status code.
  const originalFetch = window.fetch;
  if (typeof originalFetch === "function") {
    window.fetch = async function (...args) {
      const url = typeof args[0] === "string" ? args[0] : args[0] && args[0].url;
      try {
        const res = await originalFetch.apply(this, args);
        if (!res.ok) pushLog("network", `${res.status} ${url}`);
        return res;
      } catch (err) {
        pushLog("network", `failed ${url}: ${formatArg(err)}`);
        throw err;
      }
    };
  }

  logRestore = () => {
    for (const level of ["error", "warn"]) console[level] = originals[level];
    window.removeEventListener("error", onError, true);
    window.removeEventListener("unhandledrejection", onRejection, true);
    if (typeof originalFetch === "function") window.fetch = originalFetch;
    // WHY: `logs` is module state, so without this a remount inherits the
    // previous session's errors and the note claims they were raised during a
    // review that had not started yet. React Fast Refresh remounts constantly.
    logs.length = 0;
    logRestore = null;
  };
}

function shortLabel(el) {
  const cls = semanticClasses(el, 1);
  return `<${el.tagName.toLowerCase()}>${el.id ? "#" + el.id : ""}${cls.length ? "." + cls[0] : ""}`;
}

function describe(el) {
  const { selector, unique } = cssPath(el);
  const cls = semanticClasses(el);
  const cs = getComputedStyle(el);
  const text = ownText(el);
  return {
    page: location.pathname + location.search + location.hash,
    component: componentPath(el) || vueComponentPath(el) || angularComponent(el),
    source: sourceLocation(el) || svelteSource(el),
    element: `<${el.tagName.toLowerCase()}>${el.id ? "#" + el.id : ""}${cls.map((c) => "." + c).join("")}`,
    section: sectionContext(el),
    text,
    selector,
    selectorUnique: unique,
    // Only when the selector is ambiguous; otherwise it is noise in the note.
    xpath: unique ? null : xPath(el),
    markup: markup(el),
    box: computedBox(el),
    a11y: a11ySummary(el, cs, !!text),
  };
}

/* ------------------------------------------------------------------ *
 * Markdown output
 * ------------------------------------------------------------------ */

function entryToMarkdown(entry, index) {
  const d = entry.descriptor;
  const lines = [`## ${index}. ${d.component || d.element}`];
  if (d.component) lines.push(`- Element: \`${d.element}\``);
  if (d.source) lines.push(`- Source: \`${d.source}\``);
  if (d.section) lines.push(`- Section: ${d.section}`);
  if (d.text) lines.push(`- Text: "${d.text}"`);
  lines.push(`- Selector: \`${d.selector}\`${d.selectorUnique ? "" : " (not unique)"}`);
  if (d.xpath) lines.push(`- XPath: \`${d.xpath}\``);
  if (d.markup) lines.push(`- Markup: \`${d.markup}\``);
  lines.push(`- Box: ${d.box}`);
  if (d.a11y) lines.push(`- A11y: ${d.a11y}`);

  // The exact values the reviewer dialled in, so the agent implements a number
  // rather than interpreting "a bit smaller".
  if (entry.changes && entry.changes.length) {
    lines.push("", "**Suggested CSS:**");
    for (const c of entry.changes) lines.push(`- \`${c.prop}\`: ${c.from} → ${c.to}`);
  }
  if (entry.comment) lines.push("", `**Comment:** ${entry.comment}`);
  return lines.join("\n");
}

function logsToMarkdown() {
  if (!logs.length) return "";
  const lines = ["", `## Console (${logs.length})`];
  for (const l of logs) lines.push(`- \`${l.type}\` ${l.text}`);
  return lines.join("\n") + "\n";
}

function toMarkdown(entries) {
  if (!entries.length) return "";
  const pages = [...new Set(entries.map((e) => e.descriptor.page))];
  const head = [
    `# Review: ${pages.length === 1 ? pages[0] : location.origin}`,
    `Viewport ${window.innerWidth}x${window.innerHeight} @${window.devicePixelRatio}x · ${entries.length} item${entries.length === 1 ? "" : "s"}`,
  ];

  if (pages.length === 1) {
    return (
      head.join("\n") +
      "\n\n" +
      entries.map((e, i) => entryToMarkdown(e, i + 1)).join("\n\n") +
      "\n" +
      logsToMarkdown()
    );
  }

  let n = 0;
  const blocks = pages.map((page) => {
    const forPage = entries.filter((e) => e.descriptor.page === page);
    return `### ${page}\n\n` + forPage.map((e) => entryToMarkdown(e, ++n)).join("\n\n");
  });
  return head.join("\n") + "\n\n" + blocks.join("\n\n") + "\n" + logsToMarkdown();
}

/* ------------------------------------------------------------------ *
 * Clipboard
 * ------------------------------------------------------------------ */

// WHY: navigator.clipboard is undefined on non-secure origins, which is exactly
// the case when previewing a dev server from a phone over the LAN IP. The
// execCommand path keeps copy working there.
async function writeClipboard(text) {
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      /* fall through */
    }
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    Object.assign(ta.style, { position: "fixed", top: "0", left: "0", opacity: "0" });
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ *
 * Styles (scoped to the shadow root)
 * ------------------------------------------------------------------ */

const CSS_TEXT = `
:host { all: initial; }
* { box-sizing: border-box; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }

.hl {
  position: fixed; pointer-events: none; z-index: 2147483000;
  outline: 2px solid var(--accent); background: color-mix(in srgb, var(--accent) 12%, transparent);
  display: none;
}
.hl[data-selected] { outline-color: var(--select); background: color-mix(in srgb, var(--select) 10%, transparent); }
.hl-label {
  position: absolute; top: -22px; left: 0; background: #161512; color: #f6f5f1;
  font: 11px/1.4 inherit; padding: 3px 6px; border-radius: 4px; white-space: nowrap;
}
.hl-label[data-below] { top: 100%; margin-top: 4px; }

/* The enclosing section, so it is obvious which region a note belongs to. */
.sec {
  position: fixed; pointer-events: none; z-index: 2147482999; display: none;
  outline: 1px dashed color-mix(in srgb, var(--accent) 70%, transparent);
  background: color-mix(in srgb, var(--accent) 4%, transparent);
}
.sec-label {
  position: absolute; top: 0; right: 0; background: var(--accent); color: #f6f5f1;
  font: 10px/1.4 inherit; padding: 3px 6px; border-radius: 0 0 0 4px; white-space: nowrap;
}

/* Everything already queued stays marked, so the page shows the whole review. */
.mk {
  position: fixed; pointer-events: none; z-index: 2147482998;
  outline: 1px solid color-mix(in srgb, var(--select) 60%, transparent);
  background: color-mix(in srgb, var(--select) 5%, transparent);
}
.mk-n {
  position: absolute; top: 0; left: 0; background: var(--select); color: #f6f5f1;
  font: 10px/1 inherit; padding: 3px 5px; border-radius: 0 0 4px 0;
}

.dock { position: fixed; z-index: 2147483001; display: flex; gap: 6px; align-items: flex-end; }

button {
  font: 11px/1 inherit; letter-spacing: 0.08em; text-transform: uppercase;
  border-radius: 999px; border: none; cursor: pointer; padding: 9px 12px;
  background: #161512; color: #f6f5f1; box-shadow: 0 6px 20px rgba(0,0,0,0.25);
}
button:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.toggle[data-active] { background: var(--accent); }
.toggle { touch-action: none; }
.count { background: var(--select); padding: 9px 10px; }

.panel {
  position: fixed; z-index: 2147483002; width: 340px; max-width: calc(100vw - 32px);
  background: #161512; color: #f6f5f1; border-radius: 12px; padding: 14px;
  box-shadow: 0 12px 40px rgba(0,0,0,0.4); font: 12px/1.4 inherit;
}
.eyebrow { font-size: 10px; letter-spacing: 0.14em; text-transform: uppercase; color: #918a7c; margin-bottom: 8px; }
.crumbs { display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 8px; }
.crumb {
  font: 10px/1 inherit; text-transform: none; letter-spacing: 0;
  padding: 4px 6px; border-radius: 5px; background: #24221f; color: #b4ada0; box-shadow: none;
}
.crumb[data-current] { background: var(--select); color: #f6f5f1; }
.desc { white-space: pre-wrap; color: #b4ada0; font-size: 11px; margin-bottom: 10px; max-height: 132px; overflow: auto; }
.warn { color: #d8a657; }

textarea {
  width: 100%; resize: vertical; background: #0f0e0d; color: #f6f5f1;
  border: 1px solid #33322f; border-radius: 8px; padding: 8px 10px;
  font: 12px/1.4 inherit; outline: none;
}
textarea:focus { border-color: var(--accent); }

/* Live CSS editing. Values apply to the page as you type. */
.tweaks { display: none; grid-template-columns: 1fr 1fr; gap: 6px; margin-top: 10px; }
.tweaks[data-open] { display: grid; }
.tw { display: flex; flex-direction: column; gap: 3px; }
.tw label { font-size: 9px; letter-spacing: 0.1em; text-transform: uppercase; color: #6f6a61; }
.tw input {
  background: #0f0e0d; color: #f6f5f1; border: 1px solid #33322f; border-radius: 6px;
  padding: 5px 6px; font: 11px/1.2 inherit; outline: none; width: 100%; min-width: 0;
}
.tw input:focus { border-color: var(--accent); }
.tw input[data-changed] { border-color: var(--select); color: #f0c9b8; }
.tweak-toggle { background: transparent; color: #918a7c; border: 1px solid #33322f; box-shadow: none; }
.tweak-toggle[data-open] { background: var(--accent); color: #f6f5f1; border-color: transparent; }

.row { display: flex; gap: 8px; margin-top: 10px; }
.row button { border-radius: 8px; flex-shrink: 0; }
.primary { flex: 1; background: var(--accent); }
.ghost { background: transparent; color: #918a7c; border: 1px solid #33322f; box-shadow: none; }
.hint { margin-top: 8px; font-size: 10px; color: #6f6a61; letter-spacing: 0.04em; }

.queue { max-height: 300px; overflow: auto; margin-bottom: 10px; }
.item { display: flex; gap: 8px; padding: 8px 0; border-top: 1px solid #24221f; }
.item:first-child { border-top: none; }
.item-n { color: #6f6a61; font-size: 11px; }
.item-body { flex: 1; min-width: 0; }
.item-title { font-size: 11px; color: #f6f5f1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.item-note { font-size: 11px; color: #918a7c; margin-top: 2px; }
.item-del { background: transparent; color: #6f6a61; padding: 2px 6px; box-shadow: none; font-size: 13px; }
.item-del:hover { color: var(--select); }

.toast {
  position: fixed; z-index: 2147483003; background: #161512; color: #f6f5f1;
  font: 12px/1.2 inherit; padding: 10px 12px; border-radius: 8px;
  box-shadow: 0 6px 20px rgba(0,0,0,0.25);
}
`;

/* ------------------------------------------------------------------ *
 * Instance
 * ------------------------------------------------------------------ */

// WHY: a plain spread lets an explicitly-undefined property clobber a default,
// and React callers pass exactly that shape (`mount({ hotkey, storage })` with
// the props unset). That silently disabled the hotkey and queue persistence.
function merge(base, next = {}) {
  for (const key of Object.keys(next)) {
    if (next[key] !== undefined) base[key] = next[key];
  }
  return base;
}

export function createInspector(options = {}) {
  const opts = merge({ ...DEFAULTS }, options);

  const state = {
    active: false,
    /** @type {Element|null} */ target: null, // element under the crosshair or selected
    selected: false, // is the comment panel open for `target`
    queue: [],
    queueOpen: false,
    raf: 0,
    moveRaf: 0,
    pending: null,
    tweakOpen: false,
    // element -> its original inline style attribute, so every live CSS edit
    // is reversible and the page can be handed back exactly as it was.
    originalStyle: new Map(),
  };

  /* ---- storage ---- */

  function loadQueue() {
    if (!opts.storage) return [];
    try {
      const raw = sessionStorage.getItem(QUEUE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(parsed)) return [];
      // Re-attach the element so restored entries still draw their marker. It
      // may be gone or on another route, in which case the note survives
      // without a marker.
      return parsed.map((entry) => ({
        changes: [],
        ...entry,
        el: resolve(entry.descriptor && entry.descriptor.selector),
      }));
    } catch {
      return [];
    }
  }

  function resolve(selector) {
    if (!selector) return null;
    try {
      return document.querySelector(selector);
    } catch {
      return null;
    }
  }

  // `el` is a live DOM node: strip it, JSON cannot represent it.
  function plainQueue() {
    return state.queue.map(({ descriptor, comment, changes }) => ({ descriptor, comment, changes }));
  }

  function saveQueue() {
    syncExposed();
    if (!opts.storage) return;
    try {
      sessionStorage.setItem(QUEUE_KEY, JSON.stringify(plainQueue()));
    } catch {
      /* quota or disabled storage: the queue simply stays in memory */
    }
  }

  // WHY: mirroring the queue into the page means an agent already driving the
  // browser can read the whole review in one evaluate, with no server, no port
  // and no copy-paste step:
  //   JSON.parse(document.getElementById("inspect-comment-queue").textContent)
  function syncExposed() {
    if (!opts.expose) return;
    let tag = document.getElementById(EXPOSE_ID);
    if (!state.queue.length) {
      if (tag) tag.remove();
      return;
    }
    if (!tag) {
      tag = document.createElement("script");
      tag.type = "application/json";
      tag.id = EXPOSE_ID;
      (document.head || document.documentElement).appendChild(tag);
    }
    tag.textContent = JSON.stringify(plainQueue(), null, 2);
  }

  /* ---- shadow UI ---- */

  // DECISION: the UI lives in a shadow root so host-page CSS (Tailwind preflight
  // resets every button, `div { }` rules on older sites) cannot reach it. The
  // previous `all: initial` on a plain div protected the root but not its
  // descendants.
  const host = document.createElement("div");
  host.setAttribute(HOST_ATTR, "");
  Object.assign(host.style, { position: "fixed", top: "0", left: "0", width: "0", height: "0" });
  const shadow = host.attachShadow({ mode: "open" });

  const style = document.createElement("style");
  style.textContent = CSS_TEXT;
  shadow.appendChild(style);
  shadow.host.style.setProperty("--accent", opts.accent);
  shadow.host.style.setProperty("--select", opts.select);

  const ui = document.createElement("div");
  ui.style.setProperty("--accent", opts.accent);
  ui.style.setProperty("--select", opts.select);
  shadow.appendChild(ui);

  const highlight = el("div", "hl");
  const hlLabel = el("span", "hl-label");
  highlight.appendChild(hlLabel);

  const sectionBox = el("div", "sec");
  const sectionLabel = el("span", "sec-label");
  sectionBox.appendChild(sectionLabel);

  // One marker box per queued entry, repositioned in the same rAF tick.
  const markers = el("div", "markers");

  const dock = el("div", "dock");
  const toggle = el("button", "toggle");
  toggle.type = "button";
  const countBtn = el("button", "count");
  countBtn.type = "button";
  countBtn.style.display = "none";
  dock.append(toggle, countBtn);

  ui.append(markers, sectionBox, highlight, dock);

  let panel = null;
  let textarea = null;
  let tweakInputs = {};

  /* ---- live CSS editing ---- */

  function applyTweak(prop, value) {
    const node = state.target;
    if (!node) return;
    if (!state.originalStyle.has(node)) {
      state.originalStyle.set(node, node.getAttribute("style"));
    }
    if (value) node.style.setProperty(KEBAB(prop), value);
    else node.style.removeProperty(KEBAB(prop));
  }

  function readTweaks(baseline) {
    const out = [];
    for (const [prop] of TWEAKABLE) {
      const input = tweakInputs[prop];
      if (!input) continue;
      const to = input.value.trim();
      if (to && to !== baseline[prop]) out.push({ prop: KEBAB(prop), from: baseline[prop], to });
    }
    return out;
  }

  // Called once the review is handed off, so the page goes back to the truth
  // rather than silently keeping a reviewer's experiment applied.
  function resetStyles() {
    for (const [node, style] of state.originalStyle) {
      if (style === null) node.removeAttribute("style");
      else node.setAttribute("style", style);
    }
    state.originalStyle.clear();
  }

  function el(tag, cls) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    return node;
  }

  /* ---- toggle position ---- */

  function loadPos() {
    try {
      const raw = localStorage.getItem(POS_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }
  function applyPos(pos) {
    const p = pos || { right: 16, bottom: 16 };
    if (p.left != null) {
      dock.style.left = clamp(p.left, 0, window.innerWidth - 80) + "px";
      dock.style.right = "auto";
    } else {
      dock.style.right = p.right + "px";
      dock.style.left = "auto";
    }
    if (p.top != null) {
      dock.style.top = clamp(p.top, 0, window.innerHeight - 40) + "px";
      dock.style.bottom = "auto";
    } else {
      dock.style.bottom = p.bottom + "px";
      dock.style.top = "auto";
    }
  }
  const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);
  applyPos(loadPos());

  // WHY: the button parks bottom-right, directly over the primary CTA on most
  // landing pages. Drag beyond a few pixels moves it; anything shorter is
  // treated as a click so the toggle still behaves like a button.
  let drag = null;
  toggle.addEventListener("pointerdown", (e) => {
    const r = dock.getBoundingClientRect();
    drag = { x: e.clientX, y: e.clientY, dx: e.clientX - r.left, dy: e.clientY - r.top, moved: false };
    toggle.setPointerCapture(e.pointerId);
  });
  toggle.addEventListener("pointermove", (e) => {
    if (!drag) return;
    if (Math.abs(e.clientX - drag.x) + Math.abs(e.clientY - drag.y) > 4) drag.moved = true;
    if (!drag.moved) return;
    applyPos({ left: e.clientX - drag.dx, top: e.clientY - drag.dy });
  });
  toggle.addEventListener("pointerup", (e) => {
    if (!drag) return;
    const moved = drag.moved;
    drag = null;
    try {
      toggle.releasePointerCapture(e.pointerId);
    } catch {
      /* pointer already released */
    }
    if (moved) {
      const r = dock.getBoundingClientRect();
      try {
        localStorage.setItem(POS_KEY, JSON.stringify({ left: r.left, top: r.top }));
      } catch {
        /* storage disabled */
      }
    } else {
      setActive(!state.active);
    }
  });

  countBtn.addEventListener("click", () => {
    if (state.queueOpen) closePanel();
    else openQueue();
  });

  /* ---- highlight ---- */

  // WHY: the rect used to be captured once at click time, so the outline drifted
  // away from its element on the first scroll. A rAF loop that only runs while
  // something is highlighted keeps it locked, and also survives layout shift and
  // animation.
  function place(node, rect) {
    Object.assign(node.style, {
      display: "block",
      top: rect.top + "px",
      left: rect.left + "px",
      width: rect.width + "px",
      height: rect.height + "px",
    });
  }

  function tick() {
    state.raf = 0;
    drawMarkers();

    if (state.target && !state.target.isConnected) clearTarget();

    if (!state.target) {
      highlight.style.display = "none";
      sectionBox.style.display = "none";
    } else {
      place(highlight, state.target.getBoundingClientRect());
      const r = state.target.getBoundingClientRect();
      if (state.selected) highlight.setAttribute("data-selected", "");
      else highlight.removeAttribute("data-selected");
      hlLabel.textContent = shortLabel(state.target);
      if (r.top < 24) hlLabel.setAttribute("data-below", "");
      else hlLabel.removeAttribute("data-below");

      // WHY: an outline on a 40px button says nothing about which part of the
      // page it belongs to. Showing the enclosing section at the same time is
      // what makes it obvious what a queued note actually refers to.
      const sec = sectionEl(state.target);
      if (sec) {
        place(sectionBox, sec.getBoundingClientRect());
        // The label needs a fiber walk, so only recompute it when the section
        // actually changes rather than on every frame.
        if (sec !== state.secEl) {
          state.secEl = sec;
          sectionLabel.textContent = sectionLabelFor(sec);
        }
      } else {
        state.secEl = null;
        sectionBox.style.display = "none";
      }
    }
    schedule();
  }

  function drawMarkers() {
    const live = state.queue.filter((e) => e.el && e.el.isConnected);
    while (markers.children.length > live.length) markers.lastChild.remove();
    while (markers.children.length < live.length) {
      const box = el("div", "mk");
      box.appendChild(el("span", "mk-n"));
      markers.appendChild(box);
    }
    live.forEach((entry, i) => {
      const box = markers.children[i];
      place(box, entry.el.getBoundingClientRect());
      box.firstChild.textContent = String(state.queue.indexOf(entry) + 1);
    });
  }

  function schedule() {
    if (!state.raf && (state.active || state.selected || state.queue.length)) {
      state.raf = requestAnimationFrame(tick);
    }
  }

  function setTarget(node) {
    state.target = node;
    schedule();
  }

  function clearTarget() {
    state.target = null;
    highlight.style.display = "none";
    sectionBox.style.display = "none";
    // The loop keeps running when there are still queued markers to position.
    if (state.raf) {
      cancelAnimationFrame(state.raf);
      state.raf = 0;
    }
    schedule();
  }

  /* ---- mode ---- */

  function setActive(on) {
    state.active = on;
    document.body.style.cursor = on ? "crosshair" : "";
    toggle.textContent = on ? "Click an element · Esc" : "Inspect + comment";
    if (on) toggle.setAttribute("data-active", "");
    else toggle.removeAttribute("data-active");
    toggle.setAttribute("aria-pressed", String(on));
    if (on) closePanel({ keepQueue: true });
    else if (!state.selected) clearTarget();
    schedule();
  }

  function isOurs(node) {
    return !node || node === host || host.contains(node) || (node.closest && node.closest(`[${HOST_ATTR}]`));
  }

  /* ---- events ---- */

  // rAF-throttled: pointermove fires far faster than the screen refreshes, and
  // the previous version did a full state update on every event.
  function onMove(e) {
    if (!state.active) return;
    state.pending = e;
    if (state.pending && !state.moveRaf) {
      state.moveRaf = requestAnimationFrame(() => {
        state.moveRaf = 0;
        const ev = state.pending;
        state.pending = null;
        if (!ev || !state.active) return;
        const node = document.elementFromPoint(ev.clientX, ev.clientY);
        if (isOurs(node)) return;
        if (node) setTarget(node);
      });
    }
  }

  function onClick(e) {
    if (isOurs(e.target)) return;

    // Alt+click selects straight away, without arming inspect mode first. It is
    // the fastest path when you already know the one thing you want to note.
    if (e.altKey && !state.active) {
      const node = document.elementFromPoint(e.clientX, e.clientY);
      if (node && !isOurs(node)) {
        e.preventDefault();
        e.stopPropagation();
        select(node);
        return;
      }
    }

    // Swallow page clicks while the comment panel is open so a stray click on a
    // link cannot navigate away and take an unsent comment with it.
    if (state.selected || state.queueOpen) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    if (!state.active) return;

    const node = document.elementFromPoint(e.clientX, e.clientY);
    if (isOurs(node) || !node) return;
    e.preventDefault();
    e.stopPropagation();
    select(node);
  }

  function onKey(e) {
    // Alt+<hotkey> toggles inspect mode from anywhere, including mid-typing.
    if (e.altKey && e.code === opts.hotkey) {
      e.preventDefault();
      if (state.selected || state.queueOpen) closePanel();
      setActive(!state.active);
      return;
    }

    // WHY: elementFromPoint returns the topmost node, which is routinely an
    // inner <span> when the <button> was meant. Alt+arrows walk the tree.
    // Alt is required so the arrows still move the caret inside the textarea.
    if (e.altKey && state.target && (state.selected || state.active)) {
      const t = state.target;
      let next = null;
      if (e.key === "ArrowUp") next = t.parentElement;
      else if (e.key === "ArrowDown") next = t.firstElementChild;
      else if (e.key === "ArrowLeft") next = t.previousElementSibling;
      else if (e.key === "ArrowRight") next = t.nextElementSibling;
      if (next && !isOurs(next) && next !== document.documentElement) {
        e.preventDefault();
        if (state.selected) select(next, { keepComment: true });
        else setTarget(next);
        return;
      }
    }

    if (e.key === "Escape") {
      if (state.selected || state.queueOpen) closePanel();
      else if (state.active) setActive(false);
    }
  }

  /* ---- selection + panel ---- */

  function select(node, { keepComment = false } = {}) {
    const carried = keepComment && textarea ? textarea.value : "";
    state.selected = true;
    state.active = false;
    state.queueOpen = false;
    document.body.style.cursor = "";
    toggle.textContent = "Inspect + comment";
    toggle.removeAttribute("data-active");
    setTarget(node);
    openPanel(carried);
  }

  function ancestors(node, limit = 4) {
    const chain = [];
    let n = node;
    while (n && n !== document.body && chain.length < limit) {
      chain.unshift(n);
      n = n.parentElement;
    }
    return chain;
  }

  function openPanel(initialComment = "") {
    destroyPanel();
    const d = describe(state.target);
    const cs = getComputedStyle(state.target);

    panel = el("div", "panel");
    positionPanel();

    const head = el("div", "eyebrow");
    head.textContent = "Selected element";

    const crumbs = el("div", "crumbs");
    for (const node of ancestors(state.target)) {
      const b = el("button", "crumb");
      b.type = "button";
      b.textContent = shortLabel(node);
      if (node === state.target) b.setAttribute("data-current", "");
      b.addEventListener("click", () => select(node, { keepComment: true }));
      crumbs.appendChild(b);
    }

    const desc = el("div", "desc");
    const lines = [];
    if (d.component) lines.push("Component: " + d.component);
    if (d.source) lines.push("Source: " + d.source);
    lines.push("Element: " + d.element);
    if (d.section) lines.push("Section: " + d.section);
    if (d.text) lines.push('Text: "' + d.text + '"');
    lines.push("Selector: " + d.selector + (d.selectorUnique ? "" : "  (not unique)"));
    lines.push("Box: " + d.box);
    if (d.a11y) lines.push("A11y: " + d.a11y);
    desc.textContent = lines.join("\n");

    textarea = document.createElement("textarea");
    textarea.rows = 3;
    textarea.value = initialComment;
    textarea.placeholder = "What should change?";
    const submit = () => add(d, { changes: readTweaks(baseline) });
    textarea.addEventListener("keydown", (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        submit();
      }
    });

    // Live CSS editing: type a value, the page updates as you type, and the
    // before/after pair rides along on the note. The agent then implements a
    // number instead of interpreting "a bit smaller".
    const baseline = {};
    tweakInputs = {};
    const tweaks = el("div", "tweaks");
    if (state.tweakOpen) tweaks.setAttribute("data-open", "");
    for (const [prop, label] of TWEAKABLE) {
      const wrap = el("div", "tw");
      const lab = document.createElement("label");
      lab.textContent = label;
      const input = document.createElement("input");
      const isColour = prop === "color" || prop === "backgroundColor";
      // A fully transparent background reads as "rgba(0, 0, 0, 0)", which is
      // noise in an input. Blank is both truer and easier to type over.
      const parsed = isColour ? parseRgb(cs[prop]) : null;
      baseline[prop] = parsed && parsed.a === 0 ? "" : isColour ? toHex(cs[prop]) : cs[prop];
      input.value = baseline[prop];
      input.spellcheck = false;
      input.addEventListener("input", () => {
        const value = input.value.trim();
        const changed = value !== baseline[prop];
        if (changed) input.setAttribute("data-changed", "");
        else input.removeAttribute("data-changed");
        applyTweak(prop, changed ? value : "");
      });
      wrap.append(lab, input);
      tweaks.appendChild(wrap);
      tweakInputs[prop] = input;
    }

    const row = el("div", "row");
    const addBtn = el("button", "primary");
    addBtn.type = "button";
    // The dock chip already carries the count; repeating it here just wraps.
    addBtn.textContent = "Add ⌘⏎";
    addBtn.addEventListener("click", submit);

    const tweakBtn = el("button", "tweak-toggle");
    tweakBtn.type = "button";
    tweakBtn.textContent = "CSS";
    tweakBtn.setAttribute("aria-expanded", String(state.tweakOpen));
    if (state.tweakOpen) tweakBtn.setAttribute("data-open", "");
    tweakBtn.addEventListener("click", () => {
      state.tweakOpen = !state.tweakOpen;
      for (const [node, attr] of [[tweaks, "data-open"], [tweakBtn, "data-open"]]) {
        if (state.tweakOpen) node.setAttribute(attr, "");
        else node.removeAttribute(attr);
      }
      tweakBtn.setAttribute("aria-expanded", String(state.tweakOpen));
    });

    const copyBtn = el("button", "ghost");
    copyBtn.type = "button";
    copyBtn.textContent = "Copy";
    copyBtn.addEventListener("click", () => {
      add(d, { silent: true, changes: readTweaks(baseline) });
      copyAll();
    });

    const cancel = el("button", "ghost");
    cancel.type = "button";
    cancel.textContent = "Esc";
    cancel.addEventListener("click", () => closePanel());

    row.append(addBtn, tweakBtn, copyBtn, cancel);

    const hint = el("div", "hint");
    hint.textContent = "Alt+click select · Alt+↑↓←→ walk · Alt+C toggle";

    panel.append(head, crumbs, desc, textarea, tweaks, row, hint);
    ui.appendChild(panel);
    textarea.focus();
    placeToast();
    updateCount();
  }

  // Keep the panel clear of the dock rather than stacking on top of it.
  function positionPanel() {
    const r = dock.getBoundingClientRect();
    const below = r.top < window.innerHeight / 2;
    panel.style.right = Math.max(16, window.innerWidth - r.right) + "px";
    if (below) panel.style.top = r.bottom + 10 + "px";
    else panel.style.bottom = window.innerHeight - r.top + 10 + "px";
  }

  function destroyPanel() {
    if (panel) {
      panel.remove();
      panel = null;
    }
    textarea = null;
  }

  function closePanel({ keepQueue = true } = {}) {
    destroyPanel();
    state.selected = false;
    state.queueOpen = false;
    if (!state.active) clearTarget();
    if (!keepQueue) state.queue = [];
    updateCount();
  }

  /* ---- queue ---- */

  function add(descriptor, { silent = false, changes = [] } = {}) {
    const comment = textarea ? textarea.value.trim() : "";
    state.queue.push({ descriptor, comment, changes, el: state.target });
    saveQueue();
    destroyPanel();
    state.selected = false;
    clearTarget();
    updateCount();
    if (silent) return;
    // Straight back into inspect mode: the point of a queue is not having to
    // reach for the toggle between every note.
    setActive(true);
    toast(`Queued ${state.queue.length}`);
  }

  function removeAt(i) {
    state.queue.splice(i, 1);
    saveQueue();
    updateCount();
    if (state.queue.length) openQueue();
    else closePanel();
  }

  function updateCount() {
    const n = state.queue.length;
    // Every queue mutation funnels through here, so this is where the markers
    // get reconciled (including down to zero, when the loop has stopped).
    drawMarkers();
    schedule();
    countBtn.style.display = n ? "" : "none";
    countBtn.textContent = state.queueOpen ? `${n} ×` : `${n} ▴`;
    countBtn.setAttribute("aria-label", `${n} queued comment${n === 1 ? "" : "s"}`);
  }

  function openQueue() {
    destroyPanel();
    state.selected = false;
    state.queueOpen = true;
    clearTarget();

    panel = el("div", "panel");
    positionPanel();

    const head = el("div", "eyebrow");
    head.textContent = `Queued · ${state.queue.length}`;

    const list = el("div", "queue");
    state.queue.forEach((entry, i) => {
      const item = el("div", "item");
      const n = el("span", "item-n");
      n.textContent = String(i + 1);
      const body = el("div", "item-body");
      const title = el("div", "item-title");
      title.textContent = entry.descriptor.component || entry.descriptor.element;
      body.appendChild(title);
      if (entry.comment) {
        const note = el("div", "item-note");
        note.textContent = entry.comment;
        body.appendChild(note);
      }
      const del = el("button", "item-del");
      del.type = "button";
      del.textContent = "×";
      del.setAttribute("aria-label", `Remove item ${i + 1}`);
      del.addEventListener("click", () => removeAt(i));
      item.append(n, body, del);
      list.appendChild(item);
    });

    const row = el("div", "row");
    const copyBtn = el("button", "primary");
    copyBtn.type = "button";
    copyBtn.textContent = "Copy all";
    copyBtn.addEventListener("click", copyAll);

    const clear = el("button", "ghost");
    clear.type = "button";
    clear.textContent = "Clear";
    clear.addEventListener("click", () => {
      state.queue = [];
      saveQueue();
      closePanel();
      toast("Queue cleared");
    });

    row.append(copyBtn, clear);
    panel.append(head, list, row);
    ui.appendChild(panel);
    placeToast();
    updateCount();
  }

  async function copyAll() {
    if (!state.queue.length) {
      toast("Nothing queued");
      return;
    }
    const n = state.queue.length;
    const tweaked = state.originalStyle.size;
    const ok = await writeClipboard(toMarkdown(state.queue));
    if (ok) {
      state.queue = [];
      // The review is handed off, so put the page back the way it was; the
      // edits live on in the markdown as before/after pairs.
      resetStyles();
      saveQueue();
      closePanel();
      toast(`Copied ${n} note${n === 1 ? "" : "s"}${tweaked ? " · styles reset" : ""}`);
    } else {
      toast("Copy failed (clipboard blocked)");
    }
  }

  /* ---- toast ---- */

  let toastTimer = 0;

  // Stack above the panel when one is open, rather than landing on top of it.
  // Called again when a panel opens, because a toast raised a moment earlier
  // (queueing re-opens inspect mode) would otherwise sit under the new panel.
  function placeToast() {
    const t = ui.querySelector(".toast");
    if (!t) return;
    const anchor = (panel || dock).getBoundingClientRect();
    t.style.right = Math.max(16, window.innerWidth - anchor.right) + "px";
    t.style.bottom = window.innerHeight - anchor.top + 10 + "px";
  }

  function toast(msg) {
    const existing = ui.querySelector(".toast");
    if (existing) existing.remove();
    const t = el("div", "toast");
    t.textContent = msg;
    ui.appendChild(t);
    placeToast();
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.remove(), 2000);
  }

  /* ---- lifecycle ---- */

  const onResize = () => applyPos(loadPos());

  window.addEventListener("pointermove", onMove, true);
  window.addEventListener("click", onClick, true);
  window.addEventListener("keydown", onKey, true);
  window.addEventListener("resize", onResize);

  if (opts.capture) startCapture();
  state.queue = loadQueue();
  setActive(false);
  updateCount();

  // WHY: build() used to run at import time and append straight to document.body,
  // which is null when the script is loaded from <head> without defer.
  function attach() {
    if (!host.isConnected) document.body.appendChild(host);
  }
  if (document.body) attach();
  else document.addEventListener("DOMContentLoaded", attach, { once: true });

  return {
    /** Merge new options; colours apply immediately. */
    config(next = {}) {
      merge(opts, next);
      shadow.host.style.setProperty("--accent", opts.accent);
      shadow.host.style.setProperty("--select", opts.select);
      ui.style.setProperty("--accent", opts.accent);
      ui.style.setProperty("--select", opts.select);
    },
    /** Current queue, as plain serialisable objects (live nodes stripped). */
    get queue() {
      return plainQueue();
    },
    /** Captured console errors, warnings and failed requests. */
    get logs() {
      return logs.slice();
    },
    /** Markdown for whatever is queued right now. */
    markdown() {
      return toMarkdown(state.queue);
    },
    /** Revert every live CSS edit without touching the queue. */
    resetStyles,
    destroy() {
      window.removeEventListener("pointermove", onMove, true);
      window.removeEventListener("click", onClick, true);
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("resize", onResize);
      if (state.raf) cancelAnimationFrame(state.raf);
      if (state.moveRaf) cancelAnimationFrame(state.moveRaf);
      clearTimeout(toastTimer);
      resetStyles();
      if (logRestore) logRestore();
      const exposed = document.getElementById(EXPOSE_ID);
      if (exposed) exposed.remove();
      document.body.style.cursor = "";
      host.remove();
      if (window.__inspectComment === this) delete window.__inspectComment;
      if (window.InspectComment === this) delete window.InspectComment;
    },
  };
}

/* ------------------------------------------------------------------ *
 * Singleton entry point
 * ------------------------------------------------------------------ */

let api = null;

/** Mount the inspector once. Repeat calls return the existing instance. */
export function mount(options) {
  if (typeof window === "undefined") return null;
  if (window.__inspectComment) return window.__inspectComment;
  api = createInspector(options);
  window.__inspectComment = api;
  window.InspectComment = api;
  return api;
}

/** Remove the mounted inspector, if there is one. */
export function unmount() {
  const current = typeof window !== "undefined" ? window.__inspectComment : null;
  if (current) current.destroy();
  api = null;
}

export { toMarkdown, describe };
