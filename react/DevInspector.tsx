"use client";

// DEV-ONLY element inspector. Toggle on -> hover to highlight -> click to
// SELECT an element -> type a comment -> Copy. It copies a precise descriptor
// (route, tag, section, text, CSS selector) together with your comment, so you
// can paste one block that says exactly which element you mean and what to do.
// Gated to non-production in layout.tsx so it never ships.

import { useCallback, useEffect, useRef, useState } from "react";

type Sel = { descriptor: string; rect: DOMRect; label: string } | null;

function cssPath(el: Element): string {
  const parts: string[] = [];
  let node: Element | null = el;
  let depth = 0;
  while (node && node.nodeType === 1 && depth < 5) {
    if (node.id) { parts.unshift(`#${node.id}`); break; }
    let sel = node.tagName.toLowerCase();
    const parent = node.parentElement;
    if (parent) {
      const sameTag = Array.from(parent.children).filter((c) => c.tagName === node!.tagName);
      if (sameTag.length > 1) sel += `:nth-of-type(${sameTag.indexOf(node) + 1})`;
    }
    parts.unshift(sel);
    node = node.parentElement;
    depth++;
  }
  return parts.join(" > ");
}

function describe(el: Element): string {
  const tag = el.tagName.toLowerCase();
  const id = el.id ? `#${el.id}` : "";
  const cls = Array.from(el.classList).slice(0, 4).map((c) => `.${c}`).join("");
  const ctxEl = el.closest("section[id], [data-component], main[id], [aria-labelledby]");
  const ctx = ctxEl ? (ctxEl.id ? `#${ctxEl.id}` : ctxEl.getAttribute("data-component") || ctxEl.tagName.toLowerCase()) : "—";
  const text = (el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 100);
  return [
    `Page: ${location.pathname}`,
    `Element: <${tag}>${id}${cls}`,
    `Section: ${ctx}`,
    `Text: "${text}"`,
    `Selector: ${cssPath(el)}`,
  ].join("\n");
}

