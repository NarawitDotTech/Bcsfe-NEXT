"use client";
import { useMemo, useState } from "react";
import { useSave } from "@/components/editor/SaveContext";
import { Button, Field, MultiSelect, Notice, Panel, Segmented, TextInput } from "@/components/ui/primitives";
import {
  combine_selection, get_all_enemies, get_all_invalid_enemies, get_all_valid_enemies, get_enemy_name,
  remove_enemy_guide, unlock_enemy_guide, type SelectMode,
} from "@/lib/bcsfe/edits/enemy_editor";

export default function EnemyGuide() {
  const { save, version, commit, notify } = useSave();
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [mode, setMode] = useState<SelectMode>("or");
  const [pick, setPick] = useState<Set<number>>(new Set());
  const [name, setName] = useState("");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const items = useMemo(() => get_all_enemies(save).map((id) => ({
    id, label: get_enemy_name(save, id) ?? `Enemy ${id}`, detail: save.enemy_guide[id] ? "unlocked" : undefined,
  })), [save, version]);

  const add = (ids: number[] | null) => {
    if (ids === null) { notify("Enemy list data is unavailable (game data missing).", "warning"); return; }
    setSelected(new Set(combine_selection([...selected], ids, mode)));
  };
  const addPicked = () => { add([...pick]); setPick(new Set()); };
  const addByName = () => {
    const q = name.trim().toLowerCase();
    if (!q) return;
    const ids = items.filter((i) => i.label.toLowerCase().includes(q)).map((i) => i.id);
    if (ids.length === 0) notify(`No enemies found with name "${name}"`, "warning");
    else add(ids);
  };
  const ids = [...selected].sort((a, b) => a - b);
  return (
    <Panel title="Enemy Guide" description="Select enemies, then unlock or remove their enemy guide entries. Ids are 0-based game enemy ids.">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted">When adding to a selection:</span>
          <Segmented value={mode} onChange={setMode}
            options={[{ value: "or", label: "Add (OR)" }, { value: "and", label: "Keep common (AND)" }, { value: "replace", label: "Replace" }]} />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => add(get_all_valid_enemies(save))}>All in guide</Button>
          <Button onClick={() => add(get_all_enemies(save))}>All enemies</Button>
          <Button onClick={() => add(get_all_invalid_enemies(save))}>Not in guide</Button>
          <Button variant="ghost" onClick={() => setSelected(new Set())}>Clear selection</Button>
        </div>
        <Field label="Select by name">
          {(id) => (
            <div className="flex gap-2">
              <TextInput id={id} value={name} placeholder="e.g. doge" onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addByName()} />
              <Button onClick={addByName}>Add matches</Button>
            </div>
          )}
        </Field>
        <details>
          <summary className="cursor-pointer text-sm font-medium">Select by id / pick from list</summary>
          <div className="mt-2 space-y-2">
            <MultiSelect items={items} selected={pick} onChange={setPick} height={260} />
            <Button onClick={addPicked} disabled={pick.size === 0}>Add {pick.size} to selection</Button>
          </div>
        </details>
      </div>
      <Notice>{ids.length === 0 ? "No enemies selected." : `${ids.length} enemies selected${ids.length <= 8 ? `: ${ids.map((i) => `${get_enemy_name(save, i)} (${i})`).join(", ")}` : "."}`}</Notice>
      <div className="flex flex-wrap gap-2">
        <Button variant="primary" disabled={ids.length === 0}
          onClick={() => commit((s) => unlock_enemy_guide(s, ids), `Unlocked ${ids.length} enemy guide entries`)}>Unlock entries</Button>
        <Button variant="danger" disabled={ids.length === 0}
          onClick={() => commit((s) => remove_enemy_guide(s, ids), `Removed ${ids.length} enemy guide entries`)}>Remove entries</Button>
      </div>
    </Panel>
  );
}
