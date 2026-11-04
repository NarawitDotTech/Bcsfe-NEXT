"use client";
import { useMemo, useState } from "react";
import { useSave } from "@/components/editor/SaveContext";
import { Button, Checkbox, Notice, NumberField, Panel, Segmented, Select } from "@/components/ui/primitives";
import * as ce from "@/lib/bcsfe/edits/cat_editor";
import { CatSelector, useCatSelection } from "./CatSelector";

export default function TalentCats() {
  const { save, version, commit, notify } = useSave();
  const sel = useCatSelection();
  const [mode, setMode] = useState<"individual" | "max" | "remove">("individual");
  const [ack, setAck] = useState(false);
  const [catId, setCatId] = useState<number | null>(null);
  const [draft, setDraft] = useState<Record<number, number[]>>({});

  const status = useMemo(() => ce.check_talent_version(save), [save]);
  const talentCats = useMemo(
    () => sel.cats.filter((c) => ce.get_talent_info(save, c) !== null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [save, version, sel.cats],
  );
  const current = talentCats.find((c) => c.id === catId) ?? talentCats[0] ?? null;
  const info = useMemo(
    () => (current ? ce.get_talent_info(save, current) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [save, version, current],
  );
  const levels = info && current ? (draft[current.id] ?? info.levels) : [];
  const needsAck = !status.ok && mode !== "remove";
  const blocked = needsAck && !ack;

  const effective = sel.cats.length <= 1 ? "individual" : mode;

  const runMax = () => {
    const n = ce.max_talents_cats(save, sel.cats);
    commit();
    notify(`Maxed talents of ${n} cat${n === 1 ? "" : "s"}`, n ? "success" : "warning");
  };
  const runRemove = () => {
    const n = ce.remove_talents_cats(save, sel.cats);
    commit();
    notify(`Removed talents of ${n} cat${n === 1 ? "" : "s"}`, "success");
  };
  const runSave = () => {
    if (!current || !info) return;
    ce.set_cat_talents(save, current, levels);
    setDraft((d) => { const n = { ...d }; delete n[current.id]; return n; });
    commit();
    notify(`Updated talents of ${ce.cat_name(save, current)}`, "success");
  };

  return (
    <Panel title="Upgrade / remove talents" description="Edit talent levels of the selected cats.">
      <CatSelector selection={sel} />
      {!status.ok && (
        <Notice tone="warning">
          {status.data_version === null
            ? "No game data version is loaded, so talent data may be missing."
            : <>The editor's game data ({status.data_version}) does not match this save's game version ({status.save_version}). Talents may not work as expected; the data should be updated within a few days of a game release.</>}
          {mode !== "remove" && <div className="mt-2"><Checkbox label="Continue anyway" checked={ack} onChange={setAck} /></div>}
        </Notice>
      )}
      <Segmented value={mode} onChange={setMode} options={[
        { value: "individual", label: "Edit levels" }, { value: "max", label: "Max all talents" }, { value: "remove", label: "Remove talents" }]} />

      {sel.cats.length > 0 && effective === "max" && (
        <Button variant="primary" disabled={blocked} onClick={runMax}>Max talents of {sel.cats.length} cats</Button>
      )}
      {sel.cats.length > 0 && effective === "remove" && (
        <Button variant="danger" onClick={runRemove}>Remove talents of {sel.cats.length} cats</Button>
      )}
      {sel.cats.length > 0 && effective === "individual" && (
        talentCats.length === 0 ? <Notice>None of the selected cats have talents in the loaded game data.</Notice> : (
          <div className="space-y-3">
            {talentCats.length > 1 && (
              <label className="block space-y-1 text-sm font-medium">Cat
                <Select value={current?.id ?? ""} onChange={(e) => setCatId(+e.target.value)}>
                  {talentCats.map((c) => <option key={c.id} value={c.id}>{c.id} · {ce.cat_name(save, c)}</option>)}
                </Select>
              </label>
            )}
            {info && current && (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  {info.ids.map((tid, i) => (
                    <NumberField key={`${current.id}-${tid}`} label={info.names[i]} value={levels[i]} max={info.max_levels[i]}
                      onChange={(v) => setDraft({ ...draft, [current.id]: levels.map((l, j) => (j === i ? v : l)) })} />
                  ))}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="primary" disabled={blocked} onClick={runSave}>Save talents</Button>
                  <Button disabled={blocked} onClick={() => setDraft({ ...draft, [current.id]: info.max_levels })}>Set all to max</Button>
                  <Button variant="ghost" onClick={() => setDraft({ ...draft, [current.id]: info.levels.map(() => 0) })}>Set all to 0</Button>
                </div>
              </>
            )}
          </div>
        )
      )}
    </Panel>
  );
}
