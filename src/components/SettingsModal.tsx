import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, Plus, Trash2, GripVertical } from "lucide-react";
import { Tag, TagColor } from "@/types/event";
import { TAG_COLORS } from "@/lib/tags";
import { DAY_TYPES, DayType, loadCustomDayTypeDefs, saveCustomDayTypeDefs } from "./DayColumn";

// ── Storage helpers ───────────────────────────────────────────────────────────
const TAGS_KEY      = "horizon_tags";
const SHORTCUT_KEY  = "horizon_sidebar_shortcut";

export function loadCustomTags(defaults: Tag[]): Tag[] {
  try {
    const raw = localStorage.getItem(TAGS_KEY);
    return raw ? JSON.parse(raw) : defaults;
  } catch { return defaults; }
}
export function saveCustomTags(tags: Tag[]) {
  localStorage.setItem(TAGS_KEY, JSON.stringify(tags));
}
export function loadSidebarShortcut(): string {
  return localStorage.getItem(SHORTCUT_KEY) ?? "\\";
}
export function saveSidebarShortcut(key: string) {
  localStorage.setItem(SHORTCUT_KEY, key);
}

// ── Color palette used for tags ───────────────────────────────────────────────
const COLOR_HEX: Record<TagColor, { bg: string; text: string; border: string }> = {
  purple: { bg: "#EEEDFE", text: "#3C3489", border: "#C5BEF5" },
  teal:   { bg: "#E1F5EE", text: "#085041", border: "#9FE1CB" },
  coral:  { bg: "#FAECE7", text: "#712B13", border: "#F5C4B3" },
  pink:   { bg: "#FBEAF0", text: "#72243E", border: "#F4C0D1" },
  blue:   { bg: "#E6F1FB", text: "#0C447C", border: "#B5D4F4" },
  green:  { bg: "#EAF3DE", text: "#27500A", border: "#B8DDA0" },
  amber:  { bg: "#FAEEDA", text: "#633806", border: "#FAC775" },
  gray:   { bg: "#F1EFE8", text: "#44403C", border: "#C8C4BE" },
};

// ── Day type config (loaded from DayColumn defaults, customisable in future) ──
type DayTypeDef = { id: DayType; label: string; emoji: string; bg: string; text: string; border: string };

type Tab = "tags" | "daytypes" | "shortcuts";

interface Props {
  open: boolean;
  onClose: () => void;
  tags: Tag[];
  onTagsChange: (tags: Tag[]) => void;
  sidebarShortcut: string;
  onShortcutChange: (key: string) => void;
}

export function SettingsModal({ open, onClose, tags, onTagsChange, sidebarShortcut, onShortcutChange }: Props) {
  const [tab, setTab] = useState<Tab>("tags");
  const backdropRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      ref={backdropRef}
      onClick={(e) => { if (e.target === backdropRef.current) onClose(); }}
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(0,0,0,0.28)",
        backdropFilter: "blur(4px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 24,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#FAFAF8",
          borderRadius: 24,
          boxShadow: "0 32px 80px -16px rgba(0,0,0,0.28), 0 4px 20px -4px rgba(0,0,0,0.12)",
          border: "1px solid rgba(0,0,0,0.06)",
          width: "min(640px, calc(100vw - 48px))",
          maxHeight: "calc(100vh - 80px)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div style={{
          padding: "20px 24px 0",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          flexShrink: 0,
        }}>
          <h2 style={{ fontFamily: "'Lora', Georgia, serif", fontSize: 20, fontWeight: 600, color: "#111", margin: 0 }}>
            Settings
          </h2>
          <button
            onClick={onClose}
            style={{ background: "#F0EDEA", border: "none", borderRadius: 10, padding: 8, cursor: "pointer", color: "#888", display: "flex" }}
          >
            <X size={14} strokeWidth={2.5} />
          </button>
        </div>

        {/* Tabs */}
        <div style={{ padding: "16px 24px 0", display: "flex", gap: 4, flexShrink: 0, borderBottom: "1px solid #EDEBE7" }}>
          {(["tags", "daytypes", "shortcuts"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding: "8px 16px",
                borderRadius: "10px 10px 0 0",
                border: "none",
                background: tab === t ? "#fff" : "transparent",
                color: tab === t ? "#3C3489" : "#888",
                fontWeight: tab === t ? 700 : 500,
                fontSize: 13,
                cursor: "pointer",
                borderBottom: tab === t ? "2px solid #534AB7" : "2px solid transparent",
                marginBottom: -1,
                transition: "all 0.12s",
              }}
            >
              {{ tags: "Tags", daytypes: "Day Types", shortcuts: "Shortcuts" }[t]}
            </button>
          ))}
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "24px" }}>
          {tab === "tags"      && <TagsTab      tags={tags} onChange={onTagsChange} />}
          {tab === "daytypes"  && <DayTypesTab />}
          {tab === "shortcuts" && <ShortcutsTab shortcut={sidebarShortcut} onChange={onShortcutChange} />}
        </div>
      </div>
    </div>,
    document.body
  );
}

