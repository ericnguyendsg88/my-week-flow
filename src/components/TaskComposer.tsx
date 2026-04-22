import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { format } from "date-fns";
import {
  Sparkles,
  MapPin,
  Users,
  Clock,
  Calendar as CalIcon,
  Tag,
  ArrowLeft,
  CornerDownLeft,
  MousePointerClick,
} from "lucide-react";
import { CalEvent, Category, CATEGORIES, DURATIONS } from "@/types/event";
import { getCategoryClasses } from "./CategoryPicker";
import {
  durationLabel,
  findConflicts,
  guessCategory,
  guessDuration,
  minutesToLabel,
  suggestStart,
} from "@/lib/event-utils";
import { cn } from "@/lib/utils";

interface Props {
  weekDates: Date[];
  events: CalEvent[];
  onCommit: (e: CalEvent) => void;
  /** Slot picked on the calendar grid (date + minutes since midnight). */
  pickedSlot?: { date: string; start: number } | null;
  /** Called when composer enters / exits "pick on calendar" mode. */
  onSlotPickModeChange?: (active: boolean) => void;
  /** Clear the picked slot from parent after consuming it. */
  onConsumePickedSlot?: () => void;
}

type Step = "title" | "category" | "day" | "duration" | "time" | "where" | "who" | "confirm";

const STEPS: Step[] = ["title", "category", "day", "duration", "time", "where", "who", "confirm"];

interface Draft {
  title: string;
  category: Category;
  date: string;
  start: number;
  duration: number;
  where?: string;
  who?: string;
}

