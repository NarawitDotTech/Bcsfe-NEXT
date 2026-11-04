/**
 * Port of bcsfe/cli/edits/map.py (+ the "levels" glue in core/game/map/*) as pure
 * functions. No prompts / printing: callers pass the answers the CLI would have asked
 * for and the save is mutated exactly like the Python version does.
 *
 * Shared "chapter editor" flow (edit_chapters in Python):
 *   - progress (clear / unclear):  set_progress_whole / set_progress_to_stage / set_progress_all
 *   - clear counts:                set_clear_counts
 * A `MapTarget` describes which chapters object / letter code / base index a feature edits.
 */
import type { SaveFile } from "@/lib/bcsfe/core/io/save";
import { core_data } from "@/lib/bcsfe/core/core_data";
import { MapNames } from "@/lib/bcsfe/core/game/map/map_names";
import { MapOption } from "@/lib/bcsfe/core/game/map/map_option";
import { EventChapters } from "@/lib/bcsfe/core/game/map/event";
import { Chapters } from "@/lib/bcsfe/core/game/map/chapters";
import { GauntletChapters } from "@/lib/bcsfe/core/game/map/gauntlets";
import { LegendQuestChapters } from "@/lib/bcsfe/core/game/map/legend_quest";
import { ZeroLegendsChapters } from "@/lib/bcsfe/core/game/map/zero_legends";
import {
  StageNames,
  StoryChapters,
  TreasureGroupData,
  TreasureGroupNames,
  TreasureText,
} from "@/lib/bcsfe/core/game/map/story";
import { UncannyChapters } from "@/lib/bcsfe/core/game/map/uncanny";
import { AkuChapters } from "@/lib/bcsfe/core/game/map/aku";
import { ConfigKey } from "@/lib/bcsfe/core/io/config";

function disable_maxes(): boolean {
  try {
    return core_data.config.get_bool(ConfigKey.DISABLE_MAXES);
  } catch {
    return false;
  }
}

export type ChaptersType =
  | EventChapters
  | GauntletChapters
  | LegendQuestChapters
  | ZeroLegendsChapters
  | Chapters;

/* ------------------------------------------------------------------ */
/* targets                                                             */
/* ------------------------------------------------------------------ */

export type MapTargetKey =
  | "sol"
  | "event"
  | "collab"
  | "gauntlets"
  | "collab_gauntlets"
  | "behemoth_culling"
  | "enigma_clears"
  | "uncanny"
  | "catamin_stages"
  | "legend_quest"
  | "towers"
  | "zero_legends"
  | "dojo_catclaw_championships";

export class MapTarget {
  constructor(
    public readonly save: SaveFile,
    public readonly chapters: ChaptersType,
    public readonly letter_code: string,
    public readonly base_index: number,
    public readonly type: number | null = null,
    public readonly no_r_prefix = false,
  ) {}

  /** Python get_total_maps */
  total_maps(): number {
    if (this.chapters instanceof EventChapters) return this.chapters.get_lengths()[1];
    return this.chapters.chapters.length;
  }

  /** Python get_max_stars */
  max_stars(id: number): number {
    if (this.chapters instanceof EventChapters) return this.chapters.get_total_stars(this.type ?? 0, id);
    return this.chapters.get_total_stars(id);
  }

  /** Python get_total_stars: capped by the MapOption crown count when known. */
  total_stars(map_option: MapOption | null, id: number): number {
    const max_stars = this.max_stars(id);
    const mo = map_option?.get_map(this.base_index + id) ?? null;
    if (mo !== null) return Math.min(max_stars, mo.crown_count);
    return max_stars;
  }

  total_stages(id: number, star: number): number {
    if (this.chapters instanceof EventChapters) return this.chapters.get_total_stages(this.type ?? 0, id, star);
    return this.chapters.get_total_stages(id, star);
  }

  /** Python clear_stage (note: EventChapters ignores ensure_cleared_only, as in Python). */
  clear_stage(
    map: number,
    star: number,
    stage: number,
    clear_amount = 1,
    overwrite_clear_progress = false,
    ensure_cleared_only = false,
  ): boolean {
    if (this.chapters instanceof EventChapters) {
      return this.chapters.clear_stage(this.type ?? 0, map, star, stage, clear_amount, overwrite_clear_progress);
    }
    return this.chapters.clear_stage(map, star, stage, clear_amount, overwrite_clear_progress, ensure_cleared_only);
  }

