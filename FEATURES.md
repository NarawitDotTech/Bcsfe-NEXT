# BCSFE CLI feature inventory (for the web UI rebuild)

Base path used below: `BASE = /tmp/claude-0/-home-user-Bcsfe-NEXT/6bd7b2fe-89da-55e7-9504-8ba6327e1d10/scratchpad/src/BCSFE-Python/src/bcsfe`. Module paths are relative to `BASE` (e.g. `cli/feature_handler.py` = `BASE/cli/feature_handler.py`). English strings are in `BASE/files/locales/en/{core,edits}/*.properties`. Keys containing `|` are alias lists; the CLI displays the first alias.

Coverage note: the menu tree, every `cli/edits/*.py` module, `cli/save_management.py`, `cli/main.py`, `cli/server_cli.py`, and the entry points of the referenced core functions were read in full. Some sub-prompts inside core modules were only skimmed (listed in section 7).

---

## 1. Menu tree (exact order from `cli/feature_handler.py:get_features`)

Top level is ordered: save_management, items, cats_special_skills, levels, gamototo, account, gatya, fixes, other, editor, exit. The `cats_special_skills` branch depends on the config key `SEPARATE_CAT_EDIT_OPTIONS` (default True).

Format: `key` - English display name - callable.

**save_management** - "Save Management" (`core/save.properties`)
- save_save - "Save save" - `SaveManagement.save_save`
- save_upload - "Upload save file to server and get transfer and confirmation code" - `SaveManagement.save_upload`
- save_save_file - "Save save to specific file" - `SaveManagement.save_save_dialog`
- (dynamic key) `save_save_documents` - "Save save to {path}" (path = `SaveFile.get_save_path()`) - `SaveManagement.save_save_data_dir`
- adb_push - "Use adb to push the save file to a device (Do not rerun the game after pushing)" - `SaveManagement.adb_push`
- adb_push_rerun - "...(Rerun the game after pushing)" - `SaveManagement.adb_push_rerun`
- root_push - "Use root to push save directly to the game" - `SaveManagement.root_push`
- root_push_rerun - "Use root to push save directly to the game (and rerun the game)" - `SaveManagement.root_push_rerun`
- export_save - "Export save file to json" - `SaveManagement.export_save`
- load_save - "Load save file" - `SaveManagement.load_save`
- (commented out) init_save - not exposed
- convert_region - "Convert country code (e.g en -> jp)" - `SaveManagement.convert_save_cc`
- convert_version - "Convert game version (e.g 12.2.1 -> 12.2.0)" - `SaveManagement.convert_save_gv`

**items** - "Items" (`edits/items.properties`)
1. catfood - "Cat Food" - `BasicItems.edit_catfood`
2. xp - "XP" - `BasicItems.edit_xp`
3. normal_tickets - "Normal Tickets" (aliases: Basic Tickets, Silver Tickets) - `BasicItems.edit_normal_tickets`
4. rare_tickets - "Rare Tickets" (alias: Gold Tickets) - `BasicItems.edit_rare_tickets`
5. rare_ticket_trade_feature_name - "Rare Ticket Trade (Allows for unbannable rare tickets)" - `edits.rare_ticket_trade.RareTicketTrade.rare_ticket_trade`
6. platinum_tickets - "Platinum Tickets" - `BasicItems.edit_platinum_tickets`
7. legend_tickets - "Legend Tickets" - `BasicItems.edit_legend_tickets`
8. platinum_shards - "Platinum Shards" - `BasicItems.edit_platinum_shards`
9. np - "NP" - `BasicItems.edit_np`
10. leadership - "Leadership" - `BasicItems.edit_leadership`
11. battle_items - "Battle Items" - `BasicItems.edit_battle_items`
12. battle_items_endless - "Endless Battle Items" - `BasicItems.edit_battle_items_endless`
13. catseyes - "Catseyes" - `BasicItems.edit_catseyes`
14. catfruit - "Catfruit / Behemoth Stones" - `BasicItems.edit_catfruit`
15. talent_orbs - "Talent Orbs" - `core.game.catbase.talent_orbs.SaveOrbs.edit_talent_orbs`
16. catamins - "Catamins" - `BasicItems.edit_catamins`
17. scheme_items - "Scheme Items" - `BasicItems.edit_scheme_items`
18. labyrinth_medals - "Labyrinth Medals" - `BasicItems.edit_labyrinth_medals`
19. 100_million_tickets - "100 Million Downloads Tickets" - `BasicItems.edit_100_million_ticket`
20. event_tickets - "Event Tickets / Lucky Tickets" (`edits/gatya.properties`) - `edits.event_tickets.EventTickets.edit`
21. treasure_chests - "Treasure Chests" - `BasicItems.edit_treasure_chests`
22. reset_golden_cat_cpus - "Reset Golden Cat CPU Uses" - `BasicItems.reset_golden_cat_cpus`

**cats_special_skills** - "Cats / Special Skills"
- If `SEPARATE_CAT_EDIT_OPTIONS` is True (default):
  - unlock_remove_cats - "Unlock Cats / Remove Cats" - `CatEditor.unlock_remove_cats_run`
  - upgrade_cats - "Upgrade Cats" - `CatEditor.upgrade_cats_run`
  - true_form_remove_form_cats - "True Form Cats / Remove Cat True Forms" - `CatEditor.true_form_remove_form_cats_run`
  - force_true_form_cats - "Force True Form Cats" - `CatEditor.force_true_form_cats_run`
  - fourth_form_remove_form_cats - "Ultra Form Cats / Remove Cat Ultra Forms (4th Forms)" - `CatEditor.fourth_form_remove_form_cats_run`
  - force_fourth_form_cats - "Force Ultra Form Cats (4th Forms)" - `CatEditor.force_fourth_form_cats_run`
  - upgrade_talents_remove_talents_cats - "Upgrade Talents / Remove Talents Cats" - `CatEditor.upgrade_talents_remove_talents_cats_run`
  - unlock_remove_cat_guide - "Claim / Unclaim Cat Guide Entries" - `CatEditor.unlock_cat_guide_remove_guide_run`
- Else:
  - cats - "Cats" - `CatEditor.edit_cats` (a loop menu with the same 8 operations plus "select cats again" and "finish")
