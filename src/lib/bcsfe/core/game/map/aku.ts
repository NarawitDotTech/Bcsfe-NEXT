/** Port of bcsfe/core/game/map/aku.py */
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

  clear_stage(clear_count = 1): void {
    this.clear_times = clear_count;
  }
}

export interface AkuChapterSerialized {
  current_stage: number;
  stages: number[];
}

export class Chapter {
  current_stage: number;
  stages: Stage[];

  constructor(current_stage: number, total_stages = 0) {
    this.current_stage = current_stage;
    this.stages = times(total_stages, () => Stage.init());
  }

  static init(total_stages: number): Chapter {
    return new Chapter(0, total_stages);
  }

  static read_current_stage(data: Data): Chapter {
    const current_stage = data.read_byte();
    return new Chapter(current_stage);
  }

  write_current_stage(data: Data): void {
    data.write_byte(this.current_stage);
  }

  read_stages(data: Data, total_stages: number): void {
    this.stages = times(total_stages, () => Stage.read(data));
  }

  write_stages(data: Data): void {
    for (const stage of this.stages) stage.write(data);
  }

  serialize(): AkuChapterSerialized {
    return {
      current_stage: this.current_stage,
      stages: this.stages.map((s) => s.serialize()),
    };
  }

  static deserialize(data: Partial<AkuChapterSerialized>): Chapter {
    const chapter = new Chapter(data.current_stage ?? 0);
    chapter.stages = (data.stages ?? []).map((s) => Stage.deserialize(s));
    return chapter;
  }
}

export class ChaptersStars {
  chapters: Chapter[];
  constructor(chapters: Chapter[]) {
    this.chapters = chapters;
  }

  static init(total_stages: number, total_stars: number): ChaptersStars {
    return new ChaptersStars(times(total_stars, () => Chapter.init(total_stages)));
  }

  static read_current_stage(data: Data, total_stars: number): ChaptersStars {
    const chapters = times(total_stars, () => Chapter.read_current_stage(data));
    return new ChaptersStars(chapters);
  }

  write_current_stage(data: Data): void {
    for (const chapter of this.chapters) chapter.write_current_stage(data);
  }

  read_stages(data: Data, total_stages: number): void {
    for (const chapter of this.chapters) chapter.read_stages(data, total_stages);
  }

  write_stages(data: Data): void {
    for (const chapter of this.chapters) chapter.write_stages(data);
  }

  serialize(): AkuChapterSerialized[] {
    return this.chapters.map((c) => c.serialize());
  }

  static deserialize(data: Partial<AkuChapterSerialized>[]): ChaptersStars {
    return new ChaptersStars(data.map((c) => Chapter.deserialize(c)));
  }
}

export class AkuChapters {
  chapters: ChaptersStars[];
  constructor(chapters: ChaptersStars[]) {
    this.chapters = chapters;
  }

  static init(): AkuChapters {
    return new AkuChapters([]);
  }

  static read(data: Data): AkuChapters {
    const total_chapters = data.read_short();
    const total_stages = data.read_byte();
    const total_stars = data.read_byte();

    const chapters = times(total_chapters, () =>
      ChaptersStars.read_current_stage(data, total_stars),
    );

    for (const chapter of chapters) chapter.read_stages(data, total_stages);

    return new AkuChapters(chapters);
  }

  write(data: Data): void {
    data.write_short(this.chapters.length);
    data.write_byte(this.chapters[0]?.chapters[0]?.stages.length ?? 0);
    data.write_byte(this.chapters[0]?.chapters.length ?? 0);

    for (const chapter of this.chapters) chapter.write_current_stage(data);
    for (const chapter of this.chapters) chapter.write_stages(data);
  }

  serialize(): AkuChapterSerialized[][] {
    return this.chapters.map((c) => c.serialize());
  }

  static deserialize(data: Partial<AkuChapterSerialized>[][]): AkuChapters {
    return new AkuChapters(data.map((c) => ChaptersStars.deserialize(c)));
  }

  /**
   * Pure version of the interactive Python edit_aku_chapters.
   * `clear_progress`: number of stages to mark cleared (the user's chosen progress).
   * `clear_counts`: a single clear count applied to all of the first `clear_progress`
   * stages, or an array with one clear count per stage (individual counts).
   * Remaining stages are set to 0.
   */
  static edit_aku_chapters(
    save_file: SaveFile,
    clear_progress: number,
    clear_counts: number | number[],
  ): void {
    const chapter = save_file.aku.chapters[0].chapters[0];
    chapter.stages.slice(0, clear_progress).forEach((stage, i) => {
      stage.clear_stage(Array.isArray(clear_counts) ? clear_counts[i] : clear_counts);
    });
    for (let i = clear_progress; i < chapter.stages.length; i++) {
      chapter.stages[i].clear_stage(0);
    }
  }
}
