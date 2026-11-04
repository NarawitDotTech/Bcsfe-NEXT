"use client";
/** Small level features: tutorial, aku realm, filibuster, scores, enigma, aku chapters, catamin. */
import { useMemo, useState } from "react";
import { useSave } from "@/components/editor/SaveContext";
import { Button, Checkbox, MultiSelect, Notice, NumberField, Panel, Segmented } from "@/components/ui/primitives";
import {
  add_enigma_stages, aku_clear_counts, aku_stage_count, aku_stage_names, allow_filibuster_stage_reclearing,
  clear_tutorial, current_enigma_stages, edit_aku_chapters, edit_challenge_score, edit_dojo_score,
  get_catamin_clear_amount, list_catamin_maps, list_enigma_names, max_clear_count, set_catamin_clear_amounts,
  unlock_aku_realm,
} from "@/lib/bcsfe/edits/map";
import { ChapterEditor } from "./ChapterEditor";

const I32 = 2 ** 31 - 1;

function ActionPanel({ title, description, button, run, message }: {
  title: string; description: string; button: string; run: (s: ReturnType<typeof useSave>["save"]) => void; message: string;
}) {
  const { commit } = useSave();
  return (
    <Panel title={title} description={description}>
      <div><Button variant="primary" onClick={() => commit(run, message)}>{button}</Button></div>
    </Panel>
  );
}

export function ClearTutorialPanel() {
  return <ActionPanel title="Clear Tutorial" button="Clear tutorial" run={clear_tutorial} message="Tutorial cleared"
    description="Marks the tutorial as finished and clears the first story stage if it is not cleared yet." />;
}

export function UnlockAkuRealmPanel() {
  return <ActionPanel title="Unlock Aku Realm" button="Unlock Aku Realm" run={unlock_aku_realm} message="Aku Realm unlocked"
    description="Clears the stages that gate the Aku Realm." />;
}

export function FilibusterPanel() {
  return <ActionPanel title="Re-enable Filibuster Stage" button="Enable Filibuster Stage" run={allow_filibuster_stage_reclearing}
    message="Filibuster stage can be cleared again"
    description="Lets you clear the Filibuster Invasion stage again (a random Filibuster stage id is picked)." />;
}

export function ChallengeScorePanel() {
  const { save, commit } = useSave();
  const [score, setScore] = useState(save.challenge.scores[0] ?? 0);
  return (
    <Panel title="Challenge Score" description="Sets your Challenge Battle score.">
      <NumberField label="Score" value={score} max={I32} onChange={setScore} />
      <div><Button variant="primary" onClick={() => commit((s) => edit_challenge_score(s, score), "Challenge score set")}>Set score</Button></div>
    </Panel>
  );
}

export function DojoScorePanel() {
  const { save, commit } = useSave();
  const current = save.dojo.chapters.chapters.get(0)?.stages.get(0)?.score ?? 0;
  const [score, setScore] = useState(current);
  return (
    <Panel title="Dojo Score" description="Sets the score of the first Dojo stage.">
      <NumberField label="Score" value={score} max={I32} onChange={setScore} />
      <div><Button variant="primary" onClick={() => commit((s) => edit_dojo_score(s, score), "Dojo score set")}>Set score</Button></div>
    </Panel>
  );
}

export function AddEnigmaPanel() {
  const { save, commit } = useSave();
  const names = useMemo(() => list_enigma_names(save), [save]);
  const current = current_enigma_stages(save);
  const nameOf = (id: number) => names.find((n) => n.id === id)?.name ?? `Unknown Enigma (id ${id})`;
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [wipe, setWipe] = useState(false);
  if (names.length === 0) return <Panel title="Add Enigma Stages"><Notice tone="warning">Enigma stage names are not available; download game data first.</Notice></Panel>;
  return (
    <Panel title="Add Enigma Stages" description="Adds stages to your current Enigma list.">
      <div className="text-sm">
        <div className="font-medium">Current enigma stages</div>
        {current.length === 0 ? <p className="text-muted">None.</p> : (
          <ul className="mt-1 list-disc pl-5 text-muted">{current.map((c) => <li key={c.stage_id}>{nameOf(c.id)} (id {c.id})</li>)}</ul>
        )}
      </div>
      {current.length > 0 && <Checkbox label="Wipe current enigma stages first" checked={wipe} onChange={setWipe}
        hint="Resets their completion counts and clears the list." />}
      <MultiSelect items={names.map((n) => ({ id: n.id, label: n.name ?? `Unknown Enigma (id ${n.id})` }))} selected={selected} onChange={setSelected} />
      <Button variant="primary" disabled={selected.size === 0 && !wipe}
        onClick={() => commit((s) => add_enigma_stages(s, [...selected].sort((a, b) => a - b), wipe), "Enigma stages updated")}>
        Add enigma stages
      </Button>
    </Panel>
  );
}

