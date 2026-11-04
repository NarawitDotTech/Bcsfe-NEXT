/**
 * Port of bcsfe/core/server/game_data_getter.py (browser design).
 *
 * All file access is SYNCHRONOUS and served from an in-memory map filled by `await prepare()`:
 *   prepare(): fetch metadata -> resolve version -> (IndexedDB cache | download .tar.xz) -> xz-decompress -> parse tar.
 * The decompressed tar is cached in IndexedDB under `${cc}/${version}` so later sessions skip the download.
 */
import { Data, concatBytes } from "@/lib/bcsfe/core/io/data";
import { CountryCode, CountryCodeType } from "@/lib/bcsfe/core/country_code";
import { GameVersion } from "@/lib/bcsfe/core/game_version";
import { core_data } from "@/lib/bcsfe/core/core_data";
import { ALT_GAME_DATA_REPO, ConfigKey } from "@/lib/bcsfe/core/io/config";
import { fetchViaProxy } from "@/lib/bcsfe/core/net";
import type { SaveFile } from "@/lib/bcsfe/core/io/save";

export interface GameDataProgress {
  stage: "metadata" | "cache" | "download" | "decompress" | "extract" | "done" | "error";
  loaded?: number;
  total?: number;
  message?: string;
}
export type ProgressCallback = (p: GameDataProgress) => void;

export type GameDataMetadata = {
  base_url?: string;
  versions?: Record<string, Record<string, string>>;
} & Record<string, unknown>;

export interface CachedVersion {
  cc: string;
  version: string;
  size: number;
  saved: number;
}

// ---------------------------------------------------------------- IndexedDB cache

const DB_NAME = "bcsfe-game-data";
const STORE = "archives";

interface CacheRecord {
  cc: string;
  version: string;
  saved: number;
  size: number;
  data: Uint8Array;
}

function open_db(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB unavailable"));
      return;
    }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idb_request<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open_db().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const req = fn(tx.objectStore(STORE));
        let result: T;
        req.onsuccess = () => {
          result = req.result;
        };
        tx.oncomplete = () => {
          db.close();
          resolve(result);
        };
        tx.onerror = tx.onabort = () => {
          db.close();
          reject(tx.error);
        };
      }),
  );
}

const cache_key = (cc: string, version: string) => `${cc}/${version}`;

// ---------------------------------------------------------------- tar parsing

const text_decoder = new TextDecoder("utf-8");

function cstring(bytes: Uint8Array, start: number, len: number): string {
  let end = start;
  const max = start + len;
  while (end < max && bytes[end] !== 0) end++;
  return text_decoder.decode(bytes.subarray(start, end));
}

function parse_tar_number(bytes: Uint8Array, start: number, len: number): number {
  if (bytes[start] & 0x80) {
    // base-256 encoding
    let n = bytes[start] & 0x7f;
    for (let i = 1; i < len; i++) n = n * 256 + bytes[start + i];
    return n;
  }
  const s = cstring(bytes, start, len).trim();
  return s ? parseInt(s, 8) : 0;
}

function parse_pax(bytes: Uint8Array): Record<string, string> {
  const out: Record<string, string> = {};
  let pos = 0;
  while (pos < bytes.length) {
    let sp = pos;
    while (sp < bytes.length && bytes[sp] !== 0x20) sp++;
    const rec_len = parseInt(text_decoder.decode(bytes.subarray(pos, sp)), 10);
    if (!rec_len || rec_len <= 0) break;
    const record = text_decoder.decode(bytes.subarray(sp + 1, pos + rec_len - 1)); // strip trailing \n
    const eq = record.indexOf("=");
    if (eq > 0) out[record.slice(0, eq)] = record.slice(eq + 1);
    pos += rec_len;
  }
  return out;
}

