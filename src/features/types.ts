import type { ComponentType } from "react";

export type FeatureCategory =
  | "save_management"
  | "items"
  | "cats"
  | "levels"
  | "gamototo"
  | "account"
  | "gatya"
  | "fixes"
  | "other"
  | "editor";

export const CATEGORY_LABELS: Record<FeatureCategory, string> = {
  save_management: "Save Management",
  items: "Items",
  cats: "Cats / Special Skills",
  levels: "Levels / Story / Treasure",
  gamototo: "Gamatoto / Ototo",
  account: "Account",
  gatya: "Gacha",
  fixes: "Fixes",
  other: "Other",
  editor: "Editor",
};

export const CATEGORY_ORDER = Object.keys(CATEGORY_LABELS) as FeatureCategory[];

export type FeatureDef = {
  /** Unique key; matches the Python feature key (e.g. "catfood"). Used in the URL. */
  key: string;
  category: FeatureCategory;
  label: string;
  /** Extra search terms (Python alias names). */
  aliases?: string[];
  description?: string;
  /** Panel requires downloaded game data (names, max levels ...). */
  needsGameData?: boolean;
  component: ComponentType;
};
