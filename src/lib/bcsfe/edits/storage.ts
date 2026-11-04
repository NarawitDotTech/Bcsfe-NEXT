/** Port of bcsfe/cli/edits/storage.py as pure functions. */
import type { SaveFile } from "@/lib/bcsfe/core/io/save";
import { Cat, StorageItem } from "@/lib/bcsfe/core/game/catbase/cat";
import { GatyaItemCategory } from "@/lib/bcsfe/core/game/catbase/gatya_item";
import { core_data } from "@/lib/bcsfe/core/core_data";
import { set_rank_up_sale } from "@/lib/bcsfe/edits/cat_editor";

export type StorageEntry = {
  /** Index of the slot in `save.cats.storage_items`. */
  slot: number;
  item_type: number;
  item_id: number;
  label: string;
};

/** Names of the special skills in gatya item category 2 (index = special skill id). */
export function get_special_skill_names(save_file: SaveFile): string[] {
  const items = core_data.get_gatya_item_buy(save_file).get_names_by_category(GatyaItemCategory.SPECIAL_SKILLS) ?? [];
  return items.map(([it, name]) => name || String(it.id));
}

export function get_item_str(save_file: SaveFile, item: StorageItem, skill_names?: string[]): string {
  if (item.item_type === 1) {
    const names = Cat.get_names(item.item_id, save_file);
    const name = names && names.length > 0 ? names[0] : String(item.item_id);
    return `${name} (${item.item_id})`;
  }
  if (item.item_type === 2) {
    const sk = skill_names ?? get_special_skill_names(save_file);
    const name = item.item_id >= 0 && item.item_id < sk.length ? sk[item.item_id] : String(item.item_id);
    return `${name} (${item.item_id})`;
  }
  if (item.item_type === 3) {
    const name = core_data.get_gatya_item_names(save_file).get_name(item.item_id) ?? String(item.item_id);
    return `${name} (${item.item_id})`;
  }
  return `Unrecognised item (type ${item.item_type}, id ${item.item_id})`;
}

/** Non-empty slots with labels. */
export function list_storage(save_file: SaveFile): StorageEntry[] {
  const sk = get_special_skill_names(save_file);
  const out: StorageEntry[] = [];
  save_file.cats.storage_items.forEach((item, slot) => {
    if (item.item_type === 0) return;
    out.push({ slot, item_type: item.item_type, item_id: item.item_id, label: get_item_str(save_file, item, sk) });
  });
  return out;
}

export function get_storage_space(storage: StorageItem[]): number {
  return storage.filter((i) => i.item_type === 0).length;
}

export function get_storage_size(save_file: SaveFile): number {
  return save_file.cats.storage_items.length;
}

export function clear_storage(save_file: SaveFile): void {
  for (const item of save_file.cats.storage_items) {
    item.item_id = 0;
    item.item_type = 0;
  }
}

/** Put an item into the first free slot. */
export function add_item(storage: StorageItem[], item: StorageItem): boolean {
  for (const c of storage) {
    if (c.item_type === 0) {
      c.item_type = item.item_type;
      c.item_id = item.item_id;
      return true;
    }
  }
  return false;
}

export type AddResult = { ok: true; added: number } | { ok: false; error: string };

function add_many(save_file: SaveFile, items: StorageItem[]): AddResult {
  const storage = save_file.cats.storage_items;
  if (items.length === 0) return { ok: true, added: 0 };
  if (items.length > storage.length) {
    return { ok: false, error: `Too many items selected: storage has ${storage.length} slots, ${items.length} requested.` };
  }
  const space = get_storage_space(storage);
  const needs = items.length - space;
  if (needs > 0) return { ok: false, error: `Not enough space: free ${needs} more slot(s).` };
  for (const item of items) add_item(storage, item);
  set_rank_up_sale(save_file);
  return { ok: true, added: items.length };
}

/** Add cats with quantities, e.g. [{id: 0, quantity: 2}]. */
export function add_cats(save_file: SaveFile, entries: { id: number; quantity: number }[]): AddResult {
  const items: StorageItem[] = [];
  for (const { id, quantity } of entries) {
    for (let i = 0; i < Math.max(0, quantity); i++) items.push(StorageItem.from_cat(id));
  }
  return add_many(save_file, items);
}

/** Add special skills (by special skill id) with quantities. */
export function add_special_skills(save_file: SaveFile, entries: { id: number; quantity: number }[]): AddResult {
  const items: StorageItem[] = [];
  for (const { id, quantity } of entries) {
    for (let i = 0; i < Math.max(0, quantity); i++) items.push(StorageItem.from_special_skill(id));
  }
  return add_many(save_file, items);
}

/** Remove the given slots (indices into storage_items). Returns the number removed. */
export function remove_slots(save_file: SaveFile, slots: number[]): number {
  let n = 0;
  for (const slot of new Set(slots)) {
    const item = save_file.cats.storage_items[slot];
    if (!item || item.item_type === 0) continue;
    item.item_type = 0;
    item.item_id = 0;
    n++;
  }
  return n;
}
