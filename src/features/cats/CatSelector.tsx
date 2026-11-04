"use client";
/**
 * Shared cat selector: web port of CatEditor.select (all / current / obtainable / by id / by name /
 * by rarity / by gacha banner / not unlocked / not obtainable / non-gacha / by game version) with
 * AND / OR / REPLACE combination.
 */
import { useMemo, useState } from "react";
import { useSave } from "@/components/editor/SaveContext";
import { Button, Checkbox, Field, MultiSelect, Notice, Segmented, TextInput, cn } from "@/components/ui/primitives";
import type { Cat } from "@/lib/bcsfe/core/game/catbase/cat";
import { GameVersion } from "@/lib/bcsfe/core/game_version";
import * as ce from "@/lib/bcsfe/edits/cat_editor";

export type CatSelection = {
  ids: Set<number>;
  setIds: (ids: Set<number>) => void;
  /** Live Cat objects of the selection (sorted by id). */
  cats: Cat[];
};

/** State holder for a cat selection; call once per panel. */
export function useCatSelection(): CatSelection {
  const { save, version } = useSave();
  const [ids, setIds] = useState<Set<number>>(() => new Set());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const cats = useMemo(() => save.cats.cats.filter((c) => ids.has(c.id)), [save, version, ids]);
  return { ids, setIds, cats };
}

export function Badge({ children, tone = "muted" }: { children: React.ReactNode; tone?: "muted" | "success" | "accent" | "warning" }) {
  return (
    <span className={cn(
      "inline-flex items-center rounded-md px-1.5 py-0.5 text-xs leading-none",
      tone === "muted" && "bg-surface-2 text-muted",
      tone === "success" && "bg-success/15 text-success",
      tone === "accent" && "bg-accent/15 text-accent",
      tone === "warning" && "bg-warning/15 text-warning",
    )}>{children}</span>
  );
}

/** State badges of a cat: unlocked, level, form, guide. */
export function CatBadges({ cat }: { cat: Cat }) {
  return (
    <span className="flex flex-wrap items-center gap-1">
      {cat.unlocked ? <Badge tone="success">Unlocked</Badge> : <Badge>Locked</Badge>}
      {cat.unlocked ? <Badge>Lv {cat.upgrade.base + 1}{cat.upgrade.plus > 0 ? `+${cat.upgrade.plus}` : ""}</Badge> : null}
      {cat.fourth_form === 2 ? <Badge tone="accent">4th form</Badge> : cat.unlocked_forms >= 3 ? <Badge tone="accent">True form</Badge> : null}
      {cat.catguide_collected ? <Badge>Guide</Badge> : null}
    </span>
  );
}

type Tab = "quick" | "id" | "name" | "rarity" | "banner" | "version";
const MODE_LABELS: { value: ce.SelectMode; label: string }[] = [
  { value: "or", label: "Add (OR)" },
  { value: "and", label: "Keep only (AND)" },
  { value: "replace", label: "Replace" },
];

