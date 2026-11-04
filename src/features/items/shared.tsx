"use client";
import { useState, type ReactNode } from "react";
import { Button, Checkbox, Notice, NumberField, NumberGrid, Panel } from "@/components/ui/primitives";
import { useSave } from "@/components/editor/SaveContext";
import type { SaveFile } from "@/lib/bcsfe/core/io/save";
import type { ScalarInfo, ListInfo } from "@/lib/bcsfe/edits/basic_items";

/** Warning with a required confirmation checkbox. `onConfirm` toggles whether Apply is allowed. */
export function BannableWarning({ text, confirmed, onChange }: {
  text: string; confirmed: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div className="space-y-2">
      <Notice tone="warning"><span className="whitespace-pre-line">{text}</span></Notice>
      <Checkbox checked={confirmed} onChange={onChange} label="I understand the risk and want to continue" />
    </div>
  );
}

export function NoGameData({ what }: { what: string }) {
  return <Notice tone="danger">Could not load {what} from the game data. Make sure game data finished downloading and try again.</Notice>;
}

/** Remounts `children` after every commit so local edit state resets to the saved values. */
export function useKey(): number {
  return useSave().version;
}

/** Single number editor panel body. */
export function ScalarEditor({ getInfo, apply, warning, note, extra, successLabel }: {
  getInfo: (save: SaveFile) => ScalarInfo;
  apply: (save: SaveFile, value: number) => number;
  warning?: string;
  note?: string;
  extra?: ReactNode;
  successLabel?: string;
}) {
  const { save, commit } = useSave();
  const info = getInfo(save);
  const [value, setValue] = useState(info.value);
  const [confirmed, setConfirmed] = useState(!warning);
  return (
    <div className="space-y-4">
      {warning && <BannableWarning text={warning} confirmed={confirmed} onChange={setConfirmed} />}
      {note && <Notice>{note}</Notice>}
      {extra}
      <NumberField label={info.label} value={value} max={info.max} onChange={setValue} hint={`Current ${info.value.toLocaleString()} · max ${info.max.toLocaleString()}`} />
      <Button variant="primary" disabled={!confirmed || value === info.value}
        onClick={() => {
          let applied = value;
          commit((s) => { applied = apply(s, value); }, `${successLabel ?? info.label} set to ${value.toLocaleString()}`);
          setValue(applied);
        }}>
        Apply
      </Button>
    </div>
  );
}

export function ScalarPanel(props: {
  title: string; description?: string;
  getInfo: (save: SaveFile) => ScalarInfo;
  apply: (save: SaveFile, value: number) => number;
  warning?: () => string;
  note?: () => string;
}) {
  const key = useKey();
  return (
    <Panel title={props.title} description={props.description}>
      <ScalarEditor key={key} getInfo={props.getInfo} apply={props.apply}
        warning={props.warning?.()} note={props.note?.()} />
    </Panel>
  );
}

/** List of named number inputs (NumberGrid) with Apply + set-all helpers. */
export function ListEditor({ info, apply, label, hide_max }: {
  info: ListInfo; apply: (save: SaveFile, values: number[]) => number[]; label: string; hide_max?: boolean;
}) {
  const { commit } = useSave();
  const [values, setValues] = useState(info.values);
  const changed = values.some((v, i) => v !== info.values[i]);
  if (info.names.length === 0) {
    return <Notice>This save has no {label.toLowerCase()} entries yet. Open the game once with this save and try again.</Notice>;
  }
  return (
    <div className="space-y-4">
      <NumberGrid
        rows={info.names.map((name, i) => ({ key: i, label: name, value: values[i], max: hide_max ? undefined : info.max }))}
        onChange={(k, v) => setValues((cur) => cur.map((x, i) => (i === k ? v : x)))} />
      <div className="flex flex-wrap gap-2">
        <Button variant="primary" disabled={!changed}
          onClick={() => commit((s) => { apply(s, values); }, `${label} updated`)}>Apply</Button>
        <Button onClick={() => setValues(values.map(() => info.max))}>Set all to max</Button>
        <Button variant="ghost" onClick={() => setValues(info.values)} disabled={!changed}>Reset</Button>
      </div>
    </div>
  );
}
