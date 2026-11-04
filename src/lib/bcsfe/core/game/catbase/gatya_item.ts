import type { SaveFile } from "@/lib/bcsfe/core/io/save";
import { core_data } from "@/lib/bcsfe/core/core_data";
import { CSV, Delimeter } from "@/lib/bcsfe/core/io/bc_csv";

export class GatyaItemNames {
  save_file: SaveFile;
  names: string[] | null;

  constructor(save_file: SaveFile) {
    this.save_file = save_file;
    this.names = this.__get_names();
  }

  private __get_names(): string[] | null {
    const gdg = core_data.get_game_data_getter(this.save_file);
    const data = gdg.download("resLocal", "GatyaitemName.csv");
    if (data === null) return null;
    const csv = new CSV(data, Delimeter.from_country_code_res(this.save_file.cc));
    const names: string[] = [];
    for (const line of csv.lines) names.push(line.get(0).to_str());
    return names;
  }

  get_name(index: number): string | null {
    if (this.names === null) return null;
    // Python negative indexing
    const i = index < 0 ? index + this.names.length : index;
    if (i >= 0 && i < this.names.length) return this.names[i];
    return core_data.local_manager.get_key("gatya_item_unknown_name", { index });
  }
}

export class GatyaItemBuyItem {
  constructor(
    public id: number,
    public rarity: number,
    public reflect_or_storage: boolean,
    public price: number,
    public stage_drop_id: number,
    public quantity: number,
    public server_id: number,
    public category: number,
    public index: number,
    public src_item_id: number,
    public main_menu_type: number,
    public gatya_ticket_id: number,
    public comment: string,
  ) {}
}

export enum GatyaItemCategory {
  MISC = 0,
  EVENT_TICKETS = 1,
  SPECIAL_SKILLS = 2,
  BATTLE_ITEMS = 3,
  EVOLVE_ITEMS = 4,
  CATSEYES = 5,
  CATAMINS = 6,
  BASE_MATERIALS = 7,
  LUCKY_TICKETS_1 = 8,
  ENDLESS_ITEMS = 9,
  LUCKY_TICKETS_2 = 10,
  LABYRINTH_MEDALS = 11,
  TREASURE_CHESTS = 12,
}

export class GatyaItemBuy {
  save_file: SaveFile;
  buy: GatyaItemBuyItem[] | null;

  constructor(save_file: SaveFile) {
    this.save_file = save_file;
    this.buy = this.get_buy();
  }

  get_buy(): GatyaItemBuyItem[] | null {
    const gdg = core_data.get_game_data_getter(this.save_file);
    const data = gdg.download("DataLocal", "Gatyaitembuy.csv");
    if (data === null) return null;
    const csv = new CSV(data);
    const buy: GatyaItemBuyItem[] = [];
    csv.lines.slice(1).forEach((line, i) => {
      try {
        buy.push(
          new GatyaItemBuyItem(
            i,
            line.get(0).to_int(),
            line.get(1).to_bool(),
            line.get(2).to_int(),
            line.get(3).to_int(),
            line.get(4).to_int(),
            line.get(5).to_int(),
            line.get(6).to_int(),
            line.get(7).to_int(),
            line.get(8).to_int(),
            line.get(9).to_int(),
            line.get(10).to_int(),
            line.get(11).to_str(),
          ),
        );
      } catch {
        // IndexError: skip malformed row
      }
    });
    return buy;
  }

  sort_by_index(items: GatyaItemBuyItem[]): GatyaItemBuyItem[] {
    items.sort((a, b) => a.index - b.index);
    return items;
  }

  get_by_category(category: number | GatyaItemCategory): GatyaItemBuyItem[] | null {
    if (this.buy === null) return null;
    const cat = Number(category);
    return this.sort_by_index(this.buy.filter((item) => item.category === cat));
  }

  get_names_by_category(
    category: number | GatyaItemCategory,
  ): [GatyaItemBuyItem, string | null][] | null {
    const items = this.get_by_category(category);
    if (items === null) return null;
    const names = new GatyaItemNames(this.save_file);
    return items.map((item) => [item, names.get_name(item.id)]);
  }

  get(item_id: number): GatyaItemBuyItem | null {
    if (this.buy === null) return null;
    if (item_id < 0 || item_id >= this.buy.length) return null;
    return this.buy[item_id];
  }

  get_by_server_id(server_id: number): GatyaItemBuyItem | null {
    if (this.buy === null) return null;
    for (const item of this.buy) if (item.server_id === server_id) return item;
    return null;
  }
}
