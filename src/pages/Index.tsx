import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  addDays,
  addWeeks,
  differenceInDays,
  eachWeekOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isToday,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subWeeks,
} from "date-fns";
import { Undo2, Redo2, Calendar, CalendarDays, EyeOff, Sparkles, CalendarRange, Settings, LayoutGrid, CheckSquare, Clock, Sun, User, Plus } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { CalEvent, Tag } from "@/types/event";
import { DEFAULT_TAGS } from "@/lib/tags";
import { SettingsModal, loadCustomTags, saveCustomTags, loadSidebarShortcut, saveSidebarShortcut } from "@/components/SettingsModal";
import { TaskComposer } from "@/components/TaskComposer";
import { DayColumn } from "@/components/DayColumn";
import { Backpack } from "@/components/Backpack";

import { MonthView } from "@/components/MonthView";
import { AnalogClock } from "@/components/AnalogClock";
import { nowMinutes, minutesToLabel } from "@/lib/event-utils";
import { useCaptures, useUnplacedCount, setCaptureSyncUser, syncCapturesFromRemote, applyRemoteCapture, applyRemoteCaptureDelete } from "@/lib/capture-store";
import { pullEvents, pushEvents, deleteEvent as sbDeleteEvent, useSyncStatus, subscribeEvents, subscribeCaptures } from "@/lib/sync";
import { AuthGate } from "@/components/AuthGate";
import { supabase, supabaseConfigured } from "@/lib/supabase";

// ── Undo/Redo history reducer ──────────────────────────────────────
type HistoryState = {
  past: CalEvent[][];
  present: CalEvent[];
  future: CalEvent[][];
};

type HistoryAction =
  | { type: "PUSH"; events: CalEvent[] }
  | { type: "UNDO" }
  | { type: "REDO" }
  | { type: "REMOTE_UPSERT"; event: CalEvent }
  | { type: "REMOTE_DELETE"; id: string };

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
    case "REMOTE_UPSERT": {
      const idx = state.present.findIndex((e) => e.id === action.event.id);
      const next = idx === -1
        ? [...state.present, action.event]
        : state.present.map((e) => (e.id === action.event.id ? action.event : e));
      return { ...state, present: next };
    }
    case "REMOTE_DELETE": {
      if (!state.present.some((e) => e.id === action.id)) return state;
      return { ...state, present: state.present.filter((e) => e.id !== action.id) };
    }
  }
}

