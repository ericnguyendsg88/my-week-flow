import { Category, CalEvent } from "@/types/event";

export const minutesToLabel = (m: number) => {
  const h = Math.floor(m / 60);
  const min = m % 60;
  const period = h >= 12 ? "pm" : "am";
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${hh}${min ? ":" + String(min).padStart(2, "0") : ""}${period}`;
};

export const durationLabel = (mins: number) => {
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
};

const KEYWORDS: Record<Category, string[]> = {
  work: ["meeting", "standup", "review", "call", "client", "report", "deck", "email", "interview", "1:1", "sync"],
  focus: ["write", "code", "design", "deep", "study", "research", "draft", "build", "plan"],
  social: ["lunch", "dinner", "coffee", "drinks", "party", "hangout", "brunch", "date", "with"],
  health: ["gym", "run", "yoga", "walk", "workout", "doctor", "dentist", "meditate", "therapy", "swim"],
  personal: ["birthday", "family", "home", "read", "journal", "shower"],
  errand: ["grocery", "pickup", "buy", "shop", "errand", "laundry", "bank", "post"],
};

export function guessCategory(text: string): Category {
  const lower = text.toLowerCase();
  for (const cat of Object.keys(KEYWORDS) as Category[]) {
    if (KEYWORDS[cat].some((k) => lower.includes(k))) return cat;
  }
  return "work";
}

export function guessDuration(text: string): number {
  const lower = text.toLowerCase();
  if (/\b(\d{1,2})\s*h(our)?s?\b/.test(lower)) {
    const m = lower.match(/(\d{1,2})\s*h/);
    return Math.min(240, parseInt(m![1]) * 60);
  }
  if (/\b(\d{1,3})\s*m(in)?\b/.test(lower)) {
    const m = lower.match(/(\d{1,3})\s*m/);
    return Math.min(240, parseInt(m![1]));
  }
  if (/\b(lunch|dinner|brunch)\b/.test(lower)) return 60;
  if (/\b(coffee|call|standup|sync)\b/.test(lower)) return 30;
  if (/\b(workout|gym|run|yoga)\b/.test(lower)) return 45;
  if (/\b(deep|focus|write|code|design)\b/.test(lower)) return 90;
  return 30;
}

/** Find next free slot (in minutes since midnight) for a given duration on a date. */
export function suggestStart(events: CalEvent[], date: string, duration: number, hint?: number): number {
  const dayEvents = events.filter((e) => e.date === date).sort((a, b) => a.start - b.start);
  const dayStart = 8 * 60;
  const dayEnd = 21 * 60;

  const candidate = hint ?? Math.max(dayStart, roundTo15(nowMinutes() + 15));
  // try candidate first
  if (!collides(dayEvents, candidate, duration) && candidate + duration <= dayEnd) return candidate;

  let cursor = dayStart;
  for (const e of dayEvents) {
    if (e.start - cursor >= duration) return cursor;
    cursor = Math.max(cursor, e.start + e.duration);
  }
  return cursor + duration <= dayEnd ? cursor : candidate;
}

export function collides(events: CalEvent[], start: number, duration: number, ignoreId?: string) {
  return events.some(
    (e) => e.id !== ignoreId && start < e.start + e.duration && start + duration > e.start
  );
}

export function findConflicts(events: CalEvent[], date: string, start: number, duration: number, ignoreId?: string) {
  return events.filter(
    (e) =>
      e.id !== ignoreId &&
      e.date === date &&
      start < e.start + e.duration &&
      start + duration > e.start
  );
}

export const roundTo15 = (m: number) => Math.round(m / 15) * 15;
export const nowMinutes = () => {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
};