/** Parses a (ustar / GNU / pax) tar archive. Returned values are views into `tar` (no copies). */
export function parse_tar(tar: Uint8Array): Map<string, Uint8Array> {
  const files = new Map<string, Uint8Array>();
  let pos = 0;
  let long_name: string | null = null;
  let pax_path: string | null = null;
  let pax_size: number | null = null;
  let global_pax_path: string | null = null;
  while (pos + 512 <= tar.length) {
    // end-of-archive: zero block
    let all_zero = true;
    for (let i = 0; i < 512; i++) {
      if (tar[pos + i] !== 0) {
        all_zero = false;
        break;
      }
    }
    if (all_zero) break;

    let name = cstring(tar, pos, 100);
    let size = parse_tar_number(tar, pos + 124, 12);
    const type = String.fromCharCode(tar[pos + 156] || 0x30);
    const magic = cstring(tar, pos + 257, 5);
    if (magic === "ustar") {
      const prefix = cstring(tar, pos + 345, 155);
      if (prefix) name = prefix + "/" + name;
    }
    const data_start = pos + 512;
    pos = data_start + Math.ceil(size / 512) * 512;

    if (type === "L") {
      long_name = cstring(tar, data_start, size);
      continue;
    }
    if (type === "x") {
      const pax = parse_pax(tar.subarray(data_start, data_start + size));
      pax_path = pax["path"] ?? null;
      pax_size = pax["size"] !== undefined ? parseInt(pax["size"], 10) : null;
      continue;
    }
    if (type === "g") {
      const pax = parse_pax(tar.subarray(data_start, data_start + size));
      global_pax_path = pax["path"] ?? global_pax_path;
      continue;
    }

    if (long_name !== null) name = long_name;
    else if (pax_path !== null) name = pax_path;
    if (pax_size !== null) {
      size = pax_size;
      pos = data_start + Math.ceil(size / 512) * 512;
    }
    long_name = null;
    pax_path = null;
    pax_size = null;

    if (type === "0" || type === "\0" || type === "7") {
      const clean = name.replace(/^(\.\/)+/, "").replace(/^\/+/, "");
      if (clean) files.set(clean, tar.subarray(data_start, data_start + size));
    }
  }
  void global_pax_path;
  return files;
}

async function read_stream(
  stream: ReadableStream<Uint8Array>,
  on_chunk?: (total_so_far: number) => void,
): Promise<Uint8Array> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    total += value.length;
    on_chunk?.(total);
  }
  return chunks.length === 1 ? chunks[0] : concatBytes(chunks);
}

// ---------------------------------------------------------------- GameDataGetter

/** Extracted archives shared between GameDataGetter instances (key `${cc}/${version}`). */
const loaded_archives = new Map<string, Map<string, Uint8Array>>();

export class GameDataGetter {
  print: boolean;
  lang: string;
  cc: CountryCode;
  real_cc: CountryCode;
  gv: GameVersion;
  version: string | null = null;
  all_versions: Record<string, Record<string, string>> | null = null;
  url: string | null = null;
  filepath: string | null = null;
  metadata: GameDataMetadata | null = null;
  /** `${pack}/${file}` -> bytes. Filled by prepare(). */
  files: Map<string, Uint8Array> = new Map();
  /** Last error message from prepare(), for UI. */
  last_error: string | null = null;
  private prepared = false;
  private preparing: Promise<boolean> | null = null;

  static repo_url(): string {
    return core_data.config.get_game_data_repo();
  }

  constructor(cc: CountryCode, gv: GameVersion, do_print = true) {
    this.print = do_print;
    this.lang = core_data.config.get_str(ConfigKey.LOCALE);
    const lang_cc = cc.get_cc_lang();
    this.real_cc = cc;
    this.gv = gv;
    this.cc = lang_cc.is_lang() ? this.real_cc : lang_cc;
  }

  // ------------------------------------------------------------ preparation

  /** Loads the game data for this cc/version into memory (from IndexedDB, or downloading it). */
  prepare(on_progress?: ProgressCallback): Promise<boolean> {
    if (this.prepared) return Promise.resolve(true);
    if (!this.preparing) {
      this.preparing = this.do_prepare(on_progress).finally(() => {
        this.preparing = null;
      });
    }
    return this.preparing;
  }

