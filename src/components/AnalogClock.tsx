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
  const R  = size / 2 - 3;

  const uid = "sw"; // SVG def prefix

  // ── Tick marks ────────────────────────────────────────────────────
  const ticks = Array.from({ length: 60 }, (_, i) => {
    const isHour    = i % 5  === 0;
    const isQuarter = i % 15 === 0;
    const outerR = R * 0.87;
    const tickLen = isQuarter ? R * 0.15 : isHour ? R * 0.10 : R * 0.05;
    const p1 = polar(cx, cy, i * 6, outerR);
    const p2 = polar(cx, cy, i * 6, outerR - tickLen);
    return (
      <line
        key={i}
        x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
        stroke={isQuarter ? "rgba(40,32,20,0.75)" : isHour ? "rgba(40,32,20,0.50)" : "rgba(40,32,20,0.22)"}
        strokeWidth={isQuarter ? 2.5 : isHour ? 1.6 : 0.85}
        strokeLinecap="round"
      />
    );
  });

  // ── Roman numerals ────────────────────────────────────────────────
  const numerals = [
    { n: "XII", deg: 0   },
    { n: "III", deg: 90  },
    { n: "VI",  deg: 180 },
    { n: "IX",  deg: 270 },
  ].map(({ n, deg }) => {
    const pos = polar(cx, cy, deg, R * 0.63);
    return (
      <text
        key={n}
        x={pos.x} y={pos.y + size * 0.031}
        textAnchor="middle"
        fontSize={size * 0.07}
        fontWeight={400}
        fill="rgba(28,20,10,0.62)"
        fontFamily="Georgia, 'Times New Roman', serif"
      >
        {n}
      </text>
    );
  });

  // ── Tapered hand (polished steel look) ───────────────────────────
  function steelHand(
    angleDeg: number,
    length: number,
    tailLen: number,
    tipWidth: number,
    baseWidth: number,
    gradId: string,
  ) {
    const rad  = (angleDeg - 90) * (Math.PI / 180);
    const perp = rad + Math.PI / 2;

    const tip  = { x: cx + Math.cos(rad)  * length,  y: cy + Math.sin(rad)  * length  };
    const tail = { x: cx - Math.cos(rad)  * tailLen, y: cy - Math.sin(rad)  * tailLen };

    const bL = { x: tail.x + Math.cos(perp) * baseWidth / 2, y: tail.y + Math.sin(perp) * baseWidth / 2 };
    const bR = { x: tail.x - Math.cos(perp) * baseWidth / 2, y: tail.y - Math.sin(perp) * baseWidth / 2 };
    const mL = { x: cx    + Math.cos(perp) * tipWidth  / 2,  y: cy    + Math.sin(perp) * tipWidth  / 2  };
    const mR = { x: cx    - Math.cos(perp) * tipWidth  / 2,  y: cy    - Math.sin(perp) * tipWidth  / 2  };

    const d = `M ${bL.x} ${bL.y} L ${mL.x} ${mL.y} L ${tip.x} ${tip.y} L ${mR.x} ${mR.y} L ${bR.x} ${bR.y} Z`;

    // polished steel sheen — bright center stripe
    const sheenX1 = cx    + Math.cos(rad) * (tailLen * 0.2);
    const sheenY1 = cy    + Math.sin(rad) * (tailLen * 0.2);
    const sheenX2 = cx    + Math.cos(rad) * (length  * 0.82);
    const sheenY2 = cy    + Math.sin(rad) * (length  * 0.82);

    return (
      <g>
        {/* Drop shadow */}
        <path d={d} fill="rgba(0,0,0,0.25)" transform="translate(1.5,2.5)" />
        {/* Hand body */}
        <path d={d} fill={`url(#${gradId})`} />
        {/* Polished center highlight */}
        <line
          x1={sheenX1} y1={sheenY1} x2={sheenX2} y2={sheenY2}
          stroke="rgba(255,255,255,0.55)"
          strokeWidth={tipWidth * 0.32}
          strokeLinecap="round"
        />
      </g>
    );
  }

  // ── Second hand — slim blued steel needle ─────────────────────────
  function secondHand(angleDeg: number) {
    const rad     = (angleDeg - 90) * (Math.PI / 180);
    const tipLen  = R * 0.75;
    const tailLen = R * 0.24;
    const tip  = { x: cx + Math.cos(rad) * tipLen,  y: cy + Math.sin(rad) * tipLen  };
    const tail = { x: cx - Math.cos(rad) * tailLen, y: cy - Math.sin(rad) * tailLen };
    return (
      <g>
        {/* Shadow */}
        <line x1={tail.x + 1} y1={tail.y + 2} x2={tip.x + 1} y2={tip.y + 2}
          stroke="rgba(0,0,0,0.18)" strokeWidth={size * 0.011} strokeLinecap="round" />
        {/* Needle */}
        <line x1={tail.x} y1={tail.y} x2={tip.x} y2={tip.y}
          stroke={`url(#${uid}-sec)`} strokeWidth={size * 0.011} strokeLinecap="round" />
        {/* Tail lollipop */}
        <circle cx={tail.x} cy={tail.y} r={size * 0.024} fill={`url(#${uid}-sec)`} />
        <circle cx={tail.x} cy={tail.y} r={size * 0.010} fill="rgba(255,255,255,0.45)" />
      </g>
    );
  }

  return (
    <div style={{
      width: size,
      height: size,
      borderRadius: "50%",
      position: "relative",
      filter: [
        "drop-shadow(0 12px 32px rgba(0,0,0,0.38))",
        "drop-shadow(0 3px 8px rgba(0,0,0,0.22))",
        "drop-shadow(0 -1px 0 rgba(255,255,255,0.18))",
      ].join(" "),
    }}>
      <svg
        width={size} height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={{ display: "block", overflow: "visible" }}
      >
        <defs>
          {/* ── Outer case: brushed gunmetal ── */}
          <radialGradient id={`${uid}-case`} cx="38%" cy="30%" r="68%">
            <stop offset="0%"   stopColor="#B8B8B8" />
            <stop offset="25%"  stopColor="#8A8A8A" />
            <stop offset="55%"  stopColor="#5C5C5C" />
            <stop offset="80%"  stopColor="#3A3A3A" />
            <stop offset="100%" stopColor="#1E1E1E" />
          </radialGradient>

          {/* ── Bezel ring: polished steel with light sweep ── */}
          <linearGradient id={`${uid}-bezel`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%"   stopColor="#E8E8E8" />
            <stop offset="18%"  stopColor="#A0A0A0" />
            <stop offset="38%"  stopColor="#C8C8C8" />
            <stop offset="55%"  stopColor="#686868" />
            <stop offset="72%"  stopColor="#B0B0B0" />
            <stop offset="88%"  stopColor="#707070" />
            <stop offset="100%" stopColor="#D0D0D0" />
          </linearGradient>

          {/* ── Dial face: warm cream/champagne ── */}
          <radialGradient id={`${uid}-dial`} cx="44%" cy="36%" r="72%">
            <stop offset="0%"   stopColor="#FEFAF4" />
            <stop offset="50%"  stopColor="#F5EFE2" />
            <stop offset="85%"  stopColor="#EDE4D2" />
            <stop offset="100%" stopColor="#E5D9C2" />
          </radialGradient>

          {/* ── Dial inner vignette ── */}
          <radialGradient id={`${uid}-vignette`} cx="50%" cy="50%" r="50%">
            <stop offset="72%"  stopColor="rgba(0,0,0,0)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0.12)" />
          </radialGradient>

          {/* ── Hour hand: gunmetal/charcoal ── */}
          <linearGradient id={`${uid}-hour`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%"   stopColor="#2A2A2A" />
            <stop offset="35%"  stopColor="#686868" />
            <stop offset="55%"  stopColor="#505050" />
            <stop offset="100%" stopColor="#1A1A1A" />
          </linearGradient>

          {/* ── Minute hand: slightly lighter steel ── */}
          <linearGradient id={`${uid}-min`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%"   stopColor="#323232" />
            <stop offset="38%"  stopColor="#787878" />
            <stop offset="58%"  stopColor="#585858" />
            <stop offset="100%" stopColor="#222222" />
          </linearGradient>

          {/* ── Second hand: blued steel (classic Swiss) ── */}
          <linearGradient id={`${uid}-sec`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%"   stopColor="#3A5080" />
            <stop offset="40%"  stopColor="#1E3060" />
            <stop offset="100%" stopColor="#0E1A3A" />
          </linearGradient>

          {/* ── Center cap: polished steel dome ── */}
          <radialGradient id={`${uid}-cap`} cx="35%" cy="28%" r="65%">
            <stop offset="0%"   stopColor="#E0E0E0" />
            <stop offset="40%"  stopColor="#A0A0A0" />
            <stop offset="75%"  stopColor="#606060" />
            <stop offset="100%" stopColor="#303030" />
          </radialGradient>

          {/* ── Glass: primary glare ── */}
          <radialGradient id={`${uid}-glass1`} cx="30%" cy="20%" r="58%">
            <stop offset="0%"   stopColor="rgba(255,255,255,0.65)" />
            <stop offset="40%"  stopColor="rgba(255,255,255,0.14)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </radialGradient>

          {/* ── Glass: secondary glare bottom-right ── */}
          <radialGradient id={`${uid}-glass2`} cx="76%" cy="80%" r="38%">
            <stop offset="0%"   stopColor="rgba(255,255,255,0.18)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </radialGradient>

          <clipPath id={`${uid}-clip`}>
            <circle cx={cx} cy={cy} r={R * 0.92} />
          </clipPath>
          <clipPath id={`${uid}-bezel-clip`}>
            <circle cx={cx} cy={cy} r={R} />
          </clipPath>
        </defs>

        {/* ── Outermost case body ── */}
        <circle cx={cx} cy={cy} r={R + 3} fill={`url(#${uid}-case)`} />

        {/* ── Polished bezel ring (just inside case edge) ── */}
        <circle cx={cx} cy={cy} r={R + 1}
          fill="none"
          stroke={`url(#${uid}-bezel)`}
          strokeWidth={R * 0.13}
        />

        {/* ── Bezel inner shadow ── */}
        <circle cx={cx} cy={cy} r={R * 0.90}
          fill="none"
          stroke="rgba(0,0,0,0.28)"
          strokeWidth={3}
        />

        {/* ── Dial face ── */}
        <circle cx={cx} cy={cy} r={R * 0.90} fill={`url(#${uid}-dial)`} />

        {/* ── Dial vignette ── */}
        <circle cx={cx} cy={cy} r={R * 0.90} fill={`url(#${uid}-vignette)`} />

        {/* ── Ticks ── */}
        <g clipPath={`url(#${uid}-clip)`}>{ticks}</g>

        {/* ── Roman numerals ── */}
        <g clipPath={`url(#${uid}-clip)`}>{numerals}</g>

        {/* ── Hour hand ── */}
        {steelHand(angles.hours,   R * 0.48, R * 0.14, R * 0.040, R * 0.068, `${uid}-hour`)}

        {/* ── Minute hand ── */}
        {steelHand(angles.minutes, R * 0.68, R * 0.12, R * 0.026, R * 0.050, `${uid}-min`)}

        {/* ── Second hand ── */}
        {secondHand(angles.seconds)}

        {/* ── Center cap (polished dome) ── */}
        <circle cx={cx} cy={cy} r={size * 0.052} fill={`url(#${uid}-cap)`} />
        {/* Cap highlight */}
        <circle
          cx={cx - size * 0.013} cy={cy - size * 0.013}
          r={size * 0.016}
          fill="rgba(255,255,255,0.60)"
        />

        {/* ── Glass over the whole dial (clipped) ── */}
        <g clipPath={`url(#${uid}-bezel-clip)`}>
          {/* Main top-left crescent glare */}
          <ellipse
            cx={cx * 0.70} cy={cy * 0.50}
            rx={R * 0.50} ry={R * 0.32}
            fill={`url(#${uid}-glass1)`}
            transform={`rotate(-30 ${cx} ${cy})`}
          />
          {/* Bottom-right secondary glare */}
          <ellipse
            cx={cx * 1.34} cy={cy * 1.44}
            rx={R * 0.28} ry={R * 0.18}
            fill={`url(#${uid}-glass2)`}
          />
          {/* Edge catch — bright arc at top of crystal */}
          <path
            d={`M ${cx - R * 0.44} ${cy - R * 0.80} Q ${cx} ${cy - R * 1.04} ${cx + R * 0.44} ${cy - R * 0.80}`}
            fill="none"
            stroke="rgba(255,255,255,0.60)"
            strokeWidth={1.6}
            strokeLinecap="round"
          />
          {/* Thin bottom edge catch */}
          <path
            d={`M ${cx - R * 0.28} ${cy + R * 0.83} Q ${cx} ${cy + R * 1.00} ${cx + R * 0.28} ${cy + R * 0.83}`}
            fill="none"
            stroke="rgba(255,255,255,0.14)"
            strokeWidth={1.2}
            strokeLinecap="round"
          />
        </g>

        {/* ── Bezel outer highlight arc (top-left) ── */}
        <path
          d={`M ${cx - R * 0.55} ${cy - R * 0.92} Q ${cx} ${cy - R * 1.16} ${cx + R * 0.55} ${cy - R * 0.92}`}
          fill="none"
          stroke="rgba(255,255,255,0.40)"
          strokeWidth={2}
          strokeLinecap="round"
        />
        {/* ── Bezel shadow arc (bottom-right) ── */}
        <path
          d={`M ${cx - R * 0.42} ${cy + R * 0.94} Q ${cx} ${cy + R * 1.14} ${cx + R * 0.42} ${cy + R * 0.94}`}
          fill="none"
          stroke="rgba(0,0,0,0.30)"
          strokeWidth={2}
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}
