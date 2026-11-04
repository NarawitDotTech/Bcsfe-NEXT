/** Port of bcsfe/core/server/event_data.py */
import type { Data } from "@/lib/bcsfe/core/io/data";
import { CSV } from "@/lib/bcsfe/core/io/bc_csv";
import type { Row } from "@/lib/bcsfe/core/io/bc_csv";

export class FilterDate {
  start_mmdd: number;
  start_hhmm: number;
  end_mmdd: number;
  end_hhmm: number;

  constructor(start_mmdd: number, start_hhmm: number, end_mmdd: number, end_hhmm: number) {
    this.start_mmdd = start_mmdd;
    this.start_hhmm = start_hhmm;
    this.end_mmdd = end_mmdd;
    this.end_hhmm = end_hhmm;
  }

  static from_csv_row(row: Row): FilterDate {
    const a = row.next_int();
    const b = row.next_int();
    const c = row.next_int();
    const d = row.next_int();
    return new FilterDate(a, b, c, d);
  }
}

export class FilterItem {
  filter_date: FilterDate | null;
  filter_day_flags: boolean[];
  filter_week: number;
  filter_times_start_end_hhmm: [number, number][];

  constructor(
    filter_date: FilterDate | null,
    filter_day_flags: boolean[],
    filter_week: number,
    filter_times_start_end_hhmm: [number, number][],
  ) {
    this.filter_date = filter_date;
    this.filter_day_flags = filter_day_flags;
    this.filter_week = filter_week;
    this.filter_times_start_end_hhmm = filter_times_start_end_hhmm;
  }

  static from_csv_row(row: Row): FilterItem {
    const filter_date_enabled = row.next_bool();
    let filter_date: FilterDate | null = null;
    if (filter_date_enabled) filter_date = FilterDate.from_csv_row(row);

    const filter_day_count = row.next_int();
    const filter_day_flags: boolean[] = new Array<boolean>(31).fill(false);
    for (let i = 0; i < filter_day_count; i++) {
      const day_ind = row.next_int() - 1;
      if (day_ind >= 0 && day_ind < filter_day_flags.length) filter_day_flags[day_ind] = true;
    }
    const filter_week = row.next_int();
    const filter_time_count = row.next_int();
    const times: [number, number][] = [];
    for (let i = 0; i < filter_time_count; i++) {
      const start_hhmm = row.next_int();
      const end_hhmm = row.next_int();
      times.push([start_hhmm, end_hhmm]);
    }
    return new FilterItem(filter_date, filter_day_flags, filter_week, times);
  }
}

export function split_yyyymmdd(yyyymmdd: number): [number, number, number] {
  const year = Math.floor(yyyymmdd / 10000);
  const month = Math.floor((yyyymmdd % 10000) / 100);
  const day = yyyymmdd % 100;
  return [year, month, day];
}

export function split_hhmm(hhmm: number): [number, number] {
  return [Math.floor(hhmm / 100), hhmm % 100];
}

export class FilterData {
  start_yyyymmdd: number;
  start_hhmm: number;
  end_yyyymmdd: number;
  end_hhmm: number;
  min_game_version: number;
  max_game_version: number;
  platform_flag: number;
  filter_items: FilterItem[];

  constructor(
    start_yyyymmdd: number,
    start_hhmm: number,
    end_yyyymmdd: number,
    end_hhmm: number,
    min_game_version: number,
    max_game_version: number,
    platform_flag: number,
    filter_items: FilterItem[],
  ) {
    this.start_yyyymmdd = start_yyyymmdd;
    this.start_hhmm = start_hhmm;
    this.end_yyyymmdd = end_yyyymmdd;
    this.end_hhmm = end_hhmm;
    this.min_game_version = min_game_version;
    this.max_game_version = max_game_version;
    this.platform_flag = platform_flag;
    this.filter_items = filter_items;
  }

