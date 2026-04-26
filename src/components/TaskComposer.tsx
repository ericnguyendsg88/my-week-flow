import { useEffect, useRef, useState } from "react";
import {
  format,
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isToday,
  isTomorrow,
} from "date-fns";
import { CalEvent, Tag, DURATIONS } from "@/types/event";
import {
  guessCategory,
  guessDuration,
  guessInputType,
  suggestStart,
  durationLabel,
  minutesToLabel,
  findConflicts,
} from "@/lib/event-utils";
import { tagForCategory } from "@/lib/tags";
import { addCapture } from "@/lib/capture-store";
import { Textarea } from "@/components/ui/textarea";

type Step = "idle" | "linkPrompt" | "type" | "day" | "time" | "duration" | "tag" | "location" | "people" | "confirm" | "taskDay" | "taskTag" | "taskConfirm";

const COLOR_MAP: Record<string, { bg: string; text: string }> = {
  purple: { bg: "#AFA9EC", text: "#3C3489" },
  blue:   { bg: "#B5D4F4", text: "#0C447C" },
  pink:   { bg: "#F4C0D1", text: "#72243E" },
  amber:  { bg: "#FAC775", text: "#633806" },
  teal:   { bg: "#9FE1CB", text: "#085041" },
  coral:  { bg: "#FFBFB0", text: "#7A2812" },
  green:  { bg: "#C3EDCB", text: "#1A5C2A" },
  gray:   { bg: "#D3D1C7", text: "#444441" },
};

function tagColors(tag: Tag) {
  return COLOR_MAP[tag.color] ?? { bg: "#C5BEF5", text: "#3C3489" };
}

