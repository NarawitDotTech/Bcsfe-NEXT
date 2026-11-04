import { SaveFile } from "@/lib/bcsfe/core/io/save";
import { CountryCode } from "@/lib/bcsfe/core/country_code";
import { GameVersion } from "@/lib/bcsfe/core/game_version";
import { readFileSync, readdirSync } from "node:fs";

function eq(a: Uint8Array, b: Uint8Array) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}
let fail = 0;
const check = (name: string, bytes: Uint8Array, cc?: CountryCode) => {
  try {
    const s = SaveFile.from_bytes(bytes, cc);
    const b2 = s.to_bytes();
    const json = JSON.stringify(s.to_dict());
    const s3 = SaveFile.from_dict(JSON.parse(json));
    const b3 = s3.to_bytes();
    const ok = eq(bytes, b2) && eq(bytes, b3);
    if (!ok) fail++;
    console.log(`${ok ? "PASS" : "FAIL"} ${name} gv=${s.game_version.to_string()} cc=${s.cc.get_code()} len=${bytes.length} hash=${s.verify_hash()}`);
  } catch (e) {
    fail++;
    console.log(`FAIL ${name}: ${(e as Error).message}`);
  }
};
for (const cc of ["en", "jp", "kr", "tw"]) {
  for (const gv of [90000, 100000, 110000, 120200, 130000, 140000, 140500, 150000]) {
    const s = new SaveFile(null, CountryCode.from_code(cc), false, new GameVersion(gv));
    check(`fresh ${cc} ${gv}`, s.to_bytes(), CountryCode.from_code(cc));
  }
}
const dir = process.argv[2];
if (dir) for (const f of readdirSync(dir)) check(f, new Uint8Array(readFileSync(`${dir}/${f}`)));
console.log(fail ? `${fail} failures` : "all passed");
process.exit(fail ? 1 : 0);
