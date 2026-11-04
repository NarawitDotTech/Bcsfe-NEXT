/**
 * Port of bcsfe/cli/edits/basic_items.py (items part) as pure functions.
 * No prompts / printing: callers pass the new values and get the applied
 * (clamped) values back. All maxima honour the DISABLE_MAXES config flag
 * (Python `MaxValue.specific`).
 */
import type { SaveFile } from "@/lib/bcsfe/core/io/save";
import { core_data } from "@/lib/bcsfe/core/core_data";
import { ConfigKey } from "@/lib/bcsfe/core/io/config";
import { strip_color_tags } from "@/lib/bcsfe/core/locale_handler";
import { GatyaItemCategory } from "@/lib/bcsfe/core/game/catbase/gatya_item";
import { Matatabi } from "@/lib/bcsfe/core/game/catbase/matatabi";
import { BackupMetaData, ManagedItem, ManagedItemType } from "@/lib/bcsfe/core/server/managed_item";
import type { SchemeDataItem } from "@/lib/bcsfe/core/game/catbase/scheme_items";
import { OrbInfo, SaveOrbs } from "@/lib/bcsfe/core/game/catbase/talent_orbs";

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

export function disable_maxes(): boolean {
  try {
    return core_data.config.get_bool(ConfigKey.DISABLE_MAXES);
  } catch {
    return false;
  }
}

/** Python MaxValue.new_bits(max, bits).max: `2^bits - 1` when maxes are disabled. */
export function max_value(max: number | null, bits: number = 31): number {
  if (max === null || disable_maxes()) return 2 ** bits - 1;
  return max;
}

export function clamp_int(value: number, max: number): number {
  let v = Math.trunc(Number.isFinite(value) ? value : 0);
  v = Math.min(v, max);
  return Math.max(v, 0);
}

/** Python gatya item ids used by the items menu. */
export const ITEM_IDS = {
  xp: 6,
  np: 7,
  normal_tickets: 20,
  rare_tickets: 21,
  catfood: 22,
  platinum_tickets: 29,
  leadership: 105,
  legend_tickets: 145,
  platinum_shards: 157,
  hundred_million_tickets: 212,
} as const;

/** Locale display name (first `|` alias), color tags stripped. */
export function locale_name(key: string, params: Record<string, unknown> = {}): string {
  return strip_color_tags(core_data.local_manager.get_key(key, params)).split("|")[0].trim();
}

/** Locale aliases (the part after the first `|`). */
export function locale_aliases(key: string): string[] {
  return strip_color_tags(core_data.local_manager.get_key(key)).split("|").slice(1).map((s) => s.trim());
}

/** Python BasicItems.get_name. */
export function get_name(name: string | null, key: string): string {
  if (name === null || name === undefined) return locale_name(key);
  return name.trim();
}

export function item_name(save: SaveFile, item_id: number, fallback_key: string): string {
  let name: string | null = null;
  try {
    name = core_data.get_gatya_item_names(save).get_name(item_id);
  } catch {
    name = null;
  }
  return get_name(name, fallback_key);
}

export type BannableWarningKey =
  | "catfood_warning"
  | "legend_ticket_warning"
  | "rare_ticket_warning"
  | "platinum_ticket_warning"
  | "100_million_warn";

/** Plain-text warning shown before bannable edits. */
export function get_warning(key: BannableWarningKey): string {
  return strip_color_tags(core_data.local_manager.get_key(key))
    .replace(/\\n/g, "\n")
    .replace(/\s*\(y\/n\):?\s*$/i, "")
    .trim();
}

function add_managed(save: SaveFile, change: number, type: ManagedItemType): void {
  new BackupMetaData(save).add_managed_item(ManagedItem.from_change(change, type));
}

/* ------------------------------------------------------------------ */
/* scalar items                                                        */
/* ------------------------------------------------------------------ */

export type ScalarKey =
  | "catfood" | "xp" | "normal_tickets" | "rare_tickets" | "platinum_tickets" | "legend_tickets"
  | "platinum_shards" | "np" | "leadership" | "hundred_million_ticket";

export type ScalarInfo = { label: string; value: number; max: number };

