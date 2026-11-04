import type { Data } from "@/lib/bcsfe/core/io/data";
import type { GameVersion } from "@/lib/bcsfe/core/game_version";
import type { SaveFile } from "@/lib/bcsfe/core/io/save";
import { core_data } from "@/lib/bcsfe/core/core_data";
import { CSV, Delimeter } from "@/lib/bcsfe/core/io/bc_csv";
import { BaseMaterials } from "@/lib/bcsfe/core/game/gamoto/base_materials";
import { mapToObject, objectToMap, times } from "@/lib/bcsfe/core/utils";

/** Python len() on str counts code points. */
function pylen(s: string): number {
  return Array.from(s).length;
}

export interface LevelPartRecipeUnlock {
  index: number;
  cannon_id: number;
  part_id: number;
  unknown: number;
  unknown2: number;
  level: number;
}

export class CastleRecipeUnlock {
  save_file: SaveFile;
  level_part_recipe_unlocks: LevelPartRecipeUnlock[] | null;

  constructor(save_file: SaveFile) {
    this.save_file = save_file;
    this.level_part_recipe_unlocks = this.get_recipe_unlocks();
  }

  get_recipe_unlocks(): LevelPartRecipeUnlock[] | null {
    const gdg = core_data.get_game_data_getter(this.save_file);
    const data = gdg.download("DataLocal", "CastleRecipeUnlock.csv");
    if (data === null) return null;
    const csv = new CSV(data);
    const out: LevelPartRecipeUnlock[] = [];
    csv.lines.forEach((line, i) => {
      out.push({
        index: i,
        cannon_id: line.get(0).to_int(),
        part_id: line.get(1).to_int(),
        unknown: line.get(2).to_int(),
        unknown2: line.get(3).to_int(),
        level: line.get(4).to_int(),
      });
    });
    return out;
  }

  get_recipe_unlock(index: number): LevelPartRecipeUnlock | null {
    if (this.level_part_recipe_unlocks === null) return null;
    for (const r of this.level_part_recipe_unlocks) if (r.index === index) return r;
    return null;
  }

  get_max_level(cannon_id: number, part_id: number): number | null {
    if (this.level_part_recipe_unlocks === null) return null;
    let max_level = 0;
    for (const r of this.level_part_recipe_unlocks) {
      if (r.cannon_id === cannon_id && r.part_id === part_id) {
        if (r.level > max_level) max_level = r.level;
      }
    }
    return max_level;
  }

  get_max_part_level(part_id: number): number | null {
    if (this.level_part_recipe_unlocks === null) return null;
    let max_level = 0;
    for (const r of this.level_part_recipe_unlocks) {
      if (r.part_id === part_id) {
        if (r.level > max_level) max_level = r.level;
      }
    }
    return max_level;
  }
}

export class CannonDescription {
  cannon_id!: number;
  build_name!: string;
  foundation_build_description!: string;
  style_build_description!: string;
  effect_build_description!: string;
  cannon_build_description!: string;
  cannon_name!: string;
  foundation_name!: string;
  style_name!: string;
  effect_description!: string;
  improve_foundation_description!: string;
  improve_style_description!: string;
  improved_foundation_name!: string;
  improved_style_name!: string;
  improved_effect1_description!: string;
  improved_effect2_description!: string;

  constructor(fields: {
    cannon_id: number;
    build_name: string;
    foundation_build_description: string;
    style_build_description: string;
    effect_build_description: string;
    cannon_build_description: string;
    cannon_name: string;
    foundation_name: string;
    style_name: string;
    effect_description: string;
    improve_foundation_description: string;
    improve_style_description: string;
    improved_foundation_name: string;
    improved_style_name: string;
    improved_effect1_description: string;
    improved_effect2_description: string;
  }) {
    Object.assign(this, fields);
  }

  get_part_names(): string[] {
    let effect_name = this.effect_build_description.split("<br>")[0];
    if (!effect_name) effect_name = this.build_name;
    return [
      effect_name,
      this.improve_foundation_description.split("<br>")[0],
      this.improve_style_description.split("<br>")[0],
    ];
  }

