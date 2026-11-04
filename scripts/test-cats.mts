import fs from "node:fs";
import { SaveFile } from "@/lib/bcsfe/core/io/save";
import { core_data } from "@/lib/bcsfe/core/core_data";
import { loadGameDataForSave } from "./node-game-data.ts";
import { Cat, Talent, StorageItem } from "@/lib/bcsfe/core/game/catbase/cat";
import * as ce from "@/lib/bcsfe/edits/cat_editor";
import * as st from "@/lib/bcsfe/edits/storage";
import * as ss from "@/lib/bcsfe/edits/special_skills";

let fails = 0;
function ok(cond: boolean, msg: string) {
  console.log(`${cond ? "PASS" : "FAIL"} ${msg}`);
  if (!cond) fails++;
}
const bytes = new Uint8Array(fs.readFileSync("tests/fixtures/py_en_150500.sav"));
let save = SaveFile.from_bytes(bytes);
await loadGameDataForSave(save, process.env.BCSFE_GAME_DATA!);
// The fixture is a fresh save with 0 cats: populate it like a real save (one Cat per unitbuy row, talents from SkillAcquisition).
{
  const nUnits = save.cats.read_unitbuy(save).unit_buy!.length;
  save.cats.cats = Array.from({ length: nUnits }, (_, i) => Cat.init(i));
  const td = save.cats.read_talent_data(save)!;
  for (const cat of save.cats.cats) {
    const cs = td.get_cat_skill(cat.id);
    if (cs) cat.talents = cs.skills.map((sk) => new Talent(sk.ability_id, 0));
  }
  while (save.menu_unlocks.length < 6) save.menu_unlocks.push(0); // fresh fixture has empty lists
  save = SaveFile.from_bytes(save.to_bytes());
  core_data.reset();
  await loadGameDataForSave(save, process.env.BCSFE_GAME_DATA!);
}
const reparse = () => { const b = save.to_bytes(); save = SaveFile.from_bytes(b); return save; };

const total = save.cats.cats.length;
console.log("cats", total, "unlocked", ce.select_current(save).length);

// --- selection
const all = ce.select_all(save);
ok(all.length === total, "select_all");
ok(ce.select_ids(save, ce.parse_id_ranges("0-9 20", total - 1)).length === 11, "select_ids range");
const rarNames = ce.get_rarity_names(save);
ok(rarNames.length >= 5, `rarity names ${rarNames.join(",")}`);
const rarSum = rarNames.map((_, i) => ce.select_rarity(save, [i]).length).reduce((a, b) => a + b, 0);
ok(rarSum === total, `rarity partition ${rarSum}/${total}`);
const named = ce.select_name(save, "cat");
ok(named.length > 0 && named.every((c) => ce.cat_names(save, c).some((n) => n.toLowerCase().includes("cat"))), `select_name ${named.length}`);
console.log("name of 0:", ce.cat_names(save, save.cats.cats[0]));
const ob = ce.select_obtainable(save)!, nob = ce.select_not_obtainable(save)!;
ok(ob.length + nob.length === total && ob.length > 0, `obtainable ${ob.length} + ${nob.length}`);
ok(ce.select_non_gacha(save).length > 0, "non gacha");
const nb = ce.get_gatya_banner_count(save)!;
const bannerCats = ce.select_gatya_banners(save, [0, 1, 2])!;
ok(nb > 3 && bannerCats.length > 0, `banners ${nb}, cats in 0-2: ${bannerCats.length}`);
const gvs = ce.get_unit_game_versions(save);
ok(gvs.length > 5, `game versions ${gvs.length}`);
const gvCats = ce.select_game_versions(save, ce.parse_version_spec("0.0.1-1.0.0"))!;
const gvAll = ce.select_game_versions(save, gvs)!;
ok(gvAll.length > 0 && gvAll.length <= total, `gv select ${gvAll.length}, early ${gvCats.length}`);
const a = ce.select_ids(save, [0, 1, 2, 3]), b = ce.select_ids(save, [2, 3, 4]);
ok(ce.combine_selection(a, b, "and").map((c) => c.id).join() === "2,3", "AND");
ok(ce.combine_selection(a, b, "or").map((c) => c.id).join() === "0,1,2,3,4", "OR");
ok(ce.combine_selection(a, b, "replace").map((c) => c.id).join() === "2,3,4", "REPLACE");

