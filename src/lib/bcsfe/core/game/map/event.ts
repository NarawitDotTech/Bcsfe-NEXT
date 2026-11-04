/** Port of bcsfe/core/game/map/event.py */
import type { Data } from "@/lib/bcsfe/core/io/data";
import type { GameVersion } from "@/lib/bcsfe/core/game_version";
import type { MapNames } from "@/lib/bcsfe/core/game/map/map_names";
import { mapToObject, objectToMap, times } from "@/lib/bcsfe/core/utils";

export class EventStage {
  clear_amount: number;
  constructor(clear_amount: number) {
    this.clear_amount = clear_amount;
  }

  static init(): EventStage {
    return new EventStage(0);
  }

  static read(data: Data, is_int: boolean): EventStage {
    const clear_amount = is_int ? data.read_int() : data.read_short();
    return new EventStage(clear_amount);
  }

  write(data: Data, is_int: boolean): void {
    if (is_int) data.write_int(this.clear_amount);
    else data.write_short(this.clear_amount);
  }

  serialize(): number {
    return this.clear_amount;
  }

  static deserialize(data: number): EventStage {
    return new EventStage(data);
  }

  clear_stage(clear_amount = 1, ensure_cleared_only = false): void {
    if (ensure_cleared_only) {
      this.clear_amount = this.clear_amount || clear_amount;
    } else {
      this.clear_amount = clear_amount;
    }
  }

  unclear_stage(): void {
    this.clear_amount = 0;
  }
}

export interface EventSubChapterSerialized {
  selected_stage: number;
  clear_progress: number;
  stages: number[];
  chapter_unlock_state: number;
}

export class EventSubChapter {
  selected_stage: number;
  clear_progress: number;
  stages: EventStage[];
  chapter_unlock_state: number;

  constructor(selected_stage: number, total_stages = 0) {
    this.selected_stage = selected_stage;
    this.clear_progress = 0;
    this.stages = times(total_stages, () => EventStage.init());
    this.chapter_unlock_state = 0;
  }

  clear_stage(
    index: number,
    clear_amount = 1,
    overwrite_clear_progress = false,
    ensure_cleared_only = false,
  ): boolean {
    if (overwrite_clear_progress) {
      this.clear_progress = index + 1;
    } else {
      this.clear_progress = Math.max(this.clear_progress, index + 1);
    }
    this.stages[index].clear_stage(clear_amount, ensure_cleared_only);
    this.chapter_unlock_state = 3;
    if (index === this.stages.length - 1) {
      return true;
    }
    return false;
  }

  unclear_stage(index: number): boolean {
    this.clear_progress = Math.min(this.clear_progress, index);
    this.stages[index].unclear_stage();
    return true;
  }

  clear_map(increment = true): boolean {
    this.clear_progress = this.stages.length;
    this.chapter_unlock_state = 3;
    for (const stage of this.stages) {
      let clear_amount: number;
      if (increment) {
        clear_amount = stage.clear_amount + 1;
      } else {
        clear_amount = stage.clear_amount || 1;
      }
      stage.clear_stage(clear_amount);
    }
    return true;
  }

  static init(total_stages: number): EventSubChapter {
    return new EventSubChapter(0, total_stages);
  }

  static read_selected_stage(data: Data, is_int: boolean): EventSubChapter {
    const selected_stage = is_int ? data.read_int() : data.read_byte();
    return new EventSubChapter(selected_stage);
  }

  write_selected_stage(data: Data, is_int: boolean): void {
    if (is_int) data.write_int(this.selected_stage);
    else data.write_byte(this.selected_stage);
  }

  read_clear_progress(data: Data, is_int: boolean): void {
    this.clear_progress = is_int ? data.read_int() : data.read_byte();
  }

  write_clear_progress(data: Data, is_int: boolean): void {
    if (is_int) data.write_int(this.clear_progress);
    else data.write_byte(this.clear_progress);
  }

  read_stages(data: Data, total_stages: number, is_int: boolean): void {
    this.stages = times(total_stages, () => EventStage.read(data, is_int));
  }

  write_stages(data: Data, is_int: boolean): void {
    for (const stage of this.stages) stage.write(data, is_int);
  }