// ─── Mini Calendar ───────────────────────────────────────────────
function MiniCalendar({ selected, onSelect }: { selected: string; onSelect: (date: string) => void }) {
  const [viewMonth, setViewMonth] = useState(() =>
    startOfMonth(selected ? new Date(selected + "T00:00:00") : new Date())
  );

  const days = eachDayOfInterval({
    start: startOfWeek(viewMonth, { weekStartsOn: 1 }),
    end:   endOfWeek(endOfMonth(viewMonth), { weekStartsOn: 1 }),
  });

  const todayStr = format(new Date(), "yyyy-MM-dd");

  return (
    <div>
      {/* Month navigation */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <button
          onClick={() => setViewMonth((m) => subMonths(m, 1))}
          style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16, color: "#7B73D6", padding: "2px 8px", lineHeight: 1 }}
        >
          ‹
        </button>
        <span style={{ fontSize: 12, fontWeight: 700, color: "#3C3489" }}>{format(viewMonth, "MMMM yyyy")}</span>
        <button
          onClick={() => setViewMonth((m) => addMonths(m, 1))}
          style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16, color: "#7B73D6", padding: "2px 8px", lineHeight: 1 }}
        >
          ›
        </button>
      </div>

      {/* Weekday headers */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", marginBottom: 3 }}>
        {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
          <div key={i} style={{ textAlign: "center", fontSize: 9, fontWeight: 700, color: "#B0AAE8", paddingBottom: 2 }}>
            {d}
          </div>
        ))}
      </div>

      {/* Days grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2 }}>
        {days.map((day) => {
          const key = format(day, "yyyy-MM-dd");
          const isSelected = key === selected;
          const isTodayDay = key === todayStr;
          const inMonth = isSameMonth(day, viewMonth);

          return (
            <button
              key={key}
              onClick={() => onSelect(key)}
              title={format(day, "EEE, MMM d yyyy")}
              style={{
                padding: "5px 0",
                borderRadius: 6,
                fontSize: 11,
                fontWeight: isSelected ? 700 : isTodayDay ? 600 : 400,
                background: isSelected ? "#3C3489" : isTodayDay ? "#EBE8FC" : "transparent",
                color: isSelected
                  ? "#fff"
                  : !inMonth
                  ? "rgba(123,115,214,0.28)"
                  : isTodayDay
                  ? "#3C3489"
                  : "#4A42A0",
                border: isTodayDay && !isSelected ? "1.5px solid #C5BEF5" : "1.5px solid transparent",
                cursor: "pointer",
                textAlign: "center",
              }}
            >
              {format(day, "d")}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Time Slot Grid ───────────────────────────────────────────────
function TimeSlotGrid({
  events,
  date,
  duration,
  selected,
  onSelect,
}: {
  events: CalEvent[];
  date: string;
  duration: number;
  selected: number;
  onSelect: (start: number) => void;
}) {
  const STEP = 30;
  const START = 7 * 60;   // 7 am
  const END   = 22 * 60;  // 10 pm

  const slots: { start: number; conflicts: CalEvent[] }[] = [];
  for (let t = START; t < END; t += STEP) {
    const conflicts = findConflicts(events, date, t, Math.max(duration, STEP));
    slots.push({ start: t, conflicts });
  }

  const selectedConflicts = selected > 0
    ? (slots.find((s) => s.start === selected)?.conflicts ?? [])
    : [];

  return (
    <div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 4,
          maxHeight: 200,
          overflowY: "auto",
          paddingBottom: 2,
        }}
        className="scrollbar-hidden"
      >
        {slots.map(({ start, conflicts }) => {
          const isSelected = selected === start;
          const hasConflict = conflicts.length > 0;
          return (
            <button
              key={start}
              onClick={() => onSelect(start)}
              style={{
                padding: "6px 2px",
                borderRadius: 8,
                fontSize: 11,
                fontWeight: 600,
                textAlign: "center",
                cursor: "pointer",
                transition: "all 0.1s",
                border: isSelected
                  ? "1.5px solid #3C3489"
                  : hasConflict
                  ? "1.5px solid #F5A524"
                  : "1.5px solid rgba(123,115,214,0.22)",
                background: isSelected
                  ? "#3C3489"
                  : hasConflict
                  ? "#FFF3DC"
                  : "rgba(255,255,255,0.85)",
                color: isSelected ? "#fff" : hasConflict ? "#7A4000" : "#3C3489",
              }}
            >
              {minutesToLabel(start)}
              {hasConflict && !isSelected && (
                <span style={{ display: "block", fontSize: 8, marginTop: 1, opacity: 0.8 }}>⚠</span>
              )}
            </button>
          );
        })}
      </div>

      {selectedConflicts.length > 0 && (
        <div
          style={{
            marginTop: 8,
            padding: "7px 10px",
            background: "#FFF3DC",
            borderRadius: 8,
            border: "1px solid #F5A524",
            fontSize: 11,
            color: "#7A4000",
            fontWeight: 500,
          }}
        >
          ⚠ Conflicts with{" "}
          {selectedConflicts.map((e) => `"${e.title}" (${minutesToLabel(e.start)}–${minutesToLabel(e.start + e.duration)})`).join(", ")}
          . You can still schedule here.
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────
interface Props {
  weekDates: Date[];
  events: CalEvent[];
  tags: Tag[];
  onCommit: (e: CalEvent) => void;
  prefill?: string;
}

const URL_REGEX = /^(https?:\/\/[^\s]+)/;

function parseDuration(text: string): number {
  const t = text.trim().toLowerCase();
  const hm = t.match(/^(\d+)h(\d+)m?$/);
  if (hm) return parseInt(hm[1]) * 60 + parseInt(hm[2]);
  const h = t.match(/^(\d+)h$/);
  if (h) return parseInt(h[1]) * 60;
  const m = t.match(/^(\d+)m?$/);
  if (m) return parseInt(m[1]);
  return 0;
}

function normalizeEventTitle(text: string) {
  return text
    .replace(/\*\*/g, "")
    .replace(/\s*\n+\s*/g, " ")
    .trim();
}

const STEP_BACK: Partial<Record<Step, Step>> = {
  linkPrompt: "idle",
  type: "idle",
  day: "type",
  time: "day",
  duration: "time",
  tag: "duration",
  location: "tag",
  people: "location",
  confirm: "people",
  taskDay: "idle",
  taskTag: "taskDay",
  taskConfirm: "taskTag",
};

const SKIPPABLE: Step[] = ["day", "time", "duration", "tag", "location", "people", "taskDay", "taskTag"];

