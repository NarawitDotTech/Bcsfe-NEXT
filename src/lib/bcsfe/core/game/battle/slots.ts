import { Data } from "@/lib/bcsfe/core/io/data";
import type { GameVersion } from "@/lib/bcsfe/core/game_version";
import { filled, times } from "@/lib/bcsfe/core/utils";

export class EquipSlot {
  cat_id: number;
  constructor(cat_id: number) {
    this.cat_id = cat_id;
  }
  static read(stream: Data): EquipSlot {
    return new EquipSlot(stream.read_int());
  }
  write(stream: Data): void {
    stream.write_int(this.cat_id);
  }
  serialize(): number {
    return this.cat_id;
  }
  static deserialize(data: number): EquipSlot {
    return new EquipSlot(data);
  }
}

export class EquipSlots {
  slots: EquipSlot[];
  name = "";

  constructor(slots: EquipSlot[]) {
    this.slots = slots;
  }

  static read(stream: Data): EquipSlots {
    return new EquipSlots(times(10, () => EquipSlot.read(stream)));
  }

  static init(): EquipSlots {
    return new EquipSlots(times(10, () => new EquipSlot(-1)));
  }

  write(stream: Data): void {
    for (const slot of this.slots) slot.write(stream);
  }

  read_name(stream: Data): void {
    const length = stream.read_int();
    const start = stream.pos;
    try {
      this.name = stream.read_string(length);
    } catch (e) {
      if (!(e instanceof TypeError)) throw e; // UnicodeDecodeError equivalent
      stream.pos = start;
      this.name = stream.read_utf8_string_by_char_length(length);
    }
  }

  write_name(stream: Data): void {
    stream.write_string(this.name);
  }

  serialize(): Record<string, unknown> {
    return { slots: this.slots.map((s) => s.serialize()), name: this.name };
  }

  static deserialize(data: Record<string, unknown>): EquipSlots {
    const slots = new EquipSlots(
      ((data["slots"] as number[] | undefined) ?? []).map((s) => EquipSlot.deserialize(s)),
    );
    slots.name = (data["name"] as string | undefined) ?? "";
    return slots;
  }
}

export class LineUps {
  slots: EquipSlots[];
  selected_slot = 0;
  unlocked_slots = 0;
  slot_names_length: number;

  constructor(slots: EquipSlots[], total_slots = 15) {
    this.slots = slots;
    this.slot_names_length = total_slots;
  }

  static init(gv: GameVersion): LineUps {
    const length = gv.lt(90700) ? 10 : 15;
    return new LineUps(times(length, () => EquipSlots.init()), length);
  }

  static read(stream: Data, gv: GameVersion): LineUps {
    const length = gv.lt(90700) ? 10 : stream.read_byte();
    return new LineUps(times(length, () => EquipSlots.read(stream)));
  }

  write(stream: Data, gv: GameVersion): void {
    let length: number;
    if (gv.ge(90700)) {
      stream.write_byte(this.slots.length);
      length = this.slots.length;
    } else {
      length = 10;
    }
    if (length > this.slots.length) {
      // faithful to Python: appends `length` fresh slots
      this.slots = this.slots.concat(times(length, () => EquipSlots.init()));
    } else {
      this.slots = this.slots.slice(0, length);
    }
    for (const slot of this.slots) slot.write(stream);
  }

  read_2(stream: Data, gv: GameVersion): void {
    this.selected_slot = stream.read_int();
    if (gv.lt(90700)) {
      const l = stream.read_bool_list(10);
      this.unlocked_slots = l.filter((b) => b).length;
    } else {
      this.unlocked_slots = stream.read_byte();
    }
  }

  write_2(stream: Data, gv: GameVersion): void {
    stream.write_int(this.selected_slot);
    if (gv.lt(90700)) {
      const l = filled(false, 10);
      const unlocked = Math.min(this.unlocked_slots, 10);
      for (let i = 0; i < unlocked; i++) l[i] = true;
      stream.write_bool_list(l, false);
    } else {
      stream.write_byte(this.unlocked_slots);
    }
  }

  read_slot_names(stream: Data, gv: GameVersion): void {
    const total_slots = gv.ge(110600) ? stream.read_byte() : 15;
    for (let i = 0; i < total_slots; i++) {
      if (i < this.slots.length) {
        this.slots[i].read_name(stream);
      } else {
        const slot = EquipSlots.init();
        slot.read_name(stream);
        this.slots.push(slot);
      }
    }
    this.slot_names_length = total_slots;
  }

  write_slot_names(stream: Data, gv: GameVersion): void {
    if (gv.ge(110600)) stream.write_byte(this.slot_names_length);
    for (let i = 0; i < this.slot_names_length; i++) {
      if (i < this.slots.length) {
        this.slots[i].write_name(stream);
      } else {
        const slot = EquipSlots.init();
        slot.write_name(stream);
        this.slots.push(slot);
      }
    }
  }

  serialize(): Record<string, unknown> {
    return {
      slots: this.slots.map((s) => s.serialize()),
      selected_slot: this.selected_slot,
      unlocked_slots: this.unlocked_slots,
      slot_names_length: this.slot_names_length,
    };
  }

  static deserialize(data: Record<string, unknown>): LineUps {
    const l = new LineUps(
      ((data["slots"] as Record<string, unknown>[] | undefined) ?? []).map((s) => EquipSlots.deserialize(s)),
    );
    l.selected_slot = (data["selected_slot"] as number | undefined) ?? 0;
    l.unlocked_slots = (data["unlocked_slots"] as number | undefined) ?? 0;
    l.slot_names_length = (data["slot_names_length"] as number | undefined) ?? 0;
    return l;
  }

  /** Pure version of Python edit_unlocked_slots(): the new value is passed in. */
  edit_unlocked_slots(unlocked_slots: number): void {
    this.unlocked_slots = unlocked_slots;
  }
}