  read_chapter_unlock_state(data: Data, is_int: boolean): void {
    this.chapter_unlock_state = is_int ? data.read_int() : data.read_byte();
  }

  write_chapter_unlock_state(data: Data, is_int: boolean): void {
    if (is_int) data.write_int(this.chapter_unlock_state);
    else data.write_byte(this.chapter_unlock_state);
  }

  serialize(): EventSubChapterSerialized {
    return {
      selected_stage: this.selected_stage,
      clear_progress: this.clear_progress,
      stages: this.stages.map((s) => s.serialize()),
      chapter_unlock_state: this.chapter_unlock_state,
    };
  }

  static deserialize(data: Partial<EventSubChapterSerialized>): EventSubChapter {
    const sub_chapter = new EventSubChapter(data.selected_stage ?? 0);
    sub_chapter.clear_progress = data.clear_progress ?? 0;
    sub_chapter.stages = (data.stages ?? []).map((s) => EventStage.deserialize(s));
    sub_chapter.chapter_unlock_state = data.chapter_unlock_state ?? 0;
    return sub_chapter;
  }
}

export interface EventSubChapterStarsSerialized {
  chapters: EventSubChapterSerialized[];
  legend_restriction: number;
}

export class EventSubChapterStars {
  chapters: EventSubChapter[];
  legend_restriction: number;

  constructor(chapters: EventSubChapter[]) {
    this.chapters = chapters;
    this.legend_restriction = 0;
  }

  clear_stage(
    star: number,
    stage: number,
    clear_amount = 1,
    overwrite_clear_progress = false,
    ensure_cleared_only = false,
  ): boolean {
    const finished = this.chapters[star].clear_stage(
      stage,
      clear_amount,
      overwrite_clear_progress,
      ensure_cleared_only,
    );
    if (finished) {
      if (star + 1 < this.chapters.length) {
        this.chapters[star + 1].chapter_unlock_state = 1;
      }
    }
    return finished;
  }

  unclear_stage(star: number, stage: number): boolean {
    const finished = this.chapters[star].unclear_stage(stage);
    if (finished && star + 1 < this.chapters.length) {
      for (const chapter of this.chapters.slice(star + 1)) {
        chapter.chapter_unlock_state = 0;
      }
    }
    return finished;
  }

  clear_map(star: number, increment = true): boolean {
    const finished = this.chapters[star].clear_map(increment);
    if (finished) {
      if (star + 1 < this.chapters.length) {
        this.chapters[star + 1].chapter_unlock_state = 1;
      }
    }
    return finished;
  }

  clear_chapter(increment = true): boolean {
    for (const chapter of this.chapters) chapter.clear_map(increment);
    return true;
  }

  static init(total_stars: number): EventSubChapterStars {
    return new EventSubChapterStars(times(total_stars, () => EventSubChapter.init(0)));
  }

  static read_selected_stage(data: Data, total_stars: number, is_int: boolean): EventSubChapterStars {
    const chapters = times(total_stars, () => EventSubChapter.read_selected_stage(data, is_int));
    return new EventSubChapterStars(chapters);
  }

  write_selected_stage(data: Data, is_int: boolean): void {
    for (const chapter of this.chapters) chapter.write_selected_stage(data, is_int);
  }

  read_clear_progress(data: Data, is_int: boolean): void {
    for (const chapter of this.chapters) chapter.read_clear_progress(data, is_int);
  }

  write_clear_progress(data: Data, is_int: boolean): void {
    for (const chapter of this.chapters) chapter.write_clear_progress(data, is_int);
  }

  read_stages(data: Data, total_stages: number, is_int: boolean): void {
    for (let i = 0; i < total_stages; i++) {
      for (const chapter of this.chapters) {
        chapter.stages.push(EventStage.read(data, is_int));
      }
    }
  }

  write_stages(data: Data, is_int: boolean): void {
    if (this.chapters.length === 0) throw new RangeError("list index out of range");
    for (let i = 0; i < this.chapters[0].stages.length; i++) {
      for (const chapter of this.chapters) {
        chapter.stages[i].write(data, is_int);
      }
    }
  }

  read_chapter_unlock_state(data: Data, is_int: boolean): void {
    for (const chapter of this.chapters) chapter.read_chapter_unlock_state(data, is_int);
  }

