import { useRef, useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { format, isToday, isTomorrow } from "date-fns";
import { motion, AnimatePresence } from "framer-motion"; // AnimatePresence used in event panels
import { X, CheckSquare } from "lucide-react";
import { CalEvent, CaptureItem, Tag, DURATIONS } from "@/types/event";
import { EventBubble } from "./EventBubble";
import { NowMarker } from "./NowMarker";
import { nowMinutes, minutesToLabel, durationLabel } from "@/lib/event-utils";
import { patchCapture } from "@/lib/capture-store";

// ── Day type ──────────────────────────────────────────────────────────
export type DayType = "work" | "holiday" | "free" | "travel" | "sick" | "focus";

export const DAY_TYPES: { id: DayType; label: string; emoji: string; bg: string; text: string; headerBg: string; border: string }[] = [
  { id: "work",    label: "Work day",   emoji: "💼", bg: "#EEEDFE", text: "#3C3489", headerBg: "#EEEDFE", border: "#C5BEF5" },
  { id: "focus",   label: "Focus day",  emoji: "🎯", bg: "#E1F5EE", text: "#085041", headerBg: "#E1F5EE", border: "#9FE1CB" },
  { id: "free",    label: "Free day",   emoji: "🌿", bg: "#EAF3DE", text: "#27500A", headerBg: "#EAF3DE", border: "#B8DDA0" },
  { id: "holiday", label: "Holiday",    emoji: "🎉", bg: "#FAEEDA", text: "#633806", headerBg: "#FAEEDA", border: "#FAC775" },
  { id: "travel",  label: "Travel",     emoji: "✈️", bg: "#E6F1FB", text: "#0C447C", headerBg: "#E6F1FB", border: "#B5D4F4" },
  { id: "sick",    label: "Sick day",   emoji: "🤒", bg: "#FEF0EE", text: "#C0392B", headerBg: "#FEF0EE", border: "#FACEC9" },
];

const DAY_TYPE_STORAGE = "horizon_day_types";

function loadDayTypes(): Record<string, DayType> {
  try { return JSON.parse(localStorage.getItem(DAY_TYPE_STORAGE) ?? "{}"); } catch { return {}; }
}

function saveDayType(dateKey: string, type: DayType | null) {
  const all = loadDayTypes();
  if (type === null) delete all[dateKey];
  else all[dateKey] = type;
  localStorage.setItem(DAY_TYPE_STORAGE, JSON.stringify(all));
}

function useDayType(dateKey: string) {
  const [type, setType] = useState<DayType | null>(() => loadDayTypes()[dateKey] ?? null);
  function update(t: DayType | null) {
    saveDayType(dateKey, t);
    setType(t);
  }
  return [type, update] as const;
}

const PANEL_MARGIN = 16;
const PANEL_WIDTH = 360;

interface Props {
  date: Date;
  events: CalEvent[];
  tags: Tag[];
  taskItems?: CaptureItem[];
  onMark?: (eventId: string, completed: boolean | null) => void;
  onDelete?: (eventId: string) => void;
  onResize?: (eventId: string, newDuration: number) => void;
  onUpdate?: (eventId: string, patch: Partial<CalEvent>) => void;
  onCreate?: (event: CalEvent) => void;
  onMoveToDay?: (eventId: string, newDate: string) => void;
  onCopyEvent?: (event: CalEvent) => void;
  onSelectEvent?: (event: CalEvent | null) => void;
  onDayClick?: (date: Date) => void;
  isSelected?: boolean;
  focusMode?: boolean;
  compact?: boolean;
}

const timeToY = (mins: number) => Math.max(0, mins - 7 * 60);
const yToTime = (y: number) => y + 7 * 60;

type Section = "MORNING" | "AFTERNOON" | "EVENING";

const SECTION_STYLES: Record<Section, { color: string; lineColor: string; icon?: string }> = {
  MORNING:   { color: "#A8A4A0", lineColor: "#EDEBE7" },
  AFTERNOON: { color: "#A8A4A0", lineColor: "#EDEBE7" },
  EVENING:   { color: "#AFA9EC", lineColor: "#E0DEFC", icon: "🌙" },
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

function tagColors(tagId?: string): { bg: string; text: string; sub: string; pale: string } {
  switch (tagId) {
    case "work":     return { bg: "#AFA9EC", text: "#3C3489", sub: "#534AB7", pale: "#EEEDFE" };
    case "deepwork": return { bg: "#9FE1CB", text: "#085041", sub: "#0F6E56", pale: "#E1F5EE" };
    case "study":    return { bg: "#B5D4F4", text: "#0C447C", sub: "#185FA5", pale: "#E6F1FB" };
    case "personal": return { bg: "#F4C0D1", text: "#72243E", sub: "#993556", pale: "#FBEAF0" };
    case "social":   return { bg: "#FAC775", text: "#633806", sub: "#854F0B", pale: "#FAEEDA" };
    case "health":   return { bg: "#C0DD97", text: "#27500A", sub: "#3B6D11", pale: "#EAF3DE" };
    case "errand":   return { bg: "#F5C4B3", text: "#712B13", sub: "#993C1D", pale: "#FAECE7" };
    default:         return { bg: "#D3D1C7", text: "#444441", sub: "#5F5E5A", pale: "#F1EFE8" };
  }
}

interface DraftEvent {
  start: number;
  duration: number;
  anchorX: number;
  anchorY: number;
}

// ── Task Pill — floating timed task on the timeline ───────────────
function TaskPill({ task, timelineRef }: { task: CaptureItem; timelineRef: React.RefObject<HTMLDivElement | null> }) {
  const dragRef = useRef<{ startY: number; origStart: number } | null>(null);
  const [liveStart, setLiveStart] = useState(task.start!);
  const [dragging, setDragging] = useState(false);
  const [done, setDone] = useState(false);

  function handleMouseDown(e: React.MouseEvent) {
    e.stopPropagation();
    dragRef.current = { startY: e.clientY, origStart: liveStart };
    setDragging(true);

    function onMove(ev: MouseEvent) {
      if (!dragRef.current) return;
      const deltaY = ev.clientY - dragRef.current.startY;
      const newStart = Math.max(7 * 60, Math.min(21 * 60, snapStart(dragRef.current.origStart + deltaY)));
      setLiveStart(newStart);
    }
    function onUp() {
      if (dragRef.current) {
        patchCapture(task.id, { start: liveStart });
      }
      dragRef.current = null;
      setDragging(false);
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    }
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }

  const topY = timeToY(liveStart);
  const tagC = (() => {
    switch (task.tagId) {
      case "work":     return { bg: "#EAE8FB", text: "#3C3489", border: "#C5BEF5" };
      case "deepwork": return { bg: "#D6F5E8", text: "#1A5C3A", border: "#9FE1CB" };
      case "study":    return { bg: "#DCEEFA", text: "#08305A", border: "#A2CAE8" };
      case "personal": return { bg: "#FBEAF0", text: "#72243E", border: "#F4C0D1" };
      case "social":   return { bg: "#FEF3C7", text: "#92400E", border: "#FAC775" };
      default:         return { bg: "#F0EDE8", text: "#4A4540", border: "#D4CEC8" };
    }
  })();

  return (
    <div
      onMouseDown={handleMouseDown}
      style={{
        position: "absolute",
        top: topY,
        left: 4, right: 4,
        height: 22,
        zIndex: 13,
        cursor: dragging ? "grabbing" : "grab",
        display: "flex",
        alignItems: "center",
        userSelect: "none",
      }}
    >
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 5,
        padding: "3px 8px 3px 6px",
        borderRadius: 20,
        background: done ? "#D6F5E8" : tagC.bg,
        border: `1.5px ${done ? "solid" : "dashed"} ${done ? "#9FE1CB" : tagC.border}`,
        boxShadow: dragging ? "0 4px 14px rgba(0,0,0,0.14)" : "0 1px 4px rgba(0,0,0,0.07)",
        fontSize: 10,
        fontWeight: 600,
        color: done ? "#1A5C3A" : tagC.text,
        maxWidth: "100%",
        overflow: "hidden",
        transition: "box-shadow 0.15s",
        backdropFilter: "blur(4px)",
        WebkitBackdropFilter: "blur(4px)",
        opacity: done ? 0.65 : 1,
      }}>
        <button
          onMouseDown={e => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); setDone(d => !d); patchCapture(task.id, { placed: !done }); }}
          style={{ background: "none", border: "none", padding: 0, cursor: "pointer", display: "flex", alignItems: "center", flexShrink: 0 }}
        >
          <CheckSquare size={10} color={done ? "#1A5C3A" : tagC.text} strokeWidth={2.5} />
        </button>
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textDecoration: done ? "line-through" : "none", opacity: done ? 0.7 : 1 }}>
          {task.title}
        </span>
        <span style={{ flexShrink: 0, opacity: 0.55, fontSize: 9, marginLeft: 2 }}>
          {minutesToLabel(liveStart)}
        </span>
      </div>
    </div>
  );
}

