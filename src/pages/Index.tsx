import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  addDays,
  addWeeks,
  differenceInDays,
  endOfWeek,
  format,
  isToday,
  startOfDay,
  startOfWeek,
  subWeeks,
} from "date-fns";
import { Undo2, Redo2 } from "lucide-react";
import { CalEvent, Tag } from "@/types/event";
import { DEFAULT_TAGS } from "@/lib/tags";
import { TaskComposer } from "@/components/TaskComposer";
import { DayColumn } from "@/components/DayColumn";
import { Backpack } from "@/components/Backpack";
import { nowMinutes, minutesToLabel } from "@/lib/event-utils";
import { useUnplacedCount } from "@/lib/capture-store";

// ── Undo/Redo history reducer ──────────────────────────────────────
type HistoryState = {
  past: CalEvent[][];
  present: CalEvent[];
  future: CalEvent[][];
};

type HistoryAction =
  | { type: "PUSH"; events: CalEvent[] }
  | { type: "UNDO" }
  | { type: "REDO" };

function historyReducer(state: HistoryState, action: HistoryAction): HistoryState {
  switch (action.type) {
    case "PUSH":
      return { past: [...state.past, state.present], present: action.events, future: [] };
    case "UNDO":
      if (state.past.length === 0) return state;
      return {
        past: state.past.slice(0, -1),
        present: state.past[state.past.length - 1],
        future: [state.present, ...state.future],
      };
    case "REDO":
      if (state.future.length === 0) return state;
      return {
        past: [...state.past, state.present],
        present: state.future[0],
        future: state.future.slice(1),
      };
  }
}

