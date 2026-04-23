import { useRef, useState } from "react";
import { format, isToday, isTomorrow } from "date-fns";
import { CalEvent, Tag } from "@/types/event";
import { EventBubble } from "./EventBubble";
import { GapPlaceholder } from "./GapPlaceholder";
import { NowMarker } from "./NowMarker";
import { nowMinutes } from "@/lib/event-utils";

interface Props {
  date: Date;
  events: CalEvent[];
  tags: Tag[];
  onMark?: (eventId: string, completed: boolean | null) => void;
  onDelete?: (eventId: string) => void;
  onResize?: (eventId: string, newDuration: number) => void;
  onUpdate?: (eventId: string, patch: Partial<import("@/types/event").CalEvent>) => void;
  focusMode?: boolean;
}

const timeToY = (mins: number) => Math.max(0, mins - 7 * 60);


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

// snap to nearest 15 minutes, min 15
function snapDuration(mins: number) {
  return Math.max(15, Math.round(mins / 15) * 15);
}

export function DayColumn({ date, events, tags, onMark, onDelete, onResize, onUpdate, focusMode }: Props) {
  const isT = isToday(date);
  const isTom = isTomorrow(date);
  const isWeekend = date.getDay() === 0 || date.getDay() === 6;

  let subtitle = format(date, "EEE d").toLowerCase();
  if (isT) subtitle = "today";
  if (isTom) subtitle = "tomorrow";
  if (isWeekend) subtitle = "open day";

  const now = nowMinutes();

  let bg = "#F8F8F6";
  let border = "1px solid #EAEAEA";
  let titleColor = "#444441";
  let subColor = "#888580";

  if (isT) {
    bg = "#F2FAF0";
    border = "1px solid #B6DFB0";
    titleColor = "#1D5C17";
    subColor = "#3A8733";
  }

  const sorted = [...events].sort((a, b) => a.start - b.start);

  // drag-resize state: track which event is being resized and its live duration
  const [resizingId, setResizingId] = useState<string | null>(null);
  const [liveDuration, setLiveDuration] = useState<number>(0);
  const dragRef = useRef<{ startY: number; origDuration: number } | null>(null);

  function handleResizeMouseDown(ev: React.MouseEvent, event: CalEvent) {
    ev.preventDefault();
    ev.stopPropagation();
    setResizingId(event.id);
    setLiveDuration(event.duration);
    dragRef.current = { startY: ev.clientY, origDuration: event.duration };

    function onMove(e: MouseEvent) {
      if (!dragRef.current) return;
      const delta = e.clientY - dragRef.current.startY;
      const newDur = snapDuration(dragRef.current.origDuration + delta);
      setLiveDuration(newDur);
    }

    function onUp(e: MouseEvent) {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      if (dragRef.current) {
        const delta = e.clientY - dragRef.current.startY;
        const newDur = snapDuration(dragRef.current.origDuration + delta);
        if (newDur !== dragRef.current.origDuration) {
          onResize?.(event.id, newDur);
        }
      }
      dragRef.current = null;
      setResizingId(null);
    }

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }

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
      {/* Header */}
      <div style={{ padding: "16px 16px 8px", height: 80, boxSizing: "border-box", flexShrink: 0 }}>
        <h3 style={{ fontSize: focusMode ? 20 : 16, fontWeight: 600, color: titleColor }}>{format(date, "EEEE")}</h3>
        <p style={{ fontSize: 13, color: subColor, fontWeight: 500, marginTop: 2 }}>{subtitle}</p>
      </div>

      {/* Timeline */}
      <div style={{ position: "relative", height: 15 * 60, margin: "0 12px" }}>

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
          <div style={{ position: "absolute", top: timeToY(17 * 60) + 24, left: 0, right: 0, background: "rgba(107,98,184,0.08)", border: "1px dashed #A89FE0", borderRadius: 8, padding: "10px", textAlign: "center" }}>
            <p style={{ fontSize: 13, fontWeight: 500, color: "#6B62B8" }}>🌙 free evening</p>
            <p style={{ fontSize: 11, color: "#6B62B8", opacity: 0.8 }}>protect this?</p>
          </div>
        )}

        {/* Events */}
        {sorted.map((ev) => {
          const isResizing = resizingId === ev.id;
          const displayDuration = isResizing ? liveDuration : ev.duration;
          return (
            <div
              key={ev.id}
              style={{
                position: "absolute",
                top: timeToY(ev.start),
                left: 0, right: 0,
                height: Math.max(displayDuration, 76),
                zIndex: isResizing ? 15 : 10,
                transition: isResizing ? "none" : undefined,
              }}
            >
              <EventBubble
                event={ev}
                tags={tags}
                onMark={onMark ? (c) => onMark(ev.id, c) : undefined}
                onDelete={onDelete ? () => onDelete(ev.id) : undefined}
                onUpdate={onUpdate ? (patch) => onUpdate(ev.id, patch) : undefined}
                isResizing={isResizing}
              />

              {/* Resize handle */}
              {onResize && (
                <div
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
              {isResizing && (
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
    </div>
  );
}
