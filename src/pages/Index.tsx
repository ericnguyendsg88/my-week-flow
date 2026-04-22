import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { addDays, format, isSunday, nextSunday, startOfDay } from "date-fns";
import { CalendarDays, Inbox } from "lucide-react";
import { CalEvent } from "@/types/event";
import { TaskComposer } from "@/components/TaskComposer";
import { DayColumn } from "@/components/DayColumn";
import { EventBubble } from "@/components/EventBubble";

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

  const [recent, setRecent] = useState<CalEvent[]>([]);

  function handleCommit(e: CalEvent) {
    setRecent((r) => [e, ...r].slice(0, 5));
    // brief delay so user sees the bubble in the inbox before it flies into the grid
    setTimeout(() => {
      setEvents((prev) => [...prev, e]);
      setRecent((r) => r.filter((x) => x.id !== e.id));
    }, 450);
  }

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
        {/* LEFT — Composer + Inbox (40%) */}
        <aside className="flex w-[40%] min-w-[340px] max-w-[480px] flex-col gap-3 overflow-hidden">
          <TaskComposer weekDates={weekDates} events={events} onCommit={handleCommit} />

          <div className="flex items-center gap-2 px-1 pt-1">
            <Inbox className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              In flight
            </span>
          </div>

          <div className="flex-1 overflow-y-auto rounded-bubble bg-card/60 p-3 ring-1 ring-border/60 scrollbar-hidden">
            <AnimatePresence>
              {recent.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex h-full flex-col items-center justify-center gap-2 py-12 text-center"
                >
                  <div className="text-3xl">💭</div>
                  <p className="max-w-[220px] text-xs font-medium text-muted-foreground">
                    Free your mind. Drop a thought above and watch it find a home on your week.
                  </p>
                </motion.div>
              ) : (
                <div className="flex flex-col gap-2">
                  {recent.map((e) => (
                    <div key={e.id} className="h-12">
                      <EventBubble event={e} />
                    </div>
                  ))}
                </div>
              )}
            </AnimatePresence>
            <Tips />
          </div>
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
