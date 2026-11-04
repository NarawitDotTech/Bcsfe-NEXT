import fs from "node:fs";
import { SaveFile } from "@/lib/bcsfe/core/io/save";
import { core_data } from "@/lib/bcsfe/core/core_data";
import { loadGameDataForSave } from "./node-game-data.ts";
const save = SaveFile.from_bytes(new Uint8Array(fs.readFileSync("tests/fixtures/py_en_150500.sav")));
console.log("files", await loadGameDataForSave(save, process.env.BCSFE_GAME_DATA!));
console.log("lang", core_data.get_lang(save));
console.log("item names", core_data.get_gatya_item_names(save).names?.slice?.(0, 5));
