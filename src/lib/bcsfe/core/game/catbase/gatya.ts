import { Data } from "@/lib/bcsfe/core/io/data";
import type { GameVersion } from "@/lib/bcsfe/core/game_version";
import type { SaveFile } from "@/lib/bcsfe/core/io/save";
import type { CountryCode } from "@/lib/bcsfe/core/country_code";
import { core_data } from "@/lib/bcsfe/core/core_data";
import { CSV, type Row } from "@/lib/bcsfe/core/io/bc_csv";
import { RequestHandler } from "@/lib/bcsfe/core/server/request";
import { mapToObject, objectToMap } from "@/lib/bcsfe/core/utils";

/** Seeds are uint32 normally but uint64 (bigint) for game versions < 33. */
type Seed = number | bigint;

function seed_to_number(v: Seed): number {
  return typeof v === "bigint" ? Number(v) : v;
}

function seed_deserialize(v: unknown): Seed {
  if (typeof v === "string") return BigInt(v);
  if (typeof v === "number" || typeof v === "bigint") return v;
  return 0;
}

export class Gatya {
  rare_seed: Seed;
  normal_seed: Seed;
  event_seed: Seed;
  stepup_stage_3_cooldown: number;
  previous_normal_roll: number;
  previous_normal_roll_type: number;
  previous_rare_roll: number;
  previous_rare_roll_type: number;
  unknown1: boolean;
  roll_single: boolean;
  roll_multi: boolean;
  trade_progress: number;
  step_up_stages: Map<number, number>;
  stepup_durations: Map<number, number>;
  gatya_data_set: GatyaDataSet | null;

  constructor(rare_seed: Seed, normal_seed: Seed) {
    this.rare_seed = rare_seed;
    this.normal_seed = normal_seed;
    this.event_seed = 0;
    this.stepup_stage_3_cooldown = 0;
    this.previous_normal_roll = 0;
    this.previous_normal_roll_type = 0;
    this.previous_rare_roll = 0;
    this.previous_rare_roll_type = 0;
    this.unknown1 = false;
    this.roll_single = false;
    this.roll_multi = false;
    this.trade_progress = 0;
    this.step_up_stages = new Map();
    this.stepup_durations = new Map();
    this.gatya_data_set = null;
  }

  static init(): Gatya {
    return new Gatya(0, 0);
  }

  static read_rare_normal_seed(data: Data, gv: GameVersion): Gatya {
    if (gv.lt(33)) {
      const rare = data.read_ulong();
      const normal = data.read_ulong();
      return new Gatya(rare, normal);
    }
    const rare = data.read_uint();
    const normal = data.read_uint();
    return new Gatya(rare, normal);
  }

  read_event_seed(data: Data, gv: GameVersion): void {
    if (gv.lt(33)) this.event_seed = data.read_ulong();
    else this.event_seed = data.read_uint();
  }

  write_rare_normal_seed(data: Data): void {
    data.write_uint(seed_to_number(this.rare_seed));
    data.write_uint(seed_to_number(this.normal_seed));
  }

  write_event_seed(data: Data): void {
    data.write_uint(seed_to_number(this.event_seed));
  }

  read2(data: Data): void {
    this.stepup_stage_3_cooldown = data.read_int();
    this.previous_normal_roll = data.read_int();
    this.previous_normal_roll_type = data.read_int();
    this.previous_rare_roll = data.read_int();
    this.previous_rare_roll_type = data.read_int();
    this.unknown1 = data.read_bool();
    this.roll_single = data.read_bool();
    this.roll_multi = data.read_bool();
  }

  write2(data: Data): void {
    data.write_int(this.stepup_stage_3_cooldown);
    data.write_int(this.previous_normal_roll);
    data.write_int(this.previous_normal_roll_type);
    data.write_int(this.previous_rare_roll);
    data.write_int(this.previous_rare_roll_type);
    data.write_bool(this.unknown1);
    data.write_bool(this.roll_single);
    data.write_bool(this.roll_multi);
  }