export function CatSelector({ selection, maxRows = 100 }: { selection: CatSelection; maxRows?: number }) {
  const { save, version, notify } = useSave();
  const { ids, setIds, cats } = selection;
  const [mode, setMode] = useState<ce.SelectMode>("or");
  const [tab, setTab] = useState<Tab>("quick");

  const total = save.cats.cats.length;

  const apply = (found: Cat[] | null, what: string) => {
    if (found === null) {
      notify(`Cannot select ${what}: game data is unavailable.`, "warning");
      return;
    }
    const next = ce.combine_selection(cats, found, mode);
    setIds(new Set(next.map((c) => c.id)));
    notify(`${what}: ${found.length} cat${found.length === 1 ? "" : "s"} matched, ${next.length} selected`, "info");
  };

  const remove = (id: number) => {
    const n = new Set(ids);
    n.delete(id);
    setIds(n);
  };

  return (
    <div className="space-y-3 rounded-lg border border-border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Select cats <span className="font-normal text-muted">({ids.size} of {total} selected)</span></h3>
        <Button variant="ghost" onClick={() => setIds(new Set())} disabled={ids.size === 0}>Clear selection</Button>
      </div>

      <div className="space-y-1">
        <span className="text-xs text-muted">When a selection already exists, new matches are combined with it as:</span>
        <div><Segmented value={mode} onChange={setMode} options={MODE_LABELS} /></div>
      </div>

      <Segmented<Tab> value={tab} onChange={setTab} options={[
        { value: "quick", label: "Quick" }, { value: "id", label: "By ID" }, { value: "name", label: "By name" },
        { value: "rarity", label: "By rarity" }, { value: "banner", label: "By banner" }, { value: "version", label: "By version" },
      ]} />

      {tab === "quick" && (
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => apply(ce.select_all(save), "All cats")}>All</Button>
          <Button onClick={() => apply(ce.select_current(save), "Unlocked cats")}>Unlocked</Button>
          <Button onClick={() => apply(ce.select_not_unlocked(save), "Not unlocked cats")}>Not unlocked</Button>
          <Button onClick={() => apply(ce.select_obtainable(save), "Obtainable cats")}>Obtainable</Button>
          <Button onClick={() => apply(ce.select_not_obtainable(save), "Not obtainable cats")}>Not obtainable</Button>
          <Button onClick={() => apply(ce.select_non_gacha(save), "Non-gacha cats")}>Non-gacha</Button>
        </div>
      )}
      {tab === "id" && <ByIdTab total={total} onApply={(found, what) => apply(found, what)} />}
      {tab === "name" && <ByNameTab version={version} onApply={apply} />}
      {tab === "rarity" && <ByRarityTab version={version} onApply={apply} />}
      {tab === "banner" && <ByBannerTab onApply={apply} />}
      {tab === "version" && <ByVersionTab version={version} onApply={apply} />}

      {cats.length > 0 && (
        <div>
          <ul className="max-h-72 overflow-y-auto rounded-lg border border-border">
            {cats.slice(0, maxRows).map((cat) => (
              <li key={cat.id} className="flex items-center gap-2 border-b border-border px-3 py-1.5 text-sm last:border-0">
                <span className="w-12 flex-none font-mono text-xs text-muted">{cat.id}</span>
                <span className="min-w-0 flex-1 truncate">{ce.cat_name(save, cat)}</span>
                <span className="hidden flex-none sm:block"><CatBadges cat={cat} /></span>
                <button type="button" aria-label={`Remove ${ce.cat_name(save, cat)} from selection`}
                  className="flex-none rounded px-1.5 text-muted hover:bg-surface-2 hover:text-foreground"
                  onClick={() => remove(cat.id)}>×</button>
              </li>
            ))}
          </ul>
          {cats.length > maxRows && <p className="mt-1 text-xs text-muted">Showing the first {maxRows} of {cats.length} selected cats.</p>}
        </div>
      )}
    </div>
  );
}

type ApplyFn = (found: Cat[] | null, what: string) => void;

function ByIdTab({ total, onApply }: { total: number; onApply: ApplyFn }) {
  const { save } = useSave();
  const [text, setText] = useState("");
  const ids = useMemo(() => ce.parse_id_ranges(text, total - 1), [text, total]);
  return (
    <Field label="Cat IDs" hint={`Ranges and single ids, 0 to ${total - 1}. Example: 0-50 72 100-110. "all" selects everything.`}>
      {(id) => (
        <div className="flex gap-2">
          <TextInput id={id} value={text} onChange={(e) => setText(e.target.value)} placeholder="0-50 72"
            onKeyDown={(e) => e.key === "Enter" && ids.length && onApply(ce.select_ids(save, ids), "IDs")} />
          <Button variant="primary" disabled={ids.length === 0} onClick={() => onApply(ce.select_ids(save, ids), "IDs")}>Select {ids.length || ""}</Button>
        </div>
      )}
    </Field>
  );
}