export function get_catfood_info(save: SaveFile): ScalarInfo {
  return { label: item_name(save, ITEM_IDS.catfood, "catfood"), value: save.catfood, max: max_value(core_data.max_value_manager.catfood) };
}
export function get_xp_info(save: SaveFile): ScalarInfo {
  return { label: item_name(save, ITEM_IDS.xp, "xp"), value: save.xp, max: max_value(core_data.max_value_manager.xp) };
}
export function get_normal_tickets_info(save: SaveFile): ScalarInfo {
  return { label: item_name(save, ITEM_IDS.normal_tickets, "normal_tickets"), value: save.normal_tickets, max: max_value(core_data.max_value_manager.normal_tickets) };
}
export function get_rare_tickets_info(save: SaveFile): ScalarInfo {
  return { label: item_name(save, ITEM_IDS.rare_tickets, "rare_tickets"), value: save.rare_tickets, max: max_value(core_data.max_value_manager.rare_tickets) };
}
export function get_platinum_tickets_info(save: SaveFile): ScalarInfo {
  return { label: item_name(save, ITEM_IDS.platinum_tickets, "platinum_tickets"), value: save.platinum_tickets, max: max_value(core_data.max_value_manager.platinum_tickets) };
}
export function get_legend_tickets_info(save: SaveFile): ScalarInfo {
  return { label: item_name(save, ITEM_IDS.legend_tickets, "legend_tickets"), value: save.legend_tickets, max: max_value(core_data.max_value_manager.legend_tickets) };
}
/** max = max(0, (plat_max - current_plat_tickets) * 10 + 9) */
export function get_platinum_shards_max(save: SaveFile): number {
  const m = (core_data.max_value_manager.platinum_tickets - save.platinum_tickets) * 10 + 9;
  return max_value(Math.max(0, m));
}
export function get_platinum_shards_info(save: SaveFile): ScalarInfo {
  return { label: item_name(save, ITEM_IDS.platinum_shards, "platinum_shards"), value: save.platinum_shards, max: get_platinum_shards_max(save) };
}
export function get_np_info(save: SaveFile): ScalarInfo {
  return { label: item_name(save, ITEM_IDS.np, "np"), value: save.np, max: max_value(core_data.max_value_manager.np) };
}
export function get_leadership_info(save: SaveFile): ScalarInfo {
  return { label: item_name(save, ITEM_IDS.leadership, "leadership"), value: save.leadership, max: max_value(core_data.max_value_manager.leadership, 15) };
}
export function get_hundred_million_ticket_info(save: SaveFile): ScalarInfo {
  return { label: item_name(save, ITEM_IDS.hundred_million_tickets, "100_million_tickets"), value: save.hundred_million_ticket, max: max_value(core_data.max_value_manager.hundred_million_tickets) };
}

/** Each returns the value actually written (clamped to [0, max]). */
export function edit_catfood(save: SaveFile, value: number): number {
  const original = save.catfood;
  save.catfood = clamp_int(value, get_catfood_info(save).max);
  add_managed(save, save.catfood - original, ManagedItemType.CATFOOD);
  return save.catfood;
}
export function edit_xp(save: SaveFile, value: number): number {
  save.xp = clamp_int(value, get_xp_info(save).max);
  return save.xp;
}
export function edit_normal_tickets(save: SaveFile, value: number): number {
  save.normal_tickets = clamp_int(value, get_normal_tickets_info(save).max);
  return save.normal_tickets;
}
export function edit_rare_tickets(save: SaveFile, value: number): number {
  const original = save.rare_tickets;
  save.rare_tickets = clamp_int(value, get_rare_tickets_info(save).max);
  add_managed(save, save.rare_tickets - original, ManagedItemType.RARE_TICKET);
  return save.rare_tickets;
}
export function edit_platinum_tickets(save: SaveFile, value: number): number {
  const original = save.platinum_tickets;
  save.platinum_tickets = clamp_int(value, get_platinum_tickets_info(save).max);
  add_managed(save, save.platinum_tickets - original, ManagedItemType.PLATINUM_TICKET);
  return save.platinum_tickets;
}
export function edit_legend_tickets(save: SaveFile, value: number): number {
  const original = save.legend_tickets;
  save.legend_tickets = clamp_int(value, get_legend_tickets_info(save).max);
  add_managed(save, save.legend_tickets - original, ManagedItemType.LEGEND_TICKET);
  return save.legend_tickets;
}
export function edit_platinum_shards(save: SaveFile, value: number): number {
  save.platinum_shards = clamp_int(value, get_platinum_shards_max(save));
  return save.platinum_shards;
}
export function edit_np(save: SaveFile, value: number): number {
  save.np = clamp_int(value, get_np_info(save).max);
  return save.np;
}
export function edit_leadership(save: SaveFile, value: number): number {
  save.leadership = clamp_int(value, get_leadership_info(save).max);
  return save.leadership;
}
export function edit_100_million_ticket(save: SaveFile, value: number): number {
  save.hundred_million_ticket = clamp_int(value, get_hundred_million_ticket_info(save).max);
  return save.hundred_million_ticket;
}

