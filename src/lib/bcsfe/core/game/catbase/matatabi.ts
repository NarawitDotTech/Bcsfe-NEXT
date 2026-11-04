import type { SaveFile } from "@/lib/bcsfe/core/io/save";
import { core_data } from "@/lib/bcsfe/core/core_data";
import { CSV } from "@/lib/bcsfe/core/io/bc_csv";

export class Fruit {
  id: number;
  seed: boolean;
  group: number;
  sort: number;
  require: number | null;
  text: string | null;
  grow_up: number[] | null;

  constructor(
    id: number,
    seed: boolean,
    group: number,
    sort: number,
    require: number | null = null,
    text: string | null = null,
    grow_up: number[] | null = null,
  ) {
    this.id = id;
    this.seed = seed;
    this.group = group;
    this.sort = sort;
    this.require = require;
    this.text = text;
    this.grow_up = grow_up;
  }
}

export class Matatabi {
  save_file: SaveFile;
  matatabi: Fruit[] | null;
  gatya_item_names: ReturnType<typeof core_data.get_gatya_item_names>;

  constructor(save_file: SaveFile) {
    this.save_file = save_file;
    this.matatabi = this.__get_matatabi();
    this.gatya_item_names = core_data.get_gatya_item_names(this.save_file);
  }

  private __get_matatabi(): Fruit[] | null {
    const gdg = core_data.get_game_data_getter(this.save_file);
    const data = gdg.download("DataLocal", "Matatabi.tsv");
    if (data === null) return null;
    const csv = new CSV(data, "\t");
    const matatabi: Fruit[] = [];
    for (const line of csv.lines.slice(1)) {
      const id = line.get(0).to_int();
      const seed = line.get(1).to_bool();
      const group = line.get(2).to_int();
      const sort = line.get(3).to_int();
      const require = line.length > 4 ? line.get(4).to_int() : null;
      const text = line.length > 5 ? line.get(5).to_str() : null;
      let grow_up: number[] | null = null;
      if (line.length > 6) {
        grow_up = [];
        for (let i = 6; i < line.length; i++) grow_up.push(line.get(i).to_int());
      }
      matatabi.push(new Fruit(id, seed, group, sort, require, text, grow_up));
    }
    return matatabi;
  }

  get_names(): (string | null)[] | null {
    if (this.matatabi === null) return null;
    return this.matatabi.map((fruit) => this.gatya_item_names.get_name(fruit.id));
  }
}
