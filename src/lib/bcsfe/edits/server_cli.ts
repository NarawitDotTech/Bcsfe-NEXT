/** Port of bcsfe/cli/server_cli.py as pure async functions (no console I/O). */
import type { CountryCode } from "@/lib/bcsfe/core/country_code";
import { GameVersion } from "@/lib/bcsfe/core/game_version";
import type { SaveFile } from "@/lib/bcsfe/core/io/save";
import {
  ServerHandler,
  type RequestResult,
  type StatusCallback,
} from "@/lib/bcsfe/core/server/server_handler";

export type DownloadSaveResult =
  | {
      ok: true;
      save_file: SaveFile;
      server_handler: ServerHandler;
      cc: CountryCode;
      /** raw downloaded save bytes (Python wrote this as transfer_backup) */
      save_bytes: Uint8Array;
    }
  | {
      ok: false;
      /** "no_internet": request failed; "invalid_codes": server rejected the codes */
      error: "no_internet" | "invalid_codes";
      /** Python shows the jp_tw_mixup hint when cc is jp */
      jp_tw_mixup: boolean;
      result: RequestResult | null;
    };

/** ServerCLI.download_save: download a save from transfer + confirmation code. */
export async function download_save(
  transfer_code: string,
  confirmation_code: string,
  cc: CountryCode,
  on_status: StatusCallback | null = null,
): Promise<DownloadSaveResult> {
  const gv = new GameVersion(120200); // not important
  const [server_handler, result] = await ServerHandler.from_codes(
    transfer_code,
    confirmation_code,
    cc,
    gv,
    true,
    true,
    on_status,
  );
  if (server_handler === null) {
    return {
      ok: false,
      error: result === null ? "no_internet" : "invalid_codes",
      jp_tw_mixup: cc.get_code() === "jp",
      result,
    };
  }
  return {
    ok: true,
    save_file: server_handler.save_file,
    server_handler,
    cc,
    save_bytes: server_handler.transfer_backup ?? server_handler.save_file.to_data().to_bytes(),
  };
}

/** Upload a save (SaveFile) and obtain new [transfer_code, confirmation_code], or null on failure. */
export async function upload_save_get_codes(
  save_file: SaveFile,
  upload_managed_items: boolean = true,
  on_status: StatusCallback | null = null,
): Promise<[string, string] | null> {
  const handler = new ServerHandler(save_file, true, on_status);
  return handler.get_codes(upload_managed_items);
}

/** Upload the save + managed item meta data (backup) without generating codes. */
export async function upload_save_meta_data(
  save_file: SaveFile,
  on_status: StatusCallback | null = null,
): Promise<boolean> {
  return new ServerHandler(save_file, true, on_status).upload_meta_data();
}
