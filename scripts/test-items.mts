import fs from "node:fs";
import assert from "node:assert/strict";
import { SaveFile } from "@/lib/bcsfe/core/io/save";
import { core_data } from "@/lib/bcsfe/core/core_data";
import { loadGameDataForSave } from "./node-game-data.ts";
import { StorageItem } from "@/lib/bcsfe/core/game/catbase/cat";
import * as bi from "@/lib/bcsfe/edits/basic_items";
import * as rtt from "@/lib/bcsfe/edits/rare_ticket_trade";
import * as et from "@/lib/bcsfe/edits/event_tickets";
import { BackupMetaData } from "@/lib/bcsfe/core/server/managed_item";

const bytes = new Uint8Array(fs.readFileSync("tests/fixtures/py_en_150500.sav"));
const save = SaveFile.from_bytes(bytes);
await loadGameDataForSave(save, process.env.BCSFE_GAME_DATA!);

const reload = (s: SaveFile) => SaveFile.from_bytes(s.to_data().get_bytes());
let n = 0;
const ok = (name: string) => { n++; console.log("ok -", name); };

// warnings
for (const k of ["catfood_warning", "legend_ticket_warning", "rare_ticket_warning", "platinum_ticket_warning", "100_million_warn"] as const) {
  const w = bi.get_warning(k);
  assert.ok(w.length > 10 && !w.includes("<@") && !w.includes("{{"), `${k}: ${w}`);
}
ok("warnings");
console.log(bi.get_warning("catfood_warning"));

// scalars
assert.equal(bi.edit_catfood(save, 12345), 12345);
assert.equal(bi.edit_catfood(save, 999999), 45000);
assert.equal(bi.edit_xp(save, 777), 777);
assert.equal(bi.edit_normal_tickets(save, 5000), 2999);
assert.equal(bi.edit_rare_tickets(save, 50), 50);
assert.equal(bi.edit_platinum_tickets(save, 3), 3);
assert.equal(bi.edit_legend_tickets(save, 2), 2);
assert.equal(bi.get_platinum_shards_max(save), (9 - 3) * 10 + 9);
assert.equal(bi.edit_platinum_shards(save, 25), 25);
assert.equal(bi.edit_np(save, 321), 321);
assert.equal(bi.edit_leadership(save, 99999), 9999);
assert.equal(bi.edit_100_million_ticket(save, 11), 11);
bi.reset_golden_cat_cpus(save);
console.log("labels", bi.get_catfood_info(save).label, "|", bi.get_np_info(save).label, "|", bi.get_hundred_million_ticket_info(save).label);
const managed = new BackupMetaData(save).get_managed_items();
assert.ok(managed.length >= 4, `managed ${managed.length}`);
ok("scalars + managed items");

// lists (fixture saves have empty lists, like a fresh save; fill them to category size first)
{
  const b = core_data.get_gatya_item_buy(save);
  const fill = (a: number[], n: number) => { while (a.length < n) a.push(0); };
  fill(save.catseyes, b.get_by_category(5)!.length);
  fill(save.catamins, b.get_by_category(6)!.length);
  fill(save.labyrinth_medals, b.get_by_category(11)!.length);
  fill(save.treasure_chests, b.get_by_category(12)!.length);
  fill(save.catfruit, 6);
}
const catseyes = bi.get_catseyes_info(save)!; assert.ok(catseyes && catseyes.names.length > 0);
bi.edit_catseyes(save, catseyes.values.map((_, i) => i + 1));
const catamins = bi.get_catamins_info(save)!; bi.edit_catamins(save, catamins.values.map(() => 7));
const meds = bi.get_labyrinth_medals_info(save)!; bi.edit_labyrinth_medals(save, meds.values.map(() => 3));
const chests = bi.get_treasure_chests_info(save)!; bi.edit_treasure_chests(save, chests.values.map(() => 4));
console.log("catseyes", catseyes.names.slice(0, 3), "catamins", catamins.names.slice(0, 2), "medals", meds.names.length, "chests", chests.names.length);

const fruit = bi.get_catfruit_info(save)!; assert.ok(fruit);
bi.edit_catfruit(save, fruit.values.map((_, i) => (i === 0 ? 5 : 1)));
console.log("catfruit cumulative", fruit.cumulative, "max", fruit.max, fruit.names.slice(0, 2));

// battle items
const bat = bi.get_battle_items_info(save)!; assert.ok(bat);
bi.edit_battle_items(save, bat.values.map(() => 42));
const endless = bi.get_endless_items_info(save)!; assert.ok(endless.length > 0);
bi.edit_endless_items(save, new Map([[0, 90], [1, Infinity]]));
assert.equal(bi.parse_minutes("infinity"), Infinity);
assert.equal(bi.parse_minutes("1.5"), 1.5);
assert.equal(bi.parse_minutes("abc"), null);

// scheme items
const scheme = bi.get_scheme_info(save);
if (scheme) {
  assert.ok(scheme.options.length > 0);
  bi.add_scheme_items(save, scheme, [0, 1]);
  assert.ok(save.scheme_items.to_obtain.includes(scheme.ids[0]));
}
console.log("scheme options", scheme?.options.length, scheme?.options[0]);