export function reset_golden_cat_cpus(save: SaveFile): void {
  save.golden_cpu_count = 0;
}

/* ------------------------------------------------------------------ */
/* list items (catseyes / catamins / labyrinth medals / chests)        */
/* ------------------------------------------------------------------ */

export type ListInfo = {
  names: string[];
  values: number[];
  max: number;
};

function category_names(save: SaveFile, category: number, unknown_key: string, limit: number | null = null): string[] | null {
  const names_o = core_data.get_gatya_item_names(save);
  let items = core_data.get_gatya_item_buy(save).get_by_category(category);
  if (items === null) return null;
  if (limit !== null) items = items.slice(0, limit);
  return items.map((item) => names_o.get_name(item.id) ?? core_data.local_manager.get_key(unknown_key, { id: item.id }));
}

/** Python edit_ints_key over a save list: names/values zipped (shorter wins). */
function list_info(names: string[] | null, current: number[], max: number): ListInfo | null {
  if (names === null) return null;
  const n = Math.min(names.length, current.length);
  return { names: names.slice(0, n).map((s) => strip_color_tags(s)), values: current.slice(0, n), max };
}

/** Writes `values[i]` (clamped) into `target[i]` in place. Returns the written values. */
function write_list(target: number[], values: number[], max: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < Math.min(values.length, target.length); i++) {
    target[i] = clamp_int(values[i], max);
    out.push(target[i]);
  }
  return out;
}

export function get_catseyes_info(save: SaveFile): ListInfo | null {
  return list_info(category_names(save, GatyaItemCategory.CATSEYES, "unknown_catseye_name"), save.catseyes, max_value(core_data.max_value_manager.catseyes));
}
export function edit_catseyes(save: SaveFile, values: number[]): number[] {
  return write_list(save.catseyes, values, max_value(core_data.max_value_manager.catseyes));
}

export function get_catamins_info(save: SaveFile): ListInfo | null {
  return list_info(category_names(save, GatyaItemCategory.CATAMINS, "unknown_catamin_name"), save.catamins, max_value(core_data.max_value_manager.catamins));
}
export function edit_catamins(save: SaveFile, values: number[]): number[] {
  return write_list(save.catamins, values, max_value(core_data.max_value_manager.catamins));
}

export function get_labyrinth_medals_info(save: SaveFile): ListInfo | null {
  return list_info(category_names(save, GatyaItemCategory.LABYRINTH_MEDALS, "unknown_labyrinth_medal_name"), save.labyrinth_medals, max_value(core_data.max_value_manager.labyrinth_medals));
}
export function edit_labyrinth_medals(save: SaveFile, values: number[]): number[] {
  return write_list(save.labyrinth_medals, values, max_value(core_data.max_value_manager.labyrinth_medals));
}

export function get_treasure_chests_info(save: SaveFile): ListInfo | null {
  return list_info(
    category_names(save, GatyaItemCategory.TREASURE_CHESTS, "unknown_treasure_chest_name", save.treasure_chests.length),
    save.treasure_chests,
    max_value(core_data.max_value_manager.treasure_chests),
  );
}
export function edit_treasure_chests(save: SaveFile, values: number[]): number[] {
  return write_list(save.treasure_chests, values, max_value(core_data.max_value_manager.treasure_chests));
}

/* ------------------------------------------------------------------ */
/* catfruit                                                            */
/* ------------------------------------------------------------------ */

export type CatfruitInfo = {
  names: string[];
  values: number[];
  /** true when the old (<11.4.0) cumulative cap applies: sum(values) <= max */
  cumulative: boolean;
  max: number;
};