  read_trade_progress(data: Data): void {
    this.trade_progress = data.read_int();
  }

  write_trade_progress(data: Data): void {
    data.write_int(this.trade_progress);
  }

  read_stepup(data: Data): void {
    this.step_up_stages = new Map();
    let total = data.read_int();
    for (let i = 0; i < total; i++) {
      const key = data.read_int();
      this.step_up_stages.set(key, data.read_int());
    }

    this.stepup_durations = new Map();
    total = data.read_int();
    for (let i = 0; i < total; i++) {
      const key = data.read_int();
      this.stepup_durations.set(key, data.read_double());
    }
  }

  write_stepup(data: Data): void {
    data.write_int(this.step_up_stages.size);
    for (const [id, stage] of this.step_up_stages) {
      data.write_int(id);
      data.write_int(stage);
    }
    data.write_int(this.stepup_durations.size);
    for (const [id, duration] of this.stepup_durations) {
      data.write_int(id);
      data.write_double(duration);
    }
  }

  serialize(): Record<string, unknown> {
    const s = (v: Seed) => (typeof v === "bigint" ? v.toString() : v);
    return {
      rare_seed: s(this.rare_seed),
      normal_seed: s(this.normal_seed),
      stepup_stage_3_cooldown: this.stepup_stage_3_cooldown,
      previous_normal_roll: this.previous_normal_roll,
      previous_normal_roll_type: this.previous_normal_roll_type,
      previous_rare_roll: this.previous_rare_roll,
      previous_rare_roll_type: this.previous_rare_roll_type,
      unknown1: this.unknown1,
      roll_single: this.roll_single,
      roll_multi: this.roll_multi,
      trade_progress: this.trade_progress,
      event_seed: s(this.event_seed),
      step_up_stages: mapToObject(this.step_up_stages),
      stepup_durations: mapToObject(this.stepup_durations),
    };
  }

  static deserialize(data: Record<string, unknown>): Gatya {
    const gatya = new Gatya(seed_deserialize(data["rare_seed"]), seed_deserialize(data["normal_seed"]));
    const n = (k: string, d: number) => (data[k] as number | undefined) ?? d;
    const b = (k: string) => (data[k] as boolean | undefined) ?? false;
    gatya.stepup_stage_3_cooldown = n("stepup_stage_3_cooldown", 0);
    gatya.previous_normal_roll = n("previous_normal_roll", 0);
    gatya.previous_normal_roll_type = n("previous_normal_roll_type", 0);
    gatya.previous_rare_roll = n("previous_rare_roll", 0);
    gatya.previous_rare_roll_type = n("previous_rare_roll_type", 0);
    gatya.unknown1 = b("unknown1");
    gatya.roll_single = b("roll_single");
    gatya.roll_multi = b("roll_multi");
    gatya.trade_progress = n("trade_progress", 0);
    gatya.event_seed = seed_deserialize(data["event_seed"]);
    gatya.step_up_stages = objectToMap(data["step_up_stages"] as Record<string, number> | undefined);
    gatya.stepup_durations = objectToMap(data["stepup_durations"] as Record<string, number> | undefined);
    return gatya;
  }

  /** Pure replacement for the interactive `edit_rare_gatya_seed`. */
  edit_rare_gatya_seed(value: number): void {
    this.rare_seed = value;
  }

  /** Pure replacement for the interactive `edit_normal_gatya_seed`. */
  edit_normal_gatya_seed(value: number): void {
    this.normal_seed = value;
  }

  /** Pure replacement for the interactive `edit_event_gatya_seed`. */
  edit_event_gatya_seed(value: number): void {
    this.event_seed = value;
  }

  read_gatya_data_set(save_file: SaveFile): GatyaDataSet {
    if (this.gatya_data_set !== null) return this.gatya_data_set;
    this.gatya_data_set = new GatyaDataSet(save_file);
    return this.gatya_data_set;
  }
}

export class GatyaDataSet {
  save_file: SaveFile;
  gatya_data_set: number[][] | null;

