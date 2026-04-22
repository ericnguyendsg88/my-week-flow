import { motion } from "framer-motion";
import { format, isToday } from "date-fns";
import { CalEvent } from "@/types/event";
import { EventBubble } from "./EventBubble";

interface Props {
  date: Date;
  events: CalEvent[];
  daysLeft: number;
  isFirst?: boolean;
  pickMode?: boolean;
  onPickSlot?: (date: string, minutes: number) => void;
}

const HOUR_HEIGHT = 56; // px
const START_HOUR = 7;
const END_HOUR = 22;

export function DayColumn({ date, events, isFirst, pickMode, onPickSlot }: Props) {
  const hours = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => START_HOUR + i);
  const dayKey = format(date, "yyyy-MM-dd");
  const today = isToday(date);

  function handleGridClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!pickMode || !onPickSlot) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const totalMinutes = (y / HOUR_HEIGHT) * 60;
    const snapped = Math.round(totalMinutes / 15) * 15 + START_HOUR * 60;
    onPickSlot(dayKey, snapped);
  }

  return (
    <div className="flex w-[200px] shrink-0 flex-col">
      {/* Header */}
      <div className="sticky top-0 z-10 mb-2 flex flex-col items-center bg-canvas/80 pb-2 pt-1 backdrop-blur">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {format(date, "EEE")}
        </span>
        <motion.div
          layout
          className={`mt-1 flex h-10 w-10 items-center justify-center rounded-full font-display text-lg font-bold ${
            today ? "bg-gradient-primary text-primary-foreground shadow-bubble" : "text-foreground"
          }`}
        >
          {format(date, "d")}
        </motion.div>
        {today && (
          <span className="mt-1 text-[10px] font-bold uppercase tracking-wider text-primary">
            Today
          </span>
        )}
      </div>

      {/* Grid */}
      <div className="relative flex-1 rounded-3xl bg-card/60 p-1 ring-1 ring-border/60">
        <div className="relative" style={{ height: (END_HOUR - START_HOUR) * HOUR_HEIGHT }}>
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
          {today && <NowLine />}

          {/* Events */}
          {events
            .filter((e) => e.date === dayKey)
            .map((e) => {
              const top = ((e.start - START_HOUR * 60) / 60) * HOUR_HEIGHT;
              const height = (e.duration / 60) * HOUR_HEIGHT;
              return (
                <div
                  key={e.id}
                  className="absolute left-1 right-1"
                  style={{ top, height }}
                >
                  <EventBubble event={e} compact />
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}

function NowLine() {
  const d = new Date();
  const minutes = d.getHours() * 60 + d.getMinutes();
  const top = ((minutes - START_HOUR * 60) / 60) * HOUR_HEIGHT;
  if (top < 0 || top > (END_HOUR - START_HOUR) * HOUR_HEIGHT) return null;
  return (
    <div className="absolute left-0 right-0 z-10 flex items-center" style={{ top }}>
      <div className="h-2 w-2 -translate-x-1 rounded-full bg-destructive shadow-[0_0_0_4px_hsl(var(--destructive)/0.2)]" />
      <div className="h-px flex-1 bg-destructive" />
    </div>
  );
}