export function get_catfruit_info(save: SaveFile): CatfruitInfo | null {
  const raw = new Matatabi(save).get_names();
  if (raw === null) return null;
  const names: string[] = raw.map((n, i) => n ?? core_data.local_manager.get_key("unknown_catfruit_name", { id: i }));
  const extra = save.catfruit.length - names.length;
  if (extra > 0) {
    for (let i = 0; i < extra; i++) {
      names.push(core_data.local_manager.get_key("unknown_catfruit_name", { id: i + names.length }));
    }
  }
  const cumulative = save.game_version.lt(110400);
  const max = cumulative
    ? max_value(core_data.max_value_manager.catfruit_old)
    : max_value(core_data.max_value_manager.catfruit_new);
  return {
    names: names.slice(0, save.catfruit.length).map((s) => strip_color_tags(s)),
    values: save.catfruit.slice(),
    cumulative,
    max,
  };
}

/** Max for slot `index` given the other slots' current values (cumulative cap on old versions). */
export function catfruit_slot_max(info: CatfruitInfo, values: number[], index: number): number {
  if (!info.cumulative) return info.max;
  const others = values.reduce((a, b, i) => (i === index ? a : a + b), 0);
  return Math.max(0, info.max - others);
}

/**
 * Sets catfruit values. On old versions (<11.4.0) the sum of all slots is capped
 * (CumulativeMax): each slot is limited to max - sum(other slots' new values).
 */
export function edit_catfruit(save: SaveFile, values: number[]): number[] {
  const cumulative = save.game_version.lt(110400);
  const max = cumulative
    ? max_value(core_data.max_value_manager.catfruit_old)
    : max_value(core_data.max_value_manager.catfruit_new);
  const n = Math.min(values.length, save.catfruit.length);
  const wanted = save.catfruit.slice();
  for (let i = 0; i < n; i++) wanted[i] = Math.max(0, Math.trunc(values[i]));
  for (let i = 0; i < n; i++) {
    let cap = max;
    if (cumulative) {
      let others = 0;
      for (let j = 0; j < wanted.length; j++) if (j !== i) others += wanted[j];
      cap = Math.max(0, max - others);
    }
    wanted[i] = clamp_int(wanted[i], cap);
    save.catfruit[i] = wanted[i];
  }
  return save.catfruit.slice();
}

/* ------------------------------------------------------------------ */
/* battle items                                                        */
/* ------------------------------------------------------------------ */

export type BattleItemsInfo = {
  group_name: string;
  names: string[];
  values: number[];
  max: number;
};

export function get_battle_items_info(save: SaveFile): BattleItemsInfo | null {
  const names = save.battle_items.get_names(save);
  if (names === null) return null;
  const group = save.get_localizable().get("shop_category1") ?? locale_name("battle_items");
  return {
    group_name: group,
    names: names.map((n) => strip_color_tags(n ?? "")),
    values: save.battle_items.items.map((i) => i.amount),
    max: max_value(core_data.max_value_manager.battle_items),
  };
}

export function edit_battle_items(save: SaveFile, values: number[]): number[] {
  const max = max_value(core_data.max_value_manager.battle_items);
  const out: number[] = [];
  values.forEach((v, i) => {
    if (i >= save.battle_items.items.length) return;
    save.battle_items.items[i].amount = clamp_int(v, max);
    out.push(save.battle_items.items[i].amount);
  });
  return out;
}

export type EndlessItemInfo = {
  index: number;
  name: string;
  /** formatted current duration */
  duration: string;
  active: boolean;
};

export function get_endless_items_info(save: SaveFile): EndlessItemInfo[] | null {
  const names = save.battle_items.get_names(save);
  if (names === null) return null;
  return save.battle_items.items.map((item, index) => ({
    index,
    name: strip_color_tags(names[index] ?? ""),
    duration: strip_color_tags(item.endless_item.get_endless_duration_formatted()),
    active: item.endless_item.active,
  }));
}

/** Parses minutes: "infinity"/"inf" -> Infinity, otherwise float; null when invalid. */
export function parse_minutes(text: string): number | null {
  const t = text.trim().toLowerCase();
  if (t === "") return null;
  if (t === "inf" || t === "infinity" || t === locale_name("infinity").toLowerCase()) return Infinity;
  if (!/^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/.test(t)) return null;
  return parseFloat(t);
}

