"use client";
import { useMemo, useState } from "react";
import { useSave } from "@/components/editor/SaveContext";
import { Button, Notice, NumberField, Panel, Segmented } from "@/components/ui/primitives";
import { gamatoto_xp_info, set_gamatoto_xp } from "@/lib/bcsfe/edits/gamototo";

export default function GamatotoXp() {
  const { save, version, commit } = useSave();
  const [mode, setMode] = useState<"level" | "raw">("level");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const info = useMemo(() => gamatoto_xp_info(save), [save, version]);
  const [draft, setDraft] = useState<{ v: number } | null>(null);
  if (info === null) return <Notice tone="warning">Gamatoto level data is unavailable (game data missing).</Notice>;
  const value = draft?.v ?? (mode === "level" ? info.level : info.xp);
  const apply = () => commit((s) => {
    const r = set_gamatoto_xp(s, mode, value);
    if (r) setDraft(null);
  }, mode === "level" ? `Set Gamatoto level to ${value}` : `Set Gamatoto XP to ${value}`);
  return (
    <Panel title="Gamatoto XP / Level"
      description={`Current level ${info.level}${info.max_level ? ` of ${info.max_level}` : ""} (XP ${info.xp.toLocaleString()}).`}>
      <Segmented value={mode} onChange={(m) => { setMode(m); setDraft(null); }}
        options={[{ value: "level", label: "Level" }, { value: "raw", label: "Raw XP" }]} />
      <NumberField label={mode === "level" ? "Gamatoto level" : "Gamatoto XP"} value={value} min={mode === "level" ? 1 : 0}
        max={mode === "level" ? (info.max_level ?? undefined) : undefined}
        onChange={(v) => setDraft({ v })} />
      <Button variant="primary" onClick={apply}>Apply</Button>
    </Panel>
  );
}
