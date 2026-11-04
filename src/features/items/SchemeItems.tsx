"use client";
import { useState } from "react";
import { Button, MultiSelect, Panel, Segmented } from "@/components/ui/primitives";
import { useSave } from "@/components/editor/SaveContext";
import * as bi from "@/lib/bcsfe/edits/basic_items";
import { NoGameData, useKey } from "./shared";

type Mode = "gain" | "remove";

function Body() {
  const { save, commit } = useSave();
  const info = bi.get_scheme_info(save);
  const [mode, setMode] = useState<Mode>("gain");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  if (!info) return <NoGameData what="scheme item data" />;
  const state = (id: number) => (info.received.has(id) ? "received" : info.to_obtain.has(id) ? "pending" : "");
  return (
    <div className="space-y-4">
      <Segmented<Mode> value={mode} onChange={(m) => { setMode(m); setSelected(new Set()); }}
        options={[{ value: "gain", label: "Gain scheme items" }, { value: "remove", label: "Remove scheme items" }]} />
      <MultiSelect<number> showIds={false}
        items={info.options.map((label, i) => ({ id: i, label, detail: state(info.ids[i]) }))}
        selected={selected} onChange={setSelected} />
      <Button variant="primary" disabled={selected.size === 0}
        onClick={() => commit((s) => {
          const ids = [...selected].sort((a, b) => a - b);
          if (mode === "gain") bi.add_scheme_items(s, info, ids); else bi.remove_scheme_items(s, info, ids);
        }, mode === "gain" ? "Scheme items will be given on next game launch" : "Scheme items removed")}>
        Apply
      </Button>
    </div>
  );
}

export function SchemeItemsPanel() {
  const key = useKey();
  return (
    <Panel title="Scheme Items" description="Gaining adds the item to the pending list and clears it from received.">
      <Body key={key} />
    </Panel>
  );
}