export function TaskComposer({
  weekDates,
  events,
  onCommit,
  pickedSlot,
  onSlotPickModeChange,
  onConsumePickedSlot,
}: Props) {
  const [step, setStep] = useState<Step>("title");
  const [text, setText] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [whereText, setWhereText] = useState("");
  const [whoText, setWhoText] = useState("");
  const [pickMode, setPickMode] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus the right input on every step change
  useEffect(() => {
    const id = setTimeout(() => inputRef.current?.focus(), 30);
    return () => clearTimeout(id);
  }, [step]);

  // Tell parent when slot-pick mode toggles
  useEffect(() => {
    onSlotPickModeChange?.(pickMode);
  }, [pickMode, onSlotPickModeChange]);

  // Consume slot from calendar pick
  useEffect(() => {
    if (pickedSlot && draft && pickMode) {
      setDraft({ ...draft, date: pickedSlot.date, start: pickedSlot.start });
      setPickMode(false);
      onConsumePickedSlot?.();
      goNext("time");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickedSlot]);

  const conflicts = useMemo(() => {
    if (!draft) return [];
    return findConflicts(events, draft.date, draft.start, draft.duration);
  }, [draft, events]);

  function goNext(from: Step) {
    const idx = STEPS.indexOf(from);
    setStep(STEPS[Math.min(STEPS.length - 1, idx + 1)]);
  }
  function goBack() {
    const idx = STEPS.indexOf(step);
    if (idx <= 0) return;
    setStep(STEPS[idx - 1]);
  }

  function startWizard() {
    if (!text.trim()) return;
    const category = guessCategory(text);
    const duration = guessDuration(text);
    const date = format(weekDates[0], "yyyy-MM-dd");
    const start = suggestStart(events, date, duration);
    setDraft({ title: text.trim(), category, date, start, duration });
    setStep("category");
  }

  function reset() {
    setText("");
    setDraft(null);
    setWhereText("");
    setWhoText("");
    setPickMode(false);
    setStep("title");
  }

  function commit() {
    if (!draft) return;
    onCommit({
      ...draft,
      where: whereText || draft.where,
      who: whoText || draft.who,
      id: crypto.randomUUID(),
    });
    reset();
  }

  return (
    <div className="flex h-full flex-col rounded-bubble bg-card p-5 shadow-bubble ring-1 ring-border">
      {/* Header strip */}
      <div className="mb-4 flex items-center justify-between">
        <StepCrumbs current={step} />
        {step !== "title" && (
          <button
            onClick={goBack}
            className="flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-bold text-muted-foreground hover:bg-muted"
          >
            <ArrowLeft className="h-3 w-3" /> Back
          </button>
        )}
      </div>

      {/* Active draft chip */}
      {draft && step !== "title" && (
        <DraftChip draft={draft} />
      )}

      {/* Step body — fills remaining column */}
      <div className="relative flex-1 overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ type: "spring", stiffness: 360, damping: 30 }}
            className="absolute inset-0 flex flex-col"
          >
            {step === "title" && (
              <TitleStep
                inputRef={inputRef}
                value={text}
                onChange={setText}
                onSubmit={startWizard}
              />
            )}

            {step === "category" && draft && (
              <CategoryStep
                inputRef={inputRef}
                draft={draft}
                onPick={(c) => {
                  setDraft({ ...draft, category: c });
                  goNext("category");
                }}
                onSkip={() => goNext("category")}
              />
            )}

            {step === "day" && draft && (
              <DayStep
                inputRef={inputRef}
                draft={draft}
                weekDates={weekDates}
                events={events}
                onPick={(d) => {
                  const newStart = suggestStart([], d, draft.duration, draft.start);
                  setDraft({ ...draft, date: d, start: newStart });
                  goNext("day");
                }}
                onPickOnCalendar={() => setPickMode(true)}
                pickMode={pickMode}
                onSkip={() => goNext("day")}
              />
            )}

            {step === "duration" && draft && (
              <DurationStep
                inputRef={inputRef}
                draft={draft}
                onPick={(d) => {
                  setDraft({ ...draft, duration: d });
                  goNext("duration");
                }}
                onSkip={() => goNext("duration")}
              />
            )}

            {step === "time" && draft && (
              <TimeStep
                inputRef={inputRef}
                draft={draft}
                onPick={(t) => {
                  setDraft({ ...draft, start: t });
                  goNext("time");
                }}
                onPickOnCalendar={() => setPickMode(true)}
                pickMode={pickMode}
                onSkip={() => goNext("time")}
              />
            )}

            {step === "where" && draft && (
              <TextStep
                inputRef={inputRef}
                icon={<MapPin className="h-5 w-5" />}
                title="Where?"
                hint="Type a place — or press S to skip"
                value={whereText}
                onChange={setWhereText}
                onSubmit={() => goNext("where")}
                onSkip={() => goNext("where")}
              />
            )}

            {step === "who" && draft && (
              <TextStep
                inputRef={inputRef}
                icon={<Users className="h-5 w-5" />}
                title="With who?"
                hint="Type a name — or press S to skip"
                value={whoText}
                onChange={setWhoText}
                onSubmit={() => goNext("who")}
                onSkip={() => goNext("who")}
              />
            )}

            {step === "confirm" && draft && (
              <ConfirmStep
                inputRef={inputRef}
                draft={{ ...draft, where: whereText || draft.where, who: whoText || draft.who }}
                conflicts={conflicts}
                onCommit={commit}
                onCancel={reset}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Footer keyboard hints */}
      <KeyboardHints step={step} />
    </div>
  );
}

/* ---------------- Step components ---------------- */

function TitleStep({
  inputRef,
  value,
  onChange,
  onSubmit,
}: {
  inputRef: React.RefObject<HTMLInputElement>;
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
}) {
  return (
    <div className="flex h-full flex-col justify-center">
      <div className="mb-6 flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-primary" />
        <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
          What's on your mind?
        </span>
      </div>
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && onSubmit()}
        placeholder="lunch with Sarah tomorrow…"
        className="w-full bg-transparent font-display text-3xl font-extrabold tracking-tight outline-none placeholder:text-muted-foreground/40"
      />
      <div className="mt-3 h-[3px] w-12 rounded-full bg-gradient-primary" />
      <p className="mt-6 max-w-sm text-xs font-medium text-muted-foreground">
        Just type the thought. We'll walk through type, day, duration & time —
        one keystroke at a time.
      </p>
    </div>
  );
}

function StepShell({
  icon,
  title,
  subtitle,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="mb-5">
        <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
          {icon}
          {subtitle ?? "Pick one"}
        </div>
        <h3 className="font-display text-2xl font-extrabold tracking-tight">{title}</h3>
      </div>
      <div className="flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}

function NumberedOption({
  index,
  label,
  sublabel,
  swatch,
  active,
  onClick,
}: {
  index: number | string;
  label: string;
  sublabel?: string;
  swatch?: React.ReactNode;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.98 }}
      whileHover={{ x: 2 }}
      onClick={onClick}
      className={cn(
        "group flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-all",
        active
          ? "bg-foreground text-background shadow-bubble"
          : "bg-muted/60 text-foreground hover:bg-muted"
      )}
    >
      <span
        className={cn(
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-xl font-mono text-xs font-bold",
          active
            ? "bg-background/20 text-background"
            : "bg-card text-muted-foreground ring-1 ring-border group-hover:text-foreground"
        )}
      >
        {index}
      </span>
      {swatch}
      <span className="flex-1">
        <span className="block text-sm font-bold leading-tight">{label}</span>
        {sublabel && (
          <span
            className={cn(
              "mt-0.5 block text-[11px] font-medium",
              active ? "text-background/70" : "text-muted-foreground"
            )}
          >
            {sublabel}
          </span>
        )}
      </span>
    </motion.button>
  );
}

function useNumberKeys(onNumber: (n: number) => void, onSkip: () => void, onBack?: () => void) {
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      // Ignore when typing inside a real text input
      const tag = (e.target as HTMLElement)?.tagName;
      const editable = tag === "INPUT" || tag === "TEXTAREA";
      if (editable) return;
      if (/^[1-9]$/.test(e.key)) {
        e.preventDefault();
        onNumber(parseInt(e.key));
      } else if (e.key.toLowerCase() === "s") {
        e.preventDefault();
        onSkip();
      } else if (e.key === "Escape" || e.key.toLowerCase() === "b") {
        if (onBack) {
          e.preventDefault();
          onBack();
        }
      }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onNumber, onSkip, onBack]);
}

