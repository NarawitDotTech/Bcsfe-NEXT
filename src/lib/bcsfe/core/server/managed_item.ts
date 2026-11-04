/** Port of bcsfe/core/server/managed_item.py */
import type { SaveFile } from "@/lib/bcsfe/core/io/save";
import { NyankoSignature, Random } from "@/lib/bcsfe/core/crypto";
import { json_dumps_nospace } from "@/lib/bcsfe/core/server/request";

export enum DetailType {
  GET = "get",
  USE = "use",
}

export enum ManagedItemType {
  CATFOOD = "catfood",
  RARE_TICKET = "rareTicket",
  PLATINUM_TICKET = "platinumTicket",
  LEGEND_TICKET = "legendTicket",
}

function pyInt(s: string | undefined): number | null {
  if (s === undefined) return null;
  const t = s.trim();
  if (!/^[+-]?\d+$/.test(t)) return null;
  return parseInt(t, 10);
}

function uuid4(): string {
  return crypto.randomUUID();
}

export class ManagedItem {
  amount: number;
  detail_type: DetailType;
  managed_item_type: ManagedItemType;
  detail_code: string;
  detail_created_at: number;

  constructor(
    amount: number,
    detail_type: DetailType,
    managed_item_type: ManagedItemType,
    detail_code: string = "",
    detail_created_at: number = 0,
  ) {
    this.amount = amount;
    this.detail_type = detail_type;
    this.managed_item_type = managed_item_type;
    if (!detail_code) detail_code = uuid4();
    this.detail_code = detail_code;
    if (!detail_created_at) detail_created_at = Math.floor(Date.now() / 1000);
    this.detail_created_at = detail_created_at;
  }

  static from_change(change: number, managed_item_type: ManagedItemType): ManagedItem {
    const detail_type = change > 0 ? DetailType.GET : DetailType.USE;
    return new ManagedItem(Math.abs(change), detail_type, managed_item_type);
  }

  to_dict(): Record<string, unknown> {
    return {
      amount: this.amount,
      detailCode: this.detail_code,
      detailCreatedAt: this.detail_created_at,
      detailType: this.detail_type,
      managedItemType: this.managed_item_type,
    };
  }

  to_short_form(): string {
    return `${this.amount}_${this.detail_created_at}_${this.managed_item_type}_${this.detail_type}`;
  }

  static from_short_form(short_form: string): ManagedItem {
    const values = short_form.split("_");
    const amount = pyInt(values[0]) ?? 0;
    const detail_created_at = pyInt(values[1]) ?? 0;
    const managed_item_type = values[2] ?? ManagedItemType.CATFOOD;
    const detail_type = values[3] ?? DetailType.GET;
    if (!Object.values(DetailType).includes(detail_type as DetailType)) {
      throw new Error(`${detail_type} is not a valid DetailType`);
    }
    if (!Object.values(ManagedItemType).includes(managed_item_type as ManagedItemType)) {
      throw new Error(`${managed_item_type} is not a valid ManagedItemType`);
    }
    return new ManagedItem(
      amount,
      detail_type as DetailType,
      managed_item_type as ManagedItemType,
      "",
      detail_created_at,
    );
  }

  to_string(): string {
    return `${this.amount} ${this.managed_item_type} (${this.detail_type})`;
  }
}

export class BackupMetaData {
  save_file: SaveFile;
  identifier = "managed_items";

  constructor(save_file: SaveFile) {
    this.save_file = save_file;
  }

  set_managed_items(managed_items: ManagedItem[]): void {
    this.save_file.remove_strings(this.identifier);
    for (const managed_item of managed_items) {
      this.save_file.store_string(this.identifier, managed_item.to_short_form(), false);
    }
  }

  get_managed_items(): ManagedItem[] {
    const managed_items: ManagedItem[] = [];
    for (const s of this.save_file.get_strings(this.identifier)) {
      const managed_item = ManagedItem.from_short_form(s);
      if (managed_item.amount === 0) continue;
      managed_items.push(managed_item);
    }
    return managed_items;
  }

  add_managed_item(managed_item: ManagedItem): void {
    if (managed_item.amount === 0) return;
    const managed_items = this.get_managed_items();
    managed_items.push(managed_item);
    this.set_managed_items(managed_items);
  }

  remove_managed_items(): void {
    this.save_file.remove_strings(this.identifier);
  }

  create(save_key: string | null = null, add_managed_items: boolean = true): string {
    return BackupMetaData.create_static(
      this.save_file.inquiry_code,
      this.save_file.officer_pass.play_time,
      this.save_file.calculate_user_rank(),
      this.get_managed_items(),
      save_key,
      add_managed_items,
    );
  }

  static create_static(
    iq: string,
    playtime: number,
    userrank: number,
    items: ManagedItem[],
    save_key: string | null = null,
    add_managed_items: boolean = true,
  ): string {
    const managed_items: Record<string, unknown>[] = [];
    if (add_managed_items) {
      for (const managed_item of items) {
        if (managed_item.amount === 0) continue;
        managed_items.push(managed_item.to_dict());
      }
    }
    const managed_items_str = json_dumps_nospace(managed_items);
    const backup_metadata: Record<string, unknown> = {
      managedItemDetails: managed_items,
      nonce: Random.get_hex_string(32),
      playTime: playtime,
      rank: userrank,
      receiptLogIds: [],
      signature_v1: new NyankoSignature(iq, managed_items_str).generate_signature_v1(),
    };
    if (save_key !== null) backup_metadata["saveKey"] = save_key;
    return json_dumps_nospace(backup_metadata);
  }
}
