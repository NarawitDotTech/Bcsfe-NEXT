"use client";
import { useSave } from "@/components/editor/SaveContext";
import { Button, Notice, Panel } from "@/components/ui/primitives";
import * as ce from "@/lib/bcsfe/edits/cat_editor";
import { CatSelector, useCatSelection } from "./CatSelector";

type Variant = { title: string; description: string; apply: string; remove?: string; warning?: string;
  doApply: typeof ce.true_form_cats; doRemove?: typeof ce.remove_true_form_cats; force: boolean };

function FormPanel({ v }: { v: Variant }) {
  const { save, commit, notify } = useSave();
  const sel = useCatSelection();
  const run = (remove: boolean) => {
    const n = remove ? v.doRemove!(save, sel.cats) : v.doApply(save, sel.cats, v.force);
    commit();
    notify(`${remove ? v.remove : v.apply}: ${n} cat${n === 1 ? "" : "s"}`, "success");
  };
  return (
    <Panel title={v.title} description={v.description}>
      {v.warning && <Notice tone="warning">{v.warning}</Notice>}
      <CatSelector selection={sel} />
      <div className="flex flex-wrap gap-2">
        <Button variant="primary" disabled={sel.cats.length === 0} onClick={() => run(false)}>{v.apply}</Button>
        {v.doRemove && <Button variant="danger" disabled={sel.cats.length === 0} onClick={() => run(true)}>{v.remove}</Button>}
      </div>
    </Panel>
  );
}

const forceTrueWarn = "Only use this if you know the cat has a true form, otherwise it will lead to a glitched true form. Mainly useful when the editor's game data is outdated and new true forms are missing.";
const forceFourthWarn = "Only use this if you know the cat has a 4th form, otherwise it will lead to a glitched form. Mainly useful when the editor's game data is outdated.";

export function TrueFormCats() {
  return <FormPanel v={{ title: "True form / remove true form", description: "Uses the picture book data: cats with 3+ forms get their true form; others are set accordingly.",
    apply: "Unlock true forms", remove: "Remove true forms", doApply: ce.true_form_cats, doRemove: ce.remove_true_form_cats, force: false }} />;
}
export function ForceTrueFormCats() {
  return <FormPanel v={{ title: "Force true form", description: "Forces the true form on every selected cat, ignoring the picture book.", warning: forceTrueWarn,
    apply: "Force true forms", doApply: ce.true_form_cats, force: true }} />;
}
export function FourthFormCats() {
  return <FormPanel v={{ title: "Ultra (4th) form / remove ultra form", description: "Uses the picture book data: only cats with exactly 4 forms get the 4th form.",
    apply: "Unlock 4th forms", remove: "Remove 4th forms", doApply: ce.fourth_form_cats, doRemove: ce.remove_fourth_form_cats, force: false }} />;
}
export function ForceFourthFormCats() {
  return <FormPanel v={{ title: "Force ultra (4th) form", description: "Forces the 4th form on every selected cat, ignoring the picture book.", warning: forceFourthWarn,
    apply: "Force 4th forms", doApply: ce.fourth_form_cats, force: true }} />;
}
