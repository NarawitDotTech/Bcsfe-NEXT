import type { Data } from "@/lib/bcsfe/core/io/data";
import { mapToObject, objectToMap } from "@/lib/bcsfe/core/utils";

export class BeaconEventListScene {
  int_array: Map<number, number>;
  str_array: Map<number, string[]>;
  bool_array: Map<number, boolean>;

  constructor(
    int_dict: Map<number, number>,
    str_dict: Map<number, string[]>,
    bool_dict: Map<number, boolean>,
  ) {
    this.int_array = int_dict;
    this.str_array = str_dict;
    this.bool_array = bool_dict;
  }

  static init(): BeaconEventListScene {
    return new BeaconEventListScene(new Map(), new Map(), new Map());
  }

  static read(stream: Data): BeaconEventListScene {
    const int_dict = new Map<number, number>();
    const str_dict = new Map<number, string[]>();
    const bool_dict = new Map<number, boolean>();
    let n = stream.read_int();
    for (let i = 0; i < n; i++) {
      const k = stream.read_int();
      int_dict.set(k, stream.read_int());
    }
    n = stream.read_int();
    for (let i = 0; i < n; i++) {
      const k = stream.read_int();
      str_dict.set(k, stream.read_string_list());
    }
    n = stream.read_int();
    for (let i = 0; i < n; i++) {
      const k = stream.read_int();
      bool_dict.set(k, stream.read_bool());
    }
    return new BeaconEventListScene(int_dict, str_dict, bool_dict);
  }

  write(stream: Data): void {
    stream.write_int(this.int_array.size);
    for (const [key, value] of this.int_array) {
      stream.write_int(key);
      stream.write_int(value);
    }
    stream.write_int(this.str_array.size);
    for (const [key, value] of this.str_array) {
      stream.write_int(key);
      stream.write_string_list(value);
    }
    stream.write_int(this.bool_array.size);
    for (const [key, value] of this.bool_array) {
      stream.write_int(key);
      stream.write_bool(value);
    }
  }

  serialize(): Record<string, unknown> {
    return {
      int_array: mapToObject(this.int_array),
      str_array: mapToObject(this.str_array),
      bool_array: mapToObject(this.bool_array),
    };
  }

  static deserialize(data: Record<string, unknown>): BeaconEventListScene {
    return new BeaconEventListScene(
      objectToMap(data["int_array"] as Record<string, number> | undefined),
      objectToMap(data["str_array"] as Record<string, string[]> | undefined),
      objectToMap(data["bool_array"] as Record<string, boolean> | undefined),
    );
  }
}
