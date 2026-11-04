/**
 * Port of class CoreData / module-level helpers from bcsfe/core/__init__.py
 *
 * `config`, `local_manager`, `max_value_manager` and `logger` are created lazily so that the many
 * circular imports (country_code <-> core_data <-> locale_handler ...) never touch them at module-eval time.
 * Game-data getters construct classes of other modules, which read game files synchronously: call
 * `await core_data.prepare_game_data(save)` once after loading a save and before using them.
 */
import type { SaveFile } from "@/lib/bcsfe/core/io/save";
import type { CountryCode } from "@/lib/bcsfe/core/country_code";
import type { GameVersion } from "@/lib/bcsfe/core/game_version";
import { Config } from "@/lib/bcsfe/core/io/config";
import { Logger } from "@/lib/bcsfe/core/log";
import { LocalManager } from "@/lib/bcsfe/core/locale_handler";
import { MaxValueHelper } from "@/lib/bcsfe/core/max_value_helper";
import { GameDataGetter, type ProgressCallback } from "@/lib/bcsfe/core/server/game_data_getter";
import { Localizable } from "@/lib/bcsfe/core/game/localizable";
import { GatyaItemBuy, GatyaItemNames } from "@/lib/bcsfe/core/game/catbase/gatya_item";
import { CharaDrop } from "@/lib/bcsfe/core/game/catbase/drop_chara";
import { GamatotoLevels, GamatotoMembersName } from "@/lib/bcsfe/core/game/gamoto/gamatoto";
import { AbilityData } from "@/lib/bcsfe/core/game/catbase/special_skill";
import { EnemyNames } from "@/lib/bcsfe/core/game/battle/enemy";
import { RankGiftDescriptions, RankGifts } from "@/lib/bcsfe/core/game/catbase/user_rank_rewards";
import { TreasureText } from "@/lib/bcsfe/core/game/map/story";
import { CatShrineLevels } from "@/lib/bcsfe/core/game/gamoto/cat_shrine";
import { MedalNames } from "@/lib/bcsfe/core/game/catbase/medals";
import { MissionConditions, MissionNames } from "@/lib/bcsfe/core/game/catbase/mission";

export class CoreData {
  private _config: Config | null = null;
  private _logger: Logger | null = null;
  private _local_manager: LocalManager | null = null;
  private _max_value_manager: MaxValueHelper | null = null;

  game_data_getter: GameDataGetter | null = null;
  gatya_item_names: GatyaItemNames | null = null;
  gatya_item_buy: GatyaItemBuy | null = null;
  chara_drop: CharaDrop | null = null;
  gamatoto_levels: GamatotoLevels | null = null;
  gamatoto_members_name: GamatotoMembersName | null = null;
  localizable: Localizable | null = null;
  abilty_data: AbilityData | null = null;
  enemy_names: EnemyNames | null = null;
  rank_gift_descriptions: RankGiftDescriptions | null = null;
  rank_gifts: RankGifts | null = null;
  treasure_text: TreasureText | null = null;
  cat_shrine_levels: CatShrineLevels | null = null;
  medal_names: MedalNames | null = null;
  mission_names: MissionNames | null = null;
  mission_conditions: MissionConditions | null = null;

  get config(): Config {
    if (this._config === null) this._config = new Config();
    return this._config;
  }

  get logger(): Logger {
    if (this._logger === null) this._logger = new Logger();
    return this._logger;
  }

  get local_manager(): LocalManager {
    if (this._local_manager === null) this._local_manager = new LocalManager();
    return this._local_manager;
  }

  get max_value_manager(): MaxValueHelper {
    if (this._max_value_manager === null) this._max_value_manager = MaxValueHelper.from_file();
    return this._max_value_manager;
  }

  set max_value_manager(v: MaxValueHelper) {
    this._max_value_manager = v;
  }

  /** Python `init_data()`: re-reads config / locale / max values. */
  init_data(): void {
    this._config = null;
    this._local_manager = null;
    this._max_value_manager = null;
    this.reset();
  }

  /** Call after the configured locale changed. */
  reload_locale(): void {
    this._local_manager = null;
  }

  /** Clears every cache that depends on the loaded save (call when a different save is loaded). */
  reset(): void {
    this.game_data_getter = null;
    this.gatya_item_names = null;
    this.gatya_item_buy = null;
    this.chara_drop = null;
    this.gamatoto_levels = null;
    this.gamatoto_members_name = null;
    this.localizable = null;
    this.abilty_data = null;
    this.enemy_names = null;
    this.rank_gift_descriptions = null;
    this.rank_gifts = null;
    this.treasure_text = null;
    this.cat_shrine_levels = null;
    this.medal_names = null;
    this.mission_names = null;
    this.mission_conditions = null;
  }

