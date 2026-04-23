import { useCallback, useEffect, useState } from "react";
import { CaptureItem, CaptureKind } from "@/types/event";

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

function emit() {
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