const Index = () => {
  const today = startOfDay(new Date());
  const [currentWeekStart, setCurrentWeekStart] = useState(() => today);

  const weekDates = useMemo(() => {
    const weekEnd = endOfWeek(currentWeekStart, { weekStartsOn: 1 });
    const numDays = differenceInDays(weekEnd, currentWeekStart) + 1;
    const days: Date[] = [];
    for (let i = 0; i < numDays; i++) days.push(addDays(currentWeekStart, i));
    return days;
  }, [currentWeekStart]);

  const todayKey = format(today, "yyyy-MM-dd");

  // ── Resizable panels ──
  const containerRef = useRef<HTMLDivElement>(null);
  const [leftPanelWidth, setLeftPanelWidth] = useState(380);
  const isDragging = useRef(false);
  const MIN_LEFT = 260;
  const MIN_COL_WIDTH = 120;

  const minRightWidth = useMemo(() =>
    40 + weekDates.length * MIN_COL_WIDTH + (weekDates.length - 1) * 8 + 48,
    [weekDates.length]
  );

  const handleResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    const startX = e.clientX;
    const startWidth = leftPanelWidth;
    const onMouseMove = (ev: MouseEvent) => {
      if (!isDragging.current) return;
      const containerWidth = containerRef.current?.offsetWidth ?? 0;
      const maxLeft = containerWidth - 32 - 16 - minRightWidth;
      setLeftPanelWidth(Math.max(MIN_LEFT, Math.min(maxLeft, startWidth + (ev.clientX - startX))));
    };
    const onMouseUp = () => {
      isDragging.current = false;
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }, [leftPanelWidth, minRightWidth]);

  const [tags] = useState<Tag[]>(DEFAULT_TAGS);

  // ── Events with undo/redo history ──
  const [histState, dispatch] = useReducer(historyReducer, undefined, () => {
    const saved = localStorage.getItem("horizon_events");
    let initial: CalEvent[] = [];
    if (saved) { try { initial = JSON.parse(saved); } catch { /* ignore */ } }
    return { past: [], present: initial, future: [] };
  });

  const events = histState.present;
  const canUndo = histState.past.length > 0;
  const canRedo = histState.future.length > 0;

  useEffect(() => {
    localStorage.setItem("horizon_events", JSON.stringify(events));
  }, [events]);

  // ── Toast ──
  const [toast, setToast] = useState<{ message: string } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>();
  function showToast(message: string) {
    setToast({ message });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  }

  const undo = useCallback(() => { dispatch({ type: "UNDO" }); showToast("Undone"); }, []);
  const redo = useCallback(() => { dispatch({ type: "REDO" }); showToast("Redone"); }, []);

  // Keyboard shortcuts: Cmd+Z / Cmd+Shift+Z
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      if (e.key === "z" && !e.shiftKey) { e.preventDefault(); dispatch({ type: "UNDO" }); showToast("Undone"); }
      if ((e.key === "z" && e.shiftKey) || e.key === "y") { e.preventDefault(); dispatch({ type: "REDO" }); showToast("Redone"); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const [viewMode, setViewMode] = useState<"week" | "today">("week");
  const [promptEvent, setPromptEvent] = useState<CalEvent | null>(null);

  useEffect(() => {
    const check = () => {
      const now = nowMinutes();
      const todayStr = format(new Date(), "yyyy-MM-dd");
      const uncompleted = events.find(
        (e) => e.date === todayStr && now >= e.start + e.duration && e.completed === undefined
      );
      if (uncompleted && !promptEvent) setPromptEvent(uncompleted);
    };
    check();
    const id = setInterval(check, 60000);
    return () => clearInterval(id);
  }, [events, promptEvent]);

  const handleMarkCompletion = useCallback((eventId: string, completed: boolean | null) => {
    dispatch({ type: "PUSH", events: events.map((e) => (e.id === eventId ? { ...e, completed: completed ?? undefined } : e)) });
    setPromptEvent(null);
  }, [events]);

  const handleDelete = useCallback((eventId: string) => {
    const deleted = events.find((e) => e.id === eventId);
    dispatch({ type: "PUSH", events: events.filter((e) => e.id !== eventId) });
    showToast(`"${deleted?.title ?? "Event"}" deleted — Cmd+Z to undo`);
  }, [events]);

  const handleCommit = useCallback((e: CalEvent) => {
    dispatch({ type: "PUSH", events: [...events, e] });
  }, [events]);

  const handleResize = useCallback((eventId: string, newDuration: number) => {
    dispatch({ type: "PUSH", events: events.map((e) => e.id === eventId ? { ...e, duration: newDuration } : e) });
  }, [events]);

  const handleUpdate = useCallback((eventId: string, patch: Partial<CalEvent>) => {
    dispatch({ type: "PUSH", events: events.map((e) => e.id === eventId ? { ...e, ...patch } : e) });
  }, [events]);

  const handleMoveToDay = useCallback((eventId: string, newDate: string) => {
    const ev = events.find((e) => e.id === eventId);
    if (!ev || ev.date === newDate) return;
    dispatch({ type: "PUSH", events: events.map((e) => e.id === eventId ? { ...e, date: newDate } : e) });
    showToast(`Moved to ${newDate}`);
  }, [events]);

  const handleAttachToEvent = useCallback((eventId: string, item: import("@/types/event").CaptureItem) => {
    dispatch({
      type: "PUSH",
      events: events.map((e) =>
        e.id === eventId
          ? { ...e, attachedItems: [...(e.attachedItems ?? []), { id: item.id, kind: item.kind, title: item.title, url: item.url }] }
          : e
      ),
    });
    showToast(`Attached to event`);
  }, [events]);

  const [composerPrefill, setComposerPrefill] = useState<string | undefined>();
  const handleCreateEventFromItem = useCallback((item: import("@/types/event").CaptureItem) => {
    setComposerPrefill(item.title + "__" + Date.now()); // append timestamp to force re-trigger
  }, []);

  const unplaced = useUnplacedCount(todayKey);

  // ── Left panel date navigation ──
  const [selectedDate, setSelectedDate] = useState<Date>(today);
  const selectedDayKey = format(selectedDate, "yyyy-MM-dd");
  const isViewingToday = selectedDayKey === todayKey;

  const prevDay = useCallback(() => setSelectedDate((d) => addDays(d, -1)), []);
  const nextDay = useCallback(() => setSelectedDate((d) => addDays(d, 1)), []);

  const displayDates = viewMode === "today"
    ? weekDates.filter((d) => isToday(d))
    : weekDates;

  const todayEvents = events.filter((e) => e.date === todayKey);
  const todayEventCount = todayEvents.length;
  const todayLabel = format(today, "EEEE, MMMM d");

  const timeOfDay = (() => {
    const h = new Date().getHours();
    return h < 12 ? "morning" : h < 17 ? "afternoon" : "evening";
  })();

  return (
    <div
      ref={containerRef}
      style={{ background: "#F4F4F6", padding: "16px" }}
      className="flex h-screen w-full items-stretch overflow-hidden"
    >
      {/* ── LEFT PANEL ── */}
      <div
        className="flex shrink-0 flex-col overflow-hidden"
        style={{ width: leftPanelWidth, background: "#F4F1ED", borderRadius: 20, boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}
      >
        {/* Header */}
        <div style={{ padding: "24px 24px 16px" }}>
          <h1 style={{ fontSize: 24, fontWeight: 600, color: "hsl(var(--foreground))" }}>Horizon</h1>
        </div>

        {/* Date Navigator */}
        <div style={{ padding: "0 24px", marginBottom: 16 }}>
          <div style={{ background: "#EDF6EB", borderRadius: 14, padding: "10px 8px", display: "flex", alignItems: "center", gap: 4 }}>
            <button
              onClick={prevDay}
              style={{ width: 30, height: 30, borderRadius: "50%", background: "rgba(255,255,255,0.55)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#3A8733", fontSize: 18, flexShrink: 0, lineHeight: 1 }}
            >‹</button>

            <div style={{ flex: 1, textAlign: "center" }}>
              {isViewingToday ? (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                  <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#B6DFB0", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#3A8733" }} />
                  </span>
                  <span style={{ fontSize: 14, fontWeight: 600, color: "#1D5C17" }}>Now · {format(new Date(), "h:mma").toLowerCase()}</span>
                  <div style={{ width: 1, height: 14, background: "#B6DFB0", opacity: 0.6 }} />
                  <span style={{ fontSize: 12, fontWeight: 500, color: "#3A8733" }}>{timeOfDay}</span>
                </div>
              ) : (
                <div>
                  <p style={{ fontSize: 14, fontWeight: 700, color: "#1D5C17", lineHeight: 1.2 }}>{format(selectedDate, "EEEE")}</p>
                  <p style={{ fontSize: 11, color: "#3A8733", marginTop: 2, fontWeight: 500 }}>{format(selectedDate, "MMM d, yyyy")}</p>
                </div>
              )}
            </div>

            <button
              onClick={nextDay}
              style={{ width: 30, height: 30, borderRadius: "50%", background: "rgba(255,255,255,0.55)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#3A8733", fontSize: 18, flexShrink: 0, lineHeight: 1 }}
            >›</button>
          </div>

          {!isViewingToday && (
            <button
              onClick={() => setSelectedDate(today)}
              style={{ display: "block", margin: "6px auto 0", fontSize: 11, color: "#9B91E0", background: "none", border: "none", cursor: "pointer", fontWeight: 500 }}
            >
              ↩ back to today
            </button>
          )}
        </div>

        {/* Input */}
        <div style={{ padding: "0 24px" }}>
          <TaskComposer weekDates={weekDates} events={events} tags={tags} onCommit={handleCommit} prefill={composerPrefill} />
        </div>

        {/* Backpack */}
        <div className="flex-1 overflow-hidden" style={{ padding: "0 24px", marginTop: 24 }}>
          <Backpack
            selectedDayKey={selectedDayKey}
            dayEvents={events.filter((e) => e.date === selectedDayKey)}
            onAttachToEvent={handleAttachToEvent}
            onCreateEventFromItem={handleCreateEventFromItem}
          />
        </div>

        {/* Footer */}
        <div style={{ padding: "16px 24px" }}>
          <button style={{ borderRadius: 20, background: "hsl(var(--muted))", border: "none", padding: "7px 16px", fontSize: 12, fontWeight: 500, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, color: "hsl(var(--muted-foreground))" }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <rect x="2" y="10" width="2" height="2" rx="0.5" fill="currentColor"/>
              <rect x="5" y="7" width="2" height="5" rx="0.5" fill="currentColor"/>
              <rect x="8" y="4" width="2" height="8" rx="0.5" fill="currentColor"/>
              <rect x="11" y="2" width="2" height="10" rx="0.5" fill="currentColor"/>
            </svg>
            Continue
          </button>
        </div>
      </div>

      {/* ── RESIZE HANDLE ── */}
      <div onMouseDown={handleResizeMouseDown} style={{ width: 16, flexShrink: 0, cursor: "col-resize", display: "flex", alignItems: "center", justifyContent: "center", userSelect: "none" }}>
        <div
          style={{ width: 3, height: 40, borderRadius: 2, background: "rgba(0,0,0,0.10)", transition: "background 0.15s" }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(0,0,0,0.22)")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(0,0,0,0.10)")}
        />
      </div>

      {/* ── RIGHT PANEL ── */}
      <div
        className="flex flex-1 flex-col overflow-hidden"
        style={{ background: "#F4F1ED", borderRadius: 20, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", minWidth: minRightWidth }}
      >
        {/* Header */}
        <div style={{ padding: "20px 24px 16px" }} className="flex shrink-0 items-start justify-between">
          <div className="flex items-center gap-4">
            {viewMode === "today" ? (
              <div>
                <h2 style={{ fontSize: 28, fontWeight: 700, lineHeight: "1.1" }}>Today</h2>
                <p style={{ fontSize: 13, color: "hsl(var(--muted-foreground))", marginTop: 3 }}>
                  {todayLabel} · {todayEventCount} event{todayEventCount !== 1 ? "s" : ""}
                </p>
              </div>
            ) : (
              <div>
                <h2 style={{ fontSize: 28, fontWeight: 700, lineHeight: "1.1" }}>{format(weekDates[0], "MMMM yyyy")}</h2>
                <p style={{ fontSize: 13, color: "hsl(var(--muted-foreground))", marginTop: 3 }}>
                  {format(weekDates[0], "EEE d")} → {format(weekDates[weekDates.length - 1], "EEE d")}
                </p>
              </div>
            )}

            {viewMode === "week" && (
              <div className="flex items-center gap-1">
                <button onClick={() => setCurrentWeekStart((prev) => startOfWeek(subWeeks(prev, 1), { weekStartsOn: 1 }))}
                  style={{ background: "#fff", border: "1px solid #EAEAEA", borderRadius: "50%", width: 32, height: 32, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#3C3489" }}>←</button>
                <button onClick={() => setCurrentWeekStart(today)}
                  style={{ background: "#fff", border: "1px solid #EAEAEA", borderRadius: 16, padding: "0 12px", height: 32, cursor: "pointer", fontSize: 12, fontWeight: 500, color: "#3C3489" }}>Today</button>
                <button onClick={() => setCurrentWeekStart((prev) => startOfWeek(addWeeks(prev, 1), { weekStartsOn: 1 }))}
                  style={{ background: "#fff", border: "1px solid #EAEAEA", borderRadius: "50%", width: 32, height: 32, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#3C3489" }}>→</button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {unplaced > 0 && (
              <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                style={{ display: "flex", alignItems: "center", gap: 6, background: "#E8EDFD", borderRadius: 20, padding: "5px 12px", fontSize: 12, fontWeight: 500, color: "#3D68CC" }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#3D68CC", display: "inline-block" }} />
                {unplaced} unplaced
              </motion.div>
            )}

            {/* Undo / Redo buttons */}
            <div style={{ display: "flex", gap: 4 }}>
              <button
                onClick={undo}
                disabled={!canUndo}
                title="Undo (Cmd+Z)"
                style={{
                  width: 32, height: 32, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                  background: canUndo ? "#fff" : "transparent",
                  border: canUndo ? "1px solid #EAEAEA" : "1px solid transparent",
                  color: canUndo ? "#3C3489" : "#C8C5BE",
                  cursor: canUndo ? "pointer" : "default",
                  transition: "all 0.15s",
                }}
              >
                <Undo2 size={14} strokeWidth={2} />
              </button>
              <button
                onClick={redo}
                disabled={!canRedo}
                title="Redo (Cmd+Shift+Z)"
                style={{
                  width: 32, height: 32, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                  background: canRedo ? "#fff" : "transparent",
                  border: canRedo ? "1px solid #EAEAEA" : "1px solid transparent",
                  color: canRedo ? "#3C3489" : "#C8C5BE",
                  cursor: canRedo ? "pointer" : "default",
                  transition: "all 0.15s",
                }}
              >
                <Redo2 size={14} strokeWidth={2} />
              </button>
            </div>

            {/* View toggle */}
            <div className="flex items-center" style={{ background: "hsl(var(--muted))", borderRadius: 20, padding: 3, gap: 2 }}>
              {(["week", "today"] as const).map((v) => (
                <button key={v} onClick={() => setViewMode(v)}
                  style={{
                    borderRadius: 20, padding: "5px 14px", fontSize: 13,
                    fontWeight: viewMode === v ? 500 : 400,
                    background: viewMode === v ? "#fff" : "transparent",
                    color: viewMode === v ? "hsl(var(--foreground))" : "hsl(var(--muted-foreground))",
                    border: "none", cursor: "pointer",
                    boxShadow: viewMode === v ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                    transition: "all 0.15s", textTransform: "capitalize",
                  }}>
                  {v === "today" ? "Focus" : "Week"}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Grid */}
        <div className="flex min-h-0 flex-1 overflow-hidden" style={{ paddingLeft: 24, paddingRight: 24, paddingBottom: 16 }}>
          <WeekGrid
            weekDates={displayDates}
            events={events}
            tags={tags}
            onMark={handleMarkCompletion}
            onDelete={handleDelete}
            onResize={handleResize}
            onUpdate={handleUpdate}
            onCreate={handleCommit}
            onMoveToDay={handleMoveToDay}
            focusMode={viewMode === "today"}
            selectedDayKey={selectedDayKey}
            onDayClick={setSelectedDate}
          />
        </div>
      </div>

      {/* Completion Prompt */}
      <AnimatePresence>
        {promptEvent && (
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.93 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 380, damping: 28 }}
            style={{ position: "fixed", bottom: 36, right: 36, background: "#FAFAF8", borderRadius: 20, padding: "28px 28px 24px", boxShadow: "0 20px 60px -12px rgba(0,0,0,0.18), 0 4px 16px -4px rgba(0,0,0,0.08)", zIndex: 200, width: 340 }}
          >
            <p style={{ fontSize: 20, fontWeight: 700, color: "#111", marginBottom: 6, lineHeight: 1.2 }}>Did this happen?</p>
            <p style={{ fontSize: 15, color: "#888", marginBottom: 24, fontWeight: 400 }}>
              {promptEvent.title} · ended {minutesToLabel(promptEvent.start + promptEvent.duration)}
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => handleMarkCompletion(promptEvent.id, true)}
                style={{ flex: 1, background: "#DFF0CC", color: "#2E5513", border: "none", borderRadius: 24, padding: "11px 0", fontSize: 15, fontWeight: 600, cursor: "pointer" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#C8E6A8")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "#DFF0CC")}>
                Yes, done
              </button>
              <button onClick={() => handleMarkCompletion(promptEvent.id, false)}
                style={{ flex: 1, background: "#F0EDEA", color: "#555", border: "none", borderRadius: 24, padding: "11px 0", fontSize: 15, fontWeight: 500, cursor: "pointer" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#E4E0DC")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "#F0EDEA")}>
                Didn't happen
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toast notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 400, damping: 28 }}
            style={{
              position: "fixed", bottom: 28, left: "50%", transform: "translateX(-50%)",
              background: "#1A1A1A", color: "#fff",
              borderRadius: 24, padding: "10px 20px",
              fontSize: 13, fontWeight: 500,
              boxShadow: "0 8px 32px -4px rgba(0,0,0,0.28)",
              zIndex: 300, display: "flex", alignItems: "center", gap: 12,
              whiteSpace: "nowrap",
            }}
          >
            <span>{toast.message}</span>
            {canUndo && (
              <button
                onClick={() => { undo(); setToast(null); }}
                style={{
                  background: "rgba(255,255,255,0.15)", border: "none", borderRadius: 12,
                  color: "#fff", padding: "3px 10px", fontSize: 12, fontWeight: 600,
                  cursor: "pointer", transition: "background 0.1s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.25)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.15)")}
              >
                Undo
              </button>
            )}
            <button
              onClick={() => setToast(null)}
              style={{ background: "none", border: "none", color: "rgba(255,255,255,0.5)", cursor: "pointer", padding: 0, fontSize: 16, lineHeight: 1 }}
            >
              ×
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

/* ── Week Grid ── */
function WeekGrid({ weekDates, events, tags, onMark, onDelete, onResize, onUpdate, onCreate, onMoveToDay, focusMode, selectedDayKey, onDayClick }: {
  weekDates: Date[];
  events: CalEvent[];
  tags: Tag[];
  onMark: (eventId: string, completed: boolean | null) => void;
  onDelete: (eventId: string) => void;
  onResize: (eventId: string, newDuration: number) => void;
  onUpdate: (eventId: string, patch: Partial<CalEvent>) => void;
  onCreate: (event: CalEvent) => void;
  onMoveToDay: (eventId: string, newDate: string) => void;
  focusMode?: boolean;
  selectedDayKey?: string;
  onDayClick?: (date: Date) => void;
}) {
  const START_HOUR = 7;
  const END_HOUR = 22;

  return (
    <div className="flex w-full min-h-0 flex-1 overflow-auto scrollbar-hidden">
      <TimeGutter startHour={START_HOUR} endHour={END_HOUR} />
      <div className="flex min-w-0 flex-1" style={{ gap: 8 }}>
        {weekDates.map((d) => {
          const dateKey = format(d, "yyyy-MM-dd");
          return (
            <DayColumn
              key={d.toISOString()}
              date={d}
              events={events.filter((e) => e.date === dateKey)}
              tags={tags}
              onMark={onMark}
              onDelete={onDelete}
              onResize={onResize}
              onUpdate={onUpdate}
              onCreate={onCreate}
              onMoveToDay={onMoveToDay}
              focusMode={focusMode}
              isSelected={dateKey === selectedDayKey}
              onDayClick={onDayClick}
            />
          );
        })}
      </div>
    </div>
  );
}

/* ── Time Gutter ── */
const GUTTER_ANCHORS: Record<number, { label: string; sub?: string; accent?: boolean }> = {
  7:  { label: "7 AM",  sub: "morning" },
  9:  { label: "9 AM" },
  12: { label: "noon",  sub: "midday",  accent: true },
  15: { label: "3 PM" },
  17: { label: "5 PM",  sub: "evening" },
  19: { label: "7 PM" },
  21: { label: "9 PM" },
  22: { label: "10 PM" },
};

function TimeGutter({ startHour, endHour }: { startHour: number; endHour: number }) {
  const HOUR_HEIGHT = 60;
  const hours = Array.from({ length: endHour - startHour + 1 }, (_, i) => startHour + i);
  return (
    <div className="shrink-0" style={{ width: 52, paddingTop: 64 }}>
      <div style={{ position: "relative", height: (endHour - startHour) * HOUR_HEIGHT }}>
        {hours.map((h, i) => {
          const anchor = GUTTER_ANCHORS[h];
          if (!anchor) return null;
          return (
            <div
              key={h}
              style={{
                position: "absolute",
                top: i * HOUR_HEIGHT - (anchor.sub ? 10 : 7),
                right: 6,
                textAlign: "right",
                lineHeight: 1,
              }}
            >
              <div style={{
                fontSize: anchor.accent ? 11 : 10,
                fontWeight: anchor.accent ? 700 : 600,
                color: anchor.accent ? "#3C3489" : "hsl(var(--muted-foreground))",
                whiteSpace: "nowrap",
                letterSpacing: anchor.accent ? "0.01em" : "0",
              }}>
                {anchor.label}
              </div>
              {anchor.sub && (
                <div style={{
                  fontSize: 9,
                  fontWeight: 500,
                  color: anchor.accent ? "#9B91E0" : "#B8B4AE",
                  marginTop: 2,
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                }}>
                  {anchor.sub}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default Index;
