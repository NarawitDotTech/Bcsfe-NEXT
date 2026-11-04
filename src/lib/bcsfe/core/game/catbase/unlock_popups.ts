/** Port of bcsfe/core/game/catbase/unlock_popups.py */
import type { Data } from "@/lib/bcsfe/core/io/data";
import type { SaveFile } from "@/lib/bcsfe/core/io/save";
import { CSV, Row } from "@/lib/bcsfe/core/io/bc_csv";
import { core_data } from "@/lib/bcsfe/core/core_data";
import { mapToObject, objectToMap } from "@/lib/bcsfe/core/utils";

export class Popup {
  constructor(public seen: boolean) {}

  static init(): Popup {
    return new Popup(false);
  }

  static read(stream: Data): Popup {
    const seen = stream.read_bool();
    return new Popup(seen);
  }

  write(stream: Data): void {
    stream.write_bool(this.seen);
  }

  serialize(): boolean {
    return this.seen;
  }

  static deserialize(data: boolean): Popup {
    return new Popup(data);
  }
}

export class UnlockPopups {
  constructor(public popups: Map<number, Popup>) {}

  static init(): UnlockPopups {
    return new UnlockPopups(new Map());
  }

  static read(stream: Data): UnlockPopups {
    const total = stream.read_int();
    const popups = new Map<number, Popup>();
    for (let i = 0; i < total; i++) {
      const key = stream.read_int();
      popups.set(key, Popup.read(stream));
    }
    return new UnlockPopups(popups);
  }

  write(stream: Data): void {
    stream.write_int(this.popups.size);
    for (const [key, popup] of this.popups) {
      stream.write_int(key);
      popup.write(stream);
    }
  }

  serialize(): Record<string, boolean> {
    return mapToObject(this.popups, (p) => p.serialize());
  }

  static deserialize(data: Record<string, boolean>): UnlockPopups {
    return new UnlockPopups(objectToMap(data, (p: boolean) => Popup.deserialize(p)));
  }
}

export class UnlockPopupLine {
  constructor(
    public popup_id: number,
    public enabled: boolean,
    public conditions: number,
    public stage: number,
    public map_conditions: number,
    public user_rank: number,
    public get_char_id1: number,
    public get_char_id2: number,
    public os_id: number,
    public unlock_eye_1_id: number,
    public add_level1: number,
    public unlock_eye_2_id: number,
    public add_level2: number,
    public unlock_plus_id: number,
    public add_level: number,
    public skill_id: number,
    public item_id: number,
    public num: number,
    public help_enabled: boolean,
  ) {}

  static from_csv_row(row: Row): UnlockPopupLine {
    return new UnlockPopupLine(
      row.next_int(),
      row.next_bool(),
      row.next_int(),
      row.next_int(),
      row.next_int(),
      row.next_int(),
      row.next_int(),
      row.next_int(),
      row.next_int(),
      row.next_int(),
      row.next_int(),
      row.next_int(),
      row.next_int(),
      row.next_int(),
      row.next_int(),
      row.next_int(),
      row.next_int(),
      row.next_int(),
      row.next_bool(),
    );
  }
}

export class UnlockPopupData {
  constructor(public popups: UnlockPopupLine[]) {}

  static from_csv(csv: CSV): UnlockPopupData {
    const popups: UnlockPopupLine[] = [];
    for (const line of csv.lines.slice(1)) {
      popups.push(UnlockPopupLine.from_csv_row(line));
    }
    return new UnlockPopupData(popups);
  }

  static from_save(save_file: SaveFile): UnlockPopupData | null {
    const gdg = core_data.get_game_data_getter(save_file);
    const data = gdg.download("DataLocal", "unlockPopup.tsv");
    if (data === null) return null;
    const csv = new CSV(data, "\t");
    return UnlockPopupData.from_csv(csv);
  }
}
