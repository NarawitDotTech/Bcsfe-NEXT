"use client";
import { useMemo, useState } from "react";
import { useSave } from "@/components/editor/SaveContext";
import { Button, Checkbox, Panel, Segmented, TextInput } from "@/components/ui/primitives";
import { core_data } from "@/lib/bcsfe/core/core_data";
import { ConfigKey } from "@/lib/bcsfe/core/io/config";
import type { Cat } from "@/lib/bcsfe/core/game/catbase/cat";
import * as ce from "@/lib/bcsfe/edits/cat_editor";
import { CatBadges } from "./CatSelector";

const PAGE = 50;
type Filter = "all" | "unlocked" | "locked";

export default function CatOverview() {
  const { save, version, commit, notify } = useSave();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [page, setPage] = useState(0);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return save.cats.cats.filter((c) => {
      if (filter === "unlocked" && !c.unlocked) return false;
      if (filter === "locked" && c.unlocked) return false;
      if (!q) return true;
      return String(c.id) === q || ce.cat_names(save, c).some((n) => n.toLowerCase().includes(q));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [save, version, query, filter]);
  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  const cur = Math.min(page, pages - 1);
  const shown = rows.slice(cur * PAGE, cur * PAGE + PAGE);

  const toggle = (cat: Cat, on: boolean) => {
    if (on) cat.unlock(save);
    else cat.remove(core_data.config.get_bool(ConfigKey.RESET_CAT_DATA), save);
    ce.set_rank_up_sale(save);
    commit();
  };
  const setLevel = (cat: Cat, text: string) => {
    const n = ce.upgrade_cats_individual(save, [{ cat_id: cat.id, input: text }]);
    if (n === 0) notify(`Invalid level “${text}” (use base+plus, e.g. 30+10 or max+max)`, "warning");
    else commit();
  };

  return (
    <Panel title="Cat list" description="Browse every cat and edit it inline: unlock, or set level as base+plus.">
      <div className="flex flex-wrap items-center gap-2">
        <TextInput aria-label="Search cats" placeholder="Search by name or id…" value={query}
          onChange={(e) => { setQuery(e.target.value); setPage(0); }} className="min-w-0 flex-1 basis-48" />
        <Segmented<Filter> value={filter} onChange={(f) => { setFilter(f); setPage(0); }}
          options={[{ value: "all", label: "All" }, { value: "unlocked", label: "Unlocked" }, { value: "locked", label: "Locked" }]} />
      </div>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[34rem] text-sm">
          <thead className="bg-surface-2 text-left text-xs text-muted">
            <tr><th className="px-3 py-2">ID</th><th className="px-3 py-2">Name</th><th className="px-3 py-2">Unlocked</th><th className="px-3 py-2">Level (base+plus)</th><th className="px-3 py-2">State</th></tr>
          </thead>
          <tbody>
            {shown.map((cat) => {
              const lim = ce.get_cat_upgrade_limits(save, cat);
              return (
                <tr key={cat.id} className="border-t border-border">
                  <td className="px-3 py-1.5 font-mono text-xs text-muted">{cat.id}</td>
                  <td className="px-3 py-1.5">{ce.cat_name(save, cat)}</td>
                  <td className="px-3 py-1.5"><Checkbox label={<span className="sr-only">Unlocked</span>} checked={!!cat.unlocked} onChange={(v) => toggle(cat, v)} /></td>
                  <td className="px-3 py-1.5">
                    <TextInput key={`${cat.id}-${version}`} aria-label={`Level of ${ce.cat_name(save, cat)}`} className="h-8 w-28"
                      defaultValue={`${cat.upgrade.base + 1}+${cat.upgrade.plus}`} title={`Max ${lim.max_base}+${lim.max_plus}`}
                      onBlur={(e) => { if (e.target.value !== `${cat.upgrade.base + 1}+${cat.upgrade.plus}`) setLevel(cat, e.target.value); }}
                      onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()} />
                  </td>
                  <td className="px-3 py-1.5"><CatBadges cat={cat} /></td>
                </tr>
              );
            })}
            {shown.length === 0 && <tr><td colSpan={5} className="px-3 py-6 text-center text-muted">No cats match.</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted">
        <span>{rows.length} cats · page {cur + 1} of {pages}</span>
        <span className="flex gap-2">
          <Button disabled={cur === 0} onClick={() => setPage(cur - 1)}>Previous</Button>
          <Button disabled={cur >= pages - 1} onClick={() => setPage(cur + 1)}>Next</Button>
        </span>
      </div>
    </Panel>
  );
}
