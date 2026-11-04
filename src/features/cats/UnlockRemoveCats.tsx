"use client";
import { useSave } from "@/components/editor/SaveContext";
import { Button, Notice, Panel } from "@/components/ui/primitives";
import { core_data } from "@/lib/bcsfe/core/core_data";
import { ConfigKey } from "@/lib/bcsfe/core/io/config";
import * as ce from "@/lib/bcsfe/edits/cat_editor";
import { CatSelector, useCatSelection } from "./CatSelector";

export default function UnlockRemoveCats() {
  const { save, commit, notify } = useSave();
  const sel = useCatSelection();
  const reset = core_data.config.get_bool(ConfigKey.RESET_CAT_DATA);
  const run = (kind: "unlock" | "remove") => {
    const n = kind === "unlock" ? ce.unlock_cats(save, sel.cats) : ce.remove_cats(save, sel.cats);
    commit();
    notify(`${kind === "unlock" ? "Unlocked" : "Removed"} ${n} cat${n === 1 ? "" : "s"}`, "success");
  };
  return (
    <Panel title="Unlock / remove cats" description="Select cats, then unlock them or remove them from the save.">
      <CatSelector selection={sel} />
      {reset && <Notice>Removing a cat also resets its upgrades, forms, talents and cat guide entry (config: reset cat data).</Notice>}
      <div className="flex flex-wrap gap-2">
        <Button variant="primary" disabled={sel.cats.length === 0} onClick={() => run("unlock")}>Unlock {sel.cats.length || ""} cats</Button>
        <Button variant="danger" disabled={sel.cats.length === 0} onClick={() => run("remove")}>Remove {sel.cats.length || ""} cats</Button>
      </div>
    </Panel>
  );
}
