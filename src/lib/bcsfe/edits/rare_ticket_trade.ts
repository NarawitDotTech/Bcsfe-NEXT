/** Port of bcsfe/cli/edits/rare_ticket_trade.py as a pure function. */
import type { SaveFile } from "@/lib/bcsfe/core/io/save";
import { core_data } from "@/lib/bcsfe/core/core_data";

/** Max rare tickets that can be added: max(rare_max - current, 0). */
export function get_rare_ticket_trade_max(save: SaveFile): number {
  return Math.max(core_data.max_value_manager.rare_tickets - save.rare_tickets, 0);
}

export type RareTicketTradeResult =
  | { ok: true; added: number }
  | { ok: false; error: "maxed" | "storage_full" | "invalid_amount" };

/**
 * Sets a free cat storage slot to special skill 1 (item_type 2) and
 * gatya.trade_progress = to_add * 5. The user then trades in game.
 */
export function rare_ticket_trade(save: SaveFile, to_add: number): RareTicketTradeResult {
  const max_amount = get_rare_ticket_trade_max(save);
  if (max_amount === 0) return { ok: false, error: "maxed" };
  to_add = Math.trunc(to_add);
  if (!Number.isFinite(to_add) || to_add < 0) return { ok: false, error: "invalid_amount" };
  to_add = Math.min(to_add, max_amount);

  let space = false;
  for (const storage_item of save.cats.storage_items) {
    if (storage_item.item_type === 0 || (storage_item.item_id === 1 && storage_item.item_type === 2)) {
      storage_item.item_id = 1;
      storage_item.item_type = 2;
      space = true;
      break;
    }
  }
  if (!space) return { ok: false, error: "storage_full" };

  save.gatya.trade_progress = to_add * 5;
  return { ok: true, added: to_add };
}
