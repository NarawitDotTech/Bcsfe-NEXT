import type { Data } from "@/lib/bcsfe/core/io/data";
import { mapToObject, objectToMap } from "@/lib/bcsfe/core/utils";

export class MySale {
  dict_1: Map<number, number>;
  dict_2: Map<number, boolean>;

  constructor(dict_1: Map<number, number>, dict_2: Map<number, boolean>) {
    this.dict_1 = dict_1;
    this.dict_2 = dict_2;
  }

  static init(): MySale {
    return new MySale(new Map(), new Map());
  }

  static read_bonus_hash(stream: Data): MySale {
    let variable_length = stream.read_variable_length_int();
    const dict_1 = new Map<number, number>();
    for (let i = 0; i < variable_length; i++) {
      const key = stream.read_variable_length_int();
      const value = stream.read_variable_length_int();
      dict_1.set(key, value);
    }

    variable_length = stream.read_variable_length_int();
    const dict_2 = new Map<number, boolean>();
    for (let i = 0; i < variable_length; i++) {
      const key = stream.read_variable_length_int();
      const value = stream.read_bool();
      dict_2.set(key, value);
    }
    return new MySale(dict_1, dict_2);
  }

  write_bonus_hash(stream: Data): void {
    stream.write_variable_length_int(this.dict_1.size);
    for (const [key, value] of this.dict_1) {
      stream.write_variable_length_int(key);
      stream.write_variable_length_int(value);
    }
    stream.write_variable_length_int(this.dict_2.size);
    for (const [key, value] of this.dict_2) {
      stream.write_variable_length_int(key);
      stream.write_byte(value ? 1 : 0);
    }
  }

  serialize(): Record<string, unknown> {
    return {
      dict_1: mapToObject(this.dict_1),
      dict_2: mapToObject(this.dict_2),
    };
  }

  static deserialize(data: Record<string, unknown>): MySale {
    return new MySale(
      objectToMap(data["dict_1"] as Record<string, number> | undefined),
      objectToMap(data["dict_2"] as Record<string, boolean> | undefined),
    );
  }
}
