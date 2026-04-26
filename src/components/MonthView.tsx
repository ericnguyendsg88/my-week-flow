import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  format, isToday, eachDayOfInterval,
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  addMonths, subMonths, getWeek,
} from "date-fns";
import { CalEvent, Tag } from "@/types/event";
import { nowMinutes } from "@/lib/event-utils";

interface Props {
  events: CalEvent[];
  tags: Tag[];
  onDayClick?: (date: Date) => void;
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function tagChip(tagId?: string): { bg: string; text: string; border: string; accent: string } {
  switch (tagId) {
    case "work":     return { bg: "#C8C3F0", text: "#2A246B", border: "#A89EE8", accent: "#534AB7" };
    case "deepwork": return { bg: "#B0E8D4", text: "#063A2F", border: "#7DCEB4", accent: "#0F6E56" };
    case "study":    return { bg: "#B8D8F0", text: "#08305A", border: "#8DC0E8", accent: "#185FA5" };
    case "personal": return { bg: "#F4C0D4", text: "#5C1D32", border: "#E898B8", accent: "#993556" };
    case "social":   return { bg: "#F8D898", text: "#4D2B05", border: "#F0BC60", accent: "#854F0B" };
    case "health":   return { bg: "#B8ECC8", text: "#1A4D2A", border: "#7DCCA0", accent: "#3B6D11" };
    case "errand":   return { bg: "#F0DCC8", text: "#4D2800", border: "#D8B890", accent: "#993C1D" };
    default:         return { bg: "#E4E1DC", text: "#44403C", border: "#C8C4BE", accent: "#5F5E5A" };
  }
}

function isHappeningNow(ev: CalEvent): boolean {
  if (!isToday(new Date(ev.date + "T00:00:00"))) return false;
  const now = nowMinutes();
  return now >= ev.start && now < ev.start + ev.duration;
}

export function MonthView({ events, tags, onDayClick }: Props) {
  const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(new Date()));
  const [direction, setDirection] = useState(0);

  function goBack() { setDirection(-1); setCurrentMonth((m) => subMonths(m, 1)); }
  function goForward() { setDirection(1); setCurrentMonth((m) => addMonths(m, 1)); }

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
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 0 12px", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: "#26231F", lineHeight: 1 }}>
            {format(currentMonth, "MMMM yyyy")}
          </h2>
          <button
            onClick={() => { setDirection(0); setCurrentMonth(startOfMonth(new Date())); }}
            style={{ fontSize: 11, fontWeight: 600, color: "#7B73D6", background: "#EEEDFE", border: "none", borderRadius: 12, padding: "3px 10px", cursor: "pointer" }}
          >today</button>
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          <button onClick={goBack} style={navBtn}>‹</button>
          <button onClick={goForward} style={navBtn}>›</button>
        </div>
      </div>

      {/* Table */}
      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", border: "1px solid #E5E2DC", borderRadius: 14, overflow: "hidden" }}>
        {/* Column header row */}
        <div style={{ display: "grid", gridTemplateColumns: "32px repeat(7, 1fr)", background: "#F5F3EF", borderBottom: "1px solid #E5E2DC", flexShrink: 0 }}>
          <div style={{ borderRight: "1px solid #E5E2DC" }} />
          {WEEKDAYS.map((d, i) => {
            const isWeekend = i >= 5;
            return (
              <div key={i} style={{
                padding: "8px 0",
                textAlign: "center",
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.05em",
                color: isWeekend ? "#B0ACA8" : "#888480",
                borderRight: i < 6 ? "1px solid #E5E2DC" : "none",
              }}>
                {d}
              </div>
            );
          })}
        </div>

