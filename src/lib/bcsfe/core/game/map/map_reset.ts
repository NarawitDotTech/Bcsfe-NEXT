/** Port of bcsfe/core/game/map/map_reset.py */
import type { Data } from "@/lib/bcsfe/core/io/data";
import { mapToObject, objectToMap } from "@/lib/bcsfe/core/utils";

export interface MapResetDataSerialized {
  yearly_end_timestamp: number;
  monthly_end_timestamp: number;
  weekly_end_timestamp: number;
  daily_end_timestamp: number;
}

export class MapResetData {
  yearly_end_timestamp: number;
  monthly_end_timestamp: number;
  weekly_end_timestamp: number;
  daily_end_timestamp: number;

  constructor(
    yearly_end_timestamp: number,
    monthly_end_timestamp: number,
    weekly_end_timestamp: number,
    daily_end_timestamp: number,
  ) {
    this.yearly_end_timestamp = yearly_end_timestamp;
    this.monthly_end_timestamp = monthly_end_timestamp;
    this.weekly_end_timestamp = weekly_end_timestamp;
    this.daily_end_timestamp = daily_end_timestamp;
  }

  static init(): MapResetData {
    return new MapResetData(0.0, 0.0, 0.0, 0.0);
  }

  static read(stream: Data): MapResetData {
    const yearly_end_timestamp = stream.read_double();
    const monthly_end_timestamp = stream.read_double();
    const weekly_end_timestamp = stream.read_double();
    const daily_end_timestamp = stream.read_double();
    return new MapResetData(
      yearly_end_timestamp,
      monthly_end_timestamp,
      weekly_end_timestamp,
      daily_end_timestamp,
    );
  }

  write(stream: Data): void {
    stream.write_double(this.yearly_end_timestamp);
    stream.write_double(this.monthly_end_timestamp);
    stream.write_double(this.weekly_end_timestamp);
    stream.write_double(this.daily_end_timestamp);
  }

  serialize(): MapResetDataSerialized {
    return {
      yearly_end_timestamp: this.yearly_end_timestamp,
      monthly_end_timestamp: this.monthly_end_timestamp,
      weekly_end_timestamp: this.weekly_end_timestamp,
      daily_end_timestamp: this.daily_end_timestamp,
    };
  }

  static deserialize(data: Partial<MapResetDataSerialized>): MapResetData {
    return new MapResetData(
      data.yearly_end_timestamp ?? 0.0,
      data.monthly_end_timestamp ?? 0.0,
      data.weekly_end_timestamp ?? 0.0,
      data.daily_end_timestamp ?? 0.0,
    );
  }
}

export class MapResets {
  data: Map<number, MapResetData[]>;
  constructor(data: Map<number, MapResetData[]>) {
    this.data = data;
  }

  static init(): MapResets {
    return new MapResets(new Map());
  }

  static read(stream: Data): MapResets {
    const data = new Map<number, MapResetData[]>();
    const n = stream.read_int();
    for (let i = 0; i < n; i++) {
      const key = stream.read_int();
      const value: MapResetData[] = [];
      const m = stream.read_int();
      for (let j = 0; j < m; j++) value.push(MapResetData.read(stream));
      data.set(key, value);
    }
    return new MapResets(data);
  }

  write(stream: Data): void {
    stream.write_int(this.data.size);
    for (const [key, value] of this.data) {
      stream.write_int(key);
      stream.write_int(value.length);
      for (const item of value) item.write(stream);
    }
  }

  serialize(): Record<string, MapResetDataSerialized[]> {
    return mapToObject(this.data, (v) => v.map((i) => i.serialize()));
  }

  static deserialize(data: Record<string, Partial<MapResetDataSerialized>[]>): MapResets {
    return new MapResets(
      objectToMap(data, (v) => v.map((i) => MapResetData.deserialize(i))),
    );
  }
}
