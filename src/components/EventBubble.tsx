import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { format, eachDayOfInterval, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isSameMonth, addMonths, subMonths } from "date-fns";
import { X, Trash2, Check, Ban, RotateCcw, Lightbulb, Link2, FileText, Bookmark, CheckSquare, ExternalLink, Pencil, type LucideIcon } from "lucide-react";
import { CalEvent, CaptureKind, Tag, DURATIONS } from "@/types/event";
import { getTag } from "@/lib/tags";
import { minutesToLabel, durationLabel } from "@/lib/event-utils";

const KIND_ICON: Record<CaptureKind, LucideIcon> = {
  thought: Lightbulb,
  link:    Link2,
  file:    FileText,
  ref:     Bookmark,
  task:    CheckSquare,
  meal:    Lightbulb,
};

const KIND_COLORS: Record<CaptureKind, { bg: string; text: string }> = {
  thought: { bg: "#EEEDFE", text: "#3C3489" },
  link:    { bg: "#E6F1FB", text: "#0C447C" },
  file:    { bg: "#EAF3DE", text: "#27500A" },
  ref:     { bg: "#FAEEDA", text: "#633806" },
  task:    { bg: "#FBEAF0", text: "#72243E" },
  meal:    { bg: "#FEF3C7", text: "#92400E" },
};

function tagColors(tagId?: string): { bg: string; text: string; sub: string } {
  switch (tagId) {
    case "work":     return { bg: "#B5AEED", text: "#2A246B", sub: "#4D4699" };
    case "deepwork": return { bg: "#AEE5D1", text: "#063A2F", sub: "#156353" };
    case "study":    return { bg: "#A2CAE8", text: "#08305A", sub: "#1D528A" };
    case "personal": return { bg: "#EEB6C8", text: "#5C1D32", sub: "#8F3A56" };
    case "social":   return { bg: "#F4C26E", text: "#4D2B05", sub: "#804E11" };
    default:         return { bg: "#E6E4DD", text: "#333331", sub: "#666461" };
  }
}

function EditMiniCal({ selected, onSelect }: { selected: string; onSelect: (d: string) => void }) {
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(new Date(selected + "T00:00:00")));
  const days = eachDayOfInterval({
    start: startOfWeek(viewMonth, { weekStartsOn: 1 }),
    end:   endOfWeek(endOfMonth(viewMonth), { weekStartsOn: 1 }),
  });
  const todayStr = format(new Date(), "yyyy-MM-dd");
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <button type="button" onClick={() => setViewMonth(m => subMonths(m, 1))} style={{ background: "none", border: "none", cursor: "pointer", color: "#7B73D6", fontSize: 16, padding: "0 6px" }}>‹</button>
        <span style={{ fontSize: 11, fontWeight: 700, color: "#3C3489" }}>{format(viewMonth, "MMM yyyy")}</span>
        <button type="button" onClick={() => setViewMonth(m => addMonths(m, 1))} style={{ background: "none", border: "none", cursor: "pointer", color: "#7B73D6", fontSize: 16, padding: "0 6px" }}>›</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2 }}>
        {["M","T","W","T","F","S","S"].map((d, i) => (
          <div key={i} style={{ textAlign: "center", fontSize: 9, fontWeight: 700, color: "#B0AAE8", paddingBottom: 2 }}>{d}</div>
        ))}
        {days.map(day => {
          const key = format(day, "yyyy-MM-dd");
          const isSel = key === selected;
          const isToday = key === todayStr;
          const inMonth = isSameMonth(day, viewMonth);
          return (
            <button type="button" key={key} onClick={() => onSelect(key)} style={{
              padding: "4px 0", borderRadius: 5, fontSize: 10,
              fontWeight: isSel ? 700 : 400,
              background: isSel ? "#3C3489" : isToday ? "#EBE8FC" : "transparent",
              color: isSel ? "#fff" : !inMonth ? "rgba(123,115,214,0.25)" : isToday ? "#3C3489" : "#4A42A0",
              border: isToday && !isSel ? "1px solid #C5BEF5" : "1px solid transparent",
              cursor: "pointer",
            }}>{format(day, "d")}</button>
          );
        })}
      </div>
    </div>
  );
}

