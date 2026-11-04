/** Pure edit logic for the Gamatoto / Ototo / Cat Shrine features (ports of the CLI flows). */
import type { SaveFile } from "@/lib/bcsfe/core/io/save";
import { core_data } from "@/lib/bcsfe/core/core_data";
import { ConfigKey } from "@/lib/bcsfe/core/io/config";
import {
  Cannon,
  CannonDescriptions,
  CastleRecipeUnlock,
  Cannons,
  Ototo,
} from "@/lib/bcsfe/core/game/gamoto/ototo";
import { CatShrine } from "@/lib/bcsfe/core/game/gamoto/cat_shrine";

/** `MaxValue.specific`: with DISABLE_MAXES the cap is the integer width limit. */
export function cap_max(max: number, bits = 31): number {
  return core_data.config.get_bool(ConfigKey.DISABLE_MAXES) ? 2 ** bits - 1 : max;
}

// ---- engineers / base materials ----
export function engineers_info(save: SaveFile): { name: string; value: number; max: number } {
  return {
    name: Ototo.get_engineers_name(save),
    value: save.ototo.engineers,
    max: cap_max(Ototo.get_max_engineers(save)),
  };
}
export function set_engineers(save: SaveFile, value: number): void {
  save.ototo.edit_engineers(save, Math.max(0, Math.min(value, engineers_info(save).max)));
}

export function base_material_rows(save: SaveFile): { name: string; value: number }[] | null {
  const names = save.ototo.base_materials.get_base_material_names(save);
  if (names === null) return null;
  return names.map((name, i) => ({ name, value: save.ototo.base_materials.materials[i]?.amount ?? 0 }));
}
export function set_base_materials(save: SaveFile, values: number[]): void {
  const max = cap_max(core_data.max_value_manager.base_materials);
  save.ototo.base_materials.edit_base_materials(values.map((v) => Math.max(0, Math.min(v, max))));
}

// ---- gamatoto xp / level ----
export function gamatoto_xp_info(save: SaveFile): { xp: number; level: number; max_level: number | null } | null {
  const levels = core_data.get_gamatoto_levels(save);
  const cur = levels.get_level_from_xp(save.gamatoto.xp);
  if (cur === null) return null;
  return { xp: save.gamatoto.xp, level: cur.level, max_level: levels.get_max_level() };
}
/** Returns [xp, level] after the edit, or null when game data is missing / the value is invalid. */
export function set_gamatoto_xp(save: SaveFile, mode: "raw" | "level", value: number): [number, number | null] | null {
  if (mode === "level") {
    const max = core_data.get_gamatoto_levels(save).get_max_level();
    if (max !== null) value = Math.max(1, Math.min(value, cap_max(max)));
  } else {
    value = Math.max(0, Math.min(value, 2 ** 31 - 1));
  }
  const res = save.gamatoto.edit_xp(save, mode, value);
  if (res === null) return null;
  return [res[0], res[1]?.level ?? null];
}

// ---- gamatoto helpers ----
export function helper_info(save: SaveFile) {
  return save.gamatoto.get_helper_rarity_info(save);
}
/** Cumulative cap: reduces later rarities so the sum never exceeds `max_total` (null = unlimited). */
export function clamp_cumulative(amounts: number[], index: number, value: number, max_total: number | null): number[] {
  const out = amounts.slice();
  value = Math.max(0, value);
  if (max_total !== null) {
    const others = out.reduce((s, v, i) => (i === index ? s : s + v), 0);
    value = Math.min(value, Math.max(0, max_total - others));
  }
  out[index] = value;
  return out;
}
export function set_helpers(save: SaveFile, amounts: number[]): void {
  save.gamatoto.edit_helpers(save, amounts);
}
export function helper_names(save: SaveFile): { name: string; rarity_name: string }[] {
  const members = core_data.get_gamatoto_members_name(save).get_members_from_helpers(save.gamatoto.helpers);
  const out: { name: string; rarity_name: string }[] = [];
  for (const m of members) if (m) out.push({ name: m.name, rarity_name: m.rarity_name });
  return out;
}

// ---- ototo cannons ----
export type CannonRow = { id: number; name: string; development: number; levels: number[]; part_names: string[] };
export const DEVELOPMENT_STAGES = ["none", "foundation", "style", "effect"] as const;

export function cannon_rows(save: SaveFile): CannonRow[] | null {
  const descs = new CannonDescriptions(save);
  if (descs.cannon_descriptions === null) return null;
  const ototo = save.ototo;
  if (ototo.cannons === null) ototo.cannons = Cannons.init(save.game_version);
  const rows: CannonRow[] = [];
  for (const [id, cannon] of ototo.cannons.cannons) {
    const d = descs.get_cannon_description(id);
    if (d === null) continue;
    rows.push({
      id,
      name: d.get_cannon_name(),
      development: cannon.development,
      levels: ototo.get_cannon_display_levels(id) ?? [],
      part_names: d.get_part_names(),
    });
  }
  return rows;
}
export function cannon_part_max(save: SaveFile, cannon_id: number, part_id: number): number | null {
  const m = new CastleRecipeUnlock(save).get_max_level(cannon_id, part_id);
  return m === null ? null : m;
}
export function cannon_part_max_all(save: SaveFile): [number, number, number] | null {
  return Ototo.get_max_part_levels(save);
}
export function set_cannon_development(save: SaveFile, ids: number[], dev: number | Map<number, number>): void {
  save.ototo.edit_cannon_development(save, ids, dev);
}
export function set_cannon_levels(save: SaveFile, ids: number[], levels: number[] | Map<number, number[]>): void {
  save.ototo.edit_cannon_level(save, ids, levels);
}
export type { Cannon };

// ---- cat shrine ----
export function shrine_info(save: SaveFile) {
  const data = core_data.get_cat_shrine_levels(save);
  const xp = save.cat_shrine.xp_offering;
  return {
    xp: Number(xp),
    level: data.get_level_from_xp(xp),
    max_level: data.get_max_level(),
    max_xp: data.get_max_xp(),
    gone: save.cat_shrine.shrine_gone,
  };
}
/**
 * Level L starts at boundaries[L-2] xp (level 1 at 0). The Python/core `get_xp_from_level(1)` indexes
 * boundaries[-1] (max xp), which would make "level 1" the max level, so level 1 is special-cased here.
 */
export function set_shrine_level(save: SaveFile, level: number): void {
  const data = core_data.get_cat_shrine_levels(save);
  const max = data.get_max_level();
  if (max === null) return;
  level = Math.max(1, Math.min(level, max));
  if (level === 1) save.cat_shrine.xp_offering = 0n;
  else CatShrine.edit_level(save, level);
  CatShrine.edit_catshrine(save);
}
export function set_shrine_xp(save: SaveFile, xp: number): void {
  const max = core_data.get_cat_shrine_levels(save).get_max_xp();
  if (max === null) return;
  CatShrine.edit_xp(save, Math.max(0, Math.min(xp, cap_max(max))));
  CatShrine.edit_catshrine(save);
}
export function shrine_appear(save: SaveFile): void {
  save.cat_shrine.appear();
  CatShrine.edit_catshrine(save);
}
export function shrine_disappear(save: SaveFile): void {
  save.cat_shrine.disappear();
  CatShrine.edit_catshrine(save);
}
