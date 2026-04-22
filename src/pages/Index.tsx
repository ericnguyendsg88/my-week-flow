import { useCallback, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { addDays, format, isSunday, nextSunday, startOfDay } from "date-fns";
import { CalendarDays } from "lucide-react";
import { CalEvent } from "@/types/event";
import { TaskComposer } from "@/components/TaskComposer";
import { DayColumn } from "@/components/DayColumn";

const Index = () => {
  const today = startOfDay(new Date());
  const sunday = isSunday(today) ? today : nextSunday(today);
  const weekDates = useMemo(() => {
    const days: Date[] = [];
    let d = today;
    while (d <= sunday) {
      days.push(d);
      d = addDays(d, 1);
    }
    return days;
  }, [today.toISOString()]);

  const daysLeft = weekDates.length;

  const [events, setEvents] = useState<CalEvent[]>(() => {
    const t = format(today, "yyyy-MM-dd");
    return [
      { id: "s1", title: "Morning standup", category: "work", date: t, start: 9 * 60, duration: 30 },
      { id: "s2", title: "Deep work · roadmap", category: "focus", date: t, start: 10 * 60, duration: 90 },
      { id: "s3", title: "Lunch with Maya", category: "social", date: t, start: 13 * 60, duration: 60, where: "Tartine" },
    ];
  });

  const [pickMode, setPickMode] = useState(false);
  const [pickedSlot, setPickedSlot] = useState<{ date: string; start: number } | null>(null);

  const handleCommit = useCallback((e: CalEvent) => {
    setEvents((prev) => [...prev, e]);
  }, []);

  const handlePickSlot = useCallback((date: string, start: number) => {
    setPickedSlot({ date, start });
  }, []);

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-canvas">
      {/* Header */}
      <header className="flex items-center justify-between px-6 pt-5 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-gradient-primary shadow-bubble">
            <CalendarDays className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-display text-xl font-extrabold tracking-tight">MyWeek</h1>
            <p className="-mt-0.5 text-[11px] font-medium text-muted-foreground">
              Think it. Type it. It lands on your calendar.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <CountdownPill daysLeft={daysLeft} />
        </div>
      </header>

      {/* Main split */}
      <div className="flex flex-1 gap-4 overflow-hidden px-6 pb-6">
        {/* LEFT — Composer occupies the full column (40%) */}
        <aside className="flex w-[40%] min-w-[360px] max-w-[520px] flex-col overflow-hidden">
          <TaskComposer
            weekDates={weekDates}
            events={events}
            onCommit={handleCommit}
            pickedSlot={pickedSlot}
            onSlotPickModeChange={setPickMode}
            onConsumePickedSlot={() => setPickedSlot(null)}
          />
        </aside>

        {/* RIGHT — Week grid (60%) */}
        <section className="flex flex-1 flex-col overflow-hidden rounded-bubble bg-card/40 p-4 ring-1 ring-border/60">
          <div className="mb-3 flex items-end justify-between px-2">
            <div>
              <h2 className="font-display text-2xl font-extrabold tracking-tight">
                {format(weekDates[0], "MMMM yyyy")}
              </h2>
              <p className="text-xs font-medium text-muted-foreground">
                {format(weekDates[0], "EEE d")} → {format(weekDates[weekDates.length - 1], "EEE d")} · ends Sunday
                {pickMode && (
                  <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                    Click any slot to set the time
                  </span>
                )}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <ViewChip label="Week" active />
              <ViewChip label="Today" />
              <ViewChip label="Kanban" />
            </div>
          </div>

          <div className="relative flex-1 overflow-auto pl-9 pr-2">
            <div className="flex h-full gap-3">
              {weekDates.map((d, i) => (
                <DayColumn
                  key={d.toISOString()}
                  date={d}
                  events={events}
                  daysLeft={daysLeft}
                  isFirst={i === 0}
                  pickMode={pickMode}
                  onPickSlot={handlePickSlot}
                />
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

function CountdownPill({ daysLeft }: { daysLeft: number }) {
  return (
    <motion.div
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className="flex items-center gap-2 rounded-full bg-card px-3.5 py-1.5 shadow-bubble ring-1 ring-border"
    >
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
      </span>
      <span className="text-xs font-bold">
        {daysLeft} {daysLeft === 1 ? "day" : "days"} left
      </span>
      <span className="text-[11px] font-medium text-muted-foreground">till Sunday</span>
    </motion.div>
  );
}

function ViewChip({ label, active }: { label: string; active?: boolean }) {
  return (
    <button
      className={`rounded-full px-3 py-1 text-xs font-bold transition-all ${
        active
          ? "bg-foreground text-background shadow-bubble"
          : "bg-transparent text-muted-foreground hover:bg-muted"
      }`}
    >
      {label}
    </button>
  );
}

function Tips() {
  return (
    <div className="mt-4 space-y-1.5 px-1">
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
        Try saying
      </p>
      {[
        "Coffee with Alex Thursday",
        "Deep work on Q2 plan 90m",
        "Gym tomorrow morning",
      ].map((s) => (
        <div
          key={s}
          className="rounded-full bg-muted/60 px-3 py-1 text-[11px] font-medium text-muted-foreground"
        >
          “{s}”
        </div>
      ))}
    </div>
  );
}

export default Index;
