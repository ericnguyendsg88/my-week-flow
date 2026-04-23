import { Category, Tag, TagColor } from "@/types/event";

export const TAG_COLORS: TagColor[] = [
  "purple",
  "teal",
  "coral",
  "pink",
  "blue",
  "green",
  "amber",
  "gray",
];

/**
 * Each tag color maps to a set of design-token tailwind classes.
 * Colors are defined in index.css as --tag-* HSL tokens.
 */
export interface TagClassSet {
  bg: string;
  text: string;
  ring: string;
  solid: string;
  softBorder: string;
}

export const TAG_CLASSES: Record<TagColor, TagClassSet> = {
  purple: {
    bg: "bg-tag-purple-soft",
    text: "text-tag-purple",
    ring: "ring-tag-purple/30",
    solid: "bg-tag-purple",
    softBorder: "border-tag-purple/40",
  },
  teal: {
    bg: "bg-tag-teal-soft",
    text: "text-tag-teal",
    ring: "ring-tag-teal/30",
    solid: "bg-tag-teal",
    softBorder: "border-tag-teal/40",
  },
  coral: {
    bg: "bg-tag-coral-soft",
    text: "text-tag-coral",
    ring: "ring-tag-coral/30",
    solid: "bg-tag-coral",
    softBorder: "border-tag-coral/40",
  },
  pink: {
    bg: "bg-tag-pink-soft",
    text: "text-tag-pink",
    ring: "ring-tag-pink/30",
    solid: "bg-tag-pink",
    softBorder: "border-tag-pink/40",
  },
  blue: {
    bg: "bg-tag-blue-soft",
    text: "text-tag-blue",
    ring: "ring-tag-blue/30",
    solid: "bg-tag-blue",
    softBorder: "border-tag-blue/40",
  },
  green: {
    bg: "bg-tag-green-soft",
    text: "text-tag-green",
    ring: "ring-tag-green/30",
    solid: "bg-tag-green",
    softBorder: "border-tag-green/40",
  },
  amber: {
    bg: "bg-tag-amber-soft",
    text: "text-tag-amber",
    ring: "ring-tag-amber/30",
    solid: "bg-tag-amber",
    softBorder: "border-tag-amber/40",
  },
  gray: {
    bg: "bg-tag-gray-soft",
    text: "text-tag-gray",
    ring: "ring-tag-gray/30",
    solid: "bg-tag-gray",
    softBorder: "border-tag-gray/40",
  },
};

export const DEFAULT_TAGS: Tag[] = [
  { id: "work", name: "work", color: "purple" },
  { id: "study", name: "study", color: "blue" },
  { id: "personal", name: "personal", color: "pink" },
  { id: "social", name: "social", color: "amber" },
  { id: "deepwork", name: "deepwork", color: "teal" },
];

const CATEGORY_TO_TAG: Record<Category, string> = {
  work: "work",
  focus: "deepwork",
  social: "social",
  health: "personal",
  personal: "personal",
  errand: "personal",
};

export function tagForCategory(c: Category): string {
  return CATEGORY_TO_TAG[c] ?? "work";
}

export function getTag(tags: Tag[], id?: string): Tag | undefined {
  if (!id) return undefined;
  return tags.find((t) => t.id === id);
}

export function tagClasses(tag?: Tag): TagClassSet {
  if (!tag) return TAG_CLASSES.purple;
  return TAG_CLASSES[tag.color];
}
