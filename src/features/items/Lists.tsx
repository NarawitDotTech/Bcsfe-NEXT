"use client";
import { Panel } from "@/components/ui/primitives";
import { useSave } from "@/components/editor/SaveContext";
import * as bi from "@/lib/bcsfe/edits/basic_items";
import { ListEditor, NoGameData, useKey } from "./shared";
import type { ListInfo } from "@/lib/bcsfe/edits/basic_items";
import type { SaveFile } from "@/lib/bcsfe/core/io/save";
import { CatfruitBody } from "./Catfruit";

function ListPanel({ title, label, get, apply }: {
  title: string; label: string;
  get: (s: SaveFile) => ListInfo | null;
  apply: (s: SaveFile, v: number[]) => number[];
}) {
  const { save } = useSave();
  const key = useKey();
  const info = get(save);
  return (
    <Panel title={title}>
      {info ? <ListEditor key={key} info={info} apply={apply} label={label} /> : <NoGameData what={label.toLowerCase()} />}
    </Panel>
  );
}

export const CatseyesPanel = () => <ListPanel title="Catseyes" label="Catseyes" get={bi.get_catseyes_info} apply={bi.edit_catseyes} />;
export const CataminsPanel = () => <ListPanel title="Catamins" label="Catamins" get={bi.get_catamins_info} apply={bi.edit_catamins} />;
export const LabyrinthMedalsPanel = () => <ListPanel title="Labyrinth Medals" label="Labyrinth medals" get={bi.get_labyrinth_medals_info} apply={bi.edit_labyrinth_medals} />;
export const TreasureChestsPanel = () => <ListPanel title="Treasure Chests" label="Treasure chests" get={bi.get_treasure_chests_info} apply={bi.edit_treasure_chests} />;

export function CatfruitPanel() {
  const key = useKey();
  return (
    <Panel title="Catfruit / Behemoth Stones">
      <CatfruitBody key={key} />
    </Panel>
  );
}

