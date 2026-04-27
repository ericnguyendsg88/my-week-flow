import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X, Copy, Check, Heart, Share2 } from "lucide-react";
import { CalEvent } from "@/types/event";
import { createInvitation, invitationUrl, Invitation, listRsvps, Rsvp } from "@/lib/invitations";
import { minutesToLabel } from "@/lib/event-utils";
import { format } from "date-fns";

interface Props {
  event: CalEvent;
  onClose: () => void;
}

function tagPalette(tagId?: string | null) {
  switch (tagId) {
    case "work":     return { bg: "#EEEDFE", ink: "#3C3489", accent: "#7B73D6" };
    case "deepwork": return { bg: "#E1F5EE", ink: "#085041", accent: "#0F6E56" };
    case "study":    return { bg: "#E6F1FB", ink: "#0C447C", accent: "#185FA5" };
    case "personal": return { bg: "#FBEAF0", ink: "#72243E", accent: "#993556" };
    case "social":   return { bg: "#FAEEDA", ink: "#633806", accent: "#854F0B" };
    case "health":   return { bg: "#EAF3DE", ink: "#27500A", accent: "#3B6D11" };
    case "errand":   return { bg: "#FAECE7", ink: "#712B13", accent: "#993C1D" };
    default:         return { bg: "#FBEAF0", ink: "#72243E", accent: "#993556" };
  }
}

