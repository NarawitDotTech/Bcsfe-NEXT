import { readFileSync } from "node:fs";
import { CountryCode } from "@/lib/bcsfe/core/country_code";
import { GameVersion } from "@/lib/bcsfe/core/game_version";
import { new_blank_save, save_from_bytes, export_save_json, save_from_json, apply_load_actions } from "@/lib/bcsfe/edits/save_management";
import * as fixes from "@/lib/bcsfe/edits/fixes";
import { core_data } from "@/lib/bcsfe/core/core_data";
const raw = readFileSync("tests/fixtures/py_en_150500.sav");
const s = save_from_bytes(new Uint8Array(raw), null);
console.log(s.cc.get_code(), s.game_version.to_string(), s.calculate_user_rank());
apply_load_actions(s);
fixes.fix_gamatoto_crash(s); fixes.fix_ototo_crash(s); fixes.fix_time_errors(s); fixes.unlock_equip_menu(s); fixes.fix_officer_pass_crash(s);
const b = s.to_bytes();
const s2 = save_from_bytes(b, null); console.log("reparse ok", s2.gamatoto.skin);
const j = export_save_json(s); const s3 = save_from_json(j); console.log("json ok", s3.catfood === s.catfood);
try { const n = new_blank_save(new CountryCode("jp"), GameVersion.from_string("15.5.0")); console.log("blank", n.cc.get_code(), n.to_bytes().length); } catch (e) { console.log("blank err", e); }
try { save_from_bytes(new Uint8Array(10), null) } catch (e) { console.log((e as Error).name, (e as Error).message) }
console.log(core_data.local_manager.get_key("strict_ban_prevention_desc",{current_value:"x",default_value:"y"}));
