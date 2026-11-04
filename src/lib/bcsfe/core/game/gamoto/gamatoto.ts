import type { Data } from "@/lib/bcsfe/core/io/data";
import type { SaveFile } from "@/lib/bcsfe/core/io/save";
import { core_data } from "@/lib/bcsfe/core/core_data";
import { CSV, Delimeter } from "@/lib/bcsfe/core/io/bc_csv";
import { filled, mapToObject, objectToMap, pymod } from "@/lib/bcsfe/core/utils";

export interface MemberName {
  member_id: number;
  rarity: number;
  bonus: number;
  name: string;
  rarity_name: string;
  description: string[];
}

export class GamatotoMembersName {
  save_file: SaveFile;
  members: MemberName[] | null;

  constructor(save_file: SaveFile) {
    this.save_file = save_file;
    this.members = this.read_members();
  }

  read_members(): MemberName[] | null {
    const members: MemberName[] = [];
    const gdg = core_data.get_game_data_getter(this.save_file);
    const data = gdg.download(
      "resLocal",
      `GamatotoExpedition_Members_name_${core_data.get_lang(this.save_file)}.csv`,
    );
    if (data === null) return null;
    const csv = new CSV(
      data,
      Delimeter.from_country_code_res(this.save_file.cc),
      false,
      true,
      false, // remove_empty=False
    );
    for (const line of csv.lines.slice(1)) {
      if (line.get(0).to_int() === -1) continue;
      const description: string[] = [];
      for (let i = 5; i < line.length; i++) description.push(line.get(i).to_str());
      members.push({
        member_id: line.get(0).to_int(),
        rarity: line.get(1).to_int(),
        bonus: line.get(2).to_int(),
        name: line.get(3).to_str(),
        rarity_name: line.get(4).to_str(),
        description,
      });
    }
    return members;
  }

  get_member(member_id: number): MemberName | null {
    if (this.members === null) return null;
    for (const member of this.members) if (member.member_id === member_id) return member;
    return null;
  }

  get_members_from_ids(ids: number[]): (MemberName | null)[] {
    return ids.map((id) => this.get_member(id));
  }

  get_all_rarity(rarity: number): MemberName[] | null {
    if (this.members === null) return null;
    return this.members.filter((m) => m.rarity === rarity);
  }

  get_members_from_helpers(helpers: Helpers): (MemberName | null)[] {
    return this.get_members_from_ids(
      helpers.helpers.filter((h) => h.is_valid()).map((h) => h.id),
    );
  }

  get_all_rarity_names(): string[] | null {
    if (this.members === null) return null;
    const names = new Map<number, string>();
    for (const member of this.members) names.set(member.rarity, member.rarity_name);
    const out: string[] = [];
    for (let i = 0; i < names.size; i++) {
      const n = names.get(i);
      if (n === undefined) throw new Error(`KeyError: ${i}`);
      out.push(n);
    }
    return out;
  }
}

export interface GamatotoLevel {
  level: number;
  xp_needed: number;
  discovery_bonus: number;
  skin: number;
}

export interface GamatotoLimit {
  max_level: number;
  total_stages: number;
  total_helpers: number;
}

export class GamatotoLevels {
  save_file: SaveFile;
  levels: GamatotoLevel[] | null;
  limit: GamatotoLimit | null;

  constructor(save_file: SaveFile) {
    this.save_file = save_file;
    this.levels = this.read_levels();
    this.limit = this.read_max_level();
  }

  read_levels(): GamatotoLevel[] | null {
    const levels: GamatotoLevel[] = [];
    const gdg = core_data.get_game_data_getter(this.save_file);
    const data = gdg.download("DataLocal", "GamatotoExpedition.csv");
    if (data === null) return null;
    const csv = new CSV(data);
    csv.lines.forEach((line, i) => {
      levels.push({
        level: i + 1,
        xp_needed: line.get(0).to_int(),
        discovery_bonus: line.get(1).to_int(),
        skin: line.get(2).to_int(),
      });
    });
    return levels;
  }

  read_max_level(): GamatotoLimit | null {
    const gdg = core_data.get_game_data_getter(this.save_file);
    const data = gdg.download("DataLocal", "GamatotoExpedition_Limit.csv");
    if (data === null) return null;
    const csv = new CSV(data);
    const line = csv.get_row(0);
    return {
      max_level: line.get(0).to_int(),
      total_stages: line.get(1).to_int(),
      total_helpers: line.get(2).to_int(),
    };
  }

  get_level(level: number): GamatotoLevel | null {
    if (this.levels === null) return null;
    if (level < 1) return null;
    return this.levels[level - 1] ?? null;
  }

  get_all_levels(): GamatotoLevel[] | null {
    return this.levels;
  }