  unclear_stage(map: number, star: number, stage: number): boolean {
    if (this.chapters instanceof EventChapters) return this.chapters.unclear_stage(this.type ?? 0, map, star, stage);
    return this.chapters.unclear_stage(map, star, stage);
  }

  unclear_rest(stages: number[], stars: number, id: number): void {
    if (this.chapters instanceof EventChapters) this.chapters.unclear_rest(stages, stars, id, this.type ?? 0);
    else this.chapters.unclear_rest(stages, stars, id);
  }

  map_names(): MapNames {
    return new MapNames(this.save, this.letter_code, this.base_index, true, this.no_r_prefix);
  }
}

/** Letter code / base index / chapters object for each chapter-editor feature (Python call sites). */
export function get_map_target(save: SaveFile, key: MapTargetKey): MapTarget {
  switch (key) {
    case "sol":
      return new MapTarget(save, save.event_stages, "N", 0, 0);
    case "event":
      return new MapTarget(save, save.event_stages, "S", 1000, 1);
    case "collab":
      return new MapTarget(save, save.event_stages, "C", 2000, 2);
    case "gauntlets":
      return new MapTarget(save, save.gauntlets, "A", 24000);
    case "collab_gauntlets":
      return new MapTarget(save, save.collab_gauntlets, "CA", 27000);
    case "behemoth_culling":
      return new MapTarget(save, save.behemoth_culling, "Q", 31000);
    case "enigma_clears":
      return new MapTarget(save, save.enigma_clears, "H", 25000);
    case "uncanny":
      return new MapTarget(save, save.uncanny.chapters, "NA", 13000);
    case "catamin_stages":
      return new MapTarget(save, save.catamin_stages.chapters, "B", 14000);
    case "legend_quest":
      return new MapTarget(save, save.legend_quest, "D", 16000);
    case "towers":
      return new MapTarget(save, save.tower.chapters, "V", 7000);
    case "zero_legends":
      return new MapTarget(save, save.zero_legends, "ND", 34000);
    case "dojo_catclaw_championships":
      return new MapTarget(save, save.dojo_chapters, "G", 37000, null, true);
  }
}

/* ------------------------------------------------------------------ */
/* listing                                                             */
/* ------------------------------------------------------------------ */

export type MapEntry = { id: number; name: string | null };

/** Python select_maps: maps with a name (in id order) that exist in the save. */
export function list_maps(target: MapTarget): MapEntry[] {
  const total = target.total_maps();
  const out: MapEntry[] = [];
  for (const [id, name] of target.map_names().map_names) {
    if (id >= total) continue;
    out.push({ id, name });
  }
  return out.sort((a, b) => a.id - b.id);
}

export type MapStarEntry = { map: number; star: number; name: string | null };

/** Python select_maps_stars: one entry per (map, crown). */
export function list_map_stars(target: MapTarget, map_option: MapOption | null): MapStarEntry[] {
  const total = target.total_maps();
  const out: MapStarEntry[] = [];
  const entries = [...target.map_names().map_names.entries()].sort((a, b) => a[0] - b[0]);
  for (const [id, name] of entries) {
    if (id >= total) continue;
    const stars = target.total_stars(map_option, id);
    for (let star = 0; star < stars; star++) out.push({ map: id, star, name });
  }
  return out;
}

/** Python EventChapters.get_stage_names: stage names for a chapter without "＠" placeholders. */
export function get_stage_names(names: MapNames, id: number): string[] {
  return EventChapters.get_stage_names(names, id) ?? [];
}

/** Stage names used by "clear up to a specific stage" (empty names and "＠" removed). */
export function get_progress_stage_names(names: MapNames, id: number): string[] {
  const list = names.stage_names.get(id) ?? [];
  return list.filter((s) => !!s && s !== "＠");
}

export function load_map_option(save: SaveFile): MapOption | null {
  return MapOption.from_save(save);
}

/* ------------------------------------------------------------------ */
/* progress (edit_chapters2_progress)                                  */
/* ------------------------------------------------------------------ */

