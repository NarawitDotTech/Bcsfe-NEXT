/** Port of bcsfe/core/game/catbase/talent_orbs.py */
import type { Data } from "@/lib/bcsfe/core/io/data";
import type { SaveFile } from "@/lib/bcsfe/core/io/save";
import type { GameVersion } from "@/lib/bcsfe/core/game_version";
import { CSV } from "@/lib/bcsfe/core/io/bc_csv";
import { core_data } from "@/lib/bcsfe/core/core_data";

export class TalentOrb {
  constructor(
    public id: number,
    public value: number,
  ) {}

  static init(): TalentOrb {
    return new TalentOrb(0, 0);
  }

  static read(stream: Data, gv: GameVersion): TalentOrb {
    const id = stream.read_short();
    const value = gv.lt(110400) ? stream.read_byte() : stream.read_short();
    return new TalentOrb(id, value);
  }

  write(stream: Data, gv: GameVersion): void {
    stream.write_short(this.id);
    if (gv.lt(110400)) stream.write_byte(this.value);
    else stream.write_short(this.value);
  }

  serialize(): { id: number; value: number } {
    return { id: this.id, value: this.value };
  }

  static deserialize(data: { id?: number; value?: number }): TalentOrb {
    return new TalentOrb(data.id ?? 0, data.value ?? 0);
  }
}

export class TalentOrbs {
  constructor(public orbs: Map<number, TalentOrb>) {}

  static init(): TalentOrbs {
    return new TalentOrbs(new Map());
  }

  static read(stream: Data, gv: GameVersion): TalentOrbs {
    const length = stream.read_short();
    const orbs = new Map<number, TalentOrb>();
    for (let i = 0; i < length; i++) {
      const orb = TalentOrb.read(stream, gv);
      orbs.set(orb.id, orb);
    }
    return new TalentOrbs(orbs);
  }

  write(stream: Data, gv: GameVersion): void {
    stream.write_short(this.orbs.size);
    for (const orb of this.orbs.values()) orb.write(stream, gv);
  }

  serialize(): { id: number; value: number }[] {
    return Array.from(this.orbs.values()).map((o) => o.serialize());
  }

  static deserialize(data: { id?: number; value?: number }[]): TalentOrbs {
    const orbs = new Map<number, TalentOrb>();
    for (const orb of data) orbs.set(orb.id ?? 0, TalentOrb.deserialize(orb));
    return new TalentOrbs(orbs);
  }

  set_orb(id: number, value: number): void {
    this.orbs.set(id, new TalentOrb(id, value));
  }
}

export class RawOrbInfo {
  constructor(
    public orb_id: number,
    public rank_id: number,
    public effect_id: number,
    public value: number[],
    public target_id: number | null,
  ) {}
}

export class OrbInfo {
  constructor(
    public raw_orb_info: RawOrbInfo,
    public rank: string,
    public target: string | null,
    public effect: string,
  ) {}

  /**
   * Python `__str__`: effect text with the grade / target filled in, wrapped in
   * the color markup tags (<COLOR>text</>). Colors are given as ColorHex names.
   */
  to_colortext(): string {
    const target_color = color_from_enemy_type(this.raw_orb_info.target_id);
    const rank_color = color_from_grade(this.raw_orb_info.rank_id);
    const effect_color = color_from_effect(this.raw_orb_info.effect_id);
    const effect_text = `<${effect_color}>${this.effect.split("%@").join("{}")}</>`;
    const target = this.target;
    const args = [`<${rank_color}>${this.rank}</>`, target ? `<${target_color}>${target}</>` : ""];
    let i = 0;
    return effect_text.replace(/\{\}/g, () => args[i++] ?? "");
  }

  toString(): string {
    return this.to_colortext();
  }

  static create_unknown(orb_id: number): OrbInfo {
    return new OrbInfo(new RawOrbInfo(orb_id, 0, 0, [], 0), "???", "", "%@:%@");
  }
}

interface EquipmentListJson {
  ID: { gradeID: number; content: number; value: number[]; attribute?: number }[];
}

