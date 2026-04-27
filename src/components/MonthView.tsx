import { useEffect, useRef, useState } from "react";
import {
  format, isToday, eachDayOfInterval,
  startOfWeek, endOfWeek, addWeeks, subWeeks,
  getWeek, isSameMonth, startOfDay,
} from "date-fns";
import { CalEvent } from "@/types/event";
import { nowMinutes } from "@/lib/event-utils";

interface Props {
  events: CalEvent[];
  tags?: never[];
  onDayClick?: (date: Date) => void;
  onDayNavigate?: (date: Date) => void;
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const WEEKS_BEFORE = 2;  // past weeks above today's week
const WEEKS_AFTER = 8;   // future weeks below

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

export function MonthView({ events, onDayClick, onDayNavigate }: Props) {
  const today = startOfDay(new Date());
  const scrollRef = useRef<HTMLDivElement>(null);
  const todayRowRef = useRef<HTMLDivElement>(null);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);   // "yyyy-MM-dd"
  const [selectedWeek, setSelectedWeek] = useState<number | null>(null); // wi index

  // Build rolling weeks: WEEKS_BEFORE before today's week + today's week + WEEKS_AFTER after
  const todayWeekStart = startOfWeek(today, { weekStartsOn: 1 });
  const gridStart = startOfWeek(subWeeks(todayWeekStart, WEEKS_BEFORE), { weekStartsOn: 1 });
  const gridEnd = endOfWeek(addWeeks(todayWeekStart, WEEKS_AFTER), { weekStartsOn: 1 });
  const allDays = eachDayOfInterval({ start: gridStart, end: gridEnd });

  const weeks: Date[][] = [];
  for (let i = 0; i < allDays.length; i += 7) weeks.push(allDays.slice(i, i + 7));