/** Sets the endless duration (minutes, Infinity allowed) of each given item index (set_duration_mins(val, 0)). */
export function edit_endless_items(save: SaveFile, minutes_by_index: Map<number, number>): void {
  save.battle_items.edit_endless_items(minutes_by_index);
}

/* ------------------------------------------------------------------ */
/* scheme items                                                        */
/* ------------------------------------------------------------------ */

export type SchemeInfo = {
  options: string[];
  /** scheme id for each option index */
  ids: number[];
  to_obtain: Set<number>;
  received: Set<number>;
  scheme_items: Map<number, SchemeDataItem>;
};

export function get_scheme_info(save: SaveFile): SchemeInfo | null {
  const r = save.scheme_items.get_options(save);
  if (r === null) return null;
  return {
    options: r.options.map((o) => strip_color_tags(o).replace(/\s+/g, " ").trim()),
    ids: Array.from(r.scheme_items.keys()),
    to_obtain: new Set(save.scheme_items.to_obtain),
    received: new Set(save.scheme_items.received),
    scheme_items: r.scheme_items,
  };
}

/** `option_ids` are indexes into `info.options` (as the Python multi-select returns). */
export function add_scheme_items(save: SaveFile, info: SchemeInfo, option_ids: number[]): void {
  save.scheme_items.add_scheme_items(option_ids, info.scheme_items);
}
export function remove_scheme_items(save: SaveFile, info: SchemeInfo, option_ids: number[]): void {
  save.scheme_items.remove_scheme_items(option_ids, info.scheme_items);
}

/* ------------------------------------------------------------------ */
/* talent orbs                                                         */
/* ------------------------------------------------------------------ */

export type OrbFilter = { grade: string | "*"; attribute: string | "*"; effect: string | "*" };

export type TalentOrbsInfo = {
  save_orbs: SaveOrbs;
  grades: string[];
  attributes: string[];
  effects: string[];
  max: number;
  all: OrbInfo[];
};

export function get_talent_orbs_info(save: SaveFile): TalentOrbsInfo | null {
  const save_orbs = SaveOrbs.edit_talent_orbs(save);
  if (save_orbs === null) return null;
  const l = save_orbs.orb_info_list;
  return {
    save_orbs,
    grades: l.get_all_grades(),
    attributes: l.get_all_attributes(),
    effects: l.get_all_effects(),
    max: Math.min(max_value(core_data.max_value_manager.talent_orbs), 32767),
    all: l.orb_info_list,
  };
}

/** Orbs matching grade / attribute / effect (each "*" or empty = any). Sorted like Python. */
export function select_orbs(info: TalentOrbsInfo, filter: Partial<OrbFilter>): OrbInfo[] {
  const l = info.save_orbs.orb_info_list;
  const found = l.get_orbs_from_component_fuzzy(filter.grade || "*", filter.attribute || "*", filter.effect || "*");
  return found.slice().sort((a, b) =>
    (a.raw_orb_info.target_id || -1) - (b.raw_orb_info.target_id || -1)
    || a.raw_orb_info.effect_id - b.raw_orb_info.effect_id
    || a.raw_orb_info.rank_id - b.raw_orb_info.rank_id
    || a.raw_orb_info.orb_id - b.raw_orb_info.orb_id);
}

export function orb_count(save: SaveFile, orb: OrbInfo): number {
  return save.talent_orbs.orbs.get(orb.raw_orb_info.orb_id)?.value ?? 0;
}

/** Plain text description of an orb (color tags stripped). */
export function orb_label(orb: OrbInfo): string {
  return strip_color_tags(orb.to_colortext()).replace(/<\/?[A-Za-z_@]*>/g, "");
}

/** Individual counts: orb_id -> count. Writes to the save. */
export function edit_talent_orbs_individual(save: SaveFile, info: TalentOrbsInfo, counts: Map<number, number>): void {
  for (const [orb_id, count] of counts) {
    const orb = info.all[orb_id];
    if (!orb) continue;
    info.save_orbs.edit_ind(orb, clamp_int(count, info.max));
  }
  info.save_orbs.save(save);
}

/** All selected orbs get the same count. Writes to the save. */
export function edit_talent_orbs_all(save: SaveFile, info: TalentOrbsInfo, orbs: OrbInfo[], count: number): void {
  info.save_orbs.edit_many(info.max, orbs, count);
  info.save_orbs.save(save);
}
