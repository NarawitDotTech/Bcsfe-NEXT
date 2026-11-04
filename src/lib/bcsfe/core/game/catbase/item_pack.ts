import type { Data } from "@/lib/bcsfe/core/io/data";
import { mapToObject, objectToMap } from "@/lib/bcsfe/core/utils";

export class PurchasedPack {
  purchased: boolean;

  constructor(purchased: boolean) {
    this.purchased = purchased;
  }

  static init(): PurchasedPack {
    return new PurchasedPack(false);
  }

  static read(stream: Data): PurchasedPack {
    return new PurchasedPack(stream.read_bool());
  }

  write(stream: Data): void {
    stream.write_bool(this.purchased);
  }

  serialize(): boolean {
    return this.purchased;
  }

  static deserialize(data: boolean): PurchasedPack {
    return new PurchasedPack(data);
  }
}

export class PurchaseSet {
  purchases: Map<string, PurchasedPack>;

  constructor(purchases: Map<string, PurchasedPack>) {
    this.purchases = purchases;
  }

  static init(): PurchaseSet {
    return new PurchaseSet(new Map());
  }

  static read(stream: Data): PurchaseSet {
    const total = stream.read_int();
    const purchases = new Map<string, PurchasedPack>();
    for (let i = 0; i < total; i++) {
      const key = stream.read_string();
      purchases.set(key, PurchasedPack.read(stream));
    }
    return new PurchaseSet(purchases);
  }

  write(stream: Data): void {
    stream.write_int(this.purchases.size);
    for (const [key, purchase] of this.purchases) {
      stream.write_string(key);
      purchase.write(stream);
    }
  }

  serialize(): Record<string, boolean> {
    const out: Record<string, boolean> = {};
    for (const [key, purchase] of this.purchases) out[key] = purchase.serialize();
    return out;
  }

  static deserialize(data: Record<string, boolean>): PurchaseSet {
    const purchases = new Map<string, PurchasedPack>();
    for (const [key, purchase] of Object.entries(data))
      purchases.set(key, PurchasedPack.deserialize(purchase));
    return new PurchaseSet(purchases);
  }
}

export class Purchases {
  purchases: Map<number, PurchaseSet>;

  constructor(purchases: Map<number, PurchaseSet>) {
    this.purchases = purchases;
  }

  static init(): Purchases {
    return new Purchases(new Map());
  }

  static read(stream: Data): Purchases {
    const total = stream.read_int();
    const purchases = new Map<number, PurchaseSet>();
    for (let i = 0; i < total; i++) {
      const key = stream.read_int();
      purchases.set(key, PurchaseSet.read(stream));
    }
    return new Purchases(purchases);
  }

  write(stream: Data): void {
    stream.write_int(this.purchases.size);
    for (const [key, purchase] of this.purchases) {
      stream.write_int(key);
      purchase.write(stream);
    }
  }

  serialize(): Record<string, Record<string, boolean>> {
    return mapToObject(this.purchases, (p) => p.serialize());
  }

  static deserialize(data: Record<string, Record<string, boolean>>): Purchases {
    return new Purchases(objectToMap(data, (p) => PurchaseSet.deserialize(p)));
  }
}

export class ItemPack {
  purchases: Purchases;
  displayed_packs: Map<number, boolean>;
  three_days_started: boolean;
  three_days_end_timestamp: number;

  constructor(purchases: Purchases) {
    this.purchases = purchases;
    this.displayed_packs = new Map();
    this.three_days_started = false;
    this.three_days_end_timestamp = 0.0;
  }

  static init(): ItemPack {
    return new ItemPack(Purchases.init());
  }

  static read(stream: Data): ItemPack {
    return new ItemPack(Purchases.read(stream));
  }

  write(stream: Data): void {
    this.purchases.write(stream);
  }

  read_displayed_packs(stream: Data): void {
    const total = stream.read_int();
    const displayed_packs = new Map<number, boolean>();
    for (let i = 0; i < total; i++) {
      const key = stream.read_int();
      displayed_packs.set(key, stream.read_bool());
    }
    this.displayed_packs = displayed_packs;
  }

  write_displayed_packs(stream: Data): void {
    stream.write_int(this.displayed_packs.size);
    for (const [key, displayed] of this.displayed_packs) {
      stream.write_int(key);
      stream.write_bool(displayed);
    }
  }

  read_three_days(stream: Data): void {
    this.three_days_started = stream.read_bool();
    this.three_days_end_timestamp = stream.read_double();
  }

  write_three_days(stream: Data): void {
    stream.write_bool(this.three_days_started);
    stream.write_double(this.three_days_end_timestamp);
  }

  serialize(): Record<string, unknown> {
    return {
      purchases: this.purchases.serialize(),
      displayed_packs: mapToObject(this.displayed_packs),
      three_days_started: this.three_days_started,
      three_days_end_timestamp: this.three_days_end_timestamp,
    };
  }

  static deserialize(data: Record<string, unknown>): ItemPack {
    const item_pack = new ItemPack(
      Purchases.deserialize(
        (data["purchases"] as Record<string, Record<string, boolean>> | undefined) ?? {},
      ),
    );
    item_pack.displayed_packs = objectToMap(
      data["displayed_packs"] as Record<string, boolean> | undefined,
    );
    item_pack.three_days_started = (data["three_days_started"] as boolean | undefined) ?? false;
    item_pack.three_days_end_timestamp =
      (data["three_days_end_timestamp"] as number | undefined) ?? 0.0;
    return item_pack;
  }
}