export function ShareInviteModal({ event, onClose }: Props) {
  const [hostName, setHostName] = useState("");
  const [note, setNote] = useState("");
  const [inv, setInv] = useState<Invitation | null>(null);
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [rsvps, setRsvps] = useState<Rsvp[]>([]);
  const [error, setError] = useState<string | null>(null);

  const palette = tagPalette(event.tagId);

  useEffect(() => {
    if (!inv) return;
    listRsvps(inv.id).then(setRsvps).catch(() => {});
    const t = setInterval(() => listRsvps(inv.id).then(setRsvps).catch(() => {}), 5000);
    return () => clearInterval(t);
  }, [inv]);

  async function handleCreate() {
    setCreating(true);
    setError(null);
    try {
      const created = await createInvitation(event, hostName, note);
      setInv(created);
    } catch (e: any) {
      setError(e?.message || "Could not create invitation. Make sure the invitations table exists in your database.");
    } finally {
      setCreating(false);
    }
  }

  async function copyLink() {
    if (!inv) return;
    await navigator.clipboard.writeText(invitationUrl(inv.id));
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  async function nativeShare() {
    if (!inv) return;
    const url = invitationUrl(inv.id);
    const text = `${hostName || "Someone"} invited you: ${event.title}`;
    if (navigator.share) {
      try { await navigator.share({ title: event.title, text, url }); } catch {}
    } else {
      await copyLink();
    }
  }

  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 10000,
        background: "rgba(40, 30, 60, 0.45)", backdropFilter: "blur(6px)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(420px, 100%)", maxHeight: "92vh", overflowY: "auto",
          background: "#FFFCF7", borderRadius: 24, border: "1.5px solid #EAE3D2",
          boxShadow: "0 30px 80px -20px rgba(40,20,60,0.35)", position: "relative",
        }}
      >
        <button
          onClick={onClose}
          style={{ position: "absolute", top: 14, right: 14, background: "rgba(255,255,255,0.8)", border: "none", borderRadius: 999, width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#5C4A3A", zIndex: 2 }}
        >
          <X size={16} />
        </button>

        {/* Cute card preview */}
        <InviteCard event={event} hostName={hostName || "You"} note={note} palette={palette} />

        {!inv ? (
          <div style={{ padding: "20px 22px 24px" }}>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#7A6A55", letterSpacing: 0.6, marginBottom: 6 }}>YOUR NAME</label>
            <input
              value={hostName}
              onChange={(e) => setHostName(e.target.value)}
              placeholder="e.g. Alex"
              style={{ width: "100%", border: "1.5px solid #E5DCC4", borderRadius: 12, padding: "10px 12px", fontSize: 14, background: "#FFFEFA", color: "#3D2F1F", outline: "none", marginBottom: 12 }}
            />
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#7A6A55", letterSpacing: 0.6, marginBottom: 6 }}>A SWEET NOTE (optional)</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Looking forward to seeing you ✨"
              rows={2}
              style={{ width: "100%", border: "1.5px solid #E5DCC4", borderRadius: 12, padding: "10px 12px", fontSize: 14, background: "#FFFEFA", color: "#3D2F1F", outline: "none", resize: "none", fontFamily: "inherit" }}
            />
            {error && <div style={{ marginTop: 10, fontSize: 12, color: "#993556", background: "#FBEAF0", padding: "8px 10px", borderRadius: 10 }}>{error}</div>}
            <button
              onClick={handleCreate}
              disabled={creating}
              style={{
                marginTop: 16, width: "100%", border: "none", borderRadius: 14,
                background: `linear-gradient(135deg, ${palette.accent}, ${palette.ink})`,
                color: "#fff", padding: "12px 0", fontSize: 14, fontWeight: 700, letterSpacing: 0.3,
                cursor: creating ? "wait" : "pointer", opacity: creating ? 0.7 : 1,
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              }}
            >
              <Heart size={14} fill="#fff" /> {creating ? "Crafting…" : "Create invitation"}
            </button>
          </div>
        ) : (
          <div style={{ padding: "20px 22px 24px" }}>
            <div style={{ background: palette.bg, borderRadius: 14, padding: "10px 12px", display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <code style={{ flex: 1, fontSize: 12, color: palette.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{invitationUrl(inv.id)}</code>
              <button onClick={copyLink} style={{ border: "none", background: palette.accent, color: "#fff", borderRadius: 8, padding: "6px 10px", fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                {copied ? <Check size={12} /> : <Copy size={12} />} {copied ? "Copied" : "Copy"}
              </button>
            </div>
            <button
              onClick={nativeShare}
              style={{ width: "100%", border: "none", borderRadius: 14, background: `linear-gradient(135deg, ${palette.accent}, ${palette.ink})`, color: "#fff", padding: "12px 0", fontSize: 14, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
            >
              <Share2 size={14} /> Share invitation
            </button>

            <div style={{ marginTop: 18 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#7A6A55", letterSpacing: 0.6, marginBottom: 8 }}>RSVPS ({rsvps.length})</div>
              {rsvps.length === 0 ? (
                <div style={{ fontSize: 13, color: "#A39280", fontStyle: "italic" }}>No replies yet — share to find out!</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {rsvps.map((r) => (
                    <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: "#FAF6EC", borderRadius: 10 }}>
                      <span style={{ fontSize: 16 }}>{r.status === "accepted" ? "💖" : r.status === "maybe" ? "🤔" : "💔"}</span>
                      <span style={{ flex: 1, fontSize: 13, color: "#3D2F1F", fontWeight: 600 }}>{r.guest_name}</span>
                      <span style={{ fontSize: 11, color: "#A39280", textTransform: "uppercase", letterSpacing: 0.5 }}>{r.status}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

export function InviteCard({
  event, hostName, note, palette, big = false,
}: {
  event: { title: string; date: string; start: number; duration: number; where?: string | null };
  hostName: string;
  note?: string | null;
  palette: { bg: string; ink: string; accent: string };
  big?: boolean;
}) {
  const dateObj = new Date(event.date + "T00:00:00");
  const endMin = event.start + event.duration;
  return (
    <div style={{
      margin: big ? 0 : 18, marginBottom: 0,
      borderRadius: big ? 28 : 20,
      background: `linear-gradient(160deg, ${palette.bg} 0%, #FFFCF7 100%)`,
      border: `1.5px solid ${palette.accent}33`,
      padding: big ? "36px 28px" : "28px 22px",
      position: "relative", overflow: "hidden",
    }}>
      <div style={{ position: "absolute", top: -40, right: -40, width: 140, height: 140, borderRadius: "50%", background: palette.accent, opacity: 0.12 }} />
      <div style={{ position: "absolute", bottom: -30, left: -30, width: 100, height: 100, borderRadius: "50%", background: palette.ink, opacity: 0.08 }} />

      <div style={{ position: "relative" }}>
        <div style={{ fontSize: 11, letterSpacing: 2, fontWeight: 700, color: palette.accent, marginBottom: 8 }}>
          ✦ AN INVITATION ✦
        </div>
        <div style={{ fontSize: 13, color: palette.ink, opacity: 0.75, marginBottom: 14 }}>
          {hostName} would love your company for
        </div>
        <div style={{
          fontSize: big ? 36 : 26, fontWeight: 800, color: palette.ink,
          lineHeight: 1.1, marginBottom: 16, letterSpacing: -0.5,
          fontFamily: "Georgia, 'Times New Roman', serif", fontStyle: "italic",
        }}>
          {event.title}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: note ? 16 : 0 }}>
          <Row palette={palette} k="when" v={`${format(dateObj, "EEEE, MMM d")} · ${minutesToLabel(event.start)} – ${minutesToLabel(endMin)}`} />
          {event.where && <Row palette={palette} k="where" v={event.where} />}
        </div>

        {note && (
          <div style={{
            marginTop: 14, padding: "12px 14px", background: "rgba(255,255,255,0.6)",
            borderLeft: `3px solid ${palette.accent}`, borderRadius: 6,
            fontSize: 13, color: palette.ink, fontStyle: "italic", lineHeight: 1.5,
          }}>
            “{note}”
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ palette, k, v }: { palette: { ink: string; accent: string }; k: string; v: string }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
      <div style={{ fontSize: 10, letterSpacing: 1.5, fontWeight: 700, color: palette.accent, width: 48, flexShrink: 0 }}>{k.toUpperCase()}</div>
      <div style={{ fontSize: 14, color: palette.ink, fontWeight: 600 }}>{v}</div>
    </div>
  );
}
