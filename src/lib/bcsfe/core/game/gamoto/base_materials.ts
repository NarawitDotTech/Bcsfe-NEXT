import type { Data } from "@/lib/bcsfe/core/io/data";
import type { SaveFile } from "@/lib/bcsfe/core/io/save";
import { core_data } from "@/lib/bcsfe/core/core_data";

export class Material {
  amount: number;

  constructor(amount: number) {
    this.amount = amount;
  }

  static init(): Material {
    return new Material(0);
  }

  static read(stream: Data): Material {
    return new Material(stream.read_int());
  }

  write(stream: Data): void {
    stream.write_int(this.amount);
  }

  serialize(): number {
    return this.amount;
  }

  static deserialize(data: number): Material {
    return new Material(data);
  }
}

export class BaseMaterials {
  materials: Material[];

  constructor(materials: Material[]) {
    this.materials = materials;
  }

  static init(): BaseMaterials {
    return new BaseMaterials([]);
  }

  static read(stream: Data): BaseMaterials {
    const total = stream.read_int();
    const materials: Material[] = [];
    for (let i = 0; i < total; i++) materials.push(Material.read(stream));
    return new BaseMaterials(materials);
  }

  write(stream: Data): void {
    stream.write_int(this.materials.length);
    for (const material of this.materials) material.write(stream);
  }

  serialize(): number[] {
    return this.materials.map((m) => m.serialize());
  }

  static deserialize(data: number[]): BaseMaterials {
    return new BaseMaterials(data.map((m) => Material.deserialize(m)));
  }

  /**
   * Pure replacement for the first half of Python `edit_base_materials`:
   * returns the display names (one per base material), or null if data is unavailable.
   * Max value for each: `core_data.max_value_manager.base_materials`.
   */
  get_base_material_names(save_file: SaveFile): string[] | null {
    const all_names = core_data.get_gatya_item_names(save_file).names;
    const items = core_data.get_gatya_item_buy(save_file).get_by_category(7);
    if (items === null || all_names === null) return null;
    return items.map((item) => all_names[item.id]);
  }

  /** Pure replacement for the second half of `edit_base_materials`: apply the edited values. */
  edit_base_materials(values: number[]): void {
    this.materials = values.map((v) => new Material(v));
  }
}
