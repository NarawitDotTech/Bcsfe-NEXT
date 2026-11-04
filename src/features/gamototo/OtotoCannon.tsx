"use client";
import { useMemo, useState } from "react";
import { useSave } from "@/components/editor/SaveContext";
import { Button, Notice, NumberField, Panel, Segmented, Select, Field } from "@/components/ui/primitives";
import {
  DEVELOPMENT_STAGES, cannon_part_max_all, cannon_rows, set_cannon_development, set_cannon_levels,
} from "@/lib/bcsfe/edits/gamototo";

const STAGE_LABEL = ["None", "Foundation", "Style", "Effect"];

export default function OtotoCannon() {
  const { save, version, commit } = useSave();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const rows = useMemo(() => cannon_rows(save), [save, version]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const partMax = useMemo(() => cannon_part_max_all(save), [save, version]);
  const [sel, setSel] = useState<Set<number>>(new Set());
  const [kind, setKind] = useState<"level" | "development">("level");
  const [scope, setScope] = useState<"individual" | "all">("individual");
  const [allLevels, setAllLevels] = useState<number[]>([1, 0, 0]);
  const [allDev, setAllDev] = useState(3);
  const [devs, setDevs] = useState<Record<number, number>>({});
  const [lvls, setLvls] = useState<Record<number, number[]>>({});
  if (rows === null || partMax === null) return <Notice tone="warning">Cannon data is unavailable (game data missing).</Notice>;

  const chosen = rows.filter((r) => sel.has(r.id));
  const multi = chosen.length > 1;
  const allAtOnce = multi && scope === "all";
  const toggle = (id: number) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const levelsOf = (id: number, base: number[]) => lvls[id] ?? base;

  const apply = () => {
    const ids = chosen.map((c) => c.id);
    if (ids.length === 0) return;
    commit((s) => {
      if (kind === "development") {
        set_cannon_development(s, ids, allAtOnce ? allDev : new Map(ids.map((id) => [id, devs[id] ?? chosen.find((c) => c.id === id)!.development])));
      } else if (allAtOnce) {
        set_cannon_levels(s, ids, allLevels);
      } else {
        set_cannon_levels(s, ids, new Map(ids.map((id) => [id, levelsOf(id, chosen.find((c) => c.id === id)!.levels)])));
      }
    }, "Edited Ototo cannons");
    setLvls({}); setDevs({});
  };

  return (
    <Panel title="Ototo Cat Cannon" description="Select cannons, then edit their development stage or part levels (limited by the recipe unlock table).">
      <div className="space-y-1">
        {rows.map((r) => (
          <label key={r.id} className="flex cursor-pointer items-center gap-3 rounded-lg border border-border px-3 py-2 text-sm hover:bg-surface-2">
            <input type="checkbox" className="size-4 accent-[var(--accent)]" checked={sel.has(r.id)} onChange={() => toggle(r.id)} />
            <span className="min-w-0 flex-1">
              <span className="font-medium">{r.name}</span>
              <span className="block text-xs text-muted">
                {r.id !== 0 && `${STAGE_LABEL[r.development] ?? `Stage ${r.development}`} - `}
                {r.levels.map((l, i) => `${r.part_names[i] ?? `Part ${i + 1}`}: ${l}`).join(", ")}
              </span>
            </span>
          </label>
        ))}
      </div>
      {chosen.length > 0 && (
        <div className="space-y-4">
          {(multi || chosen[0].id !== 0) && (
            <Segmented value={kind} onChange={setKind}
              options={[{ value: "level", label: "Levels" }, { value: "development", label: "Development" }]} />
          )}
          {multi && (
            <Segmented value={scope} onChange={setScope}
              options={[{ value: "individual", label: "Individually" }, { value: "all", label: "All at once" }]} />
          )}
          {kind === "development" && (
            allAtOnce ? (
              <Field label="Development stage">{(id) => (
                <Select id={id} value={allDev} onChange={(e) => setAllDev(+e.target.value)}>
                  {DEVELOPMENT_STAGES.map((_, i) => <option key={i} value={i}>{STAGE_LABEL[i]}</option>)}
                </Select>)}</Field>
            ) : chosen.filter((c) => c.id !== 0).map((c) => (
              <Field key={c.id} label={c.name}>{(id) => (
                <Select id={id} value={devs[c.id] ?? c.development} onChange={(e) => setDevs({ ...devs, [c.id]: +e.target.value })}>
                  {DEVELOPMENT_STAGES.map((_, i) => <option key={i} value={i}>{STAGE_LABEL[i]}</option>)}
                </Select>)}</Field>
            ))
          )}
          {kind === "level" && (
            allAtOnce ? (
              <div className="grid gap-3 sm:grid-cols-3">
                {["Effect", "Improved Foundation", "Improved Style"].map((n, i) => (
                  <NumberField key={n} label={n} value={allLevels[i]} min={i === 0 ? 1 : 0} max={partMax[i]}
                    onChange={(v) => setAllLevels(allLevels.map((x, j) => (j === i ? v : x)))} />
                ))}
              </div>
            ) : chosen.map((c) => (
              <div key={c.id} className="space-y-2">
                <h3 className="text-sm font-medium">{c.name}</h3>
                <div className="grid gap-3 sm:grid-cols-3">
                  {c.levels.map((l, i) => (
                    <NumberField key={i} label={c.part_names[i] ?? `Part ${i + 1}`} value={levelsOf(c.id, c.levels)[i] ?? l}
                      min={i === 0 ? 1 : 0} max={partMax[i]}
                      onChange={(v) => setLvls({ ...lvls, [c.id]: levelsOf(c.id, c.levels).map((x, j) => (j === i ? v : x)) })} />
                  ))}
                </div>
              </div>
            ))
          )}
          <Button variant="primary" onClick={apply}>Apply</Button>
        </div>
      )}
    </Panel>
  );
}
