import { Fragment, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { format, isToday, parseISO } from "date-fns";
import { Lightbulb, Link2, FileText, Bookmark, Square, ExternalLink, X, Calendar, Zap } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { CalEvent, CaptureItem, CaptureKind, MealType } from "@/types/event";
import { useCaptures, addCapture, removeCapture, markCapturePlaced, patchCapture } from "@/lib/capture-store";
import { minutesToLabel } from "@/lib/event-utils";
import { fetchLinkPreview } from "@/lib/link-preview";
import { Textarea } from "@/components/ui/textarea";

const KINDS: {
  id: CaptureKind;
  label: string;
  icon: LucideIcon;
  bg: string;
  text: string;
  needsUrl?: boolean;
}[] = [
  { id: "thought", label: "thought", icon: Lightbulb,  bg: "#F1EFE8", text: "#444441" },
  { id: "link",    label: "link",    icon: Link2,       bg: "#F1EFE8", text: "#444441", needsUrl: true },
  { id: "file",    label: "file",    icon: FileText,    bg: "#F1EFE8", text: "#444441" },
  { id: "ref",     label: "ref",     icon: Bookmark,    bg: "#F1EFE8", text: "#444441" },
  { id: "task",    label: "task",    icon: Square,      bg: "#F1EFE8", text: "#444441" },
];

const MEALS: { type: MealType; emoji: string; label: string; placeholder: string }[] = [
  { type: "breakfast", emoji: "🍳", label: "Breakfast", placeholder: "what did you have for breakfast?" },
  { type: "lunch",     emoji: "🥗", label: "Lunch",     placeholder: "what did you have for lunch?" },
  { type: "dinner",    emoji: "🍽️", label: "Dinner",    placeholder: "what did you have for dinner?" },
];

const MEAL_COLORS: Record<MealType, { bg: string; text: string }> = {
  breakfast: { bg: "#F1EFE8", text: "#444441" },
  lunch:     { bg: "#F1EFE8", text: "#444441" },
  dinner:    { bg: "#F1EFE8", text: "#444441" },
};

function kindMeta(k: CaptureKind) {
  return KINDS.find((x) => x.id === k) ?? KINDS[0];
}

function renderFormattedText(text: string) {
  const lines = text.split("\n");
  return lines.map((line, lineIdx) => {
    const parts = line.split(/(\*\*[^*]+\*\*)/g);
    return (
      <Fragment key={lineIdx}>
        {parts.map((part, partIdx) => {
          const isBold = /^\*\*[^*]+\*\*$/.test(part);
          const content = isBold ? part.slice(2, -2) : part;
          return isBold ? <strong key={partIdx}>{content}</strong> : <Fragment key={partIdx}>{content}</Fragment>;
        })}
        {lineIdx < lines.length - 1 && <br />}
      </Fragment>
    );
  });
}

function Timestamp({ ts, color }: { ts: number; color: string }) {
  const d = new Date(ts);
  const label = isToday(d)
    ? format(d, "h:mm a").toLowerCase()
    : format(d, "MMM d · h:mm a").toLowerCase();
  return (
    <span style={{ fontSize: 10, color, fontWeight: 500, whiteSpace: "nowrap", flexShrink: 0 }}>
      {label}
    </span>
  );
}

// ── Shared action row ───────────────────────────────────────────
function CardActions({ onPlace, onRemove, accent }: { onPlace: (e: React.MouseEvent<HTMLButtonElement>) => void; onRemove: () => void; accent: { bg: string; text: string } }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 6 }}>
      <button
        type="button"
        onClick={onPlace}
        style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 9, fontWeight: 500, color: accent.text, background: accent.bg, border: "none", borderRadius: 5, padding: "2px 6px", cursor: "pointer", letterSpacing: "0.02em" }}
      >
        place →
      </button>
      <button
        type="button"
        onClick={onRemove}
        style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", padding: 2, color: "#D3D1C7" }}
      >
        <X size={9} />
      </button>
    </div>
  );
}

