import { Data } from "@/lib/bcsfe/core/io/data";
import { mapToObject, objectToMap, times } from "@/lib/bcsfe/core/utils";

export class CatSlot {
  cat_id: number;
  form: number;
  constructor(cat_id: number, form: number) {
    this.cat_id = cat_id;
    this.form = form;
  }
  static init(): CatSlot {
    return new CatSlot(0, 0);
  }
  static read(stream: Data): CatSlot {
    const cat_id = stream.read_short();
    const form = stream.read_byte();
    return new CatSlot(cat_id, form);
  }
  write(stream: Data): void {
    stream.write_short(this.cat_id);
    stream.write_byte(this.form);
  }
  serialize(): Record<string, number> {
    return { cat_id: this.cat_id, form: this.form };
  }
  static deserialize(data: Record<string, number>): CatSlot {
    return new CatSlot(data["cat_id"] ?? 0, data["form"] ?? 0);
  }
}

export class LineupCat {
  index: number;
  cats: CatSlot[];
  u1: number;
  u2: number;
  u3: number;
  constructor(index: number, cats: CatSlot[], u1: number, u2: number, u3: number) {
    this.index = index;
    this.cats = cats;
    this.u1 = u1;
    this.u2 = u2;
    this.u3 = u3;
  }
  static init(): LineupCat {
    return new LineupCat(0, times(10, () => CatSlot.init()), 0, 0, 0);
  }
  static read(stream: Data): LineupCat {
    const index = stream.read_short();
    const cats = times(10, () => CatSlot.read(stream));
    const u1 = stream.read_byte();
    const u2 = stream.read_byte();
    const u3 = stream.read_byte();
    return new LineupCat(index, cats, u1, u2, u3);
  }
  write(stream: Data): void {
    stream.write_short(this.index);
    for (const cat of this.cats) cat.write(stream);
    stream.write_byte(this.u1);
    stream.write_byte(this.u2);
    stream.write_byte(this.u3);
  }
  serialize(): Record<string, unknown> {
    return {
      index: this.index,
      cats: this.cats.map((c) => c.serialize()),
      u1: this.u1,
      u2: this.u2,
      u3: this.u3,
    };
  }
  static deserialize(data: Record<string, unknown>): LineupCat {
    return new LineupCat(
      (data["index"] as number | undefined) ?? 0,
      ((data["cats"] as Record<string, number>[] | undefined) ?? []).map((c) => CatSlot.deserialize(c)),
      (data["u1"] as number | undefined) ?? 0,
      (data["u2"] as number | undefined) ?? 0,
      (data["u3"] as number | undefined) ?? 0,
    );
  }
}

export class ClearedSlotsCat {
  lineups: LineupCat[];
  constructor(lineups: LineupCat[]) {
    this.lineups = lineups;
  }
  static init(): ClearedSlotsCat {
    return new ClearedSlotsCat([]);
  }
  static read(stream: Data): ClearedSlotsCat {
    const total = stream.read_short();
    return new ClearedSlotsCat(times(total, () => LineupCat.read(stream)));
  }
  write(stream: Data): void {
    stream.write_short(this.lineups.length);
    for (const l of this.lineups) l.write(stream);
  }
  serialize(): Record<string, unknown>[] {
    return this.lineups.map((l) => l.serialize());
  }
  static deserialize(data: Record<string, unknown>[]): ClearedSlotsCat {
    return new ClearedSlotsCat(data.map((l) => LineupCat.deserialize(l)));
  }
}

export class StageSlot {
  stage_id: number;
  constructor(stage_id: number) {
    this.stage_id = stage_id;
  }
  static init(): StageSlot {
    return new StageSlot(0);
  }
  static read(stream: Data): StageSlot {
    return new StageSlot(stream.read_int());
  }
  write(stream: Data): void {
    stream.write_int(this.stage_id);
  }
  serialize(): number {
    return this.stage_id;
  }
  static deserialize(data: number): StageSlot {
    return new StageSlot(data);
  }
}

