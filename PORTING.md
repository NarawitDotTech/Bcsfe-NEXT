# Porting conventions (BCSFE-Python -> TypeScript / Next.js)

Upstream source checkout (read-only reference):
`/tmp/claude-0/-home-user-Bcsfe-NEXT/6bd7b2fe-89da-55e7-9504-8ba6327e1d10/scratchpad/src/BCSFE-Python/src/bcsfe`
(referred to below as `PY/`).

## File layout
`PY/core/<path>.py` -> `src/lib/bcsfe/core/<path>.ts` (same relative path, same file name).
e.g. `PY/core/game/catbase/stamp.py` -> `src/lib/bcsfe/core/game/catbase/stamp.ts`,
`PY/core/io/save.py` -> `src/lib/bcsfe/core/io/save.ts`.
`PY/cli/edits/*.py` -> `src/lib/bcsfe/edits/*.ts` (pure functions, no console I/O).
Import with the `@/lib/bcsfe/...` alias. **Never** import a barrel/index file; import the exact module.

## Naming
* Keep Python class names, method names, field names and parameter order **exactly** (snake_case stays snake_case).
  This lets `save.ts` and other modules reference each other without coordination.
* Static methods stay static (`StampData.read(stream)`, `StampData.init()`), instance methods stay instance.
* Python `__init__` -> `constructor` with same params in same order. Keyword-only/optional params -> optional params with same defaults.
* Port `serialize()` / `deserialize()` too (they power JSON export/import).
* Skip `__repr__`/`__str__` and CLI printing.

## Types
* `core.Data` -> `import { Data } from "@/lib/bcsfe/core/io/data"` (already written; read it first - same method names as Python:
  `read_int`, `read_int_list(len?)`, `write_int_list(list, write_length=true, length=null)`, `read_long(): bigint`, ...).
* int -> `number`; 64-bit (`read_long/read_ulong`) -> `bigint`.
* `dict[int, X]` -> `Map<number, X>` (insertion order matters for writing!). `dict[str, X]` -> `Record<string, X>` or `Map<string, X>`.
* `tuple[int,int]` -> `[number, number]`. `X | None` -> `X | null`.
* Python `//` -> `floordiv`, `%` with possibly-negative operands -> `pymod`, `range`, `[x]*n` -> `filled(x,n)`,
  `[f() for _ in range(n)]` -> `times(n, f)`: all in `@/lib/bcsfe/core/utils`.
* `serialize()` must return JSON-safe values: Maps -> objects (`mapToObject`), bigint -> string. `deserialize()` must accept that shape (`objectToMap`).
* Beware Python list aliasing: `[[0]*5]*3` shares inner lists in Python; prefer independent copies in TS unless sharing is relied upon.

## Cross-module APIs (implemented by different agents; rely on these names)
* `SaveFile` class in `src/lib/bcsfe/core/io/save.ts`. In game modules use `import type { SaveFile } from "@/lib/bcsfe/core/io/save"` (type-only to avoid cycles).
  Fields match Python (`save_file.cc`, `save_file.game_version`, `save_file.cats`, ...).
* `GameVersion` (`core/game_version.ts`): field `game_version: number`; comparisons via methods
  `ge(x)`, `gt(x)`, `le(x)`, `lt(x)`, `eq(x)`, `ne(x)` where `x: number | GameVersion` (Python `gv >= 10` -> `gv.ge(10)`),
  `to_string()`, `static from_string(s)`, `valueOf()` returns the int.
* `CountryCode` (`core/country_code.ts`): same methods as Python (`get_code()`, `get_cc_lang()`, `is_lang()`, `static from_code()`, `static get_all()`,...).
  `CountryCodeType` is a TS enum with values `EN="en"`, `JP="jp"`, `KR="kr"`, `TW="tw"` (plus whatever Python has). Equality: `cc.equals(other)`.
* `core_data` singleton (`core/core_data.ts`): `import { core_data } from "@/lib/bcsfe/core/core_data"`. Same getters as Python `CoreData`
  (`get_game_data_getter(save)`, `get_gatya_item_names(save)`, `config`, `local_manager`, `max_value_manager`, ...).
* `GameDataGetter.download(pack_name, file_name): Data | null` is **synchronous** (game data is pre-fetched into memory
  by an async `await core_data.prepare_game_data(save)` call before editing starts). `download_all(pack, files)` likewise sync.
* `CSV`, `Row`, `Cell`, `Delimeter` in `core/io/bc_csv.ts` with Python method names (`new CSV(data, delimiter?)`, iterate with `for (const row of csv)`,
  `row.get(i)` instead of `row[i]` returning a `Cell` with `to_int()/to_str()/to_bool()`, `row.length`, `row.slice(a,b)`, `row.next_int()`...).
* Locale strings: `core_data.local_manager.get_key(key, params?)`.
* Hashing / crypto: `core/crypto.ts` (`Hash`, `HashAlgorithm`, `Hmac`, `NyankoSignature`, `Random`) - synchronous, uses `@noble/hashes`.

## Quality bar
* TypeScript strict; avoid `any` (use `unknown` + narrowing when parsing JSON).
* Check your own files compile: `npx tsc --noEmit -p . 2>&1 | grep -E "<your paths>"` (other agents' files may be mid-edit; ignore their errors).
* Do not run `git commit`, do not edit files owned by other agents, do not run `npm install` unless your task says so.

## Web UI (wave 2)
* Feature inventory of the CLI (menu tree, inputs, effects, game data): `FEATURES.md`. Every feature listed there must get a panel unless it is impossible in a browser (adb/root/waydroid).
* Edits layer: port `PY/cli/edits/*.py` (and any interactive `edit_*` flows in core modules) to pure functions in `src/lib/bcsfe/edits/<name>.ts`.
  No prompts/printing — take parameters, return results. Panels call these.
* Panels: `src/features/<group>/<FeatureName>.tsx` (client components), registered in `src/features/<group>/index.ts`
  as `FeatureDef` (`src/features/types.ts`). Feature `key` = Python feature key, unique app-wide.
* State: `useSave()` from `@/components/editor/SaveContext` gives `{ save, version, commit, notify, gameData }`.
  Mutate the SaveFile then call `commit()` (or `commit(s => ..., "Saved 3 cats")`). Recompute derived data with `version` as a memo dependency.
  If `needsGameData` is set, the shell only renders the panel when game data is ready (`core_data.*` getters work synchronously then).
* UI kit: `@/components/ui/primitives` (Panel, Button, Field, TextInput, Select, NumberField, NumberGrid, Checkbox, Notice, Segmented, MultiSelect).
  Use theme tokens (`bg-surface`, `bg-surface-2`, `text-muted`, `border-border`, `text-accent`, `bg-accent`, `text-danger` ...), never raw hex colours.
  Must work at 375px width. Verb-first button labels ("Apply", "Unlock cats"); show a success notify after applying.
  Locale strings may contain `<@t>..</>` colour tags — use `strip_color_tags` from `@/lib/bcsfe/core/locale_handler` for plain text.
* Max values: `core_data.max_value_manager` (respect config `DISABLE_MAXES`).
* Node testing of edits with real game data: `scripts/node-game-data.ts` (`loadGameDataForSave(save, process.env.BCSFE_GAME_DATA)`),
  see `scripts/smoke-game-data.mts`. EN 15.0 archive: `/tmp/claude-0/-home-user-Bcsfe-NEXT/6bd7b2fe-89da-55e7-9504-8ba6327e1d10/scratchpad/dl/en.tar.xz`.
  Fixture saves: `tests/fixtures/*.sav`. Run `npm test` (round-trip) after touching core files, and `npm run typecheck`.
