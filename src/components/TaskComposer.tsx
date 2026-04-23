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
} from "date-fns";
import { CalEvent, Tag, DURATIONS } from "@/types/event";
import {
  guessCategory,
  guessDuration,
  suggestStart,
  durationLabel,
  minutesToLabel,
  findConflicts,
} from "@/lib/event-utils";
import { tagForCategory } from "@/lib/tags";
import { addCapture } from "@/lib/capture-store";

type Step = "idle" | "linkPrompt" | "type" | "day" | "time" | "duration" | "tag" | "location" | "people" | "confirm";

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
};

const SKIPPABLE: Step[] = ["day", "time", "duration", "tag", "location", "people"];

export function TaskComposer({ weekDates, events, tags, onCommit, prefill }: Props) {
  const [text, setText] = useState("");
  const [step, setStep] = useState<Step>("idle");
  const inputRef = useRef<HTMLInputElement>(null);
  const [showCalendar, setShowCalendar] = useState(false);
  const [draftDate, setDraftDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [draftStart, setDraftStart] = useState(0);
  const [draftDuration, setDraftDuration] = useState(30);
  const [draftTag, setDraftTag] = useState("");
  const [draftLocation, setDraftLocation] = useState("");
  const [draftPeople, setDraftPeople] = useState("");
  const [customDurText, setCustomDurText] = useState("");

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
  }

  function handleInput(val: string) {
    setText(val);
    if (step !== "idle") setStep("idle");
  }

  function startWizard() {
    if (!text.trim()) return;
    if (URL_REGEX.test(text.trim())) { setStep("linkPrompt"); return; }
    setDraftDate(format(new Date(), "yyyy-MM-dd"));
    setDraftDuration(guessDuration(text));
    setDraftTag(tagForCategory(guessCategory(text)));
    setStep("type");
  }

  function commit() {
    const start = draftStart || suggestStart(events, draftDate, draftDuration);
    onCommit({
      id: crypto.randomUUID(),
      title: text.trim(),
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

  // Keyboard shortcuts
  useEffect(() => {
    if (step === "idle") return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") { goBack(); return; }
      if (e.key === "Tab") { e.preventDefault(); if (SKIPPABLE.includes(step)) skipStep(); return; }
      if (e.key === "Enter" && step === "confirm") { commit(); return; }

      const num = parseInt(e.key);
      if (isNaN(num) || num < 1) return;
      const idx = num - 1;

      if (step === "linkPrompt") {
        if (idx === 0) { addCapture({ kind: "link", title: text.trim(), url: text.trim(), dayKey: format(new Date(), "yyyy-MM-dd") }); reset(); }
        if (idx === 1) { setDraftDate(format(new Date(), "yyyy-MM-dd")); setDraftDuration(guessDuration(text)); setDraftTag(tagForCategory(guessCategory(text))); setStep("type"); }
      } else if (step === "type") {
        if (idx === 0) setStep("day");
        if (idx === 1) { addCapture({ kind: "thought", title: text.trim(), dayKey: format(new Date(), "yyyy-MM-dd") }); reset(); }
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

  return (
    <div
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
      style={{ background: "#F9F9F9", border: "1px solid hsl(var(--border))", borderRadius: 12, padding: 12 }}
    >
      <div style={{ fontSize: 13, color: "hsl(var(--muted-foreground))", fontWeight: 500, marginBottom: 8 }}>
        what's on your mind?
      </div>

      <input
        ref={inputRef}
        value={text}
        onChange={(e) => handleInput(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" && step === "idle") startWizard(); }}
        placeholder=""
        disabled={step !== "idle"}
        style={{
          width: "100%",
          background: "#fff",
          border: "1px solid hsl(var(--border))",
          borderRadius: 8,
          padding: "10px 12px",
          fontSize: 15,
          fontWeight: 500,
          color: "hsl(var(--foreground))",
          outline: "none",
          boxSizing: "border-box",
          opacity: step === "idle" ? 1 : 0.7,
        }}
      />

      {step !== "idle" && (
        <div style={{ marginTop: 12, background: "#F3F0FE", borderRadius: 12, padding: 12 }}>
          <p style={{ fontSize: 10, color: "#9D95DC", fontWeight: 700, letterSpacing: "0.06em", marginBottom: 10 }}>
            HORIZON IS ASKING
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

          {/* TYPE */}
          {step === "type" && (
            <>
              <p style={{ fontSize: 13, color: "#3C3489", fontWeight: 600, marginBottom: 8 }}>What kind of thing?</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                <OptionRow label="Event" sublabel="add to calendar" selected={false} onClick={() => setStep("day")} />
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
                  return (
                    <OptionRow
                      key={key}
                      label={format(date, "EEEE")}
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

          {/* Back / Skip nav */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10, paddingTop: 8, borderTop: "1px solid rgba(123,115,214,0.2)" }}>
            <button onClick={goBack}
              style={{ fontSize: 11, color: "#9B91E0", background: "none", border: "none", cursor: "pointer", fontWeight: 500, padding: 0 }}>
              ← back
            </button>
            {SKIPPABLE.includes(step) && (
              <button onClick={skipStep}
                style={{ fontSize: 11, color: "#9B91E0", background: "none", border: "none", cursor: "pointer", fontWeight: 500, padding: 0 }}>
                skip →
              </button>
            )}
          </div>
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
