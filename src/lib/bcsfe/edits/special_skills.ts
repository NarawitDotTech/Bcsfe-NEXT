/** Port of the interactive SpecialSkills.edit flow (core/game/catbase/special_skill.py) as pure functions. */
import type { SaveFile } from "@/lib/bcsfe/core/io/save";
import { Upgrade } from "@/lib/bcsfe/core/game/catbase/upgrade";
import { SpecialSkills } from "@/lib/bcsfe/core/game/catbase/special_skill";
import { core_data } from "@/lib/bcsfe/core/core_data";
import { ConfigKey } from "@/lib/bcsfe/core/io/config";
import { set_rank_up_sale } from "@/lib/bcsfe/edits/cat_editor";

export type SpecialSkillInfo = {
  /** Valid skill index (what SpecialSkills.set_upgrade expects). */
  id: number;
  name: string;
  /** 1-based base level shown to the user. */
  base_level: number;
  plus_level: number;
  /** Max base level (1-based) and max plus level from AbilityData. */
  max_base: number;
  max_plus: number;
};

/** Special skills (gatya item category 2) with names, levels and limits. Empty when game data is missing. */
export function list_special_skills(save_file: SaveFile): SpecialSkillInfo[] {
  const names_o = core_data.get_gatya_item_names(save_file);
  const items = core_data.get_gatya_item_buy(save_file).get_by_category(2);
  const ability = core_data.get_ability_data(save_file);
  if (items === null) return [];
  const skills = save_file.special_skills.get_valid_skills();
  const out: SpecialSkillInfo[] = [];
  items.forEach((item, id) => {
    const name = names_o.get_name(item.id);
    if (name === null || id >= skills.length) return;
    const a = ability.get_ability_data_item(id);
    out.push({
      id,
      name,
      base_level: skills[id].upgrade.base + 1,
      plus_level: skills[id].upgrade.plus,
      max_base: a?.max_base_level ?? 90,
      max_plus: a?.max_plus_level ?? 90,
    });
  });
  return out;
}

function parse(input: string, max_base: number, max_plus: number): Upgrade | null {
  const disable = core_data.config.get_bool(ConfigKey.DISABLE_MAXES);
  const [u] = Upgrade.get_user_upgrade(input.trim().toLowerCase(), max_base - 1, max_plus, "max", disable);
  return u;
}

/** Individual edit: each entry has its own `base+plus` input (blank = skip). Returns skills changed. */
export function edit_special_skills_individual(
  save_file: SaveFile,
  entries: { id: number; input: string }[],
): number {
  const ability = core_data.get_ability_data(save_file);
  let n = 0;
  for (const { id, input } of entries) {
    if (!input.trim()) continue;
    const a = ability.get_ability_data_item(id);
    if (a === null) continue;
    const u = parse(input, a.max_base_level, a.max_plus_level);
    if (u === null) continue;
    save_file.special_skills.set_upgrade(id, u);
    n++;
  }
  set_rank_up_sale(save_file);
  return n;
}

/** Same input for all given skills, clamped per-skill (SpecialSkills.edit_many). Returns skills changed, -1 if invalid. */
export function edit_special_skills_all(save_file: SaveFile, ids: number[], input: string): number {
  const lim = SpecialSkills.get_max_levels(save_file);
  if (lim === null) return 0;
  const u = parse(input, lim[0], lim[1]);
  if (u === null) return -1;
  const disable = core_data.config.get_bool(ConfigKey.DISABLE_MAXES);
  save_file.special_skills.edit_many(ids, save_file, u, disable);
  set_rank_up_sale(save_file);
  return ids.length;
}

/** Max limits across all abilities, for the "all" input (1-based base). */
export function get_overall_skill_limits(save_file: SaveFile): { max_base: number; max_plus: number } | null {
  const lim = SpecialSkills.get_max_levels(save_file);
  return lim === null ? null : { max_base: lim[0], max_plus: lim[1] };
}
