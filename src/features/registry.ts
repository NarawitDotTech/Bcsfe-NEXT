import { CATEGORY_ORDER, type FeatureDef } from "@/features/types";
import { features as saveManagement } from "@/features/save_management";
import { features as items } from "@/features/items";
import { features as cats } from "@/features/cats";
import { features as levels } from "@/features/levels";
import { features as gamototo } from "@/features/gamototo";
import { features as other } from "@/features/other";

/** All feature panels, sorted by category order (feature order within a category is preserved). */
export const ALL_FEATURES: FeatureDef[] = [...saveManagement, ...items, ...cats, ...levels, ...gamototo, ...other]
  .map((f, i) => ({ f, i }))
  .sort((a, b) => CATEGORY_ORDER.indexOf(a.f.category) - CATEGORY_ORDER.indexOf(b.f.category) || a.i - b.i)
  .map(({ f }) => f);

export function findFeature(key: string): FeatureDef | undefined {
  return ALL_FEATURES.find((f) => f.key === key);
}