/**
 * Python clear_whole_chapter_unclear: clear `stars` crowns of the whole map (stars may be 0
 * to unclear everything when allow_unclear). Stars above `stars` are unset first.
 */
export function set_progress_whole(target: MapTarget, id: number, stars: number): void {
  target.unclear_rest([0], Math.max(stars - 1, 0), id);
  for (let star = 0; star < stars; star++) {
    const total_stages = target.total_stages(id, star);
    for (let stage = 0; stage < total_stages; stage++) {
      target.clear_stage(id, star, stage, 1, false, true);
    }
  }
}

/** Python "clear all selected chapters at once". `stars` is clamped to each map's real crown count. */
export function set_progress_all(target: MapTarget, ids: number[], stars: number): void {
  for (const id of ids) {
    set_progress_whole(target, id, Math.min(stars, target.max_stars(id)));
  }
}

/**
 * Python clear_specific_stage_unclear: clear crown 1..stars-1 completely and, for the last crown,
 * stages 0..stage_id. `stage_id` is the index into get_progress_stage_names.
 * (Python with stars == 0 would index crown -1; here it only unclears.)
 */
export function set_progress_to_stage(target: MapTarget, id: number, stage_id: number, stars: number): void {
  const stage_ids: number[] = [];
  for (let i = 0; i < stage_id; i++) stage_ids.push(i);
  target.unclear_rest(stage_ids, Math.max(stars - 1, 0), id);
  for (let star = 0; star < stars - 1; star++) {
    const total_stages = target.total_stages(id, star);
    for (let stage = 0; stage < total_stages; stage++) {
      target.clear_stage(id, star, stage, 1, false, true);
    }
  }
  if (stars < 1) return;
  for (let stage = 0; stage <= stage_id; stage++) {
    target.clear_stage(id, stars - 1, stage, 1, false, true);
  }
}

/** The "max_stars" the CLI offers for a set of maps (Python get_max_max_stars). */
export function get_max_max_stars(target: MapTarget, map_option: MapOption | null, ids: number[]): number {
  let m = 0;
  for (const id of ids) m = Math.max(m, target.total_stars(map_option, id));
  return m;
}

/* ------------------------------------------------------------------ */
/* clear counts (edit_chapters2_clear_count)                           */
/* ------------------------------------------------------------------ */

export type ClearCountItem = {
  map: number;
  star: number;
  amount: number;
  /** Stage indexes to set; omitted = every stage of the crown. */
  stages?: number[];
};

/** Python edit_chapters2_clear_count: every stage gets clear_stage(amount) (overwrites progress state). */
export function set_clear_counts(target: MapTarget, items: ClearCountItem[]): void {
  for (const item of items) {
    const stages = item.stages ?? Array.from({ length: target.total_stages(item.map, item.star) }, (_, i) => i);
    for (const stage of stages) target.clear_stage(item.map, item.star, stage, item.amount);
  }
}

export function max_clear_count(): number {
  return disable_maxes() ? 32767 : Math.min(core_data.max_value_manager.stage_clear_count, 32767);
}

/* ------------------------------------------------------------------ */
/* story (StoryChapters.edit_chapters & friends)                       */
/* ------------------------------------------------------------------ */

export function story_chapter_names(save: SaveFile, chapter_ids?: number[]): string[] {
  return StoryChapters.get_chapter_names(save, chapter_ids ?? null) ?? [];
}

/** Stage names in display order (index i = convert_stage_id(i)), 48 entries. */
export function story_stage_names(save: SaveFile, chapter_id: number): string[] {
  const type = StoryChapters.get_chapter_type_from_index(chapter_id);
  const names = new StageNames(save, String(type)).stage_names;
  const out: string[] = [];
  for (let i = 0; i < 48; i++) {
    const real = StoryChapters.convert_stage_id(i);
    out.push(names?.[real] ?? `Stage ${i + 1}`);
  }
  return out;
}

export type StoryChapterPlan = {
  chapter_id: number;
  /** Display-order stage indexes (0..47). */
  stages: number[];
  /** Clear amount applied to all stages, or per stage. */
  clear_amount: number | ((stage: number) => number);
  unclear_other_stages: boolean;
};

