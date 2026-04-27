import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { format, eachDayOfInterval, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isSameMonth, addMonths, subMonths } from "date-fns";
import { X, Trash2, Check, Ban, RotateCcw, Lightbulb, Link2, FileText, Bookmark, CheckSquare, ExternalLink, Pencil, Plus, Share2, type LucideIcon } from "lucide-react";
import { ShareInviteModal } from "./ShareInviteModal";
import { CalEvent, CaptureKind, Tag, SpendingRecord, SpendingCategory, SPENDING_CATEGORIES } from "@/types/event";
import { getTag } from "@/lib/tags";
import { minutesToLabel, durationLabel, nowMinutes } from "@/lib/event-utils";

const PANEL_MARGIN = 16;
const PANEL_WIDTH = 360;

const KIND_ICON: Record<CaptureKind, LucideIcon> = {
  thought: Lightbulb,
  link:    Link2,
  file:    FileText,
  ref:     Bookmark,
  task:    CheckSquare,
  meal:    Lightbulb,
};

const KIND_COLORS: Record<CaptureKind, { bg: string; text: string }> = {
  thought: { bg: "#EEEDFE", text: "#3C3489" },
  link:    { bg: "#E6F1FB", text: "#0C447C" },
  file:    { bg: "#EAF3DE", text: "#27500A" },
  ref:     { bg: "#FAEEDA", text: "#633806" },
  task:    { bg: "#FBEAF0", text: "#72243E" },
  meal:    { bg: "#FEF3C7", text: "#92400E" },
};

function tagColors(tagId?: string): { bg: string; text: string; sub: string; light: string; pale: string } {
  switch (tagId) {
    case "work":     return { bg: "#AFA9EC", text: "#3C3489", sub: "#534AB7", light: "#CECBF6", pale: "#EEEDFE" };
    case "deepwork": return { bg: "#9FE1CB", text: "#085041", sub: "#0F6E56", light: "#E1F5EE", pale: "#E1F5EE" };
    case "study":    return { bg: "#B5D4F4", text: "#0C447C", sub: "#185FA5", light: "#E6F1FB", pale: "#E6F1FB" };
    case "personal": return { bg: "#F4C0D1", text: "#72243E", sub: "#993556", light: "#FBEAF0", pale: "#FBEAF0" };
    case "social":   return { bg: "#FAC775", text: "#633806", sub: "#854F0B", light: "#FAEEDA", pale: "#FAEEDA" };
    case "health":   return { bg: "#C0DD97", text: "#27500A", sub: "#3B6D11", light: "#EAF3DE", pale: "#EAF3DE" };
    case "errand":   return { bg: "#F5C4B3", text: "#712B13", sub: "#993C1D", light: "#FAECE7", pale: "#FAECE7" };
    default:         return { bg: "#D3D1C7", text: "#444441", sub: "#5F5E5A", light: "#F1EFE8", pale: "#F1EFE8" };
  }
}

function EditMiniCal({ selected, onSelect }: { selected: string; onSelect: (d: string) => void }) {
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(new Date(selected + "T00:00:00")));
  const days = eachDayOfInterval({
    start: startOfWeek(viewMonth, { weekStartsOn: 1 }),
    end:   endOfWeek(endOfMonth(viewMonth), { weekStartsOn: 1 }),
  });
  const todayStr = format(new Date(), "yyyy-MM-dd");
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <button type="button" onClick={() => setViewMonth(m => subMonths(m, 1))} style={{ background: "none", border: "none", cursor: "pointer", color: "#7B73D6", fontSize: 16, padding: "0 6px" }}>‹</button>
        <span style={{ fontSize: 11, fontWeight: 700, color: "#3C3489" }}>{format(viewMonth, "MMM yyyy")}</span>
        <button type="button" onClick={() => setViewMonth(m => addMonths(m, 1))} style={{ background: "none", border: "none", cursor: "pointer", color: "#7B73D6", fontSize: 16, padding: "0 6px" }}>›</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2 }}>
        {["M","T","W","T","F","S","S"].map((d, i) => (
          <div key={i} style={{ textAlign: "center", fontSize: 9, fontWeight: 700, color: "#B0AAE8", paddingBottom: 2 }}>{d}</div>
        ))}
        {days.map(day => {
          const key = format(day, "yyyy-MM-dd");
          const isSel = key === selected;
          const isToday = key === todayStr;
          const inMonth = isSameMonth(day, viewMonth);
          return (
            <button type="button" key={key} onClick={() => onSelect(key)} style={{
              padding: "4px 0", borderRadius: 5, fontSize: 10,
              fontWeight: isSel ? 700 : 400,
              background: isSel ? "#3C3489" : isToday ? "#EBE8FC" : "transparent",
              color: isSel ? "#fff" : !inMonth ? "rgba(123,115,214,0.25)" : isToday ? "#3C3489" : "#4A42A0",
              border: isToday && !isSel ? "1px solid #C5BEF5" : "1px solid transparent",
              cursor: "pointer",
            }}>{format(day, "d")}</button>
          );
        })}
      </div>
    </div>
  );
}