  static from_csv_row(row: Row): FilterData {
    const start_yyyymmdd = row.next_int();
    const start_hhmm = row.next_int();
    const end_yyyymmdd = row.next_int();
    const end_hhmm = row.next_int();
    const min_game_version = row.next_int();
    const max_game_version = row.next_int();
    const platform_flag = row.next_int();
    const total_items = row.next_int();
    const filter_items: FilterItem[] = [];
    for (let i = 0; i < total_items; i++) filter_items.push(FilterItem.from_csv_row(row));
    return new FilterData(
      start_yyyymmdd,
      start_hhmm,
      end_yyyymmdd,
      end_hhmm,
      min_game_version,
      max_game_version,
      platform_flag,
      filter_items,
    );
  }
}

export class Localization {
  lang: string;
  title: string;
  message: string;

  constructor(lang: string, title: string, message: string) {
    this.lang = lang;
    this.title = title;
    this.message = message;
  }

  static from_csv_row(row: Row): Localization {
    const lang = row.next_str();
    const title = row.next_str();
    const message = row.next_str();
    return new Localization(lang, title, message);
  }
}

export class RarityGatya {
  prob: number;
  guaranteed: number;

  constructor(prob: number, guaranteed: number) {
    this.prob = prob;
    this.guaranteed = guaranteed;
  }

  static from_csv_row(row: Row): RarityGatya {
    const prob = row.next_int();
    const guaranteed = row.next_int();
    return new RarityGatya(prob, guaranteed);
  }
}

export class ServerGatyaDataSet {
  number: number;
  catfood: number;
  stage_progress: number;
  flags: number;
  rarity_info: RarityGatya[];
  message: string;
  other_event_message: [string, string] | null;

  constructor(
    number: number,
    catfood: number,
    stage_progress: number,
    flags: number,
    rarity_info: RarityGatya[],
    message: string,
    collab_message: [string, string] | null,
  ) {
    this.number = number;
    this.catfood = catfood;
    this.stage_progress = stage_progress;
    this.flags = flags;
    this.rarity_info = rarity_info;
    this.message = message;
    this.other_event_message = collab_message;
  }

  static from_csv_row(row: Row, flag: number): ServerGatyaDataSet {
    const number = row.next_int();
    const catfood = row.next_int();
    const stage_progress = row.next_int();
    const flags = row.next_int();
    const rarity_info: RarityGatya[] = [];
    for (let i = 0; i < 5; i++) rarity_info.push(RarityGatya.from_csv_row(row));
    const message = row.next_str();
    let collab_message: [string, string] | null = null;
    if (flag === 4) {
      const a = row.next_str();
      const b = row.next_str();
      collab_message = [a, b];
    }
    return new ServerGatyaDataSet(
      number,
      catfood,
      stage_progress,
      flags,
      rarity_info,
      message,
      collab_message,
    );
  }

  is_visible_silhouette(): boolean {
    return (this.flags & 1) !== 0;
  }
  is_required_user_rank_1600(): boolean {
    return (this.flags & 2) !== 0;
  }
  has_stepup_gatya(): boolean {
    return (this.flags & 4) !== 0;
  }
}

export class ServerGatyaDataItem {
  filter: FilterData;
  flags: number;
  sets: ServerGatyaDataSet[];

  constructor(filter: FilterData, flags: number, sets: ServerGatyaDataSet[]) {
    this.filter = filter;
    this.flags = flags;
    this.sets = sets;
  }

  static from_csv_row(row: Row): ServerGatyaDataItem {
    const filter = FilterData.from_csv_row(row);
    const flag = row.next_int();
    const count = row.next_int();
    const sets: ServerGatyaDataSet[] = [];
    for (let i = 0; i < count; i++) sets.push(ServerGatyaDataSet.from_csv_row(row, flag));
    return new ServerGatyaDataItem(filter, flag, sets);
  }