export function DevInspector() {
  const [active, setActive] = useState(false);
  const [hover, setHover] = useState<{ rect: DOMRect; label: string } | null>(null);
  const [selected, setSelected] = useState<Sel>(null);
  const [comment, setComment] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const clear = useCallback(() => { setActive(false); setHover(null); setSelected(null); setComment(""); }, []);

  // Hover + click-to-select, only while in inspect mode.
  useEffect(() => {
    if (!active) return;
    const onMove = (e: PointerEvent) => {
      const el = document.elementFromPoint(e.clientX, e.clientY);
      if (!el || el.closest("[data-inspector]")) { setHover(null); return; }
      setHover({ rect: el.getBoundingClientRect(), label: `<${el.tagName.toLowerCase()}>${el.id ? "#" + el.id : ""}` });
    };
    const onClick = (e: MouseEvent) => {
      const el = document.elementFromPoint(e.clientX, e.clientY);
      if (!el || el.closest("[data-inspector]")) return;
      e.preventDefault(); e.stopPropagation();
      setSelected({ descriptor: describe(el), rect: el.getBoundingClientRect(), label: `<${el.tagName.toLowerCase()}>${el.id ? "#" + el.id : ""}` });
      setActive(false); // stop hovering; open the comment panel
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { setActive(false); setHover(null); } };
    window.addEventListener("pointermove", onMove, true);
    window.addEventListener("click", onClick, true);
    window.addEventListener("keydown", onKey, true);
    document.body.style.cursor = "crosshair";
    return () => {
      window.removeEventListener("pointermove", onMove, true);
      window.removeEventListener("click", onClick, true);
      window.removeEventListener("keydown", onKey, true);
      document.body.style.cursor = "";
    };
  }, [active]);

  // Focus the comment box when an element is selected.
  useEffect(() => { if (selected) textareaRef.current?.focus(); }, [selected]);

  const copy = async () => {
    if (!selected) return;
    const block = comment.trim()
      ? `${selected.descriptor}\n\nComment: ${comment.trim()}`
      : selected.descriptor;
    try { await navigator.clipboard.writeText(block); setToast("Copied element + comment"); }
    catch { setToast("Copy failed (clipboard blocked)"); }
    setTimeout(() => setToast(null), 2200);
    clear();
  };

  const activeRect = selected?.rect ?? hover?.rect ?? null;
  const activeLabel = selected?.label ?? hover?.label ?? "";

  return (
    <div data-inspector>
      {/* Highlight (hover, or frozen on the selected element) */}
      {(active || selected) && activeRect && (
        <div style={{
          position: "fixed", pointerEvents: "none", zIndex: 2147483000,
          top: activeRect.top, left: activeRect.left, width: activeRect.width, height: activeRect.height,
          outline: `2px solid ${selected ? "#c23a12" : "#3a4a5c"}`, background: selected ? "rgba(194,58,18,0.08)" : "rgba(58,74,92,0.12)",
        }}>
          <span style={{ position: "absolute", top: -22, left: 0, background: "#161512", color: "#f6f5f1", font: "11px/1 ui-monospace, monospace", padding: "4px 6px", borderRadius: 4, whiteSpace: "nowrap" }}>{activeLabel}</span>
        </div>
      )}

      {/* Comment panel (after selecting) */}
      {selected && (
        <div style={{
          position: "fixed", zIndex: 2147483002, bottom: 16, right: 16, width: 320,
          background: "#161512", color: "#f6f5f1", borderRadius: 12, padding: 14,
          boxShadow: "0 12px 40px rgba(0,0,0,0.4)", font: "12px/1.4 ui-monospace, monospace",
        }}>
          <div style={{ fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: "#918a7c", marginBottom: 8 }}>Selected element</div>
          <div style={{ whiteSpace: "pre-wrap", color: "#b4ada0", fontSize: 11, marginBottom: 10, maxHeight: 96, overflow: "auto" }}>{selected.descriptor}</div>
          <textarea
            ref={textareaRef}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") copy(); }}
            placeholder="Add a comment (what should change?)…"
            rows={3}
            style={{ width: "100%", resize: "vertical", background: "#0f0e0d", color: "#f6f5f1", border: "1px solid #33322f", borderRadius: 8, padding: "8px 10px", font: "12px/1.4 ui-monospace, monospace", outline: "none" }}
          />
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button type="button" onClick={copy} style={{ flex: 1, background: "#3a4a5c", color: "#f6f5f1", border: "none", borderRadius: 8, padding: "9px 10px", font: "11px/1 ui-monospace, monospace", textTransform: "uppercase", letterSpacing: "0.08em", cursor: "pointer" }}>Copy ⌘⏎</button>
            <button type="button" onClick={clear} style={{ background: "transparent", color: "#918a7c", border: "1px solid #33322f", borderRadius: 8, padding: "9px 12px", font: "11px/1 ui-monospace, monospace", textTransform: "uppercase", letterSpacing: "0.08em", cursor: "pointer" }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Toggle */}
      {!selected && (
        <button
          type="button"
          onClick={() => setActive((v) => !v)}
          style={{
            position: "fixed", zIndex: 2147483001, bottom: 16, right: 16,
            display: "inline-flex", alignItems: "center", gap: 6,
            background: active ? "#3a4a5c" : "#161512", color: "#f6f5f1",
            font: "11px/1 ui-monospace, monospace", letterSpacing: "0.08em", textTransform: "uppercase",
            padding: "9px 12px", borderRadius: 999, border: "none", cursor: "pointer",
            boxShadow: "0 6px 20px rgba(0,0,0,0.25)",
          }}
          aria-pressed={active}
        >
          {active ? "Click an element · Esc" : "Inspect + comment"}
        </button>
      )}

      {/* Toast */}
      {toast && (
        <div style={{ position: "fixed", zIndex: 2147483002, bottom: 16, right: 16, background: "#161512", color: "#f6f5f1", font: "12px/1.2 ui-monospace, monospace", padding: "10px 12px", borderRadius: 8, boxShadow: "0 6px 20px rgba(0,0,0,0.25)" }}>{toast}</div>
      )}
    </div>
  );
}
