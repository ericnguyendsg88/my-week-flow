import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { format, isToday, isTomorrow } from "date-fns";
import { motion } from "framer-motion";
import { X } from "lucide-react";
import { CalEvent, Tag, DURATIONS } from "@/types/event";
import { EventBubble } from "./EventBubble";
import { GapPlaceholder } from "./GapPlaceholder";
import { NowMarker } from "./NowMarker";
import { nowMinutes, minutesToLabel, durationLabel } from "@/lib/event-utils";

interface Props {
  date: Date;
  events: CalEvent[];
  tags: Tag[];
  onMark?: (eventId: string, completed: boolean | null) => void;
  onDelete?: (eventId: string) => void;
  onResize?: (eventId: string, newDuration: number) => void;
  onUpdate?: (eventId: string, patch: Partial<CalEvent>) => void;
  onCreate?: (event: CalEvent) => void;
  onMoveToDay?: (eventId: string, newDate: string) => void;
  onDayClick?: (date: Date) => void;
  isSelected?: boolean;
  focusMode?: boolean;
}

const timeToY = (mins: number) => Math.max(0, mins - 7 * 60);
const yToTime = (y: number) => y + 7 * 60;

type Section = "MORNING" | "AFTERNOON" | "EVENING";

const SECTION_STYLES: Record<Section, { color: string; lineColor: string; icon?: string }> = {
  MORNING:   { color: "#B08A4A", lineColor: "#E8D9C0" },
  AFTERNOON: { color: "#888580", lineColor: "#EAEAEA" },
  EVENING:   { color: "#6B62B8", lineColor: "#CEC8F0", icon: "🌙" },
};

function AbsoluteSectionHeader({ title, y }: { title: Section; y: number }) {
  const s = SECTION_STYLES[title];
  return (
    <div style={{ position: "absolute", top: y, left: 0, right: 0, display: "flex", alignItems: "center", gap: 6, zIndex: 2 }}>
      {s.icon && <span style={{ fontSize: 10, lineHeight: 1 }}>{s.icon}</span>}
      <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.05em", color: s.color }}>{title}</span>
      <div style={{ flex: 1, height: 1, background: s.lineColor }} />
    </div>
  );
}

function snapStart(mins: number) {
  return Math.round(mins / 15) * 15;
}

function snapDuration(mins: number) {
  return Math.max(15, Math.round(mins / 15) * 15);
}

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

interface DraftEvent {
  start: number;
  duration: number;
  anchorX: number;
  anchorY: number;
}

