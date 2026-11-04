"use client";
import { useMemo } from "react";
import { useSave } from "@/components/editor/SaveContext";
import { NumberField, Panel } from "@/components/ui/primitives";
import { engineers_info, set_engineers } from "@/lib/bcsfe/edits/gamototo";

export default function Engineers() {
  const { save, version, commit } = useSave();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const info = useMemo(() => engineers_info(save), [save, version]);
  return (
    <Panel title={info.name} description="Number of engineers available for building the Cat Cannon.">
      <NumberField label={info.name} value={info.value} max={info.max}
        onChange={(v) => commit((s) => set_engineers(s, v), `Set ${info.name} to ${Math.min(v, info.max)}`)} />
    </Panel>
  );
}
