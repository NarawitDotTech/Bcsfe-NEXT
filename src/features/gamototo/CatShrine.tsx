"use client";
import { useMemo, useState } from "react";
import { useSave } from "@/components/editor/SaveContext";
import { Button, Notice, NumberField, Panel, Segmented } from "@/components/ui/primitives";
import { set_shrine_level, set_shrine_xp, shrine_appear, shrine_disappear, shrine_info } from "@/lib/bcsfe/edits/gamototo";

export default function CatShrine() {
  const { save, version, commit } = useSave();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const info = useMemo(() => shrine_info(save), [save, version]);
  const [mode, setMode] = useState<"level" | "xp">("level");
  const [val, setVal] = useState<number | null>(null);
  if (info.max_level === null || info.max_xp === null) return <Notice tone="warning">Cat shrine data is unavailable (game data missing).</Notice>;
  const v = val ?? (mode === "level" ? (info.level ?? 1) : info.xp);
  return (
    <Panel title="Cat Shrine" description={`Current level ${info.level} (XP ${info.xp.toLocaleString()}). Shrine is ${info.gone ? "hidden" : "visible"} in game.`}>
      <Segmented value={mode} onChange={(m) => { setMode(m); setVal(null); }}
        options={[{ value: "level", label: "Level" }, { value: "xp", label: "XP" }]} />
      <NumberField label={mode === "level" ? "Shrine level" : "Shrine XP"} value={v} min={mode === "level" ? 1 : 0}
        max={mode === "level" ? info.max_level : info.max_xp} onChange={setVal} />
      <div className="flex flex-wrap gap-2">
        <Button variant="primary" onClick={() => { commit((s) => (mode === "level" ? set_shrine_level(s, v) : set_shrine_xp(s, v)), "Edited cat shrine"); setVal(null); }}>Apply</Button>
        <Button onClick={() => commit(shrine_appear, "Cat shrine will appear in game")}>Show shrine</Button>
        <Button onClick={() => commit(shrine_disappear, "Cat shrine hidden")}>Hide shrine</Button>
      </div>
    </Panel>
  );
}
