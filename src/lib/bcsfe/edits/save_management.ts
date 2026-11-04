/** Save management helpers: ports of cli/save_management.py + cli/feature_handler.py (do_save_actions) as pure functions. */
import { core_data } from "@/lib/bcsfe/core/core_data";
import { ConfigKey } from "@/lib/bcsfe/core/io/config";
import { CountryCode } from "@/lib/bcsfe/core/country_code";
import { GameVersion } from "@/lib/bcsfe/core/game_version";
import { SaveFile } from "@/lib/bcsfe/core/io/save";
import { Data } from "@/lib/bcsfe/core/io/data";
import { StoryChapters } from "@/lib/bcsfe/core/game/map/story";
import type { StatusCallback } from "@/lib/bcsfe/core/server/server_handler";
import { unban_account } from "@/lib/bcsfe/edits/account";
import { upload_save_get_codes } from "@/lib/bcsfe/edits/server_cli";
import { clear_tutorial } from "@/lib/bcsfe/edits/clear_tutorial";

/** FeatureHandler.do_save_actions: runs on load (and before every feature in the CLI). */
export function do_save_actions(save_file: SaveFile): void {
  if (core_data.config.get_bool(ConfigKey.CLEAR_TUTORIAL_ON_LOAD)) {
    StoryChapters.clear_tutorial(save_file);
  }
  if (core_data.config.get_bool(ConfigKey.REMOVE_BAN_MESSAGE_ON_LOAD)) {
    save_file.show_ban_message = false;
  }
}

/** select_features_run start: clear tutorial (silently) and remove the ban message, then the config driven actions. */
export function apply_load_actions(save_file: SaveFile): void {
  StoryChapters.clear_tutorial(save_file);
  save_file.show_ban_message = false;
  do_save_actions(save_file);
}

export const COUNTRY_CODE_LABELS: Record<string, string> = {
  en: "English (global)",
  jp: "Japanese",
  kr: "Korean",
  tw: "Taiwanese",
};

export function all_country_codes(): { code: string; label: string }[] {
  return CountryCode.get_all().map((cc) => ({ code: cc.get_code(), label: COUNTRY_CODE_LABELS[cc.get_code()] ?? cc.get_code() }));
}

/** Parses "12.2.1" style strings. Returns null when invalid. */
export function parse_game_version(text: string): GameVersion | null {
  const t = text.trim();
  if (!/^\d{1,2}(\.\d{1,2}){1,2}$/.test(t)) return null;
  const gv = GameVersion.from_string(t);
  return Number.isFinite(gv.game_version) ? gv : null;
}

/** SaveManagement.convert_save_gv */
export function convert_game_version(save_file: SaveFile, gv: GameVersion): void {
  save_file.set_gv(gv);
  core_data.init_data();
}

/**
 * SaveManagement.convert_save_cc. Python always creates a new account afterwards; with `create_account=false`
 * (offline) only the country code is changed.
 */
export async function convert_country_code(
  save_file: SaveFile,
  cc: CountryCode,
  create_account: boolean,
  on_status: StatusCallback | null = null,
): Promise<{ account_created: boolean | null }> {
  save_file.set_cc(cc);
  let account_created: boolean | null = null;
  if (create_account) account_created = await unban_account(save_file, on_status);
  core_data.init_data();
  return { account_created };
}

/** SaveManagement.save_upload: (strict ban prevention -> new account), upload, return codes or null. */
export async function upload_save(
  save_file: SaveFile,
  on_status: StatusCallback | null = null,
): Promise<{ codes: [string, string] | null; created_account: boolean }> {
  let created_account = false;
  if (core_data.config.get_bool(ConfigKey.STRICT_BAN_PREVENTION)) {
    await unban_account(save_file, on_status);
    created_account = true;
  }
  const codes = await upload_save_get_codes(save_file, true, on_status);
  return { codes, created_account };
}

/** SaveManagement.export_save: SaveFile.to_dict() as pretty JSON. */
export function export_save_json(save_file: SaveFile): string {
  return JSON.stringify(save_file.to_dict(), null, 2);
}

/** Loading helpers shared by the landing screen. */
export function save_from_bytes(bytes: Uint8Array, cc: CountryCode | null): SaveFile {
  SaveFile.ignore_parse_error = core_data.config.get_bool(ConfigKey.IGNORE_PARSE_ERROR);
  return new SaveFile(new Data(bytes), cc);
}

export function save_from_json(text: string): SaveFile {
  SaveFile.ignore_parse_error = core_data.config.get_bool(ConfigKey.IGNORE_PARSE_ERROR);
  const parsed: unknown = JSON.parse(text);
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("The JSON file does not contain a save data object.");
  }
  return SaveFile.from_dict(parsed as Parameters<typeof SaveFile.from_dict>[0]);
}

export function new_blank_save(cc: CountryCode, gv: GameVersion): SaveFile {
  const save = new SaveFile(null, cc, false, gv);
  set_fresh_save_times(save);
  return save;
}

/**
 * SaveFile.init_save leaves every date / timestamp at 0 (1970). The game compares these with the
 * server / device time, so a blank save must start "now" (same fields as fix_time_errors, plus the
 * other save dates).
 */
export function set_fresh_save_times(save: SaveFile, now: Date = new Date()): void {
  save.date = new Date(now);
  save.date_2 = new Date(now);
  save.date_3 = new Date(now);
  save.date_4 = new Date(now);
  save.year = now.getFullYear();
  save.month = now.getMonth() + 1;
  save.day = now.getDate();
  save.timestamp = now.getTime() / 1000;
  save.energy_penalty_timestamp = now.getTime() / 1000;
}


export type ReadyAccountResult =
  | { ok: true; save: SaveFile; transfer_code: string; confirmation_code: string; inquiry_code: string }
  | { ok: false; save: SaveFile; step: "account" | "upload"; inquiry_code: string | null };

/**
 * Creates a ready-to-use account from scratch:
 *  1. a blank save for `cc` / `gv` (SaveFile.init_save),
 *  2. optionally with the tutorial cleared (StoryChapters.clear_tutorial),
 *  3. registers a brand new account with the game server (new inquiry code, password, auth token),
 *  4. uploads the save and returns the transfer + confirmation codes to enter in the game.
 * This contacts the real game servers and creates a real account.
 */
export async function create_ready_account(
  cc: CountryCode,
  gv: GameVersion,
  options: { clear_tutorial?: boolean } = {},
  on_status: StatusCallback | null = null,
): Promise<ReadyAccountResult> {
  const save = new_blank_save(cc, gv);
  if (options.clear_tutorial ?? true) clear_tutorial(save);
  const created = await unban_account(save, on_status);
  const inquiry_code: string | null = save.inquiry_code || null;
  if (!created) return { ok: false, save, step: "account", inquiry_code };
  const codes = await upload_save_get_codes(save, true, on_status);
  if (!codes) return { ok: false, save, step: "upload", inquiry_code };
  return { ok: true, save, transfer_code: codes[0], confirmation_code: codes[1], inquiry_code: save.inquiry_code };
}
