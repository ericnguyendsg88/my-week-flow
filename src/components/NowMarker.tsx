import { useEffect, useState } from "react";
import { format } from "date-fns";

export function NowMarker() {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 60000);
    return () => clearInterval(id);
  }, []);

  return (
    <div style={{ position: "relative", display: "flex", alignItems: "center", pointerEvents: "none", width: "100%" }}>
      {/* Hairline — width:100% so it never bleeds outside the column */}
      <div style={{
        position: "absolute",
        left: 0,
        width: "100%",
        top: "50%",
        transform: "translateY(-50%)",
        height: 1,
        background: "#AFA9EC",
      }} />

      {/* Dot with halo ring */}
      <div style={{
        position: "relative",
        width: 9,
        height: 9,
        borderRadius: "50%",
        background: "#534AB7",
        boxShadow: "0 0 0 3px #CECBF6",
        flexShrink: 0,
        zIndex: 2,
      }} />

      {/* Time pill */}
      <div style={{
        marginLeft: 7,
        padding: "2px 8px",
        borderRadius: 20,
        background: "#EEEDFE",
        border: "none",
        display: "flex",
        alignItems: "center",
        zIndex: 2,
        position: "relative",
      }}>
        <span style={{
          fontSize: 10,
          fontWeight: 500,
          color: "#534AB7",
          letterSpacing: "0.01em",
        }}>
          {format(time, "h:mm a").toLowerCase()}
        </span>
      </div>
    </div>
  );
}
