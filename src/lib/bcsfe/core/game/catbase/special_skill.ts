/** Port of bcsfe/core/game/catbase/special_skill.py */
import type { Data } from "@/lib/bcsfe/core/io/data";
import type { SaveFile } from "@/lib/bcsfe/core/io/save";
import { CSV } from "@/lib/bcsfe/core/io/bc_csv";
import { core_data } from "@/lib/bcsfe/core/core_data";
import { Upgrade } from "@/lib/bcsfe/core/game/catbase/upgrade";
import { times } from "@/lib/bcsfe/core/utils";

export interface SpecialSkillJson {
  upgrade: { plus: number; base: number };
  seen: number;
  max_upgrade_level: { plus: number; base: number };
}

export class SpecialSkill {
  seen = 0;
  max_upgrade_level: Upgrade = new Upgrade(0, 0);

  constructor(public upgrade: Upgrade) {}

  static init(): SpecialSkill {
    return new SpecialSkill(new Upgrade(0, 0));
  }

  static read_upgrade(stream: Data): SpecialSkill {
    return new SpecialSkill(Upgrade.read(stream));
  }

  write_upgrade(stream: Data): void {
    this.upgrade.write(stream);
  }

  read_seen(stream: Data): void {
    this.seen = stream.read_int();
  }

  write_seen(stream: Data): void {
    stream.write_int(this.seen);
  }

  read_max_upgrade_level(stream: Data): void {
    this.max_upgrade_level = Upgrade.read(stream);
  }

  write_max_upgrade_level(stream: Data): void {
    this.max_upgrade_level.write(stream);
  }

  serialize(): SpecialSkillJson {
    return {
      upgrade: this.upgrade.serialize(),
      seen: this.seen,
      max_upgrade_level: this.max_upgrade_level.serialize(),
    };
  }

  static deserialize(data: Partial<SpecialSkillJson>): SpecialSkill {
    const skill = new SpecialSkill(Upgrade.deserialize(data.upgrade ?? {}));
    skill.seen = data.seen ?? 0;
    skill.max_upgrade_level = Upgrade.deserialize(data.max_upgrade_level ?? {});
    return skill;
  }

  set_upgrade(
    upgrade: Upgrade,
    only_plus = false,
    max_base: number | null = null,
    max_plus: number | null = null,
  ): void {
    if (max_base !== null) upgrade.base = Math.min(upgrade.base, max_base);
    if (max_plus !== null) upgrade.plus = Math.min(upgrade.plus, max_plus);

    const base = upgrade.base;
    const plus = upgrade.plus;

    if (base !== -1 && !only_plus) this.upgrade.base = upgrade.get_random_base(max_base);
    if (plus !== -1) this.upgrade.plus = upgrade.get_random_plus(max_plus);
  }
}

export class SpecialSkills {
  constructor(public skills: SpecialSkill[]) {}

  get_upgrade(valid_skill_id: number): SpecialSkill {
    if (valid_skill_id >= 1) valid_skill_id += 1;
    return this.skills[valid_skill_id];
  }

  set_upgrade(
    valid_skill_id: number,
    upgrade: Upgrade,
    max_base: number | null = null,
    max_plus: number | null = null,
  ): void {
    const u = upgrade.copy();
    const valid_skills = this.get_valid_skills();
    valid_skills[valid_skill_id].set_upgrade(u, false, max_base, max_plus);

    // if it is a cat cannon power upgrade, mirror the upgrade to the hidden
    // cat cannon power special skill
    if (valid_skill_id === 0) {
      this.skills[1].set_upgrade(u, false, max_base, max_plus);
    }
  }

  static init(): SpecialSkills {
    return new SpecialSkills(times(11, () => SpecialSkill.init()));
  }

  get_valid_skills(): SpecialSkill[] {
    return this.skills.filter((_, i) => i !== 1);
  }

  static read_upgrades(stream: Data): SpecialSkills {
    const skills: SpecialSkill[] = [];
    for (let i = 0; i < 11; i++) skills.push(SpecialSkill.read_upgrade(stream));
    return new SpecialSkills(skills);
  }

  write_upgrades(stream: Data): void {
    for (const skill of this.skills) skill.write_upgrade(stream);
  }

  read_gatya_seen(stream: Data): void {
    for (const skill of this.get_valid_skills()) skill.read_seen(stream);
  }