  get_part_name(index: number): string {
    const names = this.get_part_names();
    return names[index < 0 ? index + names.length : index];
  }

  get_longest_part_name(): string {
    const names = this.get_part_names();
    let best = names[0];
    for (const n of names) if (pylen(n) > pylen(best)) best = n;
    return best;
  }

  get_cannon_name(): string {
    return this.cannon_name;
  }
}

export class CannonDescriptions {
  save_file: SaveFile;
  cannon_descriptions: CannonDescription[] | null;

  constructor(save_file: SaveFile) {
    this.save_file = save_file;
    this.cannon_descriptions = this.get_cannon_descriptions();
  }

  get_cannon_descriptions(): CannonDescription[] | null {
    const gdg = core_data.get_game_data_getter(this.save_file);
    const data = gdg.download("resLocal", "CastleRecipeDescriptions.csv");
    if (data === null) return null;
    const csv = new CSV(
      data,
      Delimeter.from_country_code_res(this.save_file.cc),
      false,
      true,
      false, // remove_empty=False
    );
    const out: CannonDescription[] = [];
    for (const line of csv.lines) {
      out.push(
        new CannonDescription({
          cannon_id: line.get(0).to_int(),
          build_name: line.get(1).to_str(),
          foundation_build_description: line.get(2).to_str(),
          style_build_description: line.get(3).to_str(),
          effect_build_description: line.get(4).to_str(),
          cannon_build_description: line.get(5).to_str(),
          cannon_name: line.get(6).to_str(),
          foundation_name: line.get(7).to_str(),
          style_name: line.get(8).to_str(),
          effect_description: line.get(9).to_str(),
          improve_foundation_description: line.get(10).to_str(),
          improve_style_description: line.get(11).to_str(),
          improved_foundation_name: line.get(12).to_str(),
          improved_style_name: line.get(13).to_str(),
          improved_effect1_description: line.get(14).to_str(),
          improved_effect2_description: line.get(15).to_str(),
        }),
      );
    }
    return out;
  }

  get_cannon_description(cannon_id: number): CannonDescription | null {
    if (this.cannon_descriptions === null) return null;
    for (const d of this.cannon_descriptions) if (d.cannon_id === cannon_id) return d;
    return null;
  }

  get_longest_longest_part_name(): string | null {
    if (this.cannon_descriptions === null) return null;
    let longest = "";
    for (const d of this.cannon_descriptions) {
      const l_name = d.get_longest_part_name();
      if (pylen(l_name) > pylen(longest)) longest = l_name;
    }
    return longest;
  }
}

export class Cannon {
  development: number;
  levels: number[];

  constructor(development: number, levels: number[]) {
    this.development = development;
    this.levels = levels;
  }

  static init(): Cannon {
    return new Cannon(0, []);
  }

  static read(stream: Data): Cannon {
    const total = stream.read_int();
    const levels: number[] = [];
    const development = stream.read_int();
    for (let i = 0; i < total - 1; i++) levels.push(stream.read_int());
    return new Cannon(development, levels);
  }

  write(stream: Data): void {
    stream.write_int(this.levels.length + 1);
    stream.write_int(this.development);
    for (const level of this.levels) stream.write_int(level);
  }

  serialize(): number[] {
    return [this.development, ...this.levels];
  }

  static deserialize(data: number[]): Cannon {
    return new Cannon(data[0], data.slice(1));
  }
}

export class Cannons {
  cannons: Map<number, Cannon>;
  selected_parts: number[][];

  constructor(cannons: Map<number, Cannon>, selected_parts: number[][]) {
    this.cannons = cannons;
    this.selected_parts = selected_parts;
  }

  static init(gv: GameVersion): Cannons {
    const cannons = new Map<number, Cannon>();
    let selected_parts: number[][];
    if (gv.lt(80200)) {
      selected_parts = [[0, 0, 0]];
    } else {
      const total_selected_parts = gv.gt(90699) ? 0 : 10;
      selected_parts = times(total_selected_parts, () => [0, 0, 0]);
    }
    return new Cannons(cannons, selected_parts);
  }

