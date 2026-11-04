# BCSFE Web

A Next.js web port of [BCSFE-Python](https://github.com/fieryhenry/BCSFE-Python) by fieryhenry, the Battle Cats save file editor (GPL-3.0).

Save files are parsed and edited entirely in your browser. Only game-server calls (transfer codes, uploads, event data) and game-data downloads go through this app's `/api/proxy` route, because those hosts do not allow cross-origin requests. The route forwards only to an allowlist of hosts.

## Features
All features of the Python CLI menu (see `FEATURES.md`), grouped like the original:
- **Save management**: load from file / transfer code / JSON / new save, download, upload to get transfer codes, export JSON, convert region and game version.
- **Items**: catfood, XP, all tickets, rare ticket trade, platinum shards, NP, leadership, battle items (incl. endless), catseyes, catfruit, talent orbs, catamins, scheme items, labyrinth medals, event tickets, treasure chests and more.
- **Cats**: advanced cat selection, unlock/remove, upgrade (`base+plus` grammar), true and ultra forms, talents, cat guide, special skills, cat storage, plus a cat list.
- **Levels**: story, treasures, ITF timed scores, events, collabs, gauntlets, uncanny, catamin stages, legend quest, towers, zero legends, outbreaks, aku realm, enigma, dojo and more.
- **Gamatoto / Ototo**, **Account**, **Gacha seeds**, **Fixes**, **Other** (slots, play time, enemy guide, user rank rewards, gold pass, medals, missions…), **Settings**.

Not available in a browser: adb / root / WayDroid push and pull.

## Development
```bash
npm install
npm run dev          # http://localhost:3000
npm run typecheck
npm test             # byte-exact save round-trip tests (tests/fixtures)
```
Edit-level tests with real game data:
```bash
BCSFE_GAME_DATA=/path/to/en.tar.xz npx tsx --tsconfig tsconfig.json scripts/test-cats.mts   # also test-items/levels/other
```

## Layout
- `src/lib/bcsfe/core` – line-by-line port of the Python `bcsfe/core` (save format, game modules, server, game data).
- `src/lib/bcsfe/edits` – pure versions of the CLI edit flows.
- `src/features/*` – one panel per feature, registered in `src/features/registry.ts`.
- `src/components` – app shell, save state and UI kit.
- See `PORTING.md` for the conventions used.
