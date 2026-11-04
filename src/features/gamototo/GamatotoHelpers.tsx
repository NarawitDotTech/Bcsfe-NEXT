"use client";
import { useMemo, useState } from "react";
import { useSave } from "@/components/editor/SaveContext";
import { Button, Notice, NumberField, Panel } from "@/components/ui/primitives";
import { clamp_cumulative, helper_info, helper_names, set_helpers } from "@/lib/bcsfe/edits/gamototo";

export default function GamatotoHelpers() {
  const { save, version, commit } = useSave();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const info = useMemo(() => helper_info(save), [save, version]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const current = useMemo(() => helper_names(save), [save, version]);
  const [draft, setDraft] = useState<number[] | null>(null);
  if (info === null) return <Notice tone="warning">Helper data is unavailable (game data missing).</Notice>;
  const amounts = draft ?? info.total_rarity_amounts;
  const total = amounts.reduce((a, b) => a + b, 0);
  return (
    <Panel title="Gamatoto Helpers"
      description={`Number of helpers per rarity. Total ${total}${info.max_helpers !== null ? ` / ${info.max_helpers}` : ""}.`}>
      <div className="grid gap-3 sm:grid-cols-2">
        {info.rarity_names.map((name, i) => (
          <NumberField key={name + i} label={name} value={amounts[i]} max={info.max_helpers ?? undefined}
            onChange={(v) => setDraft(clamp_cumulative(amounts, i, v, info.max_helpers))} />
        ))}
      </div>
      <Button variant="primary" onClick={() => { commit((s) => set_helpers(s, amounts), "Updated Gamatoto helpers"); setDraft(null); }}>Apply</Button>
      {current.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer text-muted">Current helpers ({current.length})</summary>
          <ul className="mt-2 space-y-0.5">
            {current.map((h, i) => <li key={i}>{h.name} <span className="text-muted">({h.rarity_name})</span></li>)}
          </ul>
        </details>
      )}
    </Panel>
  );
}
