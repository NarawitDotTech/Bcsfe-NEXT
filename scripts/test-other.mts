import fs from "node:fs";
import assert from "node:assert/strict";
import { SaveFile } from "@/lib/bcsfe/core/io/save";
import { loadGameDataForSave } from "./node-game-data.ts";
import * as G from "@/lib/bcsfe/edits/gamototo";
import * as O from "@/lib/bcsfe/edits/other";
import * as E from "@/lib/bcsfe/edits/enemy_editor";
import { features as gf } from "@/features/gamototo";
import { features as of } from "@/features/other";

const bytes = new Uint8Array(fs.readFileSync("tests/fixtures/py_en_150500.sav"));
const save = SaveFile.from_bytes(bytes);
console.log("game data files", await loadGameDataForSave(save, process.env.BCSFE_GAME_DATA!));
let n = 0;
import { core_data } from "@/lib/bcsfe/core/core_data";
const await_names = () => [...core_data.get_mission_names(save).names!.keys()].filter((id) => core_data.get_mission_conditions(save).get_condition(id));
const ok = async (name: string, f: () => void | Promise<void>) => { await f(); n++; console.log("ok", name); };

console.log("features:", [...gf, ...of].map((f) => `${f.key}="${f.label}"`).join(", "));

await ok("engineers", () => { const i = G.engineers_info(save); G.set_engineers(save, 999); assert.equal(save.ototo.engineers, i.max); G.set_engineers(save, 2); assert.equal(save.ototo.engineers, 2); });
await ok("base_materials", () => { const r = G.base_material_rows(save)!; assert(r.length > 0); G.set_base_materials(save, r.map(() => 12345)); assert.equal(save.ototo.base_materials.materials[0].amount, 9999); G.set_base_materials(save, r.map((_, i) => i + 1)); });
await ok("gamatoto xp", () => {
  const info = G.gamatoto_xp_info(save)!; assert(info.max_level! > 1);
  const r = G.set_gamatoto_xp(save, "level", 10)!; assert.equal(r[1], 10); assert.equal(G.gamatoto_xp_info(save)!.level, 10);
  G.set_gamatoto_xp(save, "raw", 5000); assert.equal(save.gamatoto.xp, 5000);
});
await ok("gamatoto helpers", () => {
  const info = G.helper_info(save)!; assert(info.rarity_names.length > 0);
  let a = info.rarity_names.map(() => 0);
  a = G.clamp_cumulative(a, 0, 3, info.max_helpers);
  a = G.clamp_cumulative(a, 1, 2, info.max_helpers);
  G.set_helpers(save, a);
  assert.deepEqual(G.helper_info(save)!.total_rarity_amounts.slice(0, 2), [3, 2]);
  assert.equal(save.gamatoto.helpers.helpers.length, 5);
});
await ok("cannons", async () => {
  // the fixture save has no cannon entries (fresh save): seed 0 (1 part) and 1,2 (3 parts) like a played save
  assert.equal(G.cannon_rows(save)!.length, 0);
  const { Cannon } = await import("@/lib/bcsfe/core/game/gamoto/ototo");
  save.ototo.cannons!.cannons.set(0, new Cannon(3, [0]));
  save.ototo.cannons!.cannons.set(1, new Cannon(0, [0, 0, 0]));
  save.ototo.cannons!.cannons.set(2, new Cannon(0, [0, 0, 0]));
  const rows = G.cannon_rows(save)!; assert(rows.length >= 3, "rows " + rows.length); 
  const mx = G.cannon_part_max_all(save)!;
  G.set_cannon_development(save, [1, 2], 2);
  assert.equal(save.ototo.get_cannon(1)!.development, 2);
  G.set_cannon_development(save, [0, 1], new Map([[1, 1]]));
  assert.equal(save.ototo.get_cannon(1)!.development, 1);
  G.set_cannon_levels(save, [0, 1], [mx[0] + 50, 1, 1]);
  assert(save.ototo.get_cannon(1)!.development >= 3);
  const c0 = G.cannon_rows(save)![0].levels[0]; assert(c0 >= 1 && c0 <= mx[0] + 1, `c0=${c0} max=${mx}`);
  G.set_cannon_levels(save, [1], new Map([[1, [3, 2, 1]]]));
  assert.deepEqual(save.ototo.get_cannon(1)!.levels, [2, 2, 1]);
});
await ok("cat shrine", () => {
  const i = G.shrine_info(save);
  G.set_shrine_level(save, 1); assert.equal(G.shrine_info(save).level, 1); assert.equal(save.cat_shrine.dialogs, 0);
  G.set_shrine_level(save, 5); assert.equal(G.shrine_info(save).level, 5); assert.equal(save.cat_shrine.dialogs, 4);
  G.set_shrine_xp(save, 100); assert.equal(G.shrine_info(save).xp, 100);
  G.shrine_disappear(save); assert.equal(save.cat_shrine.shrine_gone, true);
  G.shrine_appear(save); assert.equal(save.cat_shrine.shrine_gone, false);
  assert(i.max_level! >= 5);
});
await ok("unlocked slots", () => { O.set_unlocked_slots(save, 3); assert.equal(save.lineups.unlocked_slots, 3); O.set_unlocked_slots(save, 9999); assert.equal(save.lineups.unlocked_slots, save.lineups.slot_names_length); });
await ok("reset gambling", () => { O.reset_gambling_events(save); assert.equal(save.wildcat_slots.completed.size, 0); });
await ok("restart pack", () => { O.set_restart_pack(save); assert.equal(save.restart_pack, 1); });
await ok("playtime", () => { O.set_playtime(save, 12, 34, 56); const p = O.get_playtime(save); assert.deepEqual([p.hours, p.minutes, p.seconds], [12, 34, 56]); assert.equal(p.frames, (12 * 3600 + 34 * 60 + 56) * 30); });
await ok("gold pass", () => {
  assert(O.set_gold_pass(save, "") > 0); assert(save.officer_pass.gold_pass.officer_id > 0);
  assert.equal(O.set_gold_pass(save, "1234"), 1234);
  assert.equal(O.set_gold_pass(save, "-1"), -1); assert.equal(save.officer_pass.gold_pass.officer_id, -1);
  O.set_gold_pass(save, "77");
});
await ok("enemy guide", () => {
  // fixture has an empty guide (fresh save): seed a realistic-length array
  assert.equal(save.enemy_guide.length, 0);
  save.enemy_guide = new Array(700).fill(0);
  const valid = E.get_all_valid_enemies(save)!, inv = E.get_all_invalid_enemies(save)!;
  assert(valid.length > 0); assert.equal(valid.length + inv.length, save.enemy_guide.length);
  E.remove_enemy_guide(save, E.get_all_enemies(save)); assert(save.enemy_guide.every((x) => x === 0));
  E.unlock_enemy_guide(save, valid); assert(valid.every((i) => save.enemy_guide[i] === 1)); assert(inv.every((i) => save.enemy_guide[i] === 0));
  assert.deepEqual(E.get_enemies_by_id(save, [3, 5]), [3, 5]);
  const m = E.get_enemies_by_name(save, "doge"); assert(m.length > 0); console.log("  doge:", m.slice(0, 3));
  assert.deepEqual(E.combine_selection([1, 2, 3], [2, 3, 4], "and"), [2, 3]);
  assert.deepEqual(E.combine_selection([1, 2], [2, 4], "or"), [1, 2, 4]);
  assert.deepEqual(E.combine_selection([1, 2], [9], "replace"), [9]);
});
await ok("medals", () => {
  const add = O.medal_options(save, true); assert(add.length > 0);
  O.apply_medals(save, add.slice(0, 3).map((o) => o.id), true);
  const rem = O.medal_options(save, false); assert(add.slice(0, 3).every((o) => rem.some((r) => r.id === o.id)));
  O.apply_medals(save, [add[0].id], false); assert(!save.medals.has_medal(add[0].id));
});
await ok("missions", () => {
  { const names = (await_names()); for (const id of names.slice(0, 3)) save.missions.clear_states.set(id, 0); }
  const o = O.mission_options(save)!; console.log("  missions in save:", o.length);
  if (o.length) {
    const ids = o.slice(0, 2).map((x) => x.id);
    O.edit_missions(save, ids, "complete_claim"); assert.equal(save.missions.clear_states.get(ids[0]), 4);
    O.edit_missions(save, ids, "complete_reward"); assert.equal(save.missions.clear_states.get(ids[0]), 2);
    O.edit_missions(save, ids, "uncomplete"); assert.equal(save.missions.clear_states.get(ids[0]), 0);
    O.edit_missions(save, ids, "complete_claim");
  }
});
await ok("rank rewards", () => {
  save.calculate_user_rank = () => 5000; // fixture has no cats
  console.log("  cats", save.cats.cats.length, "rank", save.calculate_user_rank());
  const c = O.rank_reward_options(save, "claim")!; console.log("  claimable:", c.rank_gifts.length, c.descriptions[0]); assert(c.rank_gifts.length > 0);
  if (c.rank_gifts.length) { O.apply_rank_rewards(save, c.rank_gifts, [0], "claim"); assert.equal(save.user_rank_rewards.rewards[c.rank_gifts[0].index].claimed, true); }
  const u = O.rank_reward_options(save, "unclaim")!;
  if (u.rank_gifts.length) { O.apply_rank_rewards(save, u.rank_gifts, [0], "unclaim"); }
  assert(O.fix_claimed_rewards(save));
});

// re-serialise & re-parse
const out = save.to_bytes();
const back = SaveFile.from_bytes(out);
assert.equal(back.ototo.engineers, 2);
assert.equal(back.gamatoto.helpers.helpers.length, 5);
assert.equal(back.officer_pass.play_time, (12 * 3600 + 34 * 60 + 56) * 30);
assert.equal(back.officer_pass.gold_pass.officer_id, 77);
assert.equal(back.restart_pack, 1);
assert.equal(back.lineups.unlocked_slots, save.lineups.slot_names_length);
assert.deepEqual(back.enemy_guide, save.enemy_guide);
assert.equal(back.medals.medal_data_1.length, save.medals.medal_data_1.length);
assert.equal(back.cat_shrine.shrine_gone, false);
console.log(`all ${n} edit groups OK, round-trip verified`);