  static read(stream: Data, gv: GameVersion): Cannons {
    const total = stream.read_int();
    const cannons = new Map<number, Cannon>();
    for (let i = 0; i < total; i++) {
      const cannon_id = stream.read_int();
      cannons.set(cannon_id, Cannon.read(stream));
    }
    let selected_parts: number[][];
    if (gv.lt(80200)) {
      selected_parts = [stream.read_int_list(3)];
    } else {
      const total_selected_parts = gv.gt(90699) ? stream.read_byte() : 10;
      selected_parts = [];
      for (let i = 0; i < total_selected_parts; i++) {
        selected_parts.push(stream.read_byte_list(3));
      }
    }
    return new Cannons(cannons, selected_parts);
  }

  write(stream: Data, gv: GameVersion): void {
    stream.write_int(this.cannons.size);
    for (const [cannon_id, cannon] of this.cannons) {
      stream.write_int(cannon_id);
      cannon.write(stream);
    }
    if (gv.lt(80200)) {
      stream.write_int_list(this.selected_parts[0], false, 3);
    } else {
      if (gv.gt(90699)) stream.write_byte(this.selected_parts.length);
      for (const part of this.selected_parts) stream.write_byte_list(part, false, 3);
    }
  }

  serialize(): Record<string, unknown> {
    return {
      cannons: mapToObject(this.cannons, (c) => c.serialize()),
      selected_parts: this.selected_parts,
    };
  }

  static deserialize(data: Record<string, unknown>): Cannons {
    return new Cannons(
      objectToMap(data["cannons"] as Record<string, number[]> | undefined, (c) =>
        Cannon.deserialize(c),
      ),
      (data["selected_parts"] as number[][] | undefined) ?? [],
    );
  }
}

export class Ototo {
  base_materials: BaseMaterials;
  remaining_seconds: number;
  return_flag: boolean;
  improve_id: number;
  engineers: number;
  cannons: Cannons | null;

  constructor(base_materials: BaseMaterials, game_version: GameVersion | null = null) {
    this.base_materials = base_materials;
    this.remaining_seconds = 0.0;
    this.return_flag = false;
    this.improve_id = 0;
    this.engineers = 0;
    this.cannons = game_version ? Cannons.init(game_version) : null;
  }

  static init(game_version: GameVersion): Ototo {
    return new Ototo(BaseMaterials.init(), game_version);
  }

  static read(stream: Data): Ototo {
    return new Ototo(BaseMaterials.read(stream));
  }

  write(stream: Data): void {
    this.base_materials.write(stream);
  }

  read_2(stream: Data, gv: GameVersion): void {
    this.remaining_seconds = stream.read_double();
    this.return_flag = stream.read_bool();
    this.improve_id = stream.read_int();
    this.engineers = stream.read_int();
    this.cannons = Cannons.read(stream, gv);
  }

  write_2(stream: Data, gv: GameVersion): void {
    stream.write_double(this.remaining_seconds);
    stream.write_bool(this.return_flag);
    stream.write_int(this.improve_id);
    stream.write_int(this.engineers);
    if (this.cannons === null) Cannons.init(gv).write(stream, gv);
    else this.cannons.write(stream, gv);
  }

  serialize(): Record<string, unknown> {
    return {
      base_materials: this.base_materials.serialize(),
      remaining_seconds: this.remaining_seconds,
      return_flag: this.return_flag,
      improve_id: this.improve_id,
      engineers: this.engineers,
      cannons: this.cannons ? this.cannons.serialize() : null,
    };
  }

  static deserialize(data: Record<string, unknown>): Ototo {
    const ototo = new Ototo(
      BaseMaterials.deserialize((data["base_materials"] as number[] | undefined) ?? []),
    );
    ototo.remaining_seconds = (data["remaining_seconds"] as number | undefined) ?? 0.0;
    ototo.return_flag = (data["return_flag"] as boolean | undefined) ?? false;
    ototo.improve_id = (data["improve_id"] as number | undefined) ?? 0;
    ototo.engineers = (data["engineers"] as number | undefined) ?? 0;
    ototo.cannons = Cannons.deserialize(
      (data["cannons"] as Record<string, unknown> | null | undefined) ?? {},
    );
    return ototo;
  }

