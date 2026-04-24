interface Props {
  weekend?: boolean;
  isSunday?: boolean;
}

export function EmptyDayCard({ weekend, isSunday }: Props) {
  if (isSunday) {
    return (
      <div style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        width: "100%",
        height: "100%",
        borderRadius: 8,
        border: "1px dashed #EF9F27",
        background: "#FAEEDA",
        padding: 12,
        textAlign: "center",
        boxSizing: "border-box",
      }}>
        <p style={{
          fontSize: 11,
          fontWeight: 500,
          color: "#633806",
          lineHeight: 1.4,
        }}>
          rest
        </p>
      </div>
    );
  }

  if (weekend) {
    return (
      <div style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        width: "100%",
        height: "100%",
        borderRadius: 8,
        border: "1px dashed #5DCAA5",
        background: "#E1F5EE",
        padding: 12,
        textAlign: "center",
        boxSizing: "border-box",
      }}>
        <p style={{
          fontSize: 11,
          fontWeight: 500,
          color: "#085041",
          lineHeight: 1.4,
        }}>
          open — what restores you?
        </p>
      </div>
    );
  }

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      width: "100%",
      height: "100%",
      borderRadius: 8,
      border: "1px dashed #D3D1C7",
      background: "transparent",
      padding: 12,
      textAlign: "center",
      boxSizing: "border-box",
    }}>
      <p style={{
        fontSize: 11,
        fontWeight: 500,
        color: "#888580",
        lineHeight: 1.4,
      }}>
        nothing yet
      </p>
    </div>
  );
}