/**
 * Node-only test helper: loads a game data .tar.xz archive from disk into the
 * GameDataGetter used by core_data, so game modules / edits can be exercised
 * outside the browser.
 *
 * Usage (in a tsx script):
 *   const save = SaveFile.from_bytes(bytes);
 *   await loadGameDataForSave(save, process.env.BCSFE_GAME_DATA!);
 */
import fs from "node:fs";
import * as xzmod from "xz-decompress";
import { parse_tar } from "@/lib/bcsfe/core/server/game_data_getter";
import { core_data } from "@/lib/bcsfe/core/core_data";
import type { SaveFile } from "@/lib/bcsfe/core/io/save";

export async function loadGameDataForSave(save: SaveFile, tarXzPath: string): Promise<number> {
  const xz = ((xzmod as unknown as { default?: unknown }).default ?? xzmod);
  const { XzReadableStream } = xz as unknown as {
    XzReadableStream: new (s: ReadableStream<Uint8Array>) => ReadableStream<Uint8Array>;
  };
  const buf = fs.readFileSync(tarXzPath);
  const res = new Response(new XzReadableStream(new Blob([buf]).stream() as ReadableStream<Uint8Array>));
  const files = parse_tar(new Uint8Array(await res.arrayBuffer()));
  core_data.reset();
  const gdg = core_data.get_game_data_getter(save);
  gdg.files = files;
  gdg.version = save.game_version.to_string();
  (gdg as unknown as { prepared: boolean }).prepared = true;
  return files.size;
}
