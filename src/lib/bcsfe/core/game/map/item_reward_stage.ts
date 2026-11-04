import { Data } from "@/lib/bcsfe/core/io/data";
import type { GameVersion } from "@/lib/bcsfe/core/game_version";
import { mapToObject, objectToMap, times } from "@/lib/bcsfe/core/utils";

export class Stage {
  claimed: boolean;
  constructor(claimed: boolean) {
    this.claimed = claimed;
  }
  static init(): Stage {
    return new Stage(false);
  }
  static read(stream: Data): Stage {
    return new Stage(stream.read_bool());
  }
  write(stream: Data): void {
    stream.write_bool(this.claimed);
  }
  serialize(): boolean {
    return this.claimed;
  }
  static deserialize(data: boolean): Stage {
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
    for (const stage of this.stages) stage.write(stream);
  }
  serialize(): boolean[] {
    return this.stages.map((s) => s.serialize());
  }
  static deserialize(data: boolean[]): SubChapter {
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
  serialize(): boolean[][] {
    return this.sub_chapters.map((s) => s.serialize());
  }
  static deserialize(data: boolean[][]): SubChapterStars {
    return new SubChapterStars(data.map((s) => SubChapter.deserialize(s)));
  }
}

export class ItemObtain {
  flag: boolean;
  constructor(flag: boolean) {
    this.flag = flag;
  }
  static init(): ItemObtain {
    return new ItemObtain(false);
  }
  static read(stream: Data): ItemObtain {
    return new ItemObtain(stream.read_bool());
  }
  write(stream: Data): void {
    stream.write_bool(this.flag);
  }
  serialize(): boolean {
    return this.flag;
  }
  static deserialize(data: boolean): ItemObtain {
    return new ItemObtain(data);
  }
}

export class ItemObtainSet {
  item_obtains: Map<number, ItemObtain>;
  constructor(item_obtains: Map<number, ItemObtain>) {
    this.item_obtains = item_obtains;
  }
  static init(): ItemObtainSet {
    return new ItemObtainSet(new Map());
  }
  static read(stream: Data): ItemObtainSet {
    const m = new Map<number, ItemObtain>();
    const n = stream.read_int();
    for (let i = 0; i < n; i++) {
      const key = stream.read_int();
      m.set(key, ItemObtain.read(stream));
    }
    return new ItemObtainSet(m);
  }
  write(stream: Data): void {
    stream.write_int(this.item_obtains.size);
    for (const [id, o] of this.item_obtains) {
      stream.write_int(id);
      o.write(stream);
    }
  }
  serialize(): Record<string, unknown> {
    return { item_obtains: mapToObject(this.item_obtains, (o) => o.serialize()) };
  }
  static deserialize(data: Record<string, unknown>): ItemObtainSet {
    return new ItemObtainSet(
      objectToMap((data["item_obtains"] as Record<string, boolean> | undefined) ?? {}, (o) =>
        ItemObtain.deserialize(o),
      ),
    );
  }
}

export class ItemObtainSets {
  item_obtain_sets: Map<number, ItemObtainSet>;
  constructor(item_obtain_sets: Map<number, ItemObtainSet>) {
    this.item_obtain_sets = item_obtain_sets;
  }
  static init(): ItemObtainSets {
    return new ItemObtainSets(new Map());
  }
  static read(stream: Data): ItemObtainSets {
    const m = new Map<number, ItemObtainSet>();
    const n = stream.read_int();
    for (let i = 0; i < n; i++) {
      const key = stream.read_int();
      m.set(key, ItemObtainSet.read(stream));
    }
    return new ItemObtainSets(m);
  }
  write(stream: Data): void {
    stream.write_int(this.item_obtain_sets.size);
    for (const [id, s] of this.item_obtain_sets) {
      stream.write_int(id);
      s.write(stream);
    }
  }
  serialize(): Record<string, Record<string, unknown>> {
    return mapToObject(this.item_obtain_sets, (s) => s.serialize());
  }
  static deserialize(data: Record<string, Record<string, unknown>>): ItemObtainSets {
    return new ItemObtainSets(objectToMap(data, (s) => ItemObtainSet.deserialize(s)));
  }
}

export class UnobtainedItem {
  unobtained: boolean;
  constructor(unobtained: boolean) {
    this.unobtained = unobtained;
  }
  static init(): UnobtainedItem {
    return new UnobtainedItem(false);
  }
  static read(stream: Data): UnobtainedItem {
    return new UnobtainedItem(stream.read_bool());
  }
  write(stream: Data): void {
    stream.write_bool(this.unobtained);
  }
  serialize(): boolean {
    return this.unobtained;
  }
  static deserialize(data: boolean): UnobtainedItem {
    return new UnobtainedItem(data);
  }
}

export class UnobtainedItems {
  unobtained_items: Map<number, UnobtainedItem>;
  constructor(unobtained_items: Map<number, UnobtainedItem>) {
    this.unobtained_items = unobtained_items;
  }
  static init(): UnobtainedItems {
    return new UnobtainedItems(new Map());
  }
  static read(stream: Data): UnobtainedItems {
    const m = new Map<number, UnobtainedItem>();
    const n = stream.read_int();
    for (let i = 0; i < n; i++) {
      const key = stream.read_int();
      m.set(key, UnobtainedItem.read(stream));
    }
    return new UnobtainedItems(m);
  }
  write(stream: Data): void {
    stream.write_int(this.unobtained_items.size);
    for (const [id, u] of this.unobtained_items) {
      stream.write_int(id);
      u.write(stream);
    }
  }
  serialize(): Record<string, unknown> {
    return { unobtained_items: mapToObject(this.unobtained_items, (u) => u.serialize()) };
  }
  static deserialize(data: Record<string, unknown>): UnobtainedItems {
    return new UnobtainedItems(
      objectToMap((data["unobtained_items"] as Record<string, boolean> | undefined) ?? {}, (u) =>
        UnobtainedItem.deserialize(u),
      ),
    );
  }
}

export class ItemRewardChapters {
  sub_chapters: SubChapterStars[];
  item_obtains: ItemObtainSets = ItemObtainSets.init();
  unobtained_items: UnobtainedItems = UnobtainedItems.init();

