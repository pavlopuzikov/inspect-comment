/*!
 * inspect-comment — a dev-only, framework-agnostic element inspector + comment tool.
 * Hover to highlight, click to select, type a comment, Copy. It copies a precise
 * descriptor (page, tag, section, text, CSS selector) + your comment, so you can
 * paste one block that says exactly which element you mean and what to change.
 *
 * Drop-in usage (any site):
 *   <script src="inspect-comment.js"></script>
 * or paste this whole file into the browser console. Nothing is bundled; no deps.
 * Call InspectComment.destroy() to remove it.
 */
(function () {
  "use strict";
  if (window.__inspectComment) return; // idempotent

  var ACCENT = "#3a4a5c"; // hover outline (override via InspectComment.config)
  var SELECT = "#c23a12"; // selected outline
  var INK = "#161512";
  var PAPER = "#f6f5f1";
  var MONO = "11px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace";

  var state = { active: false, selected: null, hoverEl: null };
  var root, highlight, hlLabel, panel, toggle, textarea;

  function cssPath(el) {
    var parts = [], node = el, depth = 0;
    while (node && node.nodeType === 1 && depth < 6) {
      if (node.id) { parts.unshift("#" + node.id); break; }
      var sel = node.tagName.toLowerCase();
      var parent = node.parentElement;
      if (parent) {
        var same = Array.prototype.filter.call(parent.children, function (c) { return c.tagName === node.tagName; });
        if (same.length > 1) sel += ":nth-of-type(" + (same.indexOf(node) + 1) + ")";
      }
      parts.unshift(sel);
      node = node.parentElement;
      depth++;
    }
    return parts.join(" > ");
  }

  function describe(el) {
    var tag = el.tagName.toLowerCase();
    var id = el.id ? "#" + el.id : "";
    var cls = Array.prototype.slice.call(el.classList, 0, 4).map(function (c) { return "." + c; }).join("");
    var ctxEl = el.closest("section[id], [data-component], main[id], [aria-labelledby], header, footer, nav");
    var ctx = ctxEl ? (ctxEl.id ? "#" + ctxEl.id : (ctxEl.getAttribute("data-component") || ctxEl.tagName.toLowerCase())) : "—";
    var text = (el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 100);
    return [
      "Page: " + location.pathname,
      "Element: <" + tag + ">" + id + cls,
      "Section: " + ctx,
      'Text: "' + text + '"',
      "Selector: " + cssPath(el),
    ].join("\n");
  }

  function labelFor(el) { return "<" + el.tagName.toLowerCase() + ">" + (el.id ? "#" + el.id : ""); }

  function box(styles) { var d = document.createElement("div"); Object.assign(d.style, styles); return d; }

  function build() {
    root = box({ all: "initial" });
    root.setAttribute("data-inspector", "");

    highlight = box({ position: "fixed", pointerEvents: "none", zIndex: 2147483000, display: "none", boxSizing: "border-box" });
    hlLabel = box({ position: "absolute", top: "-22px", left: "0", background: INK, color: PAPER, font: MONO, padding: "4px 6px", borderRadius: "4px", whiteSpace: "nowrap" });
    highlight.appendChild(hlLabel);

    toggle = document.createElement("button");
    toggle.type = "button";
    Object.assign(toggle.style, {
      position: "fixed", zIndex: 2147483001, bottom: "16px", right: "16px",
      background: INK, color: PAPER, font: MONO, letterSpacing: "0.08em", textTransform: "uppercase",
      padding: "9px 12px", borderRadius: "999px", border: "none", cursor: "pointer",
      boxShadow: "0 6px 20px rgba(0,0,0,0.25)",
    });
    toggle.textContent = "Inspect + comment";
    toggle.addEventListener("click", function () { setActive(!state.active); });

    root.appendChild(highlight);
    root.appendChild(toggle);
    document.body.appendChild(root);
  }

  function setActive(on) {
    state.active = on;
    document.body.style.cursor = on ? "crosshair" : "";
    toggle.style.background = on ? ACCENT : INK;
    toggle.textContent = on ? "Click an element · Esc" : "Inspect + comment";
    if (!on) hideHighlight();
  }

  function showHighlight(el, selected) {
    var r = el.getBoundingClientRect();
    Object.assign(highlight.style, {
      display: "block", top: r.top + "px", left: r.left + "px", width: r.width + "px", height: r.height + "px",
      outline: "2px solid " + (selected ? SELECT : ACCENT),
      background: selected ? "rgba(194,58,18,0.08)" : "rgba(58,74,92,0.12)",
    });
    hlLabel.textContent = labelFor(el);
  }
  function hideHighlight() { highlight.style.display = "none"; }

  function onMove(e) {
    if (!state.active) return;
    var el = document.elementFromPoint(e.clientX, e.clientY);
    if (!el || el.closest("[data-inspector]")) { hideHighlight(); return; }
    state.hoverEl = el;
    showHighlight(el, false);
  }

  function onClick(e) {
    if (!state.active) return;
    var el = document.elementFromPoint(e.clientX, e.clientY);
    if (!el || el.closest("[data-inspector]")) return;
    e.preventDefault(); e.stopPropagation();
    state.selected = { el: el, descriptor: describe(el) };
    setActive(false);
    showHighlight(el, true);
    openPanel();
  }

  function onKey(e) { if (e.key === "Escape") { if (state.selected) closePanel(); else setActive(false); } }

  function openPanel() {
    closePanel();
    panel = box({
      position: "fixed", zIndex: 2147483002, bottom: "16px", right: "16px", width: "320px",
      background: INK, color: PAPER, borderRadius: "12px", padding: "14px",
      boxShadow: "0 12px 40px rgba(0,0,0,0.4)", font: "12px/1.4 ui-monospace, monospace", boxSizing: "border-box",
    });
    var head = box({ fontSize: "10px", letterSpacing: "0.14em", textTransform: "uppercase", color: "#918a7c", marginBottom: "8px" });
    head.textContent = "Selected element";
    var desc = box({ whiteSpace: "pre-wrap", color: "#b4ada0", fontSize: "11px", marginBottom: "10px", maxHeight: "96px", overflow: "auto" });
    desc.textContent = state.selected.descriptor;

    textarea = document.createElement("textarea");
    textarea.rows = 3;
    textarea.placeholder = "Add a comment (what should change?)…";
    Object.assign(textarea.style, { width: "100%", boxSizing: "border-box", resize: "vertical", background: "#0f0e0d", color: PAPER, border: "1px solid #33322f", borderRadius: "8px", padding: "8px 10px", font: "12px/1.4 ui-monospace, monospace", outline: "none" });
    textarea.addEventListener("keydown", function (e) { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") copy(); });

    var row = box({ display: "flex", gap: "8px", marginTop: "10px" });
    var copyBtn = document.createElement("button");
    copyBtn.type = "button"; copyBtn.textContent = "Copy ⌘⏎";
    Object.assign(copyBtn.style, { flex: "1", background: ACCENT, color: PAPER, border: "none", borderRadius: "8px", padding: "9px 10px", font: "11px/1 ui-monospace, monospace", textTransform: "uppercase", letterSpacing: "0.08em", cursor: "pointer" });
    copyBtn.addEventListener("click", copy);
    var cancel = document.createElement("button");
    cancel.type = "button"; cancel.textContent = "Cancel";
    Object.assign(cancel.style, { background: "transparent", color: "#918a7c", border: "1px solid #33322f", borderRadius: "8px", padding: "9px 12px", font: "11px/1 ui-monospace, monospace", textTransform: "uppercase", letterSpacing: "0.08em", cursor: "pointer" });
    cancel.addEventListener("click", closePanel);
    row.appendChild(copyBtn); row.appendChild(cancel);

    panel.appendChild(head); panel.appendChild(desc); panel.appendChild(textarea); panel.appendChild(row);
    root.appendChild(panel);
    toggle.style.display = "none";
    textarea.focus();
  }

  function closePanel() {
    if (panel) { panel.remove(); panel = null; }
    state.selected = null;
    hideHighlight();
    toggle.style.display = "";
  }

  function toast(msg) {
    var t = box({ position: "fixed", zIndex: 2147483003, bottom: "16px", right: "16px", background: INK, color: PAPER, font: "12px/1.2 ui-monospace, monospace", padding: "10px 12px", borderRadius: "8px", boxShadow: "0 6px 20px rgba(0,0,0,0.25)" });
    t.textContent = msg; root.appendChild(t);
    setTimeout(function () { t.remove(); }, 2200);
  }

  function copy() {
    if (!state.selected) return;
    var c = textarea.value.trim();
    var block = c ? state.selected.descriptor + "\n\nComment: " + c : state.selected.descriptor;
    var done = function (ok) { toast(ok ? "Copied element + comment" : "Copy failed (clipboard blocked)"); closePanel(); };
    if (navigator.clipboard) navigator.clipboard.writeText(block).then(function () { done(true); }, function () { fallbackCopy(block, done); });
    else fallbackCopy(block, done);
  }

  function fallbackCopy(text, done) {
    try {
      var ta = document.createElement("textarea"); ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select(); var ok = document.execCommand("copy"); ta.remove(); done(ok);
    } catch (e) { done(false); }
  }

  window.addEventListener("pointermove", onMove, true);
  window.addEventListener("click", onClick, true);
  window.addEventListener("keydown", onKey, true);

  build();

  window.__inspectComment = {
    config: function (opts) { if (opts && opts.accent) ACCENT = opts.accent; if (opts && opts.select) SELECT = opts.select; },
    destroy: function () {
      window.removeEventListener("pointermove", onMove, true);
      window.removeEventListener("click", onClick, true);
      window.removeEventListener("keydown", onKey, true);
      document.body.style.cursor = "";
      if (root) root.remove();
      delete window.__inspectComment;
    },
  };
  // Convenience alias
  window.InspectComment = window.__inspectComment;
})();
