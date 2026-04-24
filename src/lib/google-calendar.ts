/**
 * Google Calendar integration
 *
 * Usage:
 *   1. Add <script src="https://accounts.google.com/gsi/client"></script> to index.html
 *   2. Call initGoogleAuth(clientId) once on app mount
 *   3. Call signInWithGoogle() to get an access token (opens OAuth popup)
 *   4. Call fetchGoogleEvents(token, start, end) to pull events
 *   5. Map with googleEventsToCalEvents() and merge into local event state
 *
 * All Google-sourced CalEvents have source="google" and are read-only in the UI.
 */

import { format, parseISO, differenceInMinutes } from "date-fns";
import { CalEvent, Category } from "@/types/event";
import { guessCategory } from "@/lib/event-utils";

// ── Types from the Google Calendar REST API ──────────────────────────────────

export interface GoogleCalendarEvent {
  id: string;
  summary?: string;
  description?: string;
  location?: string;
  status?: "confirmed" | "tentative" | "cancelled";
  start: { dateTime?: string; date?: string; timeZone?: string };
  end:   { dateTime?: string; date?: string; timeZone?: string };
  attendees?: { email: string; displayName?: string; self?: boolean }[];
  colorId?: string;
  recurringEventId?: string;
  organizer?: { email: string; displayName?: string; self?: boolean };
}

interface GoogleEventsResponse {
  items: GoogleCalendarEvent[];
  nextPageToken?: string;
}

// ── Color mapping: Google colorId → app tagId ───────────────────────────────
// Google's 11 event colours, mapped to the closest app tag.
// https://developers.google.com/calendar/api/v3/reference/colors
const GOOGLE_COLOR_TO_TAG: Record<string, string> = {
  "1":  "personal",   // Lavender  → personal
  "2":  "deepwork",   // Sage      → deepwork
  "3":  "personal",   // Grape     → personal
  "4":  "social",     // Flamingo  → social
  "5":  "social",     // Banana    → social
  "6":  "personal",   // Tangerine → personal
  "7":  "deepwork",   // Peacock   → deepwork
  "8":  "work",       // Graphite  → work
  "9":  "study",      // Blueberry → study
  "10": "deepwork",   // Basil     → deepwork
  "11": "social",     // Tomato    → social
};

// ── Mapper: Google event → CalEvent ─────────────────────────────────────────

export function mapGoogleEvent(ev: GoogleCalendarEvent): CalEvent | null {
  // Skip cancelled events
  if (ev.status === "cancelled") return null;

  const isAllDay = !ev.start.dateTime;

  // All-day events: store date, start=0, duration=0, allDay=true
  if (isAllDay) {
    const date = ev.start.date ?? format(new Date(), "yyyy-MM-dd");
    return {
      id: `google_${ev.id}`,
      googleId: ev.id,
      source: "google",
      allDay: true,
      title: ev.summary?.trim() || "(No title)",
      description: ev.description?.trim(),
      category: guessCategory(ev.summary ?? ""),
      date,
      start: 0,
      duration: 0,
      where: ev.location?.trim() || undefined,
      who: buildWhoString(ev),
      recurrenceId: ev.recurringEventId,
    };
  }

  // Timed events
  const startDt = parseISO(ev.start.dateTime!);
  const endDt   = parseISO(ev.end.dateTime!);
  const date    = format(startDt, "yyyy-MM-dd");
  const startMins = startDt.getHours() * 60 + startDt.getMinutes();
  const durationMins = Math.max(15, differenceInMinutes(endDt, startDt));

  const tagId = ev.colorId
    ? GOOGLE_COLOR_TO_TAG[ev.colorId]
    : guessTagFromCategory(guessCategory(ev.summary ?? ""));

  return {
    id: `google_${ev.id}`,
    googleId: ev.id,
    source: "google",
    allDay: false,
    title: ev.summary?.trim() || "(No title)",
    description: ev.description?.trim(),
    category: guessCategory(ev.summary ?? ""),
    tagId,
    date,
    start: startMins,
    duration: durationMins,
    where: ev.location?.trim() || undefined,
    who: buildWhoString(ev),
    recurrenceId: ev.recurringEventId,
  };
}

export function mapGoogleEvents(items: GoogleCalendarEvent[]): CalEvent[] {
  return items.flatMap((ev) => {
    const mapped = mapGoogleEvent(ev);
    return mapped ? [mapped] : [];
  });
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function buildWhoString(ev: GoogleCalendarEvent): string | undefined {
  if (!ev.attendees || ev.attendees.length === 0) return undefined;
  const others = ev.attendees
    .filter((a) => !a.self)
    .map((a) => a.displayName || a.email);
  if (others.length === 0) return undefined;
  if (others.length <= 3) return others.join(", ");
  return `${others.slice(0, 2).join(", ")} +${others.length - 2} more`;
}

function guessTagFromCategory(cat: Category): string {
  switch (cat) {
    case "work":     return "work";
    case "focus":    return "deepwork";
    case "social":   return "social";
    case "health":   return "personal";
    case "personal": return "personal";
    case "errand":   return "personal";
    default:         return "work";
  }
}

// ── Deduplication: merge Google events into local events ─────────────────────
// Keeps all local events, replaces/adds Google events by googleId.

export function mergeGoogleEvents(
  localEvents: CalEvent[],
  googleEvents: CalEvent[]
): CalEvent[] {
  // Remove stale Google events (they'll be re-added fresh)
  const locals = localEvents.filter((e) => e.source !== "google");
  return [...locals, ...googleEvents];
}

// ── Auth & fetch ─────────────────────────────────────────────────────────────

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (resp: { access_token?: string; error?: string }) => void;
          }) => { requestAccessToken: () => void };
        };
      };
    };
  }
}

export interface GoogleAuthState {
  accessToken: string | null;
  expiresAt: number | null; // unix ms
}

let _tokenClient: ReturnType<typeof window.google.accounts.oauth2.initTokenClient> | null = null;

export function initGoogleAuth(clientId: string): void {
  if (!window.google?.accounts?.oauth2) {
    console.warn("[google-calendar] GIS script not loaded. Add it to index.html.");
    return;
  }
  _tokenClient = window.google.accounts.oauth2.initTokenClient({
    client_id: clientId,
    scope: "https://www.googleapis.com/auth/calendar.readonly",
    callback: () => {}, // overridden per-request in signInWithGoogle
  });
}

export function signInWithGoogle(): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!_tokenClient) {
      reject(new Error("Google auth not initialised — call initGoogleAuth(clientId) first"));
      return;
    }
    // Override the callback for this request
    (_tokenClient as any).callback = (resp: { access_token?: string; error?: string }) => {
      if (resp.error || !resp.access_token) {
        reject(new Error(resp.error ?? "No access token returned"));
      } else {
        resolve(resp.access_token);
      }
    };
    _tokenClient.requestAccessToken();
  });
}

export async function fetchGoogleEvents(
  accessToken: string,
  rangeStart: Date,
  rangeEnd: Date,
  calendarId = "primary"
): Promise<CalEvent[]> {
  const params = new URLSearchParams({
    timeMin: rangeStart.toISOString(),
    timeMax: rangeEnd.toISOString(),
    singleEvents: "true",      // expand recurring events into individual instances
    orderBy: "startTime",
    maxResults: "250",
  });

  const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params}`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Google Calendar API error ${res.status}: ${err}`);
  }

  const data: GoogleEventsResponse = await res.json();
  return mapGoogleEvents(data.items ?? []);
}
