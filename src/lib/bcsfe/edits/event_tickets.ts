/** Port of bcsfe/cli/edits/event_tickets.py (EventTickets) as async/pure functions. */
import type { SaveFile } from "@/lib/bcsfe/core/io/save";
import { SaveFile as SaveFileCls } from "@/lib/bcsfe/core/io/save";
import { core_data } from "@/lib/bcsfe/core/core_data";
import { GatyaDataOption, GatyaEventType } from "@/lib/bcsfe/core/game/catbase/gatya";
import { GatyaItemCategory } from "@/lib/bcsfe/core/game/catbase/gatya_item";
import { ServerHandler } from "@/lib/bcsfe/core/server/server_handler";
import { ServerGatyaData, split_hhmm, split_yyyymmdd } from "@/lib/bcsfe/core/server/event_data";
import { max_value, clamp_int } from "@/lib/bcsfe/edits/basic_items";

export type EventTicketEntry = {
  /** gatya item id (the ticket) */
  item_id: number;
  /** "YYYY-MM-DD HH:MM -> YYYY-MM-DD HH:MM" */
  time_str: string;
  item_name: string | null;
  message: string;
  /** full display label like the CLI */
  label: string;
  value: number;
};

export type EventTicketsResult =
  | { ok: true; entries: EventTicketEntry[]; max: number }
  | { ok: false; error: "download_failed" | "no_game_data" };

const p2 = (n: number) => String(n).padStart(2, "0");

export function get_ticket(save: SaveFile, item_id: number): number | null {
  const item = core_data.get_gatya_item_buy(save).get(item_id);
  if (item === null) return null;
  if (item.category === GatyaItemCategory.EVENT_TICKETS && item.index < save.event_capsules.length) return save.event_capsules[item.index];
  if (item.category === GatyaItemCategory.LUCKY_TICKETS_1 && item.index < save.lucky_tickets.length) return save.lucky_tickets[item.index];
  if (item.category === GatyaItemCategory.LUCKY_TICKETS_2 && item.index < save.event_capsules_2.length) return save.event_capsules_2[item.index];
  return null;
}

export function edit_ticket(save: SaveFile, item_id: number, amount: number): void {
  const item = core_data.get_gatya_item_buy(save).get(item_id);
  if (item === null) return;
  if (item.category === GatyaItemCategory.EVENT_TICKETS && item.index < save.event_capsules.length) save.event_capsules[item.index] = amount;
  if (item.category === GatyaItemCategory.LUCKY_TICKETS_1 && item.index < save.lucky_tickets.length) save.lucky_tickets[item.index] = amount;
  if (item.category === GatyaItemCategory.LUCKY_TICKETS_2 && item.index < save.event_capsules_2.length) save.event_capsules_2[item.index] = amount;
}

/** Downloads gatya.tsv from the events server and lists every event/lucky ticket with its current amount. */
export async function load_event_tickets(save: SaveFile): Promise<EventTicketsResult> {
  const gatya_item_buy = core_data.get_gatya_item_buy(save);
  const gatya_item_names = core_data.get_gatya_item_names(save);
  const opt_n = GatyaDataOption.read(save, GatyaEventType.NORMAL);
  const opt_r = GatyaDataOption.read(save, GatyaEventType.RARE);
  const opt_e = GatyaDataOption.read(save, GatyaEventType.EVENT);
  if (opt_n === null || opt_r === null || opt_e === null || gatya_item_buy.buy === null) {
    return { ok: false, error: "no_game_data" };
  }

  const temp_save = new SaveFileCls(null, save.cc, true, save.game_version);
  let raw = null;
  try {
    raw = await new ServerHandler(temp_save, false).download_gatya_data();
  } catch {
    raw = null;
  }
  if (raw === null) return { ok: false, error: "download_failed" };
  const data = ServerGatyaData.from_data(raw);
  if (data === null) return { ok: false, error: "download_failed" };

  const entries: EventTicketEntry[] = [];
  for (const item of data.items) {
    for (const gset of item.sets) {
      if (gset.number === -1) continue;
      let opt = null;
      if (item.get_normal_flag()) opt = opt_n.get(gset.number);
      else if (item.get_rare_flag()) opt = opt_r.get(gset.number);
      else if (item.get_collab_flag()) opt = opt_e.get(gset.number);
      if (opt === null) continue;
      const gatya_item = gatya_item_buy.get(opt.ticket_item_id);
      if (gatya_item === null) continue;
      const c = gatya_item.category;
      if (c !== GatyaItemCategory.EVENT_TICKETS && c !== GatyaItemCategory.LUCKY_TICKETS_1 && c !== GatyaItemCategory.LUCKY_TICKETS_2) continue;

      const [sy, sm, sd] = split_yyyymmdd(item.filter.start_yyyymmdd);
      const [sh, smin] = split_hhmm(item.filter.start_hhmm);
      const [ey, em, ed] = split_yyyymmdd(item.filter.end_yyyymmdd);
      const [eh, emin] = split_hhmm(item.filter.end_hhmm);
      const time_str = `${sy}-${p2(sm)}-${p2(sd)} ${p2(sh)}:${p2(smin)} -> ${ey}-${p2(em)}-${p2(ed)} ${p2(eh)}:${p2(emin)}`;
      const message = gset.message.split("<br>").join("\n");
      const item_name = gatya_item_names.get_name(gatya_item.id);
      let label = time_str;
      if (item_name !== null) label += ` - ${item_name}`;
      if (message) label += ` - ${message}`;
      const current = get_ticket(save, gatya_item.id);
      if (current === null) continue;
      entries.push({ item_id: gatya_item.id, time_str, item_name, message, label, value: current });
    }
  }
  return { ok: true, entries, max: max_value(core_data.max_value_manager.event_tickets) };
}

/** Applies amounts (same order as `entries`); later duplicates of the same ticket win, like Python. */
export function edit_event_tickets(save: SaveFile, entries: EventTicketEntry[], values: number[]): void {
  const max = max_value(core_data.max_value_manager.event_tickets);
  entries.forEach((e, i) => {
    if (i < values.length) edit_ticket(save, e.item_id, clamp_int(values[i], max));
  });
}