// ── Thought card — sticky note style ─────────────────────────────
function ThoughtCard({ item, onPlace, onRemove }: { item: CaptureItem; onPlace: (e: React.MouseEvent) => void; onRemove: () => void }) {
  return (
    <motion.div layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: item.placed ? 0.4 : 1, y: 0 }} exit={{ opacity: 0, x: -8 }}
      style={{ borderRadius: 10, background: "#FAFAFA", border: "0.5px solid #E5E4E0", marginBottom: 5, padding: "8px 10px", position: "relative" }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 5 }}>
        <div style={{ width: 16, height: 16, borderRadius: 4, background: "#F1EFE8", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Lightbulb size={9} color="#5F5E5A" strokeWidth={2} />
        </div>
        <span style={{ fontSize: 9, fontWeight: 500, color: "#5F5E5A", textTransform: "uppercase", letterSpacing: "0.07em" }}>thought</span>
        <span style={{ marginLeft: "auto" }}><Timestamp ts={item.createdAt} color="#A8A4A0" /></span>
      </div>
      <p style={{ fontSize: 13, fontWeight: 400, fontFamily: "'Lora', Georgia, serif", color: "#444441", lineHeight: 1.6, wordBreak: "break-word" }}>
        {renderFormattedText(item.title)}
      </p>
      <CardActions onPlace={onPlace} onRemove={onRemove} accent={{ bg: "#F1EFE8", text: "#444441" }} />
    </motion.div>
  );
}

// ── Task card — checkbox style ────────────────────────────────────
function TaskCard({ item, onPlace, onRemove }: { item: CaptureItem; onPlace: (e: React.MouseEvent) => void; onRemove: () => void }) {
  return (
    <motion.div layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: item.placed ? 0.4 : 1, y: 0 }} exit={{ opacity: 0, x: -8 }}
      style={{ borderRadius: 10, background: "#FAFAFA", border: "0.5px solid #E5E4E0", marginBottom: 5, padding: "8px 10px" }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
        <div style={{ width: 16, height: 16, borderRadius: 4, background: "#FAFAFA", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, border: "1.5px solid #D3D1C7" }}>
          <Square size={8} color="#5F5E5A" strokeWidth={2} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 13, fontWeight: 400, fontFamily: "'Lora', Georgia, serif", color: "#444441", lineHeight: 1.5, wordBreak: "break-word" }}>
            {renderFormattedText(item.title)}
          </p>
          <span style={{ marginTop: 3, display: "block" }}><Timestamp ts={item.createdAt} color="#A8A4A0" /></span>
        </div>
        <button onClick={onRemove} style={{ background: "none", border: "none", cursor: "pointer", padding: 2, color: "#D3D1C7", flexShrink: 0 }}>
          <X size={10} />
        </button>
      </div>
      <div style={{ marginLeft: 24 }}>
        <CardActions onPlace={onPlace} onRemove={onRemove} accent={{ bg: "#F1EFE8", text: "#444441" }} />
      </div>
    </motion.div>
  );
}

// ── Ref card — bookmark with left accent ─────────────────────────
function RefCard({ item, onPlace, onRemove }: { item: CaptureItem; onPlace: (e: React.MouseEvent) => void; onRemove: () => void }) {
  return (
    <motion.div layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: item.placed ? 0.4 : 1, y: 0 }} exit={{ opacity: 0, x: -8 }}
      style={{ borderRadius: 10, background: "#FAFAFA", border: "0.5px solid #E5E4E0", marginBottom: 5, padding: "8px 10px", display: "flex", gap: 8 }}
    >
      {/* Bookmark icon square */}
      <div style={{ width: 16, height: 16, borderRadius: 4, background: "#F1EFE8", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Bookmark size={9} color="#5F5E5A" strokeWidth={2} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 3 }}>
          <span style={{ fontSize: 9, fontWeight: 500, color: "#5F5E5A", textTransform: "uppercase", letterSpacing: "0.07em" }}>ref</span>
          <span style={{ marginLeft: "auto" }}><Timestamp ts={item.createdAt} color="#A8A4A0" /></span>
          <button onClick={onRemove} style={{ background: "none", border: "none", cursor: "pointer", padding: 1, color: "#D3D1C7" }}><X size={9} /></button>
        </div>
        <p style={{ fontSize: 13, fontWeight: 500, color: "#444441", lineHeight: 1.4, wordBreak: "break-word" }}>
          {item.title}
        </p>
        {item.url && (
          <p style={{ fontSize: 10, color: "#5F5E5A", marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", opacity: 0.75 }}>
            {item.url}
          </p>
        )}
        <CardActions onPlace={onPlace} onRemove={onRemove} accent={{ bg: "#F1EFE8", text: "#444441" }} />
      </div>
    </motion.div>
  );
}

