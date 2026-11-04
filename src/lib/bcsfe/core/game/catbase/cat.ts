/** Port of bcsfe/core/game/catbase/cat.py */
import type { Data } from "@/lib/bcsfe/core/io/data";
import type { SaveFile } from "@/lib/bcsfe/core/io/save";
import type { GameVersion } from "@/lib/bcsfe/core/game_version";
import { CSV, Delimeter, Row } from "@/lib/bcsfe/core/io/bc_csv";
import { core_data } from "@/lib/bcsfe/core/core_data";
import { ConfigKey } from "@/lib/bcsfe/core/config";
import { Upgrade } from "@/lib/bcsfe/core/game/catbase/upgrade";
import { mapToObject, objectToMap, times } from "@/lib/bcsfe/core/utils";

export class SkillLevel {
  constructor(
    public id: number,
    public levels: number[],
  ) {}

  get_total_levels(): number {
    return this.levels.length;
  }

  static from_row(row: Row): SkillLevel {
    const id = row.get(0).to_int();
    const levels = row.slice(1).to_int_list();
    return new SkillLevel(id, levels);
  }
}

export class SkillLevelData {
  constructor(public levels: SkillLevel[] | null) {}

  static from_game_data(save_file: SaveFile): SkillLevelData | null {
    const gdg = core_data.get_game_data_getter(save_file);
    const data = gdg.download("DataLocal", "SkillLevel.csv");
    if (data === null) return null;
    const csv = new CSV(data);
    const levels: SkillLevel[] = [];
    for (const line of csv.lines.slice(1)) levels.push(SkillLevel.from_row(line));
    return new SkillLevelData(levels);
  }

  get_skill_level(id: number): SkillLevel | null {
    if (this.levels === null) return null;
    for (const level of this.levels) {
      if (level.id === id) return level;
    }
    return null;
  }
}

export class Skill {
  constructor(
    public ability_id: number,
    public max_lv: number,
    public min1: number,
    public max1: number,
    public min2: number,
    public max2: number,
    public min3: number,
    public max3: number,
    public min4: number,
    public max4: number,
    public text_id: number,
    public lvid: number,
    public name_id: number,
    public limit: number,
  ) {}
}

export class CatSkill {
  constructor(
    public cat_id: number,
    public type_id: number,
    public skills: Skill[],
  ) {}

  static from_row(row: Row): CatSkill {
    const cat_id = row.get(0).to_int();
    const type_id = row.get(1).to_int();
    const skills: Skill[] = [];
    for (let i = 2; i < row.length; i += 14) {
      skills.push(
        new Skill(
          row.get(i).to_int(),
          row.get(i + 1).to_int(),
          row.get(i + 2).to_int(),
          row.get(i + 3).to_int(),
          row.get(i + 4).to_int(),
          row.get(i + 5).to_int(),
          row.get(i + 6).to_int(),
          row.get(i + 7).to_int(),
          row.get(i + 8).to_int(),
          row.get(i + 9).to_int(),
          row.get(i + 10).to_int(),
          row.get(i + 11).to_int(),
          row.get(i + 12).to_int(),
          row.get(i + 13).to_int(),
        ),
      );
    }
    return new CatSkill(cat_id, type_id, skills);
  }
}

export class CatSkills {
  constructor(public skills: Map<number, CatSkill>) {}

  static from_game_data(save_file: SaveFile): CatSkills | null {
    const gdg = core_data.get_game_data_getter(save_file);
    const data = gdg.download("DataLocal", "SkillAcquisition.csv");
    if (data === null) return null;
    const csv = new CSV(data);
    const skills = new Map<number, CatSkill>();
    for (const line of csv.lines.slice(1)) {
      const skill = CatSkill.from_row(line);
      skills.set(skill.cat_id, skill);
    }
    return new CatSkills(skills);
  }

  get_cat_skill(cat_id: number): CatSkill | null {
    return this.skills.get(cat_id) ?? null;
  }
}

export class SkillNames {
  constructor(public names: Map<number, string>) {}

  static from_game_data(save_file: SaveFile): SkillNames | null {
    const gdg = core_data.get_game_data_getter(save_file);
    const data = gdg.download("resLocal", "SkillDescriptions.csv");
    if (data === null) return null;
    const csv = new CSV(data, Delimeter.from_country_code_res(save_file.cc));
    const names = new Map<number, string>();
    for (const line of csv.lines.slice(1)) {
      names.set(line.get(0).to_int(), line.get(1).to_str());
    }
    return new SkillNames(names);
  }

  get_skill_name(skill_id: number): string | null {
    return this.names.get(skill_id) ?? null;
  }
}

export class TalentData {
  constructor(
    public skill_names: SkillNames,
    public skill_levels: SkillLevelData,
    public cats: CatSkills,
  ) {}

