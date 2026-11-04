/** Port of bcsfe/core/game/map/ex_stage.py */
import type { Data } from "@/lib/bcsfe/core/io/data";
import { times } from "@/lib/bcsfe/core/utils";

export class Stage {
  clear_amount: number;
  constructor(clear_amount: number) {
    this.clear_amount = clear_amount;
  }

  static init(): Stage {
    return new Stage(0);
  }

  static read(stream: Data): Stage {
    const clear_amount = stream.read_int();
    return new Stage(clear_amount);
  }

  write(stream: Data): void {
    stream.write_int(this.clear_amount);
  }

  serialize(): number {
    return this.clear_amount;
  }

  static deserialize(data: number): Stage {
    return new Stage(data);
  }
}

export class Chapter {
  stages: Stage[];
  constructor(stages: Stage[]) {
    this.stages = stages;
  }

  static init(): Chapter {
    return new Chapter(times(12, () => Stage.init()));
  }

  static read(stream: Data): Chapter {
    const total = 12;
    const stages: Stage[] = [];
    for (let i = 0; i < total; i++) stages.push(Stage.read(stream));
    return new Chapter(stages);
  }

  write(stream: Data): void {
    for (const stage of this.stages) stage.write(stream);
  }

  serialize(): number[] {
    return this.stages.map((s) => s.serialize());
  }

  static deserialize(data: number[]): Chapter {
    return new Chapter(data.map((s) => Stage.deserialize(s)));
  }
}

export class ExChapters {
  chapters: Chapter[];
  constructor(chapters: Chapter[]) {
    this.chapters = chapters;
  }

  static init(): ExChapters {
    return new ExChapters([]);
  }

  static read(stream: Data): ExChapters {
    const total = stream.read_int();
    const chapters: Chapter[] = [];
    for (let i = 0; i < total; i++) chapters.push(Chapter.read(stream));
    return new ExChapters(chapters);
  }

  write(stream: Data): void {
    stream.write_int(this.chapters.length);
    for (const chapter of this.chapters) chapter.write(stream);
  }

  serialize(): number[][] {
    return this.chapters.map((c) => c.serialize());
  }

  static deserialize(data: number[][]): ExChapters {
    return new ExChapters(data.map((c) => Chapter.deserialize(c)));
  }
}
