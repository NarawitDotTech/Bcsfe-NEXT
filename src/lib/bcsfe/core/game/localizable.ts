/** Port of bcsfe/core/game/localizable.py */
import type { SaveFile } from "@/lib/bcsfe/core/io/save";
import { core_data } from "@/lib/bcsfe/core/core_data";
import { CSV } from "@/lib/bcsfe/core/io/bc_csv";

export class Localizable {
  save_file: SaveFile;
  localizable: Record<string, string> | null;

  constructor(save_file: SaveFile) {
    this.save_file = save_file;
    this.localizable = this.get_localizable();
  }

  get_localizable(): Record<string, string> | null {
    const gdg = core_data.get_game_data_getter(this.save_file);
    const data = gdg.download("resLocal", "localizable.tsv");
    if (data === null) return null;
    const csv = new CSV(data, "\t");
    const keys: Record<string, string> = Object.create(null);
    for (const line of csv) {
      if (line.length < 2) continue; // Python: IndexError -> skipped (row[] there returns empty cell, so keep only full rows)
      keys[line.get(0).to_str()] = line.get(1).to_str();
    }
    return keys;
  }

  get(key: string): string | null {
    if (this.localizable === null) return null;
    return this.localizable[key] ?? null;
  }

  get_lang(): string | null {
    return this.get("lang");
  }
}