  static from_game_data(save_file: SaveFile): TalentData | null {
    const skill_names = SkillNames.from_game_data(save_file);
    const skill_levels = SkillLevelData.from_game_data(save_file);
    const cats = CatSkills.from_game_data(save_file);
    if (skill_names === null || skill_levels === null || cats === null) return null;
    return new TalentData(skill_names, skill_levels, cats);
  }

  get_skill_name(skill_id: number): string | null {
    return this.skill_names.get_skill_name(skill_id);
  }

  get_skill_level(skill_id: number): SkillLevel | null {
    return this.skill_levels.get_skill_level(skill_id);
  }

  get_cat_skill(cat_id: number): CatSkill | null {
    return this.cats.get_cat_skill(cat_id);
  }

  get_skill_from_cat(cat_id: number, skill_id: number): Skill | null {
    const cat_skill = this.get_cat_skill(cat_id);
    if (cat_skill === null) return null;
    for (const skill of cat_skill.skills) {
      if (skill.ability_id === skill_id) return skill;
    }
    return null;
  }

  get_talent_from_cat_skill(cat: Cat, skill_id: number): Talent | null {
    const talents = cat.talents;
    if (talents === null) return null;
    for (const talent of talents) {
      if (talent.id === skill_id) return talent;
    }
    return null;
  }

  get_cat_skill_name(cat_id: number, skill_id: number): string | null {
    const skill = this.get_skill_from_cat(cat_id, skill_id);
    if (skill === null) return null;
    return this.get_skill_name(skill.text_id);
  }

  get_cat_skill_level(cat_id: number, skill_id: number): SkillLevel | null {
    const skill = this.get_skill_from_cat(cat_id, skill_id);
    if (skill === null) return null;
    return this.get_skill_level(skill.lvid);
  }

  /** Returns [talent_names, max_levels, current_levels, ids] */
  get_cat_talents(cat: Cat): [string[], number[], number[], number[]] | null {
    const talent_data_cat = this.get_cat_skill(cat.id);
    if (talent_data_cat === null || cat.talents === null) return null;
    const talent_names: string[] = [];
    const max_levels: number[] = [];
    const current_levels: number[] = [];
    const ids: number[] = [];
    for (const skill of talent_data_cat.skills) {
      const name = this.get_skill_name(skill.text_id);
      const talent = this.get_talent_from_cat_skill(cat, skill.ability_id);
      if (name === null || talent === null) continue;

      let max_level = skill.max_lv;
      if (max_level === 0) max_level = 1;

      max_levels.push(max_level);
      talent_names.push(name.split("<br>")[0]);
      current_levels.push(talent.level);
      ids.push(skill.ability_id);
    }
    return [talent_names, max_levels, current_levels, ids];
  }
}

export class Talent {
  constructor(
    public id: number,
    public level: number,
  ) {}

  static init(): Talent {
    return new Talent(0, 0);
  }

  reset(): void {
    this.level = 0;
  }

  static read(stream: Data): Talent {
    const id = stream.read_int();
    const level = stream.read_int();
    return new Talent(id, level);
  }

  write(stream: Data): void {
    stream.write_int(this.id);
    stream.write_int(this.level);
  }

  serialize(): { id: number; level: number } {
    return { id: this.id, level: this.level };
  }

  static deserialize(data: { id: number; level: number }): Talent {
    return new Talent(data.id, data.level);
  }
}

export class NyankoPictureBookCatData {
  constructor(
    public cat_id: number,
    public is_displayed_in_catguide: boolean,
    public limited: boolean,
    public total_forms: number,
    public hint_display_type: number,
    public scale_0: number,
    public scale_1: number,
    public scale_2: number,
    public scale_3: number,
  ) {}
}

export class NyankoPictureBook {
  cats: NyankoPictureBookCatData[] | null;

  constructor(public save_file: SaveFile) {
    this.cats = this.get_cats();
  }

  get_cats(): NyankoPictureBookCatData[] | null {
    const gdg = core_data.get_game_data_getter(this.save_file);
    const data = gdg.download("DataLocal", "nyankoPictureBookData.csv");
    if (data === null) return null;
    const csv = new CSV(data);
    const cats: NyankoPictureBookCatData[] = [];
    let i = 0;
    for (const line of csv) {
      cats.push(
        new NyankoPictureBookCatData(
          i,
          line.get(0).to_bool(),
          line.get(1).to_bool(),
          line.get(2).to_int(),
          line.get(3).to_int(),
          line.get(4).to_int(),
          line.get(5).to_int(),
          line.get(6).to_int(),
          line.get(7).to_int(),
        ),
      );
      i++;
    }
    return cats;
  }

  get_cat(cat_id: number): NyankoPictureBookCatData | null {
    if (this.cats === null) return null;
    for (const cat of this.cats) {
      if (cat.cat_id === cat_id) return cat;
    }
    return null;
  }

  get_obtainable_cats(): NyankoPictureBookCatData[] | null {
    if (this.cats === null) return null;
    return this.cats.filter((cat) => cat.is_displayed_in_catguide);
  }
}

