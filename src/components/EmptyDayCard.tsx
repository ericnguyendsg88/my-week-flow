interface Props {
  weekend?: boolean;
}

export function EmptyDayCard({ weekend }: Props) {
  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      width: "100%",
      height: "100%",
      borderRadius: 8,
      border: `1px dashed ${weekend ? "#9FE1CB" : "#D3D1C7"}`,
      background: weekend ? "#E1F5EE" : "transparent",
      padding: 12,
      textAlign: "center",
      boxSizing: "border-box",
    }}>
      <p style={{
        fontSize: 11,
        fontWeight: 500,
        color: weekend ? "#085041" : "#888580",
        lineHeight: 1.4,
      }}>
        {weekend ? "open day — what restores you?" : "nothing yet"}
      </p>
    </div>
  );
}
