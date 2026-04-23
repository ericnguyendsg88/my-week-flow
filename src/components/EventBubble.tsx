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

// ── tiny inline mini-calendar used in the edit panel ──────────────
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
        <button onClick={() => setViewMonth(m => subMonths(m, 1))} style={{ background: "none", border: "none", cursor: "pointer", color: "#7B73D6", fontSize: 16, padding: "0 6px" }}>‹</button>
        <span style={{ fontSize: 11, fontWeight: 700, color: "#3C3489" }}>{format(viewMonth, "MMM yyyy")}</span>
        <button onClick={() => setViewMonth(m => addMonths(m, 1))} style={{ background: "none", border: "none", cursor: "pointer", color: "#7B73D6", fontSize: 16, padding: "0 6px" }}>›</button>
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
            <button key={key} onClick={() => onSelect(key)} style={{
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

// ── time slot picker (30-min grid) ────────────────────────────────
function EditTimePicker({ selected, onSelect }: { selected: number; onSelect: (m: number) => void }) {
  const slots: number[] = [];
  for (let t = 7 * 60; t <= 22 * 60; t += 30) slots.push(t);
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 3, maxHeight: 150, overflowY: "auto" }} className="scrollbar-hidden">
      {slots.map(t => (
        <button key={t} onClick={() => onSelect(t)} style={{
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

type EditField = "title" | "date" | "time" | "duration" | "tag" | "location" | "people" | null;

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

  // edit state
  const [editField, setEditField] = useState<EditField>(null);
  const [editTitle, setEditTitle] = useState(event.title);
  const [editDate, setEditDate] = useState(event.date);
  const [editStart, setEditStart] = useState(event.start);
  const [editDuration, setEditDuration] = useState(event.duration);
  const [editTagId, setEditTagId] = useState(event.tagId ?? "");
  const [editLocation, setEditLocation] = useState(event.where ?? "");
  const [editPeople, setEditPeople] = useState(event.who ?? "");

  // reset edit state whenever the panel opens or event changes
  useEffect(() => {
    if (showDetail) {
      setEditTitle(event.title);
      setEditDate(event.date);
      setEditStart(event.start);
      setEditDuration(event.duration);
      setEditTagId(event.tagId ?? "");
      setEditLocation(event.where ?? "");
      setEditPeople(event.who ?? "");
      setEditField(null);
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
    const panelW = 280;
    const panelH = 420;
    const x = rect.right + 12 + panelW > window.innerWidth
      ? rect.left - panelW - 12
      : rect.right + 12;
    const y = Math.min(rect.top, window.innerHeight - panelH - 16);
    setPanelPos({ x, y });
    setShowDetail((v) => !v);
  }

  function saveField(field: EditField) {
    if (!onUpdate) { setEditField(null); return; }
    switch (field) {
      case "title":    onUpdate({ title: editTitle.trim() || event.title }); break;
      case "date":     onUpdate({ date: editDate }); break;
      case "time":     onUpdate({ start: editStart }); break;
      case "duration": onUpdate({ duration: editDuration }); break;
      case "tag":      onUpdate({ tagId: editTagId }); break;
      case "location": onUpdate({ where: editLocation.trim() || undefined }); break;
      case "people":   onUpdate({ who: editPeople.trim() || undefined }); break;
    }
    setEditField(null);
  }

  function EditRow({ label, field, display, children }: { label: string; field: EditField; display: React.ReactNode; children: React.ReactNode }) {
    const isEditing = editField === field;
    return (
      <div style={{ marginBottom: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 11, color: "#888", minWidth: 52, fontWeight: 500 }}>{label}</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: "#333", flex: 1 }}>{display}</span>
          {onUpdate && (
            <button
              onClick={() => setEditField(isEditing ? null : field)}
              style={{ background: isEditing ? "#3C3489" : "#F0EDEA", border: "none", borderRadius: 6, padding: "3px 6px", cursor: "pointer", color: isEditing ? "#fff" : "#888", display: "flex", alignItems: "center", flexShrink: 0 }}
            >
              <Pencil size={10} strokeWidth={2} />
            </button>
          )}
        </div>
        {isEditing && (
          <div style={{ marginTop: 6, marginLeft: 60, background: "#F3F0FE", borderRadius: 10, padding: 10 }}>
            {children}
            <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
              <button onClick={() => saveField(field)} style={{ flex: 1, background: "#3C3489", color: "#fff", border: "none", borderRadius: 8, padding: "6px 0", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Save</button>
              <button onClick={() => setEditField(null)} style={{ flex: 1, background: "#E8E5F0", color: "#666", border: "none", borderRadius: 8, padding: "6px 0", fontSize: 12, cursor: "pointer" }}>Cancel</button>
            </div>
          </div>
        )}
      </div>
    );
  }

  const endMin = event.start + event.duration;
  const dateLabel = (() => {
    try { return format(new Date(event.date + "T00:00:00"), "EEE, MMM d"); } catch { return event.date; }
  })();

  const displayTag = tags ? getTag(tags, editTagId) : undefined;

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
          width: 280,
          background: "#FAFAF8",
          borderRadius: 18,
          boxShadow: "0 20px 60px -8px rgba(0,0,0,0.22), 0 4px 16px -4px rgba(0,0,0,0.10)",
          border: "1px solid rgba(0,0,0,0.07)",
          zIndex: 999,
          overflow: "hidden",
          maxHeight: "90vh",
          overflowY: "auto",
        }}
        className="scrollbar-hidden"
      >
        {/* Color stripe */}
        <div style={{ height: 6, background: bgColor }} />

        {/* Header — editable title */}
        <div style={{ padding: "14px 16px 0", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
          {editField === "title" ? (
            <div style={{ flex: 1, display: "flex", gap: 6 }}>
              <input
                autoFocus
                value={editTitle}
                onChange={e => setEditTitle(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") saveField("title"); if (e.key === "Escape") setEditField(null); }}
                style={{ flex: 1, fontSize: 14, fontWeight: 700, color: "#111", background: "#F3F0FE", border: "1.5px solid #7B73D6", borderRadius: 8, padding: "5px 8px", outline: "none" }}
              />
              <button onClick={() => saveField("title")} style={{ background: "#3C3489", color: "#fff", border: "none", borderRadius: 8, padding: "5px 10px", fontSize: 12, cursor: "pointer" }}>✓</button>
            </div>
          ) : (
            <h3
              onClick={() => onUpdate && setEditField("title")}
              style={{ fontSize: 15, fontWeight: 700, color: "#111", lineHeight: 1.3, flex: 1, cursor: onUpdate ? "text" : "default" }}
              title={onUpdate ? "Click to edit title" : undefined}
            >
              {event.title}
            </h3>
          )}
          <button
            onClick={() => setShowDetail(false)}
            style={{ background: "#F0EDEA", border: "none", borderRadius: 8, padding: 5, cursor: "pointer", color: "#888", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
          >
            <X size={13} strokeWidth={2.5} />
          </button>
        </div>

        {/* Info rows */}
        <div style={{ padding: "12px 16px 10px" }}>
          <EditRow label="date" field="date" display={dateLabel}>
            <EditMiniCal selected={editDate} onSelect={d => setEditDate(d)} />
          </EditRow>

          <EditRow
            label="time"
            field="time"
            display={<>{minutesToLabel(event.start)} → {minutesToLabel(endMin)} <span style={{ fontSize: 11, color: "#aaa", fontWeight: 400 }}>· {durationLabel(event.duration)}</span></>}
          >
            <EditTimePicker selected={editStart} onSelect={t => setEditStart(t)} />
          </EditRow>

          <EditRow label="duration" field="duration" display={durationLabel(event.duration)}>
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
              {DURATIONS.map(d => (
                <button key={d} onClick={() => setEditDuration(d)} style={{
                  padding: "5px 10px", borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: "pointer",
                  background: editDuration === d ? "#3C3489" : "#fff",
                  color: editDuration === d ? "#fff" : "#3C3489",
                  border: "1.5px solid " + (editDuration === d ? "#3C3489" : "rgba(123,115,214,0.25)"),
                }}>{durationLabel(d)}</button>
              ))}
            </div>
          </EditRow>

          {tags && tags.length > 0 && (
            <EditRow label="tag" field="tag" display={
              displayTag
                ? <span style={{ fontSize: 11, fontWeight: 700, background: tagColors(displayTag.id).bg, color: tagColors(displayTag.id).text, borderRadius: 12, padding: "2px 10px" }}>#{displayTag.name}</span>
                : <span style={{ color: "#aaa", fontSize: 12 }}>none</span>
            }>
              <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                {tags.map(t => {
                  const tc = tagColors(t.id);
                  return (
                    <button key={t.id} onClick={() => setEditTagId(t.id)} style={{
                      padding: "4px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: "pointer",
                      background: editTagId === t.id ? tc.text : tc.bg,
                      color: editTagId === t.id ? "#fff" : tc.text,
                      border: "none",
                    }}>#{t.name}</button>
                  );
                })}
              </div>
            </EditRow>
          )}

          <EditRow label="where" field="location" display={event.where ? <span>📍 {event.where}</span> : <span style={{ color: "#bbb" }}>—</span>}>
            <input
              autoFocus
              value={editLocation}
              onChange={e => setEditLocation(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") saveField("location"); if (e.key === "Escape") setEditField(null); }}
              placeholder="e.g. Coffee Lab, Zoom…"
              style={{ width: "100%", background: "#fff", border: "1px solid rgba(123,115,214,0.3)", borderRadius: 8, padding: "6px 8px", fontSize: 12, color: "#3C3489", outline: "none", boxSizing: "border-box" }}
            />
          </EditRow>

          <EditRow label="who" field="people" display={event.who ? <span>👥 {event.who}</span> : <span style={{ color: "#bbb" }}>—</span>}>
            <input
              autoFocus
              value={editPeople}
              onChange={e => setEditPeople(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") saveField("people"); if (e.key === "Escape") setEditField(null); }}
              placeholder="e.g. Alice, the team…"
              style={{ width: "100%", background: "#fff", border: "1px solid rgba(123,115,214,0.3)", borderRadius: 8, padding: "6px 8px", fontSize: 12, color: "#3C3489", outline: "none", boxSizing: "border-box" }}
            />
          </EditRow>

          {(isCompleted || isSkipped) && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
              <span style={{ fontSize: 11, color: "#888", minWidth: 52, fontWeight: 500 }}>status</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: isCompleted ? "#27500A" : "#888", background: isCompleted ? "#D8F0B8" : "#EDEBE7", borderRadius: 12, padding: "2px 10px" }}>
                {isCompleted ? "✓ done" : "✗ didn't happen"}
              </span>
            </div>
          )}
        </div>

        <div style={{ height: 1, background: "#EDEBE7", margin: "0 16px" }} />

        {/* Completion actions */}
        {onMark && (
          <div style={{ padding: "10px 16px", display: "flex", gap: 6 }}>
            <button
              onClick={() => { onMark(true); setShowDetail(false); }}
              style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 5, background: isCompleted ? "#C8E6A8" : "#EBF3D8", color: "#2E5513", border: isCompleted ? "2px solid #8DC86E" : "2px solid transparent", borderRadius: 12, padding: "8px 0", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
            >
              <Check size={12} strokeWidth={2.5} /> Done
            </button>
            <button
              onClick={() => { onMark(false); setShowDetail(false); }}
              style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 5, background: isSkipped ? "#DEDAD4" : "#F5F3F0", color: "#555", border: isSkipped ? "2px solid #B0ABA4" : "2px solid transparent", borderRadius: 12, padding: "8px 0", fontSize: 12, fontWeight: 500, cursor: "pointer" }}
            >
              <Ban size={12} strokeWidth={2} /> Skip
            </button>
            {event.completed != null && (
              <button
                onClick={() => { onMark(null); setShowDetail(false); }}
                title="undo"
                style={{ display: "flex", alignItems: "center", justifyContent: "center", background: "#F5F3F0", color: "#999", border: "none", borderRadius: 12, padding: "8px 10px", fontSize: 12, cursor: "pointer" }}
              >
                <RotateCcw size={12} strokeWidth={2} />
              </button>
            )}
          </div>
        )}

        {/* Attached items */}
        {(event.attachedItems?.length ?? 0) > 0 && (
          <>
            <div style={{ height: 1, background: "#EDEBE7", margin: "0 16px" }} />
            <div style={{ padding: "8px 16px 4px" }}>
              <p style={{ fontSize: 10, fontWeight: 600, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Attached</p>
              {event.attachedItems!.map((att) => {
                const Icon = KIND_ICON[att.kind] ?? Lightbulb;
                const kc = KIND_COLORS[att.kind];
                return (
                  <div key={att.id} style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 5 }}>
                    <span style={{ width: 18, height: 18, borderRadius: 5, background: kc.bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <Icon size={10} color={kc.text} strokeWidth={2} />
                    </span>
                    <span style={{ fontSize: 11, fontWeight: 500, color: "#333", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{att.title}</span>
                    {att.url && (
                      <button onClick={() => window.open(att.url, "_blank")} style={{ background: "none", border: "none", cursor: "pointer", padding: 2, color: "#aaa" }}>
                        <ExternalLink size={10} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}

        <div style={{ height: 1, background: "#EDEBE7", margin: "0 16px" }} />

        {/* Delete */}
        {onDelete && (
          <div style={{ padding: "10px 16px 14px" }}>
            <button
              onClick={() => { onDelete(); setShowDetail(false); }}
              style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, background: "#FEF0EE", color: "#C0392B", border: "1.5px solid #FACEC9", borderRadius: 12, padding: "8px 0", fontSize: 12, fontWeight: 600, cursor: "pointer", transition: "background 0.15s" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#FDDBD8")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "#FEF0EE")}
            >
              <Trash2 size={13} strokeWidth={2} /> Delete event
            </button>
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
