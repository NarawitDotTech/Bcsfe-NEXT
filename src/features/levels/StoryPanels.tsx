"use client";
/** Main story chapters, story treasures, ITF timed scores and outbreaks. */
import { useMemo, useState } from "react";
import { useSave } from "@/components/editor/SaveContext";
import {
  Button, Checkbox, Field, MultiSelect, Notice, NumberField, Panel, Segmented, Select, TextInput, type SelectItem,
} from "@/components/ui/primitives";
import {
  edit_itf_timed_scores, edit_outbreaks, edit_story_chapters, edit_treasure_groups, edit_treasures_individual_stages,
  edit_treasures_whole_chapters, list_outbreak_chapters, max_clear_count, max_itf_timed_score, max_treasure_level,
  story_chapter_names, story_could_unclear, story_stage_names, treasure_groups, treasure_level_options,
  type StoryChapterPlan,
} from "@/lib/bcsfe/edits/map";

const sortIds = (s: Set<number>) => [...s].sort((a, b) => a - b);

function chapterItems(names: string[], ids?: number[]): SelectItem<number>[] {
  return names.map((label, i) => ({ id: ids ? ids[i] : i, label }));
}

/* ------------------------------------------------------------------ */
/* clear_story                                                         */
/* ------------------------------------------------------------------ */

export function ClearStoryPanel() {
  const { save, commit, notify } = useSave();
  const names = useMemo(() => story_chapter_names(save), [save]);
  const items = useMemo(() => chapterItems(names), [names]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [clearType, setClearType] = useState<"whole" | "specific">("whole");
  const [modify, setModify] = useState(false);
  const [amountMode, setAmountMode] = useState<"chapter" | "all" | "stage">("all");
  const [allAmount, setAllAmount] = useState(1);
  const [upTo, setUpTo] = useState<Record<number, number>>({});
  const [chAmount, setChAmount] = useState<Record<number, number>>({});
  const [stageAmount, setStageAmount] = useState<Record<number, Record<number, number>>>({});
  const [unclearOther, setUnclearOther] = useState<Record<number, boolean>>({});
  const max = max_clear_count();

  const ids = sortIds(selected);
  const mode = !modify ? "none" : ids.length === 1 ? "chapter" : amountMode === "stage" && clearType !== "specific" ? "all" : amountMode;
  const stagesOf = (id: number) => (clearType === "whole" ? Array.from({ length: 48 }, (_, i) => i) : Array.from({ length: (upTo[id] ?? 47) + 1 }, (_, i) => i));

  const apply = () => {
    if (ids.length === 0) return notify("Select at least one chapter.", "warning");
    const plans: StoryChapterPlan[] = ids.map((id) => ({
      chapter_id: id,
      stages: stagesOf(id),
      clear_amount:
        mode === "none" ? 1
          : mode === "all" ? allAmount
            : mode === "chapter" ? (chAmount[id] ?? 1)
              : (s: number) => stageAmount[id]?.[s] ?? 1,
      unclear_other_stages: !!unclearOther[id] && story_could_unclear(save, id, stagesOf(id)),
    }));
    commit((s) => edit_story_chapters(s, plans), `Edited ${ids.length} story chapter${ids.length === 1 ? "" : "s"}`);
  };

  if (names.length === 0) return <Panel title="Main Story Chapters"><Notice tone="warning">Chapter names are not available; download game data first.</Notice></Panel>;

  return (
    <Panel title="Main Story Chapters" description="Clear whole chapters or up to a specific stage, optionally setting how many times each stage was cleared.">
      <MultiSelect items={items} selected={selected} onChange={setSelected} showIds={false} height={260} />
      <Segmented value={clearType} onChange={setClearType} options={[
        { value: "whole", label: "Clear whole chapters" },
        { value: "specific", label: "Clear up to a stage" },
      ]} />
      <Checkbox label="Set clear counts" checked={modify} onChange={setModify} hint="Otherwise every cleared stage gets a clear count of 1." />
      {modify && ids.length > 1 && (
        <Segmented value={amountMode} onChange={setAmountMode} options={[
          { value: "all", label: "Same for all chapters" },
          { value: "chapter", label: "Per chapter" },
          ...(clearType === "specific" ? [{ value: "stage" as const, label: "Per stage" }] : []),
        ]} />
      )}
      {modify && mode === "all" && ids.length > 0 && <NumberField label="Clear count" value={allAmount} max={max} onChange={setAllAmount} />}
      {ids.length > 0 && (
        <ul className="space-y-3">
          {ids.map((id) => {
            const stageNames = story_stage_names(save, id);
            const stages = stagesOf(id);
            const couldUnclear = story_could_unclear(save, id, stages);
            return (
              <li key={id} className="space-y-3 rounded-lg border border-border p-3">
                <div className="text-sm font-medium">{names[id]}</div>
                {clearType === "specific" && (
                  <Field label="Clear up to and including">
                    {(fid) => (
                      <Select id={fid} value={upTo[id] ?? 47} onChange={(e) => setUpTo({ ...upTo, [id]: Number(e.target.value) })}>
                        {stageNames.map((n, i) => <option key={i} value={i}>{i + 1}. {n}</option>)}
                      </Select>
                    )}
                  </Field>
                )}
                {modify && mode === "chapter" && (
                  <NumberField label="Clear count" value={chAmount[id] ?? 1} max={max} onChange={(v) => setChAmount({ ...chAmount, [id]: v })} />
                )}
                {modify && mode === "stage" && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {stages.map((st) => (
                      <NumberField key={st} label={`${st + 1}. ${stageNames[st]}`} value={stageAmount[id]?.[st] ?? 1} max={max}
                        onChange={(v) => setStageAmount({ ...stageAmount, [id]: { ...stageAmount[id], [st]: v } })} />
                    ))}
                  </div>
                )}
                {couldUnclear && (
                  <Checkbox label="Unclear other stages" checked={!!unclearOther[id]}
                    onChange={(v) => setUnclearOther({ ...unclearOther, [id]: v })}
                    hint="This chapter has progress beyond the chosen stage; also reset it." />
                )}
              </li>
            );
          })}
        </ul>
      )}
      <Button variant="primary" onClick={apply} disabled={ids.length === 0}>Clear selected chapters</Button>
    </Panel>
  );
}