  static get_max_engineers(save_file: SaveFile): number {
    const file = core_data
      .get_game_data_getter(save_file)
      .download("DataLocal", "CastleCustomLimit.csv");
    if (file === null) return 5;
    const csv = new CSV(file);
    return csv.lines[0].get(0).to_int();
  }

  /** Display name for the engineers item (gatya item 92), for use by an edit UI. */
  static get_engineers_name(save_file: SaveFile): string {
    const name = core_data.get_gatya_item_names(save_file).get_name(92);
    if (name === null) return core_data.local_manager.get_key("engineers");
    return name;
  }

  /** Pure version of the interactive `edit_engineers` (value chosen by the caller, max `get_max_engineers`). */
  edit_engineers(_save_file: SaveFile, value: number): void {
    this.engineers = value;
  }

  /**
   * Pure replacement for `display_current_cannons`: returns the cannon names and the
   * formatted stat text per cannon (parallel arrays), or null if data is unavailable.
   */
  get_current_cannon_stats(save_file: SaveFile): { names: string[]; texts: string[] } | null {
    const descriptions = new CannonDescriptions(save_file);
    const recipe_unlocks = new CastleRecipeUnlock(save_file);

    if (this.cannons === null) this.cannons = Cannons.init(save_file.game_version);

    const names: string[] = [];
    const texts: string[] = [];
    const longest_name = descriptions.get_longest_longest_part_name();
    if (longest_name === null) return null;
    const longest_part_name = pylen(longest_name);

    for (const [cannon_id, cannon] of this.cannons.cannons) {
      const description = descriptions.get_cannon_description(cannon_id);
      if (description === null) continue;
      const recipe_unlock = recipe_unlocks.get_recipe_unlock(cannon_id);
      if (recipe_unlock === null) continue;
      const cannon_name = description.get_cannon_name();
      names.push(cannon_name);
      let text = cannon_name;
      if (cannon_id !== 0) {
        const cannon_name_length = pylen(cannon_name) - 10;
        const buffer = " ".repeat(Math.max(0, longest_part_name - cannon_name_length));
        text += core_data.local_manager.get_key("development", {
          development: Ototo.get_stage_name(cannon.development),
          escape: false,
          buffer,
        });
      }

      cannon.levels.forEach((level0, part_id) => {
        let level = level0;
        if (part_id === 0) level += 1;
        text += "\n";
        text += "        ";
        const name = description.get_part_name(part_id);
        const buffer = " ".repeat(Math.max(0, longest_part_name - pylen(name) + 2));
        text += core_data.local_manager.get_key("cannon_part", { name, level, buffer });
      });
      text += "\n";
      texts.push(text);
    }
    return { names, texts };
  }

  /** Returns the names like Python `display_current_cannons` (printing dropped; see get_current_cannon_stats). */
  display_current_cannons(save_file: SaveFile): string[] | null {
    const res = this.get_current_cannon_stats(save_file);
    return res === null ? null : res.names;
  }

  /**
   * Pure version of `edit_cannon_development`. `developments` is either a single value
   * applied to all `cannon_ids` (all_at_once) or a Map cannon_id -> development.
   * Development: 0 none, 1 foundation, 2 style, 3 effect.
   */
  edit_cannon_development(
    save_file: SaveFile,
    cannon_ids: number[],
    developments: number | Map<number, number>,
  ): void {
    if (this.cannons === null) this.cannons = Cannons.init(save_file.game_version);
    for (const cannon_id of cannon_ids) {
      if (cannon_id === 0) continue;
      const cannon = this.cannons.cannons.get(cannon_id);
      if (cannon === undefined) continue;
      const development =
        typeof developments === "number" ? developments : developments.get(cannon_id);
      if (development === undefined) continue;
      cannon.development = development;
    }
  }

