"use client";
import { Button, Panel } from "@/components/ui/primitives";
import { useSave } from "@/components/editor/SaveContext";
import { reset_golden_cat_cpus } from "@/lib/bcsfe/edits/basic_items";

export function ResetGoldenCatCpusPanel() {
  const { save, commit } = useSave();
  return (
    <Panel title="Reset Golden Cat CPU Uses" description={`Current golden cat CPU uses: ${save.golden_cpu_count}`}>
      <Button variant="primary" disabled={save.golden_cpu_count === 0}
        onClick={() => commit(reset_golden_cat_cpus, "Successfully reset golden cat CPU uses")}>Reset uses</Button>
    </Panel>
  );
}
