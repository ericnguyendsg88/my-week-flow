import { motion } from "framer-motion";
import { format, isToday, isWeekend } from "date-fns";
import { CalEvent, Tag } from "@/types/event";
import { EventBubble } from "./EventBubble";
import { NowMarker } from "./NowMarker";
import { GapPlaceholder } from "./GapPlaceholder";
import { EmptyDayCard } from "./EmptyDayCard";
import { cn } from "@/lib/utils";

interface Props {
  date: Date;
  events: CalEvent[];
  tags: Tag[];
  depth: number; // 0 = today
  isFirst?: boolean;
  pickMode?: boolean;
  onPickSlot?: (date: string, minutes: number) => void;
  onFocusDay?: (dayKey: string) => void;
  selected?: boolean;
}

const HOUR_HEIGHT = 56;
const START_HOUR = 7;
const END_HOUR = 22;
const GAP_MIN = 45; // minutes

function depthOpacity(depth: number) {
  if (depth <= 1) return "opacity-100";
  if (depth === 2) return "opacity-[0.85]";
  return "opacity-60";
}

export function DayColumn({
  date,
  events,
  tags,
  depth,
  isFirst,
  pickMode,
  onPickSlot,
  onFocusDay,
  selected,
}: Props) {
  const hours = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => START_HOUR + i);
  const dayKey = format(date, "yyyy-MM-dd");
  const today = isToday(date);
  const weekend = isWeekend(date);

  const dayEvents = events.filter((e) => e.date === dayKey).sort((a, b) => a.start - b.start);

  // Build gap placeholders (between events with >= GAP_MIN gap, within visible window)
  const gaps: { start: number; duration: number }[] = [];
  const winStart = START_HOUR * 60;
  const winEnd = END_HOUR * 60;
  if (dayEvents.length > 0) {
    let cursor = winStart;
    for (const e of dayEvents) {
      const gap = Math.min(e.start, winEnd) - cursor;
      if (gap >= GAP_MIN && cursor >= winStart) {
        gaps.push({ start: cursor, duration: gap });
      }
      cursor = Math.max(cursor, e.start + e.duration);
    }
    const trailing = winEnd - cursor;
    if (trailing >= GAP_MIN) gaps.push({ start: cursor, duration: trailing });
  }

  function handleGridClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!pickMode || !onPickSlot) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const totalMinutes = (y / HOUR_HEIGHT) * 60;
    const snapped = Math.round(totalMinutes / 15) * 15 + START_HOUR * 60;
    onPickSlot(dayKey, snapped);
  }

  return (
    <div className={cn("flex w-[200px] shrink-0 flex-col", depthOpacity(depth))}>
      {/* Header */}
      <button
        type="button"
        onClick={() => onFocusDay?.(dayKey)}
        className={cn(
          "sticky top-0 z-10 mb-2 flex flex-col items-center rounded-2xl pb-2 pt-1.5 backdrop-blur transition-all",
          today
            ? "bg-tag-purple-soft/80 ring-1 ring-tag-purple/30"
            : selected
            ? "bg-muted/80 ring-1 ring-border"
            : "bg-canvas/80 hover:bg-muted/40"
        )}
      >
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {format(date, "EEE")}
        </span>
        <motion.div
          layout
          className={cn(
            "mt-1 flex h-10 w-10 items-center justify-center rounded-full font-display text-lg font-bold",
            today ? "bg-gradient-primary text-primary-foreground shadow-bubble" : "text-foreground"
          )}
        >
          {format(date, "d")}
        </motion.div>
        {today && (
          <span className="mt-1 text-[10px] font-bold uppercase tracking-wider text-tag-purple">
            Today
          </span>
        )}
      </button>

      {/* Grid */}
      <div
        className={cn(
          "relative flex-1 rounded-3xl bg-card/60 p-1 ring-1 transition-all",
          today
            ? "ring-[1.5px] ring-tag-purple/60"
            : pickMode
            ? "cursor-crosshair ring-2 ring-primary/60 shadow-bubble"
            : "ring-border/60"
        )}
      >
        <div
          className="relative"
          style={{ height: (END_HOUR - START_HOUR) * HOUR_HEIGHT }}
          onClick={handleGridClick}
        >
          {hours.map((h, i) => (
            <div
              key={h}
              className="absolute left-0 right-0 border-t border-border/40"
              style={{ top: i * HOUR_HEIGHT }}
            >
              {isFirst && (
                <span className="absolute -left-9 -top-2 text-[10px] font-medium text-muted-foreground">
                  {h % 12 === 0 ? 12 : h % 12}
                  {h >= 12 ? "p" : "a"}
                </span>
              )}
            </div>
          ))}

          {/* Now line */}
          {today && (
            <NowMarker
              startHour={START_HOUR}
              endHour={END_HOUR}
              hourHeight={HOUR_HEIGHT}
            />
          )}

          {/* Empty day card */}
          {dayEvents.length === 0 && (
            <div className="absolute inset-2">
              <EmptyDayCard weekend={weekend} />
            </div>
          )}

          {/* Gaps */}
          {gaps.map((g, i) => {
            const top = ((g.start - START_HOUR * 60) / 60) * HOUR_HEIGHT;
            const height = (g.duration / 60) * HOUR_HEIGHT;
            return (
              <div
                key={`gap-${i}`}
                className="absolute left-1 right-1"
                style={{ top, height }}
              >
                <GapPlaceholder minutes={g.duration} />
              </div>
            );
          })}

          {/* Events */}
          {dayEvents.map((e) => {
            const top = ((e.start - START_HOUR * 60) / 60) * HOUR_HEIGHT;
            const height = (e.duration / 60) * HOUR_HEIGHT;
            return (
              <div
                key={e.id}
                className="absolute left-1 right-1"
                style={{ top, height }}
              >
                <EventBubble event={e} tags={tags} compact />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