function CategoryStep({
  draft,
  onPick,
  onSkip,
  inputRef,
}: {
  draft: Draft;
  onPick: (c: Category) => void;
  onSkip: () => void;
  inputRef: React.RefObject<HTMLInputElement>;
}) {
  useNumberKeys(
    (n) => {
      const c = CATEGORIES[n - 1];
      if (c) onPick(c.id);
    },
    onSkip
  );
  return (
    <StepShell icon={<Tag className="h-3.5 w-3.5" />} title="What kind of thing?" subtitle="Type">
      {/* hidden focus target so global keys feel snappy */}
      <input ref={inputRef} className="sr-only" aria-hidden tabIndex={-1} />
      <div className="flex flex-col gap-1.5">
        {CATEGORIES.map((c, i) => {
          const cls = getCategoryClasses(c.id);
          return (
            <NumberedOption
              key={c.id}
              index={i + 1}
              label={`${c.emoji}  ${c.label}`}
              sublabel={c.id === draft.category ? "Suggested from your text" : undefined}
              active={draft.category === c.id}
              swatch={<span className={cn("h-2.5 w-2.5 rounded-full", cls.solid)} />}
              onClick={() => onPick(c.id)}
            />
          );
        })}
      </div>
    </StepShell>
  );
}

function DayStep({
  draft,
  weekDates,
  events,
  onPick,
  onPickOnCalendar,
  pickMode,
  onSkip,
  inputRef,
}: {
  draft: Draft;
  weekDates: Date[];
  events: CalEvent[];
  onPick: (date: string) => void;
  onPickOnCalendar: () => void;
  pickMode: boolean;
  onSkip: () => void;
  inputRef: React.RefObject<HTMLInputElement>;
}) {
  useNumberKeys(
    (n) => {
      const d = weekDates[n - 1];
      if (d) onPick(format(d, "yyyy-MM-dd"));
    },
    onSkip
  );
  return (
    <StepShell icon={<CalIcon className="h-3.5 w-3.5" />} title="Which day?" subtitle="When">
      <input ref={inputRef} className="sr-only" aria-hidden tabIndex={-1} />
      <div className="flex flex-col gap-1.5">
        {weekDates.map((d, i) => {
          const key = format(d, "yyyy-MM-dd");
          const count = events.filter((e) => e.date === key).length;
          return (
            <NumberedOption
              key={key}
              index={i + 1}
              label={format(d, "EEEE, MMM d")}
              sublabel={count ? `${count} event${count > 1 ? "s" : ""} already` : "Wide open"}
              active={draft.date === key}
              onClick={() => onPick(key)}
            />
          );
        })}
        <PickOnCalendarButton active={pickMode} onClick={onPickOnCalendar} />
      </div>
    </StepShell>
  );
}

function DurationStep({
  draft,
  onPick,
  onSkip,
  inputRef,
}: {
  draft: Draft;
  onPick: (d: number) => void;
  onSkip: () => void;
  inputRef: React.RefObject<HTMLInputElement>;
}) {
  useNumberKeys(
    (n) => {
      const d = DURATIONS[n - 1];
      if (d) onPick(d);
    },
    onSkip
  );
  return (
    <StepShell icon={<Clock className="h-3.5 w-3.5" />} title="How long?" subtitle="Duration">
      <input ref={inputRef} className="sr-only" aria-hidden tabIndex={-1} />
      <div className="flex flex-col gap-1.5">
        {DURATIONS.map((d, i) => (
          <NumberedOption
            key={d}
            index={i + 1}
            label={durationLabel(d)}
            sublabel={d === draft.duration ? "Suggested" : undefined}
            active={draft.duration === d}
            onClick={() => onPick(d)}
          />
        ))}
      </div>
    </StepShell>
  );
}

