import { Fragment, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { format, addDays } from "date-fns";
import { X, ChevronLeft, ChevronRight, Lightbulb, Link2, Bookmark, Square, Search, Trash2, Plus } from "lucide-react";
import { CaptureItem, CaptureKind } from "@/types/event";
import { useCaptures, patchCapture, removeCapture, addCapture } from "@/lib/capture-store";
import { fetchLinkPreview } from "@/lib/link-preview";

// ─── Inline formatting renderer ───────────────────────────────────
function renderInline(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|_[^_]+_)/g);
  return parts.map((part, i) => {
    if (/^\*\*[^*]+\*\*$/.test(part)) return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (/^_[^_]+_$/.test(part)) return <em key={i}>{part.slice(1, -1)}</em>;
    return <Fragment key={i}>{part}</Fragment>;
  });
}

function renderFormatted(text: string) {
  const lines = text.split("\n");
  const result: React.ReactNode[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith("- ") || line === "-") {
      const bullets: string[] = [];
      while (i < lines.length && (lines[i].startsWith("- ") || lines[i] === "-")) {
        bullets.push(lines[i].startsWith("- ") ? lines[i].slice(2) : "");
        i++;
      }
      result.push(
        <ul key={`ul-${i}`} style={{ margin: "2px 0 2px 2px", paddingLeft: 14, listStyleType: "disc" }}>
          {bullets.map((b, j) => (
            <li key={j} style={{ lineHeight: 1.55, marginBottom: 1 }}>{renderInline(b)}</li>
          ))}
        </ul>
      );
    } else {
      result.push(<Fragment key={i}>{renderInline(line)}{i < lines.length - 1 && <br />}</Fragment>);
      i++;
    }
  }
  return result;
}

// ─── Per-kind styles ───────────────────────────────────────────────
const KIND_STYLES: Record<string, { bg: string; border: string; accent: string; iconBg: string; iconColor: string; label: string }> = {
  thought: { bg: "#FAF8F2", border: "#E2DFDA", accent: "#6B5E3A", iconBg: "#EDE9E0", iconColor: "#6B5E3A", label: "Thought" },
  link:    { bg: "#EEF3FC", border: "#C8D8F0", accent: "#2A4A80", iconBg: "#D8E8F8", iconColor: "#2A4A80", label: "Link" },
  ref:     { bg: "#FBF5EB", border: "#E8D8BC", accent: "#6B4A1A", iconBg: "#F0E0C0", iconColor: "#6B4A1A", label: "Ref" },
  task:    { bg: "#F2F8F2", border: "#C8DEC6", accent: "#2A5028", iconBg: "#E0F0DE", iconColor: "#2A5028", label: "Task" },
};

const KIND_ICONS: Record<string, React.ReactNode> = {
  thought: <Lightbulb size={12} strokeWidth={2} />,
  link:    <Link2    size={12} strokeWidth={2} />,
  ref:     <Bookmark size={12} strokeWidth={2} />,
  task:    <Square   size={12} strokeWidth={2} />,
};

type FilterKind = CaptureKind | "all";

