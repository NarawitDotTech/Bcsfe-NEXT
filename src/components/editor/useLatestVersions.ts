"use client";
import { useEffect, useState } from "react";
import { fetch_latest_versions, get_cached_latest_versions, type LatestVersions } from "@/lib/bcsfe/core/latest_version";

/** Latest Battle Cats version per country code; always checked on mount. */
export function useLatestVersions(): { versions: LatestVersions | null; loading: boolean } {
  const [versions, setVersions] = useState<LatestVersions | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    const cached = get_cached_latest_versions();
    if (cached) setVersions(cached);
    fetch_latest_versions(true).then((v) => { if (alive) { if (v) setVersions(v); setLoading(false); } });
    return () => { alive = false; };
  }, []);
  return { versions, loading };
}
