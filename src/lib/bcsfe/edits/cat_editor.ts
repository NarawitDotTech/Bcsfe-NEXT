/**
 * Port of bcsfe/cli/edits/cat_editor.py as pure functions (no prompts / printing).
 * Selection helpers return `Cat[]` (live objects of `save.cats`), or `null` when
 * the required game data is unavailable.
 */
import type { SaveFile } from "@/lib/bcsfe/core/io/save";
import { Cat, Cats, UnitBuy } from "@/lib/bcsfe/core/game/catbase/cat";
import { Upgrade } from "@/lib/bcsfe/core/game/catbase/upgrade";
import { PowerUpHelper } from "@/lib/bcsfe/core/game/catbase/powerup";
import { GameVersion } from "@/lib/bcsfe/core/game_version";
import { core_data } from "@/lib/bcsfe/core/core_data";
import { ConfigKey } from "@/lib/bcsfe/core/io/config";

export type SelectMode = "and" | "or" | "replace";

// ---------------------------------------------------------------- helpers

export function set_rank_up_sale(save_file: SaveFile): void {
  save_file.rank_up_sale_value = 0x7fffffff;
}

/** First known name of a cat, or its id as string. */
export function cat_name(save_file: SaveFile, cat: Cat): string {
  const names = cat.get_names_cls(save_file);
  const n = names?.[0];
  return n ? n : String(cat.id);
}

/** All names (one per form) of a cat; falls back to the id. */
export function cat_names(save_file: SaveFile, cat: Cat): string[] {
  const names = cat.get_names_cls(save_file);
  return names && names.length > 0 ? names : [String(cat.id)];
}

/** Map the selected cats to the live cats in the save (CatEditor.get_save_cats). */
export function get_save_cats(save_file: SaveFile, cats: Cat[]): Cat[] {
  const out: Cat[] = [];
  for (const cat of cats) {
    const ct = save_file.cats.get_cat_by_id(cat.id);
    if (ct !== null) out.push(ct);
  }
  return out;
}

/**
 * Parse "0-50 72 100-110" (also commas) into ids; "all" gives every id in 0..max.
 * Out of range ids are dropped.
 */
export function parse_id_ranges(text: string, max_id: number): number[] {
  const ids = new Set<number>();
  for (const tok of text.split(/[\s,]+/).filter(Boolean)) {
    if (tok.toLowerCase() === "all") {
      for (let i = 0; i <= max_id; i++) ids.add(i);
      continue;
    }
    const m = tok.match(/^(\d+)(?:-(\d+))?$/);
    if (!m) continue;
    const a = parseInt(m[1], 10);
    const b = m[2] !== undefined ? parseInt(m[2], 10) : a;
    for (let i = Math.min(a, b); i <= Math.min(Math.max(a, b), max_id); i++) ids.add(i);
  }
  return [...ids].sort((x, y) => x - y);
}

// -------------------------------------------------------------- selection