  constructor(sub_chapters: SubChapterStars[]) {
    this.sub_chapters = sub_chapters;
  }

  static init(gv: GameVersion): ItemRewardChapters {
    if (gv.lt(20)) return new ItemRewardChapters([]);
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
    return new ItemRewardChapters(
      times(total_subchapters, () => SubChapterStars.init(total_stages, total_stars)),
    );
  }

  static read(stream: Data, gv: GameVersion): ItemRewardChapters {
    if (gv.lt(20)) return new ItemRewardChapters([]);
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
    return new ItemRewardChapters(sub_chapters);
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

  read_item_obtains(stream: Data): void {
    this.item_obtains = ItemObtainSets.read(stream);
    this.unobtained_items = UnobtainedItems.read(stream);
  }

  write_item_obtains(stream: Data): void {
    this.item_obtains.write(stream);
    this.unobtained_items.write(stream);
  }

  serialize(): Record<string, unknown> {
    return {
      sub_chapters: this.sub_chapters.map((s) => s.serialize()),
      item_obtains: this.item_obtains.serialize(),
      unobtained_items: this.unobtained_items.serialize(),
    };
  }

  static deserialize(data: Record<string, unknown>): ItemRewardChapters {
    const chapters = new ItemRewardChapters(
      ((data["sub_chapters"] as boolean[][][] | undefined) ?? []).map((s) => SubChapterStars.deserialize(s)),
    );
    chapters.item_obtains = ItemObtainSets.deserialize(
      (data["item_obtains"] as Record<string, Record<string, unknown>> | undefined) ?? {},
    );
    chapters.unobtained_items = UnobtainedItems.deserialize(
      (data["unobtained_items"] as Record<string, unknown> | undefined) ?? {},
    );
    return chapters;
  }
}