  is_prepared(): boolean {
    return this.prepared;
  }

  private async do_prepare(on_progress?: ProgressCallback): Promise<boolean> {
    this.last_error = null;
    try {
      const cached = await GameDataGetter.get_all_downloaded_versions();
      const [found, exact_match] = this.find_gv(this.cc, cached.get(this.cc.get_code()) ?? []);
      this.version = found;

      if (exact_match && found !== null) {
        if (await this.load_from_cache(found, on_progress)) return this.finish(on_progress);
      }

      on_progress?.({ stage: "metadata", message: "Fetching game data metadata" });
      this.metadata = await GameDataGetter.get_metadata();
      if (this.metadata === null) {
        // offline: fall back to whatever matching version we already have
        if (found !== null && (await this.load_from_cache(found, on_progress))) return this.finish(on_progress);
        this.last_error = "failed_to_get_game_versions";
        on_progress?.({ stage: "error", message: this.last_error });
        return false;
      }
      this.all_versions = GameDataGetter.get_versions(this.metadata);
      this.url = typeof this.metadata.base_url === "string" ? this.metadata.base_url : null;
      [this.version, this.filepath] = this.get_version(this.all_versions, this.cc);

      if (this.version === null) {
        if (found !== null && (await this.load_from_cache(found, on_progress))) {
          this.version = found;
          return this.finish(on_progress);
        }
        this.last_error = "failed_to_get_game_versions";
        on_progress?.({ stage: "error", message: this.last_error });
        return false;
      }

      if (await this.load_from_cache(this.version, on_progress)) return this.finish(on_progress);
      if (!(await this.download_version_data(on_progress))) {
        if (found !== null && (await this.load_from_cache(found, on_progress))) {
          this.version = found;
          return this.finish(on_progress);
        }
        return false;
      }
      return this.finish(on_progress);
    } catch (e) {
      this.last_error = e instanceof Error ? e.message : String(e);
      core_data.logger.log_exception(e, "GameDataGetter.prepare");
      on_progress?.({ stage: "error", message: this.last_error });
      return false;
    }
  }

  private finish(on_progress?: ProgressCallback): boolean {
    this.prepared = true;
    on_progress?.({ stage: "done", message: this.version ?? undefined });
    return true;
  }

  private async load_from_cache(version: string, on_progress?: ProgressCallback): Promise<boolean> {
    const key = cache_key(this.cc.get_code(), version);
    const shared = loaded_archives.get(key);
    if (shared) {
      this.files = shared;
      this.version = version;
      return true;
    }
    on_progress?.({ stage: "cache", message: `Loading cached game data ${key}` });
    let record: CacheRecord | undefined;
    try {
      record = await idb_request<CacheRecord | undefined>("readonly", (s) => s.get(key));
    } catch {
      return false;
    }
    if (!record || !(record.data instanceof Uint8Array)) return false;
    on_progress?.({ stage: "extract", message: "Reading archive" });
    this.install_archive(key, record.data);
    this.version = version;
    return true;
  }

  private install_archive(key: string, tar: Uint8Array): void {
    const files = parse_tar(tar);
    loaded_archives.set(key, files);
    this.files = files;
  }