export class OrbInfoList {
  static equipment_data_file_name = "DataLocal/equipmentlist.json";
  static grade_list_file_name = "DataLocal/equipmentgrade.csv";
  static attribute_list_file_name = "resLocal/attribute_explonation.tsv";
  static effect_list_file_name = "resLocal/equipment_explonation.tsv";

  constructor(public orb_info_list: OrbInfo[]) {}

  static create(save_file: SaveFile): OrbInfoList | null {
    const gdg = core_data.get_game_data_getter(save_file);
    const json_data_file = gdg.download_from_path(OrbInfoList.equipment_data_file_name);
    const grade_list_file = gdg.download_from_path(OrbInfoList.grade_list_file_name);
    const attribute_list_file = gdg.download_from_path(OrbInfoList.attribute_list_file_name);
    const equipment_list_file = gdg.download_from_path(OrbInfoList.effect_list_file_name);
    if (
      json_data_file === null ||
      grade_list_file === null ||
      attribute_list_file === null ||
      equipment_list_file === null
    ) {
      return null;
    }
    const raw_orbs = OrbInfoList.parse_json_data(json_data_file);
    if (raw_orbs === null) return null;
    const orbs = OrbInfoList.load_names(raw_orbs, grade_list_file, attribute_list_file, equipment_list_file);
    return new OrbInfoList(orbs);
  }

  static parse_json_data(json_data: Data): RawOrbInfo[] | null {
    let data: EquipmentListJson;
    try {
      data = JSON.parse(new TextDecoder("utf-8").decode(json_data.get_bytes())) as EquipmentListJson;
    } catch {
      return null;
    }
    const orb_info_list: RawOrbInfo[] = [];
    data.ID.forEach((orb, id) => {
      orb_info_list.push(new RawOrbInfo(id, orb.gradeID, orb.content, orb.value, orb.attribute ?? null));
    });
    return orb_info_list;
  }

  static load_names(
    raw_orb_info: RawOrbInfo[],
    grade_data: Data,
    attribute_data: Data,
    effect_data: Data,
  ): OrbInfo[] {
    const grade_csv = new CSV(grade_data);
    const attribute_tsv = new CSV(attribute_data, "\t");
    const effect_csv = new CSV(effect_data, "\t");
    const orb_info_list: OrbInfo[] = [];
    for (const orb of raw_orb_info) {
      const grade = grade_csv.get_row(orb.rank_id).get(3).to_str();
      const effect = effect_csv.get_row(orb.effect_id).get(0).to_str();
      let attribute: string | null;
      if (orb.target_id !== null) attribute = attribute_tsv.get_row(orb.target_id).get(0).to_str();
      else attribute = null;
      orb_info_list.push(new OrbInfo(orb, grade, attribute, effect));
    }
    return orb_info_list;
  }

  get_orb_info(orb_id: number): OrbInfo | null {
    return this.orb_info_list[orb_id] ?? null;
  }

  get_orb_from_components(grade: string, attribute: string | null, effect: string): OrbInfo | null {
    for (const orb of this.orb_info_list) {
      if (orb.rank === grade && orb.target === attribute && orb.effect === effect) return orb;
    }
    return null;
  }

  does_match_orb_str(str_1: string | null, str_2: string | null): boolean {
    if (str_2 === "*") return true;
    if (str_1 === null) return str_2 === null;
    if (str_2 === null) return false;
    return str_1.toLowerCase() === str_2.toLowerCase();
  }

  get_orbs_from_component_fuzzy(grade: string, attribute: string | null, effect: string): OrbInfo[] {
    const orbs: OrbInfo[] = [];
    for (const orb of this.orb_info_list) {
      if (
        (orb.rank.toLowerCase() === grade.toLowerCase() || grade === "*") &&
        this.does_match_orb_str(orb.target, attribute) &&
        (orb.effect === effect || effect === "*")
      ) {
        orbs.push(orb);
      }
    }
    return orbs;
  }

