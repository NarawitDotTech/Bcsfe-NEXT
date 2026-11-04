import type { SaveFile } from "@/lib/bcsfe/core/io/save";
import { core_data } from "@/lib/bcsfe/core/core_data";
import { CSV, Delimeter } from "@/lib/bcsfe/core/io/bc_csv";
import { range } from "@/lib/bcsfe/core/utils";

export class Enemy {
  id: number;
  constructor(id: number) {
    this.id = id;
  }

  unlock_enemy_guide(save_file: SaveFile): void {
    save_file.enemy_guide[this.id] = 1;
  }

  reset_enemy_guide(save_file: SaveFile): void {
    save_file.enemy_guide[this.id] = 0;
  }

  get_name(save_file: SaveFile): string | null {
    return core_data.get_enemy_names(save_file).get_name(this.id);
  }
}

export class EnemyDictionaryItem {
  enemy_id: number;
  scale: number;
  first_seen: number | null;
  constructor(enemy_id: number, scale: number, first_seen: number | null) {
    this.enemy_id = enemy_id;
    this.scale = scale;
    this.first_seen = first_seen;
  }
}

export class EnemyDictionary {
  save_file: SaveFile;
  dictionary: EnemyDictionaryItem[] | null;

  constructor(save_file: SaveFile) {
    this.save_file = save_file;
    this.dictionary = this.__get_dictionary();
  }

  private __get_dictionary(): EnemyDictionaryItem[] | null {
    const gdg = core_data.get_game_data_getter(this.save_file);
    const csv_data = gdg.download("DataLocal", "enemy_dictionary_list.csv");
    if (csv_data === null || csv_data === undefined) return null;

    const csv = new CSV(csv_data);
    const data: EnemyDictionaryItem[] = [];
    for (const row of csv) {
      let first_seen: number | null = null;
      if (row.length >= 3) first_seen = row.get(2).to_int();
      data.push(new EnemyDictionaryItem(row.get(0).to_int(), row.get(1).to_int(), first_seen));
    }
    return data;
  }

  get_valid_enemies(): number[] | null {
    if (this.dictionary === null) return null;
    return this.dictionary.map((e) => e.enemy_id);
  }

  get_invalid_enemies(total_enemies: number): number[] | null {
    const valid = this.get_valid_enemies();
    if (valid === null) return null;
    const set = new Set(valid);
    return range(total_enemies).filter((i) => !set.has(i));
  }
}

export class EnemyDescription {
  trait_str: string;
  description: string[] | null;
  constructor(trait_str: string, description: string[] | null) {
    this.trait_str = trait_str;
    this.description = description;
  }
}

export class EnemyDescriptions {
  save_file: SaveFile;
  descriptions: EnemyDescription[] | null;

  constructor(save_file: SaveFile) {
    this.save_file = save_file;
    this.descriptions = this.__get_descriptions();
  }

  private __get_descriptions(): EnemyDescription[] | null {
    const gdg = core_data.get_game_data_getter(this.save_file);
    const data = gdg.download("resLocal", `EnemyPictureBook_${core_data.get_lang(this.save_file)}.csv`);
    if (data === null || data === undefined) return null;

    const csv = new CSV(data, Delimeter.from_country_code_res(this.save_file.cc));
    const descriptions: EnemyDescription[] = [];
    for (const row of csv) {
      if (row.length === 1) {
        descriptions.push(new EnemyDescription(row.get(0).to_str(), null));
      } else {
        descriptions.push(new EnemyDescription(row.get(0).to_str(), row.slice(1).to_str_list()));
      }
    }
    return descriptions;
  }
}

export class EnemyNames {
  save_file: SaveFile;
  names: string[] | null;

  constructor(save_file: SaveFile) {
    this.save_file = save_file;
    this.names = this.get_names();
  }

  get_names(): string[] | null {
    const gdg = core_data.get_game_data_getter(this.save_file);
    const data = gdg.download("resLocal", "Enemyname.tsv");
    if (data === null || data === undefined) return null;
    const csv = new CSV(data, "\t", false, true, false);
    const names: string[] = [];
    for (const row of csv) names.push(row.get(0).to_str());
    return names;
  }

  get_name(id: number): string | null {
    if (this.names === null) return null;
    // Python indexing: IndexError for out of range (negative ids index from the end)
    const idx = id < 0 ? this.names.length + id : id;
    if (idx < 0 || idx >= this.names.length) {
      return core_data.local_manager.get_key("enemy_unknown_name", { id });
    }
    const name = this.names[idx];
    if (!name) return core_data.local_manager.get_key("enemy_not_in_name_list", { id });
    return name;
  }
}
