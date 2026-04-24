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
  attachedItems?: AttachedItem[];
  /** "local" (default) or "google" — Google events are read-only */
  source?: EventSource;
  /** Original Google Calendar event id — used to deduplicate on re-sync */
  googleId?: string;
  /** True for all-day Google events — rendered as a banner, not on timeline */
  allDay?: boolean;
  /** Google recurrence event id — groups recurring instances */
  recurrenceId?: string;
  /** Tentative/draft event — rendered with dashed border */
  tentative?: boolean;
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
