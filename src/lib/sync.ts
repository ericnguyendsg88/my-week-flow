import { useEffect, useState } from "react";
import { supabase, supabaseConfigured } from "./supabase";
import { CalEvent, CaptureItem } from "@/types/event";

// ── Sync status bus ──────────────────────────────────────────────────
export type SyncStatus = "idle" | "syncing" | "ok" | "error";
let syncStatus: SyncStatus = "idle";
let syncError: string | null = null;
const statusListeners = new Set<() => void>();

function setStatus(s: SyncStatus, err?: string) {
  syncStatus = s;
  syncError = err ?? null;
  statusListeners.forEach((l) => l());
}

export function getSyncStatus() { return { status: syncStatus, error: syncError }; }
export function subscribeSyncStatus(l: () => void) {
  statusListeners.add(l);
  return () => statusListeners.delete(l);
}
export function useSyncStatus() {
  const [s, setS] = useState(getSyncStatus);
  useEffect(() => {
    const unsub = subscribeSyncStatus(() => setS(getSyncStatus()));
    return () => { unsub; };
  }, []);
  return s;
}

// ── Events ──────────────────────────────────────────────────────────

type DbEvent = {
  id: string;
  user_id: string;
  title: string;
  date: string;
  start: number;
  duration: number;
  category?: string;
  tag_id?: string;
  where_?: string;
  who?: string;
  tentative?: boolean;
  completed?: boolean;
  source?: string;
  google_id?: string;
  all_day?: boolean;
  recurrence_id?: string;
  attached_items?: unknown;
  spendings?: unknown;
  updated_at?: string;
};

function eventToRow(e: CalEvent, userId: string): DbEvent {
  return {
    id: e.id,
    user_id: userId,
    title: e.title,
    date: e.date,
    start: e.start,
    duration: e.duration,
    category: e.category,
    tag_id: e.tagId,
    where_: e.where,
    who: e.who,
    tentative: e.tentative,
    completed: e.completed ?? undefined,
    source: e.source,
    google_id: e.googleId,
    all_day: e.allDay,
    recurrence_id: e.recurrenceId,
    attached_items: e.attachedItems ?? null,
    spendings: e.spendings ?? null,
    updated_at: new Date().toISOString(),
  };
}

function rowToEvent(r: DbEvent): CalEvent {
  return {
    id: r.id,
    title: r.title,
    date: r.date,
    start: r.start,
    duration: r.duration,
    category: (r.category as CalEvent["category"]) ?? "work",
    tagId: r.tag_id,
    where: r.where_,
    who: r.who,
    tentative: r.tentative,
    completed: r.completed,
    source: (r.source as CalEvent["source"]) ?? "local",
    googleId: r.google_id,
    allDay: r.all_day,
    recurrenceId: r.recurrence_id,
    attachedItems: (r.attached_items as CalEvent["attachedItems"]) ?? undefined,
    spendings: (r.spendings as CalEvent["spendings"]) ?? undefined,
  };
}

export async function pushEvents(events: CalEvent[], userId: string) {
  if (!supabaseConfigured || events.length === 0) return;
  setStatus("syncing");
  const rows = events.map((e) => eventToRow(e, userId));
  const { error } = await supabase.from("events").upsert(rows, { onConflict: "id" });
  if (error) { setStatus("error", error.message); console.warn("[sync] pushEvents:", error.message); }
  else setStatus("ok");
}

export async function deleteEvent(id: string) {
  if (!supabaseConfigured) return;
  const { error } = await supabase.from("events").delete().eq("id", id);
  if (error) console.warn("[sync] deleteEvent:", error.message);
}

export async function pullEvents(userId: string): Promise<CalEvent[] | null> {
  if (!supabaseConfigured) return null;
  setStatus("syncing");
  const { data, error } = await supabase.from("events").select("*").eq("user_id", userId);
  if (error) { setStatus("error", error.message); console.warn("[sync] pullEvents:", error.message); return null; }
  setStatus("ok");
  return (data as DbEvent[]).map(rowToEvent);
}

export function subscribeEvents(
  userId: string,
  onUpsert: (e: CalEvent) => void,
  onDelete: (id: string) => void,
) {
  if (!supabaseConfigured) return () => {};
  const channel = supabase
    .channel(`events:${userId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "events", filter: `user_id=eq.${userId}` },
      (payload) => {
        if (payload.eventType === "DELETE") {
          const id = (payload.old as DbEvent | null)?.id;
          if (id) onDelete(id);
        } else {
          const row = payload.new as DbEvent | null;
          if (row) onUpsert(rowToEvent(row));
        }
      },
    )
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}

// ── Captures ─────────────────────────────────────────────────────────

type DbCapture = {
  id: string;
  user_id: string;
  kind: string;
  title: string;
  url?: string;
  day_key?: string;
  tag_id?: string;
  start?: number;
  placed?: boolean;
  meal_type?: string;
  note?: string;
  created_at?: string;
};

function captureToRow(c: CaptureItem, userId: string): DbCapture {
  return {
    id: c.id,
    user_id: userId,
    kind: c.kind,
    title: c.title,
    url: c.url,
    day_key: c.dayKey,
    tag_id: c.tagId,
    start: c.start,
    placed: c.placed,
    meal_type: c.mealType,
    note: c.note,
    created_at: new Date(c.createdAt).toISOString(),
  };
}

function rowToCapture(r: DbCapture): CaptureItem {
  return {
    id: r.id,
    kind: r.kind as CaptureItem["kind"],
    title: r.title,
    url: r.url,
    dayKey: r.day_key ?? "",
    tagId: r.tag_id,
    start: r.start,
    placed: r.placed,
    mealType: r.meal_type as CaptureItem["mealType"],
    note: r.note,
    createdAt: r.created_at ? new Date(r.created_at).getTime() : Date.now(),
  };
}

export async function pushCaptures(captures: CaptureItem[], userId: string) {
  if (!supabaseConfigured || captures.length === 0) return;
  const rows = captures.map((c) => captureToRow(c, userId));
  const { error } = await supabase.from("captures").upsert(rows, { onConflict: "id" });
  if (error) console.warn("[sync] pushCaptures:", error.message);
}

export async function deleteCapture(id: string) {
  if (!supabaseConfigured) return;
  const { error } = await supabase.from("captures").delete().eq("id", id);
  if (error) console.warn("[sync] deleteCapture:", error.message);
}

export async function pullCaptures(userId: string): Promise<CaptureItem[] | null> {
  if (!supabaseConfigured) return null;
  const { data, error } = await supabase.from("captures").select("*").eq("user_id", userId);
  if (error) { console.warn("[sync] pullCaptures:", error.message); return null; }
  return (data as DbCapture[]).map(rowToCapture);
}

export function subscribeCaptures(
  userId: string,
  onUpsert: (c: CaptureItem) => void,
  onDelete: (id: string) => void,
) {
  if (!supabaseConfigured) return () => {};
  const channel = supabase
    .channel(`captures:${userId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "captures", filter: `user_id=eq.${userId}` },
      (payload) => {
        if (payload.eventType === "DELETE") {
          const id = (payload.old as DbCapture | null)?.id;
          if (id) onDelete(id);
        } else {
          const row = payload.new as DbCapture | null;
          if (row) onUpsert(rowToCapture(row));
        }
      },
    )
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}