- Always:
  - special_skills - "Special Skills / Base Abilities" - `BasicItems.edit_special_skills`
  - cat_storage - "Cat Storage" - `edits.storage.edit_storage`

**levels** - "Levels / Story / Treasure" (`edits/items.properties`, `edits/map.properties`)
1. clear_tutorial - "Clear Tutorial" - `edits.clear_tutorial.clear_tutorial`
2. clear_story - "Main Story Chapters" - `StoryChapters.clear_story`
3. challenge_score - "Challenge Score" - `core.game.map.challenge.edit_challenge_score`
4. dojo_score - "Dojo Score" - `core.game.map.dojo.edit_dojo_score`
5. add_enigma_stages - "Add Enigma Stages" - `core.game.map.enigma.edit_enigma`
6. clear_enigma_stages - "Clear Enigma Stages" - `GauntletChapters.edit_enigma_stages`
7. unlock_aku_realm - "Unlock Aku Realm" - `edits.aku_realm.unlock_aku_realm`
8. story_treasures - "Story Treasures" - `StoryChapters.edit_treasures`
9. outbreaks - "Outbreaks / Zombie Stages" - `Outbreaks.edit_outbreaks`
10. aku_chapters - "Aku Realm Chapters" - `AkuChapters.edit_aku_chapters`
11. itf_timed_scores - "Into the Future Timed Scores" - `StoryChapters.edit_itf_timed_scores`
12. filibuster_reclearing - "Re-enable Filibuster Stage" - `BasicItems.allow_filibuster_stage_reclearing`
13. sol - "Stories of Legend" - `EventChapters.edit_sol_chapters`
14. event - "Normal Event Stages" - `EventChapters.edit_event_chapters`
15. collab - "Collaboration Event Stages" - `EventChapters.edit_collab_chapters`
16. gauntlets - "Gauntlets" - `GauntletChapters.edit_gauntlets`
17. collab_gauntlets - "Collaboration Gauntlets" - `GauntletChapters.edit_collab_gauntlets`
18. uncanny - "Uncanny Legends" - `UncannyChapters.edit_uncanny`
19. catamin_stages - "Catamin Stages" - `UncannyChapters.edit_catamin_stages`
20. behemoth_culling - "Behemoth Culling" - `GauntletChapters.edit_behemoth_culling`
21. legend_quest - "Legend Quest" - `LegendQuestChapters.edit_legend_quest`
22. towers - "Towers" - `TowerChapters.edit_towers`
23. zero_legends - "Zero Legends" - `ZeroLegendsChapters.edit_zero_legends`
24. dojo_catclaw_championships - "Clear Dojo Catclaw Championships" - `ZeroLegendsChapters.edit_catclaw_championships`

**gamototo** - "Gamatoto / Ototo" (`edits/items.properties`)
1. engineers - "Engineers" - `BasicItems.edit_engineers`
2. base_materials - "Base Materials" - `BasicItems.edit_base_materials`
3. gamatoto_xp_level - "Gamatoto XP / Level" - `core.game.gamoto.gamatoto.edit_xp`
4. gamatoto_helpers - "Gamatoto Helpers" - `core.game.gamoto.gamatoto.edit_helpers`
5. ototo_cat_cannon - "Ototo Cat Cannon" - `core.game.gamoto.ototo.edit_cannon`
6. cat_shrine - "Edit Cat Shrine" - `CatShrine.edit_catshrine`

**account** - "Account"
1. unban_account - "Unban Account / Fix Save Used Elsewhere Error" - `SaveManagement.unban_account`
2. upload_items - "Upload managed items to server" - `SaveManagement.upload_items`
3. inquiry_code - "Inquiry Code" - `BasicItems.edit_inquiry_code`
4. password_refresh_token - "Password Refresh Token" - `BasicItems.edit_password_refresh_token`

**gatya** - "Gacha"
1. rare_gatya_seed - "Rare Gacha Seed" - `BasicItems.edit_rare_gatya_seed`
2. normal_gatya_seed - "Normal Gacha Seed" - `BasicItems.edit_normal_gatya_seed`
3. event_gatya_seed - "Event Gacha Seed" - `BasicItems.edit_event_gatya_seed`

**fixes** - "Fixes" (`edits/fixes.properties`)
1. fix_gamatoto_crash - "Fix gamatoto from crashing the game" - `Fixes.fix_gamatoto_crash`
2. fix_ototo_crash - "Fix ototo from crashing the game" - `Fixes.fix_ototo_crash`
3. fix_time_errors - "Fix time related issues" - `Fixes.fix_time_errors`
4. unlock_equip_menu - "Unlock Equip Menu" - `BasicItems.unlock_equip_menu`
5. fix_officer_pass_crash - "Fix Officer Club Crashing" - `core.OfficerPass.fix_crash`

**other** - "Other"
1. unlocked_slots - "Unlocked Slots" (aliases: Equip Slots, Lineups) - `BasicItems.edit_unlocked_slots`
2. reset_gambling_events - "Reset Wildcat Slots and Cat Scratcher Lottery" - `core.GamblingEvent.reset_events`
3. restart_pack - "Restart Pack" (alias: Returner Mode) - `BasicItems.set_restart_pack`
4. special_skills - "Special Skills / Base Abilities" - `BasicItems.edit_special_skills` (duplicate of the cats_special_skills entry)
5. playtime - "Play Time" - `core.game.catbase.playtime.edit`
6. enemy_guide - "Enemy Guide" - `EnemyEditor.edit_enemy_guide`
7. user_rank_rewards - "Claim User Rank Rewards (Does not give rewards)" - `core.game.catbase.user_rank_rewards.edit_user_rank_rewards`
8. unlock_equip_menu - "Unlock Equip Menu" - `BasicItems.unlock_equip_menu` (duplicate of fixes entry)
9. gold_pass - "Gold Pass / Officer Club" - `NyankoClub.edit_gold_pass`
10. medals - "Meow Medals" - `Medals.edit_medals`
11. missions - "Catnip Challenges / Missions" (alias: Cat Missions) - `Missions.edit_missions`

**editor** - "Editor"
1. config - "Config" - `core.core_data.config.edit_config`
2. update_external - "Check for updates" - `core.update_external_content`
3. manage_game_data - "Manage game data" - `core.manage_game_data`

