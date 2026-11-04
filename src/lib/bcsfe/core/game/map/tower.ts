/** Port of bcsfe/core/game/map/tower.py */
import type { Data } from "@/lib/bcsfe/core/io/data";
import type { SaveFile } from "@/lib/bcsfe/core/io/save";
import { Chapters, type ChapterSerialized } from "@/lib/bcsfe/core/game/map/chapters";
import { times } from "@/lib/bcsfe/core/utils";

export class TowerChapters {
  chapters: Chapters;
  item_obtain_states: boolean[][];

  constructor(chapters: Chapters) {
    this.chapters = chapters;
    this.item_obtain_states = [];
  }

  static init(): TowerChapters {
    return new TowerChapters(Chapters.init());
  }

  static read(data: Data): TowerChapters {
    const ch = Chapters.read(data);
    return new TowerChapters(ch);
  }

  write(data: Data): void {
    this.chapters.write(data);
  }

  read_item_obtain_states(data: Data): void {
    const total_stars = data.read_int();
    const total_stages = data.read_int();
    this.item_obtain_states = times(total_stars, () => data.read_bool_list(total_stages));
  }

  write_item_obtain_states(data: Data): void {
    data.write_int(this.item_obtain_states.length);
    if (this.item_obtain_states.length > 0) {
      data.write_int(this.item_obtain_states[0].length);
    } else {
      data.write_int(0);
    }
    for (const state of this.item_obtain_states) {
      data.write_bool_list(state, false);
    }
  }

  serialize(): { chapters: ChapterSerialized[][]; item_obtain_states: boolean[][] } {
    return {
      chapters: this.chapters.serialize(),
      item_obtain_states: this.item_obtain_states,
    };
  }

  static deserialize(data: {
    chapters?: Partial<ChapterSerialized>[][];
    item_obtain_states?: boolean[][];
  }): TowerChapters {
    const tower = new TowerChapters(Chapters.deserialize(data.chapters ?? []));
    tower.item_obtain_states = data.item_obtain_states ?? [];
    return tower;
  }

  get_total_stars(chapter_id: number): number {
    return this.chapters.chapters[chapter_id].chapters.length;
  }

  get_total_stages(chapter_id: number, star: number): number {
    return this.chapters.chapters[chapter_id].chapters[star].stages.length;
  }

  /** Python: interactive; calls edit_chapters(save_file, "V", 7000). Use edits/map.ts. */
  static edit_towers(save_file: SaveFile): void {
    save_file.tower.chapters.edit_chapters(save_file, "V", 7000);
  }
}
