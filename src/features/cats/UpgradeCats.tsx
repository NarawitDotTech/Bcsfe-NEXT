"use client";
import { useMemo, useState } from "react";
import { useSave } from "@/components/editor/SaveContext";
import { Button, Field, Notice, Panel, Segmented, TextInput } from "@/components/ui/primitives";
import { core_data } from "@/lib/bcsfe/core/core_data";
import { ConfigKey } from "@/lib/bcsfe/core/io/config";
import * as ce from "@/lib/bcsfe/edits/cat_editor";
import { CatBadges, CatSelector, useCatSelection } from "./CatSelector";

const GRAMMAR = "Format: base+plus. Each part is a number, a range (5-10, picks randomly), max, or blank for no change. Examples: 30+20, max+max, 30+, +20, 5-10+20-30.";

export default function UpgradeCats() {
  const { save, version, commit, notify } = useSave();
  const sel = useCatSelection();
  const [mode, setMode] = useState<"all" | "individual">("all");
  const [allInput, setAllInput] = useState("max+max");
  const [inputs, setInputs] = useState<Record<number, string>>({});
  const strict = core_data.config.get_bool(ConfigKey.STRICT_UPGRADE);
  const disable = core_data.config.get_bool(ConfigKey.DISABLE_MAXES);

  const overall = useMemo(() => {
    if (sel.cats.length === 0) return null;
    return ce.get_overall_upgrade_limits(save, sel.cats[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [save, version, sel.cats]);
  const preview = overall ? ce.parse_upgrade(allInput, overall.max_base, overall.max_plus) : null;
  const effective = sel.cats.length === 1 ? "individual" : mode;

  const runAll = () => {
    const n = ce.upgrade_cats_all(save, sel.cats, allInput);
    if (n < 0) { notify("Invalid upgrade input.", "danger"); return; }
    commit();
    notify(`Upgraded ${n} cat${n === 1 ? "" : "s"}`, "success");
  };
  const runIndividual = () => {
    const entries = sel.cats.map((c) => ({ cat_id: c.id, input: inputs[c.id] ?? "" }));
    const n = ce.upgrade_cats_individual(save, entries);
    commit();
    notify(`Upgraded ${n} cat${n === 1 ? "" : "s"}`, n ? "success" : "warning");
  };

  return (
    <Panel title="Upgrade cats" description="Set base level and plus level of the selected cats, limited by each cat's maximum.">
      <CatSelector selection={sel} />
      {strict && <Notice>Strict upgrade is on: the cap depends on your user rank and claimed rank rewards.</Notice>}
      {disable && <Notice tone="warning">Maxes are disabled: limits are 50000.</Notice>}
      {sel.cats.length > 1 && <Segmented value={mode} onChange={setMode} options={[{ value: "all", label: "All at once" }, { value: "individual", label: "Individually" }]} />}
      <p className="text-xs text-muted">{GRAMMAR}</p>
      {sel.cats.length > 0 && effective === "all" && (
        <div className="space-y-2">
          <Field label="Upgrade for all selected cats" error={preview === null ? "Invalid input" : undefined}
            hint={overall ? `Highest limits in the game: base ${overall.max_base}, plus ${overall.max_plus}. Each cat is capped to its own limit.` : undefined}>
            {(id) => <TextInput id={id} value={allInput} onChange={(e) => setAllInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && preview && runAll()} />}
          </Field>
          <Button variant="primary" disabled={preview === null} onClick={runAll}>Upgrade {sel.cats.length} cats</Button>
        </div>
      )}
      {sel.cats.length > 0 && effective === "individual" && (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setInputs(Object.fromEntries(sel.cats.map((c) => [c.id, "max+max"])))}>Fill all with max+max</Button>
            <Button variant="ghost" onClick={() => setInputs({})}>Clear inputs</Button>
          </div>
          <ul className="max-h-[28rem] divide-y divide-border overflow-y-auto rounded-lg border border-border">
            {sel.cats.slice(0, 200).map((cat) => {
              const lim = ce.get_cat_upgrade_limits(save, cat);
              const val = inputs[cat.id] ?? "";
              const bad = val.trim() !== "" && ce.parse_upgrade(val, lim.max_base, lim.max_plus) === null;
              return (
                <li key={cat.id} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
                  <span className="w-12 flex-none font-mono text-xs text-muted">{cat.id}</span>
                  <div className="min-w-0 flex-1 basis-40">
                    <div className="truncate">{ce.cat_name(save, cat)}</div>
                    <div className="text-xs text-muted">Max {lim.max_base}+{lim.max_plus} · <CatBadges cat={cat} /></div>
                  </div>
                  <TextInput aria-label={`Upgrade for ${ce.cat_name(save, cat)}`} aria-invalid={bad} value={val} placeholder="e.g. max+max"
                    onChange={(e) => setInputs({ ...inputs, [cat.id]: e.target.value })} className={bad ? "w-36 border-danger" : "w-36"} />
                </li>
              );
            })}
          </ul>
          {sel.cats.length > 200 && <p className="text-xs text-muted">Only the first 200 selected cats are listed; use “All at once” for the rest.</p>}
          <Button variant="primary" onClick={runIndividual}>Apply upgrades</Button>
        </div>
      )}
    </Panel>
  );
}
