import { useCallback, useEffect, useState } from "react";
import { CaptureItem, CaptureKind } from "@/types/event";
import { pushCaptures, deleteCapture as sbDeleteCapture, pullCaptures } from "./sync";

let currentUserId: string | null = null;
export function setCaptureSyncUser(uid: string | null) { currentUserId = uid; }

const STORAGE_KEY = "horizon_backpack";

function load(): CaptureItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as CaptureItem[];
  } catch { /* ignore */ }
  return [];
}

function save(items: CaptureItem[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch { /* ignore */ }
}

let store: CaptureItem[] = load();
const listeners = new Set<() => void>();

let syncTimer: ReturnType<typeof setTimeout> | undefined;

function emit() {
  save(store);
  listeners.forEach((l) => l());
  // debounced push to Supabase
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => { if (currentUserId) pushCaptures(store, currentUserId); }, 800);
}

export async function syncCapturesFromRemote(userId: string) {
  const remote = await pullCaptures(userId);
  if (!remote) return;
  const remoteIds = new Set(remote.map((c) => c.id));
  const localOnly = store.filter((c) => !remoteIds.has(c.id));
  store = [...remote, ...localOnly];
  save(store);
  listeners.forEach((l) => l());
}

// Apply a remote upsert without re-pushing
export function applyRemoteCapture(c: CaptureItem) {
  const idx = store.findIndex((x) => x.id === c.id);
  if (idx === -1) store = [c, ...store];
  else store = store.map((x) => (x.id === c.id ? c : x));
  save(store);
  listeners.forEach((l) => l());
}

export function applyRemoteCaptureDelete(id: string) {
  if (!store.some((c) => c.id === id)) return;
  store = store.filter((c) => c.id !== id);
  save(store);
  listeners.forEach((l) => l());
}

export function addCapture(input: {
  kind: CaptureKind;
  title: string;
  url?: string;
  tagId?: string;
  dayKey: string;
  mealType?: import("@/types/event").MealType;
}) {
  const item: CaptureItem = {
    id: crypto.randomUUID(),
    createdAt: Date.now(),
    placed: false,
    ...input,
  };
  store = [item, ...store];
  emit();
  return item;
}

export function removeCapture(id: string) {
  store = store.filter((c) => c.id !== id);
  emit();
  sbDeleteCapture(id);
}

export function patchCapture(id: string, patch: Partial<CaptureItem>) {
  store = store.map((c) => (c.id === id ? { ...c, ...patch } : c));
  emit();
}

export function markCapturePlaced(id: string) {
  store = store.map((c) => (c.id === id ? { ...c, placed: true } : c));
  emit();
}

export function useCaptures(dayKey?: string) {
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force((n) => n + 1);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  const list = dayKey ? store.filter((c) => c.dayKey === dayKey) : store;
  return list;
}

export function useUnplacedCount(dayKey: string) {
  const list = useCaptures(dayKey);
  return list.filter((c) => !c.placed && (c.kind === "thought" || c.kind === "task")).length;
}

export function useCaptureActions() {
  return {
    add: useCallback(addCapture, []),
    remove: useCallback(removeCapture, []),
    markPlaced: useCallback(markCapturePlaced, []),
  };
}