/* ------------------------------------------------------------------ */
/* treasure level picker                                               */
/* ------------------------------------------------------------------ */

function TreasureLevelPicker({ value, onChange, label = "Treasure level" }: { value: number; onChange: (v: number) => void; label?: string }) {
  const { save } = useSave();
  const options = useMemo(() => treasure_level_options(save), [save]);
  const preset = options.some((o) => o.value === value);
  const [custom, setCustom] = useState(!preset);
  return (
    <div className="space-y-2">
      <Field label={label}>
        {(id) => (
          <Select id={id} value={custom ? "custom" : value} onChange={(e) => {
            if (e.target.value === "custom") setCustom(true);
            else { setCustom(false); onChange(Number(e.target.value)); }
          }}>
            {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            <option value="custom">Custom level</option>
          </Select>
        )}
      </Field>
      {custom && <NumberField label="Custom treasure level" value={value} max={max_treasure_level()}
        hint="Only change this if you know what you are doing." onChange={onChange} />}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* story_treasures                                                     */
/* ------------------------------------------------------------------ */

type TreasureMode = "whole" | "individual" | "groups";

export function StoryTreasuresPanel() {
  const { save } = useSave();
  const names = useMemo(() => story_chapter_names(save), [save]);
  const items = useMemo(() => chapterItems(names), [names]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [mode, setMode] = useState<TreasureMode>("whole");
  const ids = sortIds(selected);

  if (names.length === 0) return <Panel title="Story Treasures"><Notice tone="warning">Chapter names are not available; download game data first.</Notice></Panel>;

  return (
    <Panel title="Story Treasures" description="Set treasure levels for whole chapters, individual stages or treasure groups.">
      <MultiSelect items={items} selected={selected} onChange={setSelected} showIds={false} height={260} />
      <Segmented value={mode} onChange={setMode} options={[
        { value: "whole", label: "Whole chapters" },
        { value: "individual", label: "Individual stages" },
        { value: "groups", label: "Treasure groups" },
      ]} />
      {ids.length > 0 && mode === "whole" && <TreasureWhole ids={ids} names={names} />}
      {ids.length > 0 && mode === "individual" && <TreasureIndividual ids={ids} names={names} />}
      {ids.length > 0 && mode === "groups" && ids.map((id) => <TreasureGroupsCard key={id} id={id} name={names[id]} />)}
    </Panel>
  );
}

function TreasureWhole({ ids, names }: { ids: number[]; names: string[] }) {
  const { commit } = useSave();
  const [perChapter, setPerChapter] = useState(false);
  const [all, setAll] = useState(3);
  const [per, setPer] = useState<Record<number, number>>({});
  const apply = () => commit((s) => edit_treasures_whole_chapters(
    s, perChapter && ids.length > 1 ? new Map(ids.map((id) => [id, per[id] ?? 0] as [number, number])) : { chapters: ids, level: all }),
  "Treasures edited");
  return (
    <div className="space-y-3">
      {ids.length > 1 && (
        <Segmented value={perChapter ? "per" : "all"} onChange={(v) => setPerChapter(v === "per")} options={[
          { value: "all", label: "Same for all selected" }, { value: "per", label: "Per chapter" },
        ]} />
      )}
      {perChapter && ids.length > 1
        ? ids.map((id) => <TreasureLevelPicker key={id} label={names[id]} value={per[id] ?? 0} onChange={(v) => setPer({ ...per, [id]: v })} />)
        : <TreasureLevelPicker value={all} onChange={setAll} />}
      <Button variant="primary" onClick={apply}>Set treasures</Button>
    </div>
  );
}

function TreasureIndividual({ ids, names }: { ids: number[]; names: string[] }) {
  const { save, commit, notify } = useSave();
  const [perChapter, setPerChapter] = useState(false);
  const [sel, setSel] = useState<Record<number, Set<number>>>({});
  const [lvl, setLvl] = useState<Record<number, number>>({});
  const useSeparate = perChapter && ids.length > 1;
  const keys = useSeparate ? ids : [ids[0]];
  const apply = () => {
    let any = false;
    commit((s) => {
      for (const k of keys) {
        const stages = sortIds(sel[k] ?? new Set());
        if (stages.length === 0) continue;
        any = true;
        edit_treasures_individual_stages(s, useSeparate ? [k] : ids, stages, lvl[k] ?? 0);
      }
    }, "Treasures edited");
    if (!any) notify("Select at least one stage.", "warning");
  };
  return (
    <div className="space-y-3">
      {ids.length > 1 && (
        <Segmented value={perChapter ? "per" : "all"} onChange={(v) => setPerChapter(v === "per")} options={[
          { value: "all", label: "Same stages and level for all" }, { value: "per", label: "Per chapter" },
        ]} />
      )}
      {keys.map((k) => {
        const stageItems = story_stage_names(save, k).map((n, i) => ({ id: i, label: n }));
        return (
          <div key={k} className="space-y-3 rounded-lg border border-border p-3">
            {useSeparate && <div className="text-sm font-medium">{names[k]}</div>}
            <MultiSelect items={stageItems} selected={sel[k] ?? new Set()} onChange={(v) => setSel({ ...sel, [k]: v })} height={220} />
            <TreasureLevelPicker value={lvl[k] ?? 0} onChange={(v) => setLvl({ ...lvl, [k]: v })} />
          </div>
        );
      })}
      <Button variant="primary" onClick={apply}>Set treasures</Button>
    </div>
  );
}

function TreasureGroupsCard({ id, name }: { id: number; name: string }) {
  const { save, commit, notify } = useSave();
  const groups = useMemo(() => treasure_groups(save, id), [save, id]);
  const [sel, setSel] = useState<Set<number>>(new Set());
  const [each, setEach] = useState(false);
  const [all, setAll] = useState(3);
  const [per, setPer] = useState<Record<number, number>>({});
  if (!groups) return <Notice tone="warning">Treasure group data is not available for {name}.</Notice>;
  const chosen = sortIds(sel);
  const apply = () => {
    if (chosen.length === 0) return notify("Select at least one treasure group.", "warning");
    commit((s) => edit_treasure_groups(s, id, new Map(chosen.map((g) => [g, each ? (per[g] ?? 0) : all] as [number, number]))),
      `Edited treasure groups of ${name}`);
  };
  return (
    <div className="space-y-3 rounded-lg border border-border p-3">
      <div className="text-sm font-medium">{name}</div>
      <MultiSelect items={groups.map((g) => ({ id: g.id, label: g.name }))} selected={sel} onChange={setSel} height={200} />
      {chosen.length > 1 && (
        <Segmented value={each ? "each" : "all"} onChange={(v) => setEach(v === "each")} options={[
          { value: "all", label: "Same level for all groups" }, { value: "each", label: "Level per group" },
        ]} />
      )}
      {each && chosen.length > 1
        ? chosen.map((g) => <TreasureLevelPicker key={g} label={groups[g]?.name} value={per[g] ?? 0} onChange={(v) => setPer({ ...per, [g]: v })} />)
        : <TreasureLevelPicker value={all} onChange={setAll} />}
      <Button variant="primary" onClick={apply}>Set treasure groups</Button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* itf_timed_scores                                                    */
/* ------------------------------------------------------------------ */

function parseScore(text: string): [number, number] | null {
  const m = text.trim().match(/^(\d+)(?:\s*-\s*(\d+))?$/);
  if (!m) return null;
  const a = parseInt(m[1], 10);
  const b = m[2] !== undefined ? parseInt(m[2], 10) : a;
  return [a, b];
}

const real = [3, 4, 5];

export function ItfTimedScoresPanel() {
  const { save, commit, notify } = useSave();
  const names = useMemo(() => story_chapter_names(save, real), [save]);
  const items = names.map((label, i) => ({ id: real[i], label }));
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [scope, setScope] = useState<"whole" | "stages">("whole");
  const [scoreMode, setScoreMode] = useState<"shared" | "separate">("shared");
  const [shared, setShared] = useState("0");
  const [per, setPer] = useState<Record<number, string>>({});
  const [stageSel, setStageSel] = useState<Set<number>>(new Set());
  const ids = sortIds(selected);
  const stageItems = useMemo(() => story_stage_names(save, 3).map((n, i) => ({ id: i, label: n })), [save]);
  const stageIds = sortIds(stageSel);
  const max = max_itf_timed_score();

  if (names.length === 0) return <Panel title="Into the Future Timed Scores"><Notice tone="warning">Chapter names are not available; download game data first.</Notice></Panel>;

  const apply = () => {
    if (ids.length === 0) return notify("Select at least one chapter.", "warning");
    if (scope === "stages" && stageIds.length === 0) return notify("Select at least one stage.", "warning");
    const slots = scope === "whole"
      ? (scoreMode === "separate" ? ids.map((id) => ({ chapters: [id], stages: null as number[] | null, text: per[id] ?? "0" }))
        : [{ chapters: ids, stages: null as number[] | null, text: shared }])
      : (scoreMode === "separate" ? stageIds.map((st) => ({ chapters: ids, stages: [st] as number[] | null, text: per[st] ?? "0" }))
        : [{ chapters: ids, stages: stageIds as number[] | null, text: shared }]);
    const parsed = slots.map((sl) => ({ ...sl, range: parseScore(sl.text) }));
    if (parsed.some((p) => p.range === null)) return notify("Scores must look like 120 or 100-300.", "danger");
    commit((s) => {
      for (const p of parsed) edit_itf_timed_scores(s, p.chapters, p.range![0], p.range![1], p.stages);
    }, "Timed scores edited");
  };

  const separate = scoreMode === "separate";
  const sepKeys = scope === "whole" ? ids : stageIds;
  return (
    <Panel title="Into the Future Timed Scores" description="Scores are picked randomly inside the range you enter (use a single number for an exact score).">
      <MultiSelect items={items} selected={selected} onChange={setSelected} showIds={false} height={160} />
      <Segmented value={scope} onChange={setScope} options={[
        { value: "whole", label: "Whole chapters" }, { value: "stages", label: "Individual stages" },
      ]} />
      {scope === "stages" && <MultiSelect items={stageItems} selected={stageSel} onChange={setStageSel} height={220} />}
      <Segmented value={scoreMode} onChange={setScoreMode} options={[
        { value: "shared", label: "One score for everything" },
        { value: "separate", label: scope === "whole" ? "Score per chapter" : "Score per stage" },
      ]} />
      {!separate && (
        <Field label="Score or range" hint={`e.g. 120 or 100-300 (max ${max.toLocaleString()})`}>
          {(id) => <TextInput id={id} value={shared} onChange={(e) => setShared(e.target.value)} />}
        </Field>
      )}
      {separate && sepKeys.map((k) => (
        <Field key={k} label={scope === "whole" ? names[real.indexOf(k)] : (stageItems[k]?.label ?? `Stage ${k + 1}`)} hint="e.g. 120 or 100-300">
          {(id) => <TextInput id={id} value={per[k] ?? "0"} onChange={(e) => setPer({ ...per, [k]: e.target.value })} />}
        </Field>
      ))}
      <Button variant="primary" onClick={apply} disabled={ids.length === 0}>Set timed scores</Button>
    </Panel>
  );
}

/* ------------------------------------------------------------------ */
/* outbreaks                                                           */
/* ------------------------------------------------------------------ */

export function OutbreaksPanel() {
  const { save, commit, notify } = useSave();
  const chapters = useMemo(() => list_outbreak_chapters(save), [save]);
  const trueIds = chapters.map((c) => c.true_id);
  const names = story_chapter_names(save, trueIds);
  const [clear, setClear] = useState(true);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [perChapter, setPerChapter] = useState(false);
  const [sel, setSel] = useState<Record<number, Set<number>>>({});
  const ids = sortIds(selected);
  const useSeparate = perChapter && ids.length > 1;
  const keys = useSeparate ? ids : [ids[0]];

  if (chapters.length === 0) {
    return <Panel title="Outbreaks / Zombie Stages"><Notice tone="warning">This save has no outbreak chapters.</Notice></Panel>;
  }
  const nameOf = (id: number) => names[trueIds.indexOf(id)] ?? `Chapter ${id}`;
  const stageName = (chapterId: number, stage: number) => {
    return story_stage_names(save, chapterId)[stage];
  };
  const stageItemsFor = (k: number): SelectItem<number>[] => {
    const set = useSeparate ? chapters.find((c) => c.true_id === k)?.stage_ids ?? []
      : [...new Set(ids.flatMap((i) => chapters.find((c) => c.true_id === i)?.stage_ids ?? []))].sort((a, b) => a - b);
    return set.map((st) => ({ id: st, label: `${st + 1}. ${stageName(useSeparate ? k : ids[0], st) ?? ""}` }));
  };

  const apply = () => {
    const selection = new Map<number, number[]>();
    for (const id of ids) {
      const stages = sortIds(sel[useSeparate ? id : ids[0]] ?? new Set());
      if (stages.length) selection.set(id, stages);
    }
    if (selection.size === 0) return notify("Select at least one stage.", "warning");
    commit((s) => edit_outbreaks(s, selection, clear), `${clear ? "Cleared" : "Uncleared"} outbreak stages`);
  };

  return (
    <Panel title="Outbreaks / Zombie Stages" description="Mark outbreak stages as cleared or not cleared.">
      <Segmented value={clear ? "clear" : "unclear"} onChange={(v) => setClear(v === "clear")} options={[
        { value: "clear", label: "Clear" }, { value: "unclear", label: "Unclear" },
      ]} />
      <MultiSelect items={chapters.map((c) => ({ id: c.true_id, label: nameOf(c.true_id) }))} selected={selected} onChange={setSelected} showIds={false} height={220} />
      {ids.length > 1 && (
        <Segmented value={perChapter ? "per" : "all"} onChange={(v) => setPerChapter(v === "per")} options={[
          { value: "all", label: "Same stages for all chapters" }, { value: "per", label: "Choose per chapter" },
        ]} />
      )}
      {ids.length > 0 && keys.map((k) => (
        <div key={k} className="space-y-2 rounded-lg border border-border p-3">
          {useSeparate && <div className="text-sm font-medium">{nameOf(k)}</div>}
          <MultiSelect items={stageItemsFor(k)} selected={sel[k] ?? new Set()} onChange={(v) => setSel({ ...sel, [k]: v })} showIds={false} height={220} />
        </div>
      ))}
      <Button variant="primary" onClick={apply} disabled={ids.length === 0}>{clear ? "Clear selected stages" : "Unclear selected stages"}</Button>
    </Panel>
  );
}