// ─── Individual board card ─────────────────────────────────────────
function BoardCard({ item, onRemove }: { item: CaptureItem; onRemove: () => void }) {
  const s = KIND_STYLES[item.kind] ?? KIND_STYLES.thought;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item.title);
  const [noteDraft, setNoteDraft] = useState(item.note ?? "");
  const [noteOpen, setNoteOpen] = useState(!!item.note);
  const taRef = useRef<HTMLTextAreaElement>(null);

  function autoResize(el: HTMLTextAreaElement | null) {
    if (!el) return;
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  }

  function startEdit() {
    setDraft(item.title);
    setEditing(true);
    setTimeout(() => { const el = taRef.current; if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); autoResize(el); } }, 20);
  }

  function save() {
    const v = draft.trim();
    if (v && v !== item.title) patchCapture(item.id, { title: v });
    setEditing(false);
  }

  function saveNote() {
    patchCapture(item.id, { note: noteDraft.trim() || undefined });
  }

  // Link cards: trigger preview fetch if missing
  useEffect(() => {
    if (item.kind !== "link" || !item.url || item.ogTitle || item.ogLoading) return;
    patchCapture(item.id, { ogLoading: true });
    fetchLinkPreview(item.url).then(p => {
      patchCapture(item.id, { ogLoading: false, ogTitle: p.title, ogDescription: p.description, ogImage: p.image, ogSite: p.site });
    }).catch(() => patchCapture(item.id, { ogLoading: false }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id]);

  const displayTitle = item.kind === "link"
    ? (item.ogTitle ?? (item.title !== item.url ? item.title : null) ?? item.url ?? "")
    : item.title;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.92, y: -6 }}
      transition={{ duration: 0.1, ease: "easeOut" }}
      style={{
        background: s.bg,
        border: `1px solid ${s.border}`,
        borderRadius: 14,
        padding: "14px 16px",
        position: "relative",
        display: "flex",
        flexDirection: "column",
        gap: 8,
        cursor: "default",
      }}
    >
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <div style={{ width: 20, height: 20, borderRadius: 6, background: s.iconBg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: s.iconColor }}>
          {KIND_ICONS[item.kind]}
        </div>
        <span style={{ fontSize: 10, fontWeight: 600, color: s.accent, textTransform: "uppercase", letterSpacing: "0.07em", flex: 1 }}>{s.label}</span>
        <span style={{ fontSize: 10, color: "#B8B4AE" }}>
          {format(new Date(item.createdAt), "h:mm a").toLowerCase()}
        </span>
        <button type="button" onClick={onRemove}
          style={{ background: "none", border: "none", cursor: "pointer", padding: 2, color: "#D3D1C7", lineHeight: 0 }}
          onMouseEnter={e => { e.currentTarget.style.color = "#E05050"; }}
          onMouseLeave={e => { e.currentTarget.style.color = "#D3D1C7"; }}
        >
          <Trash2 size={11} />
        </button>
      </div>

      {/* Link OG image */}
      {item.kind === "link" && item.ogImage && (
        <img
          src={item.ogImage}
          alt=""
          style={{ width: "100%", borderRadius: 8, objectFit: "cover", maxHeight: 120, background: "#F0EDE8" }}
          onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
        />
      )}

      {/* Body */}
      {editing ? (
        <div>
          <div style={{ display: "flex", gap: 2, marginBottom: 5, padding: "2px 3px", background: "rgba(0,0,0,0.04)", borderRadius: 5 }}>
            {[
              { label: "B", style: { fontWeight: 700 }, action: () => wrapSel("**", "**", taRef, draft, setDraft) },
              { label: "I", style: { fontStyle: "italic" }, action: () => wrapSel("_", "_", taRef, draft, setDraft) },
              { label: "•", style: {}, action: () => toggleBullet(taRef, draft, setDraft) },
            ].map(btn => (
              <button key={btn.label} type="button"
                onMouseDown={e => { e.preventDefault(); btn.action(); }}
                style={{ width: 22, height: 22, borderRadius: 4, background: "transparent", border: "none", cursor: "pointer", fontSize: btn.label === "•" ? 14 : 11, color: s.accent, display: "flex", alignItems: "center", justifyContent: "center", ...btn.style, fontFamily: "'Lora',Georgia,serif" }}
                onMouseEnter={e => { e.currentTarget.style.background = "rgba(0,0,0,0.07)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
              >{btn.label}</button>
            ))}
            <span style={{ marginLeft: "auto", fontSize: 8, color: "#B8B4AE", alignSelf: "center" }}>⌘↵ save</span>
          </div>
          <textarea
            ref={el => { (taRef as React.MutableRefObject<HTMLTextAreaElement | null>).current = el; autoResize(el); }}
            value={draft}
            onChange={e => { setDraft(e.target.value); autoResize(e.target); }}
            onBlur={save}
            onKeyDown={e => {
              if ((e.metaKey || e.ctrlKey) && e.key === "b") { e.preventDefault(); wrapSel("**", "**", taRef, draft, setDraft); }
              if ((e.metaKey || e.ctrlKey) && e.key === "i") { e.preventDefault(); wrapSel("_", "_", taRef, draft, setDraft); }
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); save(); }
              if (e.key === "Escape") setEditing(false);
            }}
            style={{ width: "100%", boxSizing: "border-box", fontSize: 14, fontFamily: "'Lora',Georgia,serif", color: "#333", background: "transparent", border: "none", outline: "none", resize: "none", lineHeight: 1.6, padding: 0, overflow: "hidden" }}
          />
        </div>
      ) : (
        <div
          onClick={item.kind !== "link" ? startEdit : undefined}
          title={item.kind !== "link" ? "Click to edit" : undefined}
          style={{ fontSize: 14, fontFamily: "'Lora',Georgia,serif", color: "#333", lineHeight: 1.6, wordBreak: "break-word", cursor: item.kind !== "link" ? "text" : "default" }}
        >
          {item.kind === "link" ? (
            <>
              {item.ogLoading ? (
                <div style={{ height: 14, width: "65%", background: "#EDEBE7", borderRadius: 4, animation: "pulse 1.2s ease-in-out infinite" }} />
              ) : (
                <a href={item.url} target="_blank" rel="noopener noreferrer"
                  style={{ fontWeight: 600, color: s.accent, textDecoration: "none" }}
                  onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.textDecoration = "underline"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.textDecoration = "none"; }}
                >
                  {displayTitle}
                </a>
              )}
              {item.ogDescription && (
                <p style={{ fontSize: 12, color: "#888", marginTop: 3, lineHeight: 1.45 }}>{item.ogDescription}</p>
              )}
              {item.url && (
                <p style={{ fontSize: 10, color: "#AAA", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.url}</p>
              )}
            </>
          ) : renderFormatted(item.title)}
        </div>
      )}

      {/* Note section */}
      {noteOpen ? (
        <div style={{ borderTop: `1px solid ${s.border}`, paddingTop: 8, marginTop: 0 }}>
          <textarea
            value={noteDraft}
            onChange={e => setNoteDraft(e.target.value)}
            onBlur={saveNote}
            placeholder="Add a note…"
            rows={2}
            style={{ width: "100%", boxSizing: "border-box", fontSize: 12, fontFamily: "'Lora',Georgia,serif", color: "#555", background: "rgba(0,0,0,0.02)", border: `1px solid ${s.border}`, borderRadius: 6, padding: "5px 7px", resize: "none", outline: "none", lineHeight: 1.5 }}
          />
        </div>
      ) : (
        <button type="button"
          onClick={() => setNoteOpen(true)}
          style={{ alignSelf: "flex-start", fontSize: 10, color: "#B8B4AE", background: "none", border: "none", cursor: "pointer", padding: 0, letterSpacing: "0.03em" }}
          onMouseEnter={e => { e.currentTarget.style.color = s.accent; }}
          onMouseLeave={e => { e.currentTarget.style.color = "#B8B4AE"; }}
        >
          {item.note ? `✎ note` : `+ note`}
        </button>
      )}
    </motion.div>
  );
}

