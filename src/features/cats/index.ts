import type { FeatureDef } from "@/features/types";
import { strip_color_tags } from "@/lib/bcsfe/core/locale_handler";
import en from "@/lib/bcsfe/files/locales/en.json";
import UnlockRemoveCats from "./UnlockRemoveCats";
import UpgradeCats from "./UpgradeCats";
import { TrueFormCats, ForceTrueFormCats, FourthFormCats, ForceFourthFormCats } from "./FormCats";
import TalentCats from "./TalentCats";
import CatGuide from "./CatGuide";
import SpecialSkills from "./SpecialSkills";
import CatStorage from "./CatStorage";
import CatOverview from "./CatOverview";

const L = (key: string): string => strip_color_tags((en as Record<string, string>)[key] ?? key);

const def = (key: string, component: FeatureDef["component"], aliases: string[], description: string, needsGameData = true): FeatureDef => ({
  key, category: "cats", label: L(key), aliases, description, needsGameData, component,
});

export const features: FeatureDef[] = [
  def("cat_overview", CatOverview, ["cat list", "cats table", "browse cats"], "Searchable table of all cats with inline unlock and level editing."),
  def("unlock_remove_cats", UnlockRemoveCats, ["unlock cats", "remove cats", "get cats"], "Unlock or remove cats from the save."),
  def("upgrade_cats", UpgradeCats, ["level", "upgrade", "max cats", "plus level"], "Set base and plus levels of cats."),
  def("true_form_remove_form_cats", TrueFormCats, ["true form", "evolve", "third form"], "Unlock or remove true forms."),
  def("force_true_form_cats", ForceTrueFormCats, ["force true form"], "Force the true form on cats regardless of game data."),
  def("fourth_form_remove_form_cats", FourthFormCats, ["ultra form", "fourth form", "4th form"], "Unlock or remove ultra (4th) forms."),
  def("force_fourth_form_cats", ForceFourthFormCats, ["force ultra form", "force 4th form"], "Force the ultra (4th) form on cats regardless of game data."),
  def("upgrade_talents_remove_talents_cats", TalentCats, ["talents", "talent levels", "np"], "Upgrade talents to chosen levels or max, or remove them."),
  def("unlock_remove_cat_guide", CatGuide, ["cat guide", "picture book", "collection", "guide rewards"], "Claim or unclaim cat guide entries."),
  def("special_skills", SpecialSkills, ["base abilities", "cat cannon", "abilities", "special skill"], "Upgrade special skills (cat cannon, base abilities)."),
  def("cat_storage", CatStorage, ["storage", "cat box", "inventory"], "View, clear and add cats and special skills in cat storage."),
];