/** Represents an item used to evolve a unit. */
export class EvolveItem {
  constructor(
    public item_id: number,
    public amount: number,
  ) {}

  toString(): string {
    return `${this.item_id}:${this.amount}`;
  }
}

/** Represents the items used to evolve a unit. */
export class EvolveItems {
  constructor(public evolve_items: EvolveItem[]) {}

  static from_unit_buy_list(raw_data: Row, start_index: number): EvolveItems {
    const items: EvolveItem[] = [];
    for (let i = 0; i < 5; i++) {
      const item_id = raw_data.get(start_index + i * 2).to_int();
      const amount = raw_data.get(start_index + 1 + i * 2).to_int();
      items.push(new EvolveItem(item_id, amount));
    }
    return new EvolveItems(items);
  }
}

export class UnitBuyCatData {
  stage_unlock!: number;
  purchase_cost!: number;
  upgrade_costs!: number[];
  unlock_source!: number;
  rarity!: number;
  position_order!: number;
  chapter_unlock!: number;
  sell_price!: number;
  gatya_rarity!: number;
  original_max_levels!: [number, number];
  force_true_form_level!: number;
  second_form_unlock_level!: number;
  unknown_22!: number;
  tf_id!: number;
  ff_id!: number;
  evolve_level_tf!: number;
  evolve_level_ff!: number;
  evolve_cost_tf!: number;
  evolve_items_tf!: EvolveItems;
  evolve_cost_ff!: number;
  evolve_items_ff!: EvolveItems;
  max_upgrade_level_no_catseye!: number;
  max_upgrade_level_catseye!: number;
  max_plus_upgrade_level!: number;
  unknown_52!: number;
  unknown_53!: number;
  unknown_54!: number;
  unknown_55!: number;
  catseye_usage_pattern!: number;
  game_version!: number;
  np_sell_price!: number;
  unknwon_59!: number;
  unknown_60!: number;
  egg_value!: number;
  egg_id!: number;

  constructor(
    public id: number,
    raw_data: Row,
  ) {
    this.assign(raw_data);
  }

  assign(raw_data: Row): void {
    const g = (i: number) => raw_data.get(i).to_int();
    this.stage_unlock = g(0);
    this.purchase_cost = g(1);
    this.upgrade_costs = [];
    for (let i = 2; i < 12; i++) this.upgrade_costs.push(g(i));
    this.unlock_source = g(12);
    this.rarity = g(13);
    this.position_order = g(14);
    this.chapter_unlock = g(15);
    this.sell_price = g(16);
    this.gatya_rarity = g(17);
    this.original_max_levels = [g(18), g(19)];
    this.force_true_form_level = g(20);
    this.second_form_unlock_level = g(21);
    this.unknown_22 = g(22);
    this.tf_id = g(23);
    this.ff_id = g(24);
    this.evolve_level_tf = g(25);
    this.evolve_level_ff = g(26);
    this.evolve_cost_tf = g(27);
    this.evolve_items_tf = EvolveItems.from_unit_buy_list(raw_data, 28);
    this.evolve_cost_ff = g(38);
    this.evolve_items_ff = EvolveItems.from_unit_buy_list(raw_data, 39);
    this.max_upgrade_level_no_catseye = g(49);
    this.max_upgrade_level_catseye = g(50);
    this.max_plus_upgrade_level = g(51);
    this.unknown_52 = g(52);
    this.unknown_53 = g(53);
    this.unknown_54 = g(54);
    this.unknown_55 = g(55);
    this.catseye_usage_pattern = g(56);
    this.game_version = g(57);
    this.np_sell_price = g(58);
    this.unknwon_59 = g(59);
    this.unknown_60 = g(60);
    this.egg_value = g(61);
    this.egg_id = g(62);
  }
}

export class UnitBuy {
  unit_buy: UnitBuyCatData[] | null;

  constructor(public save_file: SaveFile) {
    this.unit_buy = this.read_unit_buy();
  }

  read_unit_buy(): UnitBuyCatData[] | null {
    const unit_buy: UnitBuyCatData[] = [];
    const gdg = core_data.get_game_data_getter(this.save_file);
    const data = gdg.download("DataLocal", "unitbuy.csv");
    if (data === null) return null;
    const csv = new CSV(data);
    let i = 0;
    for (const line of csv) {
      unit_buy.push(new UnitBuyCatData(i, line));
      i++;
    }
    return unit_buy;
  }

  get_unit_buy(id: number): UnitBuyCatData | null {
    if (this.unit_buy === null) return null;
    // Python negative indexes wrap around
    const idx = id < 0 ? this.unit_buy.length + id : id;
    return this.unit_buy[idx] ?? null;
  }

  get_cat_rarity(id: number): number {
    const unit_buy = this.get_unit_buy(id);
    if (unit_buy === null) return -1;
    return unit_buy.rarity;
  }

