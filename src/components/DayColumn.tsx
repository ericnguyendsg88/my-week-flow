import { useRef, useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { format, isToday, isTomorrow } from "date-fns";
import { motion, AnimatePresence } from "framer-motion"; // AnimatePresence used in event panels
import { X, CheckSquare } from "lucide-react";
import { CalEvent, CaptureItem, Tag, DURATIONS } from "@/types/event";
import { EventBubble } from "./EventBubble";
import { NowMarker } from "./NowMarker";
import { nowMinutes, minutesToLabel, durationLabel } from "@/lib/event-utils";
import { patchCapture, removeCapture } from "@/lib/capture-store";
import { tagPaletteById } from "@/lib/tags";

// ── Sticker storage ───────────────────────────────────────────────────
const STICKER_STORAGE = "horizon_stickers";

function loadStickers(): Record<string, CaptureItem[]> {
  try { return JSON.parse(localStorage.getItem(STICKER_STORAGE) ?? "{}"); } catch { return {}; }
}

function saveStickers(all: Record<string, CaptureItem[]>) {
  localStorage.setItem(STICKER_STORAGE, JSON.stringify(all));
}

function addSticker(dateKey: string, item: CaptureItem) {
  const all = loadStickers();
  const existing = all[dateKey] ?? [];
  if (existing.find(s => s.id === item.id)) return;
  all[dateKey] = [...existing, item];
  saveStickers(all);
}

function removeSticker(dateKey: string, itemId: string) {
  const all = loadStickers();
  all[dateKey] = (all[dateKey] ?? []).filter(s => s.id !== itemId);
  saveStickers(all);
}

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

const DAY_TYPE_DEFS_KEY = "horizon_day_type_defs";
export const DAY_TYPE_DEFS_CHANGED = "horizon:day-types-changed";

export function loadCustomDayTypeDefs(): typeof DAY_TYPES {
  try {
    const raw = localStorage.getItem(DAY_TYPE_DEFS_KEY);
    if (!raw) return DAY_TYPES.map(d => ({ ...d }));
    const saved: Array<Partial<typeof DAY_TYPES[0]> & { id: DayType }> = JSON.parse(raw);
    return DAY_TYPES.map(base => ({
      ...base,
      ...(saved.find(s => s.id === base.id) ?? {}),
    }));
  } catch {
    return DAY_TYPES.map(d => ({ ...d }));
  }
}

export function saveCustomDayTypeDefs(defs: typeof DAY_TYPES) {
  localStorage.setItem(DAY_TYPE_DEFS_KEY, JSON.stringify(defs));
  window.dispatchEvent(new Event(DAY_TYPE_DEFS_CHANGED));
}

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
  onOpenDayBoard?: (date: Date) => void;
  isSelected?: boolean;
  focusMode?: boolean;
  compact?: boolean;
  privacyMode?: boolean;
}

const DAY_START = 0;         // 12am
const DAY_END   = 24 * 60;  // midnight
const DAY_HOURS = (DAY_END - DAY_START) / 60; // 24

// Late-hours compression: 22:00–24:00 rendered at 1/3 the normal density
const LATE_START = 22 * 60;   // 10pm in minutes
const PX_PER_MIN_NORMAL = 1;  // 60px/hr
const PX_PER_MIN_LATE   = 1 / 3;  // ~20px/hr

// Total pixel height of the timeline
const TIMELINE_HEIGHT =
  LATE_START * PX_PER_MIN_NORMAL +
  (DAY_END - LATE_START) * PX_PER_MIN_LATE;

// Early morning zone (12am–6am) — collapsed by default
const EARLY_END_MINS   = 6 * 60;  // 6am
const EARLY_COLLAPSED_H = 28;     // px height of the collapsed pill

function timeToY(mins: number): number {
  const clamped = Math.max(0, mins);
  if (clamped <= LATE_START) return clamped * PX_PER_MIN_NORMAL;
  return LATE_START * PX_PER_MIN_NORMAL + (clamped - LATE_START) * PX_PER_MIN_LATE;
}

function yToTime(y: number): number {
  const lateStartY = LATE_START * PX_PER_MIN_NORMAL;
  if (y <= lateStartY) return y / PX_PER_MIN_NORMAL;
  return LATE_START + (y - lateStartY) / PX_PER_MIN_LATE;
}

// Height in px for a duration starting at startMins
function durationToHeight(startMins: number, durationMins: number): number {
  return timeToY(startMins + durationMins) - timeToY(startMins);
}

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