  get_level_from_xp(xp: number): GamatotoLevel | null {
    if (this.levels === null || this.limit === null) return null;
    for (const level of this.levels) {
      if (level.level >= this.limit.max_level) break;
      if (level.xp_needed === -1) continue;
      if (xp < level.xp_needed) return level;
    }
    if (this.limit.max_level >= this.levels.length) {
      return this.levels[this.levels.length - 1];
    }
    // Python negative indexing (max_level - 1 may be negative)
    return this.levels.at(this.limit.max_level - 1) ?? null;
  }

  get_xp_from_level(level: number): number | null {
    if (this.levels === null) return null;
    level -= 1;
    if (level < 1) return 0;
    return this.levels[level - 1]?.xp_needed ?? null;
  }

  get_max_level(): number | null {
    if (this.limit === null) return null;
    return this.limit.max_level;
  }

  get_total_stages(): number | null {
    if (this.limit === null) return null;
    return this.limit.total_stages;
  }

  get_total_helpers(): number | null {
    if (this.limit === null) return null;
    return this.limit.total_helpers;
  }
}

export class Helper {
  id: number;

  constructor(id: number) {
    this.id = id;
  }

  static init(): Helper {
    return new Helper(-1);
  }

  static read(stream: Data): Helper {
    return new Helper(stream.read_int());
  }

  write(stream: Data): void {
    stream.write_int(this.id);
  }

  serialize(): number {
    return this.id;
  }

  static deserialize(data: number): Helper {
    return new Helper(data);
  }

  is_valid(): boolean {
    return this.id !== -1;
  }
}

export class Helpers {
  helpers: Helper[];

  constructor(helpers: Helper[]) {
    this.helpers = helpers;
  }

  static init(): Helpers {
    return new Helpers([]);
  }

  static read(stream: Data): Helpers {
    const total = stream.read_int();
    const helpers: Helper[] = [];
    for (let i = 0; i < total; i++) helpers.push(Helper.read(stream));
    return new Helpers(helpers);
  }

  write(stream: Data): void {
    stream.write_int(this.helpers.length);
    for (const helper of this.helpers) helper.write(stream);
  }

  serialize(): number[] {
    return this.helpers.map((h) => h.serialize());
  }

  static deserialize(data: number[]): Helpers {
    return new Helpers(data.map((h) => Helper.deserialize(h)));
  }
}

export class Gamatoto {
  remaining_seconds: number;
  return_flag: boolean;
  xp: number;
  dest_id: number;
  recon_length: number;
  unknown: number;
  notif_value: number;
  helpers: Helpers;
  is_ad_present: boolean;
  skin: number;
  collab_flags: Map<number, boolean>;
  collab_durations: Map<number, number>;

  constructor(
    remaining_seconds: number,
    return_flag: boolean,
    xp: number,
    dest_id: number,
    recon_length: number,
    unknown: number,
    notif_value: number,
  ) {
    this.remaining_seconds = remaining_seconds;
    this.return_flag = return_flag;
    this.xp = xp;
    this.dest_id = dest_id;
    this.recon_length = recon_length;
    this.unknown = unknown;
    this.notif_value = notif_value;
    this.helpers = Helpers.init();
    this.is_ad_present = false;
    this.skin = 0;
    this.collab_flags = new Map();
    this.collab_durations = new Map();
  }

  static init(): Gamatoto {
    return new Gamatoto(0.0, false, 0, 0, 0, 0, 0);
  }

  static read(stream: Data): Gamatoto {
    const remaining_seconds = stream.read_double();
    const return_flag = stream.read_bool();
    const xp = stream.read_int();
    const dest_id = stream.read_int();
    const recon_length = stream.read_int();
    const unknown = stream.read_int();
    const notif_value = stream.read_int();
    return new Gamatoto(
      remaining_seconds,
      return_flag,
      xp,
      dest_id,
      recon_length,
      unknown,
      notif_value,
    );
  }

  write(stream: Data): void {
    stream.write_double(this.remaining_seconds);
    stream.write_bool(this.return_flag);
    stream.write_int(this.xp);
    stream.write_int(this.dest_id);
    stream.write_int(this.recon_length);
    stream.write_int(this.unknown);
    stream.write_int(this.notif_value);
  }

  read_2(stream: Data): void {
    this.helpers = Helpers.read(stream);
    this.is_ad_present = stream.read_bool();
  }

  write_2(stream: Data): void {
    this.helpers.write(stream);
    stream.write_bool(this.is_ad_present);
  }

  read_skin(stream: Data): void {
    this.skin = stream.read_int();
  }

  write_skin(stream: Data): void {
    stream.write_int(this.skin);
  }

  read_collab_data(stream: Data): void {
    this.collab_flags = stream.read_int_bool_dict();
    this.collab_durations = stream.read_int_double_dict();
  }

  write_collab_data(stream: Data): void {
    stream.write_int_bool_dict(this.collab_flags);
    stream.write_int_double_dict(this.collab_durations);
  }