  write_chapter_unlock_state(data: Data, is_int: boolean): void {
    for (const chapter of this.chapters) chapter.write_chapter_unlock_state(data, is_int);
  }

  read_legend_restrictions(data: Data): void {
    this.legend_restriction = data.read_int();
  }

  write_legend_restrictions(data: Data): void {
    data.write_int(this.legend_restriction);
  }

  serialize(): EventSubChapterStarsSerialized {
    return {
      chapters: this.chapters.map((c) => c.serialize()),
      legend_restriction: this.legend_restriction,
    };
  }

  static deserialize(data: Partial<EventSubChapterStarsSerialized>): EventSubChapterStars {
    const chapters = (data.chapters ?? []).map((c) => EventSubChapter.deserialize(c));
    const chapter = new EventSubChapterStars(chapters);
    chapter.legend_restriction = data.legend_restriction ?? 0;
    return chapter;
  }
}

export class EventChapterGroup {
  chapters: EventSubChapterStars[];
  constructor(chapters: EventSubChapterStars[]) {
    this.chapters = chapters;
  }

  clear_stage(
    map: number,
    star: number,
    stage: number,
    clear_amount = 1,
    overwrite_clear_progress = false,
    ensure_cleared_only = false,
  ): boolean {
    const finished = this.chapters[map].clear_stage(
      star,
      stage,
      clear_amount,
      overwrite_clear_progress,
      ensure_cleared_only,
    );
    if (finished && map + 1 < this.chapters.length) {
      this.chapters[map + 1].chapters[0].chapter_unlock_state = 1;
    }
    return finished;
  }

  unclear_stage(map: number, star: number, stage: number): boolean {
    const finished = this.chapters[map].unclear_stage(star, stage);
    if (finished && map + 1 < this.chapters.length && star === 0) {
      for (const chapter of this.chapters[map + 1].chapters) {
        chapter.chapter_unlock_state = 0;
      }
    }
    return finished;
  }

  clear_map(map: number, star: number, increment = true): void {
    const finished = this.chapters[map].clear_map(star, increment);
    if (finished && map + 1 < this.chapters.length) {
      this.chapters[map + 1].chapters[0].chapter_unlock_state = 1;
    }
  }

  clear_chapter(map: number, increment = true): void {
    const finished = this.chapters[map].clear_chapter(increment);
    if (finished && map + 1 < this.chapters.length) {
      this.chapters[map + 1].chapters[0].chapter_unlock_state = 1;
    }
  }

  clear_group(increment = true): void {
    for (const chapter of this.chapters) chapter.clear_chapter(increment);
  }

  static init(total_subchapters: number, total_stars: number): EventChapterGroup {
    return new EventChapterGroup(times(total_subchapters, () => EventSubChapterStars.init(total_stars)));
  }

  static read_selected_stage(
    data: Data,
    total_subchapters: number,
    total_stars: number,
    is_int: boolean,
  ): EventChapterGroup {
    const chapters = times(total_subchapters, () =>
      EventSubChapterStars.read_selected_stage(data, total_stars, is_int),
    );
    return new EventChapterGroup(chapters);
  }

  write_selected_stage(data: Data, is_int: boolean): void {
    for (const chapter of this.chapters) chapter.write_selected_stage(data, is_int);
  }

  read_clear_progress(data: Data, is_int: boolean): void {
    for (const chapter of this.chapters) chapter.read_clear_progress(data, is_int);
  }

  write_clear_progress(data: Data, is_int: boolean): void {
    for (const chapter of this.chapters) chapter.write_clear_progress(data, is_int);
  }

  read_stages(data: Data, total_stages: number, is_int: boolean): void {
    for (const chapter of this.chapters) chapter.read_stages(data, total_stages, is_int);
  }

  write_stages(data: Data, is_int: boolean): void {
    for (const chapter of this.chapters) chapter.write_stages(data, is_int);
  }

  read_chapter_unlock_state(data: Data, is_int: boolean): void {
    for (const chapter of this.chapters) chapter.read_chapter_unlock_state(data, is_int);
  }

  write_chapter_unlock_state(data: Data, is_int: boolean): void {
    for (const chapter of this.chapters) chapter.write_chapter_unlock_state(data, is_int);
  }