export class StageLineups {
  index: number;
  slots: StageSlot[];
  constructor(index: number, slots: StageSlot[]) {
    this.index = index;
    this.slots = slots;
  }
  static init(): StageLineups {
    return new StageLineups(0, []);
  }
  static read(stream: Data): StageLineups {
    const index = stream.read_short();
    const total = stream.read_short();
    return new StageLineups(index, times(total, () => StageSlot.read(stream)));
  }
  write(stream: Data): void {
    stream.write_short(this.index);
    stream.write_short(this.slots.length);
    for (const s of this.slots) s.write(stream);
  }
  serialize(): Record<string, unknown> {
    return { index: this.index, slots: this.slots.map((s) => s.serialize()) };
  }
  static deserialize(data: Record<string, unknown>): StageLineups {
    return new StageLineups(
      (data["index"] as number | undefined) ?? 0,
      ((data["slots"] as number[] | undefined) ?? []).map((s) => StageSlot.deserialize(s)),
    );
  }
}

export class ClearedStageSlots {
  lineups: StageLineups[];
  constructor(lineups: StageLineups[]) {
    this.lineups = lineups;
  }
  static init(): ClearedStageSlots {
    return new ClearedStageSlots([]);
  }
  static read(stream: Data): ClearedStageSlots {
    const total = stream.read_short();
    return new ClearedStageSlots(times(total, () => StageLineups.read(stream)));
  }
  write(stream: Data): void {
    stream.write_short(this.lineups.length);
    for (const l of this.lineups) l.write(stream);
  }
  serialize(): Record<string, unknown> {
    return { lineups: this.lineups.map((l) => l.serialize()) };
  }
  static deserialize(data: Record<string, unknown>): ClearedStageSlots {
    return new ClearedStageSlots(
      ((data["lineups"] as Record<string, unknown>[] | undefined) ?? []).map((l) =>
        StageLineups.deserialize(l),
      ),
    );
  }
}

export class ClearedSlots {
  cleared_slots: ClearedSlotsCat;
  cleared_stage_slots: ClearedStageSlots;
  unknown: Map<number, boolean>;

  constructor(
    cleared_slots: ClearedSlotsCat,
    cleared_stage_slots: ClearedStageSlots,
    unknown: Map<number, boolean>,
  ) {
    this.cleared_slots = cleared_slots;
    this.cleared_stage_slots = cleared_stage_slots;
    this.unknown = unknown;
  }

  static init(): ClearedSlots {
    return new ClearedSlots(ClearedSlotsCat.init(), ClearedStageSlots.init(), new Map());
  }

  static read(stream: Data): ClearedSlots {
    const cleared_slots = ClearedSlotsCat.read(stream);
    const cleared_stage_slots = ClearedStageSlots.read(stream);
    const length = stream.read_short();
    const unknown = stream.read_short_bool_dict(length);
    return new ClearedSlots(cleared_slots, cleared_stage_slots, unknown);
  }

  write(stream: Data): void {
    this.cleared_slots.write(stream);
    this.cleared_stage_slots.write(stream);
    stream.write_short(this.unknown.size);
    stream.write_short_bool_dict(this.unknown, false);
  }

  serialize(): Record<string, unknown> {
    return {
      cleared_slots: this.cleared_slots.serialize(),
      cleared_stage_slots: this.cleared_stage_slots.serialize(),
      unknown: mapToObject(this.unknown),
    };
  }

  static deserialize(data: Record<string, unknown>): ClearedSlots {
    return new ClearedSlots(
      ClearedSlotsCat.deserialize((data["cleared_slots"] as Record<string, unknown>[] | undefined) ?? []),
      ClearedStageSlots.deserialize((data["cleared_stage_slots"] as Record<string, unknown> | undefined) ?? {}),
      objectToMap((data["unknown"] as Record<string, boolean> | undefined) ?? {}),
    );
  }
}