function ByNameTab({ onApply, version }: { onApply: ApplyFn; version: number }) {
  const { save } = useSave();
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<Set<number>>(() => new Set());
  const matches = useMemo(
    () => (query.trim() ? ce.select_name(save, query.trim()) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [save, query, version],
  );
  const items = useMemo(() => matches.map((c) => {
    const names = ce.cat_names(save, c);
    const q = query.trim().toLowerCase();
    return { id: c.id, label: names.find((n) => n.toLowerCase().includes(q)) ?? names[0] };
  }), [matches, query, save]);
  return (
    <div className="space-y-2">
      <Field label="Name contains" hint="Matches any form name (case-insensitive).">
        {(id) => <TextInput id={id} value={query} onChange={(e) => { setQuery(e.target.value); setPicked(new Set()); }} placeholder="e.g. Cat" />}
      </Field>
      {query.trim() && matches.length === 0 && <Notice>No cats found matching “{query}”.</Notice>}
      {matches.length > 0 && <MultiSelect items={items} selected={picked} onChange={setPicked} height={220} />}
      <div className="flex flex-wrap gap-2">
        <Button variant="primary" disabled={picked.size === 0} onClick={() => onApply(ce.select_ids(save, [...picked]), "Name")}>Select {picked.size} chosen</Button>
        <Button disabled={matches.length === 0} onClick={() => onApply(matches, "Name")}>Select all {matches.length} matches</Button>
      </div>
    </div>
  );
}

function ByRarityTab({ onApply, version }: { onApply: ApplyFn; version: number }) {
  const { save } = useSave();
  const [picked, setPicked] = useState<Set<number>>(() => new Set());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const rows = useMemo(() => ce.get_rarity_names(save).map((name, i) => ({ i, name, count: ce.select_rarity(save, [i]).length })), [save, version]);
  return (
    <div className="space-y-2">
      <div className="grid gap-2 sm:grid-cols-2">
        {rows.map((r) => (
          <Checkbox key={r.i} label={`${r.name} (${r.count})`} checked={picked.has(r.i)} onChange={(v) => {
            const n = new Set(picked);
            if (v) n.add(r.i); else n.delete(r.i);
            setPicked(n);
          }} />
        ))}
      </div>
      <Button variant="primary" disabled={picked.size === 0} onClick={() => onApply(ce.select_rarity(save, [...picked]), "Rarity")}>Select rarities</Button>
    </div>
  );
}

function ByBannerTab({ onApply }: { onApply: ApplyFn }) {
  const { save } = useSave();
  const count = ce.get_gatya_banner_count(save);
  const [text, setText] = useState("");
  const bannerIds = useMemo(() => (count ? ce.parse_id_ranges(text, count - 1) : []), [text, count]);
  const catCount = useMemo(() => {
    const s = new Set<number>();
    for (const b of bannerIds) for (const id of ce.get_gatya_banner_cat_ids(save, b)) s.add(id);
    return s.size;
  }, [bannerIds, save]);
  if (count === null) return <Notice tone="warning">Gacha banner data (GatyaDataSetR1) is not available.</Notice>;
  return (
    <Field label="Banner IDs" hint={`Ids 0 to ${count - 1} from GatyaDataSetR1. ${bannerIds.length} banner(s) → ${catCount} cat(s). Banner names need an online lookup and are not shown.`}>
      {(id) => (
        <div className="flex gap-2">
          <TextInput id={id} value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. 0-10 250" />
          <Button variant="primary" disabled={bannerIds.length === 0} onClick={() => onApply(ce.select_gatya_banners(save, bannerIds), "Banner")}>Select</Button>
        </div>
      )}
    </Field>
  );
}

function ByVersionTab({ onApply, version }: { onApply: ApplyFn; version: number }) {
  const { save } = useSave();
  const [picked, setPicked] = useState<Set<number>>(() => new Set());
  const [text, setText] = useState("");
  const rows = useMemo(() => {
    const ub = save.cats.read_unitbuy(save);
    const counts = new Map<number, number>();
    for (const c of ub.unit_buy ?? []) counts.set(c.game_version, (counts.get(c.game_version) ?? 0) + 1);
    return ce.get_unit_game_versions(save).map((v) => ({
      id: v, label: new GameVersion(v).format(), detail: `${counts.get(v) ?? 0} cats`,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [save, version]);
  const fromText = useMemo(() => new Set(ce.parse_version_spec(text)), [text]);
  const valid = new Set(rows.map((r) => r.id));
  const textValid = [...fromText].filter((v) => valid.has(v));
  const all = new Set([...picked, ...textValid]);
  return (
    <div className="space-y-2">
      <Field label="Version ranges" hint="Space separated, ranges allowed. Example: 12.2.0-12.3.0 13.0.0">
        {(id) => <TextInput id={id} value={text} onChange={(e) => setText(e.target.value)} placeholder="12.2.0-12.3.0" />}
      </Field>
      {rows.length === 0 ? <Notice tone="warning">No version information in unitbuy.csv.</Notice> : (
        <MultiSelect items={rows} selected={picked} onChange={setPicked} height={220} showIds={false} />
      )}
      <Button variant="primary" disabled={all.size === 0} onClick={() => onApply(ce.select_game_versions(save, [...all]), "Game version")}>
        Select {all.size} version{all.size === 1 ? "" : "s"}
      </Button>
    </div>
  );
}
