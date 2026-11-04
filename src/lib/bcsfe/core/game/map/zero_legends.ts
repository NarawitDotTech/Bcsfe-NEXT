/** Port of bcsfe/core/game/map/zero_legends.py */
import type { Data } from "@/lib/bcsfe/core/io/data";
import type { SaveFile } from "@/lib/bcsfe/core/io/save";
import { times } from "@/lib/bcsfe/core/utils";

export class Stage {
  clear_times: number;
  constructor(clear_times: number) {
    this.clear_times = clear_times;
  }

  static init(): Stage {
    return new Stage(0);
  }

  static read(data: Data): Stage {
    const clear_times = data.read_short();
    return new Stage(clear_times);
  }

  write(data: Data): void {
    data.write_short(this.clear_times);
  }

  serialize(): number {
    return this.clear_times;
  }

  static deserialize(data: number): Stage {
    return new Stage(data);
  }

  clear_stage(clear_amount = 1, ensure_cleared_only = false): void {
    if (ensure_cleared_only) {
      this.clear_times = this.clear_times || clear_amount;
    } else {
      this.clear_times = clear_amount;
    }
  }

  unclear_stage(): void {
    this.clear_times = 0;
  }
}

export interface ZLChapterSerialized {
  selected_stage: number;
  clear_progress: number;
  unlock_state: number;
  stages: number[];
}

export class Chapter {
  selected_stage: number;
  clear_progress: number;
  unlock_state: number;
  stages: Stage[];
  total_stages: number;
  /** Not read/written; Python sets this attribute dynamically. */
  chapter_unlock_state: number;

  constructor(selected_stage: number, clear_progress: number, unlock_state: number, stages: Stage[]) {
    this.selected_stage = selected_stage;
    this.clear_progress = clear_progress;
    this.unlock_state = unlock_state;
    this.stages = stages;
    this.total_stages = 0;
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
    if (index === this.total_stages - 1) {
      return true;
    }
    return false;
  }

  unclear_stage(index: number): boolean {
    this.clear_progress = Math.min(this.clear_progress, index);
    this.stages[index].unclear_stage();
    return true;
  }

  static init(): Chapter {
    return new Chapter(0, 0, 0, []);
  }

  static read(data: Data): Chapter {
    const selected_stage = data.read_byte();
    const clear_progress = data.read_byte();
    const unlock_state = data.read_byte();
    const total_stages = data.read_short();
    const stages = times(total_stages, () => Stage.read(data));
    return new Chapter(selected_stage, clear_progress, unlock_state, stages);
  }

  write(data: Data): void {
    data.write_byte(this.selected_stage);
    data.write_byte(this.clear_progress);
    data.write_byte(this.unlock_state);
    data.write_short(this.stages.length);
    for (const stage of this.stages) stage.write(data);
  }

  serialize(): ZLChapterSerialized {
    return {
      selected_stage: this.selected_stage,
      clear_progress: this.clear_progress,
      unlock_state: this.unlock_state,
      stages: this.stages.map((s) => s.serialize()),
    };
  }

  static deserialize(data: Partial<ZLChapterSerialized>): Chapter {
    return new Chapter(
      data.selected_stage ?? 0,
      data.clear_progress ?? 0,
      data.unlock_state ?? 0,
      (data.stages ?? []).map((s) => Stage.deserialize(s)),
    );
  }
}

export interface ZLChaptersStarsSerialized {
  unknown: number;
  chapters: ZLChapterSerialized[];
}

export class ChaptersStars {
  unknown: number;
  chapters: Chapter[];