  read_legend_restrictions(data: Data): void {
    for (const chapter of this.chapters) chapter.read_legend_restrictions(data);
  }

  write_legend_restrictions(data: Data): void {
    for (const chapter of this.chapters) chapter.write_legend_restrictions(data);
  }

  serialize(): EventSubChapterStarsSerialized[] {
    return this.chapters.map((c) => c.serialize());
  }

  static deserialize(data: Partial<EventSubChapterStarsSerialized>[]): EventChapterGroup {
    return new EventChapterGroup(data.map((c) => EventSubChapterStars.deserialize(c)));
  }
}

export interface EventChaptersSerialized {
  chapters: EventSubChapterStarsSerialized[][];
  chapter_completion_count: Record<string, number>;
  displayed_cleared_limit_text: Record<string, boolean>;
  event_start_dates: Record<string, number>;
  stages_reward_claimed: number[];
}

export class EventChapters {
  chapters: EventChapterGroup[];
  chapter_completion_count: Map<number, number>;
  displayed_cleared_limit_text: Map<number, boolean>;
  event_start_dates: Map<number, number>;
  stages_reward_claimed: number[];

  constructor(chapters: EventChapterGroup[]) {
    this.chapters = chapters;
    this.chapter_completion_count = new Map();
    this.displayed_cleared_limit_text = new Map();
    this.event_start_dates = new Map();
    this.stages_reward_claimed = [];
  }

  clear_stage(
    type: number,
    map: number,
    star: number,
    stage: number,
    clear_amount = 1,
    overwrite_clear_progress = false,
    ensure_cleared_only = false,
  ): boolean {
    return this.chapters[type].clear_stage(
      map,
      star,
      stage,
      clear_amount,
      overwrite_clear_progress,
      ensure_cleared_only,
    );
  }

  unclear_stage(type: number, map: number, star: number, stage: number): boolean {
    return this.chapters[type].unclear_stage(map, star, stage);
  }

  clear_map(type: number, map: number, star: number, increment = true): void {
    this.chapters[type].clear_map(map, star, increment);
  }

  clear_chapter(type: number, map: number, increment = true): void {
    this.chapters[type].clear_chapter(map, increment);
  }

  clear_group(type: number, increment = true): void {
    this.chapters[type].clear_group(increment);
  }

  static init(gv: GameVersion): EventChapters {
    let total_map_types: number;
    let total_subchapters: number;
    let stars_per_subchapter: number;
    if (gv.lt(20)) {
      return new EventChapters([]);
    }
    if (gv.le(32)) {
      total_map_types = 3;
      total_subchapters = 150;
      stars_per_subchapter = 3;
    } else if (gv.le(34)) {
      total_map_types = 4;
      total_subchapters = 150;
      stars_per_subchapter = 3;
    } else {
      total_map_types = 0;
      total_subchapters = 0;
      stars_per_subchapter = 0;
    }

    return new EventChapters(
      times(total_map_types, () => EventChapterGroup.init(total_subchapters, stars_per_subchapter)),
    );
  }

