import type { Data } from "@/lib/bcsfe/core/io/data";
import type { SaveFile } from "@/lib/bcsfe/core/io/save";
import { core_data } from "@/lib/bcsfe/core/core_data";
import { CSV } from "@/lib/bcsfe/core/io/bc_csv";
import { mapToObject, objectToMap } from "@/lib/bcsfe/core/utils";

export class Medals {
  u1: number;
  u2: number;
  u3: number;
  medal_data_1: number[];
  medal_data_2: Map<number, number>;
  ub: boolean;

  constructor(
    u1: number,
    u2: number,
    u3: number,
    medal_data_1: number[],
    medal_data_2: Map<number, number>,
    ub: boolean,
  ) {
    this.u1 = u1;
    this.u2 = u2;
    this.u3 = u3;
    this.medal_data_1 = medal_data_1;
    this.medal_data_2 = medal_data_2;
    this.ub = ub;
  }

  static init(): Medals {
    return new Medals(0, 0, 0, [], new Map(), false);
  }

  static read(data: Data): Medals {
    const u1 = data.read_int();
    const u2 = data.read_int();
    const u3 = data.read_int();
    let total_medals = data.read_short();
    const medal_data_1 = data.read_short_list(total_medals);
    total_medals = data.read_short();
    const medal_data_2 = new Map<number, number>();
    for (let i = 0; i < total_medals; i++) {
      const key = data.read_short();
      const value = data.read_byte();
      medal_data_2.set(key, value);
    }
    const ub = data.read_bool();
    return new Medals(u1, u2, u3, medal_data_1, medal_data_2, ub);
  }

  write(data: Data): void {
    data.write_int(this.u1);
    data.write_int(this.u2);
    data.write_int(this.u3);
    data.write_short(this.medal_data_1.length);
    data.write_short_list(this.medal_data_1, false);
    data.write_short(this.medal_data_2.size);
    for (const [key, value] of this.medal_data_2) {
      data.write_short(key);
      data.write_byte(value);
    }
    data.write_bool(this.ub);
  }

  serialize(): Record<string, unknown> {
    return {
      u1: this.u1,
      u2: this.u2,
      u3: this.u3,
      medal_data_1: this.medal_data_1,
      medal_data_2: mapToObject(this.medal_data_2),
      ub: this.ub,
    };
  }

  static deserialize(data: Record<string, unknown>): Medals {
    return new Medals(
      (data["u1"] as number | undefined) ?? 0,
      (data["u2"] as number | undefined) ?? 0,
      (data["u3"] as number | undefined) ?? 0,
      (data["medal_data_1"] as number[] | undefined) ?? [],
      objectToMap(data["medal_data_2"] as Record<string, number> | undefined),
      (data["ub"] as boolean | undefined) ?? false,
    );
  }

  has_medal(medal_id: number): boolean {
    return this.medal_data_1.includes(medal_id);
  }

  /**
   * Pure replacement for the interactive Python `edit_medals`: returns the
   * `[medal_id, display_string]` choices that could be added (add_medals=true)
   * or removed (add_medals=false). Apply the selection with
   * `Medals.apply_medal_selection`.
   */
  static get_medals_to_choose_from(
    save_file: SaveFile,
    add_medals: boolean,
  ): [number, string][] {
    const medals = save_file.medals;
    const medal_names = core_data.get_medal_names(save_file);
    const out: [number, string][] = [];
    if (medal_names.medal_names === null) return out;
    medal_names.medal_names.forEach((medal, i) => {
      if (medal.length === 0) return;
      if (medals.has_medal(i) === add_medals) return;
      const string = core_data.local_manager.get_key("medal_string", {
        medal_name: medal[0],
        medal_req: medal[1],
      });
      out.push([i, string]);
    });
    return out;
  }

  static apply_medal_selection(
    save_file: SaveFile,
    medal_ids: number[],
    add_medals: boolean,
  ): void {
    const medals = save_file.medals;
    for (const medal_id of medal_ids) {
      if (add_medals) medals.add_medal(medal_id);
      else medals.remove_medal(medal_id);
    }
  }

  add_medal(medal_id: number): void {
    if (this.has_medal(medal_id)) return;
    this.medal_data_1.push(medal_id);
    this.medal_data_2.set(medal_id, 0);
  }

  remove_medal(medal_id: number): void {
    this.medal_data_2.delete(medal_id);
    const idx = this.medal_data_1.indexOf(medal_id);
    if (idx !== -1) this.medal_data_1.splice(idx, 1);
  }
}

export class MedalNames {
  save_file: SaveFile;
  medal_names: string[][] | null;

  constructor(save_file: SaveFile) {
    this.save_file = save_file;
    this.medal_names = this.get_medal_names();
  }

  get_medal_names(): string[][] | null {
    const file_name = "medalname.tsv";
    const gdg = core_data.get_game_data_getter(this.save_file);
    const data = gdg.download("resLocal", file_name);
    if (data === null) return null;
    const csv = new CSV(data, "\t");
    const names: string[][] = [];
    for (const row of csv.lines) names.push(row.to_str_list());
    return names;
  }

  get_medal_name(medal_id: number): string[] | null {
    if (this.medal_names === null) return null;
    if (medal_id < 0 || medal_id >= this.medal_names.length) return [];
    return this.medal_names[medal_id];
  }
}
