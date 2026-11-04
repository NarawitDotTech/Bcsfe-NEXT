"use client";
import { useMemo, useState } from "react";
import { useSave } from "@/components/editor/SaveContext";
import { Button, MultiSelect, Notice, NumberField, Panel, Segmented } from "@/components/ui/primitives";
import * as ce from "@/lib/bcsfe/edits/cat_editor";
import * as st from "@/lib/bcsfe/edits/storage";
import { CatSelector, useCatSelection } from "./CatSelector";

type Tab = "view" | "cats" | "skills" | "remove";

export default function CatStorage() {
  const { save, version, commit, notify } = useSave();
  const [tab, setTab] = useState<Tab>("view");
  const sel = useCatSelection();
  const [catQty, setCatQty] = useState<Record<number, number>>({});
  const [skillPicked, setSkillPicked] = useState<Set<number>>(() => new Set());
  const [skillQty, setSkillQty] = useState<Record<number, number>>({});
  const [removePicked, setRemovePicked] = useState<Set<number>>(() => new Set());

  const size = st.get_storage_size(save);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const entries = useMemo(() => st.list_storage(save), [save, version]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const skillNames = useMemo(() => st.get_special_skill_names(save), [save, version]);
  const free = size - entries.length;

  if (size === 0) {
    return <Panel title="Cat storage"><Notice>This save version has no cat storage (it was removed in game version 11.1.0).</Notice></Panel>;
  }

  const report = (r: st.AddResult, what: string) => {
    if (r.ok) { commit(); notify(`Added ${r.added} ${what} to storage`, "success"); }
    else notify(r.error, "danger");
  };

  return (
    <Panel title="Cat storage" description={`${entries.length} of ${size} slots used, ${free} free.`}
      actions={<Button variant="danger" disabled={entries.length === 0} onClick={() => { st.clear_storage(save); commit(); notify("Storage cleared", "success"); }}>Clear storage</Button>}>
      <Segmented<Tab> value={tab} onChange={setTab} options={[
        { value: "view", label: "Contents" }, { value: "cats", label: "Add cats" }, { value: "skills", label: "Add special skills" }, { value: "remove", label: "Remove items" }]} />

      {tab === "view" && (entries.length === 0 ? <Notice>Storage is empty.</Notice> : (
        <ol className="max-h-96 divide-y divide-border overflow-y-auto rounded-lg border border-border">
          {entries.map((e, i) => (
            <li key={e.slot} className="flex gap-3 px-3 py-1.5 text-sm"><span className="w-8 flex-none text-muted">{i + 1}.</span>{e.label}</li>
          ))}
        </ol>
      ))}

      {tab === "cats" && (
        <div className="space-y-3">
          <CatSelector selection={sel} />
          {sel.cats.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2">
              {sel.cats.slice(0, 40).map((c) => (
                <NumberField key={c.id} label={`${c.id} · ${ce.cat_name(save, c)}`} value={catQty[c.id] ?? 1} min={0} max={size}
                  onChange={(v) => setCatQty({ ...catQty, [c.id]: v })} hint="Quantity" />
              ))}
            </div>
          )}
          {sel.cats.length > 40 && <p className="text-xs text-muted">Only the first 40 selected cats are shown; the rest are added with quantity 1.</p>}
          <Button variant="primary" disabled={sel.cats.length === 0}
            onClick={() => report(st.add_cats(save, sel.cats.map((c) => ({ id: c.id, quantity: catQty[c.id] ?? 1 }))), "cats")}>Add cats</Button>
        </div>
      )}

      {tab === "skills" && (
        <div className="space-y-3">
          <MultiSelect items={skillNames.map((n, i) => ({ id: i, label: n }))} selected={skillPicked} onChange={setSkillPicked} height={240} />
          {skillPicked.size > 0 && (
            <div className="grid gap-3 sm:grid-cols-2">
              {[...skillPicked].sort((a, b) => a - b).map((id) => (
                <NumberField key={id} label={skillNames[id]} value={skillQty[id] ?? 1} min={0} max={size} hint="Quantity"
                  onChange={(v) => setSkillQty({ ...skillQty, [id]: v })} />
              ))}
            </div>
          )}
          <Button variant="primary" disabled={skillPicked.size === 0}
            onClick={() => report(st.add_special_skills(save, [...skillPicked].map((id) => ({ id, quantity: skillQty[id] ?? 1 }))), "special skills")}>Add special skills</Button>
        </div>
      )}

      {tab === "remove" && (
        <div className="space-y-3">
          {entries.length === 0 ? <Notice>Storage is empty.</Notice> : (
            <MultiSelect items={entries.map((e, i) => ({ id: e.slot, label: e.label, detail: `#${i + 1}` }))}
              selected={removePicked} onChange={setRemovePicked} height={300} showIds={false} />
          )}
          <Button variant="danger" disabled={removePicked.size === 0} onClick={() => {
            const n = st.remove_slots(save, [...removePicked]);
            setRemovePicked(new Set());
            commit(); notify(`Removed ${n} item${n === 1 ? "" : "s"}`, "success");
          }}>Remove {removePicked.size || ""} items</Button>
        </div>
      )}
    </Panel>
  );
}