// ─── Formatting helpers shared with toolbar ────────────────────────
function wrapSel(
  before: string, after: string,
  ref: React.RefObject<HTMLTextAreaElement | null>,
  value: string, setValue: (v: string) => void,
) {
  const ta = ref.current;
  if (!ta) return;
  const s = ta.selectionStart, e = ta.selectionEnd;
  const sel = value.slice(s, e);
  const next = value.slice(0, s) + before + sel + after + value.slice(e);
  setValue(next);
  requestAnimationFrame(() => { ta.focus(); ta.setSelectionRange(s + before.length, e + before.length); });
}

function toggleBullet(ref: React.RefObject<HTMLTextAreaElement | null>, value: string, setValue: (v: string) => void) {
  const ta = ref.current;
  if (!ta) return;
  const pos = ta.selectionStart;
  const lineStart = value.lastIndexOf("\n", pos - 1) + 1;
  const lineEnd = value.indexOf("\n", pos);
  const end = lineEnd === -1 ? value.length : lineEnd;
  const line = value.slice(lineStart, end);
  let next: string, caret: number;
  if (line.startsWith("- ")) {
    next = value.slice(0, lineStart) + line.slice(2) + value.slice(end);
    caret = Math.max(lineStart, pos - 2);
  } else {
    next = value.slice(0, lineStart) + "- " + line + value.slice(end);
    caret = pos + 2;
  }
  setValue(next);
  requestAnimationFrame(() => { ta.focus(); ta.setSelectionRange(caret, caret); });
}