export function select_all(save_file: SaveFile): Cat[] {
  return [...save_file.cats.get_all_cats()];
}
export function select_current(save_file: SaveFile): Cat[] {
  return save_file.cats.get_unlocked_cats();
}
export function select_not_unlocked(save_file: SaveFile): Cat[] {
  return save_file.cats.get_non_unlocked_cats();
}
export function select_obtainable(save_file: SaveFile): Cat[] | null {
  return save_file.cats.get_cats_obtainable(save_file);
}
export function select_not_obtainable(save_file: SaveFile): Cat[] | null {
  return save_file.cats.get_cats_non_obtainable(save_file);
}
export function select_non_gacha(save_file: SaveFile): Cat[] {
  return save_file.cats.get_non_gacha_cats(save_file);
}
export function select_ids(save_file: SaveFile, ids: number[]): Cat[] {
  const set = new Set(ids);
  return save_file.cats.cats.filter((c) => set.has(c.id));
}
export function select_name(save_file: SaveFile, query: string): Cat[] {
  if (!query.trim()) return [];
  return save_file.cats.get_cats_name(save_file, query);
}
export function select_rarity(save_file: SaveFile, rarities: number[]): Cat[] {
  const set = new Set(rarities);
  const ub = save_file.cats.read_unitbuy(save_file);
  return save_file.cats.cats.filter((c) => set.has(ub.get_cat_rarity(c.id)));
}
export function get_rarity_names(save_file: SaveFile): string[] {
  return Cats.get_rarity_names(save_file);
}
/** Number of gacha banners in GatyaDataSet R1 (or null when unavailable). */
export function get_gatya_banner_count(save_file: SaveFile): number | null {
  const gset = save_file.gatya.read_gatya_data_set(save_file).gatya_data_set;
  return gset === null ? null : gset.length;
}
/** Cat ids contained in a banner (empty when unknown). */
export function get_gatya_banner_cat_ids(save_file: SaveFile, banner_id: number): number[] {
  return save_file.gatya.read_gatya_data_set(save_file).get_cat_ids(banner_id) ?? [];
}
export function select_gatya_banners(save_file: SaveFile, banner_ids: number[]): Cat[] | null {
  const gset = save_file.gatya.read_gatya_data_set(save_file);
  if (gset.gatya_data_set === null) return null;
  const ids = new Set<number>();
  for (const b of banner_ids) for (const id of gset.get_cat_ids(b) ?? []) ids.add(id);
  return select_ids(save_file, [...ids]);
}

/** Sorted list of distinct game versions found in unitbuy.csv (excluding -1). */
export function get_unit_game_versions(save_file: SaveFile): number[] {
  const ub = save_file.cats.read_unitbuy(save_file);
  const set = new Set<number>();
  for (const c of ub.unit_buy ?? []) if (c.game_version !== -1) set.add(c.game_version);
  return [...set].sort((a, b) => a - b);
}

/**
 * Parse a version spec like "12.2.0 13.0.0-13.1.0" into the list of game versions (ints).
 * Invalid chunks are ignored.
 */
export function parse_version_spec(text: string): number[] {
  const out: number[] = [];
  for (const chunk of text.split(/\s+/).filter(Boolean)) {
    try {
      const parts = chunk.split("-");
      if (parts.length === 2) {
        const v1 = GameVersion.from_string(parts[0]).game_version;
        const v2 = GameVersion.from_string(parts[1]).game_version;
        for (let v = v1; v <= v2; v++) out.push(v);
      } else {
        out.push(GameVersion.from_string(chunk).game_version);
      }
    } catch {
      // ignore invalid chunk
    }
  }
  return out;
}

export function select_game_versions(save_file: SaveFile, versions: number[]): Cat[] | null {
  const ub: UnitBuy = save_file.cats.read_unitbuy(save_file);
  if (ub.unit_buy === null) return null;
  const valid = new Set(versions);
  const out: Cat[] = [];
  for (const cat of save_file.cats.cats) {
    const row = ub.get_unit_buy(cat.id);
    if (row !== null && valid.has(row.game_version)) out.push(cat);
  }
  return out;
}

/** Combine the previous selection with a new one (CatEditor.select). Empty previous => OR. */
export function combine_selection(current: Cat[], added: Cat[], mode: SelectMode): Cat[] {
  if (current.length === 0 || mode === "or") {
    const seen = new Set(current.map((c) => c.id));
    const out = [...current];
    for (const c of added) if (!seen.has(c.id)) out.push(c);
    return out.sort((a, b) => a.id - b.id);
  }
  if (mode === "and") {
    const set = new Set(added.map((c) => c.id));
    return current.filter((c) => set.has(c.id));
  }
  return [...added];
}

// ------------------------------------------------------------ simple edits

export function unlock_cats(save_file: SaveFile, cats: Cat[]): number {
  const list = get_save_cats(save_file, cats);
  for (const cat of list) cat.unlock(save_file);
  set_rank_up_sale(save_file);
  return list.length;
}