function TimeStep({
  draft,
  onPick,
  onPickOnCalendar,
  pickMode,
  onSkip,
  inputRef,
}: {
  draft: Draft;
  onPick: (t: number) => void;
  onPickOnCalendar: () => void;
  pickMode: boolean;
  onSkip: () => void;
  inputRef: React.RefObject<HTMLInputElement>;
}) {
  // Build 4 smart suggestions around the current draft.start
  const suggestions = useMemo(() => {
    const base = [draft.start, 9 * 60, 13 * 60, 16 * 60];
    return Array.from(new Set(base)).slice(0, 4);
  }, [draft.start]);

  useNumberKeys(
    (n) => {
      const s = suggestions[n - 1];
      if (s != null) onPick(s);
    },
    onSkip
  );

  return (
    <StepShell icon={<Clock className="h-3.5 w-3.5" />} title="What time?" subtitle="Start">
      <input ref={inputRef} className="sr-only" aria-hidden tabIndex={-1} />
      <div className="flex flex-col gap-1.5">
        {suggestions.map((s, i) => (
          <NumberedOption
            key={s}
            index={i + 1}
            label={minutesToLabel(s)}
            sublabel={
              i === 0 ? "Suggested" : `${minutesToLabel(s)} – ${minutesToLabel(s + draft.duration)}`
            }
            active={draft.start === s}
            onClick={() => onPick(s)}
          />
        ))}
        <PickOnCalendarButton active={pickMode} onClick={onPickOnCalendar} />
      </div>
    </StepShell>
  );
}

function PickOnCalendarButton({ active, onClick }: { active: boolean; onClick: () => void }) {
  return (
    <motion.button
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={cn(
        "mt-1 flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left ring-1 transition-all",
        active
          ? "bg-primary/10 text-primary ring-primary/40"
          : "bg-transparent text-muted-foreground ring-dashed ring-border hover:bg-muted/50"
      )}
      style={{ borderStyle: "dashed" }}
    >
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-card font-mono text-xs font-bold ring-1 ring-border">
        C
      </span>
      <MousePointerClick className="h-4 w-4" />
      <span className="flex-1">
        <span className="block text-sm font-bold leading-tight">
          {active ? "Click any slot on the calendar →" : "Pick on the calendar"}
        </span>
        <span className="mt-0.5 block text-[11px] font-medium">
          {active ? "Waiting for your click" : "Use the grid on the right"}
        </span>
      </span>
    </motion.button>
  );
}

function TextStep({
  inputRef,
  icon,
  title,
  hint,
  value,
  onChange,
  onSubmit,
  onSkip,
}: {
  inputRef: React.RefObject<HTMLInputElement>;
  icon: React.ReactNode;
  title: string;
  hint: string;
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  onSkip: () => void;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="mb-5 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
        {icon}
        Optional
      </div>
      <h3 className="mb-4 font-display text-2xl font-extrabold tracking-tight">{title}</h3>
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") onSubmit();
          if (!value && e.key.toLowerCase() === "s") onSkip();
        }}
        placeholder={title.replace("?", "…")}
        className="w-full bg-transparent text-2xl font-bold outline-none placeholder:text-muted-foreground/40"
      />
      <div className="mt-3 h-[3px] w-12 rounded-full bg-gradient-primary" />
      <p className="mt-5 text-xs font-medium text-muted-foreground">{hint}</p>
    </div>
  );
}

