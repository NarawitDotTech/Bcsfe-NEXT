/**
 * Latest released Battle Cats version per country code, taken from the game data
 * repository metadata (it gets an entry for every game release). Cached in memory and
 * in localStorage for a few hours; always re-checked in the background.
 */
import { GameDataGetter } from "@/lib/bcsfe/core/server/game_data_getter";
import { GameVersion } from "@/lib/bcsfe/core/game_version";
import type { CountryCode } from "@/lib/bcsfe/core/country_code";

export type LatestVersions = Record<string, string>;

const STORAGE_KEY = "bcsfe:latest_versions";
const MAX_AGE_MS = 6 * 60 * 60 * 1000;
let memory: { at: number; versions: LatestVersions } | null = null;
let inflight: Promise<LatestVersions | null> | null = null;

function cmp(a: string, b: string): number {
  return GameVersion.from_string(a).game_version - GameVersion.from_string(b).game_version;
}

function readCache(): { at: number; versions: LatestVersions } | null {
  if (memory) return memory;
  try {
    const raw = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
    if (raw) memory = JSON.parse(raw);
  } catch { /* ignore */ }
  return memory;
}

/** Cached value (possibly stale) without network. */
export function get_cached_latest_versions(): LatestVersions | null {
  return readCache()?.versions ?? null;
}

/** Fetches the latest versions (uses a fresh cache unless `force`). */
export async function fetch_latest_versions(force = false): Promise<LatestVersions | null> {
  const cached = readCache();
  if (!force && cached && Date.now() - cached.at < MAX_AGE_MS) return cached.versions;
  if (!inflight) {
    inflight = (async () => {
      const metadata = await GameDataGetter.get_metadata();
      if (!metadata) return cached?.versions ?? null;
      const versions: LatestVersions = {};
      for (const [cc, list] of Object.entries(GameDataGetter.get_versions(metadata))) {
        const keys = Object.keys(list).filter((v) => /^\d+\.\d+\.\d+$/.test(v)).sort(cmp);
        if (keys.length) versions[cc] = keys[keys.length - 1];
      }
      memory = { at: Date.now(), versions };
      try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(memory)); } catch { /* ignore */ }
      return versions;
    })().finally(() => { inflight = null; });
  }
  return inflight;
}

export async function get_latest_version(cc: CountryCode): Promise<GameVersion | null> {
  const v = (await fetch_latest_versions())?.[cc.get_code()];
  return v ? GameVersion.from_string(v) : null;
}