export function remove_cats(save_file: SaveFile, cats: Cat[]): number {
  const reset = core_data.config.get_bool(ConfigKey.RESET_CAT_DATA);
  const list = get_save_cats(save_file, cats);
  for (const cat of list) cat.remove(reset, save_file);
  set_rank_up_sale(save_file);
  return list.length;
}

export function true_form_cats(save_file: SaveFile, cats: Cat[], force = false): number {
  const list = get_save_cats(save_file, cats);
  const set_current = core_data.config.get_bool(ConfigKey.SET_CAT_CURRENT_FORMS);
  save_file.cats.true_form_cats(save_file, list, force, set_current);
  set_rank_up_sale(save_file);
  return list.length;
}

export function fourth_form_cats(save_file: SaveFile, cats: Cat[], force = false): number {
  const list = get_save_cats(save_file, cats);
  const set_current = core_data.config.get_bool(ConfigKey.SET_CAT_CURRENT_FORMS);
  save_file.cats.fourth_form_cats(save_file, list, force, set_current);
  set_rank_up_sale(save_file);
  return list.length;
}

export function remove_true_form_cats(save_file: SaveFile, cats: Cat[]): number {
  const list = get_save_cats(save_file, cats);
  for (const cat of list) cat.remove_true_form();
  set_rank_up_sale(save_file);
  return list.length;
}

export function remove_fourth_form_cats(save_file: SaveFile, cats: Cat[]): number {
  const list = get_save_cats(save_file, cats);
  for (const cat of list) cat.remove_fourth_form();
  set_rank_up_sale(save_file);
  return list.length;
}

export function unlock_cat_guide(save_file: SaveFile, cats: Cat[]): number {
  const list = get_save_cats(save_file, cats);
  const unlock = core_data.config.get_bool(ConfigKey.UNLOCK_CAT_ON_EDIT);
  for (const cat of list) {
    if (unlock) cat.unlock(save_file);
    cat.catguide_collected = true;
  }
  set_rank_up_sale(save_file);
  return list.length;
}

export function remove_cat_guide(save_file: SaveFile, cats: Cat[]): number {
  const list = get_save_cats(save_file, cats);
  for (const cat of list) cat.catguide_collected = false;
  set_rank_up_sale(save_file);
  return list.length;
}

// ---------------------------------------------------------------- upgrades

export type UpgradeLimits = {
  /** Max base level as shown to the user (1-based). */
  max_base: number;
  max_plus: number;
};

/** Per-cat upgrade limits (PowerUpHelper.get_max_possible_*). */
export function get_cat_upgrade_limits(save_file: SaveFile, cat: Cat): UpgradeLimits {
  const p = new PowerUpHelper(cat, save_file);
  return { max_base: p.get_max_possible_base(), max_plus: p.get_max_possible_plus() };
}

/** Limits across all cats (used for the "all at once" mode). */
export function get_overall_upgrade_limits(save_file: SaveFile, cat: Cat): UpgradeLimits {
  const p = new PowerUpHelper(cat, save_file);
  return { max_base: p.get_max_max_base_upgrade_level(), max_plus: p.get_max_max_plus_upgrade_level() };
}

/**
 * Parse the upgrade grammar `base+plus` (numbers, ranges `a-b`, `max`, blank = no change).
 * `max_base` is the displayed (1-based) maximum level. Returns null when invalid.
 */
export function parse_upgrade(input: string, max_base: number, max_plus: number): Upgrade | null {
  const disable = core_data.config.get_bool(ConfigKey.DISABLE_MAXES);
  const [u] = Upgrade.get_user_upgrade(input.trim().toLowerCase(), max_base - 1, max_plus, "max", disable);
  return u;
}

/** Apply an Upgrade to one cat (simulated base upgrades + direct plus). */
export function apply_upgrade_to_cat(save_file: SaveFile, cat: Cat, upgrade: Upgrade): void {
  const power_up = new PowerUpHelper(cat, save_file);
  if (upgrade.base !== -1) {
    power_up.reset_upgrade();
    power_up.upgrade_by(upgrade.base);
  }
  cat.set_upgrade(save_file, upgrade, true);
}