function ConfirmStep({
  draft,
  conflicts,
  onCommit,
  onCancel,
  inputRef,
}: {
  draft: Draft;
  conflicts: CalEvent[];
  onCommit: () => void;
  onCancel: () => void;
  inputRef: React.RefObject<HTMLInputElement>;
}) {
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      const editable = tag === "INPUT" || tag === "TEXTAREA";
      if (editable) return;
      if (e.key === "Enter") onCommit();
      if (e.key.toLowerCase() === "x") onCancel();
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onCommit, onCancel]);

  const cls = getCategoryClasses(draft.category);
  return (
    <div className="flex h-full flex-col">
      <input ref={inputRef} className="sr-only" aria-hidden tabIndex={-1} />
      <div className="mb-4 text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
        Looks good?
      </div>

      <div className={cn("rounded-2xl px-4 py-3 ring-1", cls.bg, cls.ring)}>
        <p className={cn("text-base font-extrabold", cls.text)}>{draft.title}</p>
        <p className="mt-1 text-[11px] font-semibold text-foreground/70">
          {format(new Date(draft.date + "T00:00:00"), "EEE MMM d")} ·{" "}
          {minutesToLabel(draft.start)} – {minutesToLabel(draft.start + draft.duration)} ·{" "}
          {durationLabel(draft.duration)}
        </p>
        {(draft.where || draft.who) && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {draft.where && (
              <span className="flex items-center gap-1 rounded-full bg-card/80 px-2 py-0.5 text-[10px] font-bold">
                <MapPin className="h-3 w-3" /> {draft.where}
              </span>
            )}
            {draft.who && (
              <span className="flex items-center gap-1 rounded-full bg-card/80 px-2 py-0.5 text-[10px] font-bold">
                <Users className="h-3 w-3" /> {draft.who}
              </span>
            )}
          </div>
        )}
      </div>

      {conflicts.length > 0 && (
        <div className="mt-3 rounded-2xl bg-destructive/10 px-3 py-2 text-xs font-semibold text-destructive ring-1 ring-destructive/20">
          ⚠ Conflicts with{" "}
          <span className="font-extrabold">{conflicts.map((c) => c.title).join(", ")}</span>
        </div>
      )}

      <div className="mt-auto flex gap-2 pt-4">
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={onCancel}
          className="rounded-2xl bg-muted px-4 py-3 text-sm font-bold text-muted-foreground hover:bg-muted/70"
        >
          Cancel · X
        </motion.button>
        <motion.button
          whileTap={{ scale: 0.97 }}
          whileHover={{ y: -1 }}
          onClick={onCommit}
          className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-primary px-4 py-3 text-sm font-extrabold text-primary-foreground shadow-bubble"
        >
          <Sparkles className="h-4 w-4" />
          Add to calendar
          <CornerDownLeft className="ml-1 h-4 w-4 opacity-70" />
        </motion.button>
      </div>
    </div>
  );
}

/* ---------------- Chrome ---------------- */

function StepCrumbs({ current }: { current: Step }) {
  const order: { id: Step; label: string }[] = [
    { id: "title", label: "Idea" },
    { id: "category", label: "Type" },
    { id: "day", label: "Day" },
    { id: "duration", label: "Length" },
    { id: "time", label: "Time" },
    { id: "where", label: "Where" },
    { id: "who", label: "Who" },
    { id: "confirm", label: "Done" },
  ];
  const idx = order.findIndex((s) => s.id === current);
  return (
    <div className="flex items-center gap-1">
      {order.map((s, i) => (
        <div key={s.id} className="flex items-center gap-1">
          <span
            className={cn(
              "h-1.5 rounded-full transition-all",
              i < idx ? "w-3 bg-primary" : i === idx ? "w-6 bg-foreground" : "w-1.5 bg-muted"
            )}
          />
        </div>
      ))}
      <span className="ml-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        {order[idx]?.label}
      </span>
    </div>
  );
}

function DraftChip({ draft }: { draft: Draft }) {
  const cls = getCategoryClasses(draft.category);
  return (
    <div className={cn("mb-4 rounded-2xl px-3 py-2 ring-1", cls.bg, cls.ring)}>
      <p className={cn("truncate text-sm font-extrabold", cls.text)}>{draft.title}</p>
      <p className="text-[10px] font-semibold text-foreground/60">
        {format(new Date(draft.date + "T00:00:00"), "EEE MMM d")} · {minutesToLabel(draft.start)} ·{" "}
        {durationLabel(draft.duration)}
      </p>
    </div>
  );
}

function KeyboardHints({ step }: { step: Step }) {
  const hints =
    step === "title"
      ? [["⏎", "Continue"]]
      : step === "confirm"
      ? [
          ["⏎", "Add"],
          ["X", "Cancel"],
          ["B", "Back"],
        ]
      : step === "where" || step === "who"
      ? [
          ["⏎", "Next"],
          ["S", "Skip"],
          ["B", "Back"],
        ]
      : [
          ["1–9", "Pick"],
          ["S", "Skip"],
          ["B", "Back"],
        ];
  return (
    <div className="mt-4 flex flex-wrap items-center gap-1.5 border-t border-border/60 pt-3">
      {hints.map(([k, l]) => (
        <span
          key={k}
          className="flex items-center gap-1 rounded-full bg-muted/60 px-2 py-0.5 text-[10px] font-semibold text-muted-foreground"
        >
          <kbd className="rounded bg-card px-1 font-mono text-[10px] font-bold ring-1 ring-border">
            {k}
          </kbd>
          {l}
        </span>
      ))}
    </div>
  );
}
