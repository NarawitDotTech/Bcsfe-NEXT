import { ALL_FEATURES } from "@/features/registry";
import type { FeatureDef } from "@/features/types";

/** ALL_FEATURES without duplicate keys (first registration wins). */
export const FEATURES: FeatureDef[] = (() => {
  const seen = new Set<string>();
  return ALL_FEATURES.filter((f) => (seen.has(f.key) ? false : (seen.add(f.key), true)));
})();

export function getFeature(key: string | null): FeatureDef | undefined {
  return key ? FEATURES.find((f) => f.key === key) : undefined;
}

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function isSubsequence(q: string, t: string): boolean {
  let i = 0;
  for (const ch of t) if (ch === q[i] && ++i === q.length) return true;
  return q.length === 0;
}

/** Score a single token against a text (0 = no match). */
function tokenScore(token: string, text: string): number {
  if (text === token) return 100;
  if (text.startsWith(token)) return 85;
  const words = text.split(" ");
  if (words.some((w) => w.startsWith(token))) return 75;
  if (text.includes(token)) return 60;
  if (token.length >= 3 && isSubsequence(token, text.replace(/ /g, ""))) return 30;
  return 0;
}

/** Fuzzy match over label + aliases (+ key). Returns matching features, best first. */
export function searchFeatures(query: string, features: FeatureDef[] = FEATURES): FeatureDef[] {
  const tokens = norm(query).split(" ").filter(Boolean);
  if (tokens.length === 0) return features;
  const scored: { f: FeatureDef; score: number; i: number }[] = [];
  features.forEach((f, i) => {
    const label = norm(f.label);
    const others = [...(f.aliases ?? []), f.key.replace(/_/g, " ")].map(norm);
    let total = 0;
    for (const t of tokens) {
      let best = tokenScore(t, label);
      for (const o of others) best = Math.max(best, tokenScore(t, o) - 5);
      if (best <= 0) { total = 0; break; }
      total += best;
    }
    if (total > 0) scored.push({ f, score: total / tokens.length, i });
  });
  return scored.sort((a, b) => b.score - a.score || a.i - b.i).map((s) => s.f);
}