export function DayColumn({ date, events, tags, onMark, onDelete, onResize, onUpdate, onCreate, onMoveToDay, onDayClick, isSelected, focusMode }: Props) {
  const isT = isToday(date);
  const isTom = isTomorrow(date);
  const isWeekend = date.getDay() === 0 || date.getDay() === 6;

  let subtitle = format(date, "EEE d").toLowerCase();
  if (isT) subtitle = "today";
  if (isTom) subtitle = "tomorrow";
  if (isWeekend) subtitle = "open day";

  const now = nowMinutes();

  let bg = "#F8F8F6";
  let border = isSelected ? "2px solid #7B73D6" : "1px solid #EAEAEA";
  let titleColor = "#444441";
  let subColor = "#888580";

  if (isT) {
    bg = "#F2FAF0";
    border = isSelected ? "2px solid #3A8733" : "1px solid #B6DFB0";
    titleColor = "#1D5C17";
    subColor = "#3A8733";
  }

  const sorted = [...events].sort((a, b) => a.start - b.start);

  // ── resize-existing state ──
  const [resizingId, setResizingId] = useState<string | null>(null);
  const [liveDuration, setLiveDuration] = useState<number>(0);
  const resizeDragRef = useRef<{ startY: number; origDuration: number } | null>(null);

  function handleResizeMouseDown(ev: React.MouseEvent, event: CalEvent) {
    ev.preventDefault();
    ev.stopPropagation();
    setResizingId(event.id);
    setLiveDuration(event.duration);
    resizeDragRef.current = { startY: ev.clientY, origDuration: event.duration };

    function onMove(e: MouseEvent) {
      if (!resizeDragRef.current) return;
      const delta = e.clientY - resizeDragRef.current.startY;
      setLiveDuration(snapDuration(resizeDragRef.current.origDuration + delta));
    }

    function onUp(e: MouseEvent) {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      if (resizeDragRef.current) {
        const delta = e.clientY - resizeDragRef.current.startY;
        const newDur = snapDuration(resizeDragRef.current.origDuration + delta);
        if (newDur !== resizeDragRef.current.origDuration) onResize?.(event.id, newDur);
      }
      resizeDragRef.current = null;
      setResizingId(null);
    }

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }

  // ── within-day move drag ──
  const [movingId, setMovingId] = useState<string | null>(null);
  const [liveStart, setLiveStart] = useState<number>(0);
  const moveDragRef = useRef<{ startY: number; origStart: number } | null>(null);

  function handleEventMoveMouseDown(ev: React.MouseEvent, event: CalEvent) {
    // only trigger on the bubble body, not on resize handle
    if ((ev.target as HTMLElement).closest("[data-resize-handle]")) return;
    // don't preventDefault yet — let click events pass through if no real drag
    ev.stopPropagation();

    const startY = ev.clientY;
    let dragging = false;
    moveDragRef.current = { startY, origStart: event.start };

    function onMove(e: MouseEvent) {
      if (!moveDragRef.current) return;
      const delta = e.clientY - moveDragRef.current.startY;
      if (!dragging && Math.abs(delta) < 5) return; // dead zone before drag activates
      if (!dragging) {
        dragging = true;
        setMovingId(event.id);
        setLiveStart(event.start);
      }
      const newStart = snapStart(moveDragRef.current.origStart + delta);
      const clamped = Math.max(7 * 60, Math.min(22 * 60 - event.duration, newStart));
      setLiveStart(clamped);
    }

    function onUp(e: MouseEvent) {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      if (dragging && moveDragRef.current) {
        const delta = e.clientY - moveDragRef.current.startY;
        const newStart = snapStart(moveDragRef.current.origStart + delta);
        const clamped = Math.max(7 * 60, Math.min(22 * 60 - event.duration, newStart));
        if (clamped !== moveDragRef.current.origStart) onUpdate?.(event.id, { start: clamped });
      }
      moveDragRef.current = null;
      setMovingId(null);
    }

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }

  // ── cross-day drop target state ──
  const [isDragOver, setIsDragOver] = useState(false);

  function handleDragOver(e: React.DragEvent) {
    if (!onMoveToDay) return;
    if (!e.dataTransfer.types.includes("text/event-id")) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setIsDragOver(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    // only clear if we actually left the column (not entering a child)
    if (!timelineRef.current?.contains(e.relatedTarget as Node)) setIsDragOver(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragOver(false);
    const eventId = e.dataTransfer.getData("text/event-id");
    const newDate = format(date, "yyyy-MM-dd");
    if (eventId) onMoveToDay?.(eventId, newDate);
  }

  // ── drag-to-create state ──
  const timelineRef = useRef<HTMLDivElement>(null);
  const createDragRef = useRef<{ startY: number; startMins: number } | null>(null);
  const [ghost, setGhost] = useState<{ start: number; duration: number } | null>(null);
  const [draft, setDraft] = useState<DraftEvent | null>(null);

  // form fields for the creation panel
  const [draftTitle, setDraftTitle] = useState("");
  const [draftTagId, setDraftTagId] = useState("");
  const [draftLocation, setDraftLocation] = useState("");
  const [draftPeople, setDraftPeople] = useState("");

  function getRelativeY(clientY: number) {
    const rect = timelineRef.current?.getBoundingClientRect();
    return rect ? clientY - rect.top : 0;
  }

  function handleTimelineMouseDown(e: React.MouseEvent) {
    // only plain left-click on the timeline background, not on event bubbles
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest("[data-event]")) return;
    if (!onCreate) return;

    e.preventDefault();
    const rawY = getRelativeY(e.clientY);
    const startMins = snapStart(yToTime(rawY));
    createDragRef.current = { startY: e.clientY, startMins };
    setGhost({ start: startMins, duration: 15 });

    function onMove(ev: MouseEvent) {
      if (!createDragRef.current) return;
      const delta = ev.clientY - createDragRef.current.startY;
      const dur = snapDuration(delta > 0 ? delta : 15);
      setGhost({ start: createDragRef.current.startMins, duration: dur });
    }

    function onUp(ev: MouseEvent) {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      if (!createDragRef.current) return;

      const delta = ev.clientY - createDragRef.current.startY;
      const dur = snapDuration(Math.max(delta, 15));
      const finalStart = createDragRef.current.startMins;

      // open creation panel anchored to where drag ended
      const colRect = timelineRef.current?.getBoundingClientRect();
      const anchorX = colRect ? colRect.right + 12 : ev.clientX + 12;
      const anchorY = ev.clientY;

      setDraft({ start: finalStart, duration: dur, anchorX, anchorY });
      setDraftTitle("");
      setDraftTagId("");
      setDraftLocation("");
      setDraftPeople("");
      setGhost(null);
      createDragRef.current = null;
    }

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }

  function commitDraft() {
    if (!draft || !onCreate) return;
    const event: CalEvent = {
      id: crypto.randomUUID(),
      title: draftTitle.trim() || "Untitled",
      category: "work",
      tagId: draftTagId || undefined,
      date: format(date, "yyyy-MM-dd"),
      start: draft.start,
      duration: draft.duration,
      where: draftLocation.trim() || undefined,
      who: draftPeople.trim() || undefined,
    };
    onCreate(event);
    setDraft(null);
  }

  function cancelDraft() {
    setDraft(null);
    setGhost(null);
  }

  // position the creation panel smartly
  function panelPos(draft: DraftEvent) {
    const panelW = 360;
    const panelH = 540;
    const x = draft.anchorX + panelW > window.innerWidth
      ? draft.anchorX - panelW - 24
      : draft.anchorX;
    const y = Math.min(Math.max(draft.anchorY - 80, 16), window.innerHeight - panelH - 16);
    return { x, y };
  }

  const ghostColors = tagColors(draftTagId);

  const creationPanel = draft && createPortal(
    <>
      <div style={{ position: "fixed", inset: 0, zIndex: 998 }} onClick={cancelDraft} />
      <motion.div
        initial={{ opacity: 0, scale: 0.93, y: -6 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ type: "spring", stiffness: 420, damping: 28 }}
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "fixed",
          left: panelPos(draft).x,
          top: panelPos(draft).y,
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
        <div style={{ height: 8, background: draftTagId ? tagColors(draftTagId).bg : "#E6E4DD", flexShrink: 0 }} />

        {/* Header */}
        <div style={{ padding: "16px 18px 12px", display: "flex", alignItems: "flex-start", gap: 10, flexShrink: 0 }}>
          <div style={{ flex: 1 }}>
            <input
              autoFocus
              value={draftTitle}
              onChange={e => setDraftTitle(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") commitDraft(); if (e.key === "Escape") cancelDraft(); }}
              placeholder="Event title…"
              style={{ width: "100%", fontSize: 17, fontWeight: 700, color: "#111", background: "#F3F0FE", border: "2px solid #7B73D6", borderRadius: 10, padding: "6px 10px", outline: "none", boxSizing: "border-box" }}
            />
            <p style={{ fontSize: 12, color: "#999", marginTop: 5, fontWeight: 400 }}>
              {format(date, "EEE, MMM d")} · {minutesToLabel(draft.start)} → {minutesToLabel(draft.start + draft.duration)} · {durationLabel(draft.duration)}
            </p>
          </div>
          <button type="button" onClick={cancelDraft}
            style={{ background: "#F0EDEA", border: "none", borderRadius: 10, padding: 7, cursor: "pointer", color: "#888", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <X size={14} strokeWidth={2.5} />
          </button>
        </div>

        {/* Scrollable fields */}
        <div style={{ flex: 1, overflowY: "auto", padding: "0 18px 12px" }} className="scrollbar-hidden">

          {/* Duration */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: "#AAA", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 6 }}>Duration</label>
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
              {DURATIONS.map(d => (
                <button type="button" key={d}
                  onClick={() => setDraft(prev => prev ? { ...prev, duration: d } : prev)}
                  style={{
                    padding: "6px 12px", borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: "pointer",
                    background: draft.duration === d ? "#3C3489" : "#F5F3F0",
                    color: draft.duration === d ? "#fff" : "#3C3489",
                    border: "1.5px solid " + (draft.duration === d ? "#3C3489" : "rgba(123,115,214,0.22)"),
                  }}>{durationLabel(d)}</button>
              ))}
            </div>
          </div>

          {/* Tag */}
          {tags && tags.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: "#AAA", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 6 }}>Tag</label>
              <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                <button type="button" onClick={() => setDraftTagId("")} style={{
                  padding: "5px 12px", borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: "pointer",
                  background: draftTagId === "" ? "#555" : "#F0EDEA",
                  color: draftTagId === "" ? "#fff" : "#888",
                  border: "none",
                }}>none</button>
                {tags.map(t => {
                  const tc = tagColors(t.id);
                  return (
                    <button type="button" key={t.id} onClick={() => setDraftTagId(t.id)} style={{
                      padding: "5px 12px", borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: "pointer",
                      background: draftTagId === t.id ? tc.text : tc.bg,
                      color: draftTagId === t.id ? "#fff" : tc.text,
                      border: "none",
                    }}>#{t.name}</button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Location */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: "#AAA", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 6 }}>Location</label>
            <input
              value={draftLocation}
              onChange={e => setDraftLocation(e.target.value)}
              placeholder="e.g. Coffee Lab, Zoom…"
              style={{ width: "100%", background: "#F5F3F0", border: "1.5px solid rgba(123,115,214,0.22)", borderRadius: 10, padding: "8px 12px", fontSize: 13, color: "#3C3489", outline: "none", boxSizing: "border-box" }}
            />
          </div>

          {/* People */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: "#AAA", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 6 }}>People</label>
            <input
              value={draftPeople}
              onChange={e => setDraftPeople(e.target.value)}
              placeholder="e.g. Alice, the team…"
              style={{ width: "100%", background: "#F5F3F0", border: "1.5px solid rgba(123,115,214,0.22)", borderRadius: 10, padding: "8px 12px", fontSize: 13, color: "#3C3489", outline: "none", boxSizing: "border-box" }}
            />
          </div>
        </div>

        {/* Footer actions */}
        <div style={{ flexShrink: 0, borderTop: "1px solid #EDEBE7", padding: "12px 18px 16px", display: "flex", gap: 8 }}>
          <button type="button" onClick={commitDraft}
            style={{ flex: 1, background: "#3C3489", color: "#fff", border: "none", borderRadius: 12, padding: "11px 0", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
            Create event
          </button>
          <button type="button" onClick={cancelDraft}
            style={{ flex: 1, background: "#F0EDEA", color: "#666", border: "none", borderRadius: 12, padding: "11px 0", fontSize: 14, cursor: "pointer" }}>
            Cancel
          </button>
        </div>
      </motion.div>
    </>,
    document.body
  );

  return (
    <div style={{
      flex: 1,
      background: bg,
      border,
      borderRadius: 16,
      display: "flex",
      flexDirection: "column",
      minWidth: focusMode ? 0 : 120,
      minHeight: 80 + 15 * 60,
      position: "relative",
    }}>
      {/* Header — clickable to sync left panel */}
      <div
        onClick={() => onDayClick?.(date)}
        style={{ padding: "16px 16px 8px", height: 80, boxSizing: "border-box", flexShrink: 0, cursor: onDayClick ? "pointer" : "default", borderRadius: "16px 16px 0 0" }}
      >
        <h3 style={{ fontSize: focusMode ? 20 : 16, fontWeight: 600, color: titleColor }}>{format(date, "EEEE")}</h3>
        <p style={{ fontSize: 13, color: subColor, fontWeight: 500, marginTop: 2 }}>{subtitle}</p>
      </div>

      {/* Timeline */}
      <div
        ref={timelineRef}
        onMouseDown={handleTimelineMouseDown}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        style={{
          position: "relative", height: 15 * 60, margin: "0 12px",
          cursor: onCreate ? "crosshair" : "default",
          outline: isDragOver ? "2px dashed #7B73D6" : "none",
          outlineOffset: 2,
          borderRadius: 8,
          transition: "outline 0.1s",
        }}
      >
        {/* Hour grid lines */}
        {Array.from({ length: 16 }, (_, i) => i).map((i) => (
          <div key={`hr-${i}`} style={{ position: "absolute", top: i * 60, left: 0, right: 0, borderTop: i === 0 ? "none" : "1px solid rgba(0,0,0,0.05)", pointerEvents: "none", zIndex: 1 }} />
        ))}
        {Array.from({ length: 15 }, (_, i) => i).map((i) => (
          <div key={`hh-${i}`} style={{ position: "absolute", top: i * 60 + 30, left: 0, right: 0, borderTop: "1px dashed rgba(0,0,0,0.03)", pointerEvents: "none", zIndex: 1 }} />
        ))}

        {/* Evening tint band */}
        <div style={{
          position: "absolute",
          top: timeToY(17 * 60),
          left: 0, right: 0,
          height: timeToY(22 * 60) - timeToY(17 * 60),
          background: "rgba(107,98,184,0.045)",
          borderRadius: 8,
          pointerEvents: "none",
          zIndex: 0,
        }} />

        {/* Section headers */}
        <AbsoluteSectionHeader title="MORNING"   y={timeToY(7 * 60)} />
        <AbsoluteSectionHeader title="AFTERNOON" y={timeToY(12 * 60)} />
        <AbsoluteSectionHeader title="EVENING"   y={timeToY(17 * 60)} />

        {/* Weekend free-evening hint */}
        {isWeekend && (
          <div style={{ position: "absolute", top: timeToY(17 * 60) + 24, left: 0, right: 0, background: "rgba(107,98,184,0.08)", border: "1px dashed #A89FE0", borderRadius: 8, padding: "10px", textAlign: "center", pointerEvents: "none" }}>
            <p style={{ fontSize: 13, fontWeight: 500, color: "#6B62B8" }}>🌙 free evening</p>
            <p style={{ fontSize: 11, color: "#6B62B8", opacity: 0.8 }}>protect this?</p>
          </div>
        )}

        {/* Ghost block while drag-creating */}
        {ghost && (
          <div
            style={{
              position: "absolute",
              top: timeToY(ghost.start),
              left: 0, right: 0,
              height: ghost.duration,
              borderRadius: 8,
              background: ghostColors.bg,
              border: `2px dashed ${ghostColors.text}`,
              opacity: 0.65,
              pointerEvents: "none",
              zIndex: 12,
              display: "flex",
              alignItems: "flex-start",
              padding: "5px 8px",
              boxSizing: "border-box",
            }}
          >
            <span style={{ fontSize: 11, fontWeight: 600, color: ghostColors.text }}>
              {minutesToLabel(ghost.start)} · {durationLabel(ghost.duration)}
            </span>
          </div>
        )}

        {/* Events */}
        {sorted.map((ev) => {
          const isResizing = resizingId === ev.id;
          const isMoving = movingId === ev.id;
          const displayDuration = isResizing ? liveDuration : ev.duration;
          const displayStart = isMoving ? liveStart : ev.start;
          return (
            <div
              key={ev.id}
              data-event="true"
              draggable={!!onMoveToDay && !isMoving}
              onDragStart={(e) => {
                e.dataTransfer.setData("text/event-id", ev.id);
                e.dataTransfer.effectAllowed = "move";
              }}
              onMouseDown={(e) => handleEventMoveMouseDown(e, ev)}
              style={{
                position: "absolute",
                top: timeToY(displayStart),
                left: 0, right: 0,
                height: Math.max(displayDuration, 76),
                zIndex: isResizing ? 15 : isMoving ? 16 : 10,
                transition: (isResizing || isMoving) ? "none" : undefined,
                cursor: isMoving ? "grabbing" : "grab",
                opacity: isMoving ? 0.85 : 1,
              }}
            >
              <EventBubble
                event={ev}
                tags={tags}
                onMark={onMark ? (c) => onMark(ev.id, c) : undefined}
                onDelete={onDelete ? () => onDelete(ev.id) : undefined}
                onUpdate={onUpdate ? (patch) => onUpdate(ev.id, patch) : undefined}
                isResizing={isResizing || isMoving}
              />

              {/* Live time tooltip while moving */}
              {isMoving && (
                <div style={{
                  position: "absolute",
                  top: 6, right: 8,
                  background: "#3C3489",
                  color: "#fff",
                  fontSize: 10,
                  fontWeight: 600,
                  borderRadius: 6,
                  padding: "2px 7px",
                  pointerEvents: "none",
                  zIndex: 25,
                  whiteSpace: "nowrap",
                }}>
                  {minutesToLabel(liveStart)}
                </div>
              )}

              {/* Resize handle */}
              {onResize && (
                <div
                  data-resize-handle="true"
                  onMouseDown={(e) => handleResizeMouseDown(e, ev)}
                  style={{
                    position: "absolute",
                    bottom: 0, left: 6, right: 6,
                    height: 10,
                    cursor: "ns-resize",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    zIndex: 20,
                    borderRadius: "0 0 8px 8px",
                    background: isResizing ? "rgba(107,98,184,0.12)" : "transparent",
                    transition: "background 0.15s",
                  }}
                  onMouseEnter={(e) => { if (!isResizing) (e.currentTarget as HTMLDivElement).style.background = "rgba(0,0,0,0.07)"; }}
                  onMouseLeave={(e) => { if (!isResizing) (e.currentTarget as HTMLDivElement).style.background = "transparent"; }}
                >
                  <div style={{
                    width: 24, height: 3, borderRadius: 2,
                    background: isResizing ? "#7B73D6" : "rgba(0,0,0,0.18)",
                    transition: "background 0.15s, width 0.15s",
                  }} />
                </div>
              )}

              {/* Live duration tooltip while resizing */}
              {isResizing && !isMoving && (
                <div style={{
                  position: "absolute",
                  bottom: 14, right: 8,
                  background: "#3C3489",
                  color: "#fff",
                  fontSize: 10,
                  fontWeight: 600,
                  borderRadius: 6,
                  padding: "2px 7px",
                  pointerEvents: "none",
                  zIndex: 25,
                  whiteSpace: "nowrap",
                }}>
                  {liveDuration >= 60
                    ? `${Math.floor(liveDuration / 60)}h${liveDuration % 60 > 0 ? ` ${liveDuration % 60}m` : ""}`
                    : `${liveDuration}m`}
                </div>
              )}
            </div>
          );
        })}

        {/* Gaps */}
        {sorted.map((ev, i) => {
          if (i < sorted.length - 1) {
            const gap = sorted[i + 1].start - (ev.start + ev.duration);
            if (gap >= 60) return (
              <div key={`gap-${ev.id}`} style={{ position: "absolute", top: timeToY(ev.start + ev.duration), left: 0, right: 0, height: gap, padding: "8px 0", boxSizing: "border-box" }}>
                <GapPlaceholder minutes={gap} />
              </div>
            );
          }
          return null;
        })}

        {/* Now marker */}
        {isT && now >= 7 * 60 && now <= 22 * 60 && (
          <div style={{ position: "absolute", top: timeToY(now) - 12, left: 0, right: 0, zIndex: 20 }}>
            <NowMarker />
          </div>
        )}
      </div>

      {creationPanel}
    </div>
  );
}