function EditTimePicker({
  selected,
  onSelect,
  min = 7 * 60,
  max = 22 * 60,
  step = 15,
}: {
  selected: number;
  onSelect: (m: number) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  const slots: number[] = [];
  for (let t = min; t <= max; t += step) slots.push(t);
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 3, maxHeight: 140, overflowY: "auto" }} className="scrollbar-hidden">
      {slots.map(t => (
        <button type="button" key={t} onClick={() => onSelect(t)} style={{
          padding: "5px 2px", borderRadius: 6, fontSize: 10, fontWeight: 600,
          textAlign: "center", cursor: "pointer",
          background: selected === t ? "#3C3489" : "rgba(255,255,255,0.85)",
          color: selected === t ? "#fff" : "#3C3489",
          border: selected === t ? "1.5px solid #3C3489" : "1.5px solid rgba(123,115,214,0.22)",
        }}>{minutesToLabel(t)}</button>
      ))}
    </div>
  );
}

interface Props {
  event: CalEvent;
  tags?: Tag[];
  onMark?: (completed: boolean | null) => void;
  onDelete?: () => void;
  onUpdate?: (patch: Partial<CalEvent>) => void;
  onCopy?: (event: CalEvent) => void;
  onSelect?: (event: CalEvent | null) => void;
  isResizing?: boolean;
  compact?: boolean;
}

// ── Spending helpers ──────────────────────────────────────────────
function formatAmount(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 2 }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

function totalSpendings(spendings: SpendingRecord[]) {
  const byCurrency: Record<string, number> = {};
  for (const s of spendings) {
    byCurrency[s.currency] = (byCurrency[s.currency] ?? 0) + s.amount;
  }
  return Object.entries(byCurrency)
    .map(([cur, amt]) => formatAmount(amt, cur))
    .join(" + ");
}