export function TaskComposer({ weekDates, events, tags, onCommit, prefill }: Props) {
  const [text, setText] = useState("");
  const [step, setStep] = useState<Step>("idle");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [showCalendar, setShowCalendar] = useState(false);
  const [draftDate, setDraftDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [draftStart, setDraftStart] = useState(0);
  const [draftDuration, setDraftDuration] = useState(30);
  const [draftTag, setDraftTag] = useState("");
  const [draftLocation, setDraftLocation] = useState("");
  const [draftPeople, setDraftPeople] = useState("");
  const [customDurText, setCustomDurText] = useState("");

  const detectedType = step === "idle" ? guessInputType(text) : null;

  // When a prefill arrives from outside (e.g. from backpack), auto-start wizard
  const lastPrefill = useRef<string | undefined>();
  useEffect(() => {
    if (prefill && prefill !== lastPrefill.current) {
      lastPrefill.current = prefill;
      const clean = prefill.replace(/__\d+$/, ""); // strip timestamp suffix used to force re-trigger
      setText(clean);
      setDraftDate(format(new Date(), "yyyy-MM-dd"));
      setDraftDuration(guessDuration(clean));
      setDraftTag(tagForCategory(guessCategory(clean)));
      setStep("type");
    }
  }, [prefill]);

  useEffect(() => {
    const id = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(id);
  }, [step]);

  function reset() {
    setText("");
    setStep("idle");
    setShowCalendar(false);
    setCustomDurText("");
    setDraftLocation("");
    setDraftPeople("");
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  function goBack() {
    const prev = STEP_BACK[step];
    if (!prev || prev === "idle") reset();
    else setStep(prev);
  }

  function skipStep() {
    if (step === "day") { setStep("time"); }
    else if (step === "time") setStep("duration");
    else if (step === "duration") setStep("tag");
    else if (step === "tag") setStep("location");
    else if (step === "location") setStep("people");
    else if (step === "people") setStep("confirm");
    else if (step === "taskDay") setStep("taskTag");
    else if (step === "taskTag") setStep("taskConfirm");
  }

  function handleInput(val: string) {
    setText(val);
    if (step !== "idle") setStep("idle");
  }

  function startWizard() {
    if (!text.trim()) return;
    if (URL_REGEX.test(text.trim())) { setStep("linkPrompt"); return; }
    const kind = guessInputType(text);
    setDraftDate(format(new Date(), "yyyy-MM-dd"));
    setDraftDuration(guessDuration(text));
    setDraftTag(tagForCategory(guessCategory(text)));
    if (kind === "event") {
      setStep("day");
    } else if (kind === "task") {
      setStep("taskDay");
    } else {
      setStep("type");
    }
  }

  function commit() {
    const start = draftStart || suggestStart(events, draftDate, draftDuration);
    onCommit({
      id: crypto.randomUUID(),
      title: normalizeEventTitle(text),
      category: "work",
      tagId: draftTag,
      date: draftDate,
      start,
      duration: draftDuration,
      where: draftLocation.trim() || undefined,
      who: draftPeople.trim() || undefined,
    });
    reset();
  }

  function commitTask() {
    addCapture({ kind: "task", title: text.trim(), tagId: draftTag || undefined, dayKey: draftDate });
    reset();
  }

  function toggleBold() {
    const el = inputRef.current;
    if (!el) return;
    const start = el.selectionStart ?? text.length;
    const end = el.selectionEnd ?? text.length;
    const selected = text.slice(start, end);
    const replacement = `**${selected || "bold"}**`;
    const next = text.slice(0, start) + replacement + text.slice(end);
    setText(next);
    if (step !== "idle") setStep("idle");
    setTimeout(() => {
      el.focus();
      const cursorStart = start + 2;
      const cursorEnd = start + replacement.length - 2;
      el.setSelectionRange(selected ? cursorStart : cursorStart, selected ? cursorEnd : cursorEnd);
    }, 0);
  }

  // Keyboard shortcuts
  useEffect(() => {
    if (step === "idle") return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") { goBack(); return; }
      if (e.key === "Tab") { e.preventDefault(); if (SKIPPABLE.includes(step)) skipStep(); return; }
      if (e.key === "Enter" && step === "confirm") { commit(); return; }
      if (e.key === "Enter" && step === "taskConfirm") { commitTask(); return; }

      const num = parseInt(e.key);
      if (isNaN(num) || num < 1) return;
      const idx = num - 1;

      if (step === "linkPrompt") {
        if (idx === 0) { addCapture({ kind: "link", title: text.trim(), url: text.trim(), dayKey: format(new Date(), "yyyy-MM-dd") }); reset(); }
        if (idx === 1) { setDraftDate(format(new Date(), "yyyy-MM-dd")); setDraftDuration(guessDuration(text)); setDraftTag(tagForCategory(guessCategory(text))); setStep("type"); }
      } else if (step === "type") {
        if (idx === 0) setStep("day");
        if (idx === 1) setStep("taskDay");
        if (idx === 2) { addCapture({ kind: "thought", title: text.trim(), dayKey: format(new Date(), "yyyy-MM-dd") }); reset(); }
      } else if (step === "taskConfirm") {
        if (idx === 0) commitTask();
      } else if (step === "duration") {
        if (DURATIONS[idx]) { setDraftDuration(DURATIONS[idx]); setStep("tag"); }
      } else if (step === "tag") {
        if (tags[idx]) { setDraftTag(tags[idx].id); setStep("confirm"); }
      } else if (step === "confirm") {
        if (idx === 0) commit();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [step, text, weekDates, draftDate, draftStart, draftDuration, draftTag, tags, onCommit, events]);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (files?.length) { addCapture({ kind: "file", title: files[0].name, dayKey: format(new Date(), "yyyy-MM-dd") }); reset(); }
  }

  const confirmTag = tags.find((t) => t.id === draftTag);

  const inputBorderColor =
    step !== "idle" ? "hsl(var(--border))"
    : detectedType === "event" ? "#7B73D6"
    : detectedType === "task" ? "#3A8A5F"
    : "hsl(var(--border))";

  const typeBadge =
    detectedType === "event" ? { label: "event", bg: "#EBE8FC", color: "#3C3489" }
    : detectedType === "task" ? { label: "task", bg: "#D6F5E8", color: "#1A5C3A" }
    : null;

  return (
    <div
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
      style={{ background: "#F9F9F9", border: "1px solid hsl(var(--border))", borderRadius: 12, padding: 12 }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <span style={{ fontSize: 13, color: "hsl(var(--muted-foreground))", fontWeight: 500 }}>
          what's on your mind?
        </span>
        {typeBadge && text.trim() && (
          <span style={{
            fontSize: 10, fontWeight: 700, letterSpacing: "0.05em",
            background: typeBadge.bg, color: typeBadge.color,
            borderRadius: 20, padding: "2px 8px",
            transition: "all 0.15s",
          }}>
            {typeBadge.label.toUpperCase()}
          </span>
        )}
      </div>

      <Textarea
        ref={inputRef}
        value={text}
        onChange={(e) => handleInput(e.target.value)}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "b") {
            e.preventDefault();
            toggleBold();
            return;
          }
          if (e.key === "Enter" && !e.shiftKey && step === "idle") {
            e.preventDefault();
            startWizard();
          }
        }}
        placeholder={
          step === "idle"
            ? detectedType === "event" ? "add an event — press Enter"
              : detectedType === "task" ? "add a task — press Enter"
              : ""
            : ""
        }
        disabled={step !== "idle"}
        rows={3}
        className="min-h-[88px] resize-none"
        style={{
          width: "100%",
          background: "#fff",
          border: `1.5px solid ${inputBorderColor}`,
          borderRadius: 8,
          padding: "10px 12px",
          fontSize: 15,
          fontWeight: 500,
          color: "hsl(var(--foreground))",
          outline: "none",
          boxSizing: "border-box",
          opacity: step === "idle" ? 1 : 0.7,
          transition: "border-color 0.2s",
        }}
      />

      {step === "idle" && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={toggleBold}
            style={{ borderRadius: 8, border: "1px solid rgba(0,0,0,0.08)", background: "#fff", color: "hsl(var(--foreground))", padding: "4px 8px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}
          >
            Bold
          </button>
          <span style={{ fontSize: 10, color: "hsl(var(--muted-foreground))", fontWeight: 500 }}>
            `Shift+Enter` new line · `Cmd/Ctrl+B` bold
          </span>
        </div>
      )}

      {step !== "idle" && (
        <div style={{
          marginTop: 12,
          background: step.startsWith("task") ? "#EDF9F4" : "#F3F0FE",
          borderRadius: 12,
          padding: 12,
          transition: "background 0.2s",
        }}>
          <p style={{ fontSize: 10, color: step.startsWith("task") ? "#3A8A5F" : "#9D95DC", fontWeight: 700, letterSpacing: "0.06em", marginBottom: 10 }}>
            {step.startsWith("task") ? "TASK SETUP" : "HORIZON IS ASKING"}
          </p>

          {/* LINK PROMPT */}
          {step === "linkPrompt" && (
            <>
              <p style={{ fontSize: 13, color: "#3C3489", fontWeight: 600, marginBottom: 8 }}>Link detected. Save to backpack?</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                <OptionRow label="Yes, save it" sublabel="goes to backpack" selected={false}
                  onClick={() => { addCapture({ kind: "link", title: text.trim(), url: text.trim(), dayKey: format(new Date(), "yyyy-MM-dd") }); reset(); }} />
                <OptionRow label="No, schedule it" sublabel="continue as event" selected={false}
                  onClick={() => { setDraftDate(format(new Date(), "yyyy-MM-dd")); setDraftDuration(guessDuration(text)); setDraftTag(tagForCategory(guessCategory(text))); setStep("type"); }} />
              </div>
            </>
          )}

          {/* TYPE — shown only for ambiguous input */}
          {step === "type" && (
            <>
              <p style={{ fontSize: 13, color: "#3C3489", fontWeight: 600, marginBottom: 8 }}>What is this?</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                <OptionRow label="Event" sublabel="schedule on calendar" selected={false} onClick={() => setStep("day")} />
                <OptionRow label="Task" sublabel="add to task list" selected={false} onClick={() => setStep("taskDay")} />
                <OptionRow label="Thought" sublabel="save to backpack" selected={false}
                  onClick={() => { addCapture({ kind: "thought", title: text.trim(), dayKey: format(new Date(), "yyyy-MM-dd") }); reset(); }} />
              </div>
            </>
          )}

          {/* DAY — week days first, then expandable calendar */}
          {step === "day" && (
            <>
              <p style={{ fontSize: 13, color: "#3C3489", fontWeight: 600, marginBottom: 10 }}>Which day?</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 8 }}>
                {weekDates.map((date) => {
                  const key = format(date, "yyyy-MM-dd");
                  const label = isToday(date) ? "Today" : isTomorrow(date) ? "Tomorrow" : format(date, "EEEE");
                  return (
                    <OptionRow
                      key={key}
                      label={label}
                      sublabel={format(date, "MMM d")}
                      selected={draftDate === key}
                      onClick={() => { setDraftDate(key); setShowCalendar(false); setStep("time"); }}
                    />
                  );
                })}
              </div>
              <button
                onClick={() => setShowCalendar((v) => !v)}
                style={{ fontSize: 11, color: "#9B91E0", background: "none", border: "none", cursor: "pointer", fontWeight: 500, padding: "4px 0", width: "100%", textAlign: "center" }}
              >
                {showCalendar ? "▲ hide calendar" : "▾ pick another date"}
              </button>
              {showCalendar && (
                <div style={{ marginTop: 8 }}>
                  <MiniCalendar
                    selected={draftDate}
                    onSelect={(date) => { setDraftDate(date); setShowCalendar(false); setStep("time"); }}
                  />
                </div>
              )}
            </>
          )}

          {/* TIME — full slot grid */}
          {step === "time" && (
            <>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 8 }}>
                <p style={{ fontSize: 13, color: "#3C3489", fontWeight: 600 }}>When?</p>
                <span style={{ fontSize: 10, color: "#9D95DC" }}>
                  {format(new Date(draftDate + "T00:00:00"), "EEE MMM d")}
                </span>
              </div>
              <TimeSlotGrid
                events={events}
                date={draftDate}
                duration={draftDuration}
                selected={draftStart}
                onSelect={(start) => { setDraftStart(start); setStep("duration"); }}
              />
            </>
          )}

          {/* DURATION */}
          {step === "duration" && (
            <>
              <p style={{ fontSize: 13, color: "#3C3489", fontWeight: 600, marginBottom: 8 }}>How long?</p>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                {DURATIONS.map((d) => (
                  <button key={d} onClick={() => { setDraftDuration(d); setCustomDurText(""); setStep("tag"); }}
                    style={chipStyle(draftDuration === d && !customDurText)}>
                    {durationLabel(d)}
                  </button>
                ))}
              </div>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <input
                  value={customDurText}
                  onChange={(e) => setCustomDurText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      const parsed = parseDuration(customDurText);
                      if (parsed > 0) { setDraftDuration(parsed); setStep("tag"); }
                    }
                  }}
                  placeholder="or type: 90m, 2h, 1h30m…"
                  style={{
                    flex: 1, background: "#fff", border: "1px solid rgba(123,115,214,0.3)",
                    borderRadius: 8, padding: "6px 10px", fontSize: 12, color: "#3C3489",
                    outline: "none", boxSizing: "border-box",
                  }}
                />
                <button
                  onClick={() => {
                    const parsed = parseDuration(customDurText);
                    if (parsed > 0) { setDraftDuration(parsed); setStep("tag"); }
                  }}
                  style={{ background: "#7B73D6", color: "#fff", border: "none", borderRadius: 8, padding: "6px 12px", fontSize: 13, cursor: "pointer", flexShrink: 0 }}
                >
                  →
                </button>
              </div>
            </>
          )}

          {/* TAG */}
          {step === "tag" && (
            <>
              <p style={{ fontSize: 13, color: "#3C3489", fontWeight: 600, marginBottom: 8 }}>Tag?</p>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {tags.map((t) => {
                  const { bg, text: fg } = tagColors(t);
                  const isSelected = draftTag === t.id;
                  return (
                    <button key={t.id} onClick={() => { setDraftTag(t.id); setStep("location"); }}
                      style={{
                        background: bg,
                        color: fg,
                        border: isSelected ? `2px solid ${fg}` : "2px solid transparent",
                        borderRadius: 20, padding: "4px 12px", fontSize: 12, fontWeight: 600,
                        cursor: "pointer", outline: "none",
                        boxShadow: isSelected ? `0 0 0 3px ${bg}99` : "none",
                        transition: "all 0.1s",
                      }}>
                      #{t.name}
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {/* LOCATION */}
          {step === "location" && (
            <>
              <p style={{ fontSize: 13, color: "#3C3489", fontWeight: 600, marginBottom: 8 }}>📍 Where? <span style={{ fontSize: 11, fontWeight: 400, color: "#9B91E0" }}>(optional)</span></p>
              <div style={{ display: "flex", gap: 6 }}>
                <input
                  autoFocus
                  value={draftLocation}
                  onChange={(e) => setDraftLocation(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") setStep("people"); }}
                  placeholder="e.g. Coffee Lab, Zoom, Office…"
                  style={{
                    flex: 1, background: "#fff", border: "1px solid rgba(123,115,214,0.3)",
                    borderRadius: 8, padding: "8px 10px", fontSize: 13, color: "#3C3489",
                    outline: "none", boxSizing: "border-box",
                  }}
                />
                <button
                  onClick={() => setStep("people")}
                  style={{ background: "#7B73D6", color: "#fff", border: "none", borderRadius: 8, padding: "8px 12px", fontSize: 13, fontWeight: 600, cursor: "pointer", flexShrink: 0 }}
                >
                  →
                </button>
              </div>
            </>
          )}

          {/* PEOPLE */}
          {step === "people" && (
            <>
              <p style={{ fontSize: 13, color: "#3C3489", fontWeight: 600, marginBottom: 8 }}>👥 Who's joining? <span style={{ fontSize: 11, fontWeight: 400, color: "#9B91E0" }}>(optional)</span></p>
              <div style={{ display: "flex", gap: 6 }}>
                <input
                  autoFocus
                  value={draftPeople}
                  onChange={(e) => setDraftPeople(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") setStep("confirm"); }}
                  placeholder="e.g. Alice, Bob, the team…"
                  style={{
                    flex: 1, background: "#fff", border: "1px solid rgba(123,115,214,0.3)",
                    borderRadius: 8, padding: "8px 10px", fontSize: 13, color: "#3C3489",
                    outline: "none", boxSizing: "border-box",
                  }}
                />
                <button
                  onClick={() => setStep("confirm")}
                  style={{ background: "#7B73D6", color: "#fff", border: "none", borderRadius: 8, padding: "8px 12px", fontSize: 13, fontWeight: 600, cursor: "pointer", flexShrink: 0 }}
                >
                  →
                </button>
              </div>
            </>
          )}

          {/* CONFIRM */}
          {step === "confirm" && (
            <>
              <p style={{ fontSize: 13, color: "#3C3489", fontWeight: 600, marginBottom: 8 }}>Ready to add?</p>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
                <span style={chipStyle(false)}>{format(new Date(draftDate + "T00:00:00"), "EEE MMM d")}</span>
                <span style={chipStyle(false)}>{minutesToLabel(draftStart || suggestStart(events, draftDate, draftDuration))}</span>
                <span style={chipStyle(false)}>{durationLabel(draftDuration)}</span>
                {confirmTag ? (
                  <span style={{ background: tagColors(confirmTag).bg, color: tagColors(confirmTag).text, borderRadius: 20, padding: "4px 10px", fontSize: 12, fontWeight: 600 }}>
                    #{confirmTag.name}
                  </span>
                ) : (
                  <span style={chipStyle(false)}>#{draftTag}</span>
                )}
                {draftLocation.trim() && (
                  <span style={chipStyle(false)}>📍 {draftLocation.trim()}</span>
                )}
                {draftPeople.trim() && (
                  <span style={chipStyle(false)}>👥 {draftPeople.trim()}</span>
                )}
              </div>
              {/* Show conflict warning in confirm too */}
              {draftStart > 0 && findConflicts(events, draftDate, draftStart, draftDuration).length > 0 && (
                <div style={{ marginBottom: 10, padding: "6px 10px", background: "#FFF3DC", borderRadius: 8, border: "1px solid #F5A524", fontSize: 11, color: "#7A4000", fontWeight: 500 }}>
                  ⚠ This time overlaps with an existing event
                </div>
              )}
              <button onClick={commit}
                style={{ width: "100%", background: "#7B73D6", color: "#fff", border: "none", borderRadius: 8, padding: "9px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                Add to Calendar ↵
              </button>
            </>
          )}

          {/* TASK DAY */}
          {step === "taskDay" && (
            <>
              <p style={{ fontSize: 13, color: "#1A5C3A", fontWeight: 600, marginBottom: 10 }}>Which day for this task?</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 8 }}>
                {weekDates.map((date) => {
                  const key = format(date, "yyyy-MM-dd");
                  const label = isToday(date) ? "Today" : isTomorrow(date) ? "Tomorrow" : format(date, "EEEE");
                  return (
                    <OptionRow
                      key={key}
                      label={label}
                      sublabel={format(date, "MMM d")}
                      selected={draftDate === key}
                      onClick={() => { setDraftDate(key); setShowCalendar(false); setStep("taskTag"); }}
                    />
                  );
                })}
              </div>
              <button
                onClick={() => setShowCalendar((v) => !v)}
                style={{ fontSize: 11, color: "#3A8A5F", background: "none", border: "none", cursor: "pointer", fontWeight: 500, padding: "4px 0", width: "100%", textAlign: "center" }}
              >
                {showCalendar ? "▲ hide calendar" : "▾ pick another date"}
              </button>
              {showCalendar && (
                <div style={{ marginTop: 8 }}>
                  <MiniCalendar
                    selected={draftDate}
                    onSelect={(date) => { setDraftDate(date); setShowCalendar(false); setStep("taskTag"); }}
                  />
                </div>
              )}
            </>
          )}

          {/* TASK TAG */}
          {step === "taskTag" && (
            <>
              <p style={{ fontSize: 13, color: "#1A5C3A", fontWeight: 600, marginBottom: 8 }}>Tag? <span style={{ fontSize: 11, fontWeight: 400, color: "#3A8A5F" }}>(optional)</span></p>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                {tags.map((t) => {
                  const { bg, text: fg } = tagColors(t);
                  const isSelected = draftTag === t.id;
                  return (
                    <button key={t.id} onClick={() => { setDraftTag(t.id); setStep("taskConfirm"); }}
                      style={{
                        background: bg, color: fg,
                        border: isSelected ? `2px solid ${fg}` : "2px solid transparent",
                        borderRadius: 20, padding: "4px 12px", fontSize: 12, fontWeight: 600,
                        cursor: "pointer", outline: "none",
                        boxShadow: isSelected ? `0 0 0 3px ${bg}99` : "none",
                        transition: "all 0.1s",
                      }}>
                      #{t.name}
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {/* TASK CONFIRM */}
          {step === "taskConfirm" && (
            <>
              <p style={{ fontSize: 13, color: "#1A5C3A", fontWeight: 600, marginBottom: 8 }}>Add this task?</p>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
                <span style={{ background: "#D6F5E8", color: "#1A5C3A", borderRadius: 20, padding: "4px 10px", fontSize: 12, fontWeight: 600 }}>
                  task
                </span>
                <span style={chipStyle(false)}>{format(new Date(draftDate + "T00:00:00"), "EEE MMM d")}</span>
                {draftTag && tags.find((t) => t.id === draftTag) && (() => {
                  const t = tags.find((t) => t.id === draftTag)!;
                  return (
                    <span style={{ background: tagColors(t).bg, color: tagColors(t).text, borderRadius: 20, padding: "4px 10px", fontSize: 12, fontWeight: 600 }}>
                      #{t.name}
                    </span>
                  );
                })()}
              </div>
              <button onClick={commitTask}
                style={{ width: "100%", background: "#3A8A5F", color: "#fff", border: "none", borderRadius: 8, padding: "9px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                Add Task ↵
              </button>
            </>
          )}

          {/* Back / Skip nav */}
          {(() => {
            const isTaskFlow = step.startsWith("task");
            const navColor = isTaskFlow ? "#3A8A5F" : "#9B91E0";
            const borderColor = isTaskFlow ? "rgba(58,138,95,0.2)" : "rgba(123,115,214,0.2)";
            return (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10, paddingTop: 8, borderTop: `1px solid ${borderColor}` }}>
                <button onClick={goBack}
                  style={{ fontSize: 11, color: navColor, background: "none", border: "none", cursor: "pointer", fontWeight: 500, padding: 0 }}>
                  ← back
                </button>
                {SKIPPABLE.includes(step) && (
                  <button onClick={skipStep}
                    style={{ fontSize: 11, color: navColor, background: "none", border: "none", cursor: "pointer", fontWeight: 500, padding: 0 }}>
                    skip →
                  </button>
                )}
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}

function OptionRow({ label, sublabel, selected, onClick }: { label: string; sublabel: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "9px 12px",
        borderRadius: 10,
        width: "100%",
        textAlign: "left",
        background: selected ? "#3C3489" : "rgba(255,255,255,0.75)",
        color: selected ? "#fff" : "#3C3489",
        border: `1.5px solid ${selected ? "#3C3489" : "rgba(123,115,214,0.22)"}`,
        cursor: "pointer",
        fontSize: 13,
        transition: "all 0.1s",
        boxSizing: "border-box",
      }}
    >
      <span style={{ fontWeight: 600 }}>{label}</span>
      <span style={{ fontSize: 11, opacity: 0.6, fontWeight: 400 }}>{sublabel}</span>
    </button>
  );
}

function chipStyle(active: boolean) {
  return {
    background: active ? "#3C3489" : "#C5BEF5",
    color: active ? "#fff" : "#3C3489",
    border: "none",
    borderRadius: 20,
    padding: "4px 10px",
    fontSize: 12,
    fontWeight: 500,
    cursor: "pointer",
  } as const;
}