  filter_rarity(rarity: number): number[] | null {
    if (this.unit_buy === null) return null;
    const ids: number[] = [];
    this.unit_buy.forEach((cat, i) => {
      if (cat.rarity === rarity) ids.push(i);
    });
    return ids;
  }
}

export class UnitLimitCatData {
  constructor(
    public cat_id: number,
    public values: number[],
  ) {}
}

export class UnitLimit {
  unit_limit: UnitLimitCatData[] | null;

  constructor(public save_file: SaveFile) {
    this.unit_limit = this.read_unit_limit();
  }

  read_unit_limit(): UnitLimitCatData[] | null {
    const unit_limit: UnitLimitCatData[] = [];
    const gdg = core_data.get_game_data_getter(this.save_file);
    const data = gdg.download("DataLocal", "unitlimit.csv");
    if (data === null) return null;
    const csv = new CSV(data);
    let i = 0;
    for (const line of csv) {
      unit_limit.push(new UnitLimitCatData(i, line.to_int_list()));
      i++;
    }
    return unit_limit;
  }

  get_unit_limit(id: number): UnitLimitCatData | null {
    if (this.unit_limit === null) return null;
    const idx = id < 0 ? this.unit_limit.length + id : id;
    return this.unit_limit[idx] ?? null;
  }
}

export class Cat {
  talents: Talent[] | null = null;
  upgrade: Upgrade = Upgrade.init();
  current_form = 0;
  unlocked_forms = 0;
  gatya_seen = 0;
  max_upgrade_level: Upgrade = Upgrade.init();
  catguide_collected = false;
  fourth_form = 0;
  catseyes_used = 0;

  names: string[] | null = null;

  constructor(
    public id: number,
    public unlocked: number,
  ) {}

  get_talent_from_id(id: number): Talent | null {
    for (const talent of this.talents ?? []) {
      if (talent.id === id) return talent;
    }
    return null;
  }

  unlock(save_file: SaveFile): void {
    this.unlocked = 1;
    this.gatya_seen = 1;
    core_data.get_chara_drop(save_file).unlock_drops_from_cat_id(this.id);
    save_file.unlock_equip_menu();
  }

  remove(reset = false, save_file: SaveFile | null = null): void {
    this.unlocked = 0;
    if (reset) {
      this.reset();
      if (save_file !== null) {
        save_file.cats.chara_new_flags.set(this.id, 0);
        core_data.get_chara_drop(save_file).remove_drops_from_cat_id(this.id);
      }
    }
  }

  true_form(save_file: SaveFile, set_current_form = true): void {
    this.set_form(2, save_file, set_current_form);
  }

  set_form(form: number, save_file: SaveFile, set_current_form = true): void {
    if (core_data.config.get_bool(ConfigKey.UNLOCK_CAT_ON_EDIT)) this.unlock(save_file);
    this.unlocked_forms = form + 1;
    if (set_current_form) this.current_form = form;
  }

  set_form_true(
    save_file: SaveFile,
    total_forms: number,
    set_current_form = true,
    fourth_form = false,
  ): void {
    if (total_forms === 4 && fourth_form) {
      this.unlock_fourth_form(save_file, set_current_form);
    } else if (total_forms >= 3) {
      this.true_form(save_file, set_current_form);
    } else if (total_forms === 2) {
      this.unlocked_forms = 0;
      this.current_form = 1;
    } else {
      this.unlocked_forms = 0;
      this.current_form = 0;
    }
  }

  remove_true_form(): void {
    this.unlocked_forms = 0;
    this.current_form = Math.min(this.current_form, 1);
    this.fourth_form = 0;
  }

  unlock_fourth_form(save_file: SaveFile, set_current_form = true): void {
    if (set_current_form) this.current_form = 3;
    this.unlocked_forms = 3;
    if (core_data.config.get_bool(ConfigKey.UNLOCK_CAT_ON_EDIT)) this.unlock(save_file);
    this.fourth_form = 2;
  }

  remove_fourth_form(): void {
    this.current_form = Math.min(this.current_form, 2);
    this.fourth_form = 0;
  }

  set_upgrade(save_file: SaveFile, upgrade: Upgrade, only_plus = false): void {
    if (core_data.config.get_bool(ConfigKey.UNLOCK_CAT_ON_EDIT)) this.unlock(save_file);
    const base = upgrade.base;
    const plus = upgrade.plus;
    if (base !== -1 && !only_plus) this.upgrade.base = upgrade.get_random_base();
    if (plus !== -1) this.upgrade.plus = upgrade.get_random_plus();
  }

  upgrade_base(save_file: SaveFile): void {
    if (core_data.config.get_bool(ConfigKey.UNLOCK_CAT_ON_EDIT)) this.unlock(save_file);
    this.upgrade.upgrade();
  }

