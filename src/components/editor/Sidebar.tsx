"use client";
import { useMemo, useState } from "react";
import { cn } from "@/components/ui/primitives";
import { FEATURES, searchFeatures } from "@/components/editor/features";
import { CATEGORY_LABELS, CATEGORY_ORDER, type FeatureDef } from "@/features/types";
import { GameDataStatus } from "@/components/editor/PanelHost";

export function Sidebar({ selected, onSelect }: { selected: string | null; onSelect: (key: string | null) => void }) {
  const [query, setQuery] = useState("");
  const results = useMemo(() => (query.trim() ? searchFeatures(query) : null), [query]);

  const item = (f: FeatureDef) => (
    <li key={f.key}>
      <button
        type="button"
        onClick={() => onSelect(f.key)}
        aria-current={selected === f.key ? "page" : undefined}
        title={f.description}
        className={cn(
          "flex min-h-9 w-full items-center rounded-md px-2.5 py-1.5 text-left text-sm focus-visible:outline-2 focus-visible:outline-accent",
          selected === f.key ? "bg-accent/10 font-medium text-accent" : "hover:bg-surface-2",
        )}
      >
        <span className="min-w-0 flex-1 truncate">{f.label}</span>
        {results && <span className="ml-2 flex-none text-xs text-muted">{CATEGORY_LABELS[f.category]}</span>}
      </button>
    </li>
  );

  return (
    <nav aria-label="Features" className="flex h-full min-h-0 flex-col">
      <div className="p-3">
        <label htmlFor="feature-search" className="sr-only">Search features</label>
        <input
          id="feature-search" type="search" value={query} onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && results?.[0]) { onSelect(results[0].key); setQuery(""); }
            if (e.key === "Escape") setQuery("");
          }}
          placeholder="Search features..." autoComplete="off"
          className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm focus-visible:outline-2 focus-visible:outline-accent"
        />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        <ul>
          <li>
            <button type="button" onClick={() => onSelect(null)} aria-current={selected === null ? "page" : undefined}
              className={cn("flex min-h-9 w-full items-center rounded-md px-2.5 py-1.5 text-left text-sm focus-visible:outline-2 focus-visible:outline-accent",
                selected === null ? "bg-accent/10 font-medium text-accent" : "hover:bg-surface-2")}>
              Overview
            </button>
          </li>
        </ul>
        {results ? (
          results.length ? <ul className="mt-2">{results.map(item)}</ul>
            : <p className="px-2.5 py-4 text-sm text-muted">No feature matches &ldquo;{query}&rdquo;.</p>
        ) : (
          CATEGORY_ORDER.map((c) => {
            const items = FEATURES.filter((f) => f.category === c);
            if (!items.length) return null;
            return (
              <div key={c} className="mt-3">
                <h2 className="px-2.5 pb-1 text-xs font-semibold uppercase tracking-wide text-muted">{CATEGORY_LABELS[c]}</h2>
                <ul>{items.map(item)}</ul>
              </div>
            );
          })
        )}
      </div>
      <div className="border-t border-border px-3 py-2 text-xs" aria-live="polite"><GameDataStatus compact /></div>
    </nav>
  );
}
