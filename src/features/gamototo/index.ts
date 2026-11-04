import type { FeatureDef } from "@/features/types";
import { L, aliasesOf } from "./labels";
import Engineers from "./Engineers";
import BaseMaterials from "./BaseMaterials";
import GamatotoXp from "./GamatotoXp";
import GamatotoHelpers from "./GamatotoHelpers";
import OtotoCannon from "./OtotoCannon";
import CatShrine from "./CatShrine";

const def = (key: string, component: FeatureDef["component"], extra: Partial<FeatureDef> = {}): FeatureDef => ({
  key, category: "gamototo", label: L(key), aliases: aliasesOf(key), component, ...extra,
});

export const features: FeatureDef[] = [
  def("engineers", Engineers, { needsGameData: true }),
  def("base_materials", BaseMaterials, { needsGameData: true }),
  def("gamatoto_xp_level", GamatotoXp, { needsGameData: true, aliases: ["gamatoto_xp", "gamatoto_level"] }),
  def("gamatoto_helpers", GamatotoHelpers, { needsGameData: true }),
  def("ototo_cat_cannon", OtotoCannon, { needsGameData: true, aliases: ["cannon", "ototo"] }),
  def("cat_shrine", CatShrine, { needsGameData: true, aliases: ["shrine"] }),
];
