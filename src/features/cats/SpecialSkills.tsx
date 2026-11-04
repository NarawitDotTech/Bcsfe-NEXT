"use client";
import { useMemo, useState } from "react";
import { useSave } from "@/components/editor/SaveContext";
import { Button, Field, MultiSelect, Notice, Panel, Segmented, TextInput } from "@/components/ui/primitives";
import { Upgrade } from "@/lib/bcsfe/core/game/catbase/upgrade";
import * as ss from "@/lib/bcsfe/edits/special_skills";

const GRAMMAR = "Format: base+plus. Each part is a number, a range (5-10, picks randomly), max, or blank for no change. Examples: 10+5, max+max, 10+, +5.";

export default function SpecialSkills() {
  const { save, version, commit, notify } = useSave();
  const skills = useMemo(() => ss.list_special_skills(save),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [save, version]);
  const [picked, setPicked] = useState<Set<number>>(() => new Set());
  const [mode, setMode] = useState<"individual" | "all">("individual");
  const [allInput, setAllInput] = useState("max+max");
  const [inputs, setInputs] = useState<Record<number, string>>({});

  const items = skills.map((s) => ({ id: s.id, label: s.name, detail: `Lv ${s.base_level}+${s.plus_level} / max ${s.max_base}+${s.max_plus}` }));
  const chosen = skills.filter((s) => picked.has(s.id));
  const lim = ss.get_overall_skill_limits(save);
  const allValid = lim ? Upgrade.get_user_upgrade(allInput.trim().toLowerCase(), lim.max_base - 1, lim.max_plus)[0] !== null : false;

  if (skills.length === 0) return <Panel title="Special skills / base abilities"><Notice tone="warning">Special skill data is not available.</Notice></Panel>;

  const runInd = () => {
    const n = ss.edit_special_skills_individual(save, chosen.map((s) => ({ id: s.id, input: inputs[s.id] ?? "" })));
    commit();
    notify(`Edited ${n} special skill${n === 1 ? "" : "s"}`, n ? "success" : "warning");
  };
  const runAll = () => {
    const n = ss.edit_special_skills_all(save, chosen.map((s) => s.id), allInput);
    if (n < 0) { notify("Invalid upgrade input.", "danger"); return; }
    commit();
    notify(`Edited ${n} special skill${n === 1 ? "" : "s"}`, "success");
  };

  return (
    <Panel title="Special skills / base abilities" description="Upgrade the cat cannon, base and other special skills.">
      <MultiSelect items={items} selected={picked} onChange={setPicked} height={280} />
      {chosen.length > 1 && <Segmented value={mode} onChange={setMode} options={[{ value: "individual", label: "Individually" }, { value: "all", label: "All at once" }]} />}
      <p className="text-xs text-muted">{GRAMMAR}</p>
      {chosen.length > 0 && (chosen.length === 1 || mode === "individual") && (
        <div className="space-y-2">
          <div className="grid gap-3 sm:grid-cols-2">
            {chosen.map((s) => {
              const v = inputs[s.id] ?? "";
              const bad = v.trim() !== "" && Upgrade.get_user_upgrade(v.trim().toLowerCase(), s.max_base - 1, s.max_plus)[0] === null;
              return (
                <Field key={s.id} label={s.name} hint={`Now ${s.base_level}+${s.plus_level}, max ${s.max_base}+${s.max_plus}`} error={bad ? "Invalid input" : undefined}>
                  {(id) => <TextInput id={id} value={v} placeholder="e.g. max+max" onChange={(e) => setInputs({ ...inputs, [s.id]: e.target.value })} />}
                </Field>
              );
            })}
          </div>
          <Button variant="primary" onClick={runInd}>Apply to {chosen.length} skills</Button>
        </div>
      )}
      {chosen.length > 1 && mode === "all" && (
        <div className="space-y-2">
          <Field label="Upgrade for all selected skills" error={allValid ? undefined : "Invalid input"} hint="Each skill is capped to its own maximum.">
            {(id) => <TextInput id={id} value={allInput} onChange={(e) => setAllInput(e.target.value)} />}
          </Field>
          <Button variant="primary" disabled={!allValid} onClick={runAll}>Upgrade {chosen.length} skills</Button>
        </div>
      )}
    </Panel>
  );
}