export function AkuChaptersPanel() {
  const { save, commit } = useSave();
  const count = aku_stage_count(save);
  const stageNames = useMemo(() => aku_stage_names(save), [save]);
  const counts = useMemo(() => aku_clear_counts(save), [save]);
  const initial = Math.max(0, counts.findLastIndex((c) => c > 0) + 1);
  const [progress, setProgress] = useState(initial);
  const [individual, setIndividual] = useState(true);
  const [same, setSame] = useState(1);
  const [per, setPer] = useState<Record<number, number>>({});
  const max = max_clear_count();
  if (count === 0) return <Panel title="Aku Realm Chapters"><Notice tone="warning">This save has no Aku Realm data.</Notice></Panel>;
  const useIndividual = progress <= 1 || individual;
  const apply = () => {
    const amounts = useIndividual ? Array.from({ length: progress }, (_, i) => per[i] ?? counts[i] ?? 1) : same;
    commit((s) => edit_aku_chapters(s, progress, amounts), "Aku Realm chapters edited");
  };
  return (
    <Panel title="Aku Realm Chapters" description="Clear the Aku Realm up to a stage; later stages are reset to 0 clears.">
      <NumberField label="Stages cleared" value={progress} min={0} max={count} onChange={setProgress} />
      {progress > 1 && <Segmented value={individual ? "ind" : "same"} onChange={(v) => setIndividual(v === "ind")} options={[
        { value: "ind", label: "Clear count per stage" }, { value: "same", label: "Same clear count" },
      ]} />}
      {progress > 0 && (useIndividual ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: progress }, (_, i) => (
            <NumberField key={i} label={`${i + 1}. ${stageNames[i] ?? "Stage"}`} value={per[i] ?? counts[i] ?? 1} max={max}
              onChange={(v) => setPer({ ...per, [i]: v })} />
          ))}
        </div>
      ) : <NumberField label="Clear count" value={same} max={max} onChange={setSame} />)}
      <div><Button variant="primary" onClick={apply}>Set Aku Realm progress</Button></div>
    </Panel>
  );
}

export function CataminStagesPanel() {
  const [tab, setTab] = useState<"amount" | "stages">("amount");
  return (
    <div className="space-y-4">
      <Segmented value={tab} onChange={setTab} options={[
        { value: "amount", label: "Change chapter clear amount" }, { value: "stages", label: "Clear / unclear stages" },
      ]} />
      {tab === "amount" ? <CataminAmounts /> : <ChapterEditor target="catamin_stages" title="Catamin Stages" />}
    </div>
  );
}

function CataminAmounts() {
  const { save, commit } = useSave();
  const maps = useMemo(() => list_catamin_maps(save), [save]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [individual, setIndividual] = useState(false);
  const [same, setSame] = useState(0);
  const [per, setPer] = useState<Record<number, number>>({});
  const ids = [...selected].sort((a, b) => a - b);
  const sep = individual && ids.length > 1;
  const label = (id: number) => maps.find((m) => m.id === id)?.name ?? `Unknown map ${id}`;
  if (maps.length === 0) return <Panel title="Catamin Chapter Clear Amount"><Notice tone="warning">Catamin stage names are not available; download game data first.</Notice></Panel>;
  return (
    <Panel title="Catamin Chapter Clear Amount" description="0 = never cleared; 3 or more makes the chapter disappear.">
      <MultiSelect items={maps.map((m) => ({ id: m.id, label: m.name ?? `Unknown map ${m.id}`, detail: `now ${get_catamin_clear_amount(save, m.id)}` }))}
        selected={selected} onChange={setSelected} />
      {ids.length > 1 && <Segmented value={individual ? "ind" : "all"} onChange={(v) => setIndividual(v === "ind")} options={[
        { value: "all", label: "Same amount for all" }, { value: "ind", label: "Per chapter" },
      ]} />}
      {ids.length > 0 && (sep
        ? <div className="grid gap-3 sm:grid-cols-2">{ids.map((id) => (
          <NumberField key={id} label={label(id)} value={per[id] ?? get_catamin_clear_amount(save, id)} max={I32} onChange={(v) => setPer({ ...per, [id]: v })} />))}</div>
        : <NumberField label="Clear amount" value={same} max={I32} onChange={setSame} />)}
      <Button variant="primary" disabled={ids.length === 0}
        onClick={() => commit((s) => set_catamin_clear_amounts(s, new Map(ids.map((id) => [id, sep ? (per[id] ?? get_catamin_clear_amount(s, id)) : same] as [number, number]))), "Catamin chapters edited")}>
        Set clear amounts
      </Button>
    </Panel>
  );
}
