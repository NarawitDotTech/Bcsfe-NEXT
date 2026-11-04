/** Port of bcsfe/core/game/map/map_names.py */
import type { SaveFile } from "@/lib/bcsfe/core/io/save";
import { core_data } from "@/lib/bcsfe/core/core_data";
import { CSV, Delimeter } from "@/lib/bcsfe/core/io/bc_csv";
import { floordiv } from "@/lib/bcsfe/core/utils";

export class MapNames {
  save_file: SaveFile;
  out: boolean;
  code: string;
  base_index: number;
  no_r_prefix: boolean;
  gdg: ReturnType<typeof core_data.get_game_data_getter>;
  map_names: Map<number, string | null>;
  stage_names: Map<number, string[]>;

  constructor(
    save_file: SaveFile,
    code: string,
    base_index: number,
    output = true,
    no_r_prefix = false,
  ) {
    this.save_file = save_file;
    this.out = output;
    this.code = code;
    this.base_index = base_index;
    this.no_r_prefix = no_r_prefix;
    this.gdg = core_data.get_game_data_getter(this.save_file);
    this.map_names = new Map();
    this.stage_names = new Map();
    this.get_map_names();
  }

  get_map_names_in_game(base_index: number, total_stages: number): Map<number, string | null> | null {
    const gdg = core_data.get_game_data_getter(this.save_file);
    const map_name_data = gdg.download("resLocal", "Map_Name.csv");
    if (map_name_data === null || map_name_data === undefined) return null;

    const csv = new CSV(map_name_data, Delimeter.from_country_code_res(this.save_file.cc));
    const names = new Map<number, string | null>();
    for (const row of csv) {
      const id = row.get(0).to_int();
      const name = row.get(1).to_str().trim();

      for (let i = 0; i < total_stages; i++) {
        const index = i + base_index;
        if (id === index) {
          if (name) {
            names.set(i, name);
          } else {
            names.set(i, null);
          }
          break;
        }
      }
    }
    return names;
  }

  get_map_names(): Map<number, string | null> | null {
    const gdg = core_data.get_game_data_getter(this.save_file);
    const r_prefix = this.no_r_prefix ? "" : "R";
    const stage_names = gdg.download(
      "resLocal",
      `StageName_${r_prefix}${this.code}_${core_data.get_lang(this.save_file)}.csv`,
    );
    if (stage_names === null || stage_names === undefined) return null;
    const csv = new CSV(stage_names, Delimeter.from_country_code_res(this.save_file.cc));
    let i = 0;
    for (const row of csv) {
      const stage_names_row = row.to_str_list();
      if (stage_names_row.length > 0) {
        this.stage_names.set(i, stage_names_row);
      }
      i++;
    }

    const names = this.get_map_names_in_game(this.base_index, this.stage_names.size);
    if (names === null) return null;
    this.map_names = names;
    return this.map_names;
  }

  static get_code_from_id(id: number): string | null {
    const base_id = floordiv(id, 1000);
    const ids: Record<number, string> = {
      0: "RN",
      1: "RS",
      2: "RC",
      4: "EX",
      6: "RT",
      7: "RV",
      11: "RR",
      12: "RM",
      13: "RNA",
      14: "RB",
      16: "RD",
      20: "Z",
      21: "Z",
      22: "Z",
      24: "RA",
      25: "RH",
      27: "RCA",
      30: "DM",
      31: "RQ",
      32: "L",
      34: "RND",
    };
    return ids[base_id] ?? null;
  }

  static from_id(id: number, save_file: SaveFile): MapNames | null {
    const code = MapNames.get_code_from_id(id);
    if (code === null) return null;
    return new MapNames(save_file, code, id, true, true);
  }
}