  get_normal_flag(): boolean {
    return this.flags === 0;
  }
  get_rare_flag(): boolean {
    return this.flags >= 1 && this.flags <= 3;
  }
  get_collab_flag(): boolean {
    return this.flags === 4;
  }
  get_first_rare_flag(): boolean {
    return this.flags === 2;
  }
  get_first_rare_10_flag(): boolean {
    return this.flags === 3;
  }
}

export class ServerItemDataItem {
  filter: FilterData;
  event_number: number;
  item_number: number;
  item_unit: number;
  title: string;
  message: string;
  stage_progress: number;
  stage_progress_flag: boolean;
  flags: number;
  locales: Localization[] | null;

  constructor(
    filter: FilterData,
    event_number: number,
    item_number: number,
    item_unit: number,
    title: string,
    message: string,
    stage_progress: number,
    stage_progress_flag: boolean,
    flags: number,
    locales: Localization[] | null,
  ) {
    this.filter = filter;
    this.event_number = event_number;
    this.item_number = item_number;
    this.item_unit = item_unit;
    this.title = title;
    this.message = message;
    this.stage_progress = stage_progress;
    this.stage_progress_flag = stage_progress_flag;
    this.flags = flags;
    this.locales = locales;
  }

  is_every_day(): boolean {
    return (this.flags & 1) !== 0;
  }
  is_required_user_rank_1600(): boolean {
    return (this.flags & 2) !== 0;
  }

  static from_csv_row(row: Row): ServerItemDataItem {
    const filter = FilterData.from_csv_row(row);
    const event_number = row.next_int();
    const item_number = row.next_int();
    const item_unit = row.next_int();
    const title = row.next_str();
    const message = row.next_str();
    const stage_progress = row.next_int();
    const stage_progress_flag = row.next_bool();
    const flags = row.next_int();
    let locales: Localization[] | null = null;
    if (!row.done()) {
      locales = [];
      const total_locales = row.next_int();
      for (let i = 0; i < total_locales; i++) locales.push(Localization.from_csv_row(row));
    }
    return new ServerItemDataItem(
      filter,
      event_number,
      item_number,
      item_unit,
      title,
      message,
      stage_progress,
      stage_progress_flag,
      flags,
      locales,
    );
  }
}

export function read_event_data<Item, T>(
  csv: CSV,
  read_func: (row: Row) => Item,
  init_func: (items: Item[]) => T,
): T | null {
  const start = csv.read_line();
  if (start === null || start === undefined) return null;
  if (start.next_str() !== "[start]") return null;
  if (!start.done()) return null;

  const items: Item[] = [];
  for (;;) {
    const row = csv.read_line();
    if (row === null || row === undefined) return null;
    if (row.length === 0) return null;
    if (row.get(0).to_str() === "[end]") break;
    items.push(read_func(row));
  }
  return init_func(items);
}

function tsvCsv(data: Data): CSV {
  // Python: CSV(data, delimiter="\t", remove_comments=False, remove_empty=False)
  return new CSV(data, "\t", false, false, false);
}

export class ServerItemData {
  items: ServerItemDataItem[];

  constructor(items: ServerItemDataItem[]) {
    this.items = items;
  }

  static from_csv(csv: CSV): ServerItemData | null {
    return read_event_data(
      csv,
      (r) => ServerItemDataItem.from_csv_row(r),
      (i) => new ServerItemData(i),
    );
  }

  static from_data(data: Data): ServerItemData | null {
    return ServerItemData.from_csv(tsvCsv(data));
  }
}

export class ServerGatyaData {
  items: ServerGatyaDataItem[];

  constructor(items: ServerGatyaDataItem[]) {
    this.items = items;
  }

  static from_csv(csv: CSV): ServerGatyaData | null {
    return read_event_data(
      csv,
      (r) => ServerGatyaDataItem.from_csv_row(r),
      (i) => new ServerGatyaData(i),
    );
  }

  static from_data(data: Data): ServerGatyaData | null {
    return ServerGatyaData.from_csv(tsvCsv(data));
  }
}