  constructor(unknown: number, chapters: Chapter[]) {
    this.unknown = unknown;
    this.chapters = chapters;
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

  static init(): ChaptersStars {
    return new ChaptersStars(0, []);
  }

  static read(data: Data): ChaptersStars {
    const unknown = data.read_byte();
    const total_stars = data.read_byte();
    const chapters = times(total_stars, () => Chapter.read(data));
    return new ChaptersStars(unknown, chapters);
  }

  write(data: Data): void {
    data.write_byte(this.unknown);
    data.write_byte(this.chapters.length);
    for (const chapter of this.chapters) chapter.write(data);
  }

  serialize(): ZLChaptersStarsSerialized {
    return {
      unknown: this.unknown,
      chapters: this.chapters.map((c) => c.serialize()),
    };
  }

  static deserialize(data: Partial<ZLChaptersStarsSerialized>): ChaptersStars {
    return new ChaptersStars(
      data.unknown ?? 0,
      (data.chapters ?? []).map((c) => Chapter.deserialize(c)),
    );
  }
}

export class ZeroLegendsChapters {
  chapters: ChaptersStars[];
  constructor(chapters: ChaptersStars[]) {
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
    this.create(map);
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
    this.create(map);
    const finished = this.chapters[map].unclear_stage(star, stage);
    if (finished && map + 1 < this.chapters.length && star === 0) {
      for (const chapter of this.chapters[map + 1].chapters) {
        chapter.chapter_unlock_state = 0;
      }
    }
    return finished;
  }

  static init(): ZeroLegendsChapters {
    return new ZeroLegendsChapters([]);
  }

  static read(data: Data): ZeroLegendsChapters {
    const total_chapters = data.read_short();
    const chapters = times(total_chapters, () => ChaptersStars.read(data));
    return new ZeroLegendsChapters(chapters);
  }

  write(data: Data): void {
    data.write_short(this.chapters.length);
    for (const chapter of this.chapters) chapter.write(data);
  }

  serialize(): ZLChaptersStarsSerialized[] {
    return this.chapters.map((c) => c.serialize());
  }

  static deserialize(data: Partial<ZLChaptersStarsSerialized>[]): ZeroLegendsChapters {
    return new ZeroLegendsChapters(data.map((c) => ChaptersStars.deserialize(c)));
  }

  get_total_stars(chapter_id: number): number {
    return this.chapters[chapter_id].chapters.length;
  }

  get_total_stages(chapter_id: number, star: number): number {
    return this.chapters[chapter_id].chapters[star].stages.length;
  }

  /**
   * Note: Python builds the new chapters with `[Stage(0)] * n` / `[Chapter(...)] * n`,
   * sharing a single object between entries. Here independent objects are created.
   */
  create(chapter_id: number): void {
    const diff = chapter_id - this.chapters.length;

    if (diff >= 0) {
      for (let k = 0; k < diff + 1; k++) {
        const total_stages = this.get_total_stages(0, 0);
        const total_stars = this.get_total_stars(0);
        const chapters = times(total_stars, () =>
          new Chapter(0, 0, 0, times(total_stages, () => new Stage(0))),
        );
        this.chapters.push(new ChaptersStars(0, chapters));
      }
    }
  }

  /** Python: interactive (warning + menus); use edits/map.ts. */
  static edit_zero_legends(_save_file: SaveFile): never {
    throw new Error("edit_zero_legends is interactive; use edits/map.ts");
  }

  /** Python: interactive; use edits/map.ts. */
  static edit_catclaw_championships(_save_file: SaveFile): never {
    throw new Error("edit_catclaw_championships is interactive; use edits/map.ts");
  }

  edit_chapters(
    _save_file: SaveFile,
    _letter_code: string,
    _base_index: number,
    _no_r_prefix = false,
  ): never {
    throw new Error("edit_chapters is interactive; use edits/map.ts");
  }

  unclear_rest(stages: number[], stars: number, id: number): void {
    if (stages.length === 0) return;
    const max_stage = Math.max(...stages);
    for (let star = stars; star < this.get_total_stars(id); star++) {
      for (let stage = max_stage; stage < this.get_total_stages(id, star); stage++) {
        this.chapters[id].chapters[star].stages[stage].clear_times = 0;
        this.chapters[id].chapters[star].clear_progress = 0;
      }
    }
  }

  set_total_stages(map: number, total_stages: number): void {
    this.create(map);
    for (const chapter of this.chapters[map].chapters) {
      chapter.total_stages = total_stages;
    }
  }
}
