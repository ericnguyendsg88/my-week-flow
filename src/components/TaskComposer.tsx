import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { format } from "date-fns";
import { Sparkles, Send, MapPin, Users, Clock, Calendar as CalIcon, X } from "lucide-react";
import { CalEvent, Category, DURATIONS } from "@/types/event";
import { CategoryPicker, getCategoryClasses } from "./CategoryPicker";
import {
  durationLabel,
  findConflicts,
  guessCategory,
  guessDuration,
  minutesToLabel,
  roundTo15,
  suggestStart,
} from "@/lib/event-utils";
import { cn } from "@/lib/utils";

interface Props {
  weekDates: Date[];
  events: CalEvent[];
  onCommit: (e: CalEvent) => void;
}

type Step = "title" | "refine";

export function TaskComposer({ weekDates, events, onCommit }: Props) {
  const [text, setText] = useState("");
  const [step, setStep] = useState<Step>("title");
  const [draft, setDraft] = useState<Omit<CalEvent, "id"> | null>(null);
  const [who, setWho] = useState("");
  const [where, setWhere] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, [step]);

  const conflicts = useMemo(() => {
    if (!draft) return [];
    return findConflicts(events, draft.date, draft.start, draft.duration);
  }, [draft, events]);

  function startRefine() {
    if (!text.trim()) return;
    const category = guessCategory(text);
    const duration = guessDuration(text);
    const date = format(weekDates[0], "yyyy-MM-dd");
    const start = suggestStart(events, date, duration);
    setDraft({ title: text.trim(), category, date, start, duration });
    setStep("refine");
  }

  function commit() {
    if (!draft) return;
    onCommit({ ...draft, where: where || undefined, who: who || undefined, id: crypto.randomUUID() });
    setText("");
    setWho("");
    setWhere("");
    setDraft(null);
    setStep("title");
  }

  function cancel() {
    setDraft(null);
    setStep("title");
  }

  return (
    <div className="relative">
      <AnimatePresence mode="wait">
        {step === "title" ? (
          <motion.div
            key="title"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="flex items-center gap-2 rounded-bubble bg-card px-4 py-3 shadow-bubble ring-1 ring-border"
          >
            <Sparkles className="h-5 w-5 shrink-0 text-primary" />
            <input
              ref={inputRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && startRefine()}
              placeholder="Type anything… ‘lunch with Sarah tomorrow’"
              className="flex-1 bg-transparent text-sm font-medium outline-none placeholder:text-muted-foreground/70"
            />
            <motion.button
              whileTap={{ scale: 0.9 }}
              whileHover={{ scale: 1.05 }}
              onClick={startRefine}
              disabled={!text.trim()}
              className="rounded-full bg-gradient-primary p-2 text-primary-foreground shadow-bubble disabled:opacity-40"
            >
              <Send className="h-4 w-4" />
            </motion.button>
          </motion.div>
        ) : (
          <RefinePanel
            key="refine"
            draft={draft!}
            setDraft={(d) => setDraft(d)}
            weekDates={weekDates}
            who={who}
            setWho={setWho}
            where={where}
            setWhere={setWhere}
            conflicts={conflicts}
            onCancel={cancel}
            onCommit={commit}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function RefinePanel({
  draft,
  setDraft,
  weekDates,
  who,
  setWho,
  where,
  setWhere,
  conflicts,
  onCancel,
  onCommit,
}: {
  draft: Omit<CalEvent, "id">;
  setDraft: (d: Omit<CalEvent, "id">) => void;
  weekDates: Date[];
  who: string;
  setWho: (v: string) => void;
  where: string;
  setWhere: (v: string) => void;
  conflicts: CalEvent[];
  onCancel: () => void;
  onCommit: () => void;
}) {
  const cls = getCategoryClasses(draft.category);
  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.96 }}
      transition={{ type: "spring", stiffness: 320, damping: 26 }}
      className="rounded-bubble bg-card p-4 shadow-float ring-1 ring-border"
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className={cn("flex-1 rounded-2xl px-3 py-2 ring-1", cls.bg, cls.ring)}>
          <p className={cn("text-sm font-bold", cls.text)}>{draft.title}</p>
          <p className="mt-0.5 text-[11px] font-medium text-foreground/60">
            {minutesToLabel(draft.start)} · {durationLabel(draft.duration)}
          </p>
        </div>
        <button
          onClick={onCancel}
          className="rounded-full p-1.5 text-muted-foreground hover:bg-muted"
          aria-label="Cancel"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Quick ask: category */}
      <Section icon={<Sparkles className="h-3.5 w-3.5" />} label="Type">
        <CategoryPicker
          value={draft.category}
          onChange={(c) => setDraft({ ...draft, category: c })}
        />
      </Section>

      {/* When (day) */}
      <Section icon={<CalIcon className="h-3.5 w-3.5" />} label="When">
        <div className="flex flex-wrap gap-1.5">
          {weekDates.map((d) => {
            const key = format(d, "yyyy-MM-dd");
            const active = draft.date === key;
            return (
              <motion.button
                key={key}
                whileTap={{ scale: 0.92 }}
                onClick={() => {
                  const newStart = suggestStart(
                    [],
                    key,
                    draft.duration,
                    draft.start
                  );
                  setDraft({ ...draft, date: key, start: newStart });
                }}
                className={cn(
                  "flex flex-col items-center rounded-2xl px-2.5 py-1.5 text-[10px] font-semibold transition-all",
                  active
                    ? "bg-foreground text-background shadow-bubble"
                    : "bg-muted text-muted-foreground hover:bg-muted/70"
                )}
              >
                <span className="opacity-70">{format(d, "EEE")}</span>
                <span className="text-sm font-bold">{format(d, "d")}</span>
              </motion.button>
            );
          })}
        </div>
      </Section>

      {/* Duration */}
      <Section icon={<Clock className="h-3.5 w-3.5" />} label="Duration">
        <div className="flex flex-wrap gap-1.5">
          {DURATIONS.map((d) => {
            const active = draft.duration === d;
            return (
              <motion.button
                key={d}
                whileTap={{ scale: 0.92 }}
                onClick={() => setDraft({ ...draft, duration: d })}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-semibold transition-all",
                  active
                    ? "bg-foreground text-background shadow-bubble"
                    : "bg-muted text-muted-foreground hover:bg-muted/70"
                )}
              >
                {durationLabel(d)}
              </motion.button>
            );
          })}
        </div>
      </Section>

      {/* Time */}
      <Section icon={<Clock className="h-3.5 w-3.5" />} label="Start">
        <TimeSlider
          value={draft.start}
          onChange={(v) => setDraft({ ...draft, start: roundTo15(v) })}
        />
      </Section>

      {/* Where / Who */}
      <div className="grid grid-cols-2 gap-2">
        <Mini icon={<MapPin className="h-3.5 w-3.5" />} value={where} onChange={setWhere} placeholder="Where?" />
        <Mini icon={<Users className="h-3.5 w-3.5" />} value={who} onChange={setWho} placeholder="With?" />
      </div>

      {/* Conflicts */}
      <AnimatePresence>
        {conflicts.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-3 overflow-hidden"
          >
            <div className="rounded-2xl bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive ring-1 ring-destructive/20">
              ⚠ Conflicts with{" "}
              <span className="font-bold">
                {conflicts.map((c) => c.title).join(", ")}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        whileTap={{ scale: 0.97 }}
        whileHover={{ y: -1 }}
        onClick={onCommit}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-primary px-4 py-3 text-sm font-bold text-primary-foreground shadow-bubble"
      >
        <Sparkles className="h-4 w-4" />
        Add to calendar
      </motion.button>
    </motion.div>
  );
}

function Section({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        {icon}{label}
      </div>
      {children}
    </div>
  );
}

function Mini({ icon, value, onChange, placeholder }: { icon: React.ReactNode; value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="flex items-center gap-1.5 rounded-2xl bg-muted px-3 py-2 ring-1 ring-transparent focus-within:bg-card focus-within:ring-primary/30">
      <span className="text-muted-foreground">{icon}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-transparent text-xs font-medium outline-none placeholder:text-muted-foreground/70"
      />
    </div>
  );
}

function TimeSlider({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <input
        type="range"
        min={7 * 60}
        max={21 * 60}
        step={15}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value))}
        className="w-full accent-[hsl(var(--primary))]"
      />
      <div className="mt-1 text-center text-xs font-bold text-foreground">
        {minutesToLabel(value)}
      </div>
    </div>
  );
}
