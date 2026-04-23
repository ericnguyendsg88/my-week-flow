import { motion } from "framer-motion";
import { CalEvent, Tag } from "@/types/event";
import { getCategoryClasses } from "./CategoryPicker";
import { getTag, tagClasses } from "@/lib/tags";
import { minutesToLabel, durationLabel } from "@/lib/event-utils";
import { cn } from "@/lib/utils";

interface Props {
  event: CalEvent;
  tags?: Tag[];
  compact?: boolean;
  layoutId?: string;
}

export function EventBubble({ event, tags, compact, layoutId }: Props) {
  const tag = tags ? getTag(tags, event.tagId) : undefined;
  const cls = tag ? tagClasses(tag) : getCategoryClasses(event.category);

  return (
    <motion.div
      layoutId={layoutId ?? `event-${event.id}`}
      initial={{ scale: 0.6, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.6, opacity: 0 }}
      transition={{ type: "spring", stiffness: 260, damping: 26 }}
      whileHover={{ y: -1 }}
      className={cn(
        "group relative h-full w-full overflow-hidden rounded-2xl px-2.5 py-1.5 text-left shadow-bubble ring-1",
        cls.bg,
        cls.ring
      )}
    >
      <div className={cn("absolute left-0 top-0 h-full w-1 rounded-l-2xl", cls.solid)} />
      <div className="ml-1.5">
        <p className={cn("truncate text-xs font-bold leading-tight", cls.text)}>
          {event.title}
        </p>
        {!compact || event.duration >= 45 ? (
          <p className="mt-0.5 truncate text-[10px] font-medium text-foreground/60">
            {minutesToLabel(event.start)} · {durationLabel(event.duration)}
          </p>
        ) : null}
        {event.where && event.duration >= 60 && (
          <p className="mt-0.5 truncate text-[10px] text-foreground/50">📍 {event.where}</p>
        )}
        {tag && event.duration >= 60 && (
          <span className={cn("mt-1 inline-block rounded-full px-1.5 py-0.5 text-[9px] font-bold", cls.solid, "text-primary-foreground")}>
            #{tag.name}
          </span>
        )}
      </div>
    </motion.div>
  );
}
