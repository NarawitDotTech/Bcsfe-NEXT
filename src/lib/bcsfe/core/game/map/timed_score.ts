import { Data } from "@/lib/bcsfe/core/io/data";
import type { GameVersion } from "@/lib/bcsfe/core/game_version";
import { times } from "@/lib/bcsfe/core/utils";

export class Stage {
  score: number;
  constructor(score: number) {
    this.score = score;
  }
  static init(): Stage {
    return new Stage(0);
  }
  static read(stream: Data): Stage {
    return new Stage(stream.read_int());
  }
  write(stream: Data): void {
    stream.write_int(this.score);
  }
  serialize(): number {
    return this.score;
  }
  static deserialize(data: number): Stage {
    return new Stage(data);
  }
}

export class SubChapter {
  stages: Stage[];
  constructor(stages: Stage[]) {
    this.stages = stages;
  }
  static init(total_stages: number): SubChapter {
    return new SubChapter(times(total_stages, () => Stage.init()));
  }
  static read(stream: Data, total_stages: number): SubChapter {
    return new SubChapter(times(total_stages, () => Stage.read(stream)));
  }
  write(stream: Data): void {
    for (const s of this.stages) s.write(stream);
  }
  serialize(): number[] {
    return this.stages.map((s) => s.serialize());
  }
  static deserialize(data: number[]): SubChapter {
    return new SubChapter(data.map((s) => Stage.deserialize(s)));
  }
}

export class SubChapterStars {
  sub_chapters: SubChapter[];
  constructor(sub_chapters: SubChapter[]) {
    this.sub_chapters = sub_chapters;
  }
  static init(total_stages: number, total_stars: number): SubChapterStars {
    return new SubChapterStars(times(total_stars, () => SubChapter.init(total_stages)));
  }
  static read(stream: Data, total_stages: number, total_stars: number): SubChapterStars {
    return new SubChapterStars(times(total_stars, () => SubChapter.read(stream, total_stages)));
  }
  write(stream: Data): void {
    for (const s of this.sub_chapters) s.write(stream);
  }
  serialize(): number[][] {
    return this.sub_chapters.map((s) => s.serialize());
  }
  static deserialize(data: number[][]): SubChapterStars {
    return new SubChapterStars(data.map((s) => SubChapter.deserialize(s)));
  }
}

export class TimedScoreChapters {
  sub_chapters: SubChapterStars[];
  constructor(sub_chapters: SubChapterStars[]) {
    this.sub_chapters = sub_chapters;
  }

  static init(gv: GameVersion): TimedScoreChapters {
    if (gv.lt(20)) return new TimedScoreChapters([]);
    let total_subchapters: number, total_stages: number, total_stars: number;
    if (gv.le(33)) {
      total_subchapters = 50;
      total_stages = 12;
      total_stars = 3;
    } else if (gv.le(34)) {
      total_subchapters = 0;
      total_stages = 12;
      total_stars = 3;
    } else {
      total_subchapters = 0;
      total_stages = 0;
      total_stars = 0;
    }
    return new TimedScoreChapters(
      times(total_subchapters, () => SubChapterStars.init(total_stages, total_stars)),
    );
  }

  static read(stream: Data, gv: GameVersion): TimedScoreChapters {
    if (gv.lt(20)) return new TimedScoreChapters([]);
    let total_subchapters: number, total_stages: number, total_stars: number;
    if (gv.le(33)) {
      total_subchapters = 50;
      total_stages = 12;
      total_stars = 3;
    } else if (gv.le(34)) {
      total_subchapters = stream.read_int();
      total_stages = 12;
      total_stars = 3;
    } else {
      total_subchapters = stream.read_int();
      total_stages = stream.read_int();
      total_stars = stream.read_int();
    }
    const sub_chapters: SubChapterStars[] = [];
    for (let i = 0; i < total_subchapters; i++) {
      sub_chapters.push(SubChapterStars.read(stream, total_stages, total_stars));
    }
    return new TimedScoreChapters(sub_chapters);
  }

  write(stream: Data, gv: GameVersion): void {
    if (gv.lt(20)) return;
    if (gv.le(33)) {
      // nothing
    } else if (gv.le(34)) {
      stream.write_int(this.sub_chapters.length);
    } else {
      stream.write_int(this.sub_chapters.length);
      stream.write_int(this.sub_chapters[0]?.sub_chapters[0]?.stages.length ?? 0);
      stream.write_int(this.sub_chapters[0]?.sub_chapters.length ?? 0);
    }
    for (const s of this.sub_chapters) s.write(stream);
  }

  serialize(): number[][][] {
    return this.sub_chapters.map((s) => s.serialize());
  }

  static deserialize(data: number[][][]): TimedScoreChapters {
    return new TimedScoreChapters(data.map((s) => SubChapterStars.deserialize(s)));
  }
}