  constructor(save_file: SaveFile) {
    this.save_file = save_file;
    this.gatya_data_set = this.load_gatya_data_set("R", 1);
  }

  load_gatya_data_set(rarity: string, id: number): number[][] | null {
    const file_name = `GatyaDataSet${rarity.toUpperCase()[0]}${id}.csv`;
    const gdg = core_data.get_game_data_getter(this.save_file);
    const data = gdg.download("DataLocal", file_name);
    if (data === null) return null;
    const csv = new CSV(data);
    const dt: number[][] = [];
    for (const line of csv.lines) {
      const cat_ids: number[] = [];
      for (let i = 0; i < line.length; i++) {
        const cat_id = line.get(i).to_int();
        if (cat_id !== -1) cat_ids.push(cat_id);
      }
      dt.push(cat_ids);
    }
    return dt;
  }

  get_cat_ids(gatya_id: number): number[] | null {
    if (this.gatya_data_set === null) return null;
    const len = this.gatya_data_set.length;
    if (gatya_id >= len || gatya_id < -len) return null;
    return this.gatya_data_set[gatya_id < 0 ? gatya_id + len : gatya_id];
  }
}

export class GatyaInfo {
  gatya_id: number;
  cc: CountryCode;
  gatya_data_set: GatyaDataSet | null;
  type: string;
  data: Data | null;

  constructor(gatya_id: number, cc: CountryCode, type_str = "R") {
    this.gatya_id = gatya_id;
    this.cc = cc;
    this.gatya_data_set = null;
    this.type = type_str;
    this.data = null;
  }

  get_id_str(): string {
    return String(this.gatya_id).padStart(3, "0");
  }

  get_cc_str(): string {
    if (this.cc.get_code() === "jp") return "";
    return this.cc.get_patching_code() + "/";
  }

  get_url(): string {
    return `https://ponosgames.com/information/appli/battlecats/gacha/rare/${this.get_cc_str()}${this.type}${this.get_id_str()}.html`;
  }

  /** Async (network). */
  async download_data(): Promise<Data | null> {
    const url = this.get_url();
    const response = await new RequestHandler(url).get();
    if (response === null) return null;
    const data = new Data(new Uint8Array(await response.arrayBuffer()));
    this.save_data(data);
    return data;
  }

  /** Python saved the html into the local data folder; here it is only cached in memory. */
  save_data(data: Data): void {
    this.data = data;
  }

  /** No local file cache in the web port. */
  load_data_from_file(): Data | null {
    return null;
  }

  async get_data(): Promise<Data | null> {
    if (this.data !== null) return this.data;
    let data = this.load_data_from_file();
    if (data === null) data = await this.download_data();
    return data;
  }

  async get_name(): Promise<string | null> {
    const data = await this.get_data();
    if (data === null) return null;
    return GatyaInfo.parse_name(data);
  }

  /** Extracts the banner name (<h2>...</h2> minus <span>...</span>) from the html. */
  static parse_name(data: Data): string | null {
    const h2 = data.search(new Data("<h2>"));
    if (h2 === -1) return null;
    const h2_end = data.search(new Data("</h2>"), h2);
    if (h2_end === -1) return null;
    const text = new TextDecoder("utf-8", { fatal: true }).decode(
      data.get_bytes().slice(h2 + 4, h2_end),
    );
    const span = text.indexOf("<span");
    if (span === -1) return text;
    const span_end = text.indexOf("</span>", span);
    if (span_end === -1) return text;
    return text.slice(0, span) + text.slice(span_end + 7);
  }
}

export class GatyaInfos {
  save_file: SaveFile;
  type: string;
  set_id: number;
  gatya_data_set: number[][] | null;
  infos: GatyaInfo[];
  got_all: boolean;

  constructor(save_file: SaveFile, type_str = "R", set_id = 1) {
    this.save_file = save_file;
    this.type = type_str;
    this.set_id = set_id;
    this.gatya_data_set = new GatyaDataSet(save_file).load_gatya_data_set(type_str, set_id);
    this.infos = [];
    this.got_all = false;
  }

