import { useEffect, useState } from "react";
import { format } from "date-fns";

export function NowMarker() {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 60000);
    return () => clearInterval(id);
  }, []);

  return (
    <div style={{
      background: "#F6F5FE",
      border: "1px solid #C5BEF5",
      borderRadius: 16,
      padding: "6px 12px",
      display: "flex",
      alignItems: "center",
      gap: 8,
    }}>
      <span style={{ width: 12, height: 12, borderRadius: "50%", background: "#C5BEF5", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#7B73D6" }} />
      </span>
      <span style={{ fontSize: 13, fontWeight: 600, color: "#3C3489" }}>
        now · {format(time, "h:mma").toLowerCase()}
      </span>
      <div style={{ flex: 1, height: 1, background: "#C5BEF5", opacity: 0.6 }} />
    </div>
  );
}
