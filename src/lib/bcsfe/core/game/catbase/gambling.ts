import type { Data } from "@/lib/bcsfe/core/io/data";
import type { GameVersion } from "@/lib/bcsfe/core/game_version";
import type { SaveFile } from "@/lib/bcsfe/core/io/save";
import { mapToObject, objectToMap } from "@/lib/bcsfe/core/utils";

export class GamblingEvent {
  completed: Map<number, boolean>;
  values: Map<number, Map<number, number>>;
  start_times: Map<number, number>;

  constructor(
    completed: Map<number, boolean>,
    values: Map<number, Map<number, number>>,
    start_times: Map<number, number>,
  ) {
    this.completed = completed;
    this.values = values;
    this.start_times = start_times;
  }

  static init(): GamblingEvent {
    return new GamblingEvent(new Map(), new Map(), new Map());
  }

  static read(data: Data, game_version: GameVersion): GamblingEvent {
    let total = data.read_short();
    const completed = new Map<number, boolean>();
    for (let i = 0; i < total; i++) {
      const key = data.read_short();
      completed.set(key, data.read_bool());
    }

    total = data.read_short();
    const values = new Map<number, Map<number, number>>();
    for (let i = 0; i < total; i++) {
      const key = data.read_short();
      let inner = values.get(key);
      if (inner === undefined) {
        inner = new Map();
        values.set(key, inner);
      }
      const total2 = data.read_short();
      for (let j = 0; j < total2; j++) {
        const key2 = data.read_short();
        inner.set(key2, data.read_short());
      }
    }

    total = data.read_short();
    const start_times = new Map<number, number>();
    for (let i = 0; i < total; i++) {
      const key = data.read_short();
      const value = game_version.lt(90100) ? data.read_double() : data.read_int();
      start_times.set(key, value);
    }

    return new GamblingEvent(completed, values, start_times);
  }

  write(data: Data, game_version: GameVersion): void {
    data.write_short(this.completed.size);
    data.write_short_bool_dict(this.completed, false);

    data.write_short(this.values.size);
    for (const [key, value] of this.values) {
      data.write_short(key);
      data.write_short(value.size);
      for (const [key2, value2] of value) {
        data.write_short(key2);
        data.write_short(value2);
      }
    }

    data.write_short(this.start_times.size);
    for (const [key, value] of this.start_times) {
      data.write_short(key);
      if (game_version.lt(90100)) data.write_double(value);
      else data.write_int(Math.trunc(value));
    }
  }

  serialize(): Record<string, unknown> {
    return {
      completed: mapToObject(this.completed),
      values: mapToObject(this.values, (m) => mapToObject(m)),
      start_times: mapToObject(this.start_times),
    };
  }

  static deserialize(data: Record<string, unknown>): GamblingEvent {
    return new GamblingEvent(
      objectToMap(data["completed"] as Record<string, boolean> | undefined),
      objectToMap(
        data["values"] as Record<string, Record<string, number>> | undefined,
        (v) => objectToMap(v),
      ),
      objectToMap(data["start_times"] as Record<string, number> | undefined),
    );
  }

  reset(): void {
    this.completed = new Map();
    this.values = new Map();
    // TODO: check start times
    this.start_times = new Map();
  }

  /** Python printed "reset_wildcat_slots"/"reset_cat_scratcher" messages; printing dropped. */
  static reset_events(save_file: SaveFile): void {
    save_file.wildcat_slots.reset();
    save_file.cat_scratcher.reset();
  }
}