export function EventBubble({ event, tags, onMark, onDelete, onUpdate, onCopy, onSelect, isResizing, compact = false }: Props) {
  const tag = tags ? getTag(tags, event.tagId) : undefined;
  const colors = tagColors(tag?.id ?? event.tagId);
  const [showDetail, setShowDetail] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [panelPos, setPanelPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const bubbleRef = useRef<HTMLDivElement>(null);

  // edit mode: all fields editable at once
  const [editMode, setEditMode] = useState(false);
  const [editTitle, setEditTitle] = useState(event.title);
  const [editDate, setEditDate] = useState(event.date);
  const [editStart, setEditStart] = useState(event.start);
  const [editDuration, setEditDuration] = useState(event.duration);
  const [editTagId, setEditTagId] = useState(event.tagId ?? "");
  const [editLocation, setEditLocation] = useState(event.where ?? "");
  const [editPeople, setEditPeople] = useState(event.who ?? "");
  const [editTentative, setEditTentative] = useState(event.tentative === true);
  // which sub-section is expanded inside edit mode
  const [expandSection, setExpandSection] = useState<"date" | "startTime" | "endTime" | null>(null);

  // spending state
  const [showSpending, setShowSpending] = useState(false);
  const [spendAmount, setSpendAmount] = useState("");
  const [spendLabel, setSpendLabel] = useState("");
  const [spendCurrency, setSpendCurrency] = useState("USD");
  const [spendCategory, setSpendCategory] = useState<SpendingCategory>("other");

  function addSpending() {
    const amount = parseFloat(spendAmount.replace(/,/g, ""));
    if (!amount || isNaN(amount) || !spendLabel.trim()) return;
    const record: SpendingRecord = {
      id: crypto.randomUUID(),
      amount,
      currency: spendCurrency.toUpperCase().trim() || "USD",
      label: spendLabel.trim(),
      category: spendCategory,
      addedAt: Date.now(),
    };
    onUpdate?.({ spendings: [...(event.spendings ?? []), record] });
    setSpendAmount("");
    setSpendLabel("");
    setSpendCategory("other");
    setShowSpending(false);
  }

  function deleteSpending(id: string) {
    onUpdate?.({ spendings: (event.spendings ?? []).filter((s) => s.id !== id) });
  }

  useEffect(() => {
    if (showDetail) {
      setEditTitle(event.title);
      setEditDate(event.date);
      setEditStart(event.start);
      setEditDuration(event.duration);
      setEditTagId(event.tagId ?? "");
      setEditLocation(event.where ?? "");
      setEditPeople(event.who ?? "");
      setEditTentative(event.tentative === true);
      setEditMode(false);
      setExpandSection(null);
    }
  }, [showDetail, event]);

  const isCompleted = event.completed === true;
  const isSkipped   = event.completed === false;
  const isTentative = event.tentative === true;
  const isSpecialState = isCompleted || isSkipped || isTentative;
  
  const now = nowMinutes();
  const eventEnd = event.start + event.duration;
  const isInProgress = now >= event.start && now < eventEnd;

  const bgColor = isCompleted
    ? "#EAF3DE"
    : isSkipped
      ? "#D3D1C7"
      : isTentative
        ? "#EEEDFE"
        : colors.bg;
  const textColor = isCompleted
    ? "#173404"
    : isSkipped
      ? "#2C2C2A"
      : isTentative
        ? colors.text
        : colors.text;
  const subColor = isCompleted
    ? "#3B6D11"
    : isSkipped
      ? "#5F5E5A"
      : isTentative
        ? colors.sub
        : colors.sub;
  const borderColor = isCompleted
    ? "transparent"
    : isSkipped
      ? "transparent"
      : isTentative
        ? "#534AB7"
        : "transparent";

  useEffect(() => {
    if (!showDetail) return;
    function onDown(e: MouseEvent) {
      if (bubbleRef.current && !bubbleRef.current.contains(e.target as Node)) {
        const panel = document.getElementById("event-detail-panel");
        if (panel && panel.contains(e.target as Node)) return;
        setShowDetail(false);
      }
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [showDetail]);

  function handleBubbleClick(e: React.MouseEvent) {
    e.stopPropagation();
    if (isResizing) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const panelW = Math.min(PANEL_WIDTH, window.innerWidth - PANEL_MARGIN * 2);
    const panelH = Math.min(680, window.innerHeight - PANEL_MARGIN * 2);
    const preferredX = rect.right + 12 + panelW > window.innerWidth
      ? rect.left - panelW - 12
      : rect.right + 12;
    const x = Math.min(
      Math.max(PANEL_MARGIN, preferredX),
      window.innerWidth - panelW - PANEL_MARGIN
    );
    const y = Math.min(
      Math.max(PANEL_MARGIN, rect.top),
      window.innerHeight - panelH - PANEL_MARGIN
    );
    setPanelPos({ x, y });
    setShowDetail((v) => {
      const next = !v;
      onSelect?.(next ? event : null);
      return next;
    });
  }

  function saveAll() {
    if (!onUpdate) { setEditMode(false); return; }
    onUpdate({
      title: editTitle.trim() || event.title,
      date: editDate,
      start: editStart,
      duration: editDuration,
      tagId: editTagId || undefined,
      where: editLocation.trim() || undefined,
      who: editPeople.trim() || undefined,
      tentative: editTentative || undefined,
    });
    setEditMode(false);
    setExpandSection(null);
  }

  function cancelEdit() {
    setEditTitle(event.title);
    setEditDate(event.date);
    setEditStart(event.start);
    setEditDuration(event.duration);
    setEditTagId(event.tagId ?? "");
    setEditLocation(event.where ?? "");
    setEditPeople(event.who ?? "");
    setEditTentative(event.tentative === true);
    setEditMode(false);
    setExpandSection(null);
  }

  const endMin = editStart + editDuration;
  const latestStart = Math.max(7 * 60, 22 * 60 - 15);
  const earliestEnd = Math.min(22 * 60, editStart + 15);
  const displayEndMin = event.start + event.duration;
  const dateLabel = (() => {
    try { return format(new Date(event.date + "T00:00:00"), "EEE, MMM d"); } catch { return event.date; }
  })();
  const editDateLabel = (() => {
    try { return format(new Date(editDate + "T00:00:00"), "EEE, MMM d"); } catch { return editDate; }
  })();

  const displayTag = tags ? getTag(tags, editMode ? editTagId : (event.tagId ?? "")) : undefined;

  // ── Field row for view mode ──────────────────────────────────
  function FieldRow({ label, value }: { label: string; value: React.ReactNode }) {
    return (
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, padding: "5px 0", borderBottom: "1px solid rgba(0,0,0,0.04)" }}>
        <span style={{ fontSize: 11, color: "#AAA", minWidth: 56, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", flexShrink: 0 }}>{label}</span>
        <span style={{ fontSize: 13, fontWeight: 500, color: "#222", lineHeight: 1.4 }}>{value}</span>
      </div>
    );
  }

  const detailPanel = showDetail && createPortal(
    <>
      <div style={{ position: "fixed", inset: 0, zIndex: 998 }} onClick={() => { setShowDetail(false); onSelect?.(null); }} />

      <motion.div
        id="event-detail-panel"
        initial={{ opacity: 0, scale: 0.93, y: -6 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ type: "spring", stiffness: 420, damping: 28 }}
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "fixed",
          left: panelPos.x,
          top: panelPos.y,
          width: `min(${PANEL_WIDTH}px, calc(100vw - ${PANEL_MARGIN * 2}px))`,
          background: "#FAFAF8",
          borderRadius: 20,
          boxShadow: "0 24px 72px -8px rgba(0,0,0,0.24), 0 4px 20px -4px rgba(0,0,0,0.12)",
          border: "1px solid rgba(0,0,0,0.07)",
          zIndex: 999,
          overflow: "hidden",
          maxHeight: `calc(100vh - ${PANEL_MARGIN * 2}px)`,
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Color stripe */}
        <div style={{ height: 8, background: bgColor, flexShrink: 0 }} />

        {/* Header */}
        <div style={{ padding: "16px 18px 12px", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, flexShrink: 0 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            {editMode ? (
              <input
                autoFocus
                value={editTitle}
                onChange={e => setEditTitle(e.target.value)}
                onKeyDown={e => { if (e.key === "Escape") cancelEdit(); }}
                style={{ width: "100%", fontSize: 17, fontWeight: 600, fontFamily: "'Lora', Georgia, serif", color: "#111", background: "#F3F0FE", border: "2px solid #7B73D6", borderRadius: 10, padding: "6px 10px", outline: "none", boxSizing: "border-box" }}
              />
            ) : (
              <h3 style={{ fontSize: 17, fontWeight: 600, fontFamily: "'Lora', Georgia, serif", color: "#111", lineHeight: 1.3, margin: 0 }}>{event.title}</h3>
            )}
            {!editMode && (
              <p style={{ fontSize: 12, color: "#999", marginTop: 3, fontWeight: 400 }}>
                {dateLabel} · {minutesToLabel(event.start)} → {minutesToLabel(displayEndMin)} · {durationLabel(event.duration)}
              </p>
            )}
          </div>
          <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
            {/* Google Calendar badge — editable locally */}
            {event.source === "google" && !editMode && (
              <span style={{ display: "flex", alignItems: "center", gap: 4, background: "#F0F6FF", border: "1px solid #C5D9F5", borderRadius: 10, padding: "5px 10px", fontSize: 11, fontWeight: 600, color: "#3A6CB5", flexShrink: 0 }}>
                <svg width="10" height="10" viewBox="0 0 488 512" fill="currentColor"><path d="M488 261.8C488 403.3 391.1 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 123 24.5 166.3 64.9l-67.5 64.9C258.5 52.6 94.3 116.6 94.3 256c0 86.5 69.1 156.6 153.7 156.6 98.2 0 135-70.4 140.8-106.9H248v-85.3h236.1c2.3 12.7 3.9 24.9 3.9 41.4z"/></svg>
                Google
              </span>
            )}
            {onUpdate && !editMode && (
              <button
                type="button"
                onClick={() => setEditMode(true)}
                style={{ display: "flex", alignItems: "center", gap: 5, background: "#EBE8FC", border: "none", borderRadius: 10, padding: "7px 12px", cursor: "pointer", color: "#3C3489", fontSize: 12, fontWeight: 600 }}
              >
                <Pencil size={12} strokeWidth={2.5} /> Edit
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowDetail(false)}
              style={{ background: "#F0EDEA", border: "none", borderRadius: 10, padding: 7, cursor: "pointer", color: "#888", display: "flex", alignItems: "center", justifyContent: "center" }}
            >
              <X size={14} strokeWidth={2.5} />
            </button>
          </div>
        </div>

        {/* Scrollable body */}
        <div style={{ flex: 1, overflowY: "auto" }} className="scrollbar-hidden">

          {editMode ? (
            /* ── EDIT MODE: all fields ── */
            <div style={{ padding: "0 18px 12px" }}>

              {/* Date */}
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: "#AAA", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 4 }}>Date</label>
                <button
                  type="button"
                  onClick={() => setExpandSection(s => s === "date" ? null : "date")}
                  style={{ width: "100%", textAlign: "left", background: expandSection === "date" ? "#EBE8FC" : "#F5F3F0", border: "1.5px solid " + (expandSection === "date" ? "#7B73D6" : "transparent"), borderRadius: 10, padding: "8px 12px", fontSize: 13, fontWeight: 600, color: "#3C3489", cursor: "pointer" }}
                >
                  {editDateLabel}
                </button>
                {expandSection === "date" && (
                  <div style={{ marginTop: 6, background: "#F3F0FE", borderRadius: 12, padding: 10 }}>
                    <EditMiniCal selected={editDate} onSelect={d => { setEditDate(d); setExpandSection(null); }} />
                  </div>
                )}
              </div>

              {/* Start time */}
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: "#AAA", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 4 }}>Start time</label>
                <button
                  type="button"
                  onClick={() => setExpandSection(s => s === "startTime" ? null : "startTime")}
                  style={{ width: "100%", textAlign: "left", background: expandSection === "startTime" ? "#EBE8FC" : "#F5F3F0", border: "1.5px solid " + (expandSection === "startTime" ? "#7B73D6" : "transparent"), borderRadius: 10, padding: "8px 12px", fontSize: 13, fontWeight: 600, color: "#3C3489", cursor: "pointer" }}
                >
                  {minutesToLabel(editStart)}
                </button>
                {expandSection === "startTime" && (
                  <div style={{ marginTop: 6, background: "#F3F0FE", borderRadius: 12, padding: 10 }}>
                    <EditTimePicker
                      selected={editStart}
                      min={7 * 60}
                      max={latestStart}
                      step={15}
                      onSelect={(t) => {
                        setEditStart(t);
                        setEditDuration((prev) => {
                          const nextEnd = Math.max(t + 15, t + prev);
                          return Math.min(22 * 60, nextEnd) - t;
                        });
                        setExpandSection(null);
                      }}
                    />
                  </div>
                )}
              </div>

              {/* End time */}
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: "#AAA", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 4 }}>End time</label>
                <button
                  type="button"
                  onClick={() => setExpandSection(s => s === "endTime" ? null : "endTime")}
                  style={{ width: "100%", textAlign: "left", background: expandSection === "endTime" ? "#EBE8FC" : "#F5F3F0", border: "1.5px solid " + (expandSection === "endTime" ? "#7B73D6" : "transparent"), borderRadius: 10, padding: "8px 12px", fontSize: 13, fontWeight: 600, color: "#3C3489", cursor: "pointer" }}
                >
                  {minutesToLabel(endMin)}
                </button>
                {expandSection === "endTime" && (
                  <div style={{ marginTop: 6, background: "#F3F0FE", borderRadius: 12, padding: 10 }}>
                    <EditTimePicker
                      selected={endMin}
                      min={earliestEnd}
                      max={22 * 60}
                      step={15}
                      onSelect={(t) => {
                        setEditDuration(Math.max(15, t - editStart));
                        setExpandSection(null);
                      }}
                    />
                  </div>
                )}
              </div>

              {/* Duration summary */}
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: "#AAA", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 4 }}>Duration</label>
                <div style={{ background: "#F5F3F0", borderRadius: 10, padding: "8px 12px", fontSize: 13, fontWeight: 600, color: "#3C3489" }}>
                  {durationLabel(editDuration)}
                </div>
              </div>

              {/* Tag */}
              {tags && tags.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: "#AAA", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 4 }}>Tag</label>
                  <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                    <button type="button" onClick={() => setEditTagId("")} style={{
                      padding: "5px 12px", borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: "pointer",
                      background: editTagId === "" ? "#555" : "#F0EDEA",
                      color: editTagId === "" ? "#fff" : "#888",
                      border: "none",
                    }}>none</button>
                    {tags.map(t => {
                      const tc = tagColors(t.id);
                      return (
                        <button type="button" key={t.id} onClick={() => setEditTagId(t.id)} style={{
                          padding: "5px 12px", borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: "pointer",
                          background: editTagId === t.id ? tc.text : tc.bg,
                          color: editTagId === t.id ? "#fff" : tc.text,
                          border: "none",
                        }}>#{t.name}</button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Confidence */}
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: "#AAA", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 4 }}>Confidence</label>
                <div style={{ display: "flex", gap: 6 }}>
                  <button type="button" onClick={() => setEditTentative(false)} style={{
                    flex: 1,
                    padding: "8px 12px",
                    borderRadius: 10,
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                    background: !editTentative ? "#3C3489" : "#F5F3F0",
                    color: !editTentative ? "#fff" : "#3C3489",
                    border: "1.5px solid " + (!editTentative ? "#3C3489" : "rgba(123,115,214,0.22)"),
                  }}>
                    Confirmed
                  </button>
                  <button type="button" onClick={() => setEditTentative(true)} style={{
                    flex: 1,
                    padding: "8px 12px",
                    borderRadius: 10,
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                    background: editTentative ? "#F4EEE2" : "#F5F3F0",
                    color: editTentative ? "#7A5423" : "#3C3489",
                    border: "1.5px dashed " + (editTentative ? "#C39A63" : "rgba(123,115,214,0.22)"),
                  }}>
                    Maybe / tentative
                  </button>
                </div>
              </div>

              {/* Location */}
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: "#AAA", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 4 }}>Location</label>
                <input
                  value={editLocation}
                  onChange={e => setEditLocation(e.target.value)}
                  placeholder="e.g. Coffee Lab, Zoom…"
                  style={{ width: "100%", background: "#F5F3F0", border: "1.5px solid rgba(123,115,214,0.22)", borderRadius: 10, padding: "8px 12px", fontSize: 13, color: "#3C3489", outline: "none", boxSizing: "border-box" }}
                />
              </div>

              {/* People */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: "#AAA", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 4 }}>People</label>
                <input
                  value={editPeople}
                  onChange={e => setEditPeople(e.target.value)}
                  placeholder="e.g. Alice, the team…"
                  style={{ width: "100%", background: "#F5F3F0", border: "1.5px solid rgba(123,115,214,0.22)", borderRadius: 10, padding: "8px 12px", fontSize: 13, color: "#3C3489", outline: "none", boxSizing: "border-box" }}
                />
              </div>

              {/* Save / Cancel */}
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" onClick={saveAll} style={{ flex: 1, background: "#3C3489", color: "#fff", border: "none", borderRadius: 12, padding: "10px 0", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                  Save changes
                </button>
                <button type="button" onClick={cancelEdit} style={{ flex: 1, background: "#F0EDEA", color: "#666", border: "none", borderRadius: 12, padding: "10px 0", fontSize: 13, cursor: "pointer" }}>
                  Cancel
                </button>
              </div>
            </div>

          ) : (
            /* ── VIEW MODE ── */
            <div style={{ padding: "0 18px 10px" }}>
              <FieldRow label="Date" value={dateLabel} />
              <FieldRow label="Time" value={<>{minutesToLabel(event.start)} → {minutesToLabel(displayEndMin)} <span style={{ fontSize: 11, color: "#bbb" }}>· {durationLabel(event.duration)}</span></>} />
              {displayTag && <FieldRow label="Tag" value={<span style={{ fontSize: 12, fontWeight: 700, background: tagColors(displayTag.id).bg, color: tagColors(displayTag.id).text, borderRadius: 12, padding: "2px 10px" }}>#{displayTag.name}</span>} />}
              {isTentative && (
                <FieldRow label="Status" value={
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#7A5423", background: "#F6E7CF", borderRadius: 12, padding: "2px 10px", border: "1px dashed #D3AE78" }}>
                    tentative
                  </span>
                } />
              )}
              {event.where && <FieldRow label="Where" value={<>📍 {event.where}</>} />}
              {event.who && <FieldRow label="Who" value={<>👥 {event.who}</>} />}
              {(isCompleted || isSkipped) && (
                <FieldRow label="Status" value={
                  <span style={{ fontSize: 12, fontWeight: 600, color: isCompleted ? "#27500A" : "#888", background: isCompleted ? "#D8F0B8" : "#EDEBE7", borderRadius: 12, padding: "2px 10px" }}>
                    {isCompleted ? "✓ done" : "✗ didn't happen"}
                  </span>
                } />
              )}

              {/* Attached items */}
              {(event.attachedItems?.length ?? 0) > 0 && (
                <div style={{ marginTop: 12 }}>
                  <p style={{ fontSize: 10, fontWeight: 700, color: "#bbb", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Attached</p>
                  {event.attachedItems!.map((att) => {
                    const Icon = KIND_ICON[att.kind] ?? Lightbulb;
                    const kc = KIND_COLORS[att.kind];
                    return (
                      <div key={att.id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, background: "#F5F3F0", borderRadius: 8, padding: "6px 8px" }}>
                        <span style={{ width: 20, height: 20, borderRadius: 6, background: kc.bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <Icon size={11} color={kc.text} strokeWidth={2} />
                        </span>
                        <span style={{ fontSize: 12, fontWeight: 500, color: "#333", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{att.title}</span>
                        {att.url && (
                          <button type="button" onClick={() => window.open(att.url, "_blank")} style={{ background: "none", border: "none", cursor: "pointer", padding: 2, color: "#aaa" }}>
                            <ExternalLink size={11} />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* ── Spending tracker ── */}
              <div style={{ marginTop: 16, borderTop: "1px solid #EDEBE7", paddingTop: 14 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: "#bbb", textTransform: "uppercase", letterSpacing: "0.06em" }}>Spending</span>
                    {(event.spendings?.length ?? 0) > 0 && (
                      <span style={{ fontSize: 11, fontWeight: 700, color: "#3C3489", background: "#EEEDFE", borderRadius: 20, padding: "1px 8px" }}>
                        {totalSpendings(event.spendings!)}
                      </span>
                    )}
                  </div>
                  {onUpdate && (
                    <button
                      type="button"
                      onClick={() => setShowSpending((v) => !v)}
                      style={{ display: "flex", alignItems: "center", gap: 4, background: showSpending ? "#EBE8FC" : "#F5F3F0", border: "none", borderRadius: 8, padding: "4px 9px", fontSize: 11, fontWeight: 600, color: "#3C3489", cursor: "pointer" }}
                    >
                      <Plus size={11} strokeWidth={2.5} /> Add
                    </button>
                  )}
                </div>

                {/* Existing spending records */}
                {(event.spendings?.length ?? 0) > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: showSpending ? 10 : 0 }}>
                    {event.spendings!.map((s) => {
                      const cat = SPENDING_CATEGORIES.find((c) => c.id === s.category);
                      return (
                        <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 8, background: "#F8F6F3", borderRadius: 9, padding: "7px 10px" }}>
                          <span style={{ fontSize: 14, lineHeight: 1, flexShrink: 0 }}>{cat?.emoji ?? "📎"}</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12, fontWeight: 600, color: "#222", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.label}</div>
                            <div style={{ fontSize: 10, color: "#999", marginTop: 1 }}>{cat?.label ?? s.category}</div>
                          </div>
                          <span style={{ fontSize: 13, fontWeight: 700, color: "#3C3489", flexShrink: 0 }}>
                            {formatAmount(s.amount, s.currency)}
                          </span>
                          {onUpdate && (
                            <button
                              type="button"
                              onClick={() => deleteSpending(s.id)}
                              style={{ background: "none", border: "none", cursor: "pointer", color: "#ccc", padding: 2, display: "flex", alignItems: "center" }}
                              title="Remove"
                            >
                              <X size={12} strokeWidth={2.5} />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Add spending form */}
                {showSpending && (
                  <div style={{ background: "#F3F0FE", borderRadius: 12, padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                    {/* Amount + currency row */}
                    <div style={{ display: "flex", gap: 6 }}>
                      <input
                        autoFocus
                        type="number"
                        min="0"
                        step="0.01"
                        value={spendAmount}
                        onChange={(e) => setSpendAmount(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") addSpending(); if (e.key === "Escape") setShowSpending(false); }}
                        placeholder="0.00"
                        style={{ flex: 1, background: "#fff", border: "1.5px solid #C5BEF5", borderRadius: 8, padding: "7px 10px", fontSize: 14, fontWeight: 600, color: "#3C3489", outline: "none", minWidth: 0 }}
                      />
                      <input
                        value={spendCurrency}
                        onChange={(e) => setSpendCurrency(e.target.value.toUpperCase().slice(0, 3))}
                        placeholder="USD"
                        maxLength={3}
                        style={{ width: 52, background: "#fff", border: "1.5px solid #C5BEF5", borderRadius: 8, padding: "7px 8px", fontSize: 12, fontWeight: 700, color: "#3C3489", outline: "none", textAlign: "center" }}
                      />
                    </div>
                    {/* Label */}
                    <input
                      value={spendLabel}
                      onChange={(e) => setSpendLabel(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") addSpending(); if (e.key === "Escape") setShowSpending(false); }}
                      placeholder="What was it for? (e.g. Coffee)"
                      style={{ background: "#fff", border: "1.5px solid #C5BEF5", borderRadius: 8, padding: "7px 10px", fontSize: 13, color: "#333", outline: "none" }}
                    />
                    {/* Category pills */}
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                      {SPENDING_CATEGORIES.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => setSpendCategory(c.id)}
                          style={{
                            display: "flex", alignItems: "center", gap: 3,
                            padding: "3px 9px", borderRadius: 20, fontSize: 11, fontWeight: 600,
                            cursor: "pointer",
                            background: spendCategory === c.id ? "#3C3489" : "#fff",
                            color: spendCategory === c.id ? "#fff" : "#555",
                            border: spendCategory === c.id ? "1.5px solid #3C3489" : "1.5px solid #DDD",
                            transition: "all 0.1s",
                          }}
                        >
                          {c.emoji} {c.label}
                        </button>
                      ))}
                    </div>
                    {/* Save row */}
                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        type="button"
                        onClick={addSpending}
                        style={{ flex: 1, background: "#3C3489", color: "#fff", border: "none", borderRadius: 9, padding: "8px 0", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowSpending(false)}
                        style={{ flex: 1, background: "#E8E4DF", color: "#666", border: "none", borderRadius: 9, padding: "8px 0", fontSize: 13, cursor: "pointer" }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {(event.spendings?.length ?? 0) === 0 && !showSpending && (
                  <p style={{ fontSize: 11, color: "#C8C4BE", fontStyle: "italic" }}>No spending recorded</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── Bottom actions (Done / Skip / Delete) — always visible ── */}
        {!editMode && (
          <div style={{ flexShrink: 0, borderTop: "1px solid #EDEBE7" }}>
            {onMark && (
              <div style={{ padding: "12px 18px 8px", display: "flex", gap: 8 }}>
                <button
                  type="button"
                  onClick={() => { onMark(true); setShowDetail(false); }}
                  style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, background: isCompleted ? "#C8E6A8" : "#EBF3D8", color: "#2E5513", border: isCompleted ? "2px solid #8DC86E" : "2px solid transparent", borderRadius: 12, padding: "10px 0", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
                >
                  <Check size={14} strokeWidth={2.5} /> Done
                </button>
                <button
                  type="button"
                  onClick={() => { onMark(false); setShowDetail(false); }}
                  style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, background: isSkipped ? "#DEDAD4" : "#F5F3F0", color: "#555", border: isSkipped ? "2px solid #B0ABA4" : "2px solid transparent", borderRadius: 12, padding: "10px 0", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
                >
                  <Ban size={14} strokeWidth={2} /> Skip
                </button>
                {event.completed != null && (
                  <button
                    type="button"
                    onClick={() => { onMark(null); setShowDetail(false); }}
                    title="Undo status"
                    style={{ display: "flex", alignItems: "center", justifyContent: "center", background: "#F5F3F0", color: "#999", border: "none", borderRadius: 12, padding: "10px 12px", cursor: "pointer" }}
                  >
                    <RotateCcw size={14} strokeWidth={2} />
                  </button>
                )}
              </div>
            )}

            {(onCopy || onDelete) && (
              <div style={{ padding: "0 18px 16px", display: "flex", gap: 8 }}>
                {onCopy && (
                  <button
                    type="button"
                    onClick={() => { onCopy(event); setShowDetail(false); }}
                    style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, background: "#F0EDFE", color: "#3C3489", border: "1.5px solid #C8BEF5", borderRadius: 12, padding: "10px 0", fontSize: 13, fontWeight: 600, cursor: "pointer", transition: "background 0.15s" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#E2DCFD")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "#F0EDFE")}
                  >
                    Copy
                  </button>
                )}
                {onDelete && (
                  <button
                    type="button"
                    onClick={() => { onDelete(); setShowDetail(false); }}
                    style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, background: "#FEF0EE", color: "#C0392B", border: "1.5px solid #FACEC9", borderRadius: 12, padding: "10px 0", fontSize: 13, fontWeight: 600, cursor: "pointer", transition: "background 0.15s" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#FDDBD8")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "#FEF0EE")}
                  >
                    <Trash2 size={14} strokeWidth={2} /> Delete
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </motion.div>
    </>,
    document.body
  );

  return (
    <>
      <motion.div
        ref={bubbleRef}
        layoutId={`event-${event.id}`}
        initial={{ scale: 0.8, opacity: 0, x: -200, y: 100 }}
        animate={{ scale: 1, opacity: 1, x: 0, y: 0 }}
        exit={{ scale: 0.9, opacity: 0 }}
        transition={{ type: "spring", stiffness: 350, damping: 25 }}
        whileHover={{ y: -1 }}
        onClick={handleBubbleClick}
        style={{
          borderRadius: 12,
          background: bgColor,
          padding: "8px 12px",
          cursor: "pointer",
          position: "relative",
          border: isTentative && !isCompleted && !isSkipped
            ? "2px dashed #534AB7"
            : "none",
          opacity: isSkipped ? 0.72 : 1,
          userSelect: "none",
          height: "100%",
          boxSizing: "border-box",
          overflow: "visible",
          outline: showDetail ? `2px solid ${colors.text}44` : "none",
          outlineOffset: 2,
          display: "flex",
          flexDirection: "column",
          boxShadow: "none",
        }}
      >
        {/* In-progress state: left border only */}
        {isInProgress && !isCompleted && !isSkipped && (
          <div style={{
            position: "absolute",
            top: 0,
            left: 0,
            bottom: 0,
            width: 3,
            background: colors.text,
            borderRadius: "12px 0 0 12px",
            zIndex: 1,
          }} />
        )}

        {/* Left accent bar for other states (not in-progress) */}
        {!isInProgress && !(isTentative && !isCompleted && !isSkipped) && !isCompleted && !isSkipped && (
          <div style={{
            position: "absolute",
            top: 6, bottom: 6, left: 0,
            width: 3,
            borderRadius: "0 2px 2px 0",
            background: colors.sub,
            zIndex: 1,
          }} />
        )}

        {/* Tentative "?" badge — top-right corner */}
        {isTentative && !isCompleted && !isSkipped && (
          <div
            style={{
              position: "absolute",
              top: -7,
              right: -7,
              width: 20,
              height: 20,
              borderRadius: "50%",
              background: "#534AB7",
              border: "2px solid white",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 4,
            }}
          >
            <span style={{ fontSize: 10, fontWeight: 700, color: "#fff", lineHeight: 1 }}>?</span>
          </div>
        )}

        {/* Tentative "maybe" pill inside card */}
        {isTentative && !isCompleted && !isSkipped && (
          <span style={{
            position: "absolute",
            top: 6,
            right: 6,
            fontSize: 9,
            fontWeight: 500,
            background: "#CECBF6",
            color: "#3C3489",
            borderRadius: 20,
            padding: "2px 6px",
          }}>
            maybe
          </span>
        )}

        {/* Completed badge */}
        {isCompleted && (
          <div style={{ position: "absolute", top: -7, right: -7, width: 20, height: 20, borderRadius: "50%", background: "#3B6D11", border: "2px solid white", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
          </div>
        )}

        {/* Skipped badge */}
        {isSkipped && (
          <div style={{ position: "absolute", top: -7, right: -7, width: 20, height: 20, borderRadius: "50%", background: "#5F5E5A", border: "2px solid white", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </div>
        )}

        {/* Title */}
        <div style={{ position: "relative", zIndex: 1, flex: "0 0 auto", minHeight: 0, marginTop: isInProgress && !isCompleted && !isSkipped ? 14 : 0 }}>
          <span style={{
            fontSize: 12,
            fontWeight: 500,
            fontFamily: "'Lora', Georgia, serif",
            color: textColor,
            textDecoration: isSkipped ? "line-through" : "none",
            lineHeight: 1.3,
            display: "-webkit-box",
            WebkitLineClamp: 3,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}>
            {event.title}
          </span>
        </div>

        {/* Subtitle */}
        <p style={{
          position: "relative", zIndex: 1,
          fontSize: 10, color: subColor,
          marginTop: 3, fontWeight: 400,
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          flex: "0 0 auto",
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}>
          <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>
            {minutesToLabel(event.start)} · {durationLabel(event.duration)}
          </span>
          {tag && (
            <span style={{
              flexShrink: 0,
              fontSize: 9,
              fontWeight: 500,
              color: colors.text,
              background: colors.pale,
              borderRadius: 20,
              padding: "2px 7px",
              lineHeight: 1.2,
            }}>
              #{tag.name}
            </span>
          )}
        </p>

        {/* Spending badge */}
        {(event.spendings?.length ?? 0) > 0 && (
          <div style={{
            position: "relative", zIndex: 1,
            marginTop: 2,
            display: "inline-flex",
            alignItems: "center",
            gap: 3,
            background: "rgba(0,0,0,0.10)",
            borderRadius: 20,
            padding: "1px 6px",
            alignSelf: "flex-start",
          }}>
            <span style={{ fontSize: 9 }}>💸</span>
            <span style={{ fontSize: 9, fontWeight: 600, color: textColor, opacity: 0.85 }}>
              {totalSpendings(event.spendings!)}
            </span>
          </div>
        )}

        {/* Location / people badges */}
        {(event.where || event.who) && (
          <div style={{
            position: "relative", zIndex: 1,
            marginTop: 3,
            display: "flex", gap: 4, flexWrap: "nowrap",
            overflow: "hidden",
            flex: "0 0 auto",
          }}>
            {event.where && (
              <span style={{ fontSize: 10, color: subColor, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                📍 {event.where}
              </span>
            )}
            {event.who && (
              <span style={{ fontSize: 10, color: subColor, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                👥 {event.who}
              </span>
            )}
          </div>
        )}
      </motion.div>

      {detailPanel}
    </>
  );
}