/** Python `could_unclear_stages` check for the "unclear other stages?" question. */
export function story_could_unclear(save: SaveFile, chapter_id: number, stages: number[]): boolean {
  if (stages.length === 0) return false;
  const chapter = save.story.get_real_chapters()[chapter_id];
  const mx = Math.max(...stages);
  if (chapter.progress > mx + 1) return true;
  for (let stage = mx + 1; stage < 48; stage++) {
    if (chapter.stages[stage].clear_times) return true;
  }
  return false;
}

export function edit_story_chapters(save: SaveFile, plans: StoryChapterPlan[]): void {
  for (const plan of plans) {
    const amount = plan.clear_amount;
    save.story.edit_chapters(
      [plan.chapter_id],
      () => plan.stages,
      (_c, s) => (typeof amount === "number" ? amount : amount(s)),
      plan.unclear_other_stages,
    );
  }
}

/** Python StoryChapters.clear_story with defaults: every stage of the chosen chapters. */
export function clear_story(save: SaveFile, chapter_ids: number[]): void {
  StoryChapters.clear_story(save, chapter_ids);
}

/* treasures */

export type TreasureLevelOption = { value: number; label: string };

/** Python ask_treasure_level options (0 = none, 1..3 from Treasure2 text). */
export function treasure_level_options(save: SaveFile): TreasureLevelOption[] {
  const text = new TreasureText(save).treasure_text ?? [];
  const opts: TreasureLevelOption[] = [{ value: 0, label: "No Treasure" }];
  for (let i = 0; i < 3; i++) opts.push({ value: i + 1, label: text[i] ?? `Level ${i + 1}` });
  return opts;
}

export function max_treasure_level(): number {
  return disable_maxes() ? 2 ** 31 - 1 : Math.min(core_data.max_value_manager.treasure_level, 2 ** 31 - 1);
}

export function max_itf_timed_score(): number {
  return disable_maxes() ? 2 ** 31 - 1 : Math.min(core_data.max_value_manager.itf_timed_score, 2 ** 31 - 1);
}

export function treasure_groups(save: SaveFile, chapter_id: number): { id: number; name: string }[] | null {
  const type = StoryChapters.get_chapter_type_from_index(chapter_id);
  const data = new TreasureGroupData(save, type).treasure_group_data;
  const names = new TreasureGroupNames(save, type).treasure_group_names;
  if (data === null || names === null) return null;
  return data.map((_, i) => ({ id: i, name: names[i] ?? `Group ${i + 1}` }));
}

export function edit_treasures_whole_chapters(
  save: SaveFile,
  levels: Map<number, number> | { chapters: number[]; level: number },
): void {
  if (levels instanceof Map) {
    for (const [chapter_id, level] of levels) StoryChapters.edit_treasures_whole_chapters(save, [chapter_id], level);
  } else {
    StoryChapters.edit_treasures_whole_chapters(save, levels.chapters, levels.level);
  }
}

export function edit_treasures_individual_stages(
  save: SaveFile,
  chapters: number[],
  stage_ids: number[],
  level: number,
): void {
  StoryChapters.edit_treasures_individual_stages(save, chapters, stage_ids, level);
}

/** Set a treasure level for the stages of the given treasure groups of one chapter. */
export function edit_treasure_groups(
  save: SaveFile,
  chapter_id: number,
  group_levels: Map<number, number>,
): boolean {
  const type = StoryChapters.get_chapter_type_from_index(chapter_id);
  const data = new TreasureGroupData(save, type).treasure_group_data;
  if (data === null) return false;
  const chapter = save.story.get_real_chapters()[chapter_id];
  StoryChapters.edit_treasure_group_ind(data, chapter, group_levels);
  return true;
}

/** ITF timed scores: whole chapters, or specific display-order stage ids (raw, as in Python). */
export function edit_itf_timed_scores(
  save: SaveFile,
  real_chapters: number[],
  min_score: number,
  max_score: number,
  stage_ids: number[] | null,
): void {
  const mx = max_itf_timed_score();
  const lo = Math.max(0, Math.min(min_score, max_score, mx));
  const hi = Math.max(0, Math.min(Math.max(min_score, max_score), mx));
  StoryChapters.edit_itf_timed_scores(save, real_chapters, [lo, hi + 1], stage_ids);
}