/** Same grammar input for every selected cat (CatEditor.upgrade_many). Returns cats changed, or -1 if invalid. */
export function upgrade_cats_all(save_file: SaveFile, cats: Cat[], input: string): number {
  const list = get_save_cats(save_file, cats);
  if (list.length === 0) return 0;
  const lim = get_overall_upgrade_limits(save_file, list[0]);
  const upgrade = parse_upgrade(input, lim.max_base, lim.max_plus);
  if (upgrade === null) return -1;
  for (const cat of list) apply_upgrade_to_cat(save_file, cat, upgrade);
  set_rank_up_sale(save_file);
  return list.length;
}

/** Different input per cat. Blank/invalid inputs are skipped. Returns the number of changed cats. */
export function upgrade_cats_individual(
  save_file: SaveFile,
  entries: { cat_id: number; input: string }[],
): number {
  let n = 0;
  for (const { cat_id, input } of entries) {
    const cat = save_file.cats.get_cat_by_id(cat_id);
    if (cat === null || !input.trim()) continue;
    const lim = get_cat_upgrade_limits(save_file, cat);
    const upgrade = parse_upgrade(input, lim.max_base, lim.max_plus);
    if (upgrade === null) continue;
    apply_upgrade_to_cat(save_file, cat, upgrade);
    n++;
  }
  set_rank_up_sale(save_file);
  return n;
}

// ----------------------------------------------------------------- talents

export type TalentInfo = {
  names: string[];
  max_levels: number[];
  levels: number[];
  ids: number[];
};

export type TalentVersionStatus = { ok: boolean; data_version: string | null; save_version: string };

export function check_talent_version(save_file: SaveFile): TalentVersionStatus {
  const gdg = core_data.get_game_data_getter(save_file);
  return {
    ok: gdg.does_save_version_match(save_file),
    data_version: gdg.version,
    save_version: save_file.game_version.to_string(),
  };
}

/** Talent names / limits / current levels of a cat; null when the cat has no talents in the game data. */
export function get_talent_info(save_file: SaveFile, cat: Cat): TalentInfo | null {
  const talent_data = save_file.cats.read_talent_data(save_file);
  if (talent_data === null) return null;
  const d = talent_data.get_cat_talents(cat);
  if (d === null) return null;
  return { names: d[0], max_levels: d[1], levels: d[2], ids: d[3] };
}

/** Cat ids that have talent data (for listing). */
export function cat_has_talents(save_file: SaveFile, cat: Cat): boolean {
  return get_talent_info(save_file, cat) !== null;
}

/** Set talent levels for one cat (values clamped to [0, max]). */
export function set_cat_talents(save_file: SaveFile, cat: Cat, levels: number[]): boolean {
  const info = get_talent_info(save_file, cat);
  if (info === null) return false;
  if (core_data.config.get_bool(ConfigKey.UNLOCK_CAT_ON_EDIT)) cat.unlock(save_file);
  info.ids.forEach((id, i) => {
    const t = cat.get_talent_from_id(id);
    if (t === null) return;
    const lv = levels[i] ?? t.level;
    t.level = Math.max(0, Math.min(Math.trunc(lv), info.max_levels[i]));
  });
  set_rank_up_sale(save_file);
  return true;
}

/** Set every talent of the selected cats to its max level (edit_talent_many). Returns changed cat count. */
export function max_talents_cats(save_file: SaveFile, cats: Cat[]): number {
  let n = 0;
  for (const cat of get_save_cats(save_file, cats)) {
    const info = get_talent_info(save_file, cat);
    if (info === null) continue;
    set_cat_talents(save_file, cat, info.max_levels);
    n++;
  }
  set_rank_up_sale(save_file);
  return n;
}

export function remove_talents_cats(save_file: SaveFile, cats: Cat[]): number {
  let n = 0;
  for (const cat of get_save_cats(save_file, cats)) {
    if (cat.talents === null) continue;
    for (const t of cat.talents) t.level = 0;
    n++;
  }
  set_rank_up_sale(save_file);
  return n;
}