// ── Tags tab ─────────────────────────────────────────────────────────────────
function TagsTab({ tags, onChange }: { tags: Tag[]; onChange: (t: Tag[]) => void }) {
  const [editing, setEditing] = useState<string | null>(null);
  const [newName, setNewName] = useState("");

  function addTag() {
    const id = `tag_${Date.now()}`;
    const next = [...tags, { id, name: "new tag", color: "gray" as TagColor }];
    onChange(next);
    setEditing(id);
    setNewName("new tag");
  }

  function removeTag(id: string) {
    onChange(tags.filter(t => t.id !== id));
    if (editing === id) setEditing(null);
  }

  function updateName(id: string, name: string) {
    onChange(tags.map(t => t.id === id ? { ...t, name: name.toLowerCase().replace(/\s+/g, "-") } : t));
  }

  function updateColor(id: string, color: TagColor) {
    onChange(tags.map(t => t.id === id ? { ...t, color } : t));
  }

  return (
    <div>
      <p style={{ fontSize: 12, color: "#999", marginBottom: 16, fontWeight: 400 }}>
        Add, rename, or recolor tags. Changes apply immediately to new events.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {tags.map((tag) => {
          const c = COLOR_HEX[tag.color];
          const isEditing = editing === tag.id;
          return (
            <div
              key={tag.id}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                background: "#fff", borderRadius: 12,
                border: `1.5px solid ${isEditing ? "#C5BEF5" : "#EDEBE7"}`,
                padding: "10px 12px",
                transition: "border-color 0.12s",
              }}
            >
              <GripVertical size={14} color="#C8C4BE" style={{ flexShrink: 0, cursor: "grab" }} />

              {/* Color swatch + name */}
              <div
                style={{
                  width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                  background: c.bg, border: `1.5px solid ${c.border}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: "pointer",
                }}
                onMouseDown={e => { e.preventDefault(); setEditing(isEditing ? null : tag.id); }}
                title="Click to edit"
              >
                <span style={{ fontSize: 10, fontWeight: 700, color: c.text }}>
                  #{tag.name.slice(0, 2).toUpperCase()}
                </span>
              </div>

              {isEditing ? (
                <input
                  autoFocus
                  value={newName}
                  onChange={e => { setNewName(e.target.value); updateName(tag.id, e.target.value); }}
                  onBlur={() => setEditing(null)}
                  onKeyDown={e => { if (e.key === "Enter" || e.key === "Escape") setEditing(null); }}
                  style={{
                    flex: 1, fontSize: 13, fontWeight: 600, color: "#3C3489",
                    background: "#F5F3FF", border: "1.5px solid #C5BEF5", borderRadius: 8,
                    padding: "4px 10px", outline: "none",
                  }}
                />
              ) : (
                <span
                  style={{ flex: 1, fontSize: 13, fontWeight: 600, color: "#33302C", cursor: "pointer" }}
                  onClick={() => { setEditing(tag.id); setNewName(tag.name); }}
                >
                  #{tag.name}
                </span>
              )}

              {/* Color picker row */}
              {isEditing && (
                <div style={{ display: "flex", gap: 5, flexShrink: 0 }}>
                  {TAG_COLORS.map((col) => {
                    const ch = COLOR_HEX[col];
                    return (
                      <button
                        key={col}
                        onMouseDown={e => { e.preventDefault(); updateColor(tag.id, col); }}
                        title={col}
                        style={{
                          width: 20, height: 20, borderRadius: "50%", border: "none",
                          background: ch.bg,
                          outline: tag.color === col ? `2.5px solid ${ch.text}` : `1.5px solid ${ch.border}`,
                          outlineOffset: 1,
                          cursor: "pointer",
                          transition: "outline 0.1s",
                        }}
                      />
                    );
                  })}
                </div>
              )}

              <button
                onClick={() => removeTag(tag.id)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#D3D1C7", padding: 4, display: "flex", flexShrink: 0 }}
                onMouseEnter={e => (e.currentTarget.style.color = "#C0392B")}
                onMouseLeave={e => (e.currentTarget.style.color = "#D3D1C7")}
              >
                <Trash2 size={13} />
              </button>
            </div>
          );
        })}
      </div>

      <button
        onClick={addTag}
        style={{
          marginTop: 12, display: "flex", alignItems: "center", gap: 6,
          background: "#EEEDFE", border: "1.5px dashed #C5BEF5", borderRadius: 12,
          padding: "10px 16px", cursor: "pointer",
          fontSize: 13, fontWeight: 600, color: "#3C3489", width: "100%",
          justifyContent: "center",
        }}
      >
        <Plus size={14} /> Add tag
      </button>
    </div>
  );
}

// ── Day Types tab ─────────────────────────────────────────────────────────────
function DayTypesTab() {
  const [dayTypes, setDayTypes] = useState<DayTypeDef[]>(() =>
    loadCustomDayTypeDefs()
  );
  const [editing, setEditing] = useState<string | null>(null);

  const PRESET_COLORS = [
    { bg: "#EEEDFE", text: "#3C3489", border: "#C5BEF5" },
    { bg: "#E1F5EE", text: "#085041", border: "#9FE1CB" },
    { bg: "#EAF3DE", text: "#27500A", border: "#B8DDA0" },
    { bg: "#FAEEDA", text: "#633806", border: "#FAC775" },
    { bg: "#E6F1FB", text: "#0C447C", border: "#B5D4F4" },
    { bg: "#FEF0EE", text: "#C0392B", border: "#FACEC9" },
    { bg: "#FBEAF0", text: "#72243E", border: "#F4C0D1" },
    { bg: "#F1EFE8", text: "#44403C", border: "#C8C4BE" },
  ];

  function updateLabel(id: string, label: string) {
    setDayTypes(prev => {
      const next = prev.map(d => d.id === id ? { ...d, label } : d);
      saveCustomDayTypeDefs(next as typeof DAY_TYPES);
      return next;
    });
  }
  function updateEmoji(id: string, emoji: string) {
    setDayTypes(prev => {
      const next = prev.map(d => d.id === id ? { ...d, emoji } : d);
      saveCustomDayTypeDefs(next as typeof DAY_TYPES);
      return next;
    });
  }
  function updateColors(id: string, preset: typeof PRESET_COLORS[0]) {
    setDayTypes(prev => {
      const next = prev.map(d => d.id === id ? { ...d, bg: preset.bg, headerBg: preset.bg, text: preset.text, border: preset.border } : d);
      saveCustomDayTypeDefs(next as typeof DAY_TYPES);
      return next;
    });
  }

  return (
    <div>
      <p style={{ fontSize: 12, color: "#999", marginBottom: 16 }}>
        Customize the label, emoji and color of each day type. These appear as the top strip on calendar columns.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {dayTypes.map((dt) => {
          const isEditing = editing === dt.id;
          return (
            <div
              key={dt.id}
              style={{
                background: "#fff", borderRadius: 12,
                border: `1.5px solid ${isEditing ? dt.border : "#EDEBE7"}`,
                padding: "10px 14px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }} onClick={() => setEditing(isEditing ? null : dt.id)}>
                {/* Color strip preview */}
                <div style={{ width: 6, height: 36, borderRadius: 3, background: dt.border, flexShrink: 0 }} />
                <span style={{ fontSize: 18, lineHeight: 1 }}>{dt.emoji}</span>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: dt.text, margin: 0 }}>{dt.label}</p>
                  <p style={{ fontSize: 10, color: "#999", margin: 0, marginTop: 2 }}>{dt.id}</p>
                </div>
                <div style={{
                  width: 24, height: 24, borderRadius: 6,
                  background: dt.bg, border: `1.5px solid ${dt.border}`,
                  flexShrink: 0,
                }} />
                <span style={{ fontSize: 11, color: "#C8C4BE" }}>{isEditing ? "▲" : "▼"}</span>
              </div>

              {isEditing && (
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #F0EDEA" }}>
                  <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: 10, fontWeight: 700, color: "#AAA", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 4 }}>Label</label>
                      <input
                        value={dt.label}
                        onChange={e => updateLabel(dt.id, e.target.value)}
                        style={{ width: "100%", fontSize: 13, background: "#F5F3F0", border: "1.5px solid #E5E2DC", borderRadius: 8, padding: "6px 10px", outline: "none", boxSizing: "border-box" }}
                      />
                    </div>
                    <div style={{ width: 80 }}>
                      <label style={{ fontSize: 10, fontWeight: 700, color: "#AAA", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 4 }}>Emoji</label>
                      <input
                        value={dt.emoji}
                        onChange={e => updateEmoji(dt.id, e.target.value)}
                        style={{ width: "100%", fontSize: 18, textAlign: "center", background: "#F5F3F0", border: "1.5px solid #E5E2DC", borderRadius: 8, padding: "4px 8px", outline: "none", boxSizing: "border-box" }}
                      />
                    </div>
                  </div>
                  <label style={{ fontSize: 10, fontWeight: 700, color: "#AAA", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 6 }}>Color</label>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {PRESET_COLORS.map((p, i) => (
                      <button
                        key={i}
                        onClick={() => updateColors(dt.id, p)}
                        style={{
                          width: 28, height: 28, borderRadius: 8, border: "none",
                          background: p.bg,
                          outline: dt.bg === p.bg ? `2.5px solid ${p.text}` : `1.5px solid ${p.border}`,
                          outlineOffset: 1,
                          cursor: "pointer",
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Shortcuts tab ─────────────────────────────────────────────────────────────
function ShortcutsTab({ shortcut, onChange }: { shortcut: string; onChange: (k: string) => void }) {
  const [capturing, setCapturing] = useState(false);
  const [display, setDisplay] = useState(shortcut === "\\" ? "Cmd + \\" : `Cmd + ${shortcut.toUpperCase()}`);

  function startCapture() {
    setCapturing(true);
  }

  function handleKey(e: React.KeyboardEvent) {
    e.preventDefault();
    e.stopPropagation();
    const key = e.key;
    if (key === "Escape") { setCapturing(false); return; }
    if (key === "Meta" || key === "Control" || key === "Shift" || key === "Alt") return;
    const label = key === "\\" ? "Cmd + \\" : `Cmd + ${key.toUpperCase()}`;
    setDisplay(label);
    onChange(key);
    setCapturing(false);
  }

  const ALL_SHORTCUTS = [
    { label: "Delete / Backspace", action: "Delete focused event" },
    { label: "Cmd + C", action: "Copy focused event" },
    { label: "Cmd + V", action: "Paste event to selected day" },
    { label: "Cmd + D", action: "Duplicate focused event" },
    { label: "Cmd + Z", action: "Undo" },
    { label: "Cmd + Shift + Z", action: "Redo" },
    { label: display, action: "Toggle sidebar", customizable: true },
  ];

  return (
    <div>
      <p style={{ fontSize: 12, color: "#999", marginBottom: 20 }}>
        Keyboard shortcuts available across the app.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {ALL_SHORTCUTS.map((s, i) => (
          <div
            key={i}
            style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "10px 14px", background: "#fff", borderRadius: 10,
              border: s.customizable ? "1.5px solid #C5BEF5" : "1px solid #EDEBE7",
            }}
          >
            <span style={{ fontSize: 13, color: "#33302C", fontWeight: 400 }}>{s.action}</span>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {s.customizable && capturing ? (
                <input
                  autoFocus
                  onKeyDown={handleKey}
                  onBlur={() => setCapturing(false)}
                  placeholder="Press a key…"
                  readOnly
                  style={{
                    fontSize: 11, fontWeight: 700, color: "#534AB7",
                    background: "#EEEDFE", border: "1.5px solid #C5BEF5",
                    borderRadius: 8, padding: "4px 12px", outline: "none",
                    cursor: "pointer", width: 140, textAlign: "center",
                  }}
                />
              ) : (
                <kbd
                  onClick={s.customizable ? startCapture : undefined}
                  style={{
                    fontSize: 11, fontWeight: 700,
                    color: s.customizable ? "#534AB7" : "#5F5E5A",
                    background: s.customizable ? "#EEEDFE" : "#F1EFE8",
                    border: `1px solid ${s.customizable ? "#C5BEF5" : "#C8C4BE"}`,
                    borderRadius: 8, padding: "4px 12px",
                    cursor: s.customizable ? "pointer" : "default",
                    fontFamily: "'DM Sans', system-ui, sans-serif",
                    whiteSpace: "nowrap",
                  }}
                >
                  {s.label}
                </kbd>
              )}
              {s.customizable && !capturing && (
                <span style={{ fontSize: 10, color: "#AAA" }}>click to change</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