**exit** - "Exit" - `main.Main.exit_editor`

---

## 2. Shared input primitives (`cli/dialog_creator.py`)

- **Integer with max** (`edit_int_raw`, `edit_int_key`, `int_input_key`): `MaxValue` carries a max and a bit width. Constructors: `i32` (31 bit), `u32`, `i16` (15), `u16`, `i8` (7), `u8`, `always_cap(n)`. If `DISABLE_MAXES` is on, `MaxValue.specific` returns `(2^bits)-1` and hides the max. Otherwise the max is shown and input is clamped.
- **Multi-int lists** (`edit_ints_key`, `edit_ints_raw`): one prompt per named slot, with per-slot `MaxValue` or `MultiMax`. `CumulativeMax` caps the sum across slots (used for old-version catfruit and gamatoto helpers).
- **Index/range multi-select** (`multi_select_indexes_key`, `range_multi_input_key`): space-separated tokens; `a-b` ranges are allowed; the word "all" selects everything; the quit key returns None.
- **Single select / basic pick** (`single_select_key`, `basic_keys_pick_key_index`): numbered menu, returns the chosen action.
- **Yes/no**: `yes_no_key`.
- **Free text**: `str_input_key`, `edit_str_key`, `edit_str_raw`.
- **Max defaults** (`core/max_value_helper.py`, user overrides in `max_values.json` under the config folder): catfood 45000, xp 99999999, normal_tickets 2999, hundred_million_tickets 9999, rare_tickets 299, platinum_tickets 9, legend_tickets 4, np 9999, leadership 9999, battle_items 9999, catamins 9999, catseyes 9999, catfruit_old 128, catfruit_new 998, base_materials 9999, labyrinth_medals 9999, talent_orbs 998, treasure_level 9999, stage_clear_count 9999, itf_timed_score 9999, event_tickets 9999, treasure_chests 9999.
- **Cat selection** (`CatEditor.select`): options are all, current, obtainable, by id (0-based range input, max = cat count - 1), by name (substring match, then a multi-select of matches), by rarity (multi-select of rarity names), by gatya banner (by id from `GatyaDataSet` or by banner name), not unlocked, not obtainable, non-gacha, by game version (a version list with ranges like `12.2.0-12.3.0`), plus "finish". When the list is non-empty, an `and_mode_q` prompt chooses 1=AND (intersection), 2=OR (union, the default), 3=REPLACE. Any other value falls back to OR. `from_save_file` loops the selection until "finished_cats_selection" is yes.
- **Enemy selection** (`EnemyEditor.select`): valid enemies, all enemies, by id, by name, invalid enemies, with the same AND/OR/REPLACE prompt. Note: `select_id` subtracts 2 from the user-entered id and bounds the input by `len(enemy_guide)-1`. This looks like an off-by-2 quirk and is worth checking before porting.
- **Upgrade input grammar** (`core/game/catbase/upgrade.py:Upgrade.get_user_upgrade`): `base+plus`, with each part either a number (stored as level-1), a range `a-b` (random pick between), `max` (the max level), or blank (no change). Examples: `10+20`, `10+`, `+20`, `5-10+20-30`, `max+max`. With `DISABLE_MAXES`, max is 50000. The quit key returns an exit signal.
- **Talent levels** (`edit_talent_individual`): one prompt per talent, each bounded by that talent's max level.
- **Clear counts**: `EventChapters.ask_clear_amount` (max `stage_clear_count`, 9999 by default).

---

## 3. Per-feature details

Legend: "Writes" = save fields changed. "Data" = game-data pack/file downloaded (see section 5). Config flags referenced are in section 6.

### 3.1 save_management (`cli/save_management.py`, `cli/main.py`, `cli/server_cli.py`)

- **save_save** (`save_save`): if managed items exist (BackupMetaData, set by catfood/rare/platinum/legend edits), asks "upload_items_checker_confirm" and uploads them to the server. Then uses `save_path` or opens a save dialog. Writes binary SAVE_DATA. Input: a path (dialog). Edge: strict ban prevention is not applied here.
- **save_save_file** (`save_save_dialog`): same as save_save but always opens the dialog.
- **save_save_documents** (`save_save_data_dir`): writes to `SaveFile.get_save_path()` (the data folder `saves/SAVE_DATA`). No input.
- **save_upload** (`save_upload`): if `STRICT_BAN_PREVENTION` is on, creates a new account first. Then `ServerHandler.get_codes()`: uploads the save to the server and returns a transfer code plus a confirmation code. Also saves locally. On failure, prints upload_fail and saves locally. Server: nyanko-save / S3 (section 4).
- **adb_push / adb_push_rerun / root_push / root_push_rerun**: save locally, then push to a connected Android device (adb, WayDroid, or root) and optionally relaunch the game. Needs a device package name, chosen from the device's installed Battle Cats packages. Not browser-possible.
- **export_save** (`export_save`): `SaveFile.to_dict()` to JSON via save dialog. Writes JSON only.
- **load_save** (`load_save`): runs upload_items_checker first, then `select_save(starting_options=False)`. Sources: download by transfer code (`ServerCLI.download_save`), file dialog (binary), documents folder, adb/root pull from device (not browser), JSON import (`load_save_data_json`). On success, calls `save_file.load_save_file(new)` and `core_data.init_data()`.
- **convert_region** (`convert_save_cc`): shows the current cc, selects a CountryCode (en, jp, kr, tw), `save_file.set_cc(cc)`, then calls `ServerHandler.create_new_account()` (server call, which creates a new inquiry code), then `init_data()`. Browser: server-dependent.
- **convert_version** (`convert_save_gv`): asks for a version string, parsed by `GameVersion.from_string`. `save_file.set_gv(gv)`, then `init_data()`. Pure local. Invalid input prints invalid_game_version.
- **Detail on the load path** (`load_save_file_path`): auto-detects the cc by verifying the save's hash against each cc's salt (`battlecats{patching_code}`). If that fails it asks for the cc. Creates a backup copy under `saves/<date>` (MAX_BACKUPS config, default 50).
- **Downloading by transfer code** (`cli/server_cli.py:ServerCLI.download_save`): inputs are a transfer code (text), a confirmation code (text, sent as the PIN), and a country code (select). Game version is hard-coded to 120200 ("not important"). POST to `nyanko-save.ponosgames.com/v2/transfers/{transfer}/reception` with a clientInfo JSON (countryCode, version, device model SM-G955F). Writes the downloaded save to a file (dialog or default path). A jp/tw mixup hint is printed for invalid codes.