  reset(): void {
    this.unlocked = 0;
    this.current_form = 0;
    this.unlocked_forms = 0;
    this.gatya_seen = 0;
    this.catguide_collected = false;
    this.fourth_form = 0;
    this.catseyes_used = 0;
    this.upgrade.reset();
    for (const talent of this.talents ?? []) talent.reset();
  }

  static init(id: number): Cat {
    return new Cat(id, 0);
  }

  static read_unlocked(id: number, stream: Data): Cat {
    return new Cat(id, stream.read_int());
  }

  write_unlocked(stream: Data): void {
    stream.write_int(this.unlocked);
  }

  read_upgrade(stream: Data): void {
    this.upgrade = Upgrade.read(stream);
  }

  write_upgrade(stream: Data): void {
    this.upgrade.write(stream);
  }

  read_current_form(stream: Data): void {
    this.current_form = stream.read_int();
  }

  write_current_form(stream: Data): void {
    stream.write_int(this.current_form);
  }

  read_unlocked_forms(stream: Data): void {
    this.unlocked_forms = stream.read_int();
  }

  write_unlocked_forms(stream: Data): void {
    stream.write_int(this.unlocked_forms);
  }

  read_gatya_seen(stream: Data): void {
    this.gatya_seen = stream.read_int();
  }

  write_gatya_seen(stream: Data): void {
    stream.write_int(this.gatya_seen);
  }

  read_max_upgrade_level(stream: Data): void {
    this.max_upgrade_level = Upgrade.read(stream);
  }

  write_max_upgrade_level(stream: Data): void {
    this.max_upgrade_level.write(stream);
  }

  read_catguide_collected(stream: Data): void {
    this.catguide_collected = stream.read_bool();
  }

  write_catguide_collected(stream: Data): void {
    stream.write_bool(this.catguide_collected);
  }

  read_fourth_form(stream: Data): void {
    this.fourth_form = stream.read_int();
  }

  write_fourth_form(stream: Data): void {
    stream.write_int(this.fourth_form);
  }

  read_catseyes_used(stream: Data): void {
    this.catseyes_used = stream.read_int();
  }

  write_catseyes_used(stream: Data): void {
    stream.write_int(this.catseyes_used);
  }

  serialize(): CatJson {
    return {
      id: this.id,
      unlocked: this.unlocked,
      upgrade: this.upgrade.serialize(),
      current_form: this.current_form,
      unlocked_forms: this.unlocked_forms,
      gatya_seen: this.gatya_seen,
      max_upgrade_level: this.max_upgrade_level.serialize(),
      catguide_collected: this.catguide_collected,
      fourth_form: this.fourth_form,
      catseyes_used: this.catseyes_used,
      talents: this.talents !== null ? this.talents.map((t) => t.serialize()) : null,
    };
  }

  static deserialize(data: CatJson): Cat {
    const cat = new Cat(data.id, data.unlocked);
    cat.upgrade = Upgrade.deserialize(data.upgrade);
    cat.current_form = data.current_form;
    cat.unlocked_forms = data.unlocked_forms;
    cat.gatya_seen = data.gatya_seen;
    cat.max_upgrade_level = Upgrade.deserialize(data.max_upgrade_level);
    cat.catguide_collected = data.catguide_collected;
    cat.fourth_form = data.fourth_form;
    cat.catseyes_used = data.catseyes_used;
    cat.talents = data.talents !== null ? data.talents.map((t) => Talent.deserialize(t)) : null;
    return cat;
  }

  read_talents(stream: Data): void {
    this.talents = [];
    const n = stream.read_int();
    for (let i = 0; i < n; i++) this.talents.push(Talent.read(stream));
  }

  write_talents(stream: Data): void {
    if (this.talents === null) return;
    stream.write_int(this.talents.length);
    for (const talent of this.talents) talent.write(stream);
  }

  get_names_cls(save_file: SaveFile): string[] | null {
    if (this.names === null) this.names = Cat.get_names(this.id, save_file);
    return this.names;
  }

  static get_names(id: number, save_file: SaveFile): string[] | null {
    const file_name = `Unit_Explanation${id + 1}_${core_data.get_lang(save_file)}.csv`;
    const data = core_data.get_game_data_getter(save_file).download("resLocal", file_name);
    if (data === null) return null;
    const csv = new CSV(data, Delimeter.from_country_code_res(save_file.cc), false, true, false);
    const names: string[] = [];
    for (const line of csv.lines) names.push(line.get(0).to_str());
    return names;
  }
}

export interface CatJson {
  id: number;
  unlocked: number;
  upgrade: { plus: number; base: number };
  current_form: number;
  unlocked_forms: number;
  gatya_seen: number;
  max_upgrade_level: { plus: number; base: number };
  catguide_collected: boolean;
  fourth_form: number;
  catseyes_used: number;
  talents: { id: number; level: number }[] | null;
}

export class StorageItem {
  item_type = 0;

  constructor(public item_id: number) {}

