import { Data } from "@/lib/bcsfe/core/io/data";
import type { GameVersion } from "@/lib/bcsfe/core/game_version";
import { mapToObject } from "@/lib/bcsfe/core/utils";

export class Outbreak {
  cleared: boolean;
  constructor(cleared: boolean) {
    this.cleared = cleared;
  }
  static init(): Outbreak {
    return new Outbreak(false);
  }
  static read(stream: Data): Outbreak {
    return new Outbreak(stream.read_bool());
  }
  write(stream: Data): void {
    stream.write_bool(this.cleared);
  }
  serialize(): boolean {
    return this.cleared;
  }
  static deserialize(data: boolean): Outbreak {
    return new Outbreak(data);
  }
}

export class Chapter {
  id: number;
  outbreaks: Map<number, Outbreak>;
  constructor(id: number, outbreaks: Map<number, Outbreak>) {
    this.id = id;
    this.outbreaks = outbreaks;
  }

  get_true_id(): number {
    if (this.id < 3) return this.id;
    return this.id - 1;
  }

  static init(id: number): Chapter {
    return new Chapter(id, new Map());
  }

  static read(stream: Data, id: number): Chapter {
    const total = stream.read_int();
    const outbreaks = new Map<number, Outbreak>();
    for (let i = 0; i < total; i++) {
      const outbreak_id = stream.read_int();
      outbreaks.set(outbreak_id, Outbreak.read(stream));
    }
    return new Chapter(id, outbreaks);
  }

  write(stream: Data): void {
    stream.write_int(this.outbreaks.size);
    for (const [outbreak_id, outbreak] of this.outbreaks) {
      stream.write_int(outbreak_id);
      outbreak.write(stream);
    }
  }

  serialize(): Record<string, boolean> {
    return mapToObject(this.outbreaks, (o) => o.serialize());
  }

  static deserialize(data: Record<string, boolean>, id: number): Chapter {
    const m = new Map<number, Outbreak>();
    for (const [k, v] of Object.entries(data)) m.set(Number(k), Outbreak.deserialize(v));
    return new Chapter(id, m);
  }
}

function deserializeChapters(data: Record<string, Record<string, boolean>>): Map<number, Chapter> {
  const m = new Map<number, Chapter>();
  for (const [k, v] of Object.entries(data)) m.set(Number(k), Chapter.deserialize(v, Number(k)));
  return m;
}

export class Outbreaks {
  chapters: Map<number, Chapter>;
  zombie_event_remaining_time = 0.0;
  current_outbreaks: Map<number, Chapter> = new Map();

  constructor(chapters: Map<number, Chapter>) {
    this.chapters = chapters;
  }

  static init(): Outbreaks {
    return new Outbreaks(new Map());
  }

  static read_chapters(stream: Data): Outbreaks {
    const total = stream.read_int();
    const chapters = new Map<number, Chapter>();
    for (let i = 0; i < total; i++) {
      const chapter_id = stream.read_int();
      chapters.set(chapter_id, Chapter.read(stream, chapter_id));
    }
    return new Outbreaks(chapters);
  }

  write_chapters(stream: Data): void {
    stream.write_int(this.chapters.size);
    for (const [chapter_id, chapter] of this.chapters) {
      stream.write_int(chapter_id);
      chapter.write(stream);
    }
  }

  read_2(stream: Data): void {
    this.zombie_event_remaining_time = stream.read_double();
  }

  write_2(stream: Data): void {
    stream.write_double(this.zombie_event_remaining_time);
  }

  read_current_outbreaks(stream: Data, gv: GameVersion): void {
    if (gv.le(43)) {
      const total_chapters = stream.read_int();
      for (let i = 0; i < total_chapters; i++) {
        stream.read_int();
        const total_stage = stream.read_int();
        for (let j = 0; j < total_stage; j++) {
          stream.read_int();
          stream.read_bool();
        }
      }
    }
    const total = stream.read_int();
    const current = new Map<number, Chapter>();
    for (let i = 0; i < total; i++) {
      const chapter_id = stream.read_int();
      current.set(chapter_id, Chapter.read(stream, chapter_id));
    }
    this.current_outbreaks = current;
  }

  write_current_outbreaks(stream: Data, gv: GameVersion): void {
    if (gv.le(43)) stream.write_int(0);
    stream.write_int(this.current_outbreaks.size);
    for (const [chapter_id, chapter] of this.current_outbreaks) {
      stream.write_int(chapter_id);
      chapter.write(stream);
    }
  }

  serialize(): Record<string, unknown> {
    return {
      chapters: mapToObject(this.chapters, (c) => c.serialize()),
      zombie_event_remaining_time: this.zombie_event_remaining_time,
      current_outbreaks: mapToObject(this.current_outbreaks, (c) => c.serialize()),
    };
  }

  static deserialize(data: Record<string, unknown>): Outbreaks {
    const outbreaks = new Outbreaks(
      deserializeChapters((data["chapters"] as Record<string, Record<string, boolean>> | undefined) ?? {}),
    );
    outbreaks.zombie_event_remaining_time =
      (data["zombie_event_remaining_time"] as number | undefined) ?? 0.0;
    outbreaks.current_outbreaks = deserializeChapters(
      (data["current_outbreaks"] as Record<string, Record<string, boolean>> | undefined) ?? {},
    );
    return outbreaks;
  }

  get_chapter_from_true_id(true_id: number): Chapter | null {
    if (true_id < 3) return this.chapters.get(true_id) ?? null;
    return this.chapters.get(true_id + 1) ?? null;
  }

  get_current_chapter_from_true_id(true_id: number): Chapter | null {
    if (true_id < 3) return this.current_outbreaks.get(true_id) ?? null;
    return this.current_outbreaks.get(true_id + 1) ?? null;
  }

  clear_outbreak(chapter_id: number, stage_id: number, clear: boolean): void {
    let chapter = this.get_chapter_from_true_id(chapter_id);
    if (chapter !== null) {
      const stage = chapter.outbreaks.get(stage_id);
      if (stage !== undefined) stage.cleared = clear;
    }
    if (clear) {
      chapter = this.get_current_chapter_from_true_id(chapter_id);
      if (chapter !== null) {
        const stage = chapter.outbreaks.get(stage_id);
        if (stage !== undefined) stage.cleared = false;
      }
    }
  }

  /**
   * Pure version of Python Outbreaks.edit_outbreaks(): the interactive chapter /
   * stage selection is replaced by `selection` (true chapter id -> stage ids).
   */
  edit_outbreaks(selection: Map<number, number[]>, clear: boolean): void {
    for (const [chapter_id, stages] of selection) {
      for (const stage of stages) this.clear_outbreak(chapter_id, stage, clear);
    }
  }
}
