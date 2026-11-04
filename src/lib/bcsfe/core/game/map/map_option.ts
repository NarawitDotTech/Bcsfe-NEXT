/** Port of bcsfe/core/game/map/map_option.py */
import type { SaveFile } from "@/lib/bcsfe/core/io/save";
import { core_data } from "@/lib/bcsfe/core/core_data";
import { CSV, type Row } from "@/lib/bcsfe/core/io/bc_csv";
import { times } from "@/lib/bcsfe/core/utils";

export class MapOptionLine {
  map_id: number;
  crown_count: number;
  crown_mults: number[];
  guerrilla_set: number;
  reset_type: number;
  one_time_display: boolean;
  display_order: number;
  interval: number;
  challenge_flag: boolean;
  difficulty_mask: number;
  hide_after_clear: boolean;
  name: string;

  constructor(
    map_id: number,
    crown_count: number,
    crown_mults: number[],
    guerrilla_set: number,
    reset_type: number,
    one_time_display: boolean,
    display_order: number,
    interval: number,
    challenge_flag: boolean,
    difficulty_mask: number,
    hide_after_clear: boolean,
    name: string,
  ) {
    this.map_id = map_id;
    this.crown_count = crown_count;
    this.crown_mults = crown_mults;
    this.guerrilla_set = guerrilla_set;
    this.reset_type = reset_type;
    this.one_time_display = one_time_display;
    this.display_order = display_order;
    this.interval = interval;
    this.challenge_flag = challenge_flag;
    this.difficulty_mask = difficulty_mask;
    this.hide_after_clear = hide_after_clear;
    this.name = name;
  }

  static from_line(line: Row): MapOptionLine {
    // Argument evaluation order matches Python (left to right).
    const map_id = line.next_int();
    const crown_count = line.next_int();
    const crown_mults = times(4, () => line.next_int());
    const guerrilla_set = line.next_int();
    const reset_type = line.next_int();
    const one_time_display = line.next_bool();
    const display_order = line.next_int();
    const interval = line.next_int();
    const challenge_flag = line.next_bool();
    const difficulty_mask = line.next_int();
    const hide_after_clear = line.next_bool();
    const name = line.next_str();
    return new MapOptionLine(
      map_id,
      crown_count,
      crown_mults,
      guerrilla_set,
      reset_type,
      one_time_display,
      display_order,
      interval,
      challenge_flag,
      difficulty_mask,
      hide_after_clear,
      name,
    );
  }
}

export class MapOption {
  maps: Map<number, MapOptionLine>;
  constructor(maps: Map<number, MapOptionLine>) {
    this.maps = maps;
  }

  static from_csv(csv: CSV): MapOption {
    const data = new Map<number, MapOptionLine>();
    for (const line of csv.lines.slice(1)) {
      // skip headers
      const item = MapOptionLine.from_line(line);
      data.set(item.map_id, item);
    }
    return new MapOption(data);
  }

  static from_save(save_file: SaveFile): MapOption | null {
    const gdg = core_data.get_game_data_getter(save_file);
    const data = gdg.download("DataLocal", "Map_option.csv");
    if (data === null || data === undefined) return null;
    const csv = new CSV(data);
    return MapOption.from_csv(csv);
  }

  get_map(map_id: number): MapOptionLine | null {
    return this.maps.get(map_id) ?? null;
  }
}
