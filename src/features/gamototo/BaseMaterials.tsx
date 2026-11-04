"use client";
import { useMemo } from "react";
import { useSave } from "@/components/editor/SaveContext";
import { Notice, NumberGrid, Panel } from "@/components/ui/primitives";
import { core_data } from "@/lib/bcsfe/core/core_data";
import { base_material_rows, cap_max, set_base_materials } from "@/lib/bcsfe/edits/gamototo";

export default function BaseMaterials() {
  const { save, version, commit } = useSave();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const rows = useMemo(() => base_material_rows(save), [save, version]);
  if (rows === null) return <Notice tone="warning">Base material names are unavailable (game data missing).</Notice>;
  const max = cap_max(core_data.max_value_manager.base_materials);
  return (
    <Panel title="Base Materials" description="Materials used to build the Cat Cannon.">
      <NumberGrid
        rows={rows.map((r, i) => ({ key: i, label: r.name, value: r.value, max }))}
        onChange={(k, v) => commit((s) => {
          const vals = (base_material_rows(s) ?? []).map((r) => r.value);
          vals[k as number] = v;
          set_base_materials(s, vals);
        }, "Updated base materials")} />
    </Panel>
  );
}
