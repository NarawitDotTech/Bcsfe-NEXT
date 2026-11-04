/** Port of bcsfe/core/game/map/chapters.py */
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
    const clear_times = data.read_int();
    return new Stage(clear_times);
  }

  write(data: Data): void {
    data.write_int(this.clear_times);
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

export interface ChapterSerialized {
  selected_stage: number;
  clear_progress: number;
  stages: number[];
  chapter_unlock_state: number;
}

export class Chapter {
  selected_stage: number;
  clear_progress: number;
  stages: Stage[];
  chapter_unlock_state: number;
  total_stages: number;

  constructor(selected_stage: number, total_stages = 0) {
    this.selected_stage = selected_stage;
    this.clear_progress = 0;
    this.stages = times(total_stages, () => Stage.init());
    this.chapter_unlock_state = 0;
    this.total_stages = 0;
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
    this.chapter_unlock_state = 3;
    this.stages[index].clear_stage(clear_amount, ensure_cleared_only);
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

  static init(total_stages: number): Chapter {
    return new Chapter(0, total_stages);
  }

  static read_selected_stage(data: Data): Chapter {
    const selected_stage = data.read_int();
    return new Chapter(selected_stage);
  }

  write_selected_stage(data: Data): void {
    data.write_int(this.selected_stage);
  }

  read_clear_progress(data: Data): void {
    this.clear_progress = data.read_int();
  }

  write_clear_progress(data: Data): void {
    data.write_int(this.clear_progress);
  }

  read_stages(data: Data, total_stages: number): void {
    this.stages = times(total_stages, () => Stage.read(data));
  }

  write_stages(data: Data): void {
    for (const stage of this.stages) stage.write(data);
  }

  read_chapter_unlock_state(data: Data): void {
    this.chapter_unlock_state = data.read_int();
  }

  write_chapter_unlock_state(data: Data): void {
    data.write_int(this.chapter_unlock_state);
  }

  serialize(): ChapterSerialized {
    return {
      selected_stage: this.selected_stage,
      clear_progress: this.clear_progress,
      stages: this.stages.map((s) => s.serialize()),
      chapter_unlock_state: this.chapter_unlock_state,
    };
  }

  static deserialize(data: Partial<ChapterSerialized>): Chapter {
    const chapter = new Chapter(data.selected_stage ?? 0);
    chapter.clear_progress = data.clear_progress ?? 0;
    chapter.stages = (data.stages ?? []).map((s) => Stage.deserialize(s));
    chapter.chapter_unlock_state = data.chapter_unlock_state ?? 0;
    return chapter;
  }
}

export class ChaptersStars {
  chapters: Chapter[];
  constructor(chapters: Chapter[]) {
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

  static init(total_stages: number, total_stars: number): ChaptersStars {
    const chapters = times(total_stars, () => Chapter.init(total_stages));
    return new ChaptersStars(chapters);
  }

  static read_selected_stage(data: Data, total_stars: number): ChaptersStars {
    const chapters = times(total_stars, () => Chapter.read_selected_stage(data));
    return new ChaptersStars(chapters);
  }

  write_selected_stage(data: Data): void {
    for (const chapter of this.chapters) chapter.write_selected_stage(data);
  }

  read_clear_progress(data: Data): void {
    for (const chapter of this.chapters) chapter.read_clear_progress(data);
  }

  write_clear_progress(data: Data): void {
    for (const chapter of this.chapters) chapter.write_clear_progress(data);
  }

  read_stages(data: Data, total_stages: number): void {
    for (let i = 0; i < total_stages; i++) {
      for (const chapter of this.chapters) {
        chapter.stages.push(Stage.read(data));
      }
    }
  }

  write_stages(data: Data): void {
    // Python: range(len(self.chapters[0].stages)) -> IndexError if no chapters
    if (this.chapters.length === 0) throw new RangeError("list index out of range");
    for (let i = 0; i < this.chapters[0].stages.length; i++) {
      for (const chapter of this.chapters) {
        chapter.stages[i].write(data);
      }
    }
  }

  read_chapter_unlock_state(data: Data): void {
    for (const chapter of this.chapters) chapter.read_chapter_unlock_state(data);
  }

  write_chapter_unlock_state(data: Data): void {
    for (const chapter of this.chapters) chapter.write_chapter_unlock_state(data);
  }

  serialize(): ChapterSerialized[] {
    return this.chapters.map((c) => c.serialize());
  }

  static deserialize(data: Partial<ChapterSerialized>[]): ChaptersStars {
    return new ChaptersStars(data.map((c) => Chapter.deserialize(c)));
  }
}

export class Chapters {
  chapters: ChaptersStars[];
  constructor(chapters: ChaptersStars[]) {
    this.chapters = chapters;
  }

  get_total_stars(map: number): number {
    return this.chapters[map].chapters.length;
  }

  get_total_stages(map: number, star: number): number {
    return this.chapters[map].chapters[star].stages.length;
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

  static init(): Chapters {
    return new Chapters([]);
  }

  static read(data: Data, read_every_time = true): Chapters {
    let total_stages = 0;
    let total_chapters = 0;
    let total_stars = 0;
    if (read_every_time) {
      total_chapters = data.read_int();
      total_stars = data.read_int();
    } else {
      total_chapters = data.read_int();
      total_stages = data.read_int();
      total_stars = data.read_int();
    }

    const chapters = times(total_chapters, () =>
      ChaptersStars.read_selected_stage(data, total_stars),
    );

    if (read_every_time) {
      total_chapters = data.read_int();
      total_stars = data.read_int();
    }

    for (const chapter of chapters) chapter.read_clear_progress(data);

    if (read_every_time) {
      total_chapters = data.read_int();
      total_stages = data.read_int();
      total_stars = data.read_int();
    }

    for (const chapter of chapters) chapter.read_stages(data, total_stages);

    if (read_every_time) {
      total_chapters = data.read_int();
      total_stars = data.read_int();
    }

    for (const chapter of chapters) chapter.read_chapter_unlock_state(data);

    return new Chapters(chapters);
  }

  get_lengths(): [number, number, number] {
    const total_chapters = this.chapters.length;
    const total_stages = this.chapters[0]?.chapters[0]?.stages.length ?? 0;
    const total_stars = this.chapters[0]?.chapters.length ?? 0;
    return [total_chapters, total_stages, total_stars];
  }

  write(data: Data, write_every_time = true): void {
    const [total_chapters, total_stages, total_stars] = this.get_lengths();
    if (write_every_time) {
      data.write_int(total_chapters);
      data.write_int(total_stars);
    } else {
      data.write_int(total_chapters);
      data.write_int(total_stages);
      data.write_int(total_stars);
    }
    for (const chapter of this.chapters) chapter.write_selected_stage(data);

    if (write_every_time) {
      data.write_int(total_chapters);
      data.write_int(total_stars);
    }
    for (const chapter of this.chapters) chapter.write_clear_progress(data);

    if (write_every_time) {
      data.write_int(total_chapters);
      data.write_int(total_stages);
      data.write_int(total_stars);
    }
    for (const chapter of this.chapters) chapter.write_stages(data);

    if (write_every_time) {
      data.write_int(total_chapters);
      data.write_int(total_stars);
    }
    for (const chapter of this.chapters) chapter.write_chapter_unlock_state(data);
  }

  serialize(): ChapterSerialized[][] {
    return this.chapters.map((c) => c.serialize());
  }

  static deserialize(data: Partial<ChapterSerialized>[][]): Chapters {
    return new Chapters(data.map((c) => ChaptersStars.deserialize(c)));
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

  /**
   * Python: edit_chapters(save_file, letter_code, base_index) delegates to the
   * interactive CLI edit (cli.edits.map.edit_chapters). Not ported here; use
   * the pure functions in src/lib/bcsfe/edits/map.ts instead.
   */
  edit_chapters(_save_file: SaveFile, _letter_code: string, _base_index: number): never {
    throw new Error("edit_chapters is interactive; use edits/map.ts");
  }

  set_total_stages(map: number, total_stages: number): void {
    for (const chapter of this.chapters[map].chapters) {
      chapter.total_stages = total_stages;
    }
  }
}
