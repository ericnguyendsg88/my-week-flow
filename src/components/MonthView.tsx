import { useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  format, isToday, eachDayOfInterval,
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  addMonths, subMonths, getWeek,
} from "date-fns";
import { CalEvent, Tag } from "@/types/event";

interface Props {
  events: CalEvent[];
  tags: Tag[];
  onDayClick?: (date: Date) => void;
}

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];

function tagChip(tagId?: string): { bg: string; text: string; border: string } {
  switch (tagId) {
    case "work":     return { bg: "#C8C3F0", text: "#2A246B", border: "#A89EE8" };
    case "deepwork": return { bg: "#B0E8D4", text: "#063A2F", border: "#7DCEB4" };
    case "study":    return { bg: "#B8D8F0", text: "#08305A", border: "#8DC0E8" };
    case "personal": return { bg: "#F4C0D4", text: "#5C1D32", border: "#E898B8" };
    case "social":   return { bg: "#F8D898", text: "#4D2B05", border: "#F0BC60" };
    case "health":   return { bg: "#B8ECC8", text: "#1A4D2A", border: "#7DCCA0" };
    case "errand":   return { bg: "#F0DCC8", text: "#4D2800", border: "#D8B890" };
    default:         return { bg: "#E4E1DC", text: "#44403C", border: "#C8C4BE" };
  }
}

export function MonthView({ events, tags, onDayClick }: Props) {
  const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(new Date()));
  const [direction, setDirection] = useState(0); // -1 = back, 1 = forward

  function goBack() {
    setDirection(-1);
    setCurrentMonth((m) => subMonths(m, 1));
  }
  function goForward() {
    setDirection(1);
    setCurrentMonth((m) => addMonths(m, 1));
  }

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

  const weeks: Date[][] = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", width: "100%", overflow: "hidden" }}>
      {/* Month header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 0 16px",
        flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: "#26231F", lineHeight: 1 }}>
            {format(currentMonth, "MMMM yyyy")}
          </h2>
          <button
            onClick={() => { setDirection(0); setCurrentMonth(startOfMonth(new Date())); }}
            style={{
              fontSize: 11, fontWeight: 600, color: "#7B73D6",
              background: "#EEEDFE", border: "none", borderRadius: 12,
              padding: "3px 10px", cursor: "pointer",
            }}
          >
            today
          </button>
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          <button onClick={goBack} style={navBtn}>‹</button>
          <button onClick={goForward} style={navBtn}>›</button>
        </div>
      </div>

      {/* Weekday header row */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "32px repeat(7, 1fr)",
        marginBottom: 6,
        flexShrink: 0,
      }}>
        <div /> {/* spacer for week numbers */}
        {WEEKDAYS.map((d, i) => (
          <div key={i} style={{
            textAlign: "center",
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.04em",
            color: "#AAA6A0",
            paddingBottom: 4,
          }}>
            {d}
          </div>
        ))}
      </div>

      {/* Animated month grid */}
      <div style={{ flex: 1, minHeight: 0, position: "relative", overflow: "hidden" }}>
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={format(currentMonth, "yyyy-MM")}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ type: "spring", stiffness: 320, damping: 32, mass: 0.9 }}
            style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", gap: 4 }}
          >
            {weeks.map((week, wi) => (
              <div
                key={wi}
                style={{
                  display: "grid",
                  gridTemplateColumns: "32px repeat(7, 1fr)",
                  gap: 4,
                  flex: 1,
                  minHeight: 0,
                }}
              >
                {/* Week number */}
                <div style={{
                  display: "flex", alignItems: "flex-start", paddingTop: 6,
                  fontSize: 10, fontWeight: 600, color: "#C8C4BE",
                  letterSpacing: "0.02em",
                }}>
                  W{getWeek(week[0], { weekStartsOn: 1 })}
                </div>

                {week.map((day) => {
                  const dayKey = format(day, "yyyy-MM-dd");
                  const dayEvents = events.filter((e) => e.date === dayKey && !e.allDay);
                  const isCurrentMonth = day.getMonth() === currentMonth.getMonth();
                  const todayDay = isToday(day);

                  return (
                    <DayCell
                      key={dayKey}
                      day={day}
                      dayEvents={dayEvents}
                      isCurrentMonth={isCurrentMonth}
                      isToday={todayDay}
                      onClick={() => onDayClick?.(day)}
                    />
                  );
                })}
              </div>
            ))}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