  /**
   * Max level of each of the 3 cannon parts (effect, improved foundation, improved style),
   * or null if data is unavailable. Used to bound the edit UI.
   */
  static get_max_part_levels(save_file: SaveFile): [number, number, number] | null {
    const r = new CastleRecipeUnlock(save_file);
    const a = r.get_max_part_level(0);
    const b = r.get_max_part_level(1);
    const c = r.get_max_part_level(2);
    if (a === null || b === null || c === null) return null;
    return [a, b, c];
  }

  /** Display levels (part 0 shown +1) of a cannon, for the per-cannon edit UI. */
  get_cannon_display_levels(cannon_id: number): number[] | null {
    const cannon = this.get_cannon(cannon_id);
    if (cannon === null) return null;
    const levels = cannon.levels.slice();
    if (levels.length > 0) levels[0] += 1;
    return levels;
  }

  /**
   * Pure version of `edit_cannon_level`.
   *  - all_at_once: `levels` is a number[] (display levels for parts 0..2) applied to every cannon id
   *    (clamped to per-cannon max level).
   *  - otherwise: `levels` is a Map cannon_id -> display levels (as in `get_cannon_display_levels`).
   */
  edit_cannon_level(
    save_file: SaveFile,
    cannon_ids: number[],
    levels: number[] | Map<number, number[]>,
  ): void {
    if (this.cannons === null) this.cannons = Cannons.init(save_file.game_version);
    const cannon_recipe = new CastleRecipeUnlock(save_file);
    if (Array.isArray(levels)) {
      if (Ototo.get_max_part_levels(save_file) === null) return;
      if (levels.length === 0) return;
      for (const cannon_id of cannon_ids) {
        const cannon = this.get_cannon(cannon_id);
        if (cannon === null) continue;
        cannon.development = Math.max(cannon.development, 3);
        for (let part_id = 0; part_id < levels.length; part_id++) {
          let level = levels[part_id];
          if (part_id === 0) level -= 1;
          const max_level = cannon_recipe.get_max_level(cannon_id, part_id);
          if (max_level === null) continue;
          if (part_id >= cannon.levels.length) break;
          cannon.levels[part_id] = Math.min(level, max_level);
        }
      }
    } else {
      const descriptions = new CannonDescriptions(save_file);
      for (const cannon_id of cannon_ids) {
        const cannon = this.get_cannon(cannon_id);
        if (cannon === null) continue;
        cannon.development = Math.max(cannon.development, 3);
        if (descriptions.get_cannon_description(cannon_id) === null) continue;
        const new_levels = levels.get(cannon_id);
        if (new_levels === undefined) continue;
        new_levels.forEach((level0, part_id) => {
          let level = level0;
          if (part_id === 0) level -= 1;
          if (part_id < cannon.levels.length) cannon.levels[part_id] = level;
        });
      }
    }
  }

  get_cannon(cannon_id: number): Cannon | null {
    if (this.cannons === null) return null;
    return this.cannons.cannons.get(cannon_id) ?? null;
  }

  static get_stage_name(development: number): string {
    if (development === 0) return core_data.local_manager.get_key("none");
    if (development === 1) return core_data.local_manager.get_key("foundation");
    if (development === 2) return core_data.local_manager.get_key("style");
    if (development === 3) return core_data.local_manager.get_key("effect");
    return core_data.local_manager.get_key("unknown_stage", { stage: development });
  }
}

/** Pure counterpart of module-level `edit_cannon` (interactive selection is done by the caller). */
export function edit_cannon_development(
  save_file: SaveFile,
  cannon_ids: number[],
  developments: number | Map<number, number>,
): void {
  save_file.ototo.edit_cannon_development(save_file, cannon_ids, developments);
}

export function edit_cannon_level(
  save_file: SaveFile,
  cannon_ids: number[],
  levels: number[] | Map<number, number[]>,
): void {
  save_file.ototo.edit_cannon_level(save_file, cannon_ids, levels);
}

