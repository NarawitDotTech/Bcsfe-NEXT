import type { Data } from "@/lib/bcsfe/core/io/data";
import type { SaveFile } from "@/lib/bcsfe/core/io/save";
import { core_data } from "@/lib/bcsfe/core/core_data";
import { CSV, Delimeter } from "@/lib/bcsfe/core/io/bc_csv";

export class CatShrine {
  unknown: boolean;
  stamp_1: number;
  stamp_2: number;
  shrine_gone: boolean;
  flags: number[];
  /** int64 in the save file: bigint */
  xp_offering: bigint;
  dialogs: number;

  constructor(
    unknown: boolean,
    stamp_1: number,
    stamp_2: number,
    shrine_gone: boolean,
    flags: number[],
    xp_offering: bigint | number,
  ) {
    this.unknown = unknown;
    this.stamp_1 = stamp_1;
    this.stamp_2 = stamp_2;
    this.shrine_gone = shrine_gone;
    this.flags = flags;
    this.xp_offering = BigInt(xp_offering);
    this.dialogs = 0;
  }

  static init(): CatShrine {
    return new CatShrine(false, 0.0, 0.0, false, [], 0n);
  }

  static read(stream: Data): CatShrine {
    const unknown = stream.read_bool();
    const stamp_1 = stream.read_double();
    const stamp_2 = stream.read_double();
    const shrine_gone = stream.read_bool();
    const flags = stream.read_byte_list(stream.read_byte());
    const xp_offering = stream.read_long();
    return new CatShrine(unknown, stamp_1, stamp_2, shrine_gone, flags, xp_offering);
  }

  write(stream: Data): void {
    stream.write_bool(this.unknown);
    stream.write_double(this.stamp_1);
    stream.write_double(this.stamp_2);
    stream.write_bool(this.shrine_gone);
    stream.write_byte(this.flags.length);
    stream.write_byte_list(this.flags, false);
    stream.write_long(this.xp_offering);
  }

  read_dialogs(stream: Data): void {
    this.dialogs = stream.read_int();
  }

  write_dialogs(stream: Data): void {
    stream.write_int(this.dialogs);
  }

  serialize(): Record<string, unknown> {
    return {
      unknown: this.unknown,
      stamp_1: this.stamp_1,
      stamp_2: this.stamp_2,
      shrine_gone: this.shrine_gone,
      flags: this.flags,
      xp_offering: this.xp_offering.toString(),
      dialogs: this.dialogs,
    };
  }

  static deserialize(data: Record<string, unknown>): CatShrine {
    const shrine = new CatShrine(
      (data["unknown"] as boolean | undefined) ?? false,
      (data["stamp_1"] as number | undefined) ?? 0.0,
      (data["stamp_2"] as number | undefined) ?? 0.0,
      (data["shrine_gone"] as boolean | undefined) ?? false,
      (data["flags"] as number[] | undefined) ?? [],
      BigInt((data["xp_offering"] as string | number | bigint | undefined) ?? 0),
    );
    shrine.dialogs = (data["dialogs"] as number | undefined) ?? 0;
    return shrine;
  }

  appear(): void {
    this.shrine_gone = false;
    this.stamp_1 = 0.0;
    this.stamp_2 = 0.0;
  }

  disappear(): void {
    this.shrine_gone = true;
  }

  /** Pure version of the interactive `edit_level` (level already chosen by the caller, 1..max_level). */
  static edit_level(save_file: SaveFile, level: number): void {
    const data = core_data.get_cat_shrine_levels(save_file);
    const max_level = data.get_max_level();
    if (max_level === null) return;
    const xp = data.get_xp_from_level(level);
    if (xp === null) return;
    save_file.cat_shrine.xp_offering = BigInt(xp);
  }

  /** Pure version of the interactive `edit_xp` (xp already chosen by the caller, 0..max_xp). */
  static edit_xp(save_file: SaveFile, xp: number | bigint): void {
    const data = core_data.get_cat_shrine_levels(save_file);
    const max_xp = data.get_max_xp();
    if (max_xp === null) return;
    save_file.cat_shrine.xp_offering = BigInt(xp);
  }

  /**
   * Pure version of the post-edit part of the interactive `edit_catshrine`
   * (call after changing xp / appearance): syncs `dialogs` with the level.
   */
  static edit_catshrine(save_file: SaveFile): void {
    const shrine = save_file.cat_shrine;
    const data = core_data.get_cat_shrine_levels(save_file);
    const level = data.get_level_from_xp(shrine.xp_offering);
    if (level === null) return;
    shrine.dialogs = level - 1;
  }
}

export class CatShrineLevels {
  save_file: SaveFile;
  boundaries: number[] | null;

  constructor(save_file: SaveFile) {
    this.save_file = save_file;
    this.boundaries = this.get_boundaries();
  }

  get_boundaries(): number[] | null {
    const file_name = "jinja_level.csv";
    const gdg = core_data.get_game_data_getter(this.save_file);
    const data = gdg.download("resLocal", file_name);
    if (data === null) return null;
    const csv = new CSV(data, Delimeter.from_country_code_res(this.save_file.cc));
    const boundaries: number[] = [];
    let counter = 0;
    for (const row of csv.lines) {
      counter += row.get(0).to_int();
      boundaries.push(counter);
    }
    return boundaries;
  }

  get_level_from_xp(xp: number | bigint): number | null {
    if (this.boundaries === null) return null;
    const x = BigInt(xp);
    for (let i = 0; i < this.boundaries.length; i++) {
      if (x < BigInt(this.boundaries[i])) return i + 1;
    }
    return this.boundaries.length;
  }

  get_xp_from_level(level: number): number | null {
    if (this.boundaries === null) return null;
    if (level < 1) return 0;
    if (level > this.boundaries.length) return this.get_max_xp();
    // Python: self.boundaries[level - 2]; level 1 -> index -1 (last element)
    const idx = level - 2;
    return this.boundaries.at(idx) ?? null;
  }

  get_max_level(): number | null {
    if (this.boundaries === null) return null;
    return this.boundaries.length;
  }

  get_max_xp(): number | null {
    if (this.boundaries === null) return null;
    return Math.max(...this.boundaries);
  }
}
