"use client";
/**
 * Reusable chapter editor (web version of cli/edits/map.py edit_chapters):
 *  - Clear progress / Unclear progress: pick maps by name, then clear N crowns for all maps at once
 *    or per map (whole chapter or up to a specific stage).
 *  - Clear counts: pick (map, crown) pairs, then set the clear count for all stages, per crown, or per stage.
 */
import { useMemo, useState } from "react";
import { useSave } from "@/components/editor/SaveContext";
import {
  Button, Notice, NumberField, Panel, Segmented, Select, MultiSelect, type SelectItem,
} from "@/components/ui/primitives";
import { strip_color_tags } from "@/lib/bcsfe/core/locale_handler";
import en from "@/lib/bcsfe/files/locales/en.json";
import {
  get_map_target, get_max_max_stars, get_progress_stage_names, get_stage_names, list_map_stars, list_maps,
  load_map_option, max_clear_count, set_clear_counts, set_progress_all, set_progress_to_stage,
  set_progress_whole, type ClearCountItem, type MapTarget, type MapTargetKey,
} from "@/lib/bcsfe/edits/map";
import type { MapNames } from "@/lib/bcsfe/core/game/map/map_names";
import type { MapOption } from "@/lib/bcsfe/core/game/map/map_option";

type Mode = "clear" | "unclear" | "counts";

const mapLabel = (name: string | null) => name ?? "Unknown map";

export function ChapterEditor({ target: key, hideModes, initialMode = "clear", title, warning }: {
  target: MapTargetKey;
  hideModes?: Mode[];
  initialMode?: Mode;
  title?: string;
  warning?: boolean;
}) {
  const { save } = useSave();
  const [mode, setMode] = useState<Mode>(initialMode);
  const target = useMemo(() => get_map_target(save, key), [save, key]);
  const names = useMemo(() => target.map_names(), [target]);
  const mapOption = useMemo(() => load_map_option(save), [save]);
  const maps = useMemo(() => list_maps(target), [target]);

  const modes = ([
    { value: "clear", label: "Clear" },
    { value: "unclear", label: "Unclear" },
    { value: "counts", label: "Clear counts" },
  ] as { value: Mode; label: string }[]).filter((m) => !hideModes?.includes(m.value));

  return (
    <Panel
      title={title ?? "Chapters"}
      description="Pick maps by name, then choose how far to clear them or how many times each stage has been cleared."
    >
      {warning && <Notice tone="warning">{strip_color_tags((en as Record<string, string>).zero_legends_warning)}</Notice>}
      {maps.length === 0 ? (
        <Notice tone="warning">
          This save has no map data of this type (or the game data has no names for it), so there is nothing to edit.
        </Notice>
      ) : (
        <>
          {modes.length > 1 && <Segmented value={mode} onChange={setMode} options={modes} />}
          {mode === "counts" ? (
            <CountsEditor key={key} target={target} names={names} mapOption={mapOption} />
          ) : (
            <ProgressEditor key={key + mode} target={target} names={names} mapOption={mapOption} unclear={mode === "unclear"} />
          )}
        </>
      )}
    </Panel>
  );
}

/* ------------------------------------------------------------------ */

type PerMap = { kind: "whole" | "stage"; stars: number | null; stage: number };