// ─── Quick-add composer card ───────────────────────────────────────
const ADD_KINDS: { id: CaptureKind; label: string; icon: React.ReactNode }[] = [
  { id: "thought", label: "Thought", icon: <Lightbulb size={12} strokeWidth={2} /> },
  { id: "task",    label: "Task",    icon: <Square    size={12} strokeWidth={2} /> },
  { id: "link",    label: "Link",    icon: <Link2     size={12} strokeWidth={2} /> },
  { id: "ref",     label: "Ref",     icon: <Bookmark  size={12} strokeWidth={2} /> },
];

function QuickAddCard({ dayKey, onDone }: { dayKey: string; onDone?: () => void }) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<CaptureKind>("thought");
  const [text, setText] = useState("");
  const [url, setUrl]   = useState("");
  const taRef = useRef<HTMLTextAreaElement>(null);

  const s = KIND_STYLES[kind] ?? KIND_STYLES.thought;

  function open_() {
    setOpen(true);
    setTimeout(() => taRef.current?.focus(), 40);
  }

  function cancel() {
    setOpen(false);
    setText("");
    setUrl("");
    setKind("thought");
  }

  function submit() {
    const title = text.trim() || (kind === "link" ? url.trim() : "");
    if (!title && !(kind === "link" && url.trim())) return;
    addCapture({ kind, title: title || url.trim(), url: kind === "link" ? url.trim() || undefined : undefined, dayKey });
    setText("");
    setUrl("");
    setKind("thought");
    taRef.current?.focus();
    onDone?.();
  }

  if (!open) {
    return (
      <motion.button
        layout
        type="button"
        onClick={open_}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "14px 16px",
          background: "#F7F5F0",
          border: "1.5px dashed #D8D4CE",
          borderRadius: 14,
          cursor: "pointer",
          color: "#A8A4A0",
          fontSize: 13,
          fontFamily: "'Lora',Georgia,serif",
          width: "100%",
          transition: "border-color 0.15s, color 0.15s",
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = "#3C3489"; e.currentTarget.style.color = "#3C3489"; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = "#D8D4CE"; e.currentTarget.style.color = "#A8A4A0"; }}
      >
        <div style={{ width: 24, height: 24, borderRadius: 8, background: "#EDEAE4", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Plus size={13} color="#3C3489" />
        </div>
        Add a capture…
      </motion.button>
    );
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      style={{
        background: s.bg,
        border: `1.5px solid ${s.border}`,
        borderRadius: 14,
        padding: "14px 16px",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      {/* Kind selector */}
      <div style={{ display: "flex", gap: 4 }}>
        {ADD_KINDS.map(k => {
          const active = k.id === kind;
          const ks = KIND_STYLES[k.id];
          return (
            <button
              key={k.id}
              type="button"
              onClick={() => setKind(k.id)}
              style={{
                display: "flex", alignItems: "center", gap: 4,
                fontSize: 10, fontWeight: active ? 700 : 500,
                padding: "3px 8px", borderRadius: 20,
                background: active ? ks.iconBg : "transparent",
                color: active ? ks.accent : "#B0ACA8",
                border: `1px solid ${active ? ks.border : "transparent"}`,
                cursor: "pointer", transition: "all 0.12s",
              }}
            >
              <span style={{ color: active ? ks.iconColor : "#C0BDB9" }}>{k.icon}</span>
              {k.label}
            </button>
          );
        })}
      </div>

      {/* URL field for links */}
      {kind === "link" && (
        <input
          value={url}
          onChange={e => setUrl(e.target.value)}
          placeholder="Paste URL…"
          autoFocus
          style={{
            fontSize: 12, padding: "6px 9px",
            background: "rgba(0,0,0,0.03)",
            border: `1px solid ${s.border}`,
            borderRadius: 7, outline: "none",
            color: "#444", fontFamily: "'Lora',Georgia,serif",
            width: "100%", boxSizing: "border-box",
          }}
          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); taRef.current?.focus(); } if (e.key === "Escape") cancel(); }}
        />
      )}

      {/* Text / title area */}
      <textarea
        ref={taRef}
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder={kind === "link" ? "Title or description (optional)…" : kind === "task" ? "What needs doing?" : "What's on your mind?"}
        rows={3}
        style={{
          fontSize: 14, padding: "6px 9px",
          background: "rgba(0,0,0,0.02)",
          border: `1px solid ${s.border}`,
          borderRadius: 7, outline: "none",
          color: "#333", fontFamily: "'Lora',Georgia,serif",
          lineHeight: 1.55, resize: "none",
          width: "100%", boxSizing: "border-box",
        }}
        onKeyDown={e => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); submit(); }
          if (e.key === "Escape") cancel();
        }}
      />

      {/* Actions */}
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <button
          type="button"
          onClick={submit}
          style={{
            fontSize: 12, fontWeight: 600, padding: "5px 14px",
            background: "#3C3489", color: "#fff", border: "none",
            borderRadius: 20, cursor: "pointer",
          }}
        >
          Add
        </button>
        <button
          type="button"
          onClick={cancel}
          style={{ fontSize: 11, color: "#A8A4A0", background: "none", border: "none", cursor: "pointer", padding: "5px 4px" }}
        >
          Cancel
        </button>
        <span style={{ marginLeft: "auto", fontSize: 10, color: "#C0BDB9" }}>⌘↵ to add</span>
      </div>
    </motion.div>
  );
}

