import { motion } from "framer-motion";
import { format, isToday } from "date-fns";
import { CalEvent, Tag } from "@/types/event";
import { EventBubble } from "./EventBubble";
import { cn } from "@/lib/utils";

interface Props {
  date: Date;
  events: CalEvent[];
  tags: Tag[];
  depth: number; // 0 = today
}

const ZONES = [
  { id: "morning", label: "Morning", emoji: "🌅", from: 6 * 60, to: 12 * 60 },
  { id: "afternoon", label: "Afternoon", emoji: "☀️", from: 12 * 60, to: 17 * 60 },
  { id: "evening", label: "Evening", emoji: "🌙", from: 17 * 60, to: 22 * 60 },
];

function depthOpacity(depth: number) {
  if (depth <= 1) return "opacity-100";
  if (depth === 2) return "opacity-[0.85]";
  return "opacity-60";
}

export function EnergyDayColumn({ date, events, tags, depth }: Props) {
  const dayKey = format(date, "yyyy-MM-dd");
  const today = isToday(date);
  const dayEvents = events.filter((e) => e.date === dayKey).sort((a, b) => a.start - b.start);

  return (
    <div className={cn("flex w-[200px] shrink-0 flex-col", depthOpacity(depth))}>
      {/* Header */}
      <div
        className={cn(
          "sticky top-0 z-10 mb-2 flex flex-col items-center rounded-2xl pb-2 pt-1.5 backdrop-blur",
          today ? "bg-tag-purple-soft/80 ring-1 ring-tag-purple/30" : "bg-canvas/80"
        )}
      >
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {format(date, "EEE")}
        </span>
        <motion.div
          layout
          className={cn(
            "mt-1 flex h-9 w-9 items-center justify-center rounded-full font-display text-base font-bold",
            today ? "bg-gradient-primary text-primary-foreground shadow-bubble" : "text-foreground"
          )}
        >
          {format(date, "d")}
        </motion.div>
      </div>

      <div className="flex flex-1 flex-col gap-2">
        {ZONES.map((z) => {
          const inZone = dayEvents.filter((e) => e.start >= z.from && e.start < z.to);
          return (
            <div
              key={z.id}
              className={cn(
                "flex flex-1 flex-col rounded-2xl border bg-card/60 p-2 ring-1 ring-border/60",
                today ? "border-tag-purple/30" : "border-border/60"
              )}
            >
              <div className="mb-1.5 flex items-center justify-between px-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  {z.emoji} {z.label}
                </span>
                <span className="text-[10px] font-semibold text-muted-foreground/70">
                  {inZone.length || ""}
                </span>
              </div>
              <div className="flex flex-1 flex-col gap-1.5 overflow-y-auto">
                {inZone.length === 0 ? (
                  <div className="flex h-full min-h-[40px] items-center justify-center rounded-xl border border-dashed border-warm-gray/40 bg-warm-gray-soft/40 text-[10px] font-semibold text-warm-gray">
                    open
                  </div>
                ) : (
                  inZone.map((e) => (
                    <div key={e.id} className="h-12">
                      <EventBubble event={e} tags={tags} compact />
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
