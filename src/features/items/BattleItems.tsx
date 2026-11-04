"use client";
import { useState } from "react";
import { Button, Field, MultiSelect, Notice, Panel, Segmented, TextInput } from "@/components/ui/primitives";
import { useSave } from "@/components/editor/SaveContext";
import * as bi from "@/lib/bcsfe/edits/basic_items";
import { ListEditor, NoGameData, useKey } from "./shared";

export function BattleItemsPanel() {
  const { save } = useSave();
  const key = useKey();
  const info = bi.get_battle_items_info(save);
  return (
    <Panel title="Battle Items" description={info?.group_name}>
      {info ? <ListEditor key={key} info={info} apply={bi.edit_battle_items} label="Battle items" />
        : <NoGameData what="battle item names" />}
    </Panel>
  );
}

type Mode = "individual" | "all";

function EndlessBody() {
  const { save, commit, notify } = useSave();
  const items = bi.get_endless_items_info(save);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [mode, setMode] = useState<Mode>("all");
  const [all, setAll] = useState("");
  const [each, setEach] = useState<Record<number, string>>({});
  if (!items) return <NoGameData what="battle item names" />;

  const apply = () => {
    const map = new Map<number, number>();
    const bad: string[] = [];
    for (const idx of selected) {
      const text = mode === "all" ? all : (each[idx] ?? "");
      const mins = bi.parse_minutes(text);
      if (mins === null) bad.push(items[idx].name);
      else map.set(idx, mins);
    }
    if (bad.length) notify(`Invalid minute count for: ${bad.join(", ")}`, "danger");
    if (map.size) commit((s) => bi.edit_endless_items(s, map), `Set endless duration on ${map.size} item${map.size === 1 ? "" : "s"}`);
  };

  return (
    <div className="space-y-4">
      <MultiSelect<number> showIds={false}
        items={items.map((i) => ({ id: i.index, label: i.name, detail: i.duration }))}
        selected={selected} onChange={setSelected} height={240} />
      <Segmented<Mode> value={mode} onChange={setMode} options={[
        { value: "all", label: "All at once" }, { value: "individual", label: "Individually" }]} />
      {mode === "all" ? (
        <Field label="Duration in minutes (decimals allowed, or &quot;infinity&quot;)" hint="Applies to every selected item.">
          {(id) => <TextInput id={id} value={all} onChange={(e) => setAll(e.target.value)} placeholder="e.g. 60 or infinity" />}
        </Field>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {[...selected].sort((a, b) => a - b).map((idx) => (
            <Field key={idx} label={`${items[idx].name} (minutes or infinity)`}>
              {(id) => <TextInput id={id} value={each[idx] ?? ""} onChange={(e) => setEach({ ...each, [idx]: e.target.value })} />}
            </Field>
          ))}
          {selected.size === 0 && <Notice>Select at least one item above.</Notice>}
        </div>
      )}
      <Button variant="primary" disabled={selected.size === 0} onClick={apply}>Apply</Button>
    </div>
  );
}

export function EndlessBattleItemsPanel() {
  const key = useKey();
  return (
    <Panel title="Endless Battle Items" description="Gives items for a set number of minutes, or forever.">
      <EndlessBody key={key} />
    </Panel>
  );
}