function minsToTimeInput(mins: number): string {
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function timeInputToMins(val: string): number {
  const [h, m] = val.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

interface DraftEvent {
  start: number;
  duration: number;
  anchorX: number;
  anchorY: number;
}

// ── Sticker Note — sticky note dropped on a day header ───────────────
const STICKER_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  task:    { bg: "#FFF9C4", border: "#E8D000", text: "#5C4A00" },
  thought: { bg: "#E3F2FD", border: "#90CAF9", text: "#0D3F6B" },
  link:    { bg: "#E8F5E9", border: "#81C784", text: "#1B5E20" },
  ref:     { bg: "#FCE4EC", border: "#F48FB1", text: "#6A0F2E" },
  file:    { bg: "#F3E5F5", border: "#BA68C8", text: "#4A148C" },
};

const DECK_VISIBLE = 3; // how many fanned cards to show when collapsed

function StickerDeck({ stickers, onPeel, onOpenBoard }: { stickers: CaptureItem[]; onPeel: (id: string) => void; onOpenBoard?: () => void }) {
  const [expanded, setExpanded] = useState(false);

  if (expanded) {
    return (
      <div style={{ width: "100%", marginTop: 4 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center" }}>
          {stickers.map((s, i) => (
            <StickerNote key={s.id} item={s} index={i} onPeel={() => onPeel(s.id)} />
          ))}
        </div>
        <div style={{ display: "flex", gap: 4, justifyContent: "center", marginTop: 6 }}>
          {onOpenBoard && (
            <button
              type="button"
              onClick={e => { e.stopPropagation(); onOpenBoard(); }}
              style={{ fontSize: 9, fontWeight: 600, color: "#fff", background: "#3C3489", border: "none", borderRadius: 10, padding: "3px 8px", cursor: "pointer", letterSpacing: "0.03em" }}
            >
              board view ↗
            </button>
          )}
          <button
            type="button"
            onClick={e => { e.stopPropagation(); setExpanded(false); }}
            style={{ fontSize: 9, fontWeight: 600, color: "#A8A4A0", background: "none", border: "none", cursor: "pointer", letterSpacing: "0.04em" }}
          >
            ▲ collapse
          </button>
        </div>
      </div>
    );
  }

  // Collapsed: offset stack — each card shifts right+down, no rotation
  const shown = stickers.slice(0, DECK_VISIBLE);
  const deckW = 68;
  const deckH = 80;
  const DX = 6;  // px shift right per card behind
  const DY = 5;  // px shift down per card behind
  const containerW = deckW + (shown.length - 1) * DX + 8;
  const containerH = deckH + (shown.length - 1) * DY + 8;

  return (
    <div
      style={{ width: "100%", marginTop: 4, display: "flex", flexDirection: "column", alignItems: "center", gap: 0 }}
    >
      {/* Offset stack — click opens board view if available, else expands inline */}
      <div
        style={{ position: "relative", width: containerW, height: containerH, cursor: "pointer" }}
        title={`${stickers.length} item${stickers.length !== 1 ? "s" : ""} — click to open board`}
        onClick={e => { e.stopPropagation(); if (onOpenBoard) onOpenBoard(); else setExpanded(true); }}
      >
        {/* Render back-to-front: last index = backmost */}
        {[...shown].reverse().map((s, ri) => {
          const i = shown.length - 1 - ri; // 0 = front card
          const sc = STICKER_COLORS[s.kind] ?? STICKER_COLORS.task;
          return (
            <div
              key={s.id}
              style={{
                position: "absolute",
                top: 4 + i * DY,
                left: 4 + i * DX,
                width: deckW,
                height: deckH,
                background: sc.bg,
                border: `1.5px solid ${sc.border}`,
                borderRadius: 12,
                padding: "10px 10px 8px",
                boxShadow: i === 0
                  ? "0 4px 14px rgba(0,0,0,0.14), 0 1px 4px rgba(0,0,0,0.08)"
                  : "0 2px 6px rgba(0,0,0,0.08)",
                zIndex: shown.length - i,
                boxSizing: "border-box",
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
                gap: 4,
              }}
            >
              {i === 0 && (
                <>
                  <div style={{ fontSize: 13, lineHeight: 1 }}>
                    {s.kind === "task" ? "☐" : s.kind === "link" ? "🔗" : s.kind === "thought" ? "💭" : s.kind === "ref" ? "📌" : "📄"}
                  </div>
                  <span style={{ fontSize: 9, fontWeight: 700, color: sc.text, lineHeight: 1.35, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical" }}>
                    {s.title}
                  </span>
                  <span style={{ fontSize: 8, color: sc.text, opacity: 0.45, marginTop: "auto", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    {s.kind}
                  </span>
                </>
              )}
            </div>
          );
        })}

        {/* Count badge */}
        {stickers.length > 0 && (
          <div style={{
            position: "absolute",
            bottom: 0,
            right: 0,
            background: "#3C3489",
            color: "#fff",
            fontSize: 9,
            fontWeight: 700,
            borderRadius: 12,
            width: 20,
            height: 20,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 20,
            boxShadow: "0 1px 4px rgba(0,0,0,0.28)",
          }}>
            {stickers.length}
          </div>
        )}
      </div>

      {/* Hint */}
      <span style={{ fontSize: 8, color: "#C8C4BE", marginTop: 4, letterSpacing: "0.04em" }}>{onOpenBoard ? "tap to open board" : "tap to expand"}</span>
    </div>
  );
}

function StickerNote({ item, index, onPeel }: { item: CaptureItem; index: number; onPeel: () => void }) {
  const [hovered, setHovered] = useState(false);
  const rot = ((index * 37 + item.id.charCodeAt(0)) % 11) - 5;
  const sc = STICKER_COLORS[item.kind] ?? STICKER_COLORS.task;

  return (
    <motion.div
      initial={{ scale: 0.3, rotate: rot * 3, opacity: 0, y: -16 }}
      animate={{ scale: hovered ? 1.08 : 1, rotate: hovered ? 0 : rot, opacity: 1, y: 0 }}
      exit={{ scale: 0.2, rotate: rot * 4, opacity: 0, y: -12 }}
      transition={{ type: "spring", stiffness: 380, damping: 20 }}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      onClick={e => e.stopPropagation()}
      style={{
        position: "relative",
        background: sc.bg,
        border: `1.5px solid ${sc.border}`,
        borderRadius: 3,
        padding: "6px 8px 7px",
        maxWidth: 80,
        minWidth: 44,
        cursor: "default",
        userSelect: "none",
        boxShadow: hovered
          ? `0 8px 20px rgba(0,0,0,0.22), 0 2px 6px rgba(0,0,0,0.12)`
          : `0 2px 5px rgba(0,0,0,0.14), 1px 1px 0 rgba(0,0,0,0.04)`,
        zIndex: hovered ? 50 : 1,
      }}
    >
      {/* Tape strip at top */}
      <div style={{
        position: "absolute",
        top: -7, left: "50%", transform: "translateX(-50%)",
        width: 22, height: 11,
        background: "rgba(255,255,255,0.75)",
        border: "1px solid rgba(180,180,180,0.45)",
        borderRadius: 2,
        backdropFilter: "blur(3px)",
        WebkitBackdropFilter: "blur(3px)",
      }} />
      {/* Kind emoji */}
      <div style={{ fontSize: 11, lineHeight: 1, marginBottom: 3, marginTop: 1 }}>
        {item.kind === "task" ? "☐" : item.kind === "link" ? "🔗" : item.kind === "thought" ? "💭" : item.kind === "ref" ? "📌" : "📄"}
      </div>
      <span style={{
        fontSize: 9, fontWeight: 700, color: sc.text,
        display: "block", lineHeight: 1.35,
        overflow: "hidden", textOverflow: "ellipsis",
        whiteSpace: "pre-wrap", maxWidth: 68,
        wordBreak: "break-word",
        maxHeight: 36,
      }}>{item.title}</span>
      {/* Peel-off X */}
      {hovered && (
        <motion.button
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 500, damping: 20 }}
          onMouseDown={e => e.stopPropagation()}
          onClick={e => { e.stopPropagation(); onPeel(); }}
          style={{
            position: "absolute", top: -6, right: -6,
            width: 16, height: 16, borderRadius: "50%",
            background: "#ff4444", border: "2px solid #fff",
            cursor: "pointer", display: "flex",
            alignItems: "center", justifyContent: "center",
            fontSize: 9, color: "#fff", fontWeight: 900,
            lineHeight: 1, padding: 0,
            boxShadow: "0 1px 4px rgba(0,0,0,0.3)",
          }}
        >×</motion.button>
      )}
    </motion.div>
  );
}

// ── Task Pill — floating timed task on the timeline ───────────────
function TaskPill({ task, tags, timelineRef, onDelete }: { task: CaptureItem; tags: Tag[]; timelineRef: React.RefObject<HTMLDivElement | null>; onDelete: () => void }) {
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
      const newStart = Math.max(DAY_START, Math.min(DAY_END - 30, snapStart(dragRef.current.origStart + deltaY)));
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
  const tagC = tagPaletteById(tags, task.tagId);

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
        background: done ? "#D6F5E8" : tagC.pale,
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
        <button
          onMouseDown={e => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          style={{ background: "none", border: "none", padding: 0, cursor: "pointer", display: "flex", alignItems: "center", flexShrink: 0, color: tagC.text, opacity: 0.5 }}
        >
          <X size={9} strokeWidth={3} />
        </button>
      </div>
    </div>
  );
}

export function DayColumn({ date, events, tags, taskItems = [], onMark, onDelete, onResize, onUpdate, onCreate, onMoveToDay, onCopyEvent, onSelectEvent, onDayClick, onOpenDayBoard, isSelected, focusMode, compact, privacyMode }: Props) {
  const isT = isToday(date);
  const isTom = isTomorrow(date);
  const isWeekend = date.getDay() === 0 || date.getDay() === 6;
  const dateKey = format(date, "yyyy-MM-dd");

  const [dayType, setDayType] = useDayType(dateKey);
  const [stickers, setStickers] = useState<CaptureItem[]>(() => loadStickers()[dateKey] ?? []);
  const [headerDragOver, setHeaderDragOver] = useState(false);
  const [earlyExpanded, setEarlyExpanded] = useState(false);
  // px scrolled away at the top when the early zone is collapsed
  const earlyHiddenPx = earlyExpanded ? 0 : Math.max(0, timeToY(EARLY_END_MINS) - EARLY_COLLAPSED_H);
  const [showTypePicker, setShowTypePicker] = useState(false);
  const [pickerPos, setPickerPos] = useState({ top: 0, left: 0 });
  const [dayTypeDefs, setDayTypeDefs] = useState(() => loadCustomDayTypeDefs());

  useEffect(() => {
    function onDefsChanged() { setDayTypeDefs(loadCustomDayTypeDefs()); }
    window.addEventListener(DAY_TYPE_DEFS_CHANGED, onDefsChanged);
    return () => window.removeEventListener(DAY_TYPE_DEFS_CHANGED, onDefsChanged);
  }, []);
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

  const dayTypeDef = dayType ? dayTypeDefs.find(d => d.id === dayType) : null;

  function handleHeaderDragOver(e: React.DragEvent) {
    if (!e.dataTransfer.types.includes("text/capture-json")) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    setHeaderDragOver(true);
  }

  function handleHeaderDragLeave() {
    setHeaderDragOver(false);
  }

  function handleHeaderDrop(e: React.DragEvent) {
    e.preventDefault();
    setHeaderDragOver(false);
    const raw = e.dataTransfer.getData("text/capture-json");
    if (!raw) return;
    try {
      const item: CaptureItem = JSON.parse(raw);
      addSticker(dateKey, item);
      setStickers(loadStickers()[dateKey] ?? []);
    } catch {}
  }

  function peelSticker(id: string) {
    removeSticker(dateKey, id);
    setStickers(s => s.filter(x => x.id !== id));
  }

  const subtitle = "";

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
    headerBg = dayTypeDef ? dayTypeDef.headerBg : "#EAF3DE";
    border = dayTypeDef ? `1.5px solid ${dayTypeDef.border}` : "1.5px solid #3B6D11";
    titleColor = dayTypeDef ? dayTypeDef.text : "#27500A";
    subColor = dayTypeDef ? dayTypeDef.text : "#3B6D11";
  } else if (isSelected) {
    bg = "#FFFFFF";
    headerBg = dayTypeDef ? dayTypeDef.headerBg : "#EEEDFE";
    const selColor = dayTypeDef ? dayTypeDef.border : "#C8C4BE";
    border = `1.5px solid ${selColor}`;
    titleColor = dayTypeDef ? dayTypeDef.text : "#444441";
    subColor = dayTypeDef ? dayTypeDef.text : "#888580";
  } else if (isTom) {
    bg = "#FFFFFF";
    headerBg = "#FAFAFA";
    border = "0.5px solid #E5E4E0";
  } else if (dayTypeDef) {
    bg = "#FFFFFF";
    headerBg = dayTypeDef.headerBg;
    border = `0.5px solid ${dayTypeDef.border}`;
    titleColor = dayTypeDef.text;
    subColor = dayTypeDef.text;
  }

  const sorted = [...events].sort((a, b) => a.start - b.start);

  // Build overlap groups and assign lanes. Returns { lane, totalLanes } per event.
  const eventLayoutMap = (() => {
    const map = new Map<string, { lane: number; totalLanes: number }>();

    // Find all events that overlap with a given event
    function getOverlapGroup(ev: CalEvent, all: CalEvent[]): CalEvent[] {
      const group: CalEvent[] = [ev];
      let changed = true;
      while (changed) {
        changed = false;
        for (const other of all) {
          if (group.find(g => g.id === other.id)) continue;
          const overlapsAny = group.some(g => {
            const aEnd = g.start + g.duration;
            const bEnd = other.start + other.duration;
            return !(aEnd <= other.start || bEnd <= g.start);
          });
          if (overlapsAny) { group.push(other); changed = true; }
        }
      }
      return group;
    }

    const processed = new Set<string>();
    for (const ev of sorted) {
      if (processed.has(ev.id)) continue;
      const group = getOverlapGroup(ev, sorted);
      group.forEach(g => processed.add(g.id));

      const totalLanes = Math.min(4, group.length);

      // Assign lanes: respect laneOverride, then fill remaining lanes by start time
      const laneAssigned = new Map<string, number>();
      const usedLanes = new Set<number>();

      // First pass: honour overrides
      for (const g of group) {
        if (g.laneOverride !== undefined && g.laneOverride < totalLanes) {
          if (!usedLanes.has(g.laneOverride)) {
            laneAssigned.set(g.id, g.laneOverride);
            usedLanes.add(g.laneOverride);
          }
        }
      }
      // Second pass: auto-assign the rest
      let nextLane = 0;
      for (const g of [...group].sort((a, b) => a.start - b.start)) {
        if (laneAssigned.has(g.id)) continue;
        while (usedLanes.has(nextLane)) nextLane++;
        laneAssigned.set(g.id, nextLane);
        usedLanes.add(nextLane);
        nextLane++;
      }

      for (const g of group) {
        map.set(g.id, { lane: laneAssigned.get(g.id) ?? 0, totalLanes });
      }
    }
    return map;
  })();

  // ── resize-bottom state (changes duration, keeps start fixed) ──
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

  // ── resize-top state (changes start + duration, keeps end fixed) ──
  const [resizingTopId, setResizingTopId] = useState<string | null>(null);
  const [liveTopStart, setLiveTopStart] = useState<number>(0);
  const [liveTopDuration, setLiveTopDuration] = useState<number>(0);
  const resizeTopDragRef = useRef<{ startY: number; origStart: number; origDuration: number } | null>(null);

  function handleResizeTopMouseDown(ev: React.MouseEvent, event: CalEvent) {
    ev.preventDefault();
    ev.stopPropagation();
    setResizingTopId(event.id);
    setLiveTopStart(event.start);
    setLiveTopDuration(event.duration);
    resizeTopDragRef.current = { startY: ev.clientY, origStart: event.start, origDuration: event.duration };

    function onMove(e: MouseEvent) {
      if (!resizeTopDragRef.current) return;
      const delta = e.clientY - resizeTopDragRef.current.startY;
      const newStart = snapStart(resizeTopDragRef.current.origStart + delta);
      const end = resizeTopDragRef.current.origStart + resizeTopDragRef.current.origDuration;
      const newDur = Math.max(15, end - newStart);
      setLiveTopStart(newStart);
      setLiveTopDuration(newDur);
    }

    function onUp(e: MouseEvent) {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      if (resizeTopDragRef.current) {
        const delta = e.clientY - resizeTopDragRef.current.startY;
        const newStart = snapStart(resizeTopDragRef.current.origStart + delta);
        const end = resizeTopDragRef.current.origStart + resizeTopDragRef.current.origDuration;
        const newDur = Math.max(15, end - newStart);
        if (newStart !== resizeTopDragRef.current.origStart) {
          onUpdate?.(event.id, { start: newStart, duration: newDur });
        }
      }
      resizeTopDragRef.current = null;
      setResizingTopId(null);
    }

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }

  // ── within-day move drag ──
  const [movingId, setMovingId] = useState<string | null>(null);
  const [liveStart, setLiveStart] = useState<number>(0);
  const [liveLane, setLiveLane] = useState<number>(0);
  const [liveTotalLanes, setLiveTotalLanes] = useState<number>(1);
  // offset of cursor within the bubble so it doesn't jump on grab
  const moveDragRef = useRef<{
    cursorOffsetMins: number;
    origStart: number;
    origLane: number;
    totalLanes: number;
  } | null>(null);

  function handleEventMoveMouseDown(ev: React.MouseEvent, event: CalEvent) {
    if ((ev.target as HTMLElement).closest("[data-resize-handle]")) return;
    ev.stopPropagation();

    const layout = eventLayoutMap.get(event.id) ?? { lane: 0, totalLanes: 1 };
    const timelineRect = timelineRef.current?.getBoundingClientRect();
    if (!timelineRect) return;

    // How far into the bubble the user clicked (in minutes) — keeps bubble anchored to cursor
    const cursorY = ev.clientY - timelineRect.top;
    const cursorMins = yToTime(cursorY + earlyHiddenPx);
    const cursorOffsetMins = Math.max(0, cursorMins - event.start);

    let dragging = false;
    moveDragRef.current = {
      cursorOffsetMins,
      origStart: event.start,
      origLane: layout.lane,
      totalLanes: layout.totalLanes,
    };

    function onMove(e: MouseEvent) {
      if (!moveDragRef.current || !timelineRect) return;
      const relY = e.clientY - timelineRect.top;
      const relX = e.clientX - timelineRect.left;
      const distY = Math.abs(e.clientY - (timelineRect.top + cursorY));
      const distX = Math.abs(e.clientX - (timelineRect.left + layout.lane * 14));
      if (!dragging && distY < 5 && distX < 5) return;

      if (!dragging) {
        dragging = true;
        setMovingId(event.id);
        setLiveStart(event.start);
        setLiveLane(layout.lane);
        setLiveTotalLanes(layout.totalLanes);
      }

      // Vertical: map cursor Y → time, subtract intra-bubble offset so top of bubble tracks correctly
      const rawMins = yToTime(relY + earlyHiddenPx) - moveDragRef.current.cursorOffsetMins;
      const snapped = snapStart(rawMins);
      const clamped = Math.max(DAY_START, Math.min(DAY_END - event.duration, snapped));
      setLiveStart(clamped);

      // Horizontal: shift lane by how many LANE_INDENT steps left/right of start X
      const LANE_INDENT = 14;
      const startX = timelineRect.left + moveDragRef.current.origLane * LANE_INDENT;
      const deltaX = e.clientX - startX;
      const newLane = Math.max(0, Math.min(moveDragRef.current.totalLanes - 1, moveDragRef.current.origLane + Math.round(deltaX / LANE_INDENT)));
      setLiveLane(newLane);
    }

    function onUp(e: MouseEvent) {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      if (dragging && moveDragRef.current && timelineRect) {
        const relY = e.clientY - timelineRect.top;

        const rawMins = yToTime(relY + earlyHiddenPx) - moveDragRef.current.cursorOffsetMins;
        const snapped = snapStart(rawMins);
        const clamped = Math.max(DAY_START, Math.min(DAY_END - event.duration, snapped));

        const LANE_INDENT = 14;
        const startX = timelineRect.left + moveDragRef.current.origLane * LANE_INDENT;
        const deltaX = e.clientX - startX;
        const newLane = Math.max(0, Math.min(moveDragRef.current.totalLanes - 1, moveDragRef.current.origLane + Math.round(deltaX / LANE_INDENT)));

        const patch: Partial<CalEvent> = { start: clamped };
        if (newLane !== moveDragRef.current.origLane) patch.laneOverride = newLane;
        onUpdate?.(event.id, patch);
      }
      moveDragRef.current = null;
      setMovingId(null);
      setLiveLane(0);
      setLiveTotalLanes(1);
    }

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }

  // ── cross-day drop target state ──
  const [isDragOver, setIsDragOver] = useState(false);

  function handleDragOver(e: React.DragEvent) {
    const hasEvent = e.dataTransfer.types.includes("text/event-id");
    const hasCapture = e.dataTransfer.types.includes("text/capture-json");
    if (!hasEvent && !hasCapture) return;
    if (hasEvent && !onMoveToDay) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = hasEvent ? "move" : "copy";
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
    if (eventId) {
      onMoveToDay?.(eventId, format(date, "yyyy-MM-dd"));
      return;
    }
    const raw = e.dataTransfer.getData("text/capture-json");
    if (raw) {
      try {
        const item: CaptureItem = JSON.parse(raw);
        addSticker(dateKey, item);
        setStickers(loadStickers()[dateKey] ?? []);
      } catch {}
    }
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
    return rect ? clientY - rect.top + earlyHiddenPx : 0;
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

  const ghostColors = tagPaletteById(tags, draftTagId);

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
        <div style={{ height: 8, background: draftTagId ? tagPaletteById(tags, draftTagId).bg : "#E6E4DD", flexShrink: 0 }} />

        {/* Header */}
        <div style={{ padding: "16px 18px 12px", display: "flex", alignItems: "flex-start", gap: 10, flexShrink: 0 }}>
          <div style={{ flex: 1 }}>
            <input
              autoFocus
              value={draftTitle}
              onChange={e => setDraftTitle(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") commitDraft(); if (e.key === "Escape") cancelDraft(); }}
              placeholder="Event title…"
              style={{ width: "100%", fontSize: 17, fontWeight: 600, fontFamily: "'Lora', Georgia, serif", color: "#111", background: "#F3F0FE", border: "2px solid #7B73D6", borderRadius: 10, padding: "6px 10px", outline: "none", boxSizing: "border-box" }}
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

          {/* Time — start & end */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: "#AAA", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 8 }}>Time</label>
            <div style={{ display: "flex", gap: 8, alignItems: "flex-end", marginBottom: 10 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 10, fontWeight: 600, color: "#BBB", display: "block", marginBottom: 4 }}>Start</label>
                <input
                  type="time"
                  value={minsToTimeInput(draft.start)}
                  onChange={e => {
                    const newStart = timeInputToMins(e.target.value);
                    setDraft(prev => prev ? { ...prev, start: newStart } : prev);
                    setGhost(prev => prev ? { ...prev, start: newStart } : prev);
                  }}
                  style={{ width: "100%", background: "#F5F3F0", border: "1.5px solid rgba(123,115,214,0.22)", borderRadius: 10, padding: "8px 10px", fontSize: 14, fontWeight: 600, color: "#3C3489", outline: "none", boxSizing: "border-box", cursor: "pointer" }}
                />
              </div>
              <span style={{ fontSize: 14, color: "#C8C4BE", paddingBottom: 10, flexShrink: 0 }}>→</span>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 10, fontWeight: 600, color: "#BBB", display: "block", marginBottom: 4 }}>End</label>
                <input
                  type="time"
                  value={minsToTimeInput(draft.start + draft.duration)}
                  onChange={e => {
                    const endMins = timeInputToMins(e.target.value);
                    const newDur = Math.max(15, endMins - draft.start);
                    setDraft(prev => prev ? { ...prev, duration: newDur } : prev);
                    setGhost(prev => prev ? { ...prev, duration: newDur } : prev);
                  }}
                  style={{ width: "100%", background: "#F5F3F0", border: "1.5px solid rgba(123,115,214,0.22)", borderRadius: 10, padding: "8px 10px", fontSize: 14, fontWeight: 600, color: "#3C3489", outline: "none", boxSizing: "border-box", cursor: "pointer" }}
                />
              </div>
            </div>
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
              {DURATIONS.map(d => (
                <button type="button" key={d}
                  onClick={() => {
                    setDraft(prev => prev ? { ...prev, duration: d } : prev);
                    setGhost(prev => prev ? { ...prev, duration: d } : prev);
                  }}
                  style={{
                    padding: "5px 10px", borderRadius: 10, fontSize: 11, fontWeight: 600, cursor: "pointer",
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
                  const tc = tagPaletteById(tags, t.id);
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
  const colOpacity = 1;

  return (
    <div style={{
      flex: 1,
      background: bg,
      borderTop: "none",
      borderRight: border,
      borderBottom: border,
      borderLeft: border,
      borderRadius: 20,
      display: "flex",
      flexDirection: "column",
      minWidth: focusMode ? 0 : 120,
      minHeight: 80 + TIMELINE_HEIGHT,
      position: "relative",
      opacity: colOpacity,
      boxShadow: isT ? "0 0 0 0" : "none",
      overflow: "clip",
    }}>
      {/* Header — centered layout, also drop zone for stickers */}
      <div
        style={{
          padding: "14px 10px 12px", boxSizing: "border-box", flexShrink: 0, borderRadius: "19px 19px 0 0",
          background: headerDragOver ? (dayTypeDef ? dayTypeDef.bg : "#F0EEFF") : headerBg,
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6,
          cursor: onDayClick ? "pointer" : "default",
          outline: headerDragOver ? "2px dashed #7B73D6" : "none",
          outlineOffset: -3,
          transition: "background 0.15s, outline 0.1s",
          position: "sticky",
          top: 0,
          zIndex: 30,
          borderTop: stripColor ? `3px solid ${stripColor}` : border,
          borderLeft: border,
          borderRight: border,
          marginLeft: -1,
          marginRight: -1,
          boxShadow: "0 4px 8px -2px rgba(0,0,0,0.07)",
        }}
        onClick={() => onDayClick?.(date)}
        onDragOver={handleHeaderDragOver}
        onDragLeave={handleHeaderDragLeave}
        onDrop={handleHeaderDrop}
      >
        {/* Day name */}
        <span style={{ fontSize: focusMode ? 13 : 10, fontWeight: 700, letterSpacing: "0.06em", color: subColor, textTransform: "uppercase", lineHeight: 1, maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {format(date, "EEEE")}
        </span>

        {/* Big date circle */}
        <div style={{
          width: focusMode ? 48 : 36, height: focusMode ? 48 : 36,
          borderRadius: "50%",
          background: isT ? "#3B6D11" : isSelected ? (dayTypeDef ? dayTypeDef.border : "#C5BEF5") : "transparent",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <span style={{
            fontSize: focusMode ? 24 : 19, fontWeight: 700,
            color: isT ? "#fff" : isSelected ? "#fff" : titleColor,
            lineHeight: 1, fontFamily: "'DM Sans', system-ui, sans-serif",
          }}>
            {format(date, "d")}
          </span>
        </div>

        {/* Day-type pill — centered */}
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
            display: "flex", alignItems: "center", gap: 2,
            background: dayTypeDef ? dayTypeDef.bg : "rgba(0,0,0,0.04)",
            border: dayTypeDef ? `1px solid ${dayTypeDef.border}` : "1px solid rgba(0,0,0,0.08)",
            borderRadius: 5, padding: "2px 7px 2px 5px",
            cursor: "pointer", fontSize: 9, fontWeight: 600,
            color: dayTypeDef ? dayTypeDef.text : subColor,
          }}
        >
          <span style={{ fontSize: 10, lineHeight: 1 }}>{dayTypeDef ? dayTypeDef.emoji : "+"}</span>
          {dayTypeDef
            ? <span style={{ maxWidth: 64, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{dayTypeDef.label}</span>
            : <span style={{ opacity: 0.5 }}>type</span>
          }
        </button>

        {/* Stickers — stacked deck, expand on click */}
        {stickers.length > 0 && (
          <StickerDeck stickers={stickers} onPeel={peelSticker} onOpenBoard={onOpenDayBoard ? () => onOpenDayBoard(date) : undefined} />
        )}
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
          {dayTypeDefs.map(dt => (
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
          position: "relative", height: TIMELINE_HEIGHT - earlyHiddenPx, margin: "0 4px",
          cursor: onCreate ? "crosshair" : "default",
          outline: isDragOver ? "2px dashed #7B73D6" : "none",
          outlineOffset: 2,
          borderRadius: 8,
          transition: "outline 0.1s, height 0.25s ease",
          overflow: "hidden",
        }}
      >
        {/* Early-hours collapse/expand toggle */}
        <button
          type="button"
          onClick={() => setEarlyExpanded(x => !x)}
          style={{
            position: "absolute",
            top: earlyExpanded ? timeToY(EARLY_END_MINS) - EARLY_COLLAPSED_H : 0,
            left: 0, right: 0,
            height: EARLY_COLLAPSED_H,
            zIndex: 30,
            background: earlyExpanded ? "transparent" : "rgba(237,233,224,0.65)",
            border: "none",
            borderBottom: earlyExpanded ? "none" : "1px dashed #DED9D2",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 4,
            fontSize: 9,
            fontWeight: 600,
            color: earlyExpanded ? "#C8C4BE" : "#A8A4A0",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            transition: "top 0.25s ease, background 0.2s",
          }}
        >
          {earlyExpanded ? "▲ collapse" : "12am – 6am ↓"}
        </button>
        {/* Inner content — shifted up by earlyHiddenPx to collapse the early zone */}
        <div style={{ position: "absolute", top: -earlyHiddenPx, left: 0, right: 0, height: TIMELINE_HEIGHT, transition: "top 0.25s ease" }}>
        {/* Hour grid lines & markers */}
        {Array.from({ length: DAY_HOURS + 1 }, (_, i) => i).map((i) => {
          const hour = DAY_START / 60 + i;
          const h24 = hour % 24; // midnight wraps to 0
          // Skip early morning hours (midnight–5am) — nothing useful there
          if (h24 >= 0 && h24 < 6) return null;
          const isPM = h24 >= 12;
          const hour12 = h24 === 0 ? 12 : h24 > 12 ? h24 - 12 : h24;
          return (
            <div key={`hr-${i}`} style={{ position: "absolute", top: timeToY(i * 60), left: 0, right: 0, pointerEvents: "none", zIndex: 18 }}>
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
        {Array.from({ length: DAY_HOURS }, (_, i) => i).map((i) => (
          <div key={`hh-${i}`} style={{ position: "absolute", top: timeToY(i * 60 + 30), left: 0, right: 0, borderTop: "1px dashed rgba(0,0,0,0.03)", pointerEvents: "none", zIndex: 1 }} />
        ))}

        {/* Evening tint band */}
        <div style={{
          position: "absolute",
          top: timeToY(17 * 60),
          left: 0, right: 0,
          height: timeToY(24 * 60) - timeToY(17 * 60),
          background: "rgba(206,203,246,0.06)",
          borderRadius: 8,
          pointerEvents: "none",
          zIndex: 0,
        }} />

        {/* Section headers */}
        <AbsoluteSectionHeader title="MORNING"   y={timeToY(6 * 60)} />
        <AbsoluteSectionHeader title="AFTERNOON" y={timeToY(12 * 60)} />
        <AbsoluteSectionHeader title="EVENING"   y={timeToY(17 * 60)} />

        {/* Late-zone background (22:00–24:00) — warm off-white, compressed */}
        <div style={{
          position: "absolute",
          top: timeToY(LATE_START),
          left: 0, right: 0,
          height: TIMELINE_HEIGHT - timeToY(LATE_START),
          background: "#F8F7F4",
          borderTop: "1.5px dashed #E0DDD8",
          borderRadius: "0 0 8px 8px",
          pointerEvents: "none",
          zIndex: 1,
        }} />
        {/* Late-zone label */}
        <div style={{
          position: "absolute",
          top: timeToY(LATE_START) + 4,
          left: 8,
          fontSize: 8,
          fontWeight: 700,
          letterSpacing: "0.08em",
          color: "#C8C4BE",
          textTransform: "uppercase",
          pointerEvents: "none",
          zIndex: 2,
        }}>late</div>

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
        {privacyMode ? (
          // Privacy mode: shimmer bars, no titles
          <>
            {sorted.map((ev) => (
              <div
                key={ev.id}
                style={{
                  position: "absolute",
                  top: timeToY(ev.start),
                  left: 0, right: 0,
                  height: Math.max(durationToHeight(ev.start, Math.min(ev.duration, DAY_END - ev.start)), 20),
                  borderRadius: 10,
                  background: "linear-gradient(90deg, #E5E2DC 0%, #EDEBE7 40%, #E5E2DC 100%)",
                  backgroundSize: "200% 100%",
                  animation: "shimmer 1.8s ease-in-out infinite",
                  zIndex: 10,
                  overflow: "hidden",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "flex-end",
                  padding: "6px 8px 4px",
                }}
              >
                <div style={{ height: 7, borderRadius: 4, background: "rgba(0,0,0,0.08)", width: "65%", marginBottom: 4 }} />
                <div style={{ height: 5, borderRadius: 3, background: "rgba(0,0,0,0.05)", width: "40%" }} />
              </div>
            ))}
            {/* Open section pills for empty sections */}
            {(["MORNING", "AFTERNOON", "EVENING"] as const).map((section) => {
              const sectionStart = section === "MORNING" ? 6 * 60 : section === "AFTERNOON" ? 12 * 60 : 18 * 60;
              const sectionEnd   = section === "MORNING" ? 12 * 60 : section === "AFTERNOON" ? 18 * 60 : 24 * 60;
              const hasEvent = sorted.some(e => e.start >= sectionStart && e.start < sectionEnd);
              if (hasEvent) return null;
              const pillY = timeToY(sectionStart) + (section === "MORNING" ? 20 : 16);
              return (
                <div
                  key={section}
                  style={{
                    position: "absolute",
                    top: pillY,
                    left: 8, right: 8,
                    height: 28,
                    borderRadius: 8,
                    border: "1.5px dashed #C8C4BE",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 10, fontWeight: 500, color: "#A8A4A0",
                    pointerEvents: "none",
                    zIndex: 5,
                  }}
                >
                  open
                </div>
              );
            })}
          </>
        ) : compact ? (
          // Compact mode: small dot pills at event time
          sorted.map((ev) => {
            const colors = tagPaletteById(tags, ev.tagId);
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
          const isResizingTop = resizingTopId === ev.id;
          const isMoving = movingId === ev.id;
          const displayDuration = isResizing ? liveDuration : isResizingTop ? liveTopDuration : ev.duration;
          const displayStart = isMoving ? liveStart : isResizingTop ? liveTopStart : ev.start;
          const layout = eventLayoutMap.get(ev.id) ?? { lane: 0, totalLanes: 1 };
          const displayLane = isMoving ? liveLane : layout.lane;
          const displayTotalLanes = isMoving ? liveTotalLanes : layout.totalLanes;

          // Cascade layout: events overlap with a small left nudge per lane so each
          // still gets most of the column width for readable text.
          const GAP = 3;    // outer margin px
          const INDENT = 13; // px nudge per lane
          const leftCalc = `calc(${displayLane * INDENT}px + ${GAP}px)`;
          const widthCalc = `calc(100% - ${displayLane * INDENT + GAP * 2}px)`;

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
                left: leftCalc,
                width: widthCalc,
                height: Math.max(durationToHeight(displayStart, Math.min(displayDuration, DAY_END - displayStart)), 30),
                zIndex: isResizing || isResizingTop ? 15 : isMoving ? 16 : (10 + displayLane),
                transition: (isResizing || isResizingTop || isMoving) ? "none" : "left 0.15s ease, width 0.15s ease",
                cursor: isMoving ? "grabbing" : "grab",
                opacity: isMoving ? 0.88 : 1,
                padding: "0 2px",
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
                stacked={displayLane > 0}
              />

              {/* Live tooltip while moving — shows time + lane indicator */}
              {isMoving && (
                <div style={{
                  position: "absolute",
                  top: 6, left: "50%", transform: "translateX(-50%)",
                  background: "#3C3489",
                  color: "#fff",
                  fontSize: 10,
                  fontWeight: 600,
                  borderRadius: 6,
                  padding: "2px 8px",
                  pointerEvents: "none",
                  zIndex: 25,
                  whiteSpace: "nowrap",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}>
                  {minutesToLabel(liveStart)} → {minutesToLabel(liveStart + ev.duration)}
                  {liveTotalLanes > 1 && (
                    <span style={{ display: "flex", gap: 3, alignItems: "center" }}>
                      {Array.from({ length: liveTotalLanes }).map((_, i) => (
                        <span key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: i === liveLane ? "#fff" : "rgba(255,255,255,0.35)" }} />
                      ))}
                    </span>
                  )}
                </div>
              )}

              {/* Resize handle — top (adjusts start, keeps end fixed) */}
              {onUpdate && (
                <div
                  data-resize-handle="true"
                  onMouseDown={(e) => handleResizeTopMouseDown(e, ev)}
                  style={{
                    position: "absolute",
                    top: 0, left: 6, right: 6,
                    height: 10,
                    cursor: "ns-resize",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    zIndex: 20,
                    borderRadius: "8px 8px 0 0",
                    background: isResizingTop ? "rgba(107,98,184,0.12)" : "transparent",
                    transition: "background 0.15s",
                  }}
                  onMouseEnter={(e) => { if (!isResizingTop) (e.currentTarget as HTMLDivElement).style.background = "rgba(0,0,0,0.07)"; }}
                  onMouseLeave={(e) => { if (!isResizingTop) (e.currentTarget as HTMLDivElement).style.background = "transparent"; }}
                >
                  <div style={{
                    width: 24, height: 3, borderRadius: 2,
                    background: isResizingTop ? "#7B73D6" : "rgba(0,0,0,0.18)",
                    transition: "background 0.15s",
                  }} />
                </div>
              )}

              {/* Resize handle — bottom (adjusts duration, keeps start fixed) */}
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

              {/* Live tooltip — bottom resize */}
              {isResizing && !isMoving && (
                <div style={{ position: "absolute", bottom: 14, right: 8, background: "#3C3489", color: "#fff", fontSize: 10, fontWeight: 600, borderRadius: 6, padding: "2px 7px", pointerEvents: "none", zIndex: 25, whiteSpace: "nowrap" }}>
                  {minutesToLabel(ev.start)} → {minutesToLabel(ev.start + liveDuration)}
                </div>
              )}

              {/* Live tooltip — top resize */}
              {isResizingTop && (
                <div style={{ position: "absolute", top: 14, right: 8, background: "#3C3489", color: "#fff", fontSize: 10, fontWeight: 600, borderRadius: 6, padding: "2px 7px", pointerEvents: "none", zIndex: 25, whiteSpace: "nowrap" }}>
                  {minutesToLabel(liveTopStart)} → {minutesToLabel(liveTopStart + liveTopDuration)}
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
            tags={tags}
            timelineRef={timelineRef}
            onDelete={() => removeCapture(task.id)}
          />
        ))}

        {/* Past wash — subtle opacity tint for time before now */}
        {isT && now >= DAY_START && now <= DAY_END && (
          <div style={{
            position: "absolute",
            top: 0,
            left: 0, right: 0,
            height: timeToY(now),
            background: "rgba(0,0,0,0.025)",
            borderRadius: 8,
            pointerEvents: "none",
            zIndex: 9,
          }} />
        )}

        {/* Now marker */}
        {isT && now >= DAY_START && now <= DAY_END && (
          <div style={{ position: "absolute", top: timeToY(now) - 6, left: -4, right: 0, zIndex: 20 }}>
            <NowMarker />
          </div>
        )}
        </div>{/* end inner content wrapper */}
      </div>

      {creationPanel}
    </div>
  );
}
