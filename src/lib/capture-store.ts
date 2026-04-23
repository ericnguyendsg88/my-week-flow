import { useCallback, useEffect, useState } from "react";
import { CaptureItem, CaptureKind } from "@/types/event";

let store: CaptureItem[] = [];
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export function addCapture(input: {
  kind: CaptureKind;
  title: string;
  url?: string;
  tagId?: string;
  dayKey: string;
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