function EditTimePicker({ selected, onSelect }: { selected: number; onSelect: (m: number) => void }) {
  const slots: number[] = [];
  for (let t = 7 * 60; t <= 22 * 60; t += 30) slots.push(t);
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 3, maxHeight: 140, overflowY: "auto" }} className="scrollbar-hidden">
      {slots.map(t => (
        <button type="button" key={t} onClick={() => onSelect(t)} style={{
          padding: "5px 2px", borderRadius: 6, fontSize: 10, fontWeight: 600,
          textAlign: "center", cursor: "pointer",
          background: selected === t ? "#3C3489" : "rgba(255,255,255,0.85)",
          color: selected === t ? "#fff" : "#3C3489",
          border: selected === t ? "1.5px solid #3C3489" : "1.5px solid rgba(123,115,214,0.22)",
        }}>{minutesToLabel(t)}</button>
      ))}
    </div>
  );
}

interface Props {
  event: CalEvent;
  tags?: Tag[];
  onMark?: (completed: boolean | null) => void;
  onDelete?: () => void;
  onUpdate?: (patch: Partial<CalEvent>) => void;
  isResizing?: boolean;
}

export function EventBubble({ event, tags, onMark, onDelete, onUpdate, isResizing }: Props) {
  const tag = tags ? getTag(tags, event.tagId) : undefined;
  const colors = tagColors(tag?.id ?? event.tagId);
  const [showDetail, setShowDetail] = useState(false);
  const [panelPos, setPanelPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const bubbleRef = useRef<HTMLDivElement>(null);

  // edit mode: all fields editable at once
  const [editMode, setEditMode] = useState(false);
  const [editTitle, setEditTitle] = useState(event.title);
  const [editDate, setEditDate] = useState(event.date);
  const [editStart, setEditStart] = useState(event.start);
  const [editDuration, setEditDuration] = useState(event.duration);
  const [editTagId, setEditTagId] = useState(event.tagId ?? "");
  const [editLocation, setEditLocation] = useState(event.where ?? "");
  const [editPeople, setEditPeople] = useState(event.who ?? "");
  // which sub-section is expanded inside edit mode
  const [expandSection, setExpandSection] = useState<"date" | "time" | null>(null);

  useEffect(() => {
    if (showDetail) {
      setEditTitle(event.title);
      setEditDate(event.date);
      setEditStart(event.start);
      setEditDuration(event.duration);
      setEditTagId(event.tagId ?? "");
      setEditLocation(event.where ?? "");
      setEditPeople(event.who ?? "");
      setEditMode(false);
      setExpandSection(null);
    }
  }, [showDetail, event]);

  const isCompleted = event.completed === true;
  const isSkipped = event.completed === false;

  const bgColor = isCompleted ? "#BBDD8E" : isSkipped ? "#E6E4DD" : colors.bg;
  const textColor = isCompleted ? "#27500A" : isSkipped ? "#888" : colors.text;
  const subColor = isCompleted ? "#3C6B13" : isSkipped ? "#999" : colors.sub;

  useEffect(() => {
    if (!showDetail) return;
    function onDown(e: MouseEvent) {
      if (bubbleRef.current && !bubbleRef.current.contains(e.target as Node)) {
        const panel = document.getElementById("event-detail-panel");
        if (panel && panel.contains(e.target as Node)) return;
        setShowDetail(false);
      }
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [showDetail]);

  function handleBubbleClick(e: React.MouseEvent) {
    e.stopPropagation();
    if (isResizing) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const panelW = 360;
    const panelH = 560;
    const x = rect.right + 12 + panelW > window.innerWidth
      ? rect.left - panelW - 12
      : rect.right + 12;
    const y = Math.min(rect.top, window.innerHeight - panelH - 16);
    setPanelPos({ x, y });
    setShowDetail((v) => !v);
  }

  function saveAll() {
    if (!onUpdate) { setEditMode(false); return; }
    onUpdate({
      title: editTitle.trim() || event.title,
      date: editDate,
      start: editStart,
      duration: editDuration,
      tagId: editTagId || undefined,
      where: editLocation.trim() || undefined,
      who: editPeople.trim() || undefined,
    });
    setEditMode(false);
    setExpandSection(null);
  }

  function cancelEdit() {
    setEditTitle(event.title);
    setEditDate(event.date);
    setEditStart(event.start);
    setEditDuration(event.duration);
    setEditTagId(event.tagId ?? "");
    setEditLocation(event.where ?? "");
    setEditPeople(event.who ?? "");
    setEditMode(false);
    setExpandSection(null);
  }

  const endMin = editStart + editDuration;
  const displayEndMin = event.start + event.duration;
  const dateLabel = (() => {
    try { return format(new Date(event.date + "T00:00:00"), "EEE, MMM d"); } catch { return event.date; }
  })();
  const editDateLabel = (() => {
    try { return format(new Date(editDate + "T00:00:00"), "EEE, MMM d"); } catch { return editDate; }
  })();

  const displayTag = tags ? getTag(tags, editMode ? editTagId : (event.tagId ?? "")) : undefined;

  // ── Field row for view mode ──────────────────────────────────
  function FieldRow({ label, value }: { label: string; value: React.ReactNode }) {
    return (
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, padding: "5px 0", borderBottom: "1px solid rgba(0,0,0,0.04)" }}>
        <span style={{ fontSize: 11, color: "#AAA", minWidth: 56, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", flexShrink: 0 }}>{label}</span>
        <span style={{ fontSize: 13, fontWeight: 500, color: "#222", lineHeight: 1.4 }}>{value}</span>
      </div>
    );
  }

  const detailPanel = showDetail && createPortal(
    <>
      <div style={{ position: "fixed", inset: 0, zIndex: 998 }} onClick={() => setShowDetail(false)} />

      <motion.div
        id="event-detail-panel"
        initial={{ opacity: 0, scale: 0.93, y: -6 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ type: "spring", stiffness: 420, damping: 28 }}
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "fixed",
          left: panelPos.x,
          top: panelPos.y,
          width: 360,
          background: "#FAFAF8",
          borderRadius: 20,
          boxShadow: "0 24px 72px -8px rgba(0,0,0,0.24), 0 4px 20px -4px rgba(0,0,0,0.12)",
          border: "1px solid rgba(0,0,0,0.07)",
          zIndex: 999,
          overflow: "hidden",
          maxHeight: "92vh",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Color stripe */}
        <div style={{ height: 8, background: bgColor, flexShrink: 0 }} />

        {/* Header */}
        <div style={{ padding: "16px 18px 12px", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, flexShrink: 0 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            {editMode ? (
              <input
                autoFocus
                value={editTitle}
                onChange={e => setEditTitle(e.target.value)}
                onKeyDown={e => { if (e.key === "Escape") cancelEdit(); }}
                style={{ width: "100%", fontSize: 17, fontWeight: 700, color: "#111", background: "#F3F0FE", border: "2px solid #7B73D6", borderRadius: 10, padding: "6px 10px", outline: "none", boxSizing: "border-box" }}
              />
            ) : (
              <h3 style={{ fontSize: 17, fontWeight: 700, color: "#111", lineHeight: 1.3, margin: 0 }}>{event.title}</h3>
            )}
            {!editMode && (
              <p style={{ fontSize: 12, color: "#999", marginTop: 3, fontWeight: 400 }}>
                {dateLabel} · {minutesToLabel(event.start)} → {minutesToLabel(displayEndMin)} · {durationLabel(event.duration)}
              </p>
            )}
          </div>
          <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
            {/* Google Calendar badge — editable locally */}
            {event.source === "google" && !editMode && (
              <span style={{ display: "flex", alignItems: "center", gap: 4, background: "#F0F6FF", border: "1px solid #C5D9F5", borderRadius: 10, padding: "5px 10px", fontSize: 11, fontWeight: 600, color: "#3A6CB5", flexShrink: 0 }}>
                <svg width="10" height="10" viewBox="0 0 488 512" fill="currentColor"><path d="M488 261.8C488 403.3 391.1 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 123 24.5 166.3 64.9l-67.5 64.9C258.5 52.6 94.3 116.6 94.3 256c0 86.5 69.1 156.6 153.7 156.6 98.2 0 135-70.4 140.8-106.9H248v-85.3h236.1c2.3 12.7 3.9 24.9 3.9 41.4z"/></svg>
                Google
              </span>
            )}
            {onUpdate && !editMode && (
              <button
                type="button"
                onClick={() => setEditMode(true)}
                style={{ display: "flex", alignItems: "center", gap: 5, background: "#EBE8FC", border: "none", borderRadius: 10, padding: "7px 12px", cursor: "pointer", color: "#3C3489", fontSize: 12, fontWeight: 600 }}
              >
                <Pencil size={12} strokeWidth={2.5} /> Edit
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowDetail(false)}
              style={{ background: "#F0EDEA", border: "none", borderRadius: 10, padding: 7, cursor: "pointer", color: "#888", display: "flex", alignItems: "center", justifyContent: "center" }}
            >
              <X size={14} strokeWidth={2.5} />
            </button>
          </div>
        </div>

        {/* Scrollable body */}
        <div style={{ flex: 1, overflowY: "auto" }} className="scrollbar-hidden">

          {editMode ? (
            /* ── EDIT MODE: all fields ── */
            <div style={{ padding: "0 18px 12px" }}>

              {/* Date */}
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: "#AAA", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 4 }}>Date</label>
                <button
                  type="button"
                  onClick={() => setExpandSection(s => s === "date" ? null : "date")}
                  style={{ width: "100%", textAlign: "left", background: expandSection === "date" ? "#EBE8FC" : "#F5F3F0", border: "1.5px solid " + (expandSection === "date" ? "#7B73D6" : "transparent"), borderRadius: 10, padding: "8px 12px", fontSize: 13, fontWeight: 600, color: "#3C3489", cursor: "pointer" }}
                >
                  {editDateLabel}
                </button>
                {expandSection === "date" && (
                  <div style={{ marginTop: 6, background: "#F3F0FE", borderRadius: 12, padding: 10 }}>
                    <EditMiniCal selected={editDate} onSelect={d => { setEditDate(d); setExpandSection(null); }} />
                  </div>
                )}
              </div>

              {/* Time */}
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: "#AAA", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 4 }}>Start time</label>
                <button
                  type="button"
                  onClick={() => setExpandSection(s => s === "time" ? null : "time")}
                  style={{ width: "100%", textAlign: "left", background: expandSection === "time" ? "#EBE8FC" : "#F5F3F0", border: "1.5px solid " + (expandSection === "time" ? "#7B73D6" : "transparent"), borderRadius: 10, padding: "8px 12px", fontSize: 13, fontWeight: 600, color: "#3C3489", cursor: "pointer" }}
                >
                  {minutesToLabel(editStart)} → {minutesToLabel(endMin)}
                </button>
                {expandSection === "time" && (
                  <div style={{ marginTop: 6, background: "#F3F0FE", borderRadius: 12, padding: 10 }}>
                    <EditTimePicker selected={editStart} onSelect={t => { setEditStart(t); setExpandSection(null); }} />
                  </div>
                )}
              </div>

              {/* Duration */}
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: "#AAA", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 4 }}>Duration</label>
                <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                  {DURATIONS.map(d => (
                    <button type="button" key={d} onClick={() => setEditDuration(d)} style={{
                      padding: "6px 12px", borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: "pointer",
                      background: editDuration === d ? "#3C3489" : "#F5F3F0",
                      color: editDuration === d ? "#fff" : "#3C3489",
                      border: "1.5px solid " + (editDuration === d ? "#3C3489" : "rgba(123,115,214,0.22)"),
                    }}>{durationLabel(d)}</button>
                  ))}
                </div>
              </div>

              {/* Tag */}
              {tags && tags.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: "#AAA", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 4 }}>Tag</label>
                  <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                    <button type="button" onClick={() => setEditTagId("")} style={{
                      padding: "5px 12px", borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: "pointer",
                      background: editTagId === "" ? "#555" : "#F0EDEA",
                      color: editTagId === "" ? "#fff" : "#888",
                      border: "none",
                    }}>none</button>
                    {tags.map(t => {
                      const tc = tagColors(t.id);
                      return (
                        <button type="button" key={t.id} onClick={() => setEditTagId(t.id)} style={{
                          padding: "5px 12px", borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: "pointer",
                          background: editTagId === t.id ? tc.text : tc.bg,
                          color: editTagId === t.id ? "#fff" : tc.text,
                          border: "none",
                        }}>#{t.name}</button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Location */}
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: "#AAA", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 4 }}>Location</label>
                <input
                  value={editLocation}
                  onChange={e => setEditLocation(e.target.value)}
                  placeholder="e.g. Coffee Lab, Zoom…"
                  style={{ width: "100%", background: "#F5F3F0", border: "1.5px solid rgba(123,115,214,0.22)", borderRadius: 10, padding: "8px 12px", fontSize: 13, color: "#3C3489", outline: "none", boxSizing: "border-box" }}
                />
              </div>

              {/* People */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: "#AAA", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 4 }}>People</label>
                <input
                  value={editPeople}
                  onChange={e => setEditPeople(e.target.value)}
                  placeholder="e.g. Alice, the team…"
                  style={{ width: "100%", background: "#F5F3F0", border: "1.5px solid rgba(123,115,214,0.22)", borderRadius: 10, padding: "8px 12px", fontSize: 13, color: "#3C3489", outline: "none", boxSizing: "border-box" }}
                />
              </div>

              {/* Save / Cancel */}
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" onClick={saveAll} style={{ flex: 1, background: "#3C3489", color: "#fff", border: "none", borderRadius: 12, padding: "10px 0", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                  Save changes
                </button>
                <button type="button" onClick={cancelEdit} style={{ flex: 1, background: "#F0EDEA", color: "#666", border: "none", borderRadius: 12, padding: "10px 0", fontSize: 13, cursor: "pointer" }}>
                  Cancel
                </button>
              </div>
            </div>

          ) : (
            /* ── VIEW MODE ── */
            <div style={{ padding: "0 18px 10px" }}>
              <FieldRow label="Date" value={dateLabel} />
              <FieldRow label="Time" value={<>{minutesToLabel(event.start)} → {minutesToLabel(displayEndMin)} <span style={{ fontSize: 11, color: "#bbb" }}>· {durationLabel(event.duration)}</span></>} />
              {displayTag && <FieldRow label="Tag" value={<span style={{ fontSize: 12, fontWeight: 700, background: tagColors(displayTag.id).bg, color: tagColors(displayTag.id).text, borderRadius: 12, padding: "2px 10px" }}>#{displayTag.name}</span>} />}
              {event.where && <FieldRow label="Where" value={<>📍 {event.where}</>} />}
              {event.who && <FieldRow label="Who" value={<>👥 {event.who}</>} />}
              {(isCompleted || isSkipped) && (
                <FieldRow label="Status" value={
                  <span style={{ fontSize: 12, fontWeight: 600, color: isCompleted ? "#27500A" : "#888", background: isCompleted ? "#D8F0B8" : "#EDEBE7", borderRadius: 12, padding: "2px 10px" }}>
                    {isCompleted ? "✓ done" : "✗ didn't happen"}
                  </span>
                } />
              )}

              {/* Attached items */}
              {(event.attachedItems?.length ?? 0) > 0 && (
                <div style={{ marginTop: 12 }}>
                  <p style={{ fontSize: 10, fontWeight: 700, color: "#bbb", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Attached</p>
                  {event.attachedItems!.map((att) => {
                    const Icon = KIND_ICON[att.kind] ?? Lightbulb;
                    const kc = KIND_COLORS[att.kind];
                    return (
                      <div key={att.id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, background: "#F5F3F0", borderRadius: 8, padding: "6px 8px" }}>
                        <span style={{ width: 20, height: 20, borderRadius: 6, background: kc.bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <Icon size={11} color={kc.text} strokeWidth={2} />
                        </span>
                        <span style={{ fontSize: 12, fontWeight: 500, color: "#333", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{att.title}</span>
                        {att.url && (
                          <button type="button" onClick={() => window.open(att.url, "_blank")} style={{ background: "none", border: "none", cursor: "pointer", padding: 2, color: "#aaa" }}>
                            <ExternalLink size={11} />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Bottom actions (Done / Skip / Delete) — always visible ── */}
        {!editMode && (
          <div style={{ flexShrink: 0, borderTop: "1px solid #EDEBE7" }}>
            {onMark && (
              <div style={{ padding: "12px 18px 8px", display: "flex", gap: 8 }}>
                <button
                  type="button"
                  onClick={() => { onMark(true); setShowDetail(false); }}
                  style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, background: isCompleted ? "#C8E6A8" : "#EBF3D8", color: "#2E5513", border: isCompleted ? "2px solid #8DC86E" : "2px solid transparent", borderRadius: 12, padding: "10px 0", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
                >
                  <Check size={14} strokeWidth={2.5} /> Done
                </button>
                <button
                  type="button"
                  onClick={() => { onMark(false); setShowDetail(false); }}
                  style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, background: isSkipped ? "#DEDAD4" : "#F5F3F0", color: "#555", border: isSkipped ? "2px solid #B0ABA4" : "2px solid transparent", borderRadius: 12, padding: "10px 0", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
                >
                  <Ban size={14} strokeWidth={2} /> Skip
                </button>
                {event.completed != null && (
                  <button
                    type="button"
                    onClick={() => { onMark(null); setShowDetail(false); }}
                    title="Undo status"
                    style={{ display: "flex", alignItems: "center", justifyContent: "center", background: "#F5F3F0", color: "#999", border: "none", borderRadius: 12, padding: "10px 12px", cursor: "pointer" }}
                  >
                    <RotateCcw size={14} strokeWidth={2} />
                  </button>
                )}
              </div>
            )}

            {onDelete && (
              <div style={{ padding: "0 18px 16px" }}>
                <button
                  type="button"
                  onClick={() => { onDelete(); setShowDetail(false); }}
                  style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, background: "#FEF0EE", color: "#C0392B", border: "1.5px solid #FACEC9", borderRadius: 12, padding: "10px 0", fontSize: 13, fontWeight: 600, cursor: "pointer", transition: "background 0.15s" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#FDDBD8")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "#FEF0EE")}
                >
                  <Trash2 size={14} strokeWidth={2} /> Delete event
                </button>
              </div>
            )}
          </div>
        )}
      </motion.div>
    </>,
    document.body
  );

  return (
    <>
      <motion.div
        ref={bubbleRef}
        layoutId={`event-${event.id}`}
        initial={{ scale: 0.8, opacity: 0, x: -200, y: 100 }}
        animate={{ scale: 1, opacity: 1, x: 0, y: 0 }}
        exit={{ scale: 0.9, opacity: 0 }}
        transition={{ type: "spring", stiffness: 350, damping: 25 }}
        whileHover={{ y: -1 }}
        onClick={handleBubbleClick}
        style={{
          borderRadius: 10,
          background: "transparent",
          padding: "10px 12px",
          cursor: "pointer",
          position: "relative",
          border: `1px solid ${isCompleted ? "#A4C779" : isSkipped ? "#D3D1C8" : colors.bg}`,
          opacity: isSkipped ? 0.7 : 1,
          userSelect: "none",
          height: "100%",
          boxSizing: "border-box",
          overflow: "visible",
          outline: showDetail ? `2px solid ${colors.text}55` : "none",
          outlineOffset: 1,
        }}
      >
        {/* Animated background fill */}
        <motion.div
          initial={{ height: "0%" }}
          animate={{ height: "100%" }}
          transition={{ duration: 0.7, ease: "easeOut", delay: 0.1 }}
          style={{
            position: "absolute",
            bottom: 0, left: 0, right: 0,
            background: bgColor,
            zIndex: 0,
            borderRadius: 8,
          }}
        />

        {/* Completed badge */}
        {isCompleted && (
          <div style={{ position: "absolute", top: -6, right: -6, width: 20, height: 20, borderRadius: "50%", background: "#3A6115", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
          </div>
        )}

        {/* Skipped badge */}
        {isSkipped && (
          <div style={{ position: "absolute", top: -6, right: -6, width: 20, height: 20, borderRadius: "50%", background: "#9B9B9A", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </div>
        )}

        {/* Title */}
        <div style={{ position: "relative", zIndex: 1 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: textColor, textDecoration: isSkipped ? "line-through" : "none", lineHeight: 1.3 }}>
            {event.title}
          </span>
        </div>

        {/* Subtitle */}
        <p style={{ position: "relative", zIndex: 1, fontSize: 12, color: subColor, marginTop: 3, fontWeight: 500 }}>
          {minutesToLabel(event.start)} · {durationLabel(event.duration)}{tag ? ` · #${tag.name}` : ""}
        </p>

        {/* Location / people badges */}
        {(event.where || event.who) && (
          <div style={{ position: "relative", zIndex: 1, marginTop: 4, display: "flex", gap: 4, flexWrap: "wrap" }}>
            {event.where && <span style={{ fontSize: 10, color: subColor, fontWeight: 500 }}>📍 {event.where}</span>}
            {event.who && <span style={{ fontSize: 10, color: subColor, fontWeight: 500 }}>👥 {event.who}</span>}
          </div>
        )}
      </motion.div>

      {detailPanel}
    </>
  );
}