  // Scroll to today's week on mount
  useEffect(() => {
    if (todayRowRef.current && scrollRef.current) {
      const rowTop = todayRowRef.current.offsetTop;
      scrollRef.current.scrollTop = rowTop - 40;
    }
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", width: "100%", overflow: "hidden" }}>
      {/* Column header — sticky */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "52px repeat(7, 1fr)",
        background: "#F5F3EF",
        borderBottom: "1px solid #E5E2DC",
        borderRadius: "14px 14px 0 0",
        flexShrink: 0,
      }}>
        <div style={{ borderRight: "1px solid #E5E2DC" }} />
        {WEEKDAYS.map((d, i) => {
          const isWeekend = i >= 5;
          const isCurrentDay = today.getDay() === (i === 6 ? 0 : i + 1);
          return (
            <div key={i} style={{
              padding: "9px 0",
              textAlign: "center",
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.05em",
              color: isCurrentDay ? "#3B6D11" : isWeekend ? "#B0ACA8" : "#888480",
              borderRight: i < 6 ? "1px solid #E5E2DC" : "none",
            }}>
              {d}
            </div>
          );
        })}
      </div>

      {/* Scrollable grid body */}
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          border: "1px solid #E5E2DC",
          borderTop: "none",
          borderRadius: "0 0 14px 14px",
        }}
      >
        {weeks.map((week, wi) => {
          const isCurrentWeek = week.some((d) => isToday(d));
          const isPastWeek = week[6] < today && !isCurrentWeek;
          const isWeekSelected = selectedWeek === wi;

          // Month boundary divider
          const prevWeek = wi > 0 ? weeks[wi - 1] : null;
          const showMonthDivider = prevWeek && week[0].getMonth() !== prevWeek[0].getMonth();
          const dividerMonth = showMonthDivider ? format(week[0], "MMMM yyyy") : null;

          function handleWeekClick() {
            setSelectedDay(null);
            setSelectedWeek(v => v === wi ? null : wi);
          }

          return (
            <div key={wi}>
              {/* Month boundary divider */}
              {showMonthDivider && (
                <div style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "8px 12px", background: "#F8F6FF",
                  borderBottom: "1px solid #E5E2DC", borderTop: "1px solid #E5E2DC",
                }}>
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#7B73D6", flexShrink: 0 }} />
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#534AB7", letterSpacing: "0.03em" }}>{dividerMonth}</span>
                  <div style={{ flex: 1, height: 1, background: "#D8D4F8" }} />
                </div>
              )}

              {/* Week row */}
              <div
                ref={isCurrentWeek ? todayRowRef : undefined}
                style={{
                  display: "grid",
                  gridTemplateColumns: "52px repeat(7, 1fr)",
                  minHeight: 72,
                  borderBottom: wi < weeks.length - 1 ? "1px solid #E5E2DC" : "none",
                  outline: isWeekSelected ? "2px solid #534AB7"
                    : isCurrentWeek ? "2px solid #3B6D11"
                    : "none",
                  outlineOffset: -1,
                  position: "relative",
                  zIndex: isWeekSelected || isCurrentWeek ? 1 : 0,
                  opacity: isPastWeek ? 0.5 : 1,
                  background: isWeekSelected ? "rgba(83,74,183,0.03)" : "transparent",
                }}
              >
                {/* Week gutter — click to select entire week */}
                <div
                  onClick={handleWeekClick}
                  title="Select week"
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "flex-start",
                    paddingTop: 7,
                    borderRight: "1px solid #E5E2DC",
                    gap: 2,
                    cursor: "pointer",
                    background: isWeekSelected ? "rgba(83,74,183,0.07)" : "transparent",
                    transition: "background 0.12s",
                  }}
                  onMouseEnter={e => { if (!isWeekSelected) e.currentTarget.style.background = "rgba(0,0,0,0.04)"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = isWeekSelected ? "rgba(83,74,183,0.07)" : "transparent"; }}
                >
                  <span style={{ fontSize: 9, fontWeight: 700, color: isWeekSelected ? "#534AB7" : isCurrentWeek ? "#3B6D11" : "#C8C4BE", letterSpacing: "0.02em" }}>
                    W{getWeek(week[0], { weekStartsOn: 1 })}
                  </span>
                  <span style={{ fontSize: 8, color: isWeekSelected ? "#7B73D6" : "#C8C4BE", fontWeight: 500 }}>
                    {format(week[0], "MMM d")}
                  </span>
                  {isCurrentWeek && !isWeekSelected && (
                    <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#3B6D11", marginTop: 2 }} />
                  )}
                  {isWeekSelected && (
                    <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#534AB7", marginTop: 2 }} />
                  )}
                </div>

                {/* Day cells */}
                {week.map((day, di) => {
                  const dayKey = format(day, "yyyy-MM-dd");
                  const dayEvents = events.filter((e) => e.date === dayKey && !e.allDay);
                  const todayDay = isToday(day);
                  const isCurrentMonthDay = isSameMonth(day, week[3]); // use midweek ref

                  return (
                    <DayCell
                      key={dayKey}
                      day={day}
                      dayEvents={dayEvents}
                      isToday={todayDay}
                      isCurrentMonth={isCurrentMonthDay}
                      isLast={di === 6}
                      isSelected={selectedDay === dayKey}
                      onClick={() => {
                        setSelectedWeek(null);
                        if (selectedDay === dayKey) {
                          // second click → navigate
                          onDayNavigate?.(day);
                        } else {
                          // first click → select
                          setSelectedDay(dayKey);
                          onDayClick?.(day);
                        }
                      }}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface DayCellProps {
  day: Date;
  dayEvents: CalEvent[];
  isToday: boolean;
  isCurrentMonth: boolean;
  isLast: boolean;
  isSelected: boolean;
  onClick: () => void;
}

function DayCell({ day, dayEvents, isToday: todayDay, isCurrentMonth, isLast, isSelected, onClick }: DayCellProps) {
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
        background: isSelected ? "rgba(83,74,183,0.05)" : todayDay ? "#F7FBF4" : hovered ? "rgba(0,0,0,0.015)" : "transparent",
        borderRight: isLast ? "none" : "1px solid #E5E2DC",
        outline: isSelected ? "2px solid #534AB7" : todayDay ? "2px solid #3B6D11" : "none",
        outlineOffset: -1,
        padding: "5px 4px 4px",
        cursor: "pointer",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        gap: 2,
        opacity: isCurrentMonth ? 1 : 0.35,
        transition: "background 0.1s",
        position: "relative",
        zIndex: isSelected ? 1 : 0,
      }}
    >
      {/* Day number */}
      <div style={{ paddingLeft: 2, marginBottom: 1, flexShrink: 0 }}>
        {todayDay ? (
          <div style={{ width: 20, height: 20, borderRadius: "50%", background: "#3B6D11", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: "#fff", lineHeight: 1 }}>{format(day, "d")}</span>
          </div>
        ) : isSelected ? (
          <div style={{ width: 20, height: 20, borderRadius: "50%", background: "#534AB7", display: "flex", alignItems: "center", justifyContent: "center" }}>
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
                borderRadius: 20,
                overflow: "hidden",
                display: "flex",
                alignItems: "stretch",
                background: isTentative ? "transparent" : isSkipped ? "#EDEBE7" : isCompleted ? "#D6EDBE" : chip.bg,
                border: isTentative ? `1.5px dashed ${chip.border}` : "none",
                opacity: isSkipped ? 0.65 : 1,
              }}
            >
              {happening && !isTentative && (
                <div style={{ width: 3, flexShrink: 0, background: chip.accent, animation: "pulse 1.4s ease-in-out infinite" }} />
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
          <span style={{ fontSize: 8, color: "#8F8A84", fontWeight: 600, paddingLeft: 2 }}>+{overflowCount}</span>
        )}
      </div>
    </div>
  );
}
