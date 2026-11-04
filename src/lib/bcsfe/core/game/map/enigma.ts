import { Data } from "@/lib/bcsfe/core/io/data";
import type { GameVersion } from "@/lib/bcsfe/core/game_version";
import type { SaveFile } from "@/lib/bcsfe/core/io/save";
import { times } from "@/lib/bcsfe/core/utils";

export class Stage {
  level: number;
  stage_id: number;
  decoding_satus: number;
  start_time: number;

  constructor(level: number, stage_id: number, decoding_satus: number, start_time: number) {
    this.level = level;
    this.stage_id = stage_id;
    this.decoding_satus = decoding_satus;
    this.start_time = start_time;
  }

  static init(): Stage {
    return new Stage(0, 0, 0, 0.0);
  }

  static read(data: Data): Stage {
    const level = data.read_int();
    const stage_id = data.read_int();
    const decoding_satus = data.read_byte();
    const start_time = data.read_double();
    return new Stage(level, stage_id, decoding_satus, start_time);
  }

  write(data: Data): void {
    data.write_int(this.level);
    data.write_int(this.stage_id);
    data.write_byte(this.decoding_satus);
    data.write_double(this.start_time);
  }

  serialize(): Record<string, number> {
    return {
      level: this.level,
      stage_id: this.stage_id,
      decoding_satus: this.decoding_satus,
      start_time: this.start_time,
    };
  }

  static deserialize(data: Record<string, number>): Stage {
    return new Stage(
      data["level"] ?? 0,
      data["stage_id"] ?? 0,
      data["decoding_satus"] ?? 0,
      data["start_time"] ?? 0.0,
    );
  }
}

export type EnigmaExtra = [number, number, number, number];

export class Enigma {
  energy_since_1: number;
  energy_since_2: number;
  enigma_level: number;
  unknown_1: number;
  unknown_2: boolean;
  stages: Stage[];
  extra: EnigmaExtra | null;

  constructor(
    energy_since_1: number,
    energy_since_2: number,
    enigma_level: number,
    unknown_1: number,
    unknown_2: boolean,
    stages: Stage[],
    extra: EnigmaExtra | null,
  ) {
    this.energy_since_1 = energy_since_1;
    this.energy_since_2 = energy_since_2;
    this.enigma_level = enigma_level;
    this.unknown_1 = unknown_1;
    this.unknown_2 = unknown_2;
    this.stages = stages;
    this.extra = extra;
  }

  static init(): Enigma {
    return new Enigma(0, 0, 0, 0, false, [], null);
  }

  static read(data: Data, game_version: GameVersion): Enigma {
    const energy_since_1 = data.read_int();
    const energy_since_2 = data.read_int();
    const enigma_level = data.read_byte();
    const unknown_1 = data.read_byte();
    const unknown_2 = data.read_bool();
    const total_stages = data.read_byte();
    const stages = times(total_stages, () => Stage.read(data));
    let extra: EnigmaExtra | null = null;
    if (game_version.ge(140500)) {
      const has_extra = data.read_bool();
      if (has_extra) {
        const a = data.read_int();
        const b = data.read_int();
        const c = data.read_byte();
        const d = data.read_double();
        extra = [a, b, c, d];
      }
    }
    return new Enigma(energy_since_1, energy_since_2, enigma_level, unknown_1, unknown_2, stages, extra);
  }

  write(data: Data, game_version: GameVersion): void {
    data.write_int(this.energy_since_1);
    data.write_int(this.energy_since_2);
    data.write_byte(this.enigma_level);
    data.write_byte(this.unknown_1);
    data.write_bool(this.unknown_2);
    data.write_byte(this.stages.length);
    for (const stage of this.stages) stage.write(data);
    if (game_version.ge(140500)) {
      data.write_bool(this.extra !== null);
      if (this.extra !== null) {
        data.write_int(this.extra[0]);
        data.write_int(this.extra[1]);
        data.write_byte(this.extra[2]);
        data.write_double(this.extra[3]);
      }
    }
  }

  serialize(): Record<string, unknown> {
    return {
      energy_since_1: this.energy_since_1,
      energy_since_2: this.energy_since_2,
      enigma_level: this.enigma_level,
      unknown_1: this.unknown_1,
      unknown_2: this.unknown_2,
      stages: this.stages.map((s) => s.serialize()),
      extra: this.extra,
    };
  }

  static deserialize(data: Record<string, unknown>): Enigma {
    return new Enigma(
      (data["energy_since_1"] as number | undefined) ?? 0,
      (data["energy_since_2"] as number | undefined) ?? 0,
      (data["enigma_level"] as number | undefined) ?? 0,
      (data["unknown_1"] as number | undefined) ?? 0,
      (data["unknown_2"] as boolean | undefined) ?? false,
      ((data["stages"] as Record<string, number>[] | undefined) ?? []).map((s) => Stage.deserialize(s)),
      (data["extra"] as EnigmaExtra | null | undefined) ?? null,
    );
  }

  /**
   * Pure version of Python edit_enigma(). The interactive selection is replaced
   * by parameters: `enigma_ids` are indexes relative to base 25000 (as selected
   * in the Python multi-select), `wipe` clears the current stages first.
   */
  edit_enigma(save_file: SaveFile, enigma_ids: number[], wipe = false): void {
    const base_level = 25000;
    if (wipe && this.stages.length > 0) {
      for (const stage of this.stages) {
        save_file.event_stages.chapter_completion_count.set(stage.stage_id, 0);
      }
      this.stages = [];
    }
    for (const enigma_id of enigma_ids) {
      const abs_id = enigma_id + base_level;
      save_file.event_stages.chapter_completion_count.set(abs_id, 0);
      this.stages.push(new Stage(3, abs_id, 2, Math.floor(Date.now() / 1000)));
    }
  }
}
