import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Heart, X, HelpCircle, Check } from "lucide-react";
import { getInvitation, listRsvps, submitRsvp, Invitation, Rsvp } from "@/lib/invitations";
import { InviteCard } from "@/components/ShareInviteModal";

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

export default function Invite() {
  const { id } = useParams();
  const [inv, setInv] = useState<Invitation | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState<"accepted" | "declined" | "maybe" | null>(null);
  const [rsvps, setRsvps] = useState<Rsvp[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    document.title = "You're invited ✦";
    getInvitation(id)
      .then((data) => {
        if (!data) setNotFound(true);
        else setInv(data);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
    listRsvps(id).then(setRsvps).catch(() => {});
  }, [id]);

  async function rsvp(status: "accepted" | "declined" | "maybe") {
    if (!inv || !name.trim()) {
      setError("Please tell us your name first 💌");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await submitRsvp({ invitation_id: inv.id, guest_name: name.trim(), status, message: message.trim() || null });
      setSubmitted(status);
      const fresh = await listRsvps(inv.id);
      setRsvps(fresh);
    } catch (e: any) {
      setError(e?.message || "Could not submit. Try again?");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#F8F1E0", fontFamily: "system-ui", color: "#7A6A55" }}>Loading invitation…</div>;
  }

  if (notFound || !inv) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#F8F1E0", fontFamily: "system-ui", padding: 24 }}>
        <div style={{ textAlign: "center", color: "#5C4A3A" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>💌</div>
          <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Invitation not found</h1>
          <p style={{ color: "#A39280", marginBottom: 16 }}>This invite may have expired or never existed.</p>
          <Link to="/" style={{ color: "#993556", fontWeight: 600 }}>Go home →</Link>
        </div>
      </div>
    );
  }

  const palette = tagPalette(inv.tag_id);

  return (
    <div style={{
      minHeight: "100vh",
      background: `radial-gradient(ellipse at top, ${palette.bg} 0%, #F8F1E0 70%)`,
      padding: "32px 16px 48px",
      fontFamily: "system-ui, -apple-system, sans-serif",
    }}>
      <div style={{ maxWidth: 480, margin: "0 auto" }}>
        <InviteCard
          big
          event={{ title: inv.title, date: inv.date, start: inv.start, duration: inv.duration, where: inv.where_ }}
          hostName={inv.host_name || "Someone special"}
          note={inv.note}
          palette={palette}
        />

        {submitted ? (
          <div style={{ marginTop: 20, padding: "24px 22px", background: "#FFFCF7", borderRadius: 20, border: "1.5px solid #EAE3D2", textAlign: "center" }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>
              {submitted === "accepted" ? "💖" : submitted === "maybe" ? "🤔" : "💔"}
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: palette.ink, marginBottom: 6, fontFamily: "Georgia, serif", fontStyle: "italic" }}>
              {submitted === "accepted" ? "Yay! You're in." : submitted === "maybe" ? "Got it — maybe!" : "Thanks for letting them know."}
            </h2>
            <p style={{ color: "#7A6A55", fontSize: 14 }}>
              {inv.host_name || "Your host"} will see your reply.
            </p>
          </div>
        ) : (
          <div style={{ marginTop: 20, padding: "24px 22px", background: "#FFFCF7", borderRadius: 20, border: "1.5px solid #EAE3D2" }}>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#7A6A55", letterSpacing: 0.6, marginBottom: 6 }}>YOUR NAME</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Tell them who's replying"
              style={{ width: "100%", border: "1.5px solid #E5DCC4", borderRadius: 12, padding: "12px 14px", fontSize: 15, background: "#FFFEFA", color: "#3D2F1F", outline: "none", marginBottom: 12, boxSizing: "border-box" }}
            />
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#7A6A55", letterSpacing: 0.6, marginBottom: 6 }}>A QUICK MESSAGE (optional)</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Can't wait!"
              rows={2}
              style={{ width: "100%", border: "1.5px solid #E5DCC4", borderRadius: 12, padding: "10px 14px", fontSize: 14, background: "#FFFEFA", color: "#3D2F1F", outline: "none", resize: "none", fontFamily: "inherit", boxSizing: "border-box" }}
            />
            {error && <div style={{ marginTop: 10, fontSize: 12, color: "#993556", background: "#FBEAF0", padding: "8px 10px", borderRadius: 10 }}>{error}</div>}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginTop: 16 }}>
              <button
                onClick={() => rsvp("declined")}
                disabled={submitting}
                style={{ border: "1.5px solid #E5DCC4", background: "#FFFEFA", color: "#5C4A3A", borderRadius: 14, padding: "12px 0", fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}
              >
                <X size={16} /> Can't
              </button>
              <button
                onClick={() => rsvp("maybe")}
                disabled={submitting}
                style={{ border: "1.5px solid #E5DCC4", background: "#FFFEFA", color: "#5C4A3A", borderRadius: 14, padding: "12px 0", fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}
              >
                <HelpCircle size={16} /> Maybe
              </button>
              <button
                onClick={() => rsvp("accepted")}
                disabled={submitting}
                style={{ border: "none", background: `linear-gradient(135deg, ${palette.accent}, ${palette.ink})`, color: "#fff", borderRadius: 14, padding: "12px 0", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}
              >
                <Heart size={16} fill="#fff" /> Accept
              </button>
            </div>
          </div>
        )}

        {rsvps.length > 0 && (
          <div style={{ marginTop: 18, padding: "16px 22px", background: "rgba(255,252,247,0.6)", borderRadius: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#7A6A55", letterSpacing: 0.6, marginBottom: 10 }}>WHO'S COMING ({rsvps.filter(r => r.status === "accepted").length})</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {rsvps.map((r) => (
                <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 10px", background: "#FFFCF7", borderRadius: 999, fontSize: 12, color: "#5C4A3A", border: "1px solid #EAE3D2" }}>
                  <span>{r.status === "accepted" ? "💖" : r.status === "maybe" ? "🤔" : "💔"}</span>
                  <span style={{ fontWeight: 600 }}>{r.guest_name}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ marginTop: 24, textAlign: "center", fontSize: 11, color: "#A39280", letterSpacing: 1 }}>
          ✦ sent with care ✦
        </div>
      </div>
    </div>
  );
}