### 3.2 items (`cli/edits/basic_items.py` unless noted)

Every ticket edit (rare, platinum, legend, catfood) prints a ban-risk warning and records a managed item via `BackupMetaData.add_managed_item(ManagedItem.from_change(delta, type))`. Those managed items are then offered for server upload by save_save/load_save.

1. **catfood** (`edit_catfood`): yes/no warning first. Input: int, max 45000 (i32). Writes `catfood`. Managed item CATFOOD. Name from gatya item id 22. Data: `DataLocal/Gatyaitembuy.csv`, `resLocal/GatyaitemName.csv` (via gatya_item_names).
2. **xp** (`edit_xp`): int, max 99999999. Writes `xp`. Name from item id 6.
3. **normal_tickets** (`edit_normal_tickets`): int, max 2999. Writes `normal_tickets`. Item id 20.
4. **rare_tickets** (`edit_rare_tickets`): prints warning, then asks whether to use the safer rare-ticket-trade feature instead. If yes, goes to (5). Otherwise int, max 299. Writes `rare_tickets`. Managed item RARE_TICKET. Item id 21.
5. **rare_ticket_trade** (`edits/rare_ticket_trade.py:rare_ticket_trade`): input number to add, max = 299 - current. Needs a free cat storage slot (or one already holding special skill id 1). Sets the slot to special skill 1, then sets `gatya.trade_progress = to_add * 5`. No managed item. Message tells the user to trade in game.
6. **platinum_tickets** (`edit_platinum_tickets`): warning, then offer a safer route to platinum shards. Otherwise int, max 9. Writes `platinum_tickets`. Managed item PLATINUM_TICKET. Item id 29.
7. **legend_tickets** (`edit_legend_tickets`): yes/no warning, then int, max 4. Writes `legend_tickets`. Managed item LEGEND_TICKET. Item id 145.
8. **platinum_shards** (`edit_platinum_shards`): int. Max = `max(0, (plat_max - current_plat_tickets) * 10 + 9)`. Writes `platinum_shards`. Item id 157.
9. **np** (`edit_np`): int, max 9999. Writes `np`. Item id 7.
10. **leadership** (`edit_leadership`): int, i16 max 9999. Writes `leadership`. Item id 105.
11. **battle_items** (`BattleItems.edit`, `core/game/battle/battle_items.py`): one int per battle item in category 3 (labels from the item names), max 9999. Writes `battle_items.items[i].amount`. Group label from `shop_category1`.
12. **battle_items_endless** (`BattleItems.edit_endless_items`): multi-select endless items, then "individual" or "all at once". Input is a duration in minutes (decimal) or "infinity". Writes each item's endless duration via `set_duration_mins(val, 0)`. Invalid numbers print invalid_minute_count in the individual path.
13. **catseyes** (`edit_catseyes`): one int per catseye item (category 5), max 9999. Writes `catseyes` list.
14. **catfruit** (`edit_catfruit`): one int per Matatabi/catfruit slot. Max = `catfruit_old` (128, cumulative) if `game_version < 110400`, else `catfruit_new` (998). Writes `catfruit` list. Names from `core.Matatabi`. Extra slots get "unknown" names.
15. **talent_orbs** (`SaveOrbs.edit_talent_orbs`, `core/game/catbase/talent_orbs.py`): user enters a comma-separated list of selectors. Each selector can be a grade, an attribute, or an effect id, combined in one token. `*` selects all. The selected orbs are then edited individually or all at once, with max = `talent_orbs` (998). Writes `talent_orbs.orbs[orb_id]` (count) on save. Data: `DataLocal/equipmentlist.json`, `DataLocal/equipmentgrade.csv`, `resLocal/attribute_explonation.tsv`, `resLocal/equipment_explonation.tsv`.
16. **catamins** (`edit_catamins`): one int per catamin item (category 6), max 9999. Writes `catamins`.
17. **scheme_items** (`SchemeItems.edit`, `core/game/catbase/scheme_items.py`): a menu of scheme-item descriptions from `DataLocal/schemeItemData.tsv`. Gain = multi-select, which adds to `to_obtain` and removes from `received`. Remove = multi-select, which removes from both `to_obtain` and `received`.
18. **labyrinth_medals** (`edit_labyrinth_medals`): one int per medal (category 11), max 9999. Writes `labyrinth_medals`.
19. **100_million_tickets** (`edit_100_million_ticket`): prints a note that tickets only work during the active event. Int, max 9999. Writes `hundred_million_ticket`. Item id 212.
20. **event_tickets** (`edits/event_tickets.py:EventTickets.edit`): downloads `gatya.tsv` from the events server (JWT auth). Lists every event ticket with its time window, item name, and event message. Values are edited via `edit_ints_key` (max 9999). Writes `event_capsules[item.index]`, `lucky_tickets[item.index]`, or `event_capsules_2[item.index]`. Needs an account and network. Gacha option data: `DataLocal/GatyaData_Option_Set{N|R|E}.tsv`.
21. **treasure_chests** (`edit_treasure_chests`): one int per chest, limited to `len(save.treasure_chests)`, max 9999. Writes `treasure_chests`.
22. **reset_golden_cat_cpus** (`reset_golden_cat_cpus`): sets `golden_cpu_count = 0`. No input.

### 3.3 cats_special_skills

**Cat selection** is the same for all cat operations (section 2). Each operation below runs `from_save_file` first unless noted. Each operation also ends with `set_rank_up_sale`, which sets `save_file.rank_up_sale_value = 0x7FFFFFFF`. This is a side effect of any cat edit.

