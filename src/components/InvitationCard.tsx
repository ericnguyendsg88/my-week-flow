import { useRef, useState } from "react";
import { format } from "date-fns";
import { createPortal } from "react-dom";
import { CalEvent } from "@/types/event";
import { minutesToLabel } from "@/lib/event-utils";

function tagPalette(tagId?: string): { bg: string; accent: string; text: string; dot: string; name: string } {
  switch (tagId) {
    case "work":     return { bg: "#EEEDFE", accent: "#534AB7", text: "#2A246B", dot: "#AFA9EC", name: "Work" };
    case "deepwork": return { bg: "#E1F5EE", accent: "#0F6E56", text: "#063A2F", dot: "#9FE1CB", name: "Deep Work" };
    case "study":    return { bg: "#E6F1FB", accent: "#185FA5", text: "#08305A", dot: "#B5D4F4", name: "Study" };
    case "personal": return { bg: "#FBEAF0", accent: "#993556", text: "#5C1D32", dot: "#F4C0D1", name: "Personal" };
    case "social":   return { bg: "#FAEEDA", accent: "#854F0B", text: "#4D2B05", dot: "#FAC775", name: "Social" };
    case "health":   return { bg: "#EAF3DE", accent: "#3B6D11", text: "#1A4D2A", dot: "#C0DD97", name: "Health" };
    case "errand":   return { bg: "#FAECE7", accent: "#993C1D", text: "#4D2800", dot: "#F5C4B3", name: "Errand" };
    default:         return { bg: "#F1EFE8", accent: "#5F5E5A", text: "#44403C", dot: "#D3D1C7", name: "Event" };
  }
}

function CardPreview({ event, cardRef }: { event: CalEvent; cardRef: React.RefObject<HTMLDivElement | null> }) {
  const p = tagPalette(event.tagId);
  const dateObj = new Date(event.date + "T00:00:00");
  const dayName = format(dateObj, "EEEE");
  const dateLabel = format(dateObj, "MMMM d, yyyy");
  const startLabel = minutesToLabel(event.start);
  const endLabel = minutesToLabel(event.start + event.duration);

  return (
    <div
      ref={cardRef}
      style={{
        width: 420,
        background: p.bg,
        borderRadius: 24,
        padding: "40px 36px 32px",
        fontFamily: "'DM Sans', sans-serif",
        position: "relative",
        overflow: "hidden",
        boxShadow: "0 4px 24px rgba(0,0,0,0.10)",
      }}
    >
      {/* Decorative circles */}
      <div style={{ position: "absolute", top: -40, right: -40, width: 180, height: 180, borderRadius: "50%", background: p.dot, opacity: 0.35 }} />
      <div style={{ position: "absolute", bottom: -30, left: -30, width: 120, height: 120, borderRadius: "50%", background: p.dot, opacity: 0.22 }} />
      <div style={{ position: "absolute", top: 60, right: 20, width: 60, height: 60, borderRadius: "50%", background: p.accent, opacity: 0.08 }} />

      {/* Tag chip */}
      <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: p.accent, borderRadius: 20, padding: "4px 12px", marginBottom: 28 }}>
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: "rgba(255,255,255,0.7)", flexShrink: 0 }} />
        <span style={{ fontSize: 10, fontWeight: 700, color: "#fff", letterSpacing: "0.08em", textTransform: "uppercase" }}>{p.name}</span>
      </div>

      {/* "You're invited" */}
      <div style={{ fontSize: 12, fontWeight: 600, color: p.accent, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 10, opacity: 0.75 }}>
        You're invited
      </div>

      {/* Event title */}
      <div style={{ fontSize: 28, fontWeight: 700, fontFamily: "'Lora', Georgia, serif", color: p.text, lineHeight: 1.25, marginBottom: 24, letterSpacing: "-0.01em" }}>
        {event.title}
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: p.accent, opacity: 0.15, marginBottom: 24 }} />

      {/* Date + time details */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: p.accent, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <rect x="2" y="3" width="12" height="11" rx="2" stroke="white" strokeWidth="1.4"/>
              <path d="M5 2v2M11 2v2M2 7h12" stroke="white" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: p.text }}>{dayName}</div>
            <div style={{ fontSize: 11, color: p.accent, fontWeight: 500, opacity: 0.8 }}>{dateLabel}</div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: p.accent, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="5.5" stroke="white" strokeWidth="1.4"/>
              <path d="M8 5v3.5l2 1.5" stroke="white" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: p.text }}>{startLabel} – {endLabel}</div>
            <div style={{ fontSize: 11, color: p.accent, fontWeight: 500, opacity: 0.8 }}>
              {Math.floor(event.duration / 60) > 0 ? `${Math.floor(event.duration / 60)}h ` : ""}
              {event.duration % 60 > 0 ? `${event.duration % 60}min` : ""}
            </div>
          </div>
        </div>
      </div>

      {/* Note */}
      {event.note && (
        <div style={{ background: "rgba(255,255,255,0.5)", borderRadius: 12, padding: "10px 14px", marginBottom: 20, fontSize: 12, color: p.text, lineHeight: 1.5, fontStyle: "italic" }}>
          "{event.note}"
        </div>
      )}

      {/* Footer */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 4 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 24, height: 24, borderRadius: 7, background: p.accent, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
              <path d="M8 2L14 6V10L8 14L2 10V6L8 2Z" stroke="rgba(255,255,255,0.9)" strokeWidth="1.4" strokeLinejoin="round"/>
              <circle cx="8" cy="8" r="2" fill="rgba(255,255,255,0.85)"/>
            </svg>
          </div>
          <span style={{ fontSize: 11, fontWeight: 700, color: p.accent, letterSpacing: "-0.01em" }}>Horizon</span>
        </div>
        <span style={{ fontSize: 10, color: p.accent, opacity: 0.5, fontWeight: 500 }}>horizon.app</span>
      </div>
    </div>
  );
}

