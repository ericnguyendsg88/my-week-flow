import { cn } from "@/lib/utils";

interface Props {
  weekend?: boolean;
}

export function EmptyDayCard({ weekend }: Props) {
  return (
    <div
      className={cn(
        "flex h-full w-full flex-col items-center justify-center rounded-2xl border border-dashed p-4 text-center",
        weekend
          ? "border-tag-green/40 bg-weekend-soft text-tag-green"
          : "border-warm-gray/40 bg-warm-gray-soft/60 text-warm-gray"
      )}
    >
      <div className="mb-2 text-2xl opacity-70">{weekend ? "🌿" : "✨"}</div>
      <p className="text-[11px] font-bold leading-tight">
        {weekend ? "open day" : "nothing yet"}
      </p>
      <p className="mt-1 text-[10px] font-medium leading-snug opacity-80">
        {weekend ? "what restores you?" : "what do you want to do?"}
      </p>
    </div>
  );
}
