import type { Data } from "@/lib/bcsfe/core/io/data";
import type { GameVersion } from "@/lib/bcsfe/core/game_version";
import type { SaveFile } from "@/lib/bcsfe/core/io/save";
import { core_data } from "@/lib/bcsfe/core/core_data";
import { CSV, Delimeter } from "@/lib/bcsfe/core/io/bc_csv";
import { mapToObject, objectToMap } from "@/lib/bcsfe/core/utils";

export class Mission {
  clear_state: number | null;
  requirement: number | null;
  progress_type: number | null;
  gamatoto_value: number | null;
  nyancombo_value: number | null;
  user_rank_value: number | null;
  expiry_value: number | null;
  preparing_value: number | boolean | null;

  constructor(
    clear_state: number | null = null,
    requirement: number | null = null,
    progress_type: number | null = null,
    gamatoto_value: number | null = null,
    nyancombo_value: number | null = null,
    user_rank_value: number | null = null,
    expiry_value: number | null = null,
    preparing_value: number | boolean | null = null,
  ) {
    this.clear_state = clear_state;
    this.requirement = requirement;
    this.progress_type = progress_type;
    this.gamatoto_value = gamatoto_value;
    this.nyancombo_value = nyancombo_value;
    this.user_rank_value = user_rank_value;
    this.expiry_value = expiry_value;
    this.preparing_value = preparing_value;
  }

  static init(): Mission {
    return new Mission(null, null, null, null, null, null, null, null);
  }

  serialize(): Record<string, unknown> {
    return {
      clear_state: this.clear_state,
      requirement: this.requirement,
      progress_type: this.progress_type,
      gamatoto_value: this.gamatoto_value,
      nyancombo_value: this.nyancombo_value,
      user_rank_value: this.user_rank_value,
      expiry_value: this.expiry_value,
      preparing_value: this.preparing_value,
    };
  }

  static deserialize(data: Record<string, unknown>): Mission {
    return new Mission(
      data["clear_state"] as number | null,
      data["requirement"] as number | null,
      data["progress_type"] as number | null,
      data["gamatoto_value"] as number | null,
      data["nyancombo_value"] as number | null,
      data["user_rank_value"] as number | null,
      data["expiry_value"] as number | null,
      data["preparing_value"] as number | boolean | null,
    );
  }
}

export class Missions {
  clear_states: Map<number, number>;
  requirements: Map<number, number>;
  progress_types: Map<number, number>;
  gamatoto_values: Map<number, number>;
  nyancombo_values: Map<number, number>;
  user_rank_values: Map<number, number>;
  expiry_values: Map<number, number>;
  preparing_values: Map<number, number | boolean>;
  weekly_missions: Map<number, boolean>;

  constructor(
    clear_states: Map<number, number>,
    requirements: Map<number, number>,
    progress_types: Map<number, number>,
    gamatoto_values: Map<number, number>,
    nyancombo_values: Map<number, number>,
    user_rank_values: Map<number, number>,
    expiry_values: Map<number, number>,
    preparing_values: Map<number, number | boolean>,
  ) {
    this.clear_states = clear_states;
    this.requirements = requirements;
    this.progress_types = progress_types;
    this.gamatoto_values = gamatoto_values;
    this.nyancombo_values = nyancombo_values;
    this.user_rank_values = user_rank_values;
    this.expiry_values = expiry_values;
    this.preparing_values = preparing_values;
    this.weekly_missions = new Map();
  }

  static init(): Missions {
    return new Missions(
      new Map(),
      new Map(),
      new Map(),
      new Map(),
      new Map(),
      new Map(),
      new Map(),
      new Map(),
    );
  }

  static read(stream: Data, gv: GameVersion): Missions {
    const clear_states = stream.read_int_int_dict();
    const requirements = stream.read_int_int_dict();
    const progress_types = stream.read_int_int_dict();
    const gamatoto_values = stream.read_int_int_dict();
    const nyancombo_values = stream.read_int_int_dict();
    const user_rank_values = stream.read_int_int_dict();
    const expiry_values = stream.read_int_int_dict();
    const preparing_values = new Map<number, number | boolean>();

    const total = stream.read_int();
    for (let i = 0; i < total; i++) {
      const key = stream.read_int();
      if (gv.lt(90300)) preparing_values.set(key, stream.read_bool());
      else preparing_values.set(key, stream.read_int());
    }

    return new Missions(
      clear_states,
      requirements,
      progress_types,
      gamatoto_values,
      nyancombo_values,
      user_rank_values,
      expiry_values,
      preparing_values,
    );
  }

  write(stream: Data, gv: GameVersion): void {
    stream.write_int_int_dict(this.clear_states);
    stream.write_int_int_dict(this.requirements);
    stream.write_int_int_dict(this.progress_types);
    stream.write_int_int_dict(this.gamatoto_values);
    stream.write_int_int_dict(this.nyancombo_values);
    stream.write_int_int_dict(this.user_rank_values);
    stream.write_int_int_dict(this.expiry_values);

    stream.write_int(this.preparing_values.size);
    for (const [key, value] of this.preparing_values) {
      stream.write_int(key);
      if (gv.lt(90300)) stream.write_bool(Boolean(value));
      else stream.write_int(Number(value));
    }
  }

  read_weekly_missions(stream: Data): void {
    this.weekly_missions = new Map();
    const total = stream.read_int();
    for (let i = 0; i < total; i++) {
      const key = stream.read_int();
      this.weekly_missions.set(key, stream.read_bool());
    }
  }

  write_weekly_missions(stream: Data): void {
    stream.write_int(this.weekly_missions.size);
    for (const [key, value] of this.weekly_missions) {
      stream.write_int(key);
      stream.write_bool(value);
    }
  }

