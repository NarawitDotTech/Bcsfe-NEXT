import { Data } from "@/lib/bcsfe/core/io/data";
import type { SaveFile } from "@/lib/bcsfe/core/io/save";
import { core_data } from "@/lib/bcsfe/core/core_data";
import { times } from "@/lib/bcsfe/core/utils";

export class EndlessItem {
  active: boolean;
  unknown: boolean;
  amount: number;
  start: number;
  end: number;

  constructor(active: boolean, unknown: boolean, amount: number, start: number, end: number) {
    this.active = active;
    this.unknown = unknown;
    this.amount = amount;
    this.start = start;
    this.end = end;
  }

  static init(): EndlessItem {
    return new EndlessItem(false, false, 0, 0, 0);
  }

  static read(stream: Data): EndlessItem {
    // evaluation order matters (argument order == read order)
    const active = stream.read_bool();
    const unknown = stream.read_bool();
    const amount = stream.read_byte();
    const start = stream.read_double();
    const end = stream.read_double();
    return new EndlessItem(active, unknown, amount, start, end);
  }

  write(stream: Data): void {
    stream.write_bool(this.active);
    stream.write_bool(this.unknown);
    stream.write_byte(this.amount);
    stream.write_double(this.start);
    stream.write_double(this.end);
  }

  serialize(): Record<string, unknown> {
    return {
      active: this.active,
      unknown: this.unknown,
      amount: this.amount,
      start: this.start,
      end: this.end,
    };
  }

  static deserialize(data: Record<string, unknown>): EndlessItem {
    return new EndlessItem(
      (data["active"] as boolean | undefined) ?? false,
      (data["unknown"] as boolean | undefined) ?? false,
      (data["amount"] as number | undefined) ?? 0,
      (data["start"] as number | undefined) ?? 0.0,
      (data["end"] as number | undefined) ?? 0.0,
    );
  }

  /** Python returns a timedelta; here the duration in seconds (null = infinite). */
  get_endless_duration(): number | null {
    if (!this.active) return 0;
    if (this.end === Infinity) return null;
    if (Number.isNaN(this.end) || Number.isNaN(this.start)) return null;
    return this.end - this.start + this.amount * 3 * 60 * 60;
  }

  get_endless_duration_formatted(): string {
    const duration = this.get_endless_duration();
    if (duration === null) return core_data.local_manager.get_key("infinity_duration");
    const total = Math.floor(duration);
    const days = Math.floor(total / 86400);
    const secs = total - days * 86400;
    const hours = Math.floor(secs / 3600);
    const rem = secs - hours * 3600;
    const minutes = Math.floor(rem / 60);
    const seconds = rem - minutes * 60;
    return core_data.local_manager.get_key("duration", { days, hours, minutes, seconds });
  }

  set_duration_mins(mins: number, amount: number): void {
    this.active = true;
    this.unknown = true;
    this.amount = amount;
    this.start = Date.now() / 1000;
    this.end = this.start + mins * 60;
  }
}

export class BattleItem {
  amount: number;
  locked = false;
  endless_item: EndlessItem = EndlessItem.init();

  constructor(amount: number) {
    this.amount = amount;
  }

  static init(): BattleItem {
    return new BattleItem(0);
  }

  static read_amount(stream: Data): BattleItem {
    return new BattleItem(stream.read_int());
  }

  write_amount(stream: Data): void {
    stream.write_int(this.amount);
  }

  read_locked(stream: Data): void {
    this.locked = stream.read_bool();
  }

  write_locked(stream: Data): void {
    stream.write_bool(this.locked);
  }

  read_endless_items(stream: Data): void {
    this.endless_item = EndlessItem.read(stream);
  }

  write_endless_items(stream: Data): void {
    this.endless_item.write(stream);
  }

  serialize(): Record<string, unknown> {
    return {
      amount: this.amount,
      locked: this.locked,
      endless: this.endless_item.serialize(),
    };
  }

  static deserialize(data: Record<string, unknown>): BattleItem {
    const item = new BattleItem((data["amount"] as number | undefined) ?? 0);
    item.locked = (data["locked"] as boolean | undefined) ?? false;
    item.endless_item = EndlessItem.deserialize(
      (data["endless"] as Record<string, unknown> | undefined) ?? {},
    );
    return item;
  }
}

export class BattleItems {
  items: BattleItem[];
  lock_item = false;

  constructor(items: BattleItem[]) {
    this.items = items;
  }

  static init(): BattleItems {
    return new BattleItems(times(6, () => BattleItem.init()));
  }

  static read_items(stream: Data): BattleItems {
    return new BattleItems(times(6, () => BattleItem.read_amount(stream)));
  }

  write_items(stream: Data): void {
    for (const item of this.items) item.write_amount(stream);
  }

  read_locked_items(stream: Data): void {
    this.lock_item = stream.read_bool();
    for (const item of this.items) item.read_locked(stream);
  }

  write_locked_items(stream: Data): void {
    stream.write_bool(this.lock_item);
    for (const item of this.items) item.write_locked(stream);
  }

  read_endless_items(stream: Data): void {
    for (let i = 0; i < 6; i++) {
      if (i >= this.items.length) {
        EndlessItem.read(stream); // ensure we still read 6 items
      } else {
        this.items[i].read_endless_items(stream);
      }
    }
  }

  write_endless_items(stream: Data): void {
    for (let i = 0; i < 6; i++) {
      if (i >= this.items.length) {
        EndlessItem.init().write(stream); // ensure we still write 6 items
      } else {
        this.items[i].write_endless_items(stream);
      }
    }
  }

  serialize(): Record<string, unknown> {
    return {
      items: this.items.map((i) => i.serialize()),
      lock_item: this.lock_item,
    };
  }

  static deserialize(data: Record<string, unknown>): BattleItems {
    const bi = new BattleItems(
      ((data["items"] as Record<string, unknown>[] | undefined) ?? []).map((i) => BattleItem.deserialize(i)),
    );
    bi.lock_item = (data["lock_item"] as boolean | undefined) ?? false;
    return bi;
  }

  get_names(save_file: SaveFile): string[] | null {
    const names = core_data.get_gatya_item_names(save_file).names;
    if (names === null || names === undefined) return null;
    const items = core_data.get_gatya_item_buy(save_file).get_by_category(3);
    if (items === null || items === undefined) return null;
    return items.map((item: { id: number }) => names[item.id]);
  }

  /**
   * Pure version of Python edit(): the interactive prompt is replaced by the
   * new `values` (one per item, in order).
   */
  edit(values: number[]): void {
    values.forEach((value, i) => {
      this.items[i].amount = value;
    });
  }

  /**
   * Pure version of Python edit_endless_items(): `mins_by_index` maps item index
   * to the duration in minutes (Infinity allowed).
   */
  edit_endless_items(mins_by_index: Map<number, number>): void {
    for (const [i, mins] of mins_by_index) {
      this.items[i].endless_item.set_duration_mins(mins, 0);
    }
  }
}
