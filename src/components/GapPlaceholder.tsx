import { durationLabel } from "@/lib/event-utils";

interface Props {
  minutes: number;
}

export function GapPlaceholder({ minutes }: Props) {
  const label =
    minutes >= 120
      ? `${durationLabel(minutes)} free — breathe or plan`
      : `gap · add something?`;
  return (
    <div className="flex h-full w-full items-center gap-2 rounded-2xl border border-dashed border-warm-gray/40 bg-warm-gray-soft/60 px-2.5 py-1.5">
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-warm-gray/60" />
      <span className="truncate text-[10px] font-semibold text-warm-gray">
        {label}
      </span>
    </div>
  );
}