  private async download_version_data(on_progress?: ProgressCallback): Promise<boolean> {
    if (this.url === null || this.filepath === null || this.version === null) return false;
    const url = this.url + this.filepath;
    on_progress?.({ stage: "download", loaded: 0, message: url });
    const resp = await fetchViaProxy(url);
    if (!resp.ok || !resp.body) {
      this.last_error = `no_internet (HTTP ${resp.status})`;
      on_progress?.({ stage: "error", message: this.last_error });
      return false;
    }
    const total = parseInt(resp.headers.get("x-upstream-content-length") ?? "", 10) || undefined;
    const compressed = await read_stream(resp.body, (loaded) =>
      on_progress?.({ stage: "download", loaded, total }),
    );

    on_progress?.({ stage: "decompress", loaded: 0 });
    const { XzReadableStream } = await import("xz-decompress");
    const blob_stream = new Blob([compressed as BlobPart]).stream() as ReadableStream<Uint8Array>;
    const tar = await read_stream(new XzReadableStream(blob_stream), (loaded) =>
      on_progress?.({ stage: "decompress", loaded }),
    );

    on_progress?.({ stage: "extract" });
    const key = cache_key(this.cc.get_code(), this.version);
    this.install_archive(key, tar);

    try {
      const record: CacheRecord = {
        cc: this.cc.get_code(),
        version: this.version,
        saved: Date.now(),
        size: tar.length,
        data: tar,
      };
      await idb_request("readwrite", (s) => s.put(record, key));
    } catch (e) {
      core_data.logger.log_warning(`Could not cache game data in IndexedDB: ${String(e)}`);
    }
    return true;
  }

  // ------------------------------------------------------------ version resolution

  /** Smallest cached version >= gv. Returns [version string, exact match]. */
  find_gv(cc: CountryCode, versions: GameVersion[]): [string | null, boolean] {
    void cc;
    const sorted = [...versions].sort((a, b) => a.game_version - b.game_version);
    for (const version of sorted) {
      if (version.ge(this.gv)) return [version.to_string(), version.eq(this.gv)];
    }
    return [null, false];
  }

  does_save_version_match(save_file: SaveFile): boolean {
    if (this.version === null) return false;
    return save_file.game_version.eq(this.version);
  }

  get_version(
    versions: Record<string, Record<string, string>>,
    cc: CountryCode,
  ): [string | null, string | null] {
    const cc_versions = versions[cc.get_code()];
    if (!cc_versions) return [null, null];
    const keys = Object.keys(cc_versions);
    if (keys.length === 0) return [null, null];
    const gv_string = this.gv.to_string();
    if (!(gv_string in cc_versions)) {
      keys.sort((a, b) => GameVersion.from_string(a).game_version - GameVersion.from_string(b).game_version);
      for (const version of keys) {
        if (GameVersion.from_string(version).game_version >= this.gv.game_version) {
          return [version, cc_versions[version]];
        }
      }
      const last = keys[keys.length - 1];
      return [last, cc_versions[last]];
    }
    return [gv_string, cc_versions[gv_string]];
  }

  static async possible_versions(cc: CountryCode): Promise<string[] | null> {
    const metadata = await GameDataGetter.get_metadata();
    if (metadata === null) return null;
    return Object.keys(GameDataGetter.get_versions(metadata)[cc.get_code()] ?? {});
  }

  /**
   * Fetches the metadata json from the configured repo. If the default repo fails, the alternative
   * (gitlab) repo is tried (the Python version asks the user first).
   */
  static async get_metadata(show_alt = true): Promise<GameDataMetadata | null> {
    const repo = GameDataGetter.repo_url();
    const parse = async (url: string): Promise<GameDataMetadata | null> => {
      try {
        const resp = await fetchViaProxy(url);
        if (!resp.ok) return null;
        const data: unknown = await resp.json();
        if (data && typeof data === "object") return data as GameDataMetadata;
      } catch (e) {
        core_data.logger.log_warning(`Failed to fetch game data metadata from ${url}: ${String(e)}`);
      }
      return null;
    };
    const data = await parse(repo);
    if (data === null && show_alt && repo === core_data.config.get_default(ConfigKey.GAME_DATA_REPO)) {
      return parse(ALT_GAME_DATA_REPO);
    }
    return data;
  }

  static get_versions(metadata: GameDataMetadata): Record<string, Record<string, string>> {
    return metadata.versions ?? {};
  }

  get_packname(packname: string): string {
    if (packname !== "resLocal") return packname;
    if (!this.cc.equals(CountryCodeType.EN)) return packname;
    if (CountryCode.get_langs().includes(this.lang)) return `${packname}_${this.lang}`;
    return packname;
  }

  // ------------------------------------------------------------ file access (synchronous, in-memory)