const navBtn: React.CSSProperties = {
  width: 30, height: 30, borderRadius: "50%",
  background: "#fff", border: "1px solid #E8E4DF",
  fontSize: 18, lineHeight: 1, cursor: "pointer",
  display: "flex", alignItems: "center", justifyContent: "center",
  color: "#44403C", fontWeight: 400,
  boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
};

const slideVariants = {
  enter: (dir: number) => ({ x: dir >= 0 ? "100%" : "-100%", opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir >= 0 ? "-100%" : "100%", opacity: 0 }),
};

interface DayCellProps {
  day: Date;
  dayEvents: CalEvent[];
  isCurrentMonth: boolean;
  isToday: boolean;
  onClick: () => void;
}

function DayCell({ day, dayEvents, isCurrentMonth, isToday: todayDay, onClick }: DayCellProps) {
  const [hovered, setHovered] = useState(false);

  // Calculate overlapping events and their columns (max 4 side by side)
  const getEventColumns = (events: CalEvent[]) => {
    if (events.length === 0) return [];
    
    const sorted = [...events].sort((a, b) => a.start - b.start);
    const columns: CalEvent[][] = [[]];
    
    for (const event of sorted) {
      let placed = false;
      
      // Try to find a column where this event doesn't overlap
      for (let i = 0; i < columns.length; i++) {
        const col = columns[i];
        const lastInCol = col[col.length - 1];
        
        if (!lastInCol || (lastInCol.start + lastInCol.duration) <= event.start) {
          col.push(event);
          placed = true;
          break;
        }
      }
      
      // If not placed and we have room, create new column (max 4)
      if (!placed && columns.length < 4) {
        columns.push([event]);
        placed = true;
      }
      
      // Force into last column if at max
      if (!placed) {
        columns[columns.length - 1].push(event);
      }
    }
    
    return columns;
  };

  const eventColumns = getEventColumns(dayEvents);
  const maxCols = eventColumns.length;

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        borderRadius: 10,
        background: hovered
          ? "#EDEAE6"
          : isCurrentMonth ? "#F8F6F3" : "rgba(0,0,0,0.018)",
        border: todayDay
          ? "1.5px solid #C5BEF5"
          : "1px solid rgba(0,0,0,0.055)",
        padding: "6px 6px 5px",
        cursor: "pointer",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        gap: 2,
        opacity: isCurrentMonth ? 1 : 0.38,
        transition: "background 0.1s",
        boxShadow: todayDay
          ? "inset 0 0 0 1px rgba(123,115,214,0.12), 0 1px 4px rgba(123,115,214,0.10)"
          : "none",
      }}
    >
      {/* Day number */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "flex-start",
        flexShrink: 0,
        paddingLeft: 1,
      }}>
        {todayDay ? (
          <div style={{
            width: 22, height: 22, borderRadius: "50%",
            background: "#3C3489",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#fff", lineHeight: 1 }}>
              {format(day, "d")}
            </span>
          </div>
        ) : (
          <span style={{
            fontSize: 12,
            fontWeight: isCurrentMonth ? 500 : 400,
            color: isCurrentMonth ? "#33302C" : "#B0ACA8",
            lineHeight: 1,
          }}>
            {format(day, "d")}
          </span>
        )}
      </div>

      {/* Event chips - stacked side by side */}
      <div style={{ display: "flex", flexDirection: "column", gap: 1, overflow: "hidden", flex: 1 }}>
        {eventColumns.map((col, colIdx) => (
          <div key={colIdx} style={{ display: "flex", gap: 1 }}>
            {col.map((ev) => {
              const chip = tagChip(ev.tagId);
              const isTentative = ev.tentative === true;
              const isSkipped = ev.completed === false;
              const isCompleted = ev.completed === true;

              return (
                <div
                  key={ev.id}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    borderRadius: 3,
                    padding: "1px 3px",
                    fontSize: 9,
                    fontWeight: 500,
                    lineHeight: 1.2,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    background: isTentative ? "transparent" : isSkipped ? "#E6E4DD" : isCompleted ? "#C8E8A0" : chip.bg,
                    color: isTentative ? chip.text : isSkipped ? "#888" : isCompleted ? "#27500A" : chip.text,
                    border: isTentative ? `1px dashed ${chip.border}` : "none",
                    textDecoration: isSkipped ? "line-through" : "none",
                    opacity: isSkipped ? 0.7 : 1,
                  }}
                >
                  {ev.title}
                </div>
              );
            })}
          </div>
        ))}
        {dayEvents.length > 0 && (
          <span style={{ fontSize: 8, color: "#A8A4A0", fontWeight: 500, paddingLeft: 2 }}>
            {dayEvents.length} event{dayEvents.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>
    </div>
  );
}