  static from_cat(cat_id: number): StorageItem {
    const item = new StorageItem(cat_id);
    item.item_type = 1;
    return item;
  }

  static from_special_skill(special_skill_id: number): StorageItem {
    const item = new StorageItem(special_skill_id);
    item.item_type = 2;
    return item;
  }

  static init(): StorageItem {
    return new StorageItem(0);
  }

  static read_item_id(stream: Data): StorageItem {
    return new StorageItem(stream.read_int());
  }

  write_item_id(stream: Data): void {
    stream.write_int(this.item_id);
  }

  read_item_type(stream: Data): void {
    this.item_type = stream.read_int();
  }

  write_item_type(stream: Data): void {
    stream.write_int(this.item_type);
  }

  serialize(): { item_id: number; item_type: number } {
    return { item_id: this.item_id, item_type: this.item_type };
  }

  static deserialize(data: { item_id?: number; item_type?: number }): StorageItem {
    const item = new StorageItem(data.item_id ?? 0);
    item.item_type = data.item_type ?? 0;
    return item;
  }
}

export class Cats {
  storage_items: StorageItem[];
  favourites: Map<number, boolean> = new Map();
  chara_new_flags: Map<number, number> = new Map();
  unit_buy: UnitBuy | null = null;
  unit_limit: UnitLimit | null = null;
  nyanko_picture_book: NyankoPictureBook | null = null;
  talent_data: TalentData | null = null;

  constructor(
    public cats: Cat[],
    total_storage_items = 0,
  ) {
    this.storage_items = times(total_storage_items, () => StorageItem.init());
  }

  get_all_cats(): Cat[] {
    return this.cats;
  }

  static init(gv: GameVersion): Cats {
    let total_cats = Cats.get_gv_cats(gv);
    if (total_cats === null) total_cats = 0;
    const cats_l: Cat[] = [];
    for (let i = 0; i < total_cats; i++) cats_l.push(Cat.init(i));

    const total_storage_items = gv.lt(110100) ? 100 : 0;
    return new Cats(cats_l, total_storage_items);
  }

  static get_gv_cats(gv: GameVersion): number | null {
    if (gv.eq(20)) return 203;
    if (gv.eq(21)) return 214;
    if (gv.eq(22)) return 231;
    if (gv.eq(23)) return 241;
    if (gv.eq(24)) return 249;
    if (gv.eq(25)) return 260;
    return null;
  }

  get_unlocked_cats(): Cat[] {
    return this.cats.filter((cat) => cat.unlocked);
  }

  get_non_unlocked_cats(): Cat[] {
    return this.cats.filter((cat) => !cat.unlocked);
  }

  get_non_gacha_cats(save_file: SaveFile): Cat[] {
    const unitbuy = this.read_unitbuy(save_file);
    const cats: Cat[] = [];
    for (const cat of this.cats) {
      const unit_buy_data = unitbuy.get_unit_buy(cat.id);
      if (unit_buy_data === null) continue;
      if (unit_buy_data.unlock_source !== 2) cats.push(cat);
    }
    return cats;
  }

  read_unitbuy(save_file: SaveFile): UnitBuy {
    if (this.unit_buy === null) this.unit_buy = new UnitBuy(save_file);
    return this.unit_buy;
  }

  read_unitlimit(save_file: SaveFile): UnitLimit {
    if (this.unit_limit === null) this.unit_limit = new UnitLimit(save_file);
    return this.unit_limit;
  }

  read_nyanko_picture_book(save_file: SaveFile): NyankoPictureBook {
    if (this.nyanko_picture_book === null) this.nyanko_picture_book = new NyankoPictureBook(save_file);
    return this.nyanko_picture_book;
  }

  read_talent_data(save_file: SaveFile): TalentData | null {
    if (this.talent_data === null) this.talent_data = TalentData.from_game_data(save_file);
    return this.talent_data;
  }

  get_cats_rarity(save_file: SaveFile, rarity: number): Cat[] {
    const unit_buy = this.read_unitbuy(save_file);
    return this.cats.filter((cat) => unit_buy.get_cat_rarity(cat.id) === rarity);
  }

  get_cats_name(save_file: SaveFile, search_name: string): Cat[] {
    const cats: Cat[] = [];
    for (const cat of this.cats) {
      const names = cat.get_names_cls(save_file);
      if (names === null) continue;
      for (const name of names) {
        if (name.toLowerCase().includes(search_name.toLowerCase())) {
          cats.push(cat);
          break;
        }
      }
    }
    return cats;
  }

  get_cats_obtainable(save_file: SaveFile): Cat[] | null {
    const nyanko_picture_book = this.read_nyanko_picture_book(save_file);
    const obtainable_cats = nyanko_picture_book.get_obtainable_cats();
    if (obtainable_cats === null) return null;
    const ny_cats = obtainable_cats.map((c) => c.cat_id);
    return this.cats.filter((cat) => ny_cats.includes(cat.id));
  }