// talent orbs
const orbs = bi.get_talent_orbs_info(save)!; assert.ok(orbs);
const sel = bi.select_orbs(orbs, { grade: orbs.grades[0] });
assert.ok(sel.length > 0);
bi.edit_talent_orbs_all(save, orbs, sel, 7);
const one = orbs.all[sel[0].raw_orb_info.orb_id];
bi.edit_talent_orbs_individual(save, orbs, new Map([[one.raw_orb_info.orb_id, 3]]));
console.log("orbs", orbs.all.length, "grades", orbs.grades, bi.orb_label(sel[0]));

// rare ticket trade
const before = save.rare_tickets;
const r = rtt.rare_ticket_trade(save, 10);
console.log("rare trade", r, "max", rtt.get_rare_ticket_trade_max(save));
if (r.ok) assert.equal(save.gatya.trade_progress, 50);
else assert.equal(r.error, "storage_full");
assert.equal(save.rare_tickets, before);
// force a free slot for ok path
if (!r.ok) {
  save.cats.storage_items.push(new StorageItem(0));
  const r2 = rtt.rare_ticket_trade(save, 10);
  assert.deepEqual(r2, { ok: true, added: 10 });
  assert.equal(save.gatya.trade_progress, 50);
  assert.equal(save.cats.storage_items[0].item_type, 2);
  assert.equal(save.cats.storage_items[0].item_id, 1);
}

// event tickets (network; tolerate failure)
const ev = await et.load_event_tickets(save);
console.log("event tickets", ev.ok ? ev.entries.length : ev.error);
if (ev.ok && ev.entries.length) {
  const vals = ev.entries.map(() => 9);
  et.edit_event_tickets(save, ev.entries, vals);
  assert.equal(et.get_ticket(save, ev.entries[0].item_id), 9);
}

// event ticket get/set without the network
{
  const b = core_data.get_gatya_item_buy(save);
  const t = b.get_by_category(1)![0];
  while (save.event_capsules.length <= t.index) save.event_capsules.push(0);
  et.edit_ticket(save, t.id, 13);
  assert.equal(et.get_ticket(save, t.id), 13);
  const fake = [{ item_id: t.id, time_str: "", item_name: null, message: "", label: "", value: 0 }];
  et.edit_event_tickets(save, fake, [99999]);
  assert.equal(et.get_ticket(save, t.id), 9999);
  et.edit_event_tickets(save, fake, [21]);
  (globalThis as Record<string, unknown>).__t = t;
}

// round trip
const s2 = reload(save);
assert.equal(s2.catfood, 45000);
assert.equal(s2.xp, 777);
assert.equal(s2.normal_tickets, 2999);
assert.equal(s2.rare_tickets, 50);
assert.equal(s2.platinum_tickets, 3);
assert.equal(s2.legend_tickets, 2);
assert.equal(s2.platinum_shards, 25);
assert.equal(s2.np, 321);
assert.equal(s2.leadership, 9999);
assert.equal(s2.hundred_million_ticket, 11);
assert.equal(s2.golden_cpu_count, 0);
assert.equal(s2.gatya.trade_progress, 50);
assert.equal(s2.cats.storage_items[0].item_type, 2);
assert.deepEqual(s2.catseyes.slice(0, catseyes.values.length), catseyes.values.map((_, i) => i + 1));
assert.ok(s2.catamins.slice(0, catamins.values.length).every((v) => v === 7));
assert.ok(s2.labyrinth_medals.slice(0, meds.values.length).every((v) => v === 3));
assert.ok(s2.treasure_chests.every((v) => v === 4));
assert.equal(s2.catfruit[0], Math.min(5, fruit.max));
assert.ok(s2.battle_items.items.every((i) => i.amount === 42));
assert.equal(s2.battle_items.items[1].endless_item.end, Infinity);
assert.ok(s2.battle_items.items[0].endless_item.active);
assert.equal(s2.talent_orbs.orbs.get(one.raw_orb_info.orb_id)?.value, 3);
assert.equal(s2.talent_orbs.orbs.get(sel[sel.length - 1].raw_orb_info.orb_id)?.value, sel.length > 1 ? 7 : 3);
{
  const t = (globalThis as Record<string, unknown>).__t as { index: number };
  assert.equal(s2.event_capsules[t.index], 21);
}
assert.ok(new BackupMetaData(s2).get_managed_items().length >= 4);
if (scheme) assert.ok(s2.scheme_items.to_obtain.includes(scheme.ids[0]));
ok("round trip");

// DISABLE_MAXES
{
  const { ConfigKey } = await import("@/lib/bcsfe/core/io/config");
  core_data.config.set(ConfigKey.DISABLE_MAXES, true);
  assert.equal(bi.edit_np(save, 50000), 50000);
  assert.equal(bi.edit_leadership(save, 99999), 32767);
  core_data.config.set(ConfigKey.DISABLE_MAXES, false);
  assert.equal(bi.edit_np(save, 50000), 9999);
  ok("DISABLE_MAXES");
}
console.log(`\n${n} groups passed`);
