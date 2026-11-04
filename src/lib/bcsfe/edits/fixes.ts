/** Port of bcsfe/cli/edits/fixes.py (pure mutations, no console I/O). */
import { Cannons } from "@/lib/bcsfe/core/game/gamoto/ototo";
import { OfficerPass } from "@/lib/bcsfe/core/game/catbase/officer_pass";
import type { SaveFile } from "@/lib/bcsfe/core/io/save";

export function fix_gamatoto_crash(save_file: SaveFile): void {
  save_file.gamatoto.skin = 2;
}

export function fix_ototo_crash(save_file: SaveFile): void {
  save_file.ototo.cannons = Cannons.init(save_file.game_version);
}

/**
 * Sets date_3, timestamp and energy_penalty_timestamp to "now".
 * - date_3: gacha errors (can't be ahead of device time)
 * - timestamp: gacha errors (max 10 min ahead / 1.5 days behind device time)
 * - energy_penalty_timestamp: energy / gamatoto errors (within 1 day of device time)
 */
export function fix_time_errors(save_file: SaveFile, now: Date = new Date()): void {
  save_file.date_3 = now;
  save_file.timestamp = now.getTime() / 1000;
  save_file.energy_penalty_timestamp = now.getTime() / 1000;
}

/** BasicItems.unlock_equip_menu -> SaveFile.unlock_equip_menu */
export function unlock_equip_menu(save_file: SaveFile): void {
  // Python indexes menu_unlocks[2] directly; pad so blank / very old saves do not throw.
  while (save_file.menu_unlocks.length < 3) save_file.menu_unlocks.push(0);
  save_file.unlock_equip_menu();
}

/** OfficerPass.fix_crash */
export function fix_officer_pass_crash(save_file: SaveFile): void {
  OfficerPass.fix_crash(save_file);
}