  /** Async. `print_progress` is accepted for parity but progress printing was dropped. */
  async get_all(threaded = true, _print_progress = true, max_threads = 16): Promise<void> {
    if (this.gatya_data_set === null) return;
    const all_ids = this.gatya_data_set.length;
    if (threaded) {
      let next = 0;
      const worker = async () => {
        while (next < all_ids) {
          const id = next++;
          await this.get(id);
        }
      };
      await Promise.all(Array.from({ length: Math.min(max_threads, all_ids) }, worker));
    } else {
      for (let id = 0; id < all_ids; id++) {
        await this.get(id);
      }
    }
    this.got_all = true;
  }

  async get(gatya_id: number, _print_progress = false): Promise<GatyaInfo> {
    const info = new GatyaInfo(gatya_id, this.save_file.cc, this.type);
    await info.get_data();
    this.infos.push(info);
    return info;
  }

  get_info(gatya_id: number): GatyaInfo | null {
    if (this.infos.length > 0) return this.infos[gatya_id] ?? null;
    return null;
  }

  async get_all_names(): Promise<Map<number, string>> {
    if (!this.got_all) await this.get_all(true, false, 64);
    const names = new Map<number, string>();
    for (const info of this.infos) {
      names.set(
        info.gatya_id,
        (await info.get_name()) || core_data.local_manager.get_key("unknown_banner"),
      );
    }
    return names;
  }
}

export class GatyaDataOptionSet {
  id: number;
  banner_on: boolean;
  ticket_item_id: number;
  anim_id: number;
  button_cut_id: number;
  series_id: number;
  menu_cut_id: number;
  char_id: number | null;
  wait_maanim: boolean | null;

  constructor(
    id: number,
    banner_on: boolean,
    ticket_item_id: number,
    anim_id: number,
    button_cut_id: number,
    series_id: number,
    menu_cut_id: number,
    char_id: number | null,
    wait_maanim: boolean | null,
  ) {
    this.id = id;
    this.banner_on = banner_on;
    this.ticket_item_id = ticket_item_id;
    this.anim_id = anim_id;
    this.button_cut_id = button_cut_id;
    this.series_id = series_id;
    this.menu_cut_id = menu_cut_id;
    this.char_id = char_id;
    this.wait_maanim = wait_maanim;
  }

  static from_csv_row(row: Row): GatyaDataOptionSet {
    return new GatyaDataOptionSet(
      row.next_int(),
      row.next_bool(),
      row.next_int(),
      row.next_int(),
      row.next_int(),
      row.next_int(),
      row.next_int(),
      row.next_int_opt(),
      row.next_bool_opt(),
    );
  }
}

export enum GatyaEventType {
  NORMAL = "N",
  RARE = "R",
  EVENT = "E",
}

export class GatyaDataOption {
  sets: GatyaDataOptionSet[];

  constructor(sets: GatyaDataOptionSet[]) {
    this.sets = sets;
  }

  get(set_id: number): GatyaDataOptionSet | null {
    for (const gset of this.sets) if (gset.id === set_id) return gset;
    return null;
  }

  static from_csv(csv: CSV): GatyaDataOption {
    const sets: GatyaDataOptionSet[] = [];
    csv.read_line(); // skip headers
    let row = csv.read_line();
    while (row !== null) {
      sets.push(GatyaDataOptionSet.from_csv_row(row));
      row = csv.read_line();
    }
    return new GatyaDataOption(sets);
  }

  static from_data(data: Data): GatyaDataOption {
    return GatyaDataOption.from_csv(new CSV(data, "\t"));
  }

  static get_filename(event_type: GatyaEventType): string {
    return `GatyaData_Option_Set${event_type}.tsv`;
  }

  static read(save_file: SaveFile, e_type: GatyaEventType): GatyaDataOption | null {
    const gdg = core_data.get_game_data_getter(save_file);
    const data = gdg.download("DataLocal", GatyaDataOption.get_filename(e_type));
    if (data === null) return null;
    return GatyaDataOption.from_data(data);
  }
}