function useAuth() {
  const [userId, setUserId] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUserId(data.session?.user.id ?? null);
      setChecking(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setUserId(session?.user.id ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  return { userId, checking };
}

const Index = () => {
  const { userId, checking } = useAuth();

  // No Supabase config (e.g. Lovable preview) — skip auth, run locally
  if (!supabaseConfigured) return <HorizonApp userId="local" />;

  if (checking) return (
    <div style={{ minHeight: "100vh", background: "#FAFAF8", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: 32, height: 32, borderRadius: "50%", border: "3px solid #CECBF6", borderTopColor: "#3C3489", animation: "spin 0.7s linear infinite" }} />
    </div>
  );

  if (!userId) return <AuthGate onAuth={() => supabase.auth.getSession()} />;

  return <HorizonApp userId={userId} />;
};

function HorizonLogo({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="hl-sky" cx="50%" cy="58%" r="55%" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFF0CC" />
          <stop offset="30%" stopColor="#E8CFEE" />
          <stop offset="100%" stopColor="#C4BEED" />
        </radialGradient>
        <radialGradient id="hl-glow" cx="50%" cy="0%" r="100%" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFE8A0" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#C4BEED" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="hl-sun" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#FFD84D" />
          <stop offset="100%" stopColor="#FFA500" />
        </radialGradient>
      </defs>
      {/* Sky background */}
      <rect width="100" height="100" fill="url(#hl-sky)" />
      {/* Glow behind sun */}
      <ellipse cx="50" cy="56" rx="38" ry="30" fill="url(#hl-glow)" />
      {/* Sun — half peeking above hill */}
      <circle cx="50" cy="58" r="14" fill="url(#hl-sun)" />
      {/* Hill — large arc covering bottom half */}
      <ellipse cx="50" cy="92" rx="70" ry="46" fill="#4B3FCC" />
    </svg>
  );
}

const HorizonApp = ({ userId }: { userId: string }) => {
  const today = startOfDay(new Date());
  const [weekWindowMode, setWeekWindowMode] = useState<"today-partial" | "today-bridge" | "calendar">("today-partial");
  const [currentWeekStart, setCurrentWeekStart] = useState(() => today);
  const nextCalendarWeekStart = useMemo(
    () => startOfWeek(addWeeks(today, 1), { weekStartsOn: 1 }),
    [today]
  );
  // 6 days before today — backward bridge start, today stays as rightmost (7 cols total)
  const prevPartialStart = useMemo(() => addDays(today, -6), [today]);

  const weekDates = useMemo(() => {
    let span: number;
    if (weekWindowMode === "today-partial") {
      // today → end of week (Friday if Mon-start)
      span = differenceInDays(endOfWeek(currentWeekStart, { weekStartsOn: 1 }), currentWeekStart) + 1;
    } else if (weekWindowMode === "today-bridge" && currentWeekStart.getTime() === prevPartialStart.getTime()) {
      // backward bridge: 6 days back + today = 7 cols, Friday rightmost
      span = 7;
    } else {
      span = 7;
    }
    const days: Date[] = [];
    for (let i = 0; i < span; i++) days.push(addDays(currentWeekStart, i));
    return days;
  }, [currentWeekStart, weekWindowMode, prevPartialStart]);

  const todayKey = format(today, "yyyy-MM-dd");

  // ── Resizable panels ──
  const containerRef = useRef<HTMLDivElement>(null);
  const [leftPanelWidth, setLeftPanelWidth] = useState(380);
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [sidebarHovered, setSidebarHovered] = useState(false);
  const sidebarAutoHideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const SIDEBAR_AUTO_HIDE_MS = 2 * 60 * 1000; // 2 minutes

  function showSidebar() {
    if (!leftCollapsed) return;
    setSidebarHovered(true);
    resetAutoHideTimer();
  }

  function resetAutoHideTimer() {
    if (sidebarAutoHideTimer.current) clearTimeout(sidebarAutoHideTimer.current);
    sidebarAutoHideTimer.current = setTimeout(() => {
      setSidebarHovered(false);
    }, SIDEBAR_AUTO_HIDE_MS);
  }

  function cancelAutoHide() {
    if (sidebarAutoHideTimer.current) clearTimeout(sidebarAutoHideTimer.current);
  }

  // When sidebar is pinned open (not collapsed), cancel any pending timer
  useEffect(() => {
    if (!leftCollapsed) {
      cancelAutoHide();
      setSidebarHovered(false);
    }
  }, [leftCollapsed]);

  // When collapsed, reset to expanded = false on unmount
  useEffect(() => () => { if (sidebarAutoHideTimer.current) clearTimeout(sidebarAutoHideTimer.current); }, []);

  // When collapsed, hovering the rail temporarily shows the full sidebar as an overlay
  const sidebarExpanded = !leftCollapsed || sidebarHovered;
  const isDragging = useRef(false);
  const MIN_LEFT = 260;
  const MIN_COL_WIDTH = 120;

  // ── Mobile ──
  const isMobile = useIsMobile();
  const [mobileTab, setMobileTab] = useState<"calendar" | "backpack">("backpack");

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

  const [tags, setTags] = useState<Tag[]>(() => loadCustomTags(DEFAULT_TAGS));
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sidebarShortcut, setSidebarShortcut] = useState(() => loadSidebarShortcut());

  function handleTagsChange(next: Tag[]) {
    setTags(next);
    saveCustomTags(next);
  }
  function handleShortcutChange(key: string) {
    setSidebarShortcut(key);
    saveSidebarShortcut(key);
  }

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

  // Stable dispatch ref so subscription callbacks always hit the latest reducer
  const dispatchRef = useRef(dispatch);
  useEffect(() => { dispatchRef.current = dispatch; }, [dispatch]);

  useEffect(() => {
    localStorage.setItem("horizon_events", JSON.stringify(events));
  }, [events]);

  // ── Supabase sync ──
  // On mount: set userId for capture store, pull remote data and merge
  const didPull = useRef(false);
  useEffect(() => {
    setCaptureSyncUser(userId);
    syncCapturesFromRemote(userId);

    if (!didPull.current) {
      didPull.current = true;
      pullEvents(userId).then((remote) => {
        if (!remote || remote.length === 0) return;
        const local: CalEvent[] = (() => {
          try { return JSON.parse(localStorage.getItem("horizon_events") ?? "[]"); } catch { return []; }
        })();

        // Prefer remote rows for matching IDs so status/field edits from other clients
        // are reflected locally, while preserving local-only items that are not remote yet.
        const remoteById = new Map(remote.map((e) => [e.id, e] as const));
        const merged = local.map((e) => remoteById.get(e.id) ?? e);
        const localIds = new Set(local.map((e) => e.id));
        const remoteOnly = remote.filter((e) => !localIds.has(e.id));
        const next = [...merged, ...remoteOnly];

        const changed = JSON.stringify(next) !== JSON.stringify(local);
        if (changed) {
          dispatch({ type: "PUSH", events: next });
        }
      });
    }

    // Realtime subscriptions — keep this device in sync with other devices
    const unsubEvents = subscribeEvents(
      userId,
      (e) => dispatchRef.current?.({ type: "REMOTE_UPSERT", event: e }),
      (id) => dispatchRef.current?.({ type: "REMOTE_DELETE", id }),
    );
    const unsubCaps = subscribeCaptures(userId, applyRemoteCapture, applyRemoteCaptureDelete);
    return () => { unsubEvents(); unsubCaps(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // Push entire events list to Supabase whenever it changes (debounced 800ms)
  const syncTimer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => {
    clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(() => {
      pushEvents(events, userId);
    }, 800);
    return () => clearTimeout(syncTimer.current);
  }, [events, userId]);

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

  // Keyboard shortcuts: Cmd+Z / Cmd+Shift+Z (paste wired later after handlePasteEvent)
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

  const [viewMode, setViewMode] = useState<"week" | "focus" | "month">("week");
  const [focusDate, setFocusDate] = useState<Date>(today);
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
    sbDeleteEvent(eventId);
    showToast(`"${deleted?.title ?? "Event"}" deleted — Cmd+Z to undo`);
  }, [events]);

  const handleCommit = useCallback((e: CalEvent) => {
    dispatch({ type: "PUSH", events: [...events, e] });
    if (isMobile) setMobileTab("calendar");
  }, [events, isMobile]);

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
    if (isMobile) setMobileTab("backpack");
  }, [isMobile]);

  const unplaced = useUnplacedCount(todayKey);
  const allCaptures = useCaptures();
  const [compactMode, setCompactMode] = useState(false);
  const [privacyMode, setPrivacyMode] = useState(false);
  const sync = useSyncStatus();

  // ── Left panel date navigation ──
  const [selectedDate, setSelectedDate] = useState<Date>(today);
  const selectedDayKey = format(selectedDate, "yyyy-MM-dd");
  const isViewingToday = selectedDayKey === todayKey;

  const prevDay = useCallback(() => setSelectedDate((d) => addDays(d, -1)), []);
  const nextDay = useCallback(() => setSelectedDate((d) => addDays(d, 1)), []);

  // ── Active event (for keyboard shortcuts) ──
  const activeEventRef = useRef<CalEvent | null>(null);
  const handleSelectEvent = useCallback((event: CalEvent | null) => {
    activeEventRef.current = event;
  }, []);

  // ── Copy/paste ──
  const copiedEventRef = useRef<CalEvent | null>(null);
  const handleCopyEvent = useCallback((event: CalEvent) => {
    copiedEventRef.current = event;
    showToast(`"${event.title}" copied — Cmd+V to paste`);
  }, []);

  const handlePasteEvent = useCallback(() => {
    const src = copiedEventRef.current;
    if (!src) return;
    const newEvent: CalEvent = { ...src, id: crypto.randomUUID(), date: selectedDayKey, source: "local", googleId: undefined };
    dispatch({ type: "PUSH", events: [...events, newEvent] });
    showToast(`Pasted "${src.title}" to ${format(selectedDate, "EEE d")}`);
  }, [events, selectedDayKey, selectedDate]);

  // Keyboard shortcuts: Delete, Cmd+C, Cmd+V, Cmd+D
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName;
      const inInput = tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement).isContentEditable;
      const mod = e.metaKey || e.ctrlKey;

      // Delete / Backspace — delete focused event
      if ((e.key === "Delete" || e.key === "Backspace") && !inInput) {
        const ev = activeEventRef.current;
        if (!ev) return;
        e.preventDefault();
        activeEventRef.current = null;
        dispatch({ type: "PUSH", events: events.filter((e) => e.id !== ev.id) });
        sbDeleteEvent(ev.id);
        showToast(`"${ev.title}" deleted — Cmd+Z to undo`);
        return;
      }

      // w / m — switch view (no modifier, not in input)
      if (!mod && !inInput) {
        if (e.key === "w") { e.preventDefault(); setViewMode("week"); return; }
        if (e.key === "m") { e.preventDefault(); setViewMode("month"); return; }
      }

      if (!mod) return;

      // Cmd+C — copy focused event
      if (e.key === "c" && !inInput) {
        const ev = activeEventRef.current;
        if (!ev) return;
        e.preventDefault();
        copiedEventRef.current = ev;
        showToast(`"${ev.title}" copied — Cmd+V to paste`);
        return;
      }

      // Cmd+V — paste copied event
      if (e.key === "v" && !inInput) {
        if (!copiedEventRef.current) return;
        e.preventDefault();
        handlePasteEvent();
        return;
      }

      // Cmd+D — duplicate focused event to same day
      if (e.key === "d" && !inInput) {
        const ev = activeEventRef.current;
        if (!ev) return;
        e.preventDefault();
        const dup: CalEvent = { ...ev, id: crypto.randomUUID(), start: ev.start + ev.duration, source: "local", googleId: undefined };
        dispatch({ type: "PUSH", events: [...events, dup] });
        showToast(`"${ev.title}" duplicated`);
        return;
      }

      // Cmd+\ (or configured key) — toggle sidebar
      if (e.key === sidebarShortcut) {
        e.preventDefault();
        setLeftCollapsed(v => !v);
        return;
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [events, handlePasteEvent, sidebarShortcut]);

  const focusDateKey = format(focusDate, "yyyy-MM-dd");
  const displayDates = viewMode === "focus"
    ? [focusDate]
    : weekDates;




  const handleWeekBack = useCallback(() => {
    if (weekWindowMode === "today-partial") {
      // Mirror of forward: show the 6 days before today (last Sat → Thu if today=Fri)
      setCurrentWeekStart(prevPartialStart);
      setWeekWindowMode("today-bridge");
      return;
    }

    if (weekWindowMode === "today-bridge") {
      if (currentWeekStart.getTime() === today.getTime()) {
        // Was the forward bridge (Sat-Sun after today) → go back to today-partial
        setCurrentWeekStart(today);
        setWeekWindowMode("today-partial");
        return;
      }
      // Was the backward bridge (6 days before today) → go one full week further back
      setCurrentWeekStart(addDays(prevPartialStart, -7));
      setWeekWindowMode("calendar");
      return;
    }

    // In calendar mode: go back 7 days
    setCurrentWeekStart((prev) => addDays(prev, -7));
    setWeekWindowMode("calendar");
  }, [currentWeekStart, prevPartialStart, today, weekWindowMode]);

  const handleWeekForward = useCallback(() => {
    if (weekWindowMode === "today-partial") {
      // Show Sat-Sun after today
      setCurrentWeekStart(today);
      setWeekWindowMode("today-bridge");
      return;
    }

    if (weekWindowMode === "today-bridge") {
      if (currentWeekStart.getTime() === prevPartialStart.getTime()) {
        // Was the backward bridge → pressing forward returns to today-partial
        setCurrentWeekStart(today);
        setWeekWindowMode("today-partial");
        return;
      }
      // Was the forward bridge (Sat-Sun) → jump to next full Mon-Sun week
      setCurrentWeekStart(nextCalendarWeekStart);
      setWeekWindowMode("calendar");
      return;
    }

    setCurrentWeekStart((prev) => addDays(prev, 7));
    setWeekWindowMode("calendar");
  }, [currentWeekStart, nextCalendarWeekStart, prevPartialStart, today, weekWindowMode]);

  const handleWeekToday = useCallback(() => {
    setCurrentWeekStart(today);
    setWeekWindowMode("today-partial");
  }, [today]);

  return (
    <div
      ref={containerRef}
      style={{
        background: "#FAFAF8",
        padding: isMobile ? "8px 8px 76px" : "16px",
      }}
      className={
        isMobile
          ? "flex h-screen w-full flex-col items-stretch overflow-hidden"
          : "flex h-screen w-full items-stretch overflow-hidden"
      }
    >
      {/* ── LEFT PANEL ── */}
      <div
        className="flex flex-col overflow-hidden"
        onMouseEnter={() => showSidebar()}
        onMouseMove={() => { if (leftCollapsed && sidebarHovered) resetAutoHideTimer(); }}
        onMouseLeave={() => { if (leftCollapsed) resetAutoHideTimer(); }}
        style={
          isMobile
            ? {
                display: mobileTab === "backpack" ? "flex" : "none",
                flex: 1,
                minHeight: 0,
                width: "100%",
                background: "#FAFAF8",
                borderRadius: 16,
                boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
              }
            : {
                // Always a normal flex child — width drives right panel to shrink/grow
                width: leftCollapsed ? (sidebarHovered ? leftPanelWidth : 56) : leftPanelWidth,
                minWidth: leftCollapsed ? 56 : MIN_LEFT,
                maxWidth: 520,
                flexShrink: 0,
                background: "#FAFAF8",
                borderRadius: 20,
                boxShadow: sidebarHovered && leftCollapsed ? "0 8px 32px rgba(0,0,0,0.16)" : "0 1px 4px rgba(0,0,0,0.07)",
                transition: "width 0.25s cubic-bezier(0.4,0,0.2,1), box-shadow 0.25s",
                overflow: "hidden",
              }
        }
      >
        {/* ── Icon-only collapsed view (shown when leftCollapsed and not hovered) ── */}
        {leftCollapsed && !sidebarHovered && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "14px 0", gap: 2, flex: 1 }}>
            {/* Logo mark */}
            <div style={{ width: 36, height: 36, borderRadius: 10, overflow: "hidden", marginBottom: 14, flexShrink: 0, boxShadow: "0 2px 8px rgba(75,65,184,0.28)" }}>
              <HorizonLogo size={36} />
            </div>
            {([
              { Icon: CalendarRange, id: "week" as const, label: "Week" },
              { Icon: CalendarDays, id: "month" as const, label: "Month" },
              { Icon: Sun, id: "focus" as const, label: "Focus" },
            ]).map(({ Icon, id, label }) => {
              const active = viewMode === id;
              return (
                <button key={id} title={label}
                  onClick={() => { if (id === "focus") { setFocusDate(today); setSelectedDate(today); } setViewMode(id); }}
                  style={{ width: 36, height: 36, borderRadius: 9, border: "none", background: active ? "#EEEDFE" : "transparent", color: active ? "#534AB7" : "#9B9590", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.13s" }}
                  onMouseEnter={e => { if (!active) e.currentTarget.style.background = "#F0EDE8"; }}
                  onMouseLeave={e => { if (!active) e.currentTarget.style.background = "transparent"; }}
                >
                  <Icon size={16} strokeWidth={active ? 2.2 : 1.8} />
                </button>
              );
            })}
            <div style={{ height: 1, width: 28, background: "#EDE9E4", margin: "8px 0" }} />
            <button title="Backpack" style={{ width: 36, height: 36, borderRadius: 9, border: "none", background: "transparent", color: "#9B9590", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", position: "relative", flexShrink: 0 }}
              onMouseEnter={e => { e.currentTarget.style.background = "#F0EDE8"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
            >
              <CheckSquare size={16} strokeWidth={1.8} />
              {unplaced > 0 && <span style={{ position: "absolute", top: 5, right: 5, width: 7, height: 7, borderRadius: "50%", background: "#7B73D6" }} />}
            </button>
            <button title="Floating thoughts" style={{ width: 36, height: 36, borderRadius: 9, border: "none", background: "transparent", color: "#9B9590", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
              onMouseEnter={e => { e.currentTarget.style.background = "#F0EDE8"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
            >
              <Sparkles size={16} strokeWidth={1.8} />
            </button>
            <div style={{ flex: 1 }} />
            <button onClick={() => setSettingsOpen(true)} title="Settings" style={{ width: 36, height: 36, borderRadius: 9, border: "none", background: "transparent", color: "#9B9590", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
              onMouseEnter={e => { e.currentTarget.style.background = "#F0EDE8"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
            >
              <Settings size={15} strokeWidth={1.8} />
            </button>
          </div>
        )}

        {/* ── Full expanded sidebar (always rendered when !leftCollapsed, or when hovered-over collapsed) ── */}
        {sidebarExpanded && (
          <>
            {/* ── App Logo + Title ── */}
            <div style={{ padding: "20px 20px 0", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 34, height: 34, borderRadius: 10, overflow: "hidden", flexShrink: 0, boxShadow: "0 2px 8px rgba(75,65,184,0.28)" }}>
                  <HorizonLogo size={34} />
                </div>
                <span style={{ fontSize: 18, fontWeight: 700, fontFamily: "'Lora', Georgia, serif", color: "#1A1816", letterSpacing: "-0.02em" }}>Horizon</span>
              </div>
              <button
                onClick={() => { setLeftCollapsed(true); setSidebarHovered(false); }}
                title="Collapse sidebar"
                style={{ width: 28, height: 28, borderRadius: 8, background: "transparent", border: "none", color: "#B0ACA6", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, transition: "all 0.15s" }}
                onMouseEnter={e => { e.currentTarget.style.background = "#F0EDE8"; e.currentTarget.style.color = "#6B6460"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#B0ACA6"; }}
              >‹</button>
            </div>

            {/* Analog clock in focus mode */}
            <AnimatePresence>
              {viewMode === "focus" && (
                <motion.div key="clock" initial={{ opacity: 0, scale: 0.88, y: -8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.88, y: -8 }} transition={{ type: "spring", stiffness: 340, damping: 26 }}
                  style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "16px 0 8px", gap: 8, flexShrink: 0 }}
                >
                  <AnalogClock size={130} />
                  <div style={{ fontSize: 12, fontWeight: 500, fontFamily: "'Lora', Georgia, serif", color: "#7B73D6", letterSpacing: "0.01em", opacity: 0.85 }}>
                    {format(focusDate, "EEEE, MMMM d")}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Scrollable body */}
            <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "16px 14px 8px" }}>

              {/* ── VIEWS section ── */}
              <div style={{ marginBottom: 6 }}>
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", color: "#B8B4AE", textTransform: "uppercase", padding: "0 8px", marginBottom: 4 }}>Views</div>
                {([
                  { id: "week" as const, label: "Week", Icon: CalendarRange },
                  { id: "month" as const, label: "Month", Icon: CalendarDays },
                  { id: "focus" as const, label: "Focus", Icon: Sun },
                ]).map(({ id, label, Icon }) => {
                  const active = viewMode === id;
                  return (
                    <button key={id}
                      onClick={() => { if (id === "focus") { setFocusDate(today); setSelectedDate(today); } setViewMode(id); }}
                      style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 10, border: "none", background: active ? "#EEEDFE" : "transparent", color: active ? "#3C3489" : "#6B6460", cursor: "pointer", fontSize: 13, fontWeight: active ? 600 : 500, transition: "all 0.13s", textAlign: "left", marginBottom: 1 }}
                      onMouseEnter={e => { if (!active) e.currentTarget.style.background = "#F3F0EC"; }}
                      onMouseLeave={e => { if (!active) e.currentTarget.style.background = "transparent"; }}
                    >
                      <Icon size={15} strokeWidth={active ? 2.2 : 1.8} style={{ flexShrink: 0, color: active ? "#534AB7" : "#9B9590" }} />
                      {label}
                      {active && <span style={{ marginLeft: "auto", width: 6, height: 6, borderRadius: "50%", background: "#534AB7", flexShrink: 0 }} />}
                    </button>
                  );
                })}
              </div>

              {/* ── Backpack composer + items ── */}
              <div style={{ marginBottom: 6 }}>
                <Backpack
                  selectedDayKey={selectedDayKey}
                  dayEvents={events.filter((e) => e.date === selectedDayKey)}
                  onAttachToEvent={handleAttachToEvent}
                  onCreateEventFromItem={handleCreateEventFromItem}
                />
              </div>

            </div>

            {/* ── Bottom: Profile + Settings + Export/Import ── */}
            <div style={{ flexShrink: 0, padding: "8px 14px 16px", borderTop: "1px solid #EDE9E4" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, padding: "6px 8px", borderRadius: 10, cursor: "pointer" }}
                  onMouseEnter={e => { e.currentTarget.style.background = "#F3F0EC"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
                >
                  <div style={{ width: 28, height: 28, borderRadius: "50%", background: "linear-gradient(135deg, #C8C3F0, #7B73D6)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <User size={13} style={{ color: "#fff" }} />
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#3A3630" }}>Profile</span>
                </div>
                <button onClick={() => setSettingsOpen(true)} title="Settings"
                  style={{ display: "flex", alignItems: "center", gap: 7, padding: "6px 10px", borderRadius: 10, border: "none", background: "transparent", color: "#6B6460", cursor: "pointer", fontSize: 12, fontWeight: 500, transition: "all 0.13s" }}
                  onMouseEnter={e => { e.currentTarget.style.background = "#F3F0EC"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
                >
                  <Settings size={14} strokeWidth={1.8} style={{ color: "#9B9590" }} />
                  Settings
                </button>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  onClick={() => {
                    const payload = { version: 1, exportedAt: new Date().toISOString(), horizon_events: localStorage.getItem("horizon_events") ?? "[]", horizon_backpack: localStorage.getItem("horizon_backpack") ?? "[]" };
                    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a"); a.href = url; a.download = `horizon-backup-${format(new Date(), "yyyy-MM-dd")}.json`; a.click(); URL.revokeObjectURL(url);
                    showToast("Data exported");
                  }}
                  style={{ flex: 1, borderRadius: 10, background: "#EEEDFE", border: "1px solid #C8BEF5", padding: "7px 0", fontSize: 11, fontWeight: 600, color: "#3C3489", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}
                  onMouseEnter={e => { e.currentTarget.style.background = "#E0DDFB"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "#EEEDFE"; }}
                >
                  <svg width="11" height="11" viewBox="0 0 13 13" fill="none"><path d="M6.5 1v7M3.5 5.5l3 3 3-3M1.5 10h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  Export
                </button>
                <label
                  style={{ flex: 1, borderRadius: 10, background: "#F2EFE9", border: "1px solid #E2DDD6", padding: "7px 0", fontSize: 11, fontWeight: 600, color: "#6B6460", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#EAE6DE"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "#F2EFE9"; }}
                >
                  <svg width="11" height="11" viewBox="0 0 13 13" fill="none"><path d="M6.5 9V2M3.5 4.5l3-3 3 3M1.5 10h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  Import
                  <input type="file" accept=".json" style={{ display: "none" }}
                    onChange={(e) => {
                      const file = e.target.files?.[0]; if (!file) return;
                      const reader = new FileReader();
                      reader.onload = (ev) => {
                        try {
                          const data = JSON.parse(ev.target?.result as string);
                          if (data.horizon_events) localStorage.setItem("horizon_events", data.horizon_events);
                          if (data.horizon_backpack) localStorage.setItem("horizon_backpack", data.horizon_backpack);
                          showToast("Data imported — reloading…");
                          setTimeout(() => window.location.reload(), 1200);
                        } catch { showToast("Invalid backup file"); }
                      };
                      reader.readAsText(file); e.target.value = "";
                    }}
                  />
                </label>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── RESIZE HANDLE (desktop only, shown when sidebar is pinned open) ── */}
      {!isMobile && !leftCollapsed && (
        <div onMouseDown={handleResizeMouseDown} style={{ width: 16, flexShrink: 0, cursor: "col-resize", display: "flex", alignItems: "center", justifyContent: "center", userSelect: "none" }}>
          <div
            style={{ width: 3, height: 40, borderRadius: 2, background: "rgba(0,0,0,0.10)", transition: "background 0.15s" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(0,0,0,0.22)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(0,0,0,0.10)")}
          />
        </div>
      )}

      {/* ── RIGHT PANEL ── */}
      <div
        className="flex flex-col overflow-hidden"
        style={
          isMobile
            ? {
                display: mobileTab === "calendar" ? "flex" : "none",
                flex: 1,
                minHeight: 0,
                width: "100%",
                background: "#FAFAF8",
                borderRadius: 16,
                boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
              }
            : { background: "#FAFAF8", borderRadius: 20, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", minWidth: minRightWidth, flex: 1 }
        }
      >
        {/* Header */}
        <div style={{ padding: "20px 24px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }} className="shrink-0">
          <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0, flexShrink: 1, overflow: "hidden" }}>
            {viewMode === "focus" ? (
              <div style={{ minWidth: 0 }}>
                <h2 style={{ fontSize: 28, fontWeight: 600, fontFamily: "'Lora', Georgia, serif", lineHeight: "1.1", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", letterSpacing: "-0.02em" }}>
                  {isToday(focusDate) ? "Today" : format(focusDate, "EEEE")}
                </h2>
                <p style={{ fontSize: 13, color: "hsl(var(--muted-foreground))", marginTop: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {format(focusDate, "MMMM d, yyyy")} · {events.filter(e => e.date === focusDateKey).length} event{events.filter(e => e.date === focusDateKey).length !== 1 ? "s" : ""}
                </p>
              </div>
            ) : viewMode === "month" ? (
              <div /> // header lives inside MonthView
            ) : (
              <div style={{ minWidth: 0 }}>
                <h2 style={{ fontSize: 28, fontWeight: 600, fontFamily: "'Lora', Georgia, serif", lineHeight: "1.1", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", letterSpacing: "-0.02em" }}>{format(weekDates[0], "MMMM yyyy")}</h2>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 3 }}>
                  <p style={{ fontSize: 13, color: "hsl(var(--muted-foreground))", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", margin: 0 }}>
                    {format(weekDates[0], "EEE d")} → {format(weekDates[weekDates.length - 1], "EEE d")}
                  </p>
                  {(() => {
                    const lastDay = weekDates[weekDates.length - 1];
                    const daysLeft = differenceInDays(lastDay, today) + 1;
                    if (daysLeft <= 0) return null;
                    return (
                      <span style={{ fontSize: 11, fontWeight: 600, color: "#7B73D6", background: "#EEEDFE", borderRadius: 20, padding: "1px 8px", whiteSpace: "nowrap", flexShrink: 0 }}>
                        {daysLeft} day{daysLeft !== 1 ? "s" : ""} left
                      </span>
                    );
                  })()}
                </div>
              </div>
            )}

            {(viewMode === "week" || viewMode === "focus") && (
              <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                <button
                  onClick={viewMode === "focus"
                    ? () => { const d = addDays(focusDate, -1); setFocusDate(d); setSelectedDate(d); }
                    : handleWeekBack}
                  style={{ background: "#fff", border: "1px solid #EAEAEA", borderRadius: "50%", width: 32, height: 32, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#3C3489" }}>←</button>
                <button
                  onClick={viewMode === "focus"
                    ? () => { setFocusDate(today); setSelectedDate(today); }
                    : handleWeekToday}
                  style={{ background: "#fff", border: "1px solid #EAEAEA", borderRadius: 16, padding: "0 12px", height: 32, cursor: "pointer", fontSize: 12, fontWeight: 500, color: "#3C3489" }}>Today</button>
                <button
                  onClick={viewMode === "focus"
                    ? () => { const d = addDays(focusDate, 1); setFocusDate(d); setSelectedDate(d); }
                    : handleWeekForward}
                  style={{ background: "#fff", border: "1px solid #EAEAEA", borderRadius: "50%", width: 32, height: 32, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#3C3489" }}>→</button>
              </div>
            )}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            {/* Supabase sync status */}
            <div title={sync.error ?? undefined} style={{
              display: "flex", alignItems: "center", gap: 5,
              background: sync.status === "ok" ? "#EAF3DE"
                : sync.status === "error" ? "#FEF0EE"
                : sync.status === "syncing" ? "#EEEDFE"
                : "#F0EDE8",
              borderRadius: 20, padding: "4px 10px",
              fontSize: 11, fontWeight: 600,
              color: sync.status === "ok" ? "#27500A"
                : sync.status === "error" ? "#C0392B"
                : sync.status === "syncing" ? "#3C3489"
                : "#888",
              transition: "all 0.3s",
            }}>
              <span style={{
                width: 6, height: 6, borderRadius: "50%", flexShrink: 0,
                background: sync.status === "ok" ? "#3B6D11"
                  : sync.status === "error" ? "#C0392B"
                  : sync.status === "syncing" ? "#7B73D6"
                  : "#C8C4BE",
                animation: sync.status === "syncing" ? "pulse 1s ease-in-out infinite" : "none",
              }} />
              {sync.status === "ok" ? "synced"
                : sync.status === "error" ? "sync error"
                : sync.status === "syncing" ? "syncing…"
                : "not synced"}
            </div>

            {unplaced > 0 && (
              <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                style={{ display: "flex", alignItems: "center", gap: 6, background: "#E8EDFD", borderRadius: 20, padding: "5px 12px", fontSize: 12, fontWeight: 500, color: "#3D68CC" }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#3D68CC", display: "inline-block" }} />
                {unplaced} unplaced
              </motion.div>
            )}

            {/* Privacy toggle */}
            {viewMode !== "month" && (
              <button
                onClick={() => setPrivacyMode((v) => !v)}
                title={privacyMode ? "Show event details" : "Hide event details (privacy mode)"}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  height: 32, borderRadius: 20, padding: "0 14px",
                  background: privacyMode ? "#3C3489" : "#fff",
                  border: privacyMode ? "1px solid #3C3489" : "1px solid #EAEAEA",
                  color: privacyMode ? "#fff" : "#3C3489",
                  cursor: "pointer", fontSize: 12, fontWeight: 600,
                  transition: "all 0.15s",
                }}
              >
                <EyeOff size={13} strokeWidth={2} />
                {privacyMode ? "show" : "hide"}
              </button>
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

            {/* Settings */}
            <button
              onClick={() => setSettingsOpen(true)}
              title="Settings"
              style={{
                width: 32, height: 32, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                background: "#fff", border: "1px solid #EAEAEA", color: "#3C3489", cursor: "pointer",
                transition: "all 0.15s",
              }}
              onMouseEnter={e => { e.currentTarget.style.background = "#EEEDFE"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "#fff"; }}
            >
              <Settings size={14} strokeWidth={2} />
            </button>

            {/* View toggle */}
            <div className="flex items-center" style={{ background: "hsl(var(--muted))", borderRadius: 20, padding: 3, gap: 2 }}>
              {(["week", "month", "focus"] as const).map((v) => (
                <button key={v} onClick={() => {
                  if (v === "focus") { setFocusDate(today); setSelectedDate(today); }
                  setViewMode(v);
                }}
                  style={{
                    borderRadius: 20, padding: "5px 14px", fontSize: 13,
                    fontWeight: viewMode === v ? 500 : 400,
                    background: viewMode === v ? "#fff" : "transparent",
                    color: viewMode === v ? "hsl(var(--foreground))" : "hsl(var(--muted-foreground))",
                    border: "none", cursor: "pointer",
                    boxShadow: viewMode === v ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                    transition: "all 0.15s", textTransform: "capitalize",
                  }}>
                  {v === "focus" ? "Focus" : v === "month" ? "Month" : "Week"}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Grid */}
        <div className="flex min-h-0 flex-1 overflow-hidden" style={{ paddingLeft: 24, paddingRight: 24, paddingBottom: 16 }}>
          <AnimatePresence mode="wait" custom={viewMode === "month" ? 1 : -1}>
            {viewMode === "month" ? (
              <motion.div
                key="month"
                custom={1}
                variants={{
                  enter: (dir: number) => ({
                    opacity: 0,
                    scaleY: dir > 0 ? 0.82 : 1.04,
                    y: dir > 0 ? 24 : -12,
                    transformOrigin: "top center",
                  }),
                  center: {
                    opacity: 1, scaleY: 1, y: 0,
                    transition: { type: "spring", stiffness: 280, damping: 28, mass: 0.9 },
                  },
                  exit: {
                    opacity: 0, scaleY: 0.88, y: -16,
                    transformOrigin: "top center",
                    transition: { duration: 0.22, ease: [0.4, 0, 1, 1] },
                  },
                }}
                initial="enter"
                animate="center"
                exit="exit"
                style={{ width: "100%", height: "100%", transformOrigin: "top center" }}
              >
                <MonthView
                  events={events}
                  tags={tags}
                  onDayClick={(date) => { setSelectedDate(date); }}
                  onDayNavigate={(date) => { setSelectedDate(date); setFocusDate(date); setViewMode("focus"); }}
                />
              </motion.div>
            ) : (
              <motion.div
                key="week"
                custom={-1}
                variants={{
                  enter: (dir: number) => ({
                    opacity: 0,
                    scaleY: dir < 0 ? 0.82 : 1.04,
                    scaleX: dir < 0 ? 0.94 : 1,
                    y: dir < 0 ? 18 : -12,
                    transformOrigin: "top center",
                  }),
                  center: {
                    opacity: 1, scaleY: 1, scaleX: 1, y: 0,
                    transition: { type: "spring", stiffness: 300, damping: 30, mass: 0.85 },
                  },
                  exit: {
                    opacity: 0,
                    scaleY: 0,
                    scaleX: 0.96,
                    y: -8,
                    transformOrigin: "top center",
                    transition: { duration: 0.28, ease: [0.4, 0, 1, 1] },
                  },
                }}
                initial="enter"
                animate="center"
                exit="exit"
                style={{ width: "100%", height: "100%", display: "flex", transformOrigin: "top center" }}
              >
                <WeekGrid
                  weekDates={displayDates}
                  events={events}
                  tags={tags}
                  allCaptures={allCaptures}
                  onMark={handleMarkCompletion}
                  onDelete={handleDelete}
                  onResize={handleResize}
                  onUpdate={handleUpdate}
                  onCreate={handleCommit}
                  onMoveToDay={handleMoveToDay}
                  onCopyEvent={handleCopyEvent}
                  onSelectEvent={handleSelectEvent}
                  compact={compactMode}
                  privacyMode={privacyMode}
                  focusMode={viewMode === "focus"}
                  selectedDayKey={selectedDayKey}
                  onDayClick={(date) => {
                    const dateKey = format(date, "yyyy-MM-dd");
                    if (viewMode === "focus") {
                      if (dateKey === focusDateKey) setViewMode("week");
                      else { setFocusDate(date); setSelectedDate(date); }
                    } else {
                      if (dateKey === selectedDayKey) {
                        setFocusDate(date);
                        setViewMode("focus");
                      } else {
                        setSelectedDate(date);
                      }
                    }
                  }}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Privacy mode banner */}
        {privacyMode && (
          <div style={{
            margin: "0 24px 12px",
            background: "#EEEDFE",
            border: "1px solid #C5BEF5",
            borderRadius: 14,
            padding: "10px 18px",
            display: "flex",
            alignItems: "center",
            gap: 10,
            flexShrink: 0,
          }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#534AB7", flexShrink: 0 }} />
            <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: "#3C3489", fontFamily: "'Lora', Georgia, serif" }}>
              privacy mode on — event details hidden from view
            </span>
            <button
              onClick={() => setPrivacyMode(false)}
              style={{ background: "none", border: "none", fontSize: 12, fontWeight: 600, color: "#534AB7", cursor: "pointer", padding: "2px 6px", borderRadius: 8, whiteSpace: "nowrap" }}
            >
              show →
            </button>
          </div>
        )}
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
            <p style={{ fontSize: 20, fontWeight: 600, fontFamily: "'Lora', Georgia, serif", color: "#111", marginBottom: 6, lineHeight: 1.2 }}>Did this happen?</p>
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

      {/* Settings modal */}
      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        tags={tags}
        onTagsChange={handleTagsChange}
        sidebarShortcut={sidebarShortcut}
        onShortcutChange={handleShortcutChange}
      />

      {/* ── MOBILE BOTTOM TAB BAR ── */}
      {isMobile && (
        <nav
          style={{
            position: "fixed",
            bottom: 0,
            left: 0,
            right: 0,
            background: "rgba(255,255,255,0.96)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            borderTop: "1px solid hsl(var(--border))",
            padding: "8px 16px calc(8px + env(safe-area-inset-bottom))",
            display: "flex",
            gap: 8,
            zIndex: 250,
            boxShadow: "0 -2px 12px rgba(0,0,0,0.04)",
          }}
        >
          {([
            { id: "backpack", label: "Capture", Icon: Sparkles, badge: unplaced },
            { id: "calendar", label: "Calendar", Icon: CalendarRange, badge: 0 },
          ] as const).map(({ id, label, Icon, badge }) => {
            const active = mobileTab === id;
            return (
              <button
                key={id}
                onClick={() => setMobileTab(id)}
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 4,
                  background: active ? "rgba(123,115,214,0.12)" : "transparent",
                  border: "none",
                  borderRadius: 14,
                  padding: "8px 0",
                  cursor: "pointer",
                  color: active ? "#3C3489" : "#888",
                  fontSize: 11,
                  fontWeight: active ? 600 : 500,
                  position: "relative",
                  transition: "all 0.15s",
                }}
              >
                <Icon size={20} strokeWidth={active ? 2.2 : 1.8} />
                <span>{label}</span>
                {badge > 0 && (
                  <span
                    style={{
                      position: "absolute",
                      top: 4,
                      right: "calc(50% - 22px)",
                      background: "#7B73D6",
                      color: "#fff",
                      fontSize: 9,
                      fontWeight: 700,
                      borderRadius: 9,
                      minWidth: 16,
                      height: 16,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: "0 4px",
                      lineHeight: 1,
                    }}
                  >
                    {badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      )}
    </div>
  );
};

/* ── Week Grid ── */
function WeekGrid({ weekDates, events, tags, allCaptures, onMark, onDelete, onResize, onUpdate, onCreate, onMoveToDay, onCopyEvent, onSelectEvent, compact, privacyMode, focusMode, selectedDayKey, onDayClick }: {
  weekDates: Date[];
  events: CalEvent[];
  tags: Tag[];
  allCaptures: import("@/types/event").CaptureItem[];
  onMark: (eventId: string, completed: boolean | null) => void;
  onDelete: (eventId: string) => void;
  onResize: (eventId: string, newDuration: number) => void;
  onUpdate: (eventId: string, patch: Partial<CalEvent>) => void;
  onCreate: (event: CalEvent) => void;
  onMoveToDay: (eventId: string, newDate: string) => void;
  onCopyEvent: (event: CalEvent) => void;
  onSelectEvent?: (event: CalEvent | null) => void;
  compact?: boolean;
  privacyMode?: boolean;
  focusMode?: boolean;
  selectedDayKey?: string;
  onDayClick?: (date: Date) => void;
}) {
  const START_HOUR = 0;
  const END_HOUR = 24;

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
              taskItems={allCaptures.filter((c) => c.kind === "task" && c.dayKey === dateKey && c.start !== undefined)}
              onMark={onMark}
              onDelete={onDelete}
              onResize={onResize}
              onUpdate={onUpdate}
              onCreate={onCreate}
              onMoveToDay={onMoveToDay}
              onCopyEvent={onCopyEvent}
              onSelectEvent={onSelectEvent}
              compact={compact}
              privacyMode={privacyMode}
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
  0:  { label: "12 AM", sub: "midnight" },
  2:  { label: "2 AM" },
  4:  { label: "4 AM" },
  6:  { label: "6 AM",  sub: "morning" },
  8:  { label: "8 AM" },
  10: { label: "10 AM" },
  12: { label: "noon",  sub: "midday",  accent: true },
  14: { label: "2 PM" },
  16: { label: "4 PM" },
  17: { label: "5 PM",  sub: "evening" },
  19: { label: "7 PM" },
  21: { label: "9 PM" },
  23: { label: "11 PM" },
};

// Mirror DayColumn's compressed late-hours mapping
const GUTTER_LATE_START = 22 * 60;
function gutterTimeToY(mins: number): number {
  if (mins <= GUTTER_LATE_START) return mins;
  return GUTTER_LATE_START + (mins - GUTTER_LATE_START) / 3;
}
const GUTTER_TOTAL_HEIGHT = gutterTimeToY(24 * 60);

function TimeGutter({ startHour, endHour }: { startHour: number; endHour: number }) {
  const hours = Array.from({ length: endHour - startHour + 1 }, (_, i) => startHour + i);
  return (
    <div className="shrink-0" style={{ width: 52, paddingTop: 64 }}>
      <div style={{ position: "relative", height: GUTTER_TOTAL_HEIGHT }}>
        {hours.map((h) => {
          const anchor = GUTTER_ANCHORS[h];
          if (!anchor) return null;
          const y = gutterTimeToY(h * 60);
          return (
            <div
              key={h}
              style={{
                position: "absolute",
                top: y - (anchor.sub ? 10 : 7),
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