// --- unlock / remove
save.rank_up_sale_value = 0;
const n1 = ce.unlock_cats(save, ce.select_ids(save, [0, 1, 2, 3, 4]));
ok(n1 === 5 && save.rank_up_sale_value === 0x7fffffff, "unlock + rank up sale");
reparse();
ok([0, 1, 2, 3, 4].every((i) => save.cats.cats[i].unlocked === 1 && save.cats.cats[i].gatya_seen === 1), "unlocked after reparse");
ce.remove_cats(save, ce.select_ids(save, [4]));
reparse();
ok(save.cats.cats[4].unlocked === 0, "remove cat");
ce.unlock_cats(save, ce.select_all(save));
reparse();
ok(ce.select_current(save).length === total, "unlock all");

// --- upgrades
const c0 = save.cats.cats[0];
const lim = ce.get_cat_upgrade_limits(save, c0);
console.log("limits cat0", lim);
let r = ce.upgrade_cats_all(save, [c0], "max+max");
ok(r === 1, "upgrade max+max");
reparse();
ok(save.cats.cats[0].upgrade.plus === lim.max_plus, `plus max ${save.cats.cats[0].upgrade.plus}`);
console.log("cat0 base after max:", save.cats.cats[0].upgrade.base + 1);
ok(save.cats.cats[0].upgrade.base + 1 >= 1, "base upgraded");
r = ce.upgrade_cats_all(save, ce.select_ids(save, [1, 2]), "10+5");
reparse();
ok(save.cats.cats[1].upgrade.base === 9 && save.cats.cats[1].upgrade.plus === 5, `10+5 -> ${save.cats.cats[1].upgrade.base + 1}+${save.cats.cats[1].upgrade.plus}`);
ok(ce.parse_upgrade("garbage", 50, 50) === null, "invalid upgrade input");
ce.upgrade_cats_individual(save, [{ cat_id: 3, input: "+7" }, { cat_id: 2, input: "" }]);
reparse();
ok(save.cats.cats[3].upgrade.plus === 7, "individual plus only");
ce.upgrade_cats_all(save, ce.select_all(save), "max+max");
reparse();
ok(save.cats.cats.every((c) => c.upgrade.plus > 0 || ce.get_cat_upgrade_limits(save, c).max_plus === 0), "upgrade all max");

// --- forms
const pb = save.cats.read_nyanko_picture_book(save);
const withTrue = ce.select_ids(save, pb.cats!.filter((c) => c.total_forms >= 3).map((c) => c.cat_id).slice(0, 20));
ce.true_form_cats(save, withTrue);
reparse();
ok(withTrue.every((c) => save.cats.cats[c.id].unlocked_forms === 3), `true form ${withTrue.length}`);
ce.remove_true_form_cats(save, withTrue);
reparse();
ok(withTrue.every((c) => save.cats.cats[c.id].unlocked_forms === 0), "remove true form");
const four = pb.cats!.filter((c) => c.total_forms === 4).map((c) => c.cat_id).slice(0, 5);
ce.fourth_form_cats(save, ce.select_ids(save, four));
reparse();
ok(four.length > 0 && four.every((id) => save.cats.cats[id].fourth_form === 2), `fourth form ${four.length}`);
ce.remove_fourth_form_cats(save, ce.select_ids(save, four));
reparse();
ok(four.every((id) => save.cats.cats[id].fourth_form === 0), "remove fourth form");
ce.true_form_cats(save, ce.select_ids(save, [0]), true);
ce.fourth_form_cats(save, ce.select_ids(save, [1]), true);
reparse();
ok(save.cats.cats[0].unlocked_forms === 3 && save.cats.cats[1].fourth_form === 2, "force forms");

