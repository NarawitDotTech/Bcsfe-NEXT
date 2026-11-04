"use client";
import { useMemo, useState } from "react";
import { Button, Field, MultiSelect, Notice, NumberField, NumberGrid, Panel, Segmented, Select } from "@/components/ui/primitives";
import { useSave } from "@/components/editor/SaveContext";
import * as bi from "@/lib/bcsfe/edits/basic_items";
import { NoGameData, useKey } from "./shared";

type Mode = "individual" | "all";

function Body() {
  const { save, version, commit } = useSave();
  const info = useMemo(() => bi.get_talent_orbs_info(save), [save, version]);
  const [grade, setGrade] = useState("*");
  const [attribute, setAttribute] = useState("*");
  const [effect, setEffect] = useState("*");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [mode, setMode] = useState<Mode>("all");
  const [allCount, setAllCount] = useState(0);
  const [counts, setCounts] = useState<Record<number, number>>({});
  if (!info) return <NoGameData what="talent orb data" />;

  const matches = bi.select_orbs(info, { grade, attribute, effect });
  const items = matches.map((o) => ({ id: o.raw_orb_info.orb_id, label: bi.orb_label(o), detail: String(bi.orb_count(save, o)) }));
  const chosen = matches.filter((o) => selected.has(o.raw_orb_info.orb_id));

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Grade">{(id) => (
          <Select id={id} value={grade} onChange={(e) => setGrade(e.target.value)}>
            <option value="*">Any grade</option>{info.grades.map((g) => <option key={g}>{g}</option>)}
          </Select>)}</Field>
        <Field label="Attribute">{(id) => (
          <Select id={id} value={attribute} onChange={(e) => setAttribute(e.target.value)}>
            <option value="*">Any attribute</option>{info.attributes.map((g) => <option key={g}>{g}</option>)}
          </Select>)}</Field>
        <Field label="Effect">{(id) => (
          <Select id={id} value={effect} onChange={(e) => setEffect(e.target.value)}>
            <option value="*">Any effect</option>{info.effects.map((g) => <option key={g}>{g}</option>)}
          </Select>)}</Field>
      </div>
      <p className="text-sm text-muted">{matches.length} orbs match. The number on the right is how many you own.</p>
      <MultiSelect<number> items={items} selected={selected} onChange={setSelected} height={260} />
      <Segmented<Mode> value={mode} onChange={setMode} options={[
        { value: "all", label: "Same count for all selected" }, { value: "individual", label: "Individually" }]} />
      {mode === "all" ? (
        <NumberField label="Count" value={allCount} max={info.max} onChange={setAllCount} />
      ) : chosen.length === 0 ? (
        <Notice>Select at least one orb.</Notice>
      ) : (
        <NumberGrid rows={chosen.map((o) => ({
          key: o.raw_orb_info.orb_id, label: bi.orb_label(o),
          value: counts[o.raw_orb_info.orb_id] ?? bi.orb_count(save, o), max: info.max }))}
          onChange={(k, v) => setCounts({ ...counts, [Number(k)]: v })} />
      )}
      <Button variant="primary" disabled={chosen.length === 0}
        onClick={() => {
          commit((s) => {
            if (mode === "all") bi.edit_talent_orbs_all(s, info, chosen, allCount);
            else bi.edit_talent_orbs_individual(s, info, new Map(chosen.map((o) => [
              o.raw_orb_info.orb_id, counts[o.raw_orb_info.orb_id] ?? bi.orb_count(s, o)] as [number, number])));
          }, `Updated ${chosen.length} talent orb${chosen.length === 1 ? "" : "s"}`);
          setCounts({});
        }}>Apply</Button>
    </div>
  );
}

export function TalentOrbsPanel() {
  const key = useKey();
  return (
    <Panel title="Talent Orbs" description="Filter orbs by grade, attribute and effect, then set how many you own.">
      <Body key={key} />
    </Panel>
  );
}