// ── File card — folder/document aesthetic ────────────────────────
function FileCard({ item, onPlace, onRemove }: { item: CaptureItem; onPlace: (e: React.MouseEvent) => void; onRemove: () => void }) {
  const ext = item.title.includes(".") ? item.title.split(".").pop()?.toUpperCase() : null;
  const base = ext ? item.title.slice(0, item.title.lastIndexOf(".")) : item.title;
  return (
    <motion.div layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: item.placed ? 0.4 : 1, y: 0 }} exit={{ opacity: 0, x: -8 }}
      style={{ borderRadius: 10, background: "#FAFAFA", border: "0.5px solid #E5E4E0", marginBottom: 5, padding: "8px 10px" }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
        {/* File icon square */}
        <div style={{ width: 16, height: 16, borderRadius: 4, background: "#F1EFE8", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <FileText size={9} color="#5F5E5A" strokeWidth={2} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 2 }}>
            <span style={{ fontSize: 9, fontWeight: 500, color: "#5F5E5A", textTransform: "uppercase", letterSpacing: "0.07em" }}>file</span>
            <span style={{ marginLeft: "auto" }}><Timestamp ts={item.createdAt} color="#A8A4A0" /></span>
            <button onClick={onRemove} style={{ background: "none", border: "none", cursor: "pointer", padding: 1, color: "#D3D1C7" }}><X size={9} /></button>
          </div>
          <p style={{ fontSize: 13, fontWeight: 500, color: "#444441", lineHeight: 1.35, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {base}
          </p>
          <CardActions onPlace={onPlace} onRemove={onRemove} accent={{ bg: "#F1EFE8", text: "#444441" }} />
        </div>
      </div>
    </motion.div>
  );
}

interface PlacePickerProps {
  item: CaptureItem;
  anchorPos: { x: number; y: number };
  dayEvents: CalEvent[];
  onAttach: (eventId: string) => void;
  onCreateEvent: () => void;
  onClose: () => void;
}

function PlacePicker({ item, anchorPos, dayEvents, onAttach, onCreateEvent, onClose }: PlacePickerProps) {
  const meta = kindMeta(item.kind);
  const Icon = meta.icon;

  const panelW = 240;
  const x = anchorPos.x + panelW > window.innerWidth ? anchorPos.x - panelW - 8 : anchorPos.x + 8;
  const y = Math.min(anchorPos.y, window.innerHeight - 320);

  return createPortal(
    <>
      <div style={{ position: "fixed", inset: 0, zIndex: 998 }} onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.93, y: -4 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ type: "spring", stiffness: 420, damping: 28 }}
        style={{
          position: "fixed", left: x, top: y,
          width: panelW,
          background: "#FAFAF8",
          borderRadius: 16,
          boxShadow: "0 16px 48px -8px rgba(0,0,0,0.2), 0 4px 12px -4px rgba(0,0,0,0.08)",
          border: "1px solid rgba(0,0,0,0.07)",
          zIndex: 999,
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ padding: "12px 14px 8px", borderBottom: "1px solid #EDEBE7" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <span style={{ width: 20, height: 20, borderRadius: 6, background: meta.bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Icon size={11} color={meta.text} />
            </span>
            <p style={{ fontSize: 12, fontWeight: 700, color: "#111", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {item.ogTitle ?? item.title}
            </p>
            <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#aaa", padding: 2 }}>
              <X size={12} />
            </button>
          </div>
          <p style={{ fontSize: 10, color: "#aaa", fontWeight: 500 }}>attach this link to an event</p>
        </div>

        {/* Create event option */}
        <button
          onClick={onCreateEvent}
          style={{
            width: "100%", display: "flex", alignItems: "center", gap: 10,
            padding: "10px 14px", background: "none", border: "none", cursor: "pointer",
            textAlign: "left", borderBottom: "1px solid #EDEBE7",
            transition: "background 0.1s",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "#F3F0FE")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
        >
          <span style={{ width: 24, height: 24, borderRadius: 8, background: "#EBE8FC", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Zap size={13} color="#7B73D6" />
          </span>
          <div>
            <p style={{ fontSize: 12, fontWeight: 600, color: "#3C3489" }}>Create event</p>
            <p style={{ fontSize: 10, color: "#9B91E0" }}>add to calendar</p>
          </div>
        </button>

        {/* Attach to existing event */}
        <div style={{ maxHeight: 200, overflowY: "auto" }}>
          {dayEvents.length === 0 ? (
            <p style={{ fontSize: 11, color: "#aaa", padding: "12px 14px", textAlign: "center" }}>
              no events today to attach to
            </p>
          ) : (
            <>
              <p style={{ fontSize: 10, fontWeight: 600, color: "#aaa", padding: "8px 14px 4px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Attach to event
              </p>
              {dayEvents.map((ev) => (
                <button
                  key={ev.id}
                  onClick={() => onAttach(ev.id)}
                  style={{
                    width: "100%", display: "flex", alignItems: "center", gap: 10,
                    padding: "8px 14px", background: "none", border: "none", cursor: "pointer",
                    textAlign: "left", transition: "background 0.1s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#F5F3F0")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
                >
                  <span style={{ width: 24, height: 24, borderRadius: 8, background: "#F0EDEA", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Calendar size={12} color="#888" />
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: 12, fontWeight: 500, color: "#333", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ev.title}</p>
                    <p style={{ fontSize: 10, color: "#aaa" }}>{minutesToLabel(ev.start)}</p>
                  </div>
                </button>
              ))}
            </>
          )}
        </div>
      </motion.div>
    </>,
    document.body
  );
}

// ── Rich link card ──────────────────────────────────────────────────
function LinkCard({ item, onPlace, onRemove }: { item: CaptureItem; onPlace: (e: React.MouseEvent<HTMLButtonElement>) => void; onRemove: () => void }) {
  const hostname = (() => { try { return new URL(item.url ?? "").hostname.replace(/^www\./, ""); } catch { return ""; } })();
  const displayTitle = item.ogTitle ?? (item.title && item.title !== item.url ? item.title : null) ?? hostname ?? item.url;

  // Retry fetch for items that have a URL but no ogTitle yet
  useEffect(() => {
    if (!item.url || item.ogTitle || item.ogLoading) return;
    patchCapture(item.id, { ogLoading: true });
    fetchLinkPreview(item.url).then(preview => {
      patchCapture(item.id, { ogLoading: false, ogTitle: preview.title, ogDescription: preview.description, ogImage: preview.image, ogSite: preview.site });
    }).catch(() => {
      patchCapture(item.id, { ogLoading: false });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: item.placed ? 0.45 : 1, y: 0 }}
      exit={{ opacity: 0, x: -8 }}
      style={{
        borderRadius: 10,
        background: "#FAFAFA",
        border: "0.5px solid #E5E4E0",
        marginBottom: 5,
        padding: "8px 10px",
      }}
    >
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 5 }}>
        <div style={{ width: 16, height: 16, borderRadius: 4, background: "#F1EFE8", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Link2 size={9} color="#5F5E5A" strokeWidth={2} />
        </div>
        <span style={{ fontSize: 9, fontWeight: 500, color: "#5F5E5A", textTransform: "uppercase", letterSpacing: "0.06em", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {item.ogSite || hostname || "link"}
        </span>
        <Timestamp ts={item.createdAt} color="#A8A4A0" />
        <button type="button" onClick={onRemove} style={{ background: "none", border: "none", cursor: "pointer", padding: 1, color: "#D3D1C7" }}><X size={9} /></button>
      </div>

      {/* Bold title / URL */}
      {item.ogLoading ? (
        <div style={{ height: 14, borderRadius: 4, background: "#EDEBE7", marginBottom: 6, width: "70%", animation: "pulse 1.2s ease-in-out infinite" }} />
      ) : (
        <p
          onClick={() => item.url && window.open(item.url, "_blank")}
          style={{ fontSize: 13, fontWeight: 500, fontFamily: "'Lora', Georgia, serif", color: "#444441", lineHeight: 1.4, wordBreak: "break-word", cursor: item.url ? "pointer" : "default", marginBottom: 6 }}
        >
          {displayTitle}
        </p>
      )}

      {/* URL line */}
      {item.url && displayTitle !== item.url && (
        <p style={{ fontSize: 10, color: "#5F5E5A", marginBottom: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", opacity: 0.75 }}>
          {item.url}
        </p>
      )}

      {/* Actions */}
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <button
          type="button"
          onClick={() => item.url && window.open(item.url, "_blank")}
          style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 9, fontWeight: 500, color: "#444441", background: "#F1EFE8", border: "none", borderRadius: 5, padding: "2px 6px", cursor: "pointer" }}
        >
          open
        </button>
        <button
          type="button"
          onClick={onPlace}
          style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 9, fontWeight: 500, color: "#444441", background: "#F1EFE8", border: "none", borderRadius: 5, padding: "2px 6px", cursor: "pointer" }}
        >
          place →
        </button>
      </div>
    </motion.div>
  );
}

interface Props {
  selectedDayKey: string;
  dayEvents?: CalEvent[];
  onAttachToEvent?: (eventId: string, item: CaptureItem) => void;
  onCreateEventFromItem?: (item: CaptureItem) => void;
}

export function Backpack({ selectedDayKey, dayEvents = [], onAttachToEvent, onCreateEventFromItem }: Props) {
  const allItems = useCaptures(selectedDayKey);

  // Keep a ref always pointing to the current dayKey so async closures never capture stale values
  const selectedDayKeyRef = useRef(selectedDayKey);
  selectedDayKeyRef.current = selectedDayKey;

  const [adding, setAdding] = useState<CaptureKind | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftUrl, setDraftUrl] = useState("");
  const draftTitleRef = useRef<HTMLTextAreaElement>(null);

  const [addingMeal, setAddingMeal] = useState<MealType | null>(null);
  const [mealText, setMealText] = useState("");
  const mealInputRef = useRef<HTMLInputElement>(null);

  const [placingItem, setPlacingItem] = useState<CaptureItem | null>(null);
  const [placeAnchor, setPlaceAnchor] = useState({ x: 0, y: 0 });

  // Reset form whenever the selected day changes so items always go to the visible day
  useEffect(() => {
    setAdding(null);
    setAddingMeal(null);
    setDraftTitle("");
    setDraftUrl("");
    setMealText("");
    setPlacingItem(null);
  }, [selectedDayKey]);

  const committingRef = useRef(false);
  async function commitAdd() {
    if (!adding || !draftTitle.trim() || committingRef.current) return;
    committingRef.current = true;
    const url = draftUrl.trim() || undefined;
    // use ref so the dayKey is always current even if state hasn't re-rendered yet
    const dayKey = selectedDayKeyRef.current;
    const item = addCapture({ kind: adding, title: draftTitle.trim(), url, dayKey });
    setAdding(null);
    setDraftTitle("");
    setDraftUrl("");
    setTimeout(() => { committingRef.current = false; }, 200);

    // fetch link preview if URL provided
    if (adding === "link" && url) {
      patchCapture(item.id, { ogLoading: true });
      try {
        const preview = await fetchLinkPreview(url);
        patchCapture(item.id, {
          ogLoading: false,
          ogTitle: preview.title,
          ogDescription: preview.description,
          ogImage: preview.image,
          ogSite: preview.site,
        });
      } catch {
        patchCapture(item.id, { ogLoading: false });
      }
    }
  }

  // Also try to detect and fetch when user pastes a bare URL into the title field
  async function handleLinkTitleChange(val: string) {
    setDraftTitle(val);
    // if looks like a URL and no separate URL yet, mirror it
    if (/^https?:\/\//.test(val.trim()) && !draftUrl) {
      setDraftUrl(val.trim());
    }
  }

  function commitMeal() {
    if (!addingMeal || !mealText.trim()) return;
    addCapture({ kind: "meal", title: mealText.trim(), mealType: addingMeal, dayKey: selectedDayKeyRef.current });
    setAddingMeal(null);
    setMealText("");
  }

  function openMeal(type: MealType) {
    setAdding(null);
    setAddingMeal(type);
    setMealText("");
    setTimeout(() => mealInputRef.current?.focus(), 60);
  }

  function toggleDraftBold() {
    const el = draftTitleRef.current;
    if (!el) return;
    const start = el.selectionStart ?? draftTitle.length;
    const end = el.selectionEnd ?? draftTitle.length;
    const selected = draftTitle.slice(start, end);
    const replacement = `**${selected || "bold"}**`;
    const next = draftTitle.slice(0, start) + replacement + draftTitle.slice(end);
    setDraftTitle(next);
    setTimeout(() => {
      el.focus();
      const cursorStart = start + 2;
      const cursorEnd = start + replacement.length - 2;
      el.setSelectionRange(selected ? cursorStart : cursorStart, selected ? cursorEnd : cursorEnd);
    }, 0);
  }

  function openPlacePicker(item: CaptureItem, e: React.MouseEvent) {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setPlaceAnchor({ x: rect.right, y: rect.top });
    setPlacingItem(item);
  }

  function handleAttach(eventId: string) {
    if (!placingItem) return;
    onAttachToEvent?.(eventId, placingItem);
    markCapturePlaced(placingItem.id);
    setPlacingItem(null);
  }

  function handleCreateEvent() {
    if (!placingItem) return;
    onCreateEventFromItem?.(placingItem);
    markCapturePlaced(placingItem.id);
    setPlacingItem(null);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0, height: "100%", overflow: "hidden" }}>

      {/* ── Header ─────────────────────────── */}
      {(() => {
        const d = parseISO(selectedDayKey);
        const itIsToday = isToday(d);
        const dayLabel = itIsToday ? "today" : format(d, "EEE, MMM d");
        return (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "hsl(var(--muted-foreground))" }}>
              Backpack
            </span>
            <span style={{
              fontSize: 10, fontWeight: 700, borderRadius: 20,
              padding: "3px 9px",
              background: itIsToday ? "#EDF6EB" : "#EEEDFE",
              color: itIsToday ? "#1D5C17" : "#3C3489",
              letterSpacing: "0.02em",
            }}>
              {dayLabel}
            </span>
          </div>
        );
      })()}

      {/* Quick-add chips — captures */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 8 }}>
        {KINDS.map((k) => {
          const Icon = k.icon;
          const active = adding === k.id;
          return (
            <button
              key={k.id}
              onClick={() => { setAdding(active ? null : k.id); setAddingMeal(null); setDraftTitle(""); setDraftUrl(""); }}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                borderRadius: 20, padding: "5px 10px",
                fontSize: 10, fontWeight: 500,
                background: active ? k.text : k.bg,
                color: active ? "#fff" : k.text,
                border: active ? "none" : `0.5px solid ${k.text}`,
                cursor: "pointer", transition: "all 0.15s",
                letterSpacing: "0.01em",
              }}
            >
              <Icon size={10} color={active ? "#fff" : k.text} strokeWidth={2} />
              {k.label}
            </button>
          );
        })}
      </div>

      {/* Quick-add chips — meals */}
      <div style={{ display: "flex", gap: 7, marginBottom: 10, flexWrap: "wrap" }}>
        {MEALS.map((m) => {
          const logged = allItems.find((i) => i.kind === "meal" && i.mealType === m.type);
          const active = addingMeal === m.type;
          return (
            <button
              key={m.type}
              onClick={() => active ? setAddingMeal(null) : openMeal(m.type)}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                borderRadius: 20, padding: "5px 10px",
                fontSize: 10, fontWeight: 500,
                background: active ? "#444441" : logged ? "#F1EFE8" : "#F1EFE8",
                color: active ? "#fff" : logged ? "#444441" : "#888580",
                border: logged && !active ? "0.5px solid #444441" : active ? "none" : "0.5px solid transparent",
                cursor: "pointer", transition: "all 0.15s",
              }}
            >
              <span style={{ fontSize: 11 }}>{m.emoji}</span>
              {m.label}
              {logged && !active && <span style={{ fontSize: 9, opacity: 0.7 }}>✓</span>}
            </button>
          );
        })}
      </div>

      {/* Capture add form */}
      <AnimatePresence>
        {adding && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            style={{ overflow: "hidden", marginBottom: 8 }}
          >
            <div style={{ borderRadius: 10, background: "hsl(var(--muted))", padding: "10px 12px" }}>
              {(adding === "thought" || adding === "task") && (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={toggleDraftBold}
                      style={{ borderRadius: 8, border: "1px solid rgba(0,0,0,0.08)", background: "#fff", color: "hsl(var(--foreground))", padding: "4px 8px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}
                    >
                      B
                    </button>
                  </div>
                  <span style={{ fontSize: 10, color: "hsl(var(--muted-foreground))", fontWeight: 500 }}>
                    `Shift+Enter` new line
                  </span>
                </div>
              )}
              <Textarea
                ref={draftTitleRef}
                autoFocus
                value={draftTitle}
                onChange={(e) => adding === "link" ? handleLinkTitleChange(e.target.value) : setDraftTitle(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "b") {
                    e.preventDefault();
                    toggleDraftBold();
                    return;
                  }
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    commitAdd();
                  }
                }}
                placeholder={adding === "link" ? "paste a URL or label…" : `new ${adding}…`}
                rows={adding === "thought" || adding === "task" ? 3 : 2}
                className="min-h-0 resize-none border-none bg-transparent px-0 py-0 text-[13px] font-medium shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
                style={{ width: "100%", background: "transparent", color: "hsl(var(--foreground))" }}
              />
              {kindMeta(adding).needsUrl && (
                <input
                  value={draftUrl}
                  onChange={(e) => setDraftUrl(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && commitAdd()}
                  placeholder="https://…"
                  style={{ width: "100%", background: "transparent", border: "none", outline: "none", fontSize: 11, marginTop: 4, color: "hsl(var(--muted-foreground))" }}
                />
              )}
              <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                <button type="button" onClick={commitAdd} style={{ borderRadius: 20, background: "hsl(var(--foreground))", color: "#fff", border: "none", padding: "4px 12px", fontSize: 11, fontWeight: 500, cursor: "pointer" }}>Add</button>
                <button type="button" onClick={() => setAdding(null)} style={{ borderRadius: 20, background: "transparent", border: "none", padding: "4px 8px", fontSize: 11, color: "hsl(var(--muted-foreground))", cursor: "pointer" }}>cancel</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Meal add form */}
      <AnimatePresence>
        {addingMeal && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            style={{ overflow: "hidden", marginBottom: 8 }}
          >
            <div style={{
              borderRadius: 10,
              background: "#F1EFE8",
              padding: "10px 12px",
              border: "0.5px solid #D3D1C7",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                <span>{MEALS.find((m) => m.type === addingMeal)?.emoji}</span>
                <span style={{ fontSize: 11, fontWeight: 500, color: "#444441" }}>
                  {MEALS.find((m) => m.type === addingMeal)?.label}
                </span>
              </div>
              <input
                ref={mealInputRef}
                value={mealText}
                onChange={(e) => setMealText(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") commitMeal(); if (e.key === "Escape") setAddingMeal(null); }}
                placeholder={MEALS.find((m) => m.type === addingMeal)?.placeholder}
                style={{
                  width: "100%", background: "transparent", border: "none", outline: "none",
                  fontSize: 13, fontWeight: 500, color: "#444441",
                  boxSizing: "border-box",
                }}
              />
              <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                <button onClick={commitMeal} style={{ borderRadius: 20, background: "#444441", color: "#fff", border: "none", padding: "4px 12px", fontSize: 11, fontWeight: 500, cursor: "pointer" }}>Log</button>
                <button onClick={() => setAddingMeal(null)} style={{ borderRadius: 20, background: "transparent", border: "none", padding: "4px 8px", fontSize: 11, color: "#888580", cursor: "pointer", opacity: 0.7 }}>cancel</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Unified item list */}
      <div style={{ flex: 1, overflowY: "auto" }} className="scrollbar-hidden">
        {allItems.length === 0 && (
          <div style={{ textAlign: "center", fontSize: 11, color: "hsl(var(--muted-foreground))", padding: "12px 0" }}>
            nothing in your backpack yet
          </div>
        )}
        <AnimatePresence initial={false}>
          {allItems.map((item) => {
            if (item.kind === "meal") {
              const mealMeta = MEALS.find((m) => m.type === item.mealType)!;
              const colors = item.mealType ? MEAL_COLORS[item.mealType] : MEAL_COLORS.lunch;
              return (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -8 }}
                  style={{
                    display: "flex", alignItems: "center", gap: 8,
                    borderRadius: 10, background: "#FAFAFA",
                    border: "0.5px solid #E5E4E0",
                    padding: "8px 10px", marginBottom: 5,
                  }}
                >
                  <span style={{ fontSize: 14, flexShrink: 0 }}>{mealMeta?.emoji ?? "🍴"}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 11, fontWeight: 500, color: "#444441", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {item.title}
                    </p>
                    <span style={{ fontSize: 9, color: "#A8A4A0", opacity: 0.65 }}>
                      {mealMeta?.label ?? "meal"} · {format(item.createdAt, "h:mma").toLowerCase()}
                    </span>
                  </div>
                  <button
                    onClick={() => removeCapture(item.id)}
                    style={{ background: "none", border: "none", cursor: "pointer", padding: 2, color: "#D3D1C7", opacity: 0.4 }}
                  >
                    <X size={11} />
                  </button>
                </motion.div>
              );
            }

            // Rich link card
            if (item.kind === "link") {
              return (
                <LinkCard
                  key={item.id}
                  item={item}
                  onPlace={(e) => openPlacePicker(item, e)}
                  onRemove={() => removeCapture(item.id)}
                />
              );
            }

            if (item.kind === "thought") return <ThoughtCard key={item.id} item={item} onPlace={(e) => openPlacePicker(item, e)} onRemove={() => removeCapture(item.id)} />;
            if (item.kind === "task")    return <TaskCard    key={item.id} item={item} onPlace={(e) => openPlacePicker(item, e)} onRemove={() => removeCapture(item.id)} />;
            if (item.kind === "ref")     return <RefCard     key={item.id} item={item} onPlace={(e) => openPlacePicker(item, e)} onRemove={() => removeCapture(item.id)} />;
            if (item.kind === "file")    return <FileCard    key={item.id} item={item} onPlace={(e) => openPlacePicker(item, e)} onRemove={() => removeCapture(item.id)} />;
            return null;
          })}
        </AnimatePresence>
      </div>

      {/* Place picker portal */}
      <AnimatePresence>
        {placingItem && (
          <PlacePicker
            item={placingItem}
            anchorPos={placeAnchor}
            dayEvents={dayEvents}
            onAttach={handleAttach}
            onCreateEvent={handleCreateEvent}
            onClose={() => setPlacingItem(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