        {/* Animated grid body */}
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
              style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column" }}
            >
              {weeks.map((week, wi) => (
                <div
                  key={wi}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "32px repeat(7, 1fr)",
                    flex: 1,
                    minHeight: 0,
                    borderBottom: wi < weeks.length - 1 ? "1px solid #E5E2DC" : "none",
                  }}
                >
                  {/* Week number */}
                  <div style={{
                    display: "flex", alignItems: "flex-start", justifyContent: "center",
                    paddingTop: 8,
                    fontSize: 9, fontWeight: 700, color: "#C8C4BE",
                    letterSpacing: "0.03em",
                    borderRight: "1px solid #E5E2DC",
                  }}>
                    W{getWeek(week[0], { weekStartsOn: 1 })}
                  </div>

                  {week.map((day, di) => {
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
                        isLast={di === 6}
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
    </div>
  );
}

const navBtn: React.CSSProperties = {
  width: 30, height: 30, borderRadius: "50%",
  background: "#fff", border: "1px solid #E8E4DF",
  fontSize: 18, lineHeight: 1, cursor: "pointer",
  display: "flex", alignItems: "center", justifyContent: "center",
  color: "#44403C",
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
  isLast: boolean;
  onClick: () => void;
}

function DayCell({ day, dayEvents, isCurrentMonth, isToday: todayDay, isLast, onClick }: DayCellProps) {
  const [hovered, setHovered] = useState(false);
  const sortedEvents = [...dayEvents].sort((a, b) => a.start - b.start);
  const laneEvents = sortedEvents.slice(0, 3);
  const overflowCount = Math.max(0, sortedEvents.length - laneEvents.length);

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: todayDay ? "#F7FBF4" : hovered ? "rgba(0,0,0,0.015)" : "transparent",
        borderRight: isLast ? "none" : "1px solid #E5E2DC",
        outline: todayDay ? "2px solid #3B6D11" : "none",
        outlineOffset: -1,
        padding: "6px 5px 4px",
        cursor: "pointer",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        gap: 2,
        opacity: isCurrentMonth ? 1 : 0.38,
        transition: "background 0.1s",
        position: "relative",
      }}
    >
      {/* Day number */}
      <div style={{ display: "flex", alignItems: "center", paddingLeft: 2, marginBottom: 1, flexShrink: 0 }}>
        {todayDay ? (
          <div style={{ minWidth: 20, height: 20, borderRadius: "50%", background: "#3B6D11", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: "#fff", lineHeight: 1 }}>{format(day, "d")}</span>
          </div>
        ) : (
          <span style={{ fontSize: 11, fontWeight: isCurrentMonth ? 500 : 400, color: isCurrentMonth ? "#33302C" : "#B0ACA8", lineHeight: 1 }}>
            {format(day, "d")}
          </span>
        )}
      </div>

      {/* Event pills */}
      <div style={{ display: "flex", flexDirection: "column", gap: 2, overflow: "hidden", flex: 1 }}>
        {laneEvents.map((ev) => {
          const chip = tagChip(ev.tagId);
          const isTentative = ev.tentative === true;
          const isSkipped = ev.completed === false;
          const isCompleted = ev.completed === true;
          const happening = isHappeningNow(ev);

          return (
            <div
              key={ev.id}
              style={{
                width: "100%",
                minWidth: 0,
                borderRadius: 4,
                overflow: "hidden",
                display: "flex",
                alignItems: "stretch",
                background: isTentative ? "transparent"
                  : isSkipped ? "#EDEBE7"
                  : isCompleted ? "#D6EDBE"
                  : happening ? chip.bg
                  : chip.bg,
                border: isTentative ? `1.5px dashed ${chip.border}` : "none",
                opacity: isSkipped ? 0.65 : 1,
              }}
            >
              {/* Left accent bar for happening now */}
              {happening && !isTentative && (
                <div style={{
                  width: 3,
                  flexShrink: 0,
                  background: chip.accent,
                  animation: "pulse 1.4s ease-in-out infinite",
                }} />
              )}
              <div style={{
                flex: 1,
                padding: "2px 5px",
                fontSize: 9,
                fontWeight: happening ? 700 : 600,
                lineHeight: 1.3,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                color: isSkipped ? "#888" : isCompleted ? "#27500A" : chip.text,
                textDecoration: isSkipped ? "line-through" : "none",
              }}>
                {happening && <span style={{ opacity: 0.7, marginRight: 3 }}>●</span>}
                {ev.title}
                {isCompleted && <span style={{ marginLeft: 3, opacity: 0.7 }}>✓</span>}
              </div>
            </div>
          );
        })}
        {overflowCount > 0 && (
          <span style={{ fontSize: 8, color: "#8F8A84", fontWeight: 600, paddingLeft: 2, lineHeight: 1.1 }}>
            +{overflowCount} more
          </span>
        )}
      </div>
    </div>
  );
}