  write_gatya_seen(stream: Data): void {
    for (const skill of this.get_valid_skills()) skill.write_seen(stream);
  }

  read_max_upgrade_levels(stream: Data): void {
    for (const skill of this.skills) skill.read_max_upgrade_level(stream);
  }

  write_max_upgrade_levels(stream: Data): void {
    for (const skill of this.skills) skill.write_max_upgrade_level(stream);
  }

  serialize(): SpecialSkillJson[] {
    return this.skills.map((s) => s.serialize());
  }

  static deserialize(data: Partial<SpecialSkillJson>[]): SpecialSkills {
    const skills = new SpecialSkills([]);
    for (const skill of data) skills.skills.push(SpecialSkill.deserialize(skill));
    return skills;
  }

  /**
   * Non-interactive replacement for Python `edit_ind` (per-skill prompt):
   * apply a user supplied Upgrade to a single valid skill id, using the
   * per-skill maxima from AbilityData. Returns false if ability data is missing.
   */
  edit_ind(id: number, upgrade: Upgrade, save_file: SaveFile): boolean {
    const ability_data = core_data.get_ability_data(save_file);
    if (ability_data.ability_data === null) return false;
    const ability = ability_data.get_ability_data_item(id);
    if (ability === null) return false;
    this.set_upgrade(id, upgrade);
    return true;
  }

  /**
   * Non-interactive replacement for Python `edit_many`: apply the same
   * Upgrade to all given valid skill ids (clamped to each ability's max
   * unless `disable_maxes`). Use `get_max_levels` to compute the prompt maxima.
   */
  edit_many(
    ids: number[],
    save_file: SaveFile,
    upgrade: Upgrade,
    disable_maxes = false,
  ): void {
    const ability_data = core_data.get_ability_data(save_file);
    if (ability_data.ability_data === null) return;
    for (const id of ids) {
      let max_base_level: number | null = ability_data.ability_data[id].max_base_level - 1;
      let max_plus_level: number | null = ability_data.ability_data[id].max_plus_level;
      if (disable_maxes) {
        max_base_level = null;
        max_plus_level = null;
      }
      this.set_upgrade(id, upgrade.copy(), max_base_level, max_plus_level);
    }
  }

  /** [max_base_level, max_plus_level] over all abilities (used as input maxima for edit_many) */
  static get_max_levels(save_file: SaveFile): [number, number] | null {
    const ability_data = core_data.get_ability_data(save_file);
    if (ability_data.ability_data === null) return null;
    return [
      Math.max(...ability_data.ability_data.map((a) => a.max_base_level)),
      Math.max(...ability_data.ability_data.map((a) => a.max_plus_level)),
    ];
  }

  get_from_id(id: number, only_valid = true): SpecialSkill | null {
    const skills = only_valid ? this.get_valid_skills() : this.skills;
    if (id >= skills.length || id < 0) return null;
    return skills[id];
  }
}

export class AbilityDataItem {
  constructor(
    public index: number,
    public sell_price: number,
    public gatya_rarity: number,
    public max_base_level: number,
    public max_plus_level: number,
    public chapter_1_to_2_max_level: number,
  ) {}
}

export class AbilityData {
  ability_data: AbilityDataItem[] | null;

  constructor(public save_file: SaveFile) {
    this.ability_data = this.get_ability_data();
  }

  get_ability_data(): AbilityDataItem[] | null {
    const gdg = core_data.get_game_data_getter(this.save_file);
    const data = gdg.download("DataLocal", "AbilityData.csv");
    if (data === null) return null;
    const csv = new CSV(data);
    const ability_data: AbilityDataItem[] = [];
    let i = 0;
    for (const row of csv) {
      ability_data.push(
        new AbilityDataItem(
          i,
          row.get(0).to_int(),
          row.get(1).to_int(),
          row.get(2).to_int(),
          row.get(3).to_int(),
          row.get(4).to_int(),
        ),
      );
      i++;
    }
    return ability_data;
  }

  get_ability_data_item(item_id: number): AbilityDataItem | null {
    if (this.ability_data === null) return null;
    // Python raises IndexError here for out of range ids; negative ids wrap in Python.
    return this.ability_data[item_id < 0 ? this.ability_data.length + item_id : item_id] ?? null;
  }
}
