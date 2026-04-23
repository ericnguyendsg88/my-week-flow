import { durationLabel } from "@/lib/event-utils";

interface Props {
  minutes: number;
}

export function GapPlaceholder({ minutes }: Props) {
  const label = minutes >= 120
    ? `${durationLabel(minutes)} open — breathe or plan`
    : `gap — add something?`;

  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: 6,
      width: "100%",
      borderRadius: 8,
      background: "#FAF7EE",
      border: "1px dashed #DCCDAE",
      padding: "8px 12px",
      boxSizing: "border-box",
    }}>
      <span style={{
        width: 4, height: 4,
        borderRadius: "50%",
        background: "#A39780",
        flexShrink: 0,
      }} />
      <span style={{
        fontSize: 12,
        fontWeight: 500,
        color: "#5C5648",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
      }}>
        {label}
      </span>
    </div>
  );
}