function ProgressEditor({ target, names, mapOption, unclear }: {
  target: MapTarget; names: MapNames; mapOption: MapOption | null; unclear: boolean;
}) {
  const { commit, notify } = useSave();
  const maps = useMemo(() => list_maps(target), [target]);
  const items: SelectItem<number>[] = useMemo(
    () => maps.map((m) => ({ id: m.id, label: mapLabel(m.name) })), [maps]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [handling, setHandling] = useState<"all" | "each">("all");
  const [allStars, setAllStars] = useState<number | null>(null);
  const [per, setPer] = useState<Record<number, PerMap>>({});

  const ids = useMemo(() => [...selected].sort((a, b) => a - b), [selected]);
  const minStars = unclear ? 0 : 1;
  const maxAll = get_max_max_stars(target, mapOption, ids);
  const starsAll = Math.min(allStars ?? maxAll, maxAll);
  const all = handling === "all" && ids.length > 1;

  const getPer = (id: number): PerMap => per[id] ?? { kind: "whole", stars: null, stage: 0 };
  const patch = (id: number, p: Partial<PerMap>) => setPer((cur) => ({ ...cur, [id]: { ...getPer(id), ...p } }));
  const starsOf = (id: number) => Math.min(getPer(id).stars ?? target.total_stars(mapOption, id), target.total_stars(mapOption, id));

  const apply = () => {
    if (ids.length === 0) return notify("Select at least one map.", "warning");
    try {
      commit((s) => {
        const t = get_map_target(s, target.key);
        if (all) {
          set_progress_all(t, ids, starsAll);
        } else {
          for (const id of ids) {
            const p = getPer(id);
            if (p.kind === "whole") set_progress_whole(t, id, starsOf(id));
            else set_progress_to_stage(t, id, p.stage, starsOf(id));
          }
        }
      }, `${unclear ? "Uncleared" : "Cleared"} ${ids.length} map${ids.length === 1 ? "" : "s"}`);
    } catch (e) {
      notify(`Could not edit these maps: ${(e as Error).message}`, "danger");
    }
  };

  return (
    <div className="space-y-4">
      <MultiSelect items={items} selected={selected} onChange={setSelected} />
      {ids.length > 1 && (
        <Segmented value={handling} onChange={setHandling} options={[
          { value: "all", label: unclear ? "Unclear all at once" : "Clear all at once" },
          { value: "each", label: "Handle each individually" },
        ]} />
      )}
      {ids.length > 0 && all && (
        <StarsInput label={`Crowns to ${unclear ? "keep" : "clear"} (max ${maxAll})`}
          value={starsAll} min={Math.min(minStars, maxAll)} max={maxAll} onChange={setAllStars} unclear={unclear} />
      )}
      {ids.length > 0 && !all && (
        <ul className="space-y-3">
          {ids.map((id) => {
            const p = getPer(id);
            const max = target.total_stars(mapOption, id);
            const stageNames = get_progress_stage_names(names, id);
            return (
              <li key={id} className="space-y-3 rounded-lg border border-border p-3">
                <div className="text-sm font-medium">
                  {mapLabel(maps.find((m) => m.id === id)?.name ?? null)} <span className="text-muted">(id {id})</span>
                </div>
                <Segmented value={p.kind} onChange={(kind) => patch(id, { kind })} options={[
                  { value: "whole", label: "Whole chapter" },
                  { value: "stage", label: "Up to a stage" },
                ]} />
                {p.kind === "stage" && (
                  <label className="block space-y-1 text-sm">
                    <span className="font-medium">Clear up to and including</span>
                    <Select value={p.stage} onChange={(e) => patch(id, { stage: Number(e.target.value) })}>
                      {stageNames.length === 0 && <option value={0}>Stage 1</option>}
                      {stageNames.map((n, i) => <option key={i} value={i}>{i + 1}. {n}</option>)}
                    </Select>
                  </label>
                )}
                <StarsInput label={`Crowns (max ${max})`} value={starsOf(id)} min={Math.min(minStars, max)} max={max}
                  onChange={(v) => patch(id, { stars: v })} unclear={unclear} />
              </li>
            );
          })}
        </ul>
      )}
      <Button variant="primary" onClick={apply} disabled={ids.length === 0}>
        {unclear ? "Unclear selected maps" : "Clear selected maps"}
      </Button>
    </div>
  );
}

function StarsInput({ label, value, min, max, onChange, unclear }: {
  label: string; value: number; min: number; max: number; onChange: (v: number) => void; unclear: boolean;
}) {
  if (max <= 1 && !unclear) {
    return <p className="text-sm text-muted">This map has a single crown level; it will be {max === 0 ? "left alone" : "fully cleared"}.</p>;
  }
  return (
    <NumberField label={label} value={value} min={min} max={max} onChange={onChange}
      hint={unclear ? "0 unclears the whole map; N keeps crowns 1..N cleared and unclears the rest." : "Crowns 1..N are cleared; higher crowns are unset."} />
  );
}

/* ------------------------------------------------------------------ */

type PerStar = {
  scope: "whole" | "stages";
  amount: number;
  stages: Set<number>;
  stageMode: "same" | "each";
  amounts: Record<number, number>;
};

function CountsEditor({ target, names, mapOption }: { target: MapTarget; names: MapNames; mapOption: MapOption | null }) {
  const { commit, notify } = useSave();
  const entries = useMemo(() => list_map_stars(target, mapOption), [target, mapOption]);
  const items: SelectItem<number>[] = useMemo(
    () => entries.map((e) => ({ id: e.map * 10 + e.star, label: `${mapLabel(e.name)} ${e.star + 1} Crown`, detail: `map ${e.map}` })),
    [entries]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [handling, setHandling] = useState<"all" | "each">("all");
  const [allAmount, setAllAmount] = useState(1);
  const [per, setPer] = useState<Record<number, PerStar>>({});
  const max = max_clear_count();

  const keys = useMemo(() => [...selected].sort((a, b) => a - b), [selected]);
  const all = handling === "all" && keys.length > 1;
  const fresh = (): PerStar => ({ scope: "whole", amount: 1, stages: new Set(), stageMode: "same", amounts: {} });
  const getPer = (k: number): PerStar => per[k] ?? fresh();
  const patch = (k: number, p: Partial<PerStar>) => setPer((cur) => ({ ...cur, [k]: { ...getPer(k), ...p } }));

  const apply = () => {
    if (keys.length === 0) return notify("Select at least one map.", "warning");
    const list: ClearCountItem[] = [];
    for (const k of keys) {
      const map = Math.floor(k / 10), star = k % 10;
      if (all) { list.push({ map, star, amount: allAmount }); continue; }
      const p = getPer(k);
      if (p.scope === "whole") list.push({ map, star, amount: p.amount });
      else if (p.stageMode === "same") list.push({ map, star, amount: p.amount, stages: [...p.stages].sort((a, b) => a - b) });
      else for (const st of [...p.stages].sort((a, b) => a - b)) list.push({ map, star, amount: p.amounts[st] ?? 1, stages: [st] });
    }
    try {
      commit((s) => set_clear_counts(get_map_target(s, target.key), list), `Updated clear counts for ${keys.length} map crown${keys.length === 1 ? "" : "s"}`);
    } catch (e) {
      notify(`Could not edit clear counts: ${(e as Error).message}`, "danger");
    }
  };

  return (
    <div className="space-y-4">
      <MultiSelect items={items} selected={selected} onChange={setSelected} showIds={false} />
      {keys.length > 1 && (
        <Segmented value={handling} onChange={setHandling} options={[
          { value: "all", label: "Same count for every stage" },
          { value: "each", label: "Handle each individually" },
        ]} />
      )}
      {keys.length > 0 && all && <NumberField label="Clear count" value={allAmount} max={max} onChange={setAllAmount} />}
      {keys.length > 0 && !all && (
        <ul className="space-y-3">
          {keys.map((k) => {
            const p = getPer(k);
            const map = Math.floor(k / 10), star = k % 10;
            const stageItems: SelectItem<number>[] = get_stage_names(names, map).map((n, i) => ({ id: i, label: n }));
            return (
              <li key={k} className="space-y-3 rounded-lg border border-border p-3">
                <div className="text-sm font-medium">{items.find((i) => i.id === k)?.label ?? `Map ${map} / crown ${star + 1}`}</div>
                <Segmented value={p.scope} onChange={(scope) => patch(k, { scope })} options={[
                  { value: "whole", label: "Whole chapter" },
                  { value: "stages", label: "Specific stages" },
                ]} />
                {p.scope === "stages" && (
                  <>
                    <MultiSelect items={stageItems} selected={p.stages} onChange={(stages) => patch(k, { stages })} height={200} />
                    <Segmented value={p.stageMode} onChange={(stageMode) => patch(k, { stageMode })} options={[
                      { value: "same", label: "Same count for selected" },
                      { value: "each", label: "Count per stage" },
                    ]} />
                  </>
                )}
                {p.scope === "stages" && p.stageMode === "each" ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {[...p.stages].sort((a, b) => a - b).map((st) => (
                      <NumberField key={st} label={stageItems[st]?.label ?? `Stage ${st + 1}`} value={p.amounts[st] ?? 1} max={max}
                        onChange={(v) => patch(k, { amounts: { ...p.amounts, [st]: v } })} />
                    ))}
                  </div>
                ) : (
                  <NumberField label="Clear count" value={p.amount} max={max} onChange={(amount) => patch(k, { amount })} />
                )}
              </li>
            );
          })}
        </ul>
      )}
      <p className="text-xs text-muted">
        Each touched stage is set to the count and the chapter is marked as reached, exactly like the original editor.
      </p>
      <Button variant="primary" onClick={apply} disabled={keys.length === 0}>Set clear counts</Button>
    </div>
  );
}