export function InvitationModal({ event, onClose }: { event: CalEvent; onClose: () => void }) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [copying, setCopying] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [copied, setCopied] = useState(false);
  const p = tagPalette(event.tagId);

  async function captureCard(): Promise<Blob | null> {
    const node = cardRef.current;
    if (!node) return null;
    // Use html-to-image if available, else fallback to native share text
    try {
      const { toPng } = await import("html-to-image");
      const dataUrl = await toPng(node, { pixelRatio: 2 });
      const res = await fetch(dataUrl);
      return await res.blob();
    } catch {
      return null;
    }
  }

  async function handleDownload() {
    setDownloading(true);
    try {
      const { toPng } = await import("html-to-image");
      const node = cardRef.current;
      if (!node) return;
      const dataUrl = await toPng(node, { pixelRatio: 2 });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `invite-${event.title.replace(/\s+/g, "-").toLowerCase()}.png`;
      a.click();
    } catch {
      // fallback: nothing
    } finally {
      setDownloading(false);
    }
  }

  async function handleCopyImage() {
    setCopying(true);
    try {
      const blob = await captureCard();
      if (blob && navigator.clipboard?.write) {
        await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } else {
        // Fallback: copy text invite
        const dateObj = new Date(event.date + "T00:00:00");
        const text = `📅 You're invited!\n\n${event.title}\n${format(dateObj, "EEEE, MMMM d, yyyy")}\n${minutesToLabel(event.start)} – ${minutesToLabel(event.start + event.duration)}\n\nSent via Horizon`;
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } finally {
      setCopying(false);
    }
  }

  async function handleNativeShare() {
    const blob = await captureCard();
    const dateObj = new Date(event.date + "T00:00:00");
    const text = `📅 ${event.title} — ${format(dateObj, "EEEE, MMMM d")} at ${minutesToLabel(event.start)}`;
    if (blob && navigator.canShare?.({ files: [new File([blob], "invite.png", { type: "image/png" })] })) {
      await navigator.share({ title: event.title, text, files: [new File([blob], "invite.png", { type: "image/png" })] });
    } else if (navigator.share) {
      await navigator.share({ title: event.title, text });
    }
  }

  const canNativeShare = typeof navigator !== "undefined" && !!navigator.share;

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", backdropFilter: "blur(6px)", zIndex: 400 }}
      />

      {/* Modal */}
      <div style={{
        position: "fixed", inset: 0, zIndex: 401,
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 24, pointerEvents: "none",
      }}>
        <div style={{
          pointerEvents: "auto",
          display: "flex", flexDirection: "column", alignItems: "center", gap: 20,
          animation: "fadeInUp 0.28s cubic-bezier(0.34,1.56,0.64,1)",
        }}>
          {/* Card preview */}
          <CardPreview event={event} cardRef={cardRef} />

          {/* Action buttons */}
          <div style={{ display: "flex", gap: 10 }}>
            {/* Copy image */}
            <button
              onClick={handleCopyImage}
              disabled={copying}
              style={{
                display: "flex", alignItems: "center", gap: 7,
                background: copied ? "#EAF3DE" : "#fff",
                border: `1.5px solid ${copied ? "#B8DDA0" : "#E0DCF8"}`,
                borderRadius: 14, padding: "10px 18px",
                fontSize: 13, fontWeight: 600,
                color: copied ? "#27500A" : "#3C3489",
                cursor: "pointer", transition: "all 0.15s",
                boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
              }}
              onMouseEnter={e => { if (!copied) e.currentTarget.style.background = "#EEEDFE"; }}
              onMouseLeave={e => { if (!copied) e.currentTarget.style.background = "#fff"; }}
            >
              {copied ? (
                <>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 7l4 4 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  Copied!
                </>
              ) : (
                <>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="4" y="4" width="8" height="8" rx="2" stroke="currentColor" strokeWidth="1.5"/><path d="M2 10V3a1 1 0 011-1h7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                  {copying ? "Copying…" : "Copy card"}
                </>
              )}
            </button>

            {/* Download */}
            <button
              onClick={handleDownload}
              disabled={downloading}
              style={{
                display: "flex", alignItems: "center", gap: 7,
                background: p.accent, border: "none",
                borderRadius: 14, padding: "10px 18px",
                fontSize: 13, fontWeight: 600, color: "#fff",
                cursor: "pointer", transition: "opacity 0.15s",
                boxShadow: `0 4px 14px ${p.accent}55`,
                opacity: downloading ? 0.7 : 1,
              }}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 1v7M4 6l3 3 3-3M1 11h12" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
              {downloading ? "Saving…" : "Download"}
            </button>

            {/* Native share (mobile) */}
            {canNativeShare && (
              <button
                onClick={handleNativeShare}
                style={{
                  display: "flex", alignItems: "center", gap: 7,
                  background: "#fff", border: "1.5px solid #E0DCF8",
                  borderRadius: 14, padding: "10px 18px",
                  fontSize: 13, fontWeight: 600, color: "#3C3489",
                  cursor: "pointer", transition: "all 0.15s",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                }}
                onMouseEnter={e => { e.currentTarget.style.background = "#EEEDFE"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "#fff"; }}
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="11" cy="3" r="1.5" stroke="currentColor" strokeWidth="1.4"/><circle cx="3" cy="7" r="1.5" stroke="currentColor" strokeWidth="1.4"/><circle cx="11" cy="11" r="1.5" stroke="currentColor" strokeWidth="1.4"/><path d="M4.5 7.8l5 2.4M4.5 6.2l5-2.4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
                Share
              </button>
            )}

            {/* Close */}
            <button
              onClick={onClose}
              style={{
                width: 42, height: 42, borderRadius: 12,
                background: "rgba(255,255,255,0.9)", border: "1.5px solid #E0DCF8",
                color: "#888", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 18, fontWeight: 300, transition: "all 0.15s",
                boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
              }}
              onMouseEnter={e => { e.currentTarget.style.background = "#fff"; e.currentTarget.style.color = "#444"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.9)"; e.currentTarget.style.color = "#888"; }}
            >
              ×
            </button>
          </div>

          <p style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", fontWeight: 500, margin: 0 }}>
            Share this card with friends so they can save the date
          </p>
        </div>
      </div>

      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(24px) scale(0.96); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </>,
    document.body
  );
}