  serialize(): Record<string, unknown> {
    return {
      remaining_seconds: this.remaining_seconds,
      return_flag: this.return_flag,
      xp: this.xp,
      dest_id: this.dest_id,
      recon_length: this.recon_length,
      unknown: this.unknown,
      notif_value: this.notif_value,
      helpers: this.helpers.serialize(),
      is_ad_present: this.is_ad_present,
      skin: this.skin,
      collab_flags: mapToObject(this.collab_flags),
      collab_durations: mapToObject(this.collab_durations),
    };
  }

  static deserialize(data: Record<string, unknown>): Gamatoto {
    const n = (k: string, d: number) => (data[k] as number | undefined) ?? d;
    const gamatoto = new Gamatoto(
      n("remaining_seconds", 0.0),
      (data["return_flag"] as boolean | undefined) ?? false,
      n("xp", 0),
      n("dest_id", 0),
      n("recon_length", 0),
      n("unknown", 0),
      n("notif_value", 0),
    );
    gamatoto.helpers = Helpers.deserialize((data["helpers"] as number[] | undefined) ?? []);
    gamatoto.is_ad_present = (data["is_ad_present"] as boolean | undefined) ?? false;
    gamatoto.skin = n("skin", 0);
    gamatoto.collab_flags = objectToMap(data["collab_flags"] as Record<string, boolean> | undefined);
    gamatoto.collab_durations = objectToMap(
      data["collab_durations"] as Record<string, number> | undefined,
    );
    return gamatoto;
  }

  /** Pure version of `edit_raw_xp`: `xp` is the value entered by the user. */
  edit_raw_xp(xp: number, gamatoto_levels: GamatotoLevels): [number, GamatotoLevel | null] {
    const current_level = gamatoto_levels.get_level_from_xp(xp);
    return [xp, current_level];
  }

  /** Pure version of `edit_level`: `value` is the level entered by the user. */
  edit_level(value: number, gamatoto_levels: GamatotoLevels): [number | null, GamatotoLevel | null] {
    const xp = gamatoto_levels.get_xp_from_level(value);
    return [xp, gamatoto_levels.get_level(value)];
  }

  /**
   * Pure version of the interactive `edit_xp`. `mode` "raw" => `value` is raw xp,
   * "level" => `value` is a gamatoto level. Returns the resulting [xp, level] or null.
   */
  edit_xp(
    save_file: SaveFile,
    mode: "raw" | "level",
    value: number,
  ): [number, GamatotoLevel | null] | null {
    const gamatoto_levels = core_data.get_gamatoto_levels(save_file);
    const current_level = gamatoto_levels.get_level_from_xp(this.xp);
    if (current_level === null) return null;
    let xp: number | null;
    let new_level: GamatotoLevel | null;
    if (mode === "raw") [xp, new_level] = this.edit_raw_xp(value, gamatoto_levels);
    else [xp, new_level] = this.edit_level(value, gamatoto_levels);
    if (xp === null) return null;
    this.xp = xp;
    return [xp, new_level];
  }

  /**
   * Helper for the helper-editing UI: per-rarity count of currently equipped helpers,
   * plus rarity names and the max total helpers. Null if data is unavailable.
   */
  get_helper_rarity_info(
    save_file: SaveFile,
  ): { rarity_names: string[]; total_rarity_amounts: number[]; max_helpers: number | null } | null {
    const members_name = core_data.get_gamatoto_members_name(save_file);
    const gamatoto_levels = core_data.get_gamatoto_levels(save_file);
    const max_helpers = gamatoto_levels.get_total_helpers();
    const rarity_names = members_name.get_all_rarity_names();
    if (rarity_names === null) return null;
    const total_rarity_amounts: number[] = filled(0, rarity_names.length);
    for (const helper of this.helpers.helpers) {
      if (!helper.is_valid()) continue;
      const member = members_name.get_member(helper.id);
      if (member === null) continue;
      total_rarity_amounts[member.rarity] += 1;
    }
    return { rarity_names, total_rarity_amounts, max_helpers };
  }

  /** Pure version of `edit_helpers`: `rarity_amounts` is the chosen amount per rarity. */
  edit_helpers(save_file: SaveFile, rarity_amounts: number[]): void {
    const members_name = core_data.get_gamatoto_members_name(save_file);
    const helpers: Helper[] = [];
    rarity_amounts.forEach((rarity_amount, rarity) => {
      const rarity_members = members_name.get_all_rarity(rarity);
      if (rarity_members === null || rarity_members.length === 0) return;
      for (let i = 0; i < rarity_amount; i++) {
        const index = pymod(i, rarity_members.length);
        helpers.push(new Helper(rarity_members[index].member_id));
      }
    });
    this.helpers = new Helpers(helpers);
  }
}

/** Pure version of module-level `edit_xp`. */
export function edit_xp(save_file: SaveFile, mode: "raw" | "level", value: number) {
  return save_file.gamatoto.edit_xp(save_file, mode, value);
}

/** Pure version of module-level `edit_helpers`. */
export function edit_helpers(save_file: SaveFile, rarity_amounts: number[]): void {
  save_file.gamatoto.edit_helpers(save_file, rarity_amounts);
}