  private key(pack_name: string, file_name: string): string {
    return `${this.get_packname(pack_name)}/${file_name}`;
  }

  has_downloaded(): boolean {
    return this.prepared;
  }

  is_downloaded(pack_name: string, file_name: string): boolean {
    return this.files.has(this.key(pack_name, file_name));
  }

  /** Stores data in memory (not persisted). */
  save_file_data(pack_name: string, file_name: string, data: Data): Data {
    this.files.set(this.key(pack_name, file_name), data.get_bytes());
    return data;
  }

  /** Returns a fresh Data copy of the file, or null when it is not in the loaded archive. */
  download(pack_name: string, file_name: string, retries = 2, display_text = true): Data | null {
    void retries;
    void display_text;
    const bytes = this.files.get(this.key(pack_name, file_name));
    if (bytes === undefined) return null;
    return new Data(bytes.slice());
  }

  download_from_path(path: string, retries = 2, display_text = true): Data | null {
    const idx = path.indexOf("/");
    const pack_name = path.slice(0, idx);
    const file_name = path.slice(idx + 1);
    return this.download(pack_name, file_name, retries, display_text);
  }

  download_all(
    pack_name: string,
    file_names: string[],
    display_text = true,
  ): ([string, Data] | null)[] {
    return file_names.map((file_name) => {
      const data = this.download(pack_name, file_name, 2, display_text);
      return data === null ? null : ([file_name, data] as [string, Data]);
    });
  }

  /** All file names inside a pack (not in Python; handy for browsing). */
  list_pack(pack_name: string): string[] {
    const prefix = this.get_packname(pack_name) + "/";
    const out: string[] = [];
    for (const k of this.files.keys()) if (k.startsWith(prefix)) out.push(k.slice(prefix.length));
    return out;
  }

  // ------------------------------------------------------------ cache management (IndexedDB)

  static async list_cached_versions(): Promise<CachedVersion[]> {
    try {
      const records = await idb_request<CacheRecord[]>("readonly", (s) => s.getAll());
      return records.map((r) => ({ cc: r.cc, version: r.version, size: r.size, saved: r.saved }));
    } catch {
      return [];
    }
  }

  static async get_downloaded_versions_region(cc: CountryCode): Promise<GameVersion[]> {
    const all = await GameDataGetter.list_cached_versions();
    return all.filter((r) => r.cc === cc.get_code()).map((r) => GameVersion.from_string(r.version));
  }

  /** cc code -> versions */
  static async get_all_downloaded_versions(): Promise<Map<string, GameVersion[]>> {
    const out = new Map<string, GameVersion[]>();
    for (const cc of CountryCode.get_all()) out.set(cc.get_code(), []);
    for (const r of await GameDataGetter.list_cached_versions()) {
      const list = out.get(r.cc) ?? [];
      list.push(GameVersion.from_string(r.version));
      out.set(r.cc, list);
    }
    return out;
  }

  static async delete(cc: CountryCode, gv: GameVersion): Promise<void> {
    const key = cache_key(cc.get_code(), gv.to_string());
    loaded_archives.delete(key);
    try {
      await idb_request("readwrite", (s) => s.delete(key));
    } catch {
      /* ignore */
    }
  }

  static async delete_region(cc: CountryCode): Promise<void> {
    for (const v of await GameDataGetter.get_downloaded_versions_region(cc)) {
      await GameDataGetter.delete(cc, v);
    }
  }

  static async delete_old_versions(to_keep: number): Promise<void> {
    const versions = await GameDataGetter.get_all_downloaded_versions();
    for (const [cc, cc_versions] of versions) {
      cc_versions.sort((a, b) => b.game_version - a.game_version);
      const keep = Math.min(to_keep, cc_versions.length);
      for (const version of cc_versions.slice(keep)) {
        await GameDataGetter.delete(new CountryCode(cc), version);
      }
    }
  }

  static async delete_all(): Promise<void> {
    loaded_archives.clear();
    try {
      await idb_request("readwrite", (s) => s.clear());
    } catch {
      /* ignore */
    }
  }
}
