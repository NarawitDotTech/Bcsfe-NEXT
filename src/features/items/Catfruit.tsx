"use client";
import { useState } from "react";
import { Button, Notice, NumberField } from "@/components/ui/primitives";
import { useSave } from "@/components/editor/SaveContext";
import { catfruit_slot_max, edit_catfruit, get_catfruit_info } from "@/lib/bcsfe/edits/basic_items";
import { NoGameData } from "./shared";

export function CatfruitBody() {
  const { save, commit } = useSave();
  const info = get_catfruit_info(save);
  const [values, setValues] = useState(info?.values ?? []);
  if (!info) return <NoGameData what="catfruit names" />;
  if (info.names.length === 0) return <Notice>This save has no catfruit entries yet. Open the game once with this save and try again.</Notice>;
  const total = values.reduce((a, b) => a + b, 0);
  const changed = values.some((v, i) => v !== info.values[i]);
  return (
    <div className="space-y-4">
      {info.cumulative && (
        <Notice>
          This game version (before 11.4.0) caps the total of all catfruit at {info.max.toLocaleString()}. Current total: {total.toLocaleString()}.
        </Notice>
      )}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {info.names.map((name, i) => (
          <NumberField key={i} label={name} value={values[i]} max={catfruit_slot_max(info, values, i)}
            onChange={(v) => setValues((cur) => cur.map((x, j) => (j === i ? v : x)))} />
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="primary" disabled={!changed} onClick={() => commit((s) => { edit_catfruit(s, values); }, "Catfruit updated")}>Apply</Button>
        {!info.cumulative && <Button onClick={() => setValues(values.map(() => info.max))}>Set all to max</Button>}
        <Button variant="ghost" disabled={!changed} onClick={() => setValues(info.values)}>Reset</Button>
      </div>
    </div>
  );
}
