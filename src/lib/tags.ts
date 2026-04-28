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

export interface TagPalette {
  bg: string;
  text: string;
  sub: string;
  light: string;
  pale: string;
  border: string;
  accent: string;
}

export const TAG_HEX: Record<TagColor, TagPalette> = {
  purple: { bg: "#AFA9EC", text: "#3C3489", sub: "#534AB7", light: "#CECBF6", pale: "#EEEDFE", border: "#C5BEF5", accent: "#534AB7" },
  teal:   { bg: "#9FE1CB", text: "#085041", sub: "#0F6E56", light: "#E1F5EE", pale: "#E1F5EE", border: "#9FE1CB", accent: "#0F6E56" },
  coral:  { bg: "#F5C4B3", text: "#712B13", sub: "#993C1D", light: "#FAECE7", pale: "#FAECE7", border: "#F5C4B3", accent: "#993C1D" },
  pink:   { bg: "#F4C0D1", text: "#72243E", sub: "#993556", light: "#FBEAF0", pale: "#FBEAF0", border: "#F4C0D1", accent: "#993556" },
  blue:   { bg: "#B5D4F4", text: "#0C447C", sub: "#185FA5", light: "#E6F1FB", pale: "#E6F1FB", border: "#B5D4F4", accent: "#185FA5" },
  green:  { bg: "#C0DD97", text: "#27500A", sub: "#3B6D11", light: "#EAF3DE", pale: "#EAF3DE", border: "#B8DDA0", accent: "#3B6D11" },
  amber:  { bg: "#FAC775", text: "#633806", sub: "#854F0B", light: "#FAEEDA", pale: "#FAEEDA", border: "#FAC775", accent: "#854F0B" },
  gray:   { bg: "#D3D1C7", text: "#444441", sub: "#5F5E5A", light: "#F1EFE8", pale: "#F1EFE8", border: "#C8C4BE", accent: "#5F5E5A" },
};

export function tagPalette(tag?: Tag): TagPalette {
  if (!tag) return TAG_HEX.gray;
  return TAG_HEX[tag.color] ?? TAG_HEX.gray;
}

export function tagPaletteById(tags: Tag[], id?: string): TagPalette {
  return tagPalette(getTag(tags, id));
}
