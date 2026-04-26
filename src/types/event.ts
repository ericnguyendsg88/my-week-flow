export type Category = "work" | "personal" | "health" | "social" | "focus" | "errand";

export const CATEGORIES: { id: Category; label: string; emoji: string }[] = [
  { id: "work", label: "Work", emoji: "💼" },
  { id: "focus", label: "Focus", emoji: "🎯" },
  { id: "social", label: "Social", emoji: "🥂" },
  { id: "health", label: "Health", emoji: "🏃" },
  { id: "personal", label: "Personal", emoji: "✨" },
  { id: "errand", label: "Errand", emoji: "🛒" },
];

export type TagColor =
  | "purple"
  | "teal"
  | "coral"
  | "pink"
  | "blue"
  | "green"
  | "amber"
  | "gray";

export interface Tag {
  id: string;
  name: string;
  color: TagColor;
}

export type CaptureKind = "thought" | "link" | "file" | "ref" | "task" | "meal";
export type MealType = "breakfast" | "lunch" | "dinner";

export interface AttachedItem {
  id: string;
  kind: CaptureKind;
  title: string;
  url?: string;
}

export type SpendingCategory =
  | "food"
  | "transport"
  | "entertainment"
  | "shopping"
  | "health"
  | "work"
  | "other";

export const SPENDING_CATEGORIES: { id: SpendingCategory; label: string; emoji: string }[] = [
  { id: "food",          label: "Food & drink",   emoji: "🍜" },
  { id: "transport",     label: "Transport",       emoji: "🚌" },
  { id: "entertainment", label: "Entertainment",   emoji: "🎟️" },
  { id: "shopping",      label: "Shopping",        emoji: "🛍️" },
  { id: "health",        label: "Health",          emoji: "💊" },
  { id: "work",          label: "Work",            emoji: "💼" },
  { id: "other",         label: "Other",           emoji: "📎" },
];

export interface SpendingRecord {
  id: string;
  amount: number;       // in user's currency, e.g. 42.50
  currency: string;     // "USD", "VND", etc.
  label: string;        // "Coffee", "Grab ride"
  category: SpendingCategory;
  addedAt: number;      // timestamp ms
}

export type EventSource = "local" | "google";

export interface CalEvent {
  id: string;
  title: string;
  category: Category;
  tagId?: string;
  /** ISO date string (yyyy-MM-dd) */
  date: string;
  /** minutes since midnight */
  start: number;
  /** minutes */
  duration: number;
  where?: string;
  who?: string;
  description?: string;
  completed?: boolean | null;
  /** User is unsure this will happen — renders as dashed/muted */
  tentative?: boolean;
  attachedItems?: AttachedItem[];
  /** "local" (default) or "google" — Google events are read-only */
  source?: EventSource;
  /** Original Google Calendar event id — used to deduplicate on re-sync */
  googleId?: string;
  /** True for all-day Google events — rendered as a banner, not on timeline */
  allDay?: boolean;
  /** Google recurrence event id — groups recurring instances */
  recurrenceId?: string;
  /** Money spent during/for this event */
  spendings?: SpendingRecord[];
}

export interface CaptureItem {
  id: string;
  kind: CaptureKind;
  title: string;
  url?: string;
  tagId?: string;
  createdAt: number;
  dayKey: string;
  placed?: boolean;
  mealType?: MealType;
  /** minutes since midnight — when set, renders as a floating pill on the timeline */
  start?: number;
  // link preview metadata
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  ogSite?: string;
  ogLoading?: boolean;
  /** For timed tasks pinned to the timeline — minutes since midnight */
  start?: number;
}

export const DURATIONS = [15, 30, 45, 60, 90, 120];
