import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { minutesToLabel, nowMinutes } from "@/lib/event-utils";

interface Props {
  startHour: number;
  endHour: number;
  hourHeight: number;
}

export function NowMarker({ startHour, endHour, hourHeight }: Props) {
  const [mins, setMins] = useState(nowMinutes());
  useEffect(() => {
    const id = setInterval(() => setMins(nowMinutes()), 60_000);
    return () => clearInterval(id);
  }, []);

  const startMins = startHour * 60;
  const endMins = endHour * 60;
  if (mins < startMins || mins > endMins) return null;

  const top = ((mins - startMins) / 60) * hourHeight;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="pointer-events-none absolute left-0 right-0 z-20 flex items-center"
      style={{ top }}
    >
      {/* Time pill — sits to the left of grid */}
      <div className="absolute -left-12 -translate-y-1/2 rounded-full bg-now px-1.5 py-0.5 text-[10px] font-extrabold text-primary-foreground shadow-bubble">
        {minutesToLabel(mins)}
      </div>
      {/* Halo + dot on left edge */}
      <div className="relative -ml-1 flex h-3 w-3 shrink-0 items-center justify-center">
        <span className="absolute inline-flex h-3 w-3 rounded-full bg-now-halo" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-now" />
      </div>
      {/* Line across the column */}
      <div className="h-px flex-1 bg-now/70" />
    </motion.div>
  );
}
