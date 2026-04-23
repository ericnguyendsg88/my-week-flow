import { useCallback, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { addDays, format, isSunday, nextSunday, startOfDay, isToday } from "date-fns";
import { Sunrise } from "lucide-react";
import { CalEvent, Tag } from "@/types/event";
import { TaskComposer } from "@/components/TaskComposer";
import { DayColumn } from "@/components/DayColumn";
import { EnergyDayColumn } from "@/components/EnergyDayColumn";
import { Backpack } from "@/components/Backpack";
import { DEFAULT_TAGS, tagClasses } from "@/lib/tags";
import { useUnplacedCount } from "@/lib/capture-store";
import { cn } from "@/lib/utils";

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [today.toISOString()]);

  const daysLeft = weekDates.length;
  const todayKey = format(today, "yyyy-MM-dd");

  const [tags, setTags] = useState<Tag[]>(DEFAULT_TAGS);

  const [events, setEvents] = useState<CalEvent[]>(() => {
    const t = format(today, "yyyy-MM-dd");
    return [
      { id: "s1", title: "Morning standup", category: "work", tagId: "work", date: t, start: 9 * 60, duration: 30 },
      { id: "s2", title: "Deep work · roadmap", category: "focus", tagId: "deepwork", date: t, start: 10 * 60, duration: 90 },
      { id: "s3", title: "Lunch with Maya", category: "social", tagId: "social", date: t, start: 13 * 60, duration: 60, where: "Tartine" },
    ];
  });

  const [pickMode, setPickMode] = useState(false);
  const [pickedSlot, setPickedSlot] = useState<{ date: string; start: number } | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "energy">("grid");
  const [selectedDayKey, setSelectedDayKey] = useState<string>(todayKey);
  const [prefillTitle, setPrefillTitle] = useState<string | null>(null);

  const handleCommit = useCallback((e: CalEvent) => {
    setEvents((prev) => [...prev, e]);
  }, []);

  const handlePickSlot = useCallback((date: string, start: number) => {
    setPickedSlot({ date, start });
  }, []);

  const handleCreateTag = useCallback((t: Omit<Tag, "id">): Tag => {
    const id = crypto.randomUUID();
    const created: Tag = { id, ...t };
    setTags((prev) => [...prev, created]);
    return created;
  }, []);

  const unplaced = useUnplacedCount(todayKey);
  const selectedDate = weekDates.find((d) => format(d, "yyyy-MM-dd") === selectedDayKey) ?? today;
  const selectedLabel = isToday(selectedDate) ? "today" : format(selectedDate, "EEE MMM d").toLowerCase();

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-canvas">
      {/* Header */}
      <header className="flex items-center justify-between px-6 pb-3 pt-5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-gradient-sunrise shadow-bubble">
            <Sunrise className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-display text-xl font-extrabold tracking-tight">Horizon</h1>
            <p className="-mt-0.5 text-[11px] font-medium text-muted-foreground">
              Think it. It lands on your week.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {unplaced > 0 && (
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="flex items-center gap-1.5 rounded-full bg-tag-purple-soft px-3 py-1.5 text-[11px] font-bold text-tag-purple ring-1 ring-tag-purple/30"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-tag-purple" />
              {unplaced} unplaced
            </motion.div>
          )}
          <CountdownPill daysLeft={daysLeft} />
        </div>
      </header>

      {/* Main split */}
      <div className="flex flex-1 gap-4 overflow-hidden px-6 pb-6">
        {/* LEFT — Composer + Backpack (40%) */}
        <aside className="flex w-[40%] min-w-[360px] max-w-[520px] flex-col gap-3 overflow-hidden">
          <div className="min-h-0 flex-1">
            <TaskComposer
              weekDates={weekDates}
              events={events}
              tags={tags}
              onCommit={handleCommit}
              onCreateTag={handleCreateTag}
              pickedSlot={pickedSlot}
              onSlotPickModeChange={setPickMode}
              onConsumePickedSlot={() => setPickedSlot(null)}
              prefillTitle={prefillTitle}
              onConsumePrefill={() => setPrefillTitle(null)}
            />
          </div>
          <div className="h-[42%] min-h-[200px]">
            <Backpack
              selectedDayKey={selectedDayKey}
              selectedLabel={selectedLabel}
              tags={tags}
              onPlace={(item) => setPrefillTitle(item.title)}
            />
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
                {pickMode && (
                  <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                    Click any slot to set the time
                  </span>
                )}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <ViewChip
                label="Time grid"
                active={viewMode === "grid"}
                onClick={() => setViewMode("grid")}
              />
              <ViewChip
                label="Energy blocks"
                active={viewMode === "energy"}
                onClick={() => setViewMode("energy")}
              />
            </div>
          </div>

          <div className="relative flex-1 overflow-auto pl-12 pr-2">
            <div className="flex h-full gap-3">
              {weekDates.map((d, i) =>
                viewMode === "grid" ? (
                  <DayColumn
                    key={d.toISOString()}
                    date={d}
                    events={events}
                    tags={tags}
                    depth={i}
                    isFirst={i === 0}
                    pickMode={pickMode}
                    onPickSlot={handlePickSlot}
                    onFocusDay={setSelectedDayKey}
                    selected={selectedDayKey === format(d, "yyyy-MM-dd")}
                  />
                ) : (
                  <EnergyDayColumn
                    key={d.toISOString()}
                    date={d}
                    events={events}
                    tags={tags}
                    depth={i}
                  />
                )
              )}
            </div>
          </div>

          {/* Tag legend */}
          <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-border/40 pt-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Tags:
            </span>
            {tags.map((t) => {
              const cls = tagClasses(t);
              return (
                <span
                  key={t.id}
                  className={cn(
                    "flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold",
                    cls.bg,
                    cls.text
                  )}
                >
                  <span className={cn("h-1.5 w-1.5 rounded-full", cls.solid)} />
                  #{t.name}
                </span>
              );
            })}
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

function ViewChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-full px-3 py-1 text-xs font-bold transition-all",
        active
          ? "bg-foreground text-background shadow-bubble"
          : "bg-transparent text-muted-foreground hover:bg-muted"
      )}
    >
      {label}
    </button>
  );
}

export default Index;
