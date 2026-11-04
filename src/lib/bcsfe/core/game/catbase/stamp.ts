import type { Data } from "@/lib/bcsfe/core/io/data";
import { filled } from "@/lib/bcsfe/core/utils";

export class StampData {
  current_stamp: number;
  collected_stamp: number[];
  unknown: number;
  daily_reward: number;

  constructor(
    current_stamp: number,
    collected_stamp: number[],
    unknown: number,
    daily_reward: number,
  ) {
    this.current_stamp = current_stamp;
    this.collected_stamp = collected_stamp;
    this.unknown = unknown;
    this.daily_reward = daily_reward;
  }

  static init(): StampData {
    return new StampData(0, filled(0, 30), 0, 0);
  }

  static read(stream: Data): StampData {
    const current_stamp = stream.read_int();
    const collected_stamp = stream.read_int_list(30);
    const unknown = stream.read_int();
    const daily_reward = stream.read_int();
    return new StampData(current_stamp, collected_stamp, unknown, daily_reward);
  }

  write(stream: Data): void {
    stream.write_int(this.current_stamp);
    stream.write_int_list(this.collected_stamp, false);
    stream.write_int(this.unknown);
    stream.write_int(this.daily_reward);
  }

  serialize(): Record<string, unknown> {
    return {
      current_stamp: this.current_stamp,
      collected_stamp: this.collected_stamp,
      unknown: this.unknown,
      daily_reward: this.daily_reward,
    };
  }

  static deserialize(data: Record<string, unknown>): StampData {
    return new StampData(
      (data["current_stamp"] as number | undefined) ?? 0,
      (data["collected_stamp"] as number[] | undefined) ?? [],
      (data["unknown"] as number | undefined) ?? 0,
      (data["daily_reward"] as number | undefined) ?? 0,
    );
  }
}