- **unlock_remove_cats** (`unlock_remove_cats_run`): choose unlock or remove. Unlock calls `Cat.unlock`, which sets `unlocked=1` and `gatya_seen=1`, unlocks the cat's drops, and calls `unlock_equip_menu`. Remove calls `Cat.remove(reset=RESET_CAT_DATA)`, which sets `unlocked=0`. If reset is on, it also resets upgrades, forms, talents, and catguide, and clears `chara_new_flags` and drops for the cat. Data: `resLocal/Unit_Explanation{N}_{lang}.csv` for names, `DataLocal/unitbuy.csv`, `DataLocal/nyankoPictureBookData.csv`.
- **upgrade_cats** (`upgrade_cats_run`): if one cat, `upgrade_individual`. If several, asks individual or all. Input is the upgrade grammar (section 2). The cap is from `PowerUpHelper.get_max_possible_base` and `get_max_possible_plus` per cat. "All" uses the max across the selection. Base level is simulated: `reset_upgrade` (base=0, catseyes_used=0), then `upgrade_by(base)`, which calls `upgrade_cat()` once per level and stops when the cat can't go further. Plus is set directly via `set_upgrade(only_plus=True)`. `UNLOCK_CAT_ON_EDIT` unlocks the cat. Data: `DataLocal/unitbuy.csv`, `DataLocal/unitlimit.csv`. Edge: `STRICT_UPGRADE` and user rank gate the max (section 6).
- **true_form_remove_form_cats** (`true_form_remove_form_cats_run`): "true_form_cats" or "remove_true_form_cats". Non-force true-form uses the picture-book `total_forms` per cat: 3+ forms gives true form, 2 forms sets unlocked_forms 0 and current_form 1, 1 form sets both to 0. Remove sets `unlocked_forms=0`, `current_form=min(current,1)`, `fourth_form=0`. `SET_CAT_CURRENT_FORMS` controls whether the current form also changes. Data: `DataLocal/nyankoPictureBookData.csv`.
- **force_true_form_cats** (`force_true_form_cats_run`): warning, then forces true form on the selected cats regardless of the picture book.
- **fourth_form_remove_form_cats** (`fourth_form_remove_form_cats_run`): "fourth_form_cats" (non-force: only if the picture-book entry has total_forms == 4, else behaves like the form logic above; sets `fourth_form=2`, `unlocked_forms=3`, `current_form=3` when applicable) or "remove_fourth_form_cats" (`current_form=min(,2)`, `fourth_form=0`).
- **force_fourth_form_cats** (`force_fourth_form_cats_run`): warning, then force 4th form.
- **upgrade_talents_remove_talents_cats** (`upgrade_talents_remove_talents_cats_run`): "upgrade_talent_cats" or "remove_talents_cats". Upgrade first checks that the game data version matches the save version. On mismatch it warns (talents_version_warning) and asks continue. Then one cat means individual (per-talent int prompts bounded by max level). Several cats means individual or all, where "all" sets every talent to its max level. Remove sets every talent level to 0. Data: `DataLocal/SkillLevel.csv`, `DataLocal/SkillAcquisition.csv`, `resLocal/SkillDescriptions.csv`.
- **unlock_remove_cat_guide** (`unlock_cat_guide_remove_guide_run`): "unlock_cat_guide" sets `catguide_collected=True` (and unlocks the cat if `UNLOCK_CAT_ON_EDIT`). "remove_cat_guide" sets it to False.

**special_skills** (`BasicItems.edit_special_skills` -> `SpecialSkills.edit`, `core/game/catbase/special_skill.py`): multi-select of special skills (gatya item category 2). One skill means an upgrade prompt bounded by that skill's `max_base_level - 1` and `max_plus_level`. Several skills means individual or all. The "all" path takes the max across abilities, or no cap if `DISABLE_MAXES`. Writes `special_skills` upgrade fields via `set_upgrade` (direct, not simulated). Data: `DataLocal/AbilityData.csv`. Skill names come from gatya item names category 2.

**cat_storage** (`edits/storage.py:edit_storage`): the storage has a fixed number of slots, each typed 0=empty, 1=cat, 2=special skill, 3=gatya item. Menu options:
- display_storage: prints slots and remaining free slots.
- clear_storage: empties every slot.
- add_cats: runs `from_save_file` to pick cats, then asks a quantity per cat (default 1, no max). Fails if the total exceeds free slots (too_many_cats_selected or need_x_more_space). Fills the first empty slots.
- add_special_skills: multi-select of skills, then a quantity per skill. Same free-slot checks.
- remove_items: multi-select of occupied slots to empty.
- finish.

### 3.4 levels (`edits/map.py` unless noted)

All chapter edits share one flow (`edits/map.py:edit_chapters`, `edit_chapters2_progress`, `edit_chapters2_clear_count`):
- **Edit progress (clear)**: select maps by name (multi-select). If more than one map: clear all at once, or handle individually. "All at once" asks one star count (the max across the selected maps, capped by `MapOption` crown count). For each map, unclears stars above the cap and marks every stage in stars 0..N-1 as cleared (`ensure_cleared_only=True`). "Individually" asks, per map, either clear whole chapter (star count input) or clear to a specific stage (stage name list, then star).
- **Edit progress (unclear)**: same flow with `allow_unclear=True`, so star 0 is allowed.
- **Edit clear counts**: select (map, star) pairs from a combined list. "All" asks one clear amount for every stage. "Individually" asks, per chapter, either a whole-chapter amount or specific stages (each stage individually, or all at once).

Each map uses these base indices and data (`letter_code` = map name file code):