  static read(data: Data, gv: GameVersion): EventChapters {
    if (gv.lt(20)) {
      return new EventChapters([]);
    }
    let stages_per_subchapter = 0;
    let total_map_types: number;
    let total_subchapters: number;
    let stars_per_subchapter: number;
    let is_int: boolean;
    if (gv.gt(80099)) {
      total_map_types = data.read_byte();
      total_subchapters = data.read_short();
      stars_per_subchapter = data.read_byte();
      stages_per_subchapter = data.read_byte();
      is_int = false;
    } else if (gv.le(32)) {
      total_map_types = 3;
      total_subchapters = 150;
      stars_per_subchapter = 3;
      is_int = true;
    } else if (gv.le(34)) {
      total_map_types = 4;
      total_subchapters = 150;
      stars_per_subchapter = 3;
      is_int = true;
    } else {
      total_map_types = data.read_int();
      total_subchapters = data.read_int();
      stars_per_subchapter = data.read_int();
      is_int = true;
    }
    const chapters = times(total_map_types, () =>
      EventChapterGroup.read_selected_stage(data, total_subchapters, stars_per_subchapter, is_int),
    );

    if (gv.gt(80099)) {
      is_int = false;
    } else if (gv.le(32)) {
      total_map_types = 3;
      total_subchapters = 150;
      stars_per_subchapter = 3;
      is_int = true;
    } else if (gv.le(34)) {
      total_map_types = 4;
      total_subchapters = 150;
      stars_per_subchapter = 3;
      is_int = true;
    } else {
      total_map_types = data.read_int();
      total_subchapters = data.read_int();
      stars_per_subchapter = data.read_int();
      is_int = true;
    }

    for (const chapter of chapters) chapter.read_clear_progress(data, is_int);

    if (gv.gt(80099)) {
      is_int = false;
    } else if (gv.le(32)) {
      total_map_types = 3;
      total_subchapters = 150;
      stars_per_subchapter = 3;
      stages_per_subchapter = 12;
      is_int = true;
    } else if (gv.le(34)) {
      total_map_types = 4;
      total_subchapters = 150;
      stars_per_subchapter = 3;
      stages_per_subchapter = 12;
      is_int = true;
    } else {
      total_map_types = data.read_int();
      total_subchapters = data.read_int();
      stages_per_subchapter = data.read_int();
      stars_per_subchapter = data.read_int();
      is_int = true;
    }

    for (const chapter of chapters) chapter.read_stages(data, stages_per_subchapter, is_int);

    if (gv.gt(80099)) {
      is_int = false;
    } else if (gv.le(32)) {
      total_map_types = 3;
      total_subchapters = 150;
      stars_per_subchapter = 3;
      is_int = true;
    } else if (gv.le(34)) {
      total_map_types = 4;
      total_subchapters = 150;
      stars_per_subchapter = 3;
      is_int = true;
    } else {
      total_map_types = data.read_int();
      total_subchapters = data.read_int();
      stars_per_subchapter = data.read_int();
      is_int = true;
    }
    void total_map_types;
    void total_subchapters;
    void stars_per_subchapter;

    for (const chapter of chapters) chapter.read_chapter_unlock_state(data, is_int);

    return new EventChapters(chapters);
  }

  get_lengths(): [number, number, number, number] {
    const total_map_types = this.chapters.length;
    const total_subchapters = this.chapters[0]?.chapters.length ?? 0;
    const stars_per_subchapter = this.chapters[0]?.chapters[0]?.chapters.length ?? 0;
    const stages_per_subchapter = this.chapters[0]?.chapters[0]?.chapters[0]?.stages.length ?? 0;
    return [total_map_types, total_subchapters, stars_per_subchapter, stages_per_subchapter];
  }

  write(data: Data, gv: GameVersion): void {
    const [total_map_types, total_subchapters, stars_per_subchapter, stages_per_subchapter] =
      this.get_lengths();
    let is_int: boolean;
    if (gv.le(34)) {
      is_int = true;
    } else if (gv.gt(80099)) {
      data.write_byte(total_map_types);
      data.write_short(total_subchapters);
      data.write_byte(stars_per_subchapter);
      data.write_byte(stages_per_subchapter);
      is_int = false;
    } else {
      data.write_int(total_map_types);
      data.write_int(total_subchapters);
      data.write_int(stars_per_subchapter);
      is_int = true;
    }

    for (const chapter of this.chapters) chapter.write_selected_stage(data, is_int);

    if (gv.le(34)) {
      is_int = true;
    } else if (gv.gt(80099)) {
      is_int = false;
    } else {
      data.write_int(total_map_types);
      data.write_int(total_subchapters);
      data.write_int(stars_per_subchapter);
      is_int = true;
    }

    for (const chapter of this.chapters) chapter.write_clear_progress(data, is_int);

    if (gv.le(34)) {
      is_int = true;
    } else if (gv.gt(80099)) {
      is_int = false;
    } else {
      data.write_int(total_map_types);
      data.write_int(total_subchapters);
      data.write_int(stages_per_subchapter);
      data.write_int(stars_per_subchapter);
      is_int = true;
    }

    for (const chapter of this.chapters) chapter.write_stages(data, is_int);

    if (gv.le(34)) {
      is_int = true;
    } else if (gv.gt(80099)) {
      is_int = false;
    } else {
      data.write_int(total_map_types);
      data.write_int(total_subchapters);
      data.write_int(stars_per_subchapter);
      is_int = true;
    }

    for (const chapter of this.chapters) chapter.write_chapter_unlock_state(data, is_int);
  }