  private static unique_sorted(pairs: [string, number][]): string[] {
    const seen = new Set<string>();
    const data: [string, number][] = [];
    for (const p of pairs) {
      const k = `${p[1]}\u0000${p[0]}`;
      if (seen.has(k)) continue;
      seen.add(k);
      data.push(p);
    }
    data.sort((a, b) => a[1] - b[1]);
    return data.map((p) => p[0]);
  }

  get_all_grades(): string[] {
    return OrbInfoList.unique_sorted(this.orb_info_list.map((o) => [o.rank, o.raw_orb_info.rank_id]));
  }

  get_all_attributes(): string[] {
    const pairs: [string, number][] = [];
    for (const o of this.orb_info_list) {
      if (o.target !== null && o.raw_orb_info.target_id !== null) pairs.push([o.target, o.raw_orb_info.target_id]);
    }
    return OrbInfoList.unique_sorted(pairs);
  }

  get_all_effects(): string[] {
    return OrbInfoList.unique_sorted(this.orb_info_list.map((o) => [o.effect, o.raw_orb_info.effect_id]));
  }
}

/** Represents a saved orb in the save file */
export class SaveOrb {
  constructor(
    public orb: OrbInfo,
    public count: number,
  ) {}
}

/** Returns the ColorHex member name used by the Python for an enemy type. */
export function color_from_enemy_type(target_id: number | null): string {
  if (target_id === null) return "WHITE";
  switch (target_id) {
    case 0: return "RED";
    case 1: return "GREEN";
    case 2: return "DARK_GREY";
    case 3: return "LIGHT_GREY";
    case 4: return "YELLOW";
    case 5: return "BLUE";
    case 6: return "MAGENTA";
    case 7: return "DARK_GREEN";
    case 8: return "WHITE";
    case 9: return "DARK_MAGENTA";
    case 10: return "ORANGE";
    case 11: return "CYAN";
  }
  return "BLACK";
}

/** Returns the ColorHex member name used by the Python for a grade. */
export function color_from_grade(grade_id: number): string {
  switch (grade_id) {
    case 0: return "RED";
    case 1: return "ORANGE";
    case 2: return "YELLOW";
    case 3: return "GREEN";
    case 4: return "BLUE";
  }
  return "BLACK";
}

export function color_from_effect(_effect_id: number): string {
  return "@t";
}

function sort_orbs_list(orbs: OrbInfo[]): void {
  orbs.sort((a, b) => a.raw_orb_info.orb_id - b.raw_orb_info.orb_id);
  orbs.sort((a, b) => a.raw_orb_info.rank_id - b.raw_orb_info.rank_id);
  orbs.sort((a, b) => a.raw_orb_info.effect_id - b.raw_orb_info.effect_id);
  orbs.sort((a, b) => (a.raw_orb_info.target_id || -1) - (b.raw_orb_info.target_id || -1));
}

export class SaveOrbs {
  constructor(
    public orbs: Map<number, SaveOrb>,
    public orb_info_list: OrbInfoList,
  ) {}

  static from_save_file(save_file: SaveFile): SaveOrbs | null {
    const orb_info_list = OrbInfoList.create(save_file);
    if (orb_info_list === null) return null;
    const orbs = new Map<number, SaveOrb>();
    for (const [orb_id, orb] of save_file.talent_orbs.orbs) {
      const orb_info = orb_info_list.orb_info_list[orb_id] ?? OrbInfo.create_unknown(orb_id);
      orbs.set(orb_id, new SaveOrb(orb_info, orb.value));
    }
    return new SaveOrbs(orbs, orb_info_list);
  }

  /** Sorts the orbs map (attribute, effect, grade, id; attribute most important). */
  sort_orbs(): void {
    const list = Array.from(this.orbs.values());
    sort_orbs_list_save(list);
    // Python sorts a throw-away list; the dict is left untouched. Kept for parity.
  }

  /** Orbs sorted for display (same ordering as Python's sort_orbs). */
  get_sorted_orbs(): SaveOrb[] {
    const list = Array.from(this.orbs.values());
    sort_orbs_list_save(list);
    return list;
  }

  localize_attribute(attribute: string | null): string | null {
    if (attribute !== null) return attribute;
    return null;
  }