/* ------------------------------------------------------------------ */
/* outbreaks                                                           */
/* ------------------------------------------------------------------ */

export type OutbreakChapterInfo = { true_id: number; stage_ids: number[] };

export function list_outbreak_chapters(save: SaveFile): OutbreakChapterInfo[] {
  return [...save.outbreaks.chapters.values()]
    .map((c) => ({ true_id: c.get_true_id(), stage_ids: [...c.outbreaks.keys()].sort((a, b) => a - b) }))
    .sort((a, b) => a.true_id - b.true_id);
}

export function edit_outbreaks(save: SaveFile, selection: Map<number, number[]>, clear: boolean): void {
  save.outbreaks.edit_outbreaks(selection, clear);
}

/* ------------------------------------------------------------------ */
/* aku realm chapters                                                  */
/* ------------------------------------------------------------------ */

export function aku_stage_count(save: SaveFile): number {
  return save.aku.chapters[0]?.chapters[0]?.stages.length ?? 0;
}

export function aku_stage_names(save: SaveFile): string[] {
  return new StageNames(save, "DM", 49).stage_names ?? [];
}

export function aku_clear_counts(save: SaveFile): number[] {
  return (save.aku.chapters[0]?.chapters[0]?.stages ?? []).map((s) => s.clear_times);
}

export function edit_aku_chapters(save: SaveFile, progress: number, clear_counts: number | number[]): void {
  AkuChapters.edit_aku_chapters(save, progress, clear_counts);
}

/* ------------------------------------------------------------------ */
/* catamin                                                             */
/* ------------------------------------------------------------------ */

export function list_catamin_maps(save: SaveFile): MapEntry[] {
  const names = new MapNames(save, "B", 14000, true, false).map_names;
  return [...names.entries()].sort((a, b) => a[0] - b[0]).map(([id, name]) => ({ id, name }));
}

/** Python change_clear_amount_catamin (same amount for all maps, or per-map amounts). */
export function set_catamin_clear_amounts(save: SaveFile, amounts: Map<number, number>): void {
  for (const [map_id, amount] of amounts) {
    UncannyChapters.catamin_clear_count_individual(save, [map_id], amount);
  }
}

export function get_catamin_clear_amount(save: SaveFile, map_id: number): number {
  return save.event_stages.chapter_completion_count.get(14_000 + map_id) ?? 0;
}

/* ------------------------------------------------------------------ */
/* misc                                                                */
/* ------------------------------------------------------------------ */

/** BasicItems.allow_filibuster_stage_reclearing */
export function allow_filibuster_stage_reclearing(save: SaveFile): void {
  save.filibuster_stage_enabled = true;
  save.filibuster_stage_id = Math.floor(Math.random() * 48);
}

/** Python edit_score; the (0,0,0) stage clear is skipped when the save has no challenge chapters yet. */
export function edit_challenge_score(save: SaveFile, score: number): void {
  const ch = save.challenge;
  if (ch.chapters.chapters.length > 0 && ch.chapters.chapters[0].chapters.length > 0
    && ch.chapters.chapters[0].chapters[0].stages.length > 0) {
    ch.edit_score(score);
  } else {
    if (ch.scores.length === 0) ch.scores = [0];
    ch.scores[0] = score;
    ch.shown_popup = true;
  }
}

export function edit_dojo_score(save: SaveFile, score: number): void {
  save.dojo.edit_score(score);
}

/** Maps (base 25000) for enigma add: id -> name. */
export function list_enigma_names(save: SaveFile): MapEntry[] {
  const names = new MapNames(save, "H", 25000, true, false).map_names;
  return [...names.entries()].sort((a, b) => a[0] - b[0]).map(([id, name]) => ({ id, name }));
}

export function current_enigma_stages(save: SaveFile): { id: number; stage_id: number }[] {
  return save.enigma.stages.map((s) => ({ id: s.stage_id - 25000, stage_id: s.stage_id }));
}

export function add_enigma_stages(save: SaveFile, enigma_ids: number[], wipe: boolean): void {
  save.enigma.edit_enigma(save, enigma_ids, wipe);
}

export { clear_tutorial } from "@/lib/bcsfe/edits/clear_tutorial";
export { unlock_aku_realm } from "@/lib/bcsfe/edits/aku_realm";
