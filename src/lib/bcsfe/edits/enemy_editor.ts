/**
 * Port of cli/edits/enemy_editor.py (pure; no prompts).
 *
 * Deviation from Python: `select_id` subtracts 2 from every user-entered id. The enemy guide
 * array, Enemyname.tsv rows and enemy_dictionary_list.csv all use the same 0-based enemy id
 * (`enemy_guide[id]`), so that subtraction makes the editor change the wrong enemies. The id
 * here is used directly (0-based, bounded by `enemy_guide.length - 1`).
 */
import type { SaveFile } from "@/lib/bcsfe/core/io/save";
import { Enemy, EnemyDictionary } from "@/lib/bcsfe/core/game/battle/enemy";

export type SelectMode = "and" | "or" | "replace";

export function get_all_enemies(save: SaveFile): number[] {
  return save.enemy_guide.map((_, i) => i);
}

export function get_all_valid_enemies(save: SaveFile): number[] | null {
  const ids = new EnemyDictionary(save).get_valid_enemies();
  return ids === null ? null : ids.filter((i) => i >= 0 && i < save.enemy_guide.length);
}

export function get_all_invalid_enemies(save: SaveFile): number[] | null {
  return new EnemyDictionary(save).get_invalid_enemies(save.enemy_guide.length);
}

export function get_enemies_by_id(save: SaveFile, ids: number[]): number[] {
  const set = new Set(ids);
  return get_all_enemies(save).filter((i) => set.has(i));
}

export function get_enemy_name(save: SaveFile, id: number): string | null {
  return new Enemy(id).get_name(save);
}

/** Case-insensitive substring match; returns [id, name] pairs. */
export function get_enemies_by_name(save: SaveFile, name: string): { id: number; name: string }[] {
  const q = name.toLowerCase();
  const out: { id: number; name: string }[] = [];
  for (const id of get_all_enemies(save)) {
    const n = get_enemy_name(save, id);
    if (n === null) continue;
    if (n.toLowerCase().includes(q)) out.push({ id, name: n });
  }
  return out;
}

/** Combines a new selection into the current one (AND = intersection, OR = union, REPLACE). */
export function combine_selection(current: number[], added: number[], mode: SelectMode): number[] {
  if (current.length === 0) return [...new Set(added)].sort((a, b) => a - b);
  if (mode === "and") {
    const cur = new Set(current);
    return added.filter((e) => cur.has(e));
  }
  if (mode === "replace") return [...new Set(added)].sort((a, b) => a - b);
  return [...new Set([...current, ...added])].sort((a, b) => a - b);
}

export function unlock_enemy_guide(save: SaveFile, ids: number[]): void {
  for (const id of ids) if (id >= 0 && id < save.enemy_guide.length) new Enemy(id).unlock_enemy_guide(save);
}

export function remove_enemy_guide(save: SaveFile, ids: number[]): void {
  for (const id of ids) if (id >= 0 && id < save.enemy_guide.length) new Enemy(id).reset_enemy_guide(save);
}