  /** Set one orb's count (non-interactive `edit_ind`). */
  edit_ind(orb: OrbInfo, orb_count: number): void {
    this.orbs.set(orb.raw_orb_info.orb_id, new SaveOrb(orb, orb_count));
  }

  /** Set all selected orbs to the same count, clamped to int16/max_orbs (non-interactive `edit_many`). */
  edit_many(max_orbs: number, orb_selection: OrbInfo[], orb_count: number): void {
    orb_count = Math.max(0, Math.min(orb_count, max_orbs, 32767));
    for (const orb of orb_selection) {
      this.orbs.set(orb.raw_orb_info.orb_id, new SaveOrb(orb, orb_count));
    }
  }

  /**
   * Non-interactive part of Python `edit`: parse the user's comma separated
   * selection string (e.g. "red angel attack, * ") into a sorted unique list of orbs.
   * Returns null if the selection is the quit key.
   */
  select_orbs(orb_input: string, quit_key: string | null = null): OrbInfo[] | null {
    const all_grades = this.orb_info_list.get_all_grades().slice().sort();
    const all_attributes_raw = this.orb_info_list.get_all_attributes();
    const all_attributes = all_attributes_raw
      .map((a) => this.localize_attribute(a) || "")
      .filter((a) => a)
      .sort();
    const all_effects = this.orb_info_list.get_all_effects().slice().sort();
    const all_effect_ids = all_effects.map((_, i) => i);

    const orb_input_selection = orb_input.toLowerCase().split("angle").join("angel").split(",");
    if (quit_key !== null && orb_input_selection.length === 1 && orb_input_selection[0] === quit_key) {
      return null;
    }

    let orb_selection: OrbInfo[] = [];
    for (const raw of orb_input_selection) {
      let grade: string | null = null;
      let attribute: string | null = null;
      let effect: string | null = null;
      const parts = raw
        .trim()
        .split(" ")
        .map((p) => p.toLowerCase())
        .filter((p) => p !== "");
      if (parts.length === 0) continue;
      if (parts[0] === "*") {
        orb_selection = this.orb_info_list.orb_info_list.slice();
        break;
      }
      for (const g of all_grades) {
        if (parts.includes(g.toLowerCase())) {
          grade = g;
          break;
        }
      }
      for (const a of all_attributes) {
        if (parts.includes(a.toLowerCase())) {
          attribute = a;
          break;
        }
      }
      for (const e of all_effect_ids) {
        if (parts.includes(String(e))) {
          effect = all_effects[e];
          break;
        }
      }
      if (grade === null) grade = "*";
      if (attribute === null) attribute = "*";
      if (effect === null) effect = "*";
      orb_selection.push(...this.orb_info_list.get_orbs_from_component_fuzzy(grade, attribute, effect));
    }

    orb_selection = Array.from(new Set(orb_selection));
    sort_orbs_list(orb_selection);
    return orb_selection;
  }

  /** Write the orbs to the save file. */
  save(save_file: SaveFile): void {
    for (const [orb_id, orb] of this.orbs) {
      save_file.talent_orbs.orbs.set(orb_id, new TalentOrb(orb_id, orb.count));
    }
  }

  /** Python `edit_talent_orbs` minus the interactive part: returns the SaveOrbs for editing (or null). */
  static edit_talent_orbs(save_file: SaveFile): SaveOrbs | null {
    return SaveOrbs.from_save_file(save_file);
  }
}

function sort_orbs_list_save(orbs: SaveOrb[]): void {
  orbs.sort((a, b) => a.orb.raw_orb_info.orb_id - b.orb.raw_orb_info.orb_id);
  orbs.sort((a, b) => a.orb.raw_orb_info.rank_id - b.orb.raw_orb_info.rank_id);
  orbs.sort((a, b) => a.orb.raw_orb_info.effect_id - b.orb.raw_orb_info.effect_id);
  orbs.sort((a, b) => (a.orb.raw_orb_info.target_id || -1) - (b.orb.raw_orb_info.target_id || -1));
}
