/** Port of bcsfe/core/game/map/uncanny.py */
import type { Data } from "@/lib/bcsfe/core/io/data";
import type { SaveFile } from "@/lib/bcsfe/core/io/save";
import { Chapters, type ChapterSerialized } from "@/lib/bcsfe/core/game/map/chapters";
import type { MapNames } from "@/lib/bcsfe/core/game/map/map_names";

export class UncannyChapters {
  chapters: Chapters;
  unknown: number[];

  constructor(chapters: Chapters, unknown: number[]) {
    this.chapters = chapters;
    this.unknown = unknown;
  }

  static init(): UncannyChapters {
    return new UncannyChapters(Chapters.init(), []);
  }

  static read(data: Data): UncannyChapters {
    const ch = Chapters.read(data, false);
    const unknown = data.read_int_list(ch.chapters.length);
    return new UncannyChapters(ch, unknown);
  }

  write(data: Data): void {
    this.chapters.write(data, false);
    data.write_int_list(this.unknown, false);
  }

  serialize(): { chapters: ChapterSerialized[][]; unknown: number[] } {
    return {
      chapters: this.chapters.serialize(),
      unknown: this.unknown,
    };
  }

  static deserialize(data: {
    chapters?: Partial<ChapterSerialized>[][];
    unknown?: number[];
  }): UncannyChapters {
    return new UncannyChapters(Chapters.deserialize(data.chapters ?? []), data.unknown ?? []);
  }

  /** Python: interactive; calls edit_chapters(save_file, "NA", 13000). Use edits/map.ts. */
  static edit_uncanny(save_file: SaveFile): void {
    save_file.uncanny.chapters.edit_chapters(save_file, "NA", 13000);
  }

  /** Set the same catamin clear amount for all given map ids (amount is now a parameter). */
  static catamin_clear_count_individual(
    save_file: SaveFile,
    map_ids: number[],
    clear_amount: number,
  ): void {
    for (const map_id of map_ids) {
      save_file.event_stages.chapter_completion_count.set(14_000 + map_id, clear_amount);
    }
  }

  /**
   * Set a catamin clear amount per map id (amounts is a map of map_id -> amount
   * instead of prompting for each map). `names` is kept for signature parity.
   */
  static catamin_clear_count_many(
    save_file: SaveFile,
    map_ids: number[],
    _names: MapNames,
    amounts: Map<number, number>,
  ): void {
    for (const map_id of map_ids) {
      const clear_amount = amounts.get(map_id);
      if (clear_amount === undefined) continue;
      save_file.event_stages.chapter_completion_count.set(14_000 + map_id, clear_amount);
    }
  }

  // NOTE: change_clear_amount_catamin / clear_unclear_catamin_stage / edit_catamin_stages
  // are purely interactive (menus); use the two methods above and edits/map.ts.
}