- Story (`StoryChapters`, `core/game/map/story.py`): `clear_story` runs `edit_chapters`. Chapter multi-select, then "clear whole chapters" or "clear specific stages", then optional clear counts (per chapter, all, or per stage). Data: `resLocal/StageName_{chapter}_{lang}.csv`, `resLocal/StageName{chapter}_{lang}.csv`.
- Story treasures (`StoryChapters.edit_treasures`): chapters, then one of: whole chapters (treasure level for each), individual stages, or treasure groups. Treasure level max is 9999. Data: `DataLocal/treasureData0.csv`, `treasureData1.csv`, `treasureData2_0.csv` (group data), `resLocal/Treasure2_{lang}.csv`, `resLocal/Treasure3_*_{lang}.csv` (names).
- ITF timed scores (`edit_itf_timed_scores`): chapters 3, 4, 5 only (offset +3). Score input is a `min-max` range (or single) clamped to `itf_timed_score` (9999). Whole chapters or individual stages. Data: `StageName` files.
- Sol (type 0, `N`, base 0), event (type 1, `S`, base 1000), collab (type 2, `C`, base 2000). Event data is also in `EventChapters`.
- Gauntlets (`A`, base 24000), collab gauntlets (`CA`, 27000), behemoth culling (`Q`, 31000), clear enigma stages (`H`, 25000; `enigma_clears` chapters).
- Uncanny (`NA`, 13000). Catamin stages (`B`, 14000): two sub-flows. "change_clear_amount_catamin" sets `event_stages.chapter_completion_count[14000+map_id]` per map (individual or all at once, max 9999). "clear_unclear_stage_catamin" runs the chapter edit.
- Legend quest (`D`, 16000). Towers (`V`, 7000). Zero legends (`ND`, 34000). Dojo catclaw championships (`G`, 37000, no R prefix).
- Outbreaks (`Outbreaks.edit_outbreaks`, `core/game/map/outbreaks.py`): clear or unclear. Chapters from the save's outbreak chapters, then stage selection per chapter (or one shared stage list). Calls `clear_outbreak(chapter, stage, clear)`.
- Aku realm chapters (`AkuChapters.edit_aku_chapters`): chapter 0 stage progress (0..N). If progress > 1, asks per-stage counts or one count. Stage names from `StageNames(save, "DM", 49)`. Stages past progress are set to 0 clears.
- Unlock Aku Realm (`edits/aku_realm.py`): sets clear state on event stage ids [255, 256, 257, 258, 265, 266, 268] in map 1. No input.
- Challenge score (`challenge.py:edit_score`): one int (no max), `scores[0]`. Marks the challenge as shown and clears stage (0,0,0).
- Dojo score (`dojo.py:edit_score`): one int (no max) on stage (0,0). Writes `stage.score`.
- Add enigma stages (`enigma.py:edit_enigma`): lists enigma names (`resLocal` map names for base 25000). Shows current stages. Optional "wipe" resets every enigma stage's completion count and clears the list. Then multi-select to add. Each added stage is `Stage(3, id, 2, now)` with `chapter_completion_count[id] = 0`. The level 3 and star 2 values are hard-coded.
- Tower (`tower.py`): edits chapters with letter `V`, base 7000.
- Clear tutorial (`edits/clear_tutorial.py` -> `StoryChapters.clear_tutorial`): sets `tutorial_state >= 1`, `koreaSuperiorTreasureState >= 2`, `ui6 >= 1`, extends `new_dialogs_2` to at least 6 entries and sets index 1 to at least 2. No input.
- Filibuster reclearing (`allow_filibuster_stage_reclearing`): sets `filibuster_stage_enabled=True` and `filibuster_stage_id = random 0..47`.

### 3.5 gamototo

- **engineers** (`Ototo.edit_engineers`): int. Max = first value of `DataLocal/CastleCustomLimit.csv`, default 5 if the file is missing. Name from item id 92. Writes `ototo.engineers`.
- **base_materials** (`BaseMaterials.edit_base_materials`): one int per base material (category 7), max 9999. Writes `ototo.base_materials.materials`.
- **gamatoto_xp_level** (`Gamatoto.edit_xp`): shows current level from xp, then chooses raw xp (`edit_raw_xp`, not read in full) or level (`edit_level`, not read in full). Data: `DataLocal/GamatotoExpedition_Limit.csv`, `DataLocal/GamatotoExpedition.csv`.
- **gamatoto_helpers** (`Gamatoto.edit_helpers`): one int per rarity (cumulative max = total helpers from levels, or hidden if unknown). Generates helpers by cycling member ids within each rarity. Writes `gamatoto.helpers`. Data: `resLocal/GamatotoExpedition_Members_name_{lang}.csv`.
- **ototo_cat_cannon** (`Ototo.edit_cannon`): multi-select cannons (names from `CannonDescriptions`). If several cannons or any non-base cannon: choose "individual" or "all at once", then "development" or "level". Development is a choice of none/foundation/style/effect (skips cannon 0). Level: for all at once, one int per part (effect, improved foundation, improved style) with max from `CastleRecipeUnlock` per part. Writes `ototo.cannons`. Data: `DataLocal/CastleRecipeUnlock.csv`, `resLocal/CastleRecipeDescriptions.csv`.
- **cat_shrine** (`CatShrine.edit_catshrine`): prints current level and xp, then one of: shrine level (int 1..max, converted to xp), shrine xp (int 0..max_xp), make shrine appear (`appear()` resets stamps), make shrine disappear. Sets `shrine.dialogs = level - 1`. Data: `resLocal/jinja_level.csv`.

### 3.6 account

- **unban_account** (`SaveManagement.unban_account`): `ServerHandler.create_new_account()`. Gets a new inquiry code, clears stored auth/password/save-key, sets a fake password refresh token, then gets a new password and auth token. Updates managed items. Server: `auth_url`, `save_url`, `managed_item_url`.
- **upload_items** (`SaveManagement.upload_items`): if strict ban prevention is on, creates a new account first. Then `upload_meta_data()`: uploads the save data to S3 (form upload), then POSTs backup metadata to `nyanko-backups/v2/backups`. On success it clears managed items.
- **inquiry_code** (`edit_inquiry_code`): yes/no warning, then a free-text field (default from `autoSave_txt5`).
- **password_refresh_token** (`edit_password_refresh_token`): yes/no warning, then free text. Input length is not validated here.

### 3.7 gatya

- **rare_gatya_seed / normal_gatya_seed / event_gatya_seed** (`Gatya.edit_*_gatya_seed`): u32 with the max hidden. Writes `gatya.rare_seed`, `normal_seed`, `event_seed`.

### 3.8 fixes

- **fix_gamatoto_crash** (`Fixes.fix_gamatoto_crash`): sets `gamatoto.skin = 2`. No input.
- **fix_ototo_crash** (`Fixes.fix_ototo_crash`): replaces `ototo.cannons` with `Cannons.init(game_version)`. No input.
- **fix_time_errors** (`Fixes.fix_time_errors`): sets `date_3`, `timestamp`, and `energy_penalty_timestamp` to now. No input.
- **unlock_equip_menu** (`BasicItems.unlock_equip_menu` -> `SaveFile.unlock_equip_menu`): sets `menu_unlocks[2] = max(,1)`.
- **fix_officer_pass_crash** (`OfficerPass.fix_crash`): resets officer pass (cat_id=0, cat_form=0, play_time=0, removes gold pass).