  serialize(): Record<string, unknown> {
    return {
      clear_states: mapToObject(this.clear_states),
      requirements: mapToObject(this.requirements),
      progress_types: mapToObject(this.progress_types),
      gamatoto_values: mapToObject(this.gamatoto_values),
      nyancombo_values: mapToObject(this.nyancombo_values),
      user_rank_values: mapToObject(this.user_rank_values),
      expiry_values: mapToObject(this.expiry_values),
      preparing_values: mapToObject(this.preparing_values),
      weekly_missions: mapToObject(this.weekly_missions),
    };
  }

  static deserialize(data: Record<string, unknown>): Missions {
    const m = (k: string) => objectToMap(data[k] as Record<string, number> | undefined);
    const missions = new Missions(
      m("clear_states"),
      m("requirements"),
      m("progress_types"),
      m("gamatoto_values"),
      m("nyancombo_values"),
      m("user_rank_values"),
      m("expiry_values"),
      objectToMap(data["preparing_values"] as Record<string, number | boolean> | undefined),
    );
    missions.weekly_missions = objectToMap(
      data["weekly_missions"] as Record<string, boolean> | undefined,
    );
    return missions;
  }

  /**
   * Pure replacement for the first (display) half of Python `edit_missions`:
   * returns the selectable mission names and their ids (parallel arrays), or null.
   */
  static get_mission_options(
    save_file: SaveFile,
  ): { options: string[]; mission_ids: number[] } | null {
    const missions = save_file.missions;
    const names = core_data.get_mission_names(save_file);
    const conditions = core_data.get_mission_conditions(save_file);
    if (names.names === null || conditions.conditions === null) return null;
    const options: string[] = [];
    const mission_ids: number[] = [];
    for (const [mission_id, name0] of names.names) {
      if (missions.clear_states.has(mission_id)) {
        let name = name0.split("<br>")[0];
        const condition = conditions.conditions.get(mission_id);
        if (!condition) continue;
        name = name.split("%d").join(String(condition.progress_count));
        if (name.includes("%@") && condition.conditions_value.length > 2) {
          name = name.split("%@").join(String(condition.conditions_value[2]));
        }
        options.push(name);
        mission_ids.push(mission_id);
      }
    }
    return { options, mission_ids };
  }

  /**
   * Pure replacement for the interactive Python `edit_missions`.
   * `re_claim`: 0 = complete (reward), 1 = complete (claimed), 2 = uncomplete.
   * `choices`: selected indexes into `get_mission_options(save_file).options`.
   */
  static edit_missions(save_file: SaveFile, choices: number[], re_claim: number): void {
    const missions = save_file.missions;
    const conditions = core_data.get_mission_conditions(save_file);
    const opts = Missions.get_mission_options(save_file);
    if (opts === null) return;
    for (const choice of choices) {
      const mission_id = opts.mission_ids[choice];
      if (re_claim === 0) {
        missions.clear_states.set(mission_id, 2);
        const condition = conditions.get_condition(mission_id);
        if (condition !== null) missions.requirements.set(mission_id, condition.progress_count);
      } else if (re_claim === 1) {
        missions.clear_states.set(mission_id, 4);
        const condition = conditions.get_condition(mission_id);
        if (condition !== null) missions.requirements.set(mission_id, condition.progress_count);
      } else if (re_claim === 2) {
        missions.clear_states.set(mission_id, 0);
        if (missions.requirements.has(mission_id)) missions.requirements.set(mission_id, 0);
      }
    }
  }
}

export class MissionCondition {
  mission_id: number;
  mission_type: number;
  conditions_type: number;
  progress_count: number;
  conditions_value: number[];

  constructor(
    mission_id: number,
    mission_type: number,
    conditions_type: number,
    progress_count: number,
    conditions_value: number[],
  ) {
    this.mission_id = mission_id;
    this.mission_type = mission_type;
    this.conditions_type = conditions_type;
    this.progress_count = progress_count;
    this.conditions_value = conditions_value;
  }
}

export class MissionConditions {
  save: SaveFile;
  conditions: Map<number, MissionCondition> | null;

  constructor(save: SaveFile) {
    this.save = save;
    this.conditions = this.get_conditions();
  }

  get_conditions(): Map<number, MissionCondition> | null {
    const file_name = "Mission_Condition.csv";
    const gdg = core_data.get_game_data_getter(this.save);
    const file = gdg.download("DataLocal", file_name);
    if (file === null) return null;
    const csv = new CSV(file);
    const conditions = new Map<number, MissionCondition>();
    for (const row of csv.lines) {
      const rest: number[] = [];
      for (let i = 4; i < row.length; i++) rest.push(row.get(i).to_int());
      conditions.set(
        row.get(0).to_int(),
        new MissionCondition(
          row.get(0).to_int(),
          row.get(1).to_int(),
          row.get(2).to_int(),
          row.get(3).to_int(),
          rest,
        ),
      );
    }
    return conditions;
  }

  get_condition(mission_id: number): MissionCondition | null {
    if (this.conditions === null) return null;
    return this.conditions.get(mission_id) ?? null;
  }
}

export class MissionNames {
  save: SaveFile;
  names: Map<number, string> | null;

  constructor(save: SaveFile) {
    this.save = save;
    this.names = this.get_names();
  }

  get_names(): Map<number, string> | null {
    const file_name = "Mission_Name.csv";
    const gdg = core_data.get_game_data_getter(this.save);
    const file = gdg.download("resLocal", file_name);
    if (file === null) return null;
    const csv = new CSV(file, Delimeter.from_country_code_res(this.save.cc));
    const names = new Map<number, string>();
    for (const row of csv.lines) names.set(row.get(0).to_int(), row.get(1).to_str());
    return names;
  }
}