  get_cats_non_obtainable(save_file: SaveFile): Cat[] | null {
    const nyanko_picture_book = this.read_nyanko_picture_book(save_file);
    const obtainable_cats = nyanko_picture_book.get_obtainable_cats();
    if (obtainable_cats === null) return null;
    const ny_cats = obtainable_cats.map((c) => c.cat_id);
    return this.cats.filter((cat) => !ny_cats.includes(cat.id));
  }

  get_cats_gatya_banner(save_file: SaveFile, gatya_id: number): Cat[] | null {
    const cat_ids = save_file.gatya.read_gatya_data_set(save_file).get_cat_ids(gatya_id);
    if (cat_ids === null) return null;
    return this.get_cats_by_ids(cat_ids);
  }

  true_form_cats(save_file: SaveFile, cats: Cat[], force = false, set_current_forms = true): void {
    const pic_book = this.read_nyanko_picture_book(save_file);
    for (const cat of cats) {
      const pic_book_cat = pic_book.get_cat(cat.id);
      if (force) {
        cat.true_form(save_file, set_current_forms);
      } else if (pic_book_cat !== null) {
        cat.set_form_true(save_file, pic_book_cat.total_forms, set_current_forms);
      }
    }
  }

  fourth_form_cats(save_file: SaveFile, cats: Cat[], force = false, set_current_forms = true): void {
    const pic_book = this.read_nyanko_picture_book(save_file);
    for (const cat of cats) {
      const pic_book_cat = pic_book.get_cat(cat.id);
      if (force) {
        cat.unlock_fourth_form(save_file, set_current_forms);
      } else if (pic_book_cat !== null) {
        cat.set_form_true(save_file, pic_book_cat.total_forms, set_current_forms, true);
      }
    }
  }

  get_cats_by_ids(ids: number[]): Cat[] {
    return this.cats.filter((cat) => ids.includes(cat.id));
  }

  get_cat_by_id(id: number): Cat | null {
    for (const cat of this.cats) {
      if (cat.id === id) return cat;
    }
    return null;
  }

  static get_rarity_names(save_file: SaveFile): string[] {
    const localizable = save_file.get_localizable();
    const rarity_names: string[] = [];
    let rarity_index = 1;
    for (;;) {
      const rarity_name = localizable.get(`rarity_name_${rarity_index}`);
      if (rarity_name === null || rarity_name === undefined) break;
      rarity_names.push(rarity_name);
      rarity_index += 1;
    }
    return rarity_names;
  }

  static read_unlocked(stream: Data, gv: GameVersion): Cats {
    let total_cats = Cats.get_gv_cats(gv);
    if (total_cats === null) total_cats = stream.read_int();
    const cats_l: Cat[] = [];
    for (let i = 0; i < total_cats; i++) cats_l.push(Cat.read_unlocked(i, stream));
    return new Cats(cats_l);
  }

  write_unlocked(stream: Data, gv: GameVersion): void {
    if (Cats.get_gv_cats(gv) === null) stream.write_int(this.cats.length);
    for (const cat of this.cats) cat.write_unlocked(stream);
  }

  read_upgrade(stream: Data, gv: GameVersion): void {
    if (Cats.get_gv_cats(gv) === null) stream.read_int();
    for (const cat of this.cats) cat.read_upgrade(stream);
  }

  write_upgrade(stream: Data, gv: GameVersion): void {
    if (Cats.get_gv_cats(gv) === null) stream.write_int(this.cats.length);
    for (const cat of this.cats) cat.write_upgrade(stream);
  }

  read_current_form(stream: Data, gv: GameVersion): void {
    if (Cats.get_gv_cats(gv) === null) stream.read_int();
    for (const cat of this.cats) cat.read_current_form(stream);
  }

  write_current_form(stream: Data, gv: GameVersion): void {
    if (Cats.get_gv_cats(gv) === null) stream.write_int(this.cats.length);
    for (const cat of this.cats) cat.write_current_form(stream);
  }

  read_unlocked_forms(stream: Data, gv: GameVersion): void {
    if (Cats.get_gv_cats(gv) === null) stream.read_int();
    for (const cat of this.cats) cat.read_unlocked_forms(stream);
  }

  write_unlocked_forms(stream: Data, gv: GameVersion): void {
    if (Cats.get_gv_cats(gv) === null) stream.write_int(this.cats.length);
    for (const cat of this.cats) cat.write_unlocked_forms(stream);
  }

  read_gatya_seen(stream: Data, gv: GameVersion): void {
    if (Cats.get_gv_cats(gv) === null) stream.read_int();
    for (const cat of this.cats) cat.read_gatya_seen(stream);
  }

  write_gatya_seen(stream: Data, gv: GameVersion): void {
    if (Cats.get_gv_cats(gv) === null) stream.write_int(this.cats.length);
    for (const cat of this.cats) cat.write_gatya_seen(stream);
  }