### 3.9 other

- **unlocked_slots** (`Lineups.edit_unlocked_slots`): int, i8 max = `slot_names_length`. Writes `lineups.unlocked_slots`.
- **reset_gambling_events** (`GamblingEvent.reset_events`): resets wildcat slots and cat scratcher lottery (`completed`, `values`, `start_times`). No input.
- **restart_pack** (`BasicItems.set_restart_pack`): sets `restart_pack = 1`.
- **special_skills**: see section 3.3.
- **playtime** (`core/game/catbase/playtime.py:edit`): shows current play time, then hours, minutes, seconds (each an unbounded int). Writes `officer_pass.play_time` as frames.
- **enemy_guide** (`EnemyEditor.edit_enemy_guide`): selection as in section 2 (valid, all, id, name, invalid, with AND/OR/REPLACE). Then unlock or remove. Writes `enemy_guide[id] = 1` or `0`. Data: `DataLocal/enemy_dictionary_list.csv`, `resLocal/Enemyname.tsv`, `resLocal/EnemyPictureBook_{lang}.csv`.
- **user_rank_rewards** (`UserRankRewards.edit`): choose "claim", "unclaim", or "fix_claimed". Fix_claimed sets `claimed=False` for every reward whose threshold exceeds the save's user rank. Claim or unclaim shows the eligible rewards (threshold <= user rank, state matches the choice), then a multi-select. Writes `rewards[index].claimed`. Data: `DataLocal/rankGift.csv`, `resLocal/user_info.tsv`.
- **unlock_equip_menu**: see section 3.8.
- **gold_pass** (`NyankoClub.edit_gold_pass`): input officer id. Blank gives a random id. `-1` removes the gold pass. Any other value is parsed as an int (invalid gives random) and clamped to i32. Otherwise `get_gold_pass(id, 30, save)`.
- **medals** (`Medals.edit_medals`): choose add or remove. Add shows medals not yet owned, remove shows owned medals. Multi-select. Writes `medal_data_1` and `medal_data_2`. Data: `resLocal/medalname.tsv`.
- **missions** (`Missions.edit_missions`): lists missions that are in `clear_states`. Choose a claim state: complete_reward (state 2), complete_claim (state 4), or uncomplete (state 0). Multi-select. Sets `requirements[mission_id]` to the progress count (or 0 for uncomplete). Data: `DataLocal/Mission_Condition.csv`, `resLocal/Mission_Name.csv`.

### 3.10 editor

- **config** (`core/io/config.py:Config.edit_config`): edits the keys in section 6 (bool, int, str, locale, theme, game data repo).
- **update_external** (`core/__init__.py:update_external_content`): checks for a new BCSFE release (PyPI), then updates external themes and locales, then `init_data()`.
- **manage_game_data** (`core/__init__.py:manage_game_data`): pick a country code, list downloaded game-data versions for that region, add a version, remove all for the region, or remove one.

### 3.11 exit

- **exit** (`Main.exit_editor`): compares the current save bytes to `save_path`. If changed, asks "save_before_exit" (y/n) and saves. Otherwise prints no_changes and exits.

### 3.12 Runner behavior (`cli/feature_handler.py:select_features_run`)

- Before the loop: writes `save.temp`, runs clear_tutorial (no message), sets `show_ban_message=False`.
- Each feature: runs `do_save_actions()` (config CLEAR_TUTORIAL_ON_LOAD and REMOVE_BAN_MESSAGE_ON_LOAD), runs the feature, writes `save.temp` in a thread, and resets `core_data.game_data_getter` to None. Then it returns to the top menu.
- Search: typing text instead of a number does a fuzzy match over all aliases of every feature (ranked 100). Search results can be selected by number.

---

## 4. Save management: browser feasibility

| Feature | Pure browser? | Notes |
|---|---|---|
| Parse, edit, write binary save (all edits above) | Yes | Pure in-memory binary reader and writer (`core/io/save.py`, about 3600 lines). Port it, or run it as a WASM or server-side service. |
| Save hash / cc detection | Yes, with caveat | Hash algorithms: MD5, SHA1, SHA256, plus HMAC. WebCrypto has no MD5, so MD5 needs a JS library. |
| Load from file / save to file / export and import JSON | Yes | File API input, and Blob download for output. |
| Save to specific file / save to documents folder / backups | Replace | Use IndexedDB or a server store in place of the local data folder. |
| convert_region (creates account) | Server-dependent | Calls `create_new_account`. |
| convert_version | Yes | Local only. |
| save_upload (transfer code) | Server-dependent | POST to `nyanko-save` and S3. Needs CORS and the Dalvik user-agent header the CLI sends. Not verified against live endpoints. A backend proxy is likely needed. |
| load_save from transfer code (`download_save`) | Server-dependent | POST `/v2/transfers/{code}/reception`. Same CORS concern. |
| upload_items / unban_account / inquiry changes | Server-dependent | Auth and save-key flows on `nyanko-auth`, `nyanko-save`, `nyanko-backups`, `nyanko-managed-item`. |
| event_tickets | Server-dependent | Downloads `gatya.tsv` from `nyanko-events` with a JWT. |
| adb push / adb pull / root push / root pull / WayDroid | No | Needs a local device and `adb`, `su`, or WayDroid. Only possible from a desktop helper. |
| Game-data download (CDN / BCData repo) | Server-dependent | Fetches from `git.battlecatsmodding.org`, `raw.githubusercontent.com`, GitLab, and `nyanko-service-data-prd.s3.amazonaws.com`. Could be pre-bundled per cc and version, or proxied. |
| Check for updates / external themes and locales | Replace or drop | PyPI and external git repos. |
| Config file, recent saves, themes | Replace | Use browser storage. |

---

## 5. Game data files (pack/file) and which feature uses them

Pack naming: `resLocal` gets an `_{lang}` suffix only for the EN cc when the language is in the list. `DataLocal` is used as-is. Language suffixes are `{lang}`. Cached per cc and game version by `GameDataGetter`.