export function DayColumn({ date, events, tags, taskItems = [], onMark, onDelete, onResize, onUpdate, onCreate, onMoveToDay, onCopyEvent, onSelectEvent, onDayClick, isSelected, focusMode, compact }: Props) {
  const isT = isToday(date);
  const isTom = isTomorrow(date);
  const isWeekend = date.getDay() === 0 || date.getDay() === 6;
  const dateKey = format(date, "yyyy-MM-dd");

  const [dayType, setDayType] = useDayType(dateKey);
  const [showTypePicker, setShowTypePicker] = useState(false);
  const [pickerPos, setPickerPos] = useState({ top: 0, left: 0 });
  const typePickerRef = useRef<HTMLDivElement>(null);
  const typeBtnRef = useRef<HTMLButtonElement>(null);

  // Close picker on outside click
  useEffect(() => {
    if (!showTypePicker) return;
    function onDown(e: MouseEvent) {
      if (
        typePickerRef.current && !typePickerRef.current.contains(e.target as Node) &&
        typeBtnRef.current && !typeBtnRef.current.contains(e.target as Node)
      ) {
        setShowTypePicker(false);
      }
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [showTypePicker]);

  const dayTypeDef = dayType ? DAY_TYPES.find(d => d.id === dayType) : null;

  let subtitle = format(date, "EEE d").toLowerCase();
  if (isT) subtitle = "today";
  else if (isTom) subtitle = "tomorrow";
  else if (dayTypeDef) subtitle = dayTypeDef.label.toLowerCase();
  else if (isWeekend) subtitle = "open day";

  const now = nowMinutes();

  // Day type strip color
  const stripColor = dayTypeDef ? dayTypeDef.border : null;

  // Day column chrome — design system colors
  let bg = "#FFFFFF";
  let headerBg = "transparent";
  let border = "0.5px solid #E5E4E0";
  let titleColor = "#444441";
  let subColor = "#888580";

  if (isT) {
    bg = "#FFFFFF";
    headerBg = "#EAF3DE";
    border = "1.5px solid #3B6D11";
    titleColor = "#27500A";
    subColor = "#3B6D11";
  } else if (isSelected) {
    bg = "#FFFFFF";
    headerBg = dayTypeDef ? dayTypeDef.headerBg : "transparent";
    const selColor = dayTypeDef ? dayTypeDef.border : "#C8C4BE";
    border = `1.5px solid ${selColor}`;
    titleColor = dayTypeDef ? dayTypeDef.text : "#444441";
    subColor = dayTypeDef ? dayTypeDef.text : "#888580";
  } else if (isTom) {
    bg = "#FFFFFF";
    headerBg = "#FAFAFA";
    border = "0.5px solid #E5E4E0";
  }

  const sorted = [...events].sort((a, b) => a.start - b.start);

  // Calculate overlapping events and their columns (max 4 side by side)
  const getEventLayout = (event: CalEvent, allEvents: CalEvent[]) => {
    const eventEnd = event.start + event.duration;
    const overlapping = allEvents.filter(e => {
      if (e.id === event.id) return false;
      const eEnd = e.start + e.duration;
      return !(eEnd <= event.start || e.start >= eventEnd);
    });
    
    // Find which column this event should occupy
    let column = 0;
    const sortedOverlapping = [...overlapping].sort((a, b) => a.start - b.start);
    
    for (const other of sortedOverlapping) {
      const otherEnd = other.start + other.duration;
      const otherStart = other.start;
      
      // Check if this column is taken by checking if other event overlaps in time
      // and if other event is in this column position
      const colTaken = sortedOverlapping.slice(0, sortedOverlapping.indexOf(other)).some(o => {
        const oEnd = o.start + o.duration;
        return !(oEnd <= otherStart || o.start >= otherEnd);
      });
      
      if (!colTaken && other.id < event.id) {
        column++;
      }
    }
    
    const maxColumns = Math.min(4, Math.max(1, overlapping.length + 1));
    const width = 100 / maxColumns;
    
    return { column, width, maxColumns };
  };

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
    // only trigger on the bubble body, not on resize handle or Google events
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
  const [draftTentative, setDraftTentative] = useState(false);

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
      setDraftTentative(false);
      // keep ghost alive so the slot stays visible while panel is open
      setGhost({ start: finalStart, duration: dur });
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
      tentative: draftTentative || undefined,
    };
    onCreate(event);
    setDraft(null);
    setGhost(null);
  }

  function cancelDraft() {
    setDraft(null);
    setGhost(null);
    setDraftTentative(false);
  }

  // position the creation panel smartly
  function panelPos(draft: DraftEvent) {
    const panelW = Math.min(PANEL_WIDTH, window.innerWidth - PANEL_MARGIN * 2);
    const panelH = Math.min(680, window.innerHeight - PANEL_MARGIN * 2);
    const preferredX = draft.anchorX + panelW > window.innerWidth
      ? draft.anchorX - panelW - 24
      : draft.anchorX;
    const x = Math.min(
      Math.max(PANEL_MARGIN, preferredX),
      window.innerWidth - panelW - PANEL_MARGIN
    );
    const y = Math.min(
      Math.max(draft.anchorY - 80, PANEL_MARGIN),
      window.innerHeight - panelH - PANEL_MARGIN
    );
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
          width: `min(${PANEL_WIDTH}px, calc(100vw - ${PANEL_MARGIN * 2}px))`,
          background: "#FAFAF8",
          borderRadius: 20,
          boxShadow: "0 24px 72px -8px rgba(0,0,0,0.24), 0 4px 20px -4px rgba(0,0,0,0.12)",
          border: "1px solid rgba(0,0,0,0.07)",
          zIndex: 999,
          overflow: "hidden",
          maxHeight: `calc(100vh - ${PANEL_MARGIN * 2}px)`,
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

          {/* Confidence */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: "#AAA", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 6 }}>Confidence</label>
            <div style={{ display: "flex", gap: 6 }}>
              <button
                type="button"
                onClick={() => setDraftTentative(false)}
                style={{
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  padding: "9px 12px",
                  borderRadius: 12,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  background: !draftTentative ? "#3C3489" : "#F5F3F0",
                  color: !draftTentative ? "#fff" : "#3C3489",
                  border: "1.5px solid " + (!draftTentative ? "#3C3489" : "rgba(123,115,214,0.22)"),
                }}
              >
                Confirmed
              </button>
              <button
                type="button"
                onClick={() => setDraftTentative(true)}
                style={{
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  padding: "9px 12px",
                  borderRadius: 12,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  background: draftTentative ? "#F4EEE2" : "#F5F3F0",
                  color: draftTentative ? "#7A5423" : "#3C3489",
                  border: "1.5px dashed " + (draftTentative ? "#C39A63" : "rgba(123,115,214,0.22)"),
                }}
              >
                Maybe / tentative
              </button>
            </div>
            <p style={{ fontSize: 11, color: draftTentative ? "#9B7449" : "#999", marginTop: 6, lineHeight: 1.35 }}>
              {draftTentative
                ? "Shows as softer and dashed so it reads like a hold, not a locked-in plan."
                : "Use tentative when this might happen, but you are not committed yet."}
            </p>
          </div>

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

  // opacity fade for days further out
  const colOpacity = (() => {
    const diff = Math.abs((date.getTime() - new Date().setHours(0,0,0,0)) / 86400000);
    if (isT || isTom) return 1;
    if (diff <= 2) return 0.82;
    if (isWeekend) return 0.55;
    return 1;
  })();

  return (
    <div style={{
      flex: 1,
      background: bg,
      borderTop: stripColor ? `3px solid ${stripColor}` : border,
      borderRight: border,
      borderBottom: border,
      borderLeft: border,
      borderRadius: 20,
      display: "flex",
      flexDirection: "column",
      minWidth: focusMode ? 0 : 120,
      minHeight: 80 + 15 * 60,
      position: "relative",
      opacity: colOpacity,
      boxShadow: isT ? "0 0 0 0" : "none",
    }}>
      {/* Header */}
      <div
        style={{ padding: "14px 14px 8px", height: 76, boxSizing: "border-box", flexShrink: 0, borderRadius: "19px 19px 0 0", background: headerBg, display: "flex", flexDirection: "column", justifyContent: "space-between" }}
      >
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", cursor: onDayClick ? "pointer" : "default", gap: 4, overflow: "hidden" }} onClick={() => onDayClick?.(date)}>
          <h3 style={{ fontSize: focusMode ? 18 : 14, fontWeight: 500, color: titleColor, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>{format(date, "EEEE")}</h3>
          {isT && !focusMode && (
            <span style={{ fontSize: 9, fontWeight: 500, color: "#3B6D11", letterSpacing: "0.07em", textTransform: "uppercase", flexShrink: 0 }}>today</span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 4, overflow: "hidden" }}>
          <p style={{ fontSize: 11, color: subColor, fontWeight: 500, cursor: onDayClick ? "pointer" : "default", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }} onClick={() => onDayClick?.(date)}>{subtitle}</p>
          <button
            ref={typeBtnRef}
            type="button"
            onClick={e => {
              e.stopPropagation();
              if (!showTypePicker && typeBtnRef.current) {
                const r = typeBtnRef.current.getBoundingClientRect();
                setPickerPos({ top: r.bottom + 6, left: Math.max(8, r.left - 8) });
              }
              setShowTypePicker(v => !v);
            }}
            style={{
              display: "flex", alignItems: "center", gap: 4,
              background: dayTypeDef ? "rgba(0,0,0,0.07)" : "rgba(0,0,0,0.05)",
              border: "none",
              borderRadius: 20,
              padding: "2px 7px 2px 5px",
              cursor: "pointer",
              fontSize: 11, fontWeight: 600,
              color: subColor,
            }}
          >
            <span style={{ fontSize: 12, lineHeight: 1 }}>{dayTypeDef ? dayTypeDef.emoji : "+"}</span>
            <span>{dayTypeDef ? dayTypeDef.label : "type"}</span>
          </button>
        </div>
      </div>

      {/* Day type picker popover */}
      {showTypePicker && createPortal(
        <div
          ref={typePickerRef}
          style={{
            position: "fixed",
            zIndex: 901,
            background: "#FFFFFF",
            borderRadius: 14,
            boxShadow: "0 8px 32px rgba(0,0,0,0.14), 0 1px 4px rgba(0,0,0,0.08)",
            padding: "8px",
            width: 192,
            top: pickerPos.top,
            left: pickerPos.left,
          }}
        >
          <p style={{ fontSize: 10, fontWeight: 700, color: "#AAA", letterSpacing: "0.07em", textTransform: "uppercase", margin: "2px 6px 6px" }}>Day type</p>
          {DAY_TYPES.map(dt => (
            <button
              key={dt.id}
              type="button"
              onClick={e => { e.stopPropagation(); setDayType(dt.id); setShowTypePicker(false); }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                width: "100%",
                padding: "7px 10px",
                background: dayType === dt.id ? dt.bg : "transparent",
                border: "none",
                borderRadius: 9,
                cursor: "pointer",
                textAlign: "left",
                fontSize: 13,
                fontWeight: dayType === dt.id ? 700 : 500,
                color: dayType === dt.id ? dt.text : "#444",
              }}
              onMouseEnter={e => { if (dayType !== dt.id) e.currentTarget.style.background = "#F5F3F0"; }}
              onMouseLeave={e => { if (dayType !== dt.id) e.currentTarget.style.background = "transparent"; }}
            >
              <span style={{ fontSize: 16 }}>{dt.emoji}</span>
              <span>{dt.label}</span>
            </button>
          ))}
          {dayType && (
            <>
              <div style={{ height: 1, background: "#F0EDE8", margin: "6px 0" }} />
              <button
                type="button"
                onClick={e => { e.stopPropagation(); setDayType(null); setShowTypePicker(false); }}
                style={{
                  display: "flex", alignItems: "center", gap: 8,
                  width: "100%", padding: "7px 10px",
                  background: "transparent", border: "none", borderRadius: 9,
                  cursor: "pointer", fontSize: 12, color: "#999", fontWeight: 500,
                }}
                onMouseEnter={e => { e.currentTarget.style.background = "#F5F3F0"; e.currentTarget.style.color = "#666"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#999"; }}
              >
                <span style={{ fontSize: 14 }}>✕</span>
                <span>Clear day type</span>
              </button>
            </>
          )}
        </div>,
        document.body
      )}

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
        {/* Hour grid lines & markers */}
        {Array.from({ length: 16 }, (_, i) => i).map((i) => {
          const hour = 7 + i;
          const isPM = hour >= 12;
          const hour12 = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
          return (
            <div key={`hr-${i}`} style={{ position: "absolute", top: i * 60, left: 0, right: 0, pointerEvents: "none", zIndex: 18 }}>
              {/* Hour line */}
              <div style={{
                borderTop: i === 0 ? "none" : "1px solid rgba(0,0,0,0.05)",
              }} />
              {/* Hour label on timeline */}
              {i > 0 && (
                <div style={{
                  position: "absolute",
                  right: 0,
                  top: -8,
                  fontSize: 9,
                  fontWeight: 500,
                  color: "rgba(168,164,160,0.7)",
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                  whiteSpace: "nowrap",
                  paddingRight: 10,
                }}>
                  <span style={{
                    position: "absolute",
                    right: 2,
                    top: "50%",
                    width: 5,
                    height: 1,
                    borderRadius: 999,
                    background: "rgba(168,164,160,0.3)",
                    transform: "translateY(-50%)",
                  }} />
                  {hour12}{isPM && hour !== 12 ? "pm" : hour < 12 ? "am" : "pm"}
                </div>
              )}
            </div>
          );
        })}
        {Array.from({ length: 15 }, (_, i) => i).map((i) => (
          <div key={`hh-${i}`} style={{ position: "absolute", top: i * 60 + 30, left: 0, right: 0, borderTop: "1px dashed rgba(0,0,0,0.03)", pointerEvents: "none", zIndex: 1 }} />
        ))}

        {/* Evening tint band */}
        <div style={{
          position: "absolute",
          top: timeToY(17 * 60),
          left: 0, right: 0,
          height: timeToY(22 * 60) - timeToY(17 * 60),
          background: "rgba(206,203,246,0.06)",
          borderRadius: 8,
          pointerEvents: "none",
          zIndex: 0,
        }} />

        {/* Section headers */}
        <AbsoluteSectionHeader title="MORNING"   y={timeToY(7 * 60)} />
        <AbsoluteSectionHeader title="AFTERNOON" y={timeToY(12 * 60)} />
        <AbsoluteSectionHeader title="EVENING"   y={timeToY(17 * 60)} />

        {/* Ghost block while drag-creating / panel open */}
        {ghost && (
          <div
            style={{
              position: "absolute",
              top: timeToY(ghost.start),
              left: 0, right: 0,
              height: Math.max(ghost.duration, 30),
              borderRadius: 10,
              background: draft
                ? `${ghostColors.bg}cc`
                : ghostColors.bg,
              border: `2px ${draft ? "solid" : "dashed"} ${ghostColors.text}`,
              opacity: draft ? 0.85 : 0.65,
              pointerEvents: "none",
              zIndex: 12,
              display: "flex",
              flexDirection: "column",
              justifyContent: "flex-start",
              padding: "6px 8px",
              boxSizing: "border-box",
              backdropFilter: draft ? "blur(4px)" : "none",
              WebkitBackdropFilter: draft ? "blur(4px)" : "none",
              boxShadow: draft ? `0 4px 16px ${ghostColors.bg}88` : "none",
              transition: "opacity 0.2s, border-style 0.2s",
            }}
          >
            <span style={{ fontSize: 11, fontWeight: 700, color: ghostColors.text, display: "flex", alignItems: "center", gap: 4 }}>
              {minutesToLabel(ghost.start)}
              <span style={{ opacity: 0.45, fontWeight: 400 }}>→</span>
              {minutesToLabel(ghost.start + ghost.duration)}
            </span>
          </div>
        )}

        {/* Events */}
        {compact ? (
          // Compact mode: small dot pills at event time
          sorted.map((ev) => {
            const colors = tagColors(ev.tagId);
            return (
              <div
                key={ev.id}
                style={{
                  position: "absolute",
                  top: timeToY(ev.start) + 2,
                  left: 4, right: 4,
                  height: 16,
                  zIndex: 10,
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  borderRadius: 8,
                  background: colors.bg,
                  padding: "0 6px",
                  cursor: "default",
                  overflow: "hidden",
                }}
              >
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: colors.text, flexShrink: 0 }} />
                <span style={{ fontSize: 9, fontWeight: 600, color: colors.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {ev.title}
                </span>
              </div>
            );
          })
        ) : sorted.map((ev) => {
          const isResizing = resizingId === ev.id;
          const isMoving = movingId === ev.id;
          const displayDuration = isResizing ? liveDuration : ev.duration;
          const displayStart = isMoving ? liveStart : ev.start;
          const layout = getEventLayout(ev, sorted);
          const leftOffset = layout.column * layout.width;
          
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
                left: `${leftOffset}%`,
                width: `${layout.width}%`,
                height: Math.max(displayDuration, 76),
                zIndex: isResizing ? 15 : isMoving ? 16 : 10,
                transition: (isResizing || isMoving) ? "none" : undefined,
                cursor: isMoving ? "grabbing" : "grab",
                opacity: isMoving ? 0.85 : 1,
                paddingLeft: layout.column > 0 ? 2 : 0,
                paddingRight: layout.column < layout.maxColumns - 1 ? 2 : 0,
                boxSizing: "border-box",
              }}
            >
              <EventBubble
                event={ev}
                tags={tags}
                onMark={onMark ? (c) => onMark(ev.id, c) : undefined}
                onDelete={onDelete ? () => onDelete(ev.id) : undefined}
                onUpdate={onUpdate ? (patch) => onUpdate(ev.id, patch) : undefined}
                onCopy={onCopyEvent}
                onSelect={onSelectEvent}
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
                  {minutesToLabel(liveStart)} → {minutesToLabel(liveStart + ev.duration)}
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
                  {minutesToLabel(ev.start)} → {minutesToLabel(ev.start + liveDuration)}
                </div>
              )}
            </div>
          );
        })}

        {/* ── Task pills (timed tasks floating on the timeline) ── */}
        {taskItems.filter(t => t.kind === "task" && t.start !== undefined).map(task => (
          <TaskPill
            key={task.id}
            task={task}
            timelineRef={timelineRef}
          />
        ))}

        {/* Past wash — glassmorphism overlay for time before now */}
        {isT && now >= 7 * 60 && now <= 22 * 60 && (
          <div style={{
            position: "absolute",
            top: 0,
            left: 0, right: 0,
            height: timeToY(now),
            background: "linear-gradient(180deg, rgba(155,147,224,0.12) 0%, rgba(140,131,210,0.18) 45%, rgba(127,119,198,0.14) 100%)",
            backdropFilter: "blur(1.2px) saturate(0.95) brightness(1.04)",
            WebkitBackdropFilter: "blur(1.2px) saturate(0.95) brightness(1.04)",
            borderRadius: 8,
            pointerEvents: "none",
            zIndex: 9,
            borderBottom: "1px solid rgba(123,115,214,0.18)",
            boxShadow: "inset 0 1px 2px rgba(255,255,255,0.35)",
          }} />
        )}

        {/* Now marker */}
        {isT && now >= 7 * 60 && now <= 22 * 60 && (
          <div style={{ position: "absolute", top: timeToY(now) - 6, left: -4, right: 0, zIndex: 20 }}>
            <NowMarker />
          </div>
        )}
      </div>

      {creationPanel}
    </div>
  );
}
