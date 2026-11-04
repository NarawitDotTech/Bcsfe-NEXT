import { readFileSync } from "node:fs";
import { save_from_bytes, apply_load_actions } from "@/lib/bcsfe/edits/save_management";
import * as fixes from "@/lib/bcsfe/edits/fixes";
const raw = new Uint8Array(readFileSync("tests/fixtures/py_en_150500.sav"));
for (const [n, f] of Object.entries(fixes)) {
  const s = save_from_bytes(raw, null);
  console.log(n, s.menu_unlocks);
  try { f(s); s.to_bytes(); console.log("ok", n); } catch (e) { console.log("FAIL", n, (e as Error).cause); }
}
const s = save_from_bytes(raw, null); apply_load_actions(s); try { s.to_bytes(); console.log("ok load") } catch(e) {console.log("FAIL load")}