**DataLocal**
- `CastleCustomLimit.csv` - engineers max (gamototo)
- `CastleRecipeUnlock.csv` - cannon level limits (ototo)
- `GamatotoExpedition.csv`, `GamatotoExpedition_Limit.csv` - gamatoto levels
- `GatyaDataSetR1.csv` (only R1 is loaded), `GatyaData_Option_Set{N|R|E}.tsv` - gacha banners and event ticket options
- `Map_option.csv` - crown counts per map
- `Gatyaitembuy.csv` - item category, id, and index for all gatya items
- `schemeItemData.tsv` - scheme items
- `AbilityData.csv` - special skill upgrade limits
- `Mission_Condition.csv` - missions
- `rankGift.csv` - user rank rewards
- `unlockPopup.tsv`, `drop_chara.csv`, `Matatabi.tsv` - unlock popups, cat drops, catfruit names
- `unitbuy.csv`, `unitlimit.csv`, `nyankoPictureBookData.csv` - cat upgrades, forms, obtainability
- `SkillLevel.csv`, `SkillAcquisition.csv` - talents
- `enemy_dictionary_list.csv` - enemy guide
- `equipmentlist.json`, `equipmentgrade.csv` - talent orbs
- `treasureData0.csv`, `treasureData1.csv`, `treasureData2_0.csv` - treasure groups
- `GatyaDataSet*` family and `Treasure` files as noted above

**resLocal** (localized)
- `localizable.tsv` - general localized strings
- `GatyaitemName.csv` - gatya item names
- `Map_Name.csv`, `StageName_{R}{code}_{lang}.csv`, `StageName{chapter}_{lang}.csv` (story) - map and stage names
- `Treasure2_{lang}.csv`, `Treasure3_*_{lang}.csv` - treasure names
- `Mission_Name.csv`, `medalname.tsv`, `user_info.tsv` - names
- `SkillDescriptions.csv`, `attribute_explonation.tsv`, `equipment_explonation.tsv` - descriptions
- `Unit_Explanation{N}_{lang}.csv` - cat names
- `Enemyname.tsv`, `EnemyPictureBook_{lang}.csv` - enemy names
- `jinja_level.csv` - shrine levels
- `CastleRecipeDescriptions.csv` - cannon descriptions
- `GamatotoExpedition_Members_name_{lang}.csv` - gamatoto member names

**Events server** (`nyanko-events`, JWT): `gatya.tsv`, `item.tsv`, `sale.tsv`.

---

## 6. Config flags that change behavior

Defaults are from `core/io/config.py:get_defaults`.

- `DISABLE_MAXES` (False): removes or hides every max (MaxValue becomes 2^bits-1 and is hidden). Also changes upgrade caps (50000) and the special-skill "all" path.
- `UNLOCK_CAT_ON_EDIT` (True): edits that touch a cat unlock it first (set_form, set_upgrade, upgrade_base, talents, unlock_fourth_form).
- `RESET_CAT_DATA` (True): cat remove does a full reset.
- `SET_CAT_CURRENT_FORMS` (True): form edits also set `current_form`.
- `STRICT_UPGRADE` (False): upgrade caps depend on user rank and on claimed user-rank rewards. Non-strict uses 100000 and 1000000.
- `SEPARATE_CAT_EDIT_OPTIONS` (True): splits the cats menu into 8 operations (see section 1).
- `STRICT_BAN_PREVENTION` (False): creates a new account before upload or upload-items.
- `CLEAR_TUTORIAL_ON_LOAD` (True), `REMOVE_BAN_MESSAGE_ON_LOAD` (True): run each feature.
- `MAX_BACKUPS` (50), `MAX_REQUEST_TIMEOUT` (30), `GAME_DATA_REPO`, `FORCE_LANG_GAME_DATA`, `USE_FILE_DIALOG` (True), `ADB_PATH`, `USE_PKEXEC_WAYDROID`, `IGNORE_PARSE_ERROR`, `UPDATE_TO_BETA`, `LOCALE` ("en"), `THEME` ("default"), `SHOW_MISSING_LOCALE_KEYS` (False).

Warnings (bannable items): catfood, legend tickets, rare tickets, platinum tickets, and 100M tickets (event-only). Rare and platinum prompt the user toward the safer shard or trade features. Each ticket edit adds a managed item. Locale: `files/locales/en/edits/bannable_items.properties`.

---

## 7. Unused, duplicated, or not fully read

- `cli/edits/max_all.py` - a max-all helper. Every function body is commented out or unreferenced. Not in the menu.
- `cli/edits/max_all.py:max_catfruit` - commented out.
- `SaveManagement.init_save` - commented out in the menu. Core `SaveFile(cc, gv)` supports a fresh save, so a "create new save" feature is possible but not exposed.
- Duplicate menu entries: `special_skills` appears under cats_special_skills and other; `unlock_equip_menu` under fixes and other.
- `CatEditor.select_obtainable` - defined, not referenced.
- Read only partially: `core/game/map/event.py` ask_* prompts (`ask_stars`, `ask_stages`, `ask_clear_amount`), `chapters.clear_stage` internals (`ensure_cleared_only` semantics), `story.edit_chapter_progress` and `edit_stage_clear_count`, `gamatoto.edit_raw_xp` and `edit_level`, `ototo.edit_cannon_level` individual branch, and the "upgrade all" branch of special skills (dialog keys were cut off).
- `GatyaDataSet` constructs only the rare set (`GatyaDataSetR1.csv`), so gatya-banner-by-id selection uses rare-set rows only.

---

## 8. Suggested web-UI decomposition (brief)

- Pure core (no I/O): binary save model, the upgrade grammar parser, cat/enemy selection and AND/OR/REPLACE logic, and the per-feature mutations listed in section 3. These are the bulk of the work.
- Data layer: game-data loader (per cc and version, cached in IndexedDB or fetched through a backend), with the file names in section 5.
- Server layer: a backend proxy for auth, save upload and download, managed items, backups, events, and account creation. It also covers the CORS and user-agent issues in section 4.
- Not portable: adb, root, WayDroid push and pull.
- UI: the feature tree in section 1 maps directly to a navigable tree. Each leaf is a form with the input types in section 2. The search in `feature_handler` (fuzzy alias match) is worth keeping.
