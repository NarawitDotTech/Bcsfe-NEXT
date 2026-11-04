import type { SaveFile } from "@/lib/bcsfe/core/io/save";
import { core_data } from "@/lib/bcsfe/core/core_data";
import { CSV } from "@/lib/bcsfe/core/io/bc_csv";

export interface Drop {
  stage_id: number;
  save_id: number;
  chara_id: number;
}

export class CharaDrop {
  save_file: SaveFile;
  drops: Drop[] | null;

  constructor(save_file: SaveFile) {
    this.save_file = save_file;
    this.drops = this.get_drops();
  }

  get_drops(): Drop[] | null {
    const gdg = core_data.get_game_data_getter(this.save_file);
    const data = gdg.download("DataLocal", "drop_chara.csv");
    if (data === null) return null;
    const csv = new CSV(data);
    const drops: Drop[] = [];
    for (const line of csv.lines.slice(1)) {
      drops.push({
        stage_id: line.get(0).to_int(),
        save_id: line.get(1).to_int(),
        chara_id: line.get(2).to_int(),
      });
    }
    return drops;
  }

  get_drop(stage_id: number): Drop | null {
    if (this.drops === null) return null;
    for (const drop of this.drops) {
      if (drop.stage_id === stage_id) return drop;
    }
    return null;
  }

  get_drops_from_chara_id(chara_id: number): Drop[] | null {
    if (this.drops === null) return null;
    return this.drops.filter((d) => d.chara_id === chara_id);
  }

  private set_unit_drop(save_id: number, value: number): void {
    const arr = this.save_file.unit_drops;
    const len = arr.length;
    if (save_id >= len || save_id < -len) return; // IndexError
    arr[save_id < 0 ? save_id + len : save_id] = value;
  }

  unlock_drops_from_cat_id(cat_id: number): void {
    const drops = this.get_drops_from_chara_id(cat_id);
    if (drops === null) return;
    for (const drop of drops) this.set_unit_drop(drop.save_id, 1);
  }

  remove_drops_from_cat_id(cat_id: number): void {
    const drops = this.get_drops_from_chara_id(cat_id);
    if (drops === null) return;
    for (const drop of drops) this.set_unit_drop(drop.save_id, 0);
  }
}