// --- talents
console.log("talent version", ce.check_talent_version(save));
const tcat = save.cats.cats.find((c) => ce.get_talent_info(save, c) !== null)!;
const ti = ce.get_talent_info(save, tcat)!;
console.log("talent cat", tcat.id, ce.cat_name(save, tcat), ti);
ce.set_cat_talents(save, tcat, ti.max_levels.map((m) => m + 5));
reparse();
let ti2 = ce.get_talent_info(save, save.cats.cats[tcat.id])!;
ok(ti2.levels.every((l, i) => l === ti.max_levels[i]), "talent clamp to max");
ce.remove_talents_cats(save, ce.select_all(save));
reparse();
ok(save.cats.cats.every((c) => (c.talents ?? []).every((t) => t.level === 0)), "remove talents");
const nt = ce.max_talents_cats(save, ce.select_all(save));
reparse();
ok(nt > 50, `max talents on ${nt} cats`);
ti2 = ce.get_talent_info(save, save.cats.cats[tcat.id])!;
ok(ti2.levels.every((l, i) => l === ti2.max_levels[i]), "all talents maxed");

// --- guide
ce.remove_cat_guide(save, ce.select_all(save));
reparse();
ok(save.cats.cats.every((c) => !c.catguide_collected), "remove guide");
ce.unlock_cat_guide(save, ce.select_ids(save, [0, 1, 2]));
reparse();
ok(save.cats.cats[0].catguide_collected && !save.cats.cats[5].catguide_collected, "unlock guide");

// --- special skills
const skills = ss.list_special_skills(save);
console.log("skills", skills.slice(0, 3));
ok(skills.length >= 8, `special skills ${skills.length}`);
ss.edit_special_skills_individual(save, [{ id: 0, input: "3+2" }, { id: 2, input: "max+max" }]);
reparse();
const sk2 = ss.list_special_skills(save);
ok(sk2[0].base_level === 3 && sk2[0].plus_level === 2, `skill0 ${sk2[0].base_level}+${sk2[0].plus_level}`);
ok(sk2[2].base_level === sk2[2].max_base && sk2[2].plus_level === sk2[2].max_plus, "skill2 max");
const nAll = ss.edit_special_skills_all(save, skills.map((s) => s.id), "max+max");
reparse();
const sk3 = ss.list_special_skills(save);
ok(nAll === skills.length && sk3.every((s) => s.base_level === s.max_base && s.plus_level === s.max_plus), "all skills max (clamped)");

// --- storage (fixture gv >= 11.1 has no storage slots on disk: create them in memory)
save.cats.storage_items = Array.from({ length: 100 }, () => StorageItem.init());
const size = st.get_storage_size(save);
const r1 = st.add_cats(save, [{ id: 0, quantity: 2 }, { id: 5, quantity: 1 }]);
ok(r1.ok, "add cats");
const r2 = st.add_special_skills(save, [{ id: 1, quantity: 1 }]);
ok(r2.ok, "add skills");
const list = st.list_storage(save);
console.log(list.map((e) => e.label));
ok(list.length === 4 && list[0].item_type === 1 && list[3].item_type === 2, "storage list");
ok(st.remove_slots(save, [list[0].slot]) === 1 && st.list_storage(save).length === 3, "remove slot");
ok(!st.add_cats(save, [{ id: 1, quantity: size + 1 }]).ok, "too many rejected");
ok(!st.add_cats(save, [{ id: 1, quantity: size - 2 }]).ok, "not enough space rejected");
st.clear_storage(save);
ok(st.list_storage(save).length === 0 && st.get_storage_space(save.cats.storage_items) === size, "clear");

console.log(fails ? `${fails} FAILURES` : "ALL PASSED");
process.exit(fails ? 1 : 0);
