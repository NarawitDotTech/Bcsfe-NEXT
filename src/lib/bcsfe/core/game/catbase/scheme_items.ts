import type { Data } from "@/lib/bcsfe/core/io/data";
import type { SaveFile } from "@/lib/bcsfe/core/io/save";
import type { Localizable } from "@/lib/bcsfe/core/game/localizable";
import { core_data } from "@/lib/bcsfe/core/core_data";
import { CSV } from "@/lib/bcsfe/core/io/bc_csv";
import { Cat } from "@/lib/bcsfe/core/game/catbase/cat";

export class SchemeDataItem {
  id: number;
  type: number;
  type_id: number;
  item_id: number;
  number: number;
  type_id2: number | null;
  item_id2: number | null;
  number2: number | null;
  type_id3: number | null;
  item_id3: number | null;
  number3: number | null;

  constructor(
    id: number,
    type: number,
    type_id: number,
    item_id: number,
    number: number,
    type_id2: number | null = null,
    item_id2: number | null = null,
    number2: number | null = null,
    type_id3: number | null = null,
    item_id3: number | null = null,
    number3: number | null = null,
  ) {
    this.id = id;
    this.type = type;
    this.type_id = type_id;
    this.item_id = item_id;
    this.number = number;
    this.type_id2 = type_id2;
    this.item_id2 = item_id2;
    this.number2 = number2;
    this.type_id3 = type_id3;
    this.item_id3 = item_id3;
    this.number3 = number3;
  }

  is_cat(): boolean {
    return this.type_id === 1;
  }

  get_name(localizable: Localizable): string | null {
    const key = `scheme_popup_${this.id}`;
    const name = localizable.get(key);
    if (name === null || name === undefined) return null;
    return name.split("<flash>,").join("").split("<flash>").join("");
  }
}

export class SchemeItems {
  to_obtain: number[];
  received: number[];

  constructor(to_obtain: number[], received: number[]) {
    this.to_obtain = to_obtain;
    this.received = received;
  }

  static init(): SchemeItems {
    return new SchemeItems([], []);
  }

  static read(stream: Data): SchemeItems {
    let total = stream.read_int();
    const to_obtain: number[] = [];
    for (let i = 0; i < total; i++) to_obtain.push(stream.read_int());
    total = stream.read_int();
    const received: number[] = [];
    for (let i = 0; i < total; i++) received.push(stream.read_int());
    return new SchemeItems(to_obtain, received);
  }

  write(stream: Data): void {
    stream.write_int(this.to_obtain.length);
    for (const item of this.to_obtain) stream.write_int(item);
    stream.write_int(this.received.length);
    for (const item of this.received) stream.write_int(item);
  }

  serialize(): Record<string, number[]> {
    return { to_obtain: this.to_obtain, received: this.received };
  }

  static deserialize(data: Record<string, number[]>): SchemeItems {
    return new SchemeItems(data["to_obtain"] ?? [], data["received"] ?? []);
  }

  /**
   * Pure replacement for the interactive part of Python `edit`: loads the scheme
   * data and builds the display strings. Returns null when data is unavailable.
   * Then call `add_scheme_items` / `remove_scheme_items` with the selected indexes.
   */
  get_options(
    save_file: SaveFile,
  ): { options: string[]; scheme_items: Map<number, SchemeDataItem> } | null {
    const item_names = core_data.get_gatya_item_names(save_file);
    const localizable = save_file.get_localizable();
    const scheme_data = core_data
      .get_game_data_getter(save_file)
      .download("DataLocal", "schemeItemData.tsv");
    if (scheme_data === null) return null;
    const csv = new CSV(scheme_data, "\t");
    const scheme_items = new Map<number, SchemeDataItem>();
    for (const line of csv.lines.slice(1)) {
      scheme_items.set(
        line.get(0).to_int(),
        new SchemeDataItem(
          line.get(0).to_int(),
          line.get(1).to_int(),
          line.get(2).to_int(),
          line.get(3).to_int(),
          line.get(4).to_int(),
          line.get(5).to_int(),
          line.get(6).to_int(),
          line.get(7).to_int(),
          line.get(8).to_int(),
          line.get(9).to_int(),
          line.get(10).to_int(),
        ),
      );
    }

    const options: string[] = [];
    for (const item of scheme_items.values()) {
      const scheme_name = item.get_name(localizable);
      if (scheme_name === null) return null;
      let str = "\n\t";
      if (item.is_cat()) {
        const cat_names = Cat.get_names(item.item_id, save_file);
        if (cat_names && cat_names.length > 0) {
          const cat_name = cat_names[0];
          str += scheme_name.split("%@").join(cat_name);
        }
      } else {
        const item_name = item_names.get_name(item.item_id);
        if (item_name) {
          str += scheme_name;
          const first_index = str.indexOf("%@");
          const second_index = str.indexOf("%@", first_index + 1);
          str =
            str.slice(0, first_index) +
            String(item.number) +
            " " +
            item_name +
            str.slice(second_index + 2);
        }
      }
      str = str.split("<br>").join("\n\t");
      options.push(str);
    }
    return { options, scheme_items };
  }

  /** `scheme_ids` are the selected option indexes (as returned by the Python multi-select). */
  add_scheme_items(scheme_ids: number[], scheme_items: Map<number, SchemeDataItem>): void {
    const keys = Array.from(scheme_items.keys());
    for (const option_id of scheme_ids) {
      const scheme_id = keys[option_id];
      if (!this.to_obtain.includes(scheme_id)) this.to_obtain.push(scheme_id);
      const idx = this.received.indexOf(scheme_id);
      if (idx !== -1) this.received.splice(idx, 1);
    }
  }

  remove_scheme_items(scheme_ids: number[], scheme_items: Map<number, SchemeDataItem>): void {
    const keys = Array.from(scheme_items.keys());
    for (const option_id of scheme_ids) {
      const scheme_id = keys[option_id];
      let idx = this.to_obtain.indexOf(scheme_id);
      if (idx !== -1) this.to_obtain.splice(idx, 1);
      idx = this.received.indexOf(scheme_id);
      if (idx !== -1) this.received.splice(idx, 1);
    }
  }
}
