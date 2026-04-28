import { Fragment, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { format, isToday, parseISO } from "date-fns";
import { Lightbulb, Link2, FileText, Bookmark, Square, ExternalLink, X, Calendar, Zap } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { CalEvent, CaptureItem, CaptureKind } from "@/types/event";
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
      draggable
      onDragStart={e => { e.dataTransfer.setData("text/capture-json", JSON.stringify(item)); e.dataTransfer.effectAllowed = "copy"; }}
      style={{
        borderRadius: 10,
        background: "#FAFAFA",
        border: "0.5px solid #E5E4E0",
        marginBottom: 5,
        padding: "8px 10px",
        cursor: "grab",
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

  const [placingItem, setPlacingItem] = useState<CaptureItem | null>(null);
  const [placeAnchor, setPlaceAnchor] = useState({ x: 0, y: 0 });

  // Reset form whenever the selected day changes so items always go to the visible day
  useEffect(() => {
    setAdding(null);
    setDraftTitle("");
    setDraftUrl("");
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

      {/* ── Always-visible composer ── */}
      {(() => {
        const detectedKind: CaptureKind = /^https?:\/\//.test(draftTitle.trim()) ? "link" : (adding ?? "thought");
        const activeKind = adding ?? detectedKind;
        const KindIcon = kindMeta(activeKind).icon;
        const [kindPickerOpen, setKindPickerOpen] = useState(false);
        const hasContent = draftTitle.trim().length > 0;

        return (
          <div style={{ borderRadius: 12, background: "#F7F5F2", border: "1px solid #E8E5E0", marginBottom: 10, overflow: "hidden" }}>
            <Textarea
              ref={draftTitleRef}
              value={draftTitle}
              onChange={(e) => {
                const val = e.target.value;
                setDraftTitle(val);
                // Auto-switch to link kind when a URL is pasted
                if (/^https?:\/\//.test(val.trim())) {
                  setAdding("link");
                  if (!draftUrl) setDraftUrl(val.trim());
                } else if (adding === "link" && !/^https?:\/\//.test(val.trim()) && val.trim() !== "") {
                  // typed label for a link — keep link kind but don't override
                }
              }}
              onFocus={() => { if (!adding) setAdding("thought"); }}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "b") { e.preventDefault(); toggleDraftBold(); return; }
                if (e.key === "Escape") { setAdding(null); setDraftTitle(""); setDraftUrl(""); return; }
                if (e.key === "Enter" && !e.shiftKey && hasContent) { e.preventDefault(); commitAdd(); }
              }}
              placeholder="what's on your mind?"
              rows={adding ? 3 : 1}
              className="min-h-0 resize-none border-none bg-transparent px-0 py-0 text-[13px] shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
              style={{ width: "100%", background: "transparent", color: "#2A2825", padding: "10px 12px", fontWeight: 400, lineHeight: 1.5 }}
            />

            {/* URL field — only for link kind when there's a label */}
            {adding === "link" && draftTitle.trim() && !/^https?:\/\//.test(draftTitle.trim()) && (
              <input
                value={draftUrl}
                onChange={(e) => setDraftUrl(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") commitAdd(); if (e.key === "Escape") { setAdding(null); setDraftTitle(""); setDraftUrl(""); } }}
                placeholder="https://…"
                style={{ width: "100%", background: "transparent", border: "none", borderTop: "1px solid #E8E5E0", outline: "none", fontSize: 12, padding: "6px 12px", color: "#5F5E5A", boxSizing: "border-box" }}
              />
            )}

            {/* Footer: kind pill + add button — only when focused/has content */}
            {adding && (
              <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 10px", borderTop: "1px solid #EDEBE7" }}>
                {/* Kind selector */}
                <div style={{ position: "relative" }}>
                  <button
                    type="button"
                    onMouseDown={e => e.preventDefault()}
                    onClick={() => setKindPickerOpen(v => !v)}
                    style={{ display: "flex", alignItems: "center", gap: 4, borderRadius: 20, padding: "3px 8px", background: "#EEEDFE", border: "none", cursor: "pointer", fontSize: 10, fontWeight: 600, color: "#534AB7" }}
                  >
                    <KindIcon size={9} strokeWidth={2.2} color="#534AB7" />
                    {activeKind}
                    <span style={{ fontSize: 8, opacity: 0.6 }}>▾</span>
                  </button>
                  {kindPickerOpen && (
                    <>
                      <div style={{ position: "fixed", inset: 0, zIndex: 90 }} onClick={() => setKindPickerOpen(false)} />
                      <div style={{ position: "absolute", bottom: "calc(100% + 4px)", left: 0, background: "#fff", border: "1px solid #E8E5E0", borderRadius: 10, padding: 4, zIndex: 91, boxShadow: "0 8px 24px rgba(0,0,0,0.10)", minWidth: 110 }}>
                        {KINDS.map(k => {
                          const Icon = k.icon;
                          return (
                            <button key={k.id} type="button" onMouseDown={e => e.preventDefault()} onClick={() => { setAdding(k.id); setKindPickerOpen(false); }}
                              style={{ display: "flex", alignItems: "center", gap: 7, width: "100%", padding: "5px 8px", background: activeKind === k.id ? "#EEEDFE" : "transparent", border: "none", borderRadius: 7, cursor: "pointer", fontSize: 11, fontWeight: activeKind === k.id ? 600 : 400, color: activeKind === k.id ? "#534AB7" : "#444441", textAlign: "left" }}
                            >
                              <Icon size={10} strokeWidth={2} color={activeKind === k.id ? "#534AB7" : "#888"} />
                              {k.label}
                            </button>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>

                <span style={{ fontSize: 9, color: "#C0BDB8", marginLeft: 2 }}>Shift+Enter new line</span>

                <div style={{ marginLeft: "auto", display: "flex", gap: 5 }}>
                  <button type="button" onClick={() => { setAdding(null); setDraftTitle(""); setDraftUrl(""); }} style={{ borderRadius: 20, background: "transparent", border: "none", padding: "4px 8px", fontSize: 11, color: "#AAA", cursor: "pointer" }}>
                    esc
                  </button>
                  <button type="button" onClick={commitAdd} disabled={!hasContent}
                    style={{ borderRadius: 20, background: hasContent ? "#3C3489" : "#E8E5E0", color: hasContent ? "#fff" : "#AAA", border: "none", padding: "4px 14px", fontSize: 11, fontWeight: 600, cursor: hasContent ? "pointer" : "default", transition: "all 0.15s" }}>
                    Add
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* Unified item list */}
      <div style={{ flex: 1, overflowY: "auto" }} className="scrollbar-hidden">
        {allItems.length === 0 && (
          <div style={{ textAlign: "center", fontSize: 11, color: "hsl(var(--muted-foreground))", padding: "12px 0" }}>
            nothing in your backpack yet
          </div>
        )}
        <AnimatePresence initial={false}>
          {allItems.map((item) => {
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