// ─── Main DayBoard overlay ─────────────────────────────────────────
export function DayBoard({ date, onClose, onNavigate }: {
  date: Date;
  onClose: () => void;
  onNavigate: (d: Date) => void;
}) {
  const dayKey = format(date, "yyyy-MM-dd");
  const allItems = useCaptures(dayKey);
  const [filter, setFilter] = useState<FilterKind>("all");
  const [search, setSearch] = useState("");

  const FILTERS: { id: FilterKind; label: string }[] = [
    { id: "all",     label: "All" },
    { id: "thought", label: "Thoughts" },
    { id: "link",    label: "Links" },
    { id: "ref",     label: "Refs" },
    { id: "task",    label: "Tasks" },
  ];

  const visible = allItems.filter(item => {
    if (filter !== "all" && item.kind !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      const inTitle = item.title.toLowerCase().includes(q);
      const inNote = item.note?.toLowerCase().includes(q);
      const inUrl = item.url?.toLowerCase().includes(q);
      if (!inTitle && !inNote && !inUrl) return false;
    }
    return true;
  });

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const isEmpty = visible.length === 0;

  return (
    <AnimatePresence>
      <motion.div
        key="dayboard-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.12 }}
        onClick={onClose}
        style={{ position: "fixed", inset: 0, background: "rgba(20,18,40,0.45)", zIndex: 400, backdropFilter: "blur(3px)", WebkitBackdropFilter: "blur(3px)" }}
      />
      <motion.div
        key="dayboard-panel"
        initial={{ opacity: 0, y: 32, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.97 }}
        transition={{ type: "spring", stiffness: 500, damping: 36 }}
        onClick={e => e.stopPropagation()}
        style={{
          position: "fixed",
          inset: "5vh 5vw",
          zIndex: 401,
          background: "#FDFAF5",
          borderRadius: 24,
          boxShadow: "0 32px 80px -12px rgba(0,0,0,0.28), 0 4px 24px -4px rgba(0,0,0,0.10)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* ── Top bar ── */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "20px 24px 16px", borderBottom: "1px solid #EDE9E2", flexShrink: 0 }}>
          {/* Day nav */}
          <button type="button" onClick={() => onNavigate(addDays(date, -1))}
            style={{ width: 32, height: 32, borderRadius: "50%", background: "#F0EDE8", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#6B5E3A" }}>
            <ChevronLeft size={16} />
          </button>
          <div style={{ flex: 1 }}>
            <h2 style={{ fontFamily: "'Lora',Georgia,serif", fontSize: 22, fontWeight: 600, color: "#222", margin: 0, lineHeight: 1.1 }}>
              {format(date, "EEEE, MMMM d")}
            </h2>
            <p style={{ fontSize: 12, color: "#A8A4A0", margin: "2px 0 0", letterSpacing: "0.02em" }}>
              {allItems.length} capture{allItems.length !== 1 ? "s" : ""} for this day
            </p>
          </div>
          <button type="button" onClick={() => onNavigate(addDays(date, 1))}
            style={{ width: 32, height: 32, borderRadius: "50%", background: "#F0EDE8", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#6B5E3A" }}>
            <ChevronRight size={16} />
          </button>
          <button type="button" onClick={onClose}
            style={{ width: 32, height: 32, borderRadius: "50%", background: "#F0EDE8", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#6B5E3A", marginLeft: 4 }}>
            <X size={15} />
          </button>
        </div>

        {/* ── Filter + search bar ── */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 24px", borderBottom: "1px solid #EDE9E2", flexShrink: 0, flexWrap: "wrap" }}>
          {/* Kind filters */}
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {FILTERS.map(f => {
              const count = f.id === "all" ? allItems.length : allItems.filter(i => i.kind === f.id).length;
              const active = filter === f.id;
              return (
                <button key={f.id} type="button" onClick={() => setFilter(f.id)}
                  style={{
                    fontSize: 11, fontWeight: active ? 700 : 500,
                    padding: "4px 10px", borderRadius: 20,
                    background: active ? "#3C3489" : "#F0EDE8",
                    color: active ? "#fff" : "#6B5E3A",
                    border: "none", cursor: "pointer",
                    transition: "all 0.13s",
                  }}
                >
                  {f.label}
                  {count > 0 && <span style={{ marginLeft: 4, opacity: active ? 0.75 : 0.55, fontSize: 10 }}>{count}</span>}
                </button>
              );
            })}
          </div>
          {/* Search */}
          <div style={{ flex: 1, minWidth: 160, position: "relative" }}>
            <Search size={12} style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", color: "#B8B4AE", pointerEvents: "none" }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search…"
              style={{
                width: "100%", boxSizing: "border-box",
                fontSize: 12, padding: "6px 10px 6px 28px",
                background: "#F7F5F0", border: "1px solid #E2DFDA",
                borderRadius: 20, outline: "none", color: "#444",
                fontFamily: "'Lora',Georgia,serif",
              }}
            />
          </div>
        </div>

        {/* ── Card grid ── */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px", overflowX: "hidden" }}>
          {isEmpty && !search && filter === "all" ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <QuickAddCard dayKey={dayKey} />
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", paddingTop: 32, gap: 10, opacity: 0.40 }}>
                <span style={{ fontSize: 36 }}>📭</span>
                <p style={{ fontSize: 14, color: "#888", fontFamily: "'Lora',Georgia,serif" }}>No captures for this day yet</p>
              </div>
            </div>
          ) : isEmpty ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <QuickAddCard dayKey={dayKey} />
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", paddingTop: 32, gap: 10, opacity: 0.40 }}>
                <span style={{ fontSize: 36 }}>🔍</span>
                <p style={{ fontSize: 14, color: "#888", fontFamily: "'Lora',Georgia,serif" }}>No matches</p>
              </div>
            </div>
          ) : (
            <motion.div
              layout
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
                gap: 14,
                alignItems: "start",
              }}
            >
              {/* Quick-add card always first */}
              <QuickAddCard dayKey={dayKey} />
              <AnimatePresence>
                {visible.map(item => (
                  <BoardCard
                    key={item.id}
                    item={item}
                    onRemove={() => removeCapture(item.id)}
                  />
                ))}
              </AnimatePresence>
            </motion.div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
