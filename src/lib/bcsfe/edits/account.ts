/** Account related edits: ports of cli/save_management.py (account part), cli/edits/basic_items.py and Gatya.edit_*_seed. */
import type { SaveFile } from "@/lib/bcsfe/core/io/save";
import { ServerHandler, type StatusCallback } from "@/lib/bcsfe/core/server/server_handler";
import { BackupMetaData } from "@/lib/bcsfe/core/server/managed_item";
import { core_data } from "@/lib/bcsfe/core/core_data";
import { ConfigKey } from "@/lib/bcsfe/core/io/config";

export const U32_MAX = 4294967295;

/** SaveManagement.unban_account / create_new_account: gets a fresh inquiry code, password and auth token. */
export async function unban_account(save_file: SaveFile, on_status: StatusCallback | null = null): Promise<boolean> {
  return new ServerHandler(save_file, true, on_status).create_new_account();
}

/** SaveManagement.upload_items: optionally creates a new account first (STRICT_BAN_PREVENTION), then uploads managed items. */
export async function upload_items(
  save_file: SaveFile,
  check_strict = true,
  on_status: StatusCallback | null = null,
): Promise<{ ok: boolean; created_account: boolean }> {
  let created_account = false;
  if (check_strict && core_data.config.get_bool(ConfigKey.STRICT_BAN_PREVENTION)) {
    await unban_account(save_file, on_status);
    created_account = true;
  }
  const ok = await new ServerHandler(save_file, true, on_status).upload_meta_data();
  return { ok, created_account };
}

export function managed_item_count(save_file: SaveFile): number {
  return new BackupMetaData(save_file).get_managed_items().length;
}

/** BasicItems.edit_inquiry_code (after the warning was confirmed). */
export function set_inquiry_code(save_file: SaveFile, value: string): void {
  save_file.inquiry_code = value;
}

/** BasicItems.edit_password_refresh_token (after the warning was confirmed). */
export function set_password_refresh_token(save_file: SaveFile, value: string): void {
  save_file.password_refresh_token = value;
}

export type GatyaSeedKind = "rare" | "normal" | "event";

export function get_gatya_seed(save_file: SaveFile, kind: GatyaSeedKind): number {
  const v = save_file.gatya[`${kind}_seed`];
  return typeof v === "bigint" ? Number(v) : v;
}

/** Gatya.edit_{rare,normal,event}_gatya_seed: u32 with hidden max. */
export function set_gatya_seed(save_file: SaveFile, kind: GatyaSeedKind, value: number): void {
  if (!Number.isInteger(value) || value < 0 || value > U32_MAX) {
    throw new RangeError(`Seed must be an integer between 0 and ${U32_MAX}`);
  }
  save_file.gatya[`${kind}_seed`] = value;
}