  read_max_upgrade_levels(stream: Data, gv: GameVersion): void {
    if (Cats.get_gv_cats(gv) === null) stream.read_int();
    for (const cat of this.cats) cat.read_max_upgrade_level(stream);
  }

  write_max_upgrade_levels(stream: Data, gv: GameVersion): void {
    if (Cats.get_gv_cats(gv) === null) stream.write_int(this.cats.length);
    for (const cat of this.cats) cat.write_max_upgrade_level(stream);
  }

  read_storage(stream: Data, gv: GameVersion): void {
    const total_storage = gv.lt(110100) ? 100 : stream.read_short();
    this.storage_items = [];
    for (let i = 0; i < total_storage; i++) this.storage_items.push(StorageItem.read_item_id(stream));
    for (const item of this.storage_items) item.read_item_type(stream);
  }

  write_storage(stream: Data, gv: GameVersion): void {
    if (gv.ge(110100)) stream.write_short(this.storage_items.length);
    for (const item of this.storage_items) item.write_item_id(stream);
    for (const item of this.storage_items) item.write_item_type(stream);
  }

  read_catguide_collected(stream: Data): void {
    const total_cats = stream.read_int();
    for (let i = 0; i < total_cats; i++) this.cats[i].read_catguide_collected(stream);
  }

  write_catguide_collected(stream: Data): void {
    stream.write_int(this.cats.length);
    for (const cat of this.cats) cat.write_catguide_collected(stream);
  }

  read_fourth_forms(stream: Data): void {
    const total_cats = stream.read_int();
    for (let i = 0; i < total_cats; i++) this.cats[i].read_fourth_form(stream);
  }

  read_catseyes_used(stream: Data): void {
    const total_cats = stream.read_int();
    for (let i = 0; i < total_cats; i++) this.cats[i].read_catseyes_used(stream);
  }

  write_catseyes_used(stream: Data): void {
    stream.write_int(this.cats.length);
    for (const cat of this.cats) cat.write_catseyes_used(stream);
  }

  write_fourth_forms(stream: Data): void {
    stream.write_int(this.cats.length);
    for (const cat of this.cats) cat.write_fourth_form(stream);
  }

  read_favorites(stream: Data): void {
    this.favourites = new Map();
    const total_cats = stream.read_int();
    for (let i = 0; i < total_cats; i++) {
      const cat_id = stream.read_int();
      this.favourites.set(cat_id, stream.read_bool());
    }
  }

  write_favorites(stream: Data): void {
    stream.write_int(this.favourites.size);
    for (const [cat_id, is_favourite] of this.favourites) {
      stream.write_int(cat_id);
      stream.write_bool(is_favourite);
    }
  }

  read_chara_new_flags(stream: Data): void {
    this.chara_new_flags = new Map();
    const total_cats = stream.read_int();
    for (let i = 0; i < total_cats; i++) {
      const cat_id = stream.read_int();
      this.chara_new_flags.set(cat_id, stream.read_int());
    }
  }

  write_chara_new_flags(stream: Data): void {
    stream.write_int(this.chara_new_flags.size);
    for (const [cat_id, new_flag] of this.chara_new_flags) {
      stream.write_int(cat_id);
      stream.write_int(new_flag);
    }
  }

  read_talents(stream: Data): void {
    const total_cats = stream.read_int();
    for (let i = 0; i < total_cats; i++) {
      const cat_id = stream.read_int();
      if (cat_id < 0 || cat_id >= this.cats.length) {
        // unknown cat: parse and discard
        const cat = Cat.init(cat_id);
        cat.read_talents(stream);
        continue;
      }
      this.cats[cat_id].read_talents(stream);
    }
  }

  write_talents(stream: Data): void {
    let total_talents = 0;
    for (const cat of this.cats) total_talents += cat.talents !== null ? 1 : 0;
    stream.write_int(total_talents);
    for (const cat of this.cats) {
      if (cat.talents === null) continue;
      stream.write_int(cat.id);
      cat.write_talents(stream);
    }
  }

  serialize(): CatsJson {
    return {
      cats: this.cats.map((c) => c.serialize()),
      storage_items: this.storage_items.map((i) => i.serialize()),
      favorites: mapToObject(this.favourites),
      chara_new_flags: mapToObject(this.chara_new_flags),
    };
  }

  static deserialize(data: Partial<CatsJson>): Cats {
    const cats = new Cats((data.cats ?? []).map((c) => Cat.deserialize(c)));
    cats.storage_items = (data.storage_items ?? []).map((i) => StorageItem.deserialize(i));
    cats.favourites = objectToMap<boolean>(data.favorites);
    cats.chara_new_flags = objectToMap<number>(data.chara_new_flags);
    return cats;
  }
}

export interface CatsJson {
  cats: CatJson[];
  storage_items: { item_id: number; item_type: number }[];
  favorites: Record<string, boolean>;
  chara_new_flags: Record<string, number>;
}
