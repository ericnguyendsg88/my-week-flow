import { motion } from "framer-motion";
import { Category, CATEGORIES } from "@/types/event";
import { cn } from "@/lib/utils";

const colorMap: Record<Category, { bg: string; text: string; ring: string; solid: string }> = {
  work:     { bg: "bg-category-work-soft",     text: "text-category-work",     ring: "ring-category-work/30",     solid: "bg-category-work" },
  personal: { bg: "bg-category-personal-soft", text: "text-category-personal", ring: "ring-category-personal/30", solid: "bg-category-personal" },
  health:   { bg: "bg-category-health-soft",   text: "text-category-health",   ring: "ring-category-health/30",   solid: "bg-category-health" },
  social:   { bg: "bg-category-social-soft",   text: "text-category-social",   ring: "ring-category-social/30",   solid: "bg-category-social" },
  focus:    { bg: "bg-category-focus-soft",    text: "text-category-focus",    ring: "ring-category-focus/30",    solid: "bg-category-focus" },
  errand:   { bg: "bg-category-errand-soft",   text: "text-category-errand",   ring: "ring-category-errand/30",   solid: "bg-category-errand" },
};

export function getCategoryClasses(c: Category) { return colorMap[c]; }

interface Props {
  value: Category;
  onChange: (c: Category) => void;
}
export function CategoryPicker({ value, onChange }: Props) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {CATEGORIES.map((c) => {
        const active = value === c.id;
        const cls = colorMap[c.id];
        return (
          <motion.button
            key={c.id}
            type="button"
            whileTap={{ scale: 0.92 }}
            whileHover={{ y: -1 }}
            onClick={() => onChange(c.id)}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-semibold transition-all",
              active
                ? `${cls.solid} text-white shadow-bubble`
                : `${cls.bg} ${cls.text} hover:ring-2 ${cls.ring}`
            )}
          >
            <span className="mr-1">{c.emoji}</span>{c.label}
          </motion.button>
        );
      })}
    </div>
  );
}
