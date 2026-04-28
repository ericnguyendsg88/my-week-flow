import { useEffect, useState } from "react";

function getAngles() {
  const now = new Date();
  const s = now.getSeconds();
  const m = now.getMinutes();
  const h = now.getHours() % 12;
  return {
    seconds: s * 6,
    minutes: m * 6 + s * 0.1,
    hours:   h * 30 + m * 0.5,
  };
}

function polar(cx: number, cy: number, angleDeg: number, radius: number) {
  const rad = (angleDeg - 90) * (Math.PI / 180);
  return { x: cx + Math.cos(rad) * radius, y: cy + Math.sin(rad) * radius };
}

export function AnalogClock({ size = 160 }: { size?: number }) {
  const [angles, setAngles] = useState(getAngles);

  useEffect(() => {
    const id = setInterval(() => setAngles(getAngles()), 1000);
    return () => clearInterval(id);
  }, []);

  const cx = size / 2;
  const cy = size / 2;
  const R  = size / 2 - 4;
  const uid = "hc";

  // ── Hour markers (dots at each hour, larger at quarters) ─────────
  const hourDots = Array.from({ length: 12 }, (_, i) => {
    const isQuarter = i % 3 === 0;
    const r = isQuarter ? R * 0.056 : R * 0.028;
    const pos = polar(cx, cy, i * 30, R * 0.80);
    return (
      <circle
        key={i}
        cx={pos.x} cy={pos.y}
        r={r}
        fill={isQuarter ? "rgba(60,52,137,0.55)" : "rgba(60,52,137,0.25)"}
      />
    );
  });

  // ── Minute tick marks ─────────────────────────────────────────────
  const minTicks = Array.from({ length: 60 }, (_, i) => {
    if (i % 5 === 0) return null;
    const outer = polar(cx, cy, i * 6, R * 0.78);
    const inner = polar(cx, cy, i * 6, R * 0.72);
    return (
      <line
        key={"t" + i}
        x1={outer.x} y1={outer.y}
        x2={inner.x} y2={inner.y}
        stroke="rgba(60,52,137,0.15)"
        strokeWidth={0.8}
        strokeLinecap="round"
      />
    );
  });

  // ── Tapered hand ─────────────────────────────────────────────────
  function hand(
    angleDeg: number,
    length: number,
    tailLen: number,
    tipW: number,
    baseW: number,
    fill: string,
  ) {
    const rad  = (angleDeg - 90) * (Math.PI / 180);
    const perp = rad + Math.PI / 2;

    const tip  = { x: cx + Math.cos(rad) * length,  y: cy + Math.sin(rad) * length  };
    const tail = { x: cx - Math.cos(rad) * tailLen, y: cy - Math.sin(rad) * tailLen };

    const bL = { x: tail.x + Math.cos(perp) * baseW / 2, y: tail.y + Math.sin(perp) * baseW / 2 };
    const bR = { x: tail.x - Math.cos(perp) * baseW / 2, y: tail.y - Math.sin(perp) * baseW / 2 };
    const mL = { x: cx    + Math.cos(perp) * tipW  / 2,  y: cy    + Math.sin(perp) * tipW  / 2  };
    const mR = { x: cx    - Math.cos(perp) * tipW  / 2,  y: cy    - Math.sin(perp) * tipW  / 2  };

    const d = "M " + bL.x + " " + bL.y + " L " + mL.x + " " + mL.y + " L " + tip.x + " " + tip.y + " L " + mR.x + " " + mR.y + " L " + bR.x + " " + bR.y + " Z";

    return (
      <g>
        <path d={d} fill="rgba(60,52,137,0.12)" transform="translate(1, 2)" />
        <path d={d} fill={fill} />
      </g>
    );
  }

  // ── Second hand ──────────────────────────────────────────────────
  function secondHand(angleDeg: number) {
    const rad    = (angleDeg - 90) * (Math.PI / 180);
    const tipLen = R * 0.74;
    const tailL  = R * 0.22;
    const tip    = { x: cx + Math.cos(rad) * tipLen, y: cy + Math.sin(rad) * tipLen };
    const tail   = { x: cx - Math.cos(rad) * tailL,  y: cy - Math.sin(rad) * tailL  };
    return (
      <g>
        <line
          x1={tail.x + 0.5} y1={tail.y + 1}
          x2={tip.x + 0.5}  y2={tip.y + 1}
          stroke="rgba(176,170,232,0.3)"
          strokeWidth={size * 0.009}
          strokeLinecap="round"
        />
        <line
          x1={tail.x} y1={tail.y}
          x2={tip.x}  y2={tip.y}
          stroke="#C084BB"
          strokeWidth={size * 0.009}
          strokeLinecap="round"
        />
        <circle cx={tail.x} cy={tail.y} r={size * 0.022} fill="#C084BB" />
        <circle cx={tail.x} cy={tail.y} r={size * 0.009} fill="rgba(255,255,255,0.5)" />
      </g>
    );
  }

  const numeralData: { label: string; deg: number }[] = [
    { label: "12", deg: 0   },
    { label: "3",  deg: 90  },
    { label: "6",  deg: 180 },
    { label: "9",  deg: 270 },
  ];

  return (
    <div style={{
      width: size,
      height: size,
      borderRadius: "50%",
      position: "relative",
      filter: [
        "drop-shadow(0 8px 24px rgba(60,52,137,0.22))",
        "drop-shadow(0 2px 6px rgba(60,52,137,0.12))",
      ].join(" "),
    }}>
      <svg
        width={size} height={size}
        viewBox={"0 0 " + size + " " + size}
        style={{ display: "block", overflow: "visible" }}
      >
        <defs>
          <radialGradient id={uid + "-ring"} cx="38%" cy="32%" r="68%">
            <stop offset="0%"   stopColor="#5C52B0" />
            <stop offset="40%"  stopColor="#3C3489" />
            <stop offset="80%"  stopColor="#28215E" />
            <stop offset="100%" stopColor="#1A154A" />
          </radialGradient>

          <radialGradient id={uid + "-dial"} cx="42%" cy="35%" r="70%">
            <stop offset="0%"   stopColor="#FDFAF5" />
            <stop offset="45%"  stopColor="#F5F0E8" />
            <stop offset="85%"  stopColor="#EDE5D8" />
            <stop offset="100%" stopColor="#E6DDD0" />
          </radialGradient>

          <radialGradient id={uid + "-vignette"} cx="50%" cy="50%" r="50%">
            <stop offset="68%"  stopColor="rgba(0,0,0,0)" />
            <stop offset="100%" stopColor="rgba(60,52,137,0.10)" />
          </radialGradient>

          <linearGradient id={uid + "-hour"} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%"   stopColor="#2A2260" />
            <stop offset="40%"  stopColor="#4A40A0" />
            <stop offset="100%" stopColor="#24205A" />
          </linearGradient>

          <linearGradient id={uid + "-min"} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%"   stopColor="#3C3489" />
            <stop offset="42%"  stopColor="#5C52B8" />
            <stop offset="100%" stopColor="#30287A" />
          </linearGradient>

          <radialGradient id={uid + "-jewel"} cx="35%" cy="28%" r="65%">
            <stop offset="0%"   stopColor="#8B80E0" />
            <stop offset="50%"  stopColor="#5048B0" />
            <stop offset="100%" stopColor="#28205A" />
          </radialGradient>

          <radialGradient id={uid + "-glass"} cx="28%" cy="22%" r="55%">
            <stop offset="0%"   stopColor="rgba(255,255,255,0.45)" />
            <stop offset="50%"  stopColor="rgba(255,255,255,0.08)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </radialGradient>

          <clipPath id={uid + "-dial-clip"}>
            <circle cx={cx} cy={cy} r={R * 0.88} />
          </clipPath>
          <clipPath id={uid + "-ring-clip"}>
            <circle cx={cx} cy={cy} r={R + 2} />
          </clipPath>
        </defs>

        {/* Outer ring */}
        <circle cx={cx} cy={cy} r={R + 2} fill={"url(#" + uid + "-ring)"} />

        {/* Ring highlight arc */}
        <path
          d={"M " + (cx - R * 0.50) + " " + (cy - R * 0.90) + " Q " + cx + " " + (cy - R * 1.12) + " " + (cx + R * 0.50) + " " + (cy - R * 0.90)}
          fill="none"
          stroke="rgba(176,166,255,0.40)"
          strokeWidth={1.5}
          strokeLinecap="round"
        />

        {/* Inner bezel line */}
        <circle cx={cx} cy={cy} r={R * 0.89} fill="none" stroke="rgba(60,52,137,0.30)" strokeWidth={1} />

        {/* Dial face */}
        <circle cx={cx} cy={cy} r={R * 0.88} fill={"url(#" + uid + "-dial)"} />

        {/* Dial vignette */}
        <circle cx={cx} cy={cy} r={R * 0.88} fill={"url(#" + uid + "-vignette)"} />

        {/* Minute ticks */}
        <g clipPath={"url(#" + uid + "-dial-clip)"}>{minTicks}</g>

        {/* Hour dots */}
        <g clipPath={"url(#" + uid + "-dial-clip)"}>{hourDots}</g>

        {/* Numerals */}
        {numeralData.map(({ label, deg }) => {
          const pos = polar(cx, cy, deg, R * 0.60);
          return (
            <text
              key={label}
              x={pos.x}
              y={pos.y + size * 0.030}
              textAnchor="middle"
              fontSize={size * 0.075}
              fontWeight={600}
              fill="rgba(44,36,110,0.70)"
              fontFamily="'Lora', Georgia, serif"
            >
              {label}
            </text>
          );
        })}

        {/* Hour hand */}
        {hand(angles.hours,   R * 0.50, R * 0.14, R * 0.038, R * 0.065, "url(#" + uid + "-hour)")}

        {/* Minute hand */}
        {hand(angles.minutes, R * 0.70, R * 0.12, R * 0.024, R * 0.048, "url(#" + uid + "-min)")}

        {/* Second hand */}
        {secondHand(angles.seconds)}

        {/* Center jewel */}
        <circle cx={cx} cy={cy} r={size * 0.054} fill={"url(#" + uid + "-jewel)"} />
        <circle cx={cx - size * 0.012} cy={cy - size * 0.012} r={size * 0.018} fill="rgba(255,255,255,0.45)" />

        {/* Glass glare */}
        <g clipPath={"url(#" + uid + "-ring-clip)"}>
          <ellipse
            cx={cx * 0.72} cy={cy * 0.52}
            rx={R * 0.46} ry={R * 0.28}
            fill={"url(#" + uid + "-glass)"}
            transform={"rotate(-28 " + cx + " " + cy + ")"}
          />
          <path
            d={"M " + (cx - R * 0.40) + " " + (cy - R * 0.80) + " Q " + cx + " " + (cy - R * 1.02) + " " + (cx + R * 0.40) + " " + (cy - R * 0.80)}
            fill="none"
            stroke="rgba(255,255,255,0.50)"
            strokeWidth={1.4}
            strokeLinecap="round"
          />
        </g>
      </svg>
    </div>
  );
}