  get_game_data_getter(
    save: SaveFile | null = null,
    cc: CountryCode | null = null,
    gv: GameVersion | null = null,
  ): GameDataGetter {
    if (this.game_data_getter === null) {
      if (cc === null && save !== null) cc = save.cc;
      if (cc === null) throw new Error("cc must be provided if save is not provided");
      if (gv === null && save !== null) gv = save.game_version;
      if (gv === null) throw new Error("gv must be provided if save is not provided");
      this.game_data_getter = new GameDataGetter(cc, gv);
    }
    return this.game_data_getter;
  }

  /**
   * Creates the GameDataGetter for (save.cc, save.game_version) (replacing and resetting the caches
   * when they differ from the current one) and loads its game data into memory.
   * @returns true when game data is available.
   */
  async prepare_game_data(save: SaveFile, onProgress?: ProgressCallback): Promise<boolean> {
    const cur = this.game_data_getter;
    if (
      cur !== null &&
      (!cur.real_cc.equals(save.cc) || !cur.gv.eq(save.game_version) || !cur.is_prepared())
    ) {
      this.reset();
    }
    const gdg = this.get_game_data_getter(save);
    return gdg.prepare(onProgress);
  }

  get_gatya_item_names(save: SaveFile): GatyaItemNames {
    if (this.gatya_item_names === null) this.gatya_item_names = new GatyaItemNames(save);
    return this.gatya_item_names;
  }

  get_gatya_item_buy(save: SaveFile): GatyaItemBuy {
    if (this.gatya_item_buy === null) this.gatya_item_buy = new GatyaItemBuy(save);
    return this.gatya_item_buy;
  }

  get_chara_drop(save: SaveFile): CharaDrop {
    if (this.chara_drop === null) this.chara_drop = new CharaDrop(save);
    return this.chara_drop;
  }

  get_gamatoto_levels(save: SaveFile): GamatotoLevels {
    if (this.gamatoto_levels === null) this.gamatoto_levels = new GamatotoLevels(save);
    return this.gamatoto_levels;
  }

  get_gamatoto_members_name(save: SaveFile): GamatotoMembersName {
    if (this.gamatoto_members_name === null) this.gamatoto_members_name = new GamatotoMembersName(save);
    return this.gamatoto_members_name;
  }

  get_localizable(save: SaveFile): Localizable {
    if (this.localizable === null) this.localizable = new Localizable(save);
    return this.localizable;
  }

  get_ability_data(save: SaveFile): AbilityData {
    if (this.abilty_data === null) this.abilty_data = new AbilityData(save);
    return this.abilty_data;
  }

  get_enemy_names(save: SaveFile): EnemyNames {
    if (this.enemy_names === null) this.enemy_names = new EnemyNames(save);
    return this.enemy_names;
  }

  get_rank_gift_descriptions(save: SaveFile): RankGiftDescriptions {
    if (this.rank_gift_descriptions === null) this.rank_gift_descriptions = new RankGiftDescriptions(save);
    return this.rank_gift_descriptions;
  }

  get_rank_gifts(save: SaveFile): RankGifts {
    if (this.rank_gifts === null) this.rank_gifts = new RankGifts(save);
    return this.rank_gifts;
  }

  get_treasure_text(save: SaveFile): TreasureText {
    if (this.treasure_text === null) this.treasure_text = new TreasureText(save);
    return this.treasure_text;
  }

  get_cat_shrine_levels(save: SaveFile): CatShrineLevels {
    if (this.cat_shrine_levels === null) this.cat_shrine_levels = new CatShrineLevels(save);
    return this.cat_shrine_levels;
  }

  get_medal_names(save: SaveFile): MedalNames {
    if (this.medal_names === null) this.medal_names = new MedalNames(save);
    return this.medal_names;
  }

  get_mission_names(save: SaveFile): MissionNames {
    if (this.mission_names === null) this.mission_names = new MissionNames(save);
    return this.mission_names;
  }

  get_mission_conditions(save: SaveFile): MissionConditions {
    if (this.mission_conditions === null) this.mission_conditions = new MissionConditions(save);
    return this.mission_conditions;
  }

  get_lang(save: SaveFile): string {
    return this.get_localizable(save).get_lang() || "en";
  }
}

export const core_data = new CoreData();

// ---- module-level helpers from bcsfe/core/__init__.py

export function map_opt<T, R>(v: T | null | undefined, func: (v: T) => R): R | null {
  if (v === null || v === undefined) return null;
  return func(v);
}

export function consume<T>(_v1: null | undefined, v2: T): T {
  return v2;
}

export function first_tuple<T>(v: [T, unknown] | null | undefined): T | null {
  return map_opt(v, (x) => x[0]);
}

export { localize, localize_no_alias } from "@/lib/bcsfe/core/locale_handler";
