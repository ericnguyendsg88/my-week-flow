import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import {
  Lightbulb,
  Link2,
  FileText,
  Bookmark,
  CheckSquare,
  ArrowRight,
  ExternalLink,
  Plus,
  X,
} from "lucide-react";
import { CaptureItem, CaptureKind, Tag } from "@/types/event";
import { useCaptures, addCapture, removeCapture, markCapturePlaced } from "@/lib/capture-store";
import { tagClasses, getTag } from "@/lib/tags";
import { cn } from "@/lib/utils";

interface Props {
  selectedDayKey: string;
  selectedLabel: string;
  tags: Tag[];
  onPlace?: (item: CaptureItem) => void;
}

const KINDS: {
  id: CaptureKind;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  colorBg: string;
  colorText: string;
  colorSolid: string;
  needsUrl?: boolean;
}[] = [
  { id: "thought", label: "thought", icon: Lightbulb,  colorBg: "bg-tag-purple-soft", colorText: "text-tag-purple", colorSolid: "bg-tag-purple" },
  { id: "link",    label: "link",    icon: Link2,      colorBg: "bg-tag-blue-soft",   colorText: "text-tag-blue",   colorSolid: "bg-tag-blue", needsUrl: true },
  { id: "file",    label: "file",    icon: FileText,   colorBg: "bg-tag-green-soft",  colorText: "text-tag-green",  colorSolid: "bg-tag-green" },
  { id: "ref",     label: "ref",     icon: Bookmark,   colorBg: "bg-tag-amber-soft",  colorText: "text-tag-amber",  colorSolid: "bg-tag-amber" },
  { id: "task",    label: "task",    icon: CheckSquare,colorBg: "bg-tag-pink-soft",   colorText: "text-tag-pink",   colorSolid: "bg-tag-pink" },
];

function kindMeta(k: CaptureKind) {
  return KINDS.find((x) => x.id === k)!;
}

export function Backpack({ selectedDayKey, selectedLabel, tags, onPlace }: Props) {
  const items = useCaptures(selectedDayKey);
  const [adding, setAdding] = useState<CaptureKind | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftUrl, setDraftUrl] = useState("");

  function commitAdd() {
    if (!adding || !draftTitle.trim()) return;
    addCapture({
      kind: adding,
      title: draftTitle.trim(),
      url: draftUrl.trim() || undefined,
      dayKey: selectedDayKey,
    });
    setAdding(null);
    setDraftTitle("");
    setDraftUrl("");
  }

  return (
    <div className="flex h-full flex-col rounded-bubble bg-card p-4 shadow-bubble ring-1 ring-border">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
            Backpack · {selectedLabel}
          </p>
          <p className="text-[11px] font-medium text-muted-foreground/70">
            {items.length} captured today
          </p>
        </div>
        <button className="text-[11px] font-bold text-primary hover:underline">see all →</button>
      </div>

      {/* Quick-add chips */}
      <div className="mb-3 flex flex-wrap gap-1.5">
        {KINDS.map((k) => {
          const Icon = k.icon;
          const active = adding === k.id;
          return (
            <button
              key={k.id}
              onClick={() => {
                setAdding(active ? null : k.id);
                setDraftTitle("");
                setDraftUrl("");
              }}
              className={cn(
                "flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold transition-all",
                active ? `${k.colorSolid} text-primary-foreground shadow-bubble` : `${k.colorBg} ${k.colorText} hover:ring-2 ring-current/20`
              )}
            >
              <Plus className="h-3 w-3" />
              {k.label}
            </button>
          );
        })}
      </div>

      <AnimatePresence>
        {adding && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-3 overflow-hidden"
          >
            <div className="rounded-2xl bg-muted/50 p-2.5 ring-1 ring-border">
              <input
                autoFocus
                value={draftTitle}
                onChange={(e) => setDraftTitle(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && commitAdd()}
                placeholder={`new ${adding}…`}
                className="w-full bg-transparent text-sm font-bold outline-none placeholder:text-muted-foreground/50"
              />
              {kindMeta(adding).needsUrl && (
                <input
                  value={draftUrl}
                  onChange={(e) => setDraftUrl(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && commitAdd()}
                  placeholder="https://…"
                  className="mt-1 w-full bg-transparent text-[11px] font-medium text-muted-foreground outline-none placeholder:text-muted-foreground/40"
                />
              )}
              <div className="mt-2 flex gap-1.5">
                <button
                  onClick={commitAdd}
                  className="rounded-full bg-foreground px-3 py-1 text-[11px] font-bold text-background"
                >
                  Add
                </button>
                <button
                  onClick={() => setAdding(null)}
                  className="rounded-full px-2 py-1 text-[11px] font-bold text-muted-foreground hover:bg-muted"
                >
                  cancel
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* List */}
      <div className="flex-1 space-y-1.5 overflow-y-auto pr-1">
        {items.length === 0 && (
          <div className="flex h-24 items-center justify-center rounded-2xl border border-dashed border-border/60 text-[11px] font-medium text-muted-foreground">
            nothing in your backpack yet
          </div>
        )}
        <AnimatePresence initial={false}>
          {items.map((item) => {
            const meta = kindMeta(item.kind);
            const Icon = meta.icon;
            const tag = getTag(tags, item.tagId);
            const tcls = tag ? tagClasses(tag) : null;
            const action = item.kind === "link" || item.kind === "file" ? "open" : "place →";
            return (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: item.placed ? 0.5 : 1, y: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className={cn(
                  "flex items-center gap-2 rounded-2xl bg-muted/40 p-2 ring-1 ring-border/60 hover:bg-muted/70"
                )}
              >
                <span
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-xl",
                    meta.colorBg,
                    meta.colorText
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-bold leading-tight">
                    {item.title}
                  </p>
                  <div className="mt-0.5 flex items-center gap-1.5">
                    {tag && tcls && (
                      <span
                        className={cn(
                          "rounded-full px-1.5 py-0.5 text-[9px] font-bold",
                          tcls.bg,
                          tcls.text
                        )}
                      >
                        #{tag.name}
                      </span>
                    )}
                    <span className="text-[10px] font-medium text-muted-foreground">
                      {format(item.createdAt, "h:mma").toLowerCase()}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => {
                    if (item.kind === "link" && item.url) {
                      window.open(item.url, "_blank");
                    } else {
                      onPlace?.(item);
                      markCapturePlaced(item.id);
                    }
                  }}
                  className="flex shrink-0 items-center gap-1 rounded-full bg-card px-2 py-1 text-[10px] font-bold text-foreground ring-1 ring-border hover:bg-foreground hover:text-background"
                >
                  {item.kind === "link" || item.kind === "file" ? (
                    <ExternalLink className="h-3 w-3" />
                  ) : (
                    <ArrowRight className="h-3 w-3" />
                  )}
                  {action}
                </button>
                <button
                  onClick={() => removeCapture(item.id)}
                  className="shrink-0 rounded-full p-1 text-muted-foreground/60 hover:bg-muted hover:text-foreground"
                  aria-label="remove"
                >
                  <X className="h-3 w-3" />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