  read_legend_restrictions(data: Data, gv: GameVersion): void {
    if (gv.lt(20)) return;
    if (gv.lt(33)) {
      // 3 map types, 150 subchapters (not stored)
    } else if (gv.lt(41)) {
      // 4 map types, 150 subchapters (not stored)
    } else {
      data.read_int(); // total_map_types
      data.read_int(); // total_subchapters
    }

    for (const chapter of this.chapters) chapter.read_legend_restrictions(data);
  }

  write_legend_restrictions(data: Data, gv: GameVersion): void {
    if (gv.lt(20)) return;
    if (gv.ge(41)) {
      data.write_int(this.chapters.length);
      data.write_int(this.chapters[0]?.chapters.length ?? 0);
    }

    for (const chapter of this.chapters) chapter.write_legend_restrictions(data);
  }

  read_dicts(data: Data): void {
    this.chapter_completion_count = data.read_int_int_dict();
    this.displayed_cleared_limit_text = data.read_int_bool_dict();
    this.event_start_dates = data.read_int_int_dict();
    this.stages_reward_claimed = data.read_int_list();
  }

  write_dicts(data: Data): void {
    data.write_int_int_dict(this.chapter_completion_count);
    data.write_int_bool_dict(this.displayed_cleared_limit_text);
    data.write_int_int_dict(this.event_start_dates);
    data.write_int_list(this.stages_reward_claimed);
  }

  serialize(): EventChaptersSerialized {
    return {
      chapters: this.chapters.map((c) => c.serialize()),
      chapter_completion_count: mapToObject(this.chapter_completion_count),
      displayed_cleared_limit_text: mapToObject(this.displayed_cleared_limit_text),
      event_start_dates: mapToObject(this.event_start_dates),
      stages_reward_claimed: this.stages_reward_claimed,
    };
  }

  static deserialize(data: Partial<EventChaptersSerialized>): EventChapters {
    const chapters = (data.chapters ?? []).map((c) => EventChapterGroup.deserialize(c));
    const ch = new EventChapters(chapters);
    ch.chapter_completion_count = objectToMap(data.chapter_completion_count);
    ch.displayed_cleared_limit_text = objectToMap(data.displayed_cleared_limit_text);
    ch.event_start_dates = objectToMap(data.event_start_dates);
    ch.stages_reward_claimed = data.stages_reward_claimed ?? [];
    return ch;
  }

  get_total_stars(type: number, map: number): number {
    const v = this.chapters[type]?.chapters[map]?.chapters.length;
    if (v !== undefined) return v;
    return this.chapters[0].chapters[0].chapters.length;
  }

  get_total_stages(type: number, map: number, star: number): number {
    const v = this.chapters[type]?.chapters[map]?.chapters[star]?.stages.length;
    if (v !== undefined) return v;
    return this.chapters[0].chapters[0].chapters[0].stages.length;
  }

  /** Pure part of Python get_stage_names: stage names for a chapter with "＠" placeholders removed. */
  static get_stage_names(map_names: MapNames, chapter_id: number): string[] | null {
    const stage_names = map_names.stage_names.get(chapter_id);
    if (stage_names === undefined) return null;
    return stage_names.filter((s) => s !== "＠");
  }

  /** Pure part of Python ask_stages_stage_names: given the chosen stage index, all stages up to it. */
  static ask_stages_stage_names(choice: number): number[] {
    return times(choice + 1, (i) => i);
  }

  unclear_rest(stages: number[], stars: number, id: number, type: number): void {
    if (stages.length === 0) return;
    const max_stage = Math.max(...stages);
    for (let star = stars; star < this.get_total_stars(type, id); star++) {
      for (let stage = max_stage; stage < this.get_total_stages(type, id, star); stage++) {
        this.chapters[type].chapters[id].chapters[star].stages[stage].clear_amount = 0;
        this.chapters[type].chapters[id].chapters[star].clear_progress = 0;
      }
    }
  }

  // NOTE: edit_sol_chapters / edit_event_chapters / edit_collab_chapters /
  // select_map_names / ask_* / print_* are interactive CLI helpers and were not
  // ported (see edits/map.ts for the pure equivalents).
}
