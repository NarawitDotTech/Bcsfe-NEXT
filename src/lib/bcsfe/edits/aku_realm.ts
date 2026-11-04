/** Port of bcsfe/cli/edits/aku_realm.py */
import type { SaveFile } from "@/lib/bcsfe/core/io/save";

export const AKU_REALM_STAGE_IDS = [255, 256, 257, 258, 265, 266, 268];

export function unlock_aku_realm(save: SaveFile): void {
  for (const stage_id of AKU_REALM_STAGE_IDS) {
    save.event_stages.clear_map(1, stage_id, 0, false);
  }
}
