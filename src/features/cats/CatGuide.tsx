"use client";
import { useSave } from "@/components/editor/SaveContext";
import { Button, Panel } from "@/components/ui/primitives";
import * as ce from "@/lib/bcsfe/edits/cat_editor";
import { CatSelector, useCatSelection } from "./CatSelector";

export default function CatGuide() {
  const { save, commit, notify } = useSave();
  const sel = useCatSelection();
  const run = (claim: boolean) => {
    const n = claim ? ce.unlock_cat_guide(save, sel.cats) : ce.remove_cat_guide(save, sel.cats);
    commit();
    notify(`${claim ? "Claimed" : "Unclaimed"} cat guide entries for ${n} cat${n === 1 ? "" : "s"}`, "success");
  };
  return (
    <Panel title="Claim / unclaim cat guide entries" description="Marks the cat guide reward as collected (or not) for the selected cats.">
      <CatSelector selection={sel} />
      <div className="flex flex-wrap gap-2">
        <Button variant="primary" disabled={sel.cats.length === 0} onClick={() => run(true)}>Claim entries</Button>
        <Button variant="danger" disabled={sel.cats.length === 0} onClick={() => run(false)}>Unclaim entries</Button>
      </div>
    </Panel>
  );
}
