/**
 * Port of bcsfe/core/io/save.py
 *
 * The `SaveFile` class: parses / serialises the Battle Cats save format.
 * Filesystem-only parts of the Python original (paths, backups, threads) are
 * dropped; use `to_data()` / `to_bytes()` / `SaveFile.from_bytes()` instead.
 */
import { Data, base64ToBytes, bytesToBase64 } from "@/lib/bcsfe/core/io/data";
import {
  filled,
  mapToObject,
  objectToMap,
  times,
} from "@/lib/bcsfe/core/utils";
import { GameVersion } from "@/lib/bcsfe/core/game_version";
import { CountryCode, CountryCodeType } from "@/lib/bcsfe/core/country_code";
import { Hash, HashAlgorithm } from "@/lib/bcsfe/core/crypto";
import { core_data } from "@/lib/bcsfe/core/core_data";
import { BattleItems } from "@/lib/bcsfe/core/game/battle/battle_items";
import { ClearedSlots } from "@/lib/bcsfe/core/game/battle/cleared_slots";
import { LineUps } from "@/lib/bcsfe/core/game/battle/slots";
import { BeaconEventListScene } from "@/lib/bcsfe/core/game/catbase/beacon_base";
import { Cats } from "@/lib/bcsfe/core/game/catbase/cat";
import { GamblingEvent } from "@/lib/bcsfe/core/game/catbase/gambling";
import { Gatya } from "@/lib/bcsfe/core/game/catbase/gatya";
import { ItemPack } from "@/lib/bcsfe/core/game/catbase/item_pack";
import { LoginBonus } from "@/lib/bcsfe/core/game/catbase/login_bonuses";
import { Medals } from "@/lib/bcsfe/core/game/catbase/medals";
import { Missions } from "@/lib/bcsfe/core/game/catbase/mission";
import { MySale } from "@/lib/bcsfe/core/game/catbase/my_sale";
import { OfficerPass } from "@/lib/bcsfe/core/game/catbase/officer_pass";
import { SchemeItems } from "@/lib/bcsfe/core/game/catbase/scheme_items";
import { SpecialSkills } from "@/lib/bcsfe/core/game/catbase/special_skill";
import { StampData } from "@/lib/bcsfe/core/game/catbase/stamp";
import { TalentOrbs } from "@/lib/bcsfe/core/game/catbase/talent_orbs";
import { UnlockPopups } from "@/lib/bcsfe/core/game/catbase/unlock_popups";
import { UserRankRewards } from "@/lib/bcsfe/core/game/catbase/user_rank_rewards";
import { CatShrine } from "@/lib/bcsfe/core/game/gamoto/cat_shrine";
import { Gamatoto } from "@/lib/bcsfe/core/game/gamoto/gamatoto";
import { Ototo } from "@/lib/bcsfe/core/game/gamoto/ototo";
import { Localizable } from "@/lib/bcsfe/core/game/localizable";
import { AkuChapters } from "@/lib/bcsfe/core/game/map/aku";
import { ChallengeChapters } from "@/lib/bcsfe/core/game/map/challenge";
import { Dojo } from "@/lib/bcsfe/core/game/map/dojo";
import { Enigma } from "@/lib/bcsfe/core/game/map/enigma";
import { EventChapters } from "@/lib/bcsfe/core/game/map/event";
import { ExChapters } from "@/lib/bcsfe/core/game/map/ex_stage";
import { GauntletChapters } from "@/lib/bcsfe/core/game/map/gauntlets";
import { ItemRewardChapters } from "@/lib/bcsfe/core/game/map/item_reward_stage";
import { LegendQuestChapters } from "@/lib/bcsfe/core/game/map/legend_quest";
import { MapResets } from "@/lib/bcsfe/core/game/map/map_reset";
import { Outbreaks } from "@/lib/bcsfe/core/game/map/outbreaks";
import { StoryChapters } from "@/lib/bcsfe/core/game/map/story";
import { TimedScoreChapters } from "@/lib/bcsfe/core/game/map/timed_score";
import { TowerChapters } from "@/lib/bcsfe/core/game/map/tower";
import { UncannyChapters } from "@/lib/bcsfe/core/game/map/uncanny";
import { ZeroLegendsChapters } from "@/lib/bcsfe/core/game/map/zero_legends";

export const EDITOR_VERSION = "3.6.0";

type JsonObject = Record<string, unknown>;

/** Row of `uil10` (unknown game structure). */
export type Uil10Row = [
  number,
  number,
  boolean,
  boolean,
  boolean,
  number,
  number,
  number,
  boolean,
  boolean,
  boolean,
  string | null,
  boolean,
];

export class SaveError extends Error {
  cause?: unknown;
  constructor(message?: string, cause?: unknown) {
    super(message);
    this.name = new.target.name;
    this.cause = cause;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class CantDetectSaveCCError extends SaveError {}
export class SaveFileInvalid extends SaveError {}
export class FailedToLoadError extends SaveError {}
export class FailedToSaveError extends SaveError {}

function local_key(key: string): string {
  try {
    return core_data.local_manager.get_key(key);
  } catch {
    return key;
  }
}

/** `datetime.datetime(year, month, day, hour, minute, second)` (local time). */
function make_date(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
): Date {
  const d = new Date(0);
  d.setFullYear(year, month - 1, day);
  d.setHours(hour, minute, second, 0);
  return d;
}

/** Python `len()` for arrays / maps / strings. */
function len(x: { length: number } | Map<unknown, unknown>): number {
  return x instanceof Map ? x.size : x.length;
}

/** Pads a (possibly short) utl1 tuple with zeros, like the Python writer. */
function pad_tuple7(
  t: number[],
): [number, number, number, number, number, number, number] {
  const g = (i: number) => (t.length > i ? t[i] : 0);
  return [g(0), g(1), g(2), g(3), g(4), g(5), g(6)];
}

function jget<T>(data: JsonObject, key: string, def: T): T {
  const v = data[key];
  return v === undefined || v === null ? def : (v as T);
}

function rec<T>(data: JsonObject, key: string): Record<string, T> {
  return jget<Record<string, T>>(data, key, {});
}

/** Raw JSON handed to a game module's `deserialize` (their parameter types differ). */
function raw(data: JsonObject, key: string, def: unknown): never {
  return jget<unknown>(data, key, def) as never;
}

export class SaveFile {
  /** If true, a failing `load()` is swallowed (stored in `parse_error`) instead of throwing. */
  static ignore_parse_error = false;
  parse_error: unknown = null;

  package_name: string | null;
  localizable: Localizable | null = null;
  ubm1!: boolean;
  ubm!: boolean;
  ub0!: boolean;
  ub1!: boolean;
  ub2!: boolean;
  ub3!: boolean;
  ub4!: boolean;
  ub5!: boolean;
  ub6!: boolean;
  ub7!: boolean;
  ub8!: boolean;
  ub9!: boolean;
  ub10!: boolean;
  ub11!: boolean;
  ub12!: boolean;
  ub13!: boolean;
  ub15!: boolean;
  ub16!: boolean;
  ub17!: boolean;
  ub18!: boolean;
  ub19!: boolean;
  ub20!: boolean;
  ub21!: boolean;
  ub22!: boolean;
  ub23!: boolean;
  ub24!: boolean;
  ub25!: boolean;
  ub26!: boolean;
  ub27!: boolean;
  ub28!: boolean;
  ub29!: boolean;
  ub30!: boolean;
  ub31!: boolean;
  ub32!: boolean;
  ub33!: boolean;
  ub34!: boolean;
  ub35!: boolean;
  ub36!: boolean;
  ub37!: boolean;
  ub38!: boolean;
  ub39!: boolean;
  mute_bgm!: boolean;
  mute_se!: boolean;
  get_event_data!: boolean;
  energy_notification!: boolean;
  transfer_flag!: boolean;
  combo_unlocked_10k_ur!: boolean;
  show_ban_message!: boolean;
  shown_maxcollab_mg!: boolean;
  event_update_flags!: boolean;
  filibuster_stage_enabled!: boolean;
  dojo_3x_speed!: boolean;
  two_battle_lines!: boolean;
  uim1!: number;
  ui0!: number;
  ui1!: number;
  ui2!: number;
  ui3!: number;
  ui4!: number;
  ui5!: number;
  ui6!: number;
  ui7!: number;
  ui8!: number;
  ui9!: number;
  ui10!: number;
  ui11!: number;
  ui12!: number;
  ui13!: number;
  ui14!: number;
  ui15!: number;
  ui16!: number;
  ui17!: number;
  ui18!: number;
  ui19!: number;
  ui20!: number;
  ui21!: number;
  ui22!: number;
  ui23!: number;
  ui24!: number;
  catfood!: number;
  current_energy!: number;
  year!: number;
  month!: number;
  day!: number;
  stamp_value_save!: number;
  upgrade_state!: number;
  xp!: number;
  tutorial_state!: number;
  koreaSuperiorTreasureState!: number;
  unlock_enemy_guide!: number;
  cleared_eoc_1!: number;
  unlocked_ending!: number;
  stage_unlock_cat_value!: number;
  show_ending_value!: number;
  chapter_clear_cat_unlock!: number;
  ios_android_month!: number;
  normal_tickets!: number;
  rare_tickets!: number;
  itf1_ending!: number;
  continue_flag!: number;
  os_value!: number;
  full_gameversion!: number;
  backup_state!: number;
  itf1_complete!: number;
  title_chapter_bg!: number;
  rank_up_sale_value!: number;
  platinum_tickets!: number;
  backup_counter!: number;
  backup_frame!: number;
  cotc_1_complete!: number;
  np!: number;
  legend_tickets!: number;
  date_int!: number;
  platinum_shards!: number;
  sound_effects_volume!: number;
  background_music_volume!: number;
  hundred_million_ticket!: number;
  ud1!: number;
  ud2!: number;
  ud3!: number;
  ud4!: number;
  ud5!: number;
  ud6!: number;
  ud7!: number;
  ud8!: number;
  ud9!: number;
  ud10!: number;
  ud11!: number;
  ud12!: number;
  ud13!: number;
  ud14!: number;
  ud15!: number;
  ud16!: number;
  ud17!: number;
  ud18!: number;
  timestamp!: number;
  g_timestamp!: number;
  g_servertimestamp!: number;
  m_gettimesave!: number;
  g_timestamp_2!: number;
  g_servertimestamp_2!: number;
  m_gettimesave_2!: number;
  unknown_timestamp!: number;
  m_dGetTimeSave2!: number;
  m_dGetTimeSave3!: number;
  next_week_timestamp!: number;
  time_since_time_check_cumulative!: number;
  server_timestamp!: number;
  last_checked_energy_recovery_time!: number;
  time_since_check!: number;
  last_checked_expedition_time!: number;
  reward_remaining_time!: number;
  last_checked_reward_time!: number;
  last_checked_zombie_time!: number;
  energy_penalty_timestamp!: number;
  last_checked_castle_time!: number;
  date!: Date;
  date_2!: Date;
  date_3!: Date;
  date_4!: Date;
  uil1!: number[];
  uil2!: number[];
  uil3!: number[];
  uil4!: number[];
  stage_ids_10s!: number[];
  uil6!: number[];
  uil7!: number[];
  event_capsules_2!: number[];
  uil9!: number[];
  uil10!: Uil10Row[];
  uil11!: number[];
  treasure_chests!: number[];
  uil13!: number[];
  uiil1!: [number, number][];
  usl1!: string[];
  usl2!: string[];
  ustl1!: [string, string][];
  ubl1!: boolean[];
  ubl2!: boolean[];
  ubl3!: boolean[];
  ushl1!: number[];
  ushl2!: number[];
  ushl3!: number[];
  ushl4!: number[];
  ushl6!: number[];
  utl1!: [number, number, number, number, number, number, number][];
  utl3!: [number, bigint][];
  utl4!: [number, [number, number, number, number[]][]][];
  unlock_popups_11!: number[];
  enemy_guide!: number[];
  menu_unlocks!: number[];
  unlock_popups_0!: number[];
  new_dialogs_2!: number[];
  moneko_bonus!: number[];
  daily_reward_initialized!: number[];
  chara_flags!: number[];
  chara_flags_2!: number[];
  unlock_popups_8!: number[];
  unit_drops!: number[];
  achievements!: boolean[];
  order_ids!: string[];
  combo_unlocks!: number[];
  event_capsules!: number[];
  event_capsules_counter!: number[];
  gatya_seen_lucky_drops!: number[];
  catfood_beginner_purchased!: boolean[];
  catfood_beginner_expired!: boolean[];
  catfruit!: number[];
  catseyes!: number[];
  catamins!: number[];
  unlock_popups_6!: boolean[];
  reset_item_reward_flags!: boolean[];
  announcements!: [number, number][];
  lucky_tickets!: number[];
  labyrinth_medals!: number[];
  save_data_4_hash!: string;
  player_id!: string;
  transfer_code!: string;
  confirmation_code!: string;
  inquiry_code!: string;
  password_refresh_token!: string;
  uby1!: number;
  uby2!: number;
  uby3!: number;
  uby4!: number;
  uby5!: number;
  uby6!: number;
  uby7!: number;
  uby8!: number;
  uby9!: number;
  uby10!: number;
  uby11!: number;
  uby12!: number;
  golden_cpu_count!: number;
  uby14!: number;
  uby15!: number;
  uby16!: number;
  uby17!: number;
  uby18!: number;
  uby19!: number;
  uby20!: number;
  uby21!: number;
  has_account!: number;
  filibuster_stage_id!: number;
  restart_pack!: number;
  ush1!: number;
  ush2!: number;
  ush3!: number;
  ush4!: number;
  ush5!: number;
  ush6!: number;
  ush7!: number;
  ush8!: number;
  ush9!: number;
  ush10!: number;
  ush11!: number;
  ush12!: number;
  leadership!: number;
  lineups!: LineUps;
  stamp_data!: StampData;
  story!: StoryChapters;
  cats!: Cats;
  special_skills!: SpecialSkills;
  battle_items!: BattleItems;
  mysale!: MySale;
  event_stages!: EventChapters;
  gatya!: Gatya;
  user_rank_rewards!: UserRankRewards;
  item_reward_stages!: ItemRewardChapters;
  timed_score_stages!: TimedScoreChapters;
  officer_pass!: OfficerPass;
  gamatoto!: Gamatoto;
  ex_stages!: ExChapters;
  item_pack!: ItemPack;
  logins!: LoginBonus;
  dojo!: Dojo;
  outbreaks!: Outbreaks;
  scheme_items!: SchemeItems;
  unlock_popups!: UnlockPopups;
  ototo!: Ototo;
  beacon_base!: BeaconEventListScene;
  tower!: TowerChapters;
  missions!: Missions;
  challenge!: ChallengeChapters;
  map_resets!: MapResets;
  uncanny!: UncannyChapters;
  catamin_stages!: UncannyChapters;
  legend_quest!: LegendQuestChapters;
  medals!: Medals;
  gauntlets!: GauntletChapters;
  enigma_clears!: GauntletChapters;
  enigma!: Enigma;
  cleared_slots!: ClearedSlots;
  collab_gauntlets!: GauntletChapters;
  talent_orbs!: TalentOrbs;
  cat_shrine!: CatShrine;
  aku!: AkuChapters;
  behemoth_culling!: GauntletChapters;
  zero_legends!: ZeroLegendsChapters;
  dojo_chapters!: ZeroLegendsChapters;
  wildcat_slots!: GamblingEvent;
  cat_scratcher!: GamblingEvent;
  uiid1!: Map<number, number[]>;
  uidd1!: Map<number, number>;
  uidiid2!: Map<number, Map<number, number>>;
  ushdshd2!: Map<number, number[]>;
  ushdd!: Map<number, number>;
  ushdd2!: Map<number, number>;
  uidtii!: Map<number, [number, number]>;
  uidtff!: Map<number, [number, number]>;
  ushshd!: Map<number, number>;
  ustid1!: Map<string, [number, number]>;
  uiid3!: Map<number, number>;
  uidd2!: Map<number, number>;
  uidd3!: Map<number, number>;
  ushd1!: Map<number, [number, number, Map<number, number>]>;
  uild1!: Map<number, number[]>;
  ushd2!: Map<number, number>;
  uid1!: Map<number, number>;
  first_locks!: Map<number, boolean>;
  remaining_data!: Uint8Array;
  dsts!: boolean[];
  dst_index!: number;
  game_version!: GameVersion;
  cc!: CountryCode;
  data: Data;

  constructor(
    dt: Data | null = null,
    cc: CountryCode | null = null,
    load = true,
    gv: GameVersion | null = null,
    package_name: string | null = null,
  ) {
    this.package_name = package_name;
    if (dt === null) {
      this.data = new Data();
    } else {
      this.data = dt;
    }
    const detected_cc = this.detect_cc();
    if (detected_cc === null) {
      if (cc === null) {
        throw new CantDetectSaveCCError(local_key("cant_detect_cc"));
      }
      this.cc = cc;
    } else {
      this.cc = detected_cc;
    }

    this.localizable = null;

    this.init_save(gv);

    if (dt !== null && load) {
      this.load_wrapper();
    }
  }

  /** Convenience: parse raw save bytes. */
  static from_bytes(
    bytes: Uint8Array,
    cc: CountryCode | null = null,
  ): SaveFile {
    return new SaveFile(new Data(bytes), cc);
  }

  /** Serialise (including trailing hash) to raw bytes. */
  to_bytes(): Uint8Array {
    return this.to_data().data.slice();
  }

  get_localizable(): Localizable {
    if (this.localizable === null) {
      this.localizable = new Localizable(this);
    }
    return this.localizable;
  }

  load_save_file(other: SaveFile): void {
    this.data = other.data;
    this.cc = other.cc;
    this.game_version = other.game_version;
    this.init_save(other.game_version);
    this.load_wrapper();
  }

  detect_cc(): CountryCode | null {
    for (const cc of CountryCode.get_all()) {
      this.cc = cc;
      if (this.verify_hash()) {
        return cc;
      }
    }
    return null;
  }

  /** Salt used for hashing the save file. */
  get_salt(): string {
    return `battlecats${this.cc.get_patching_code()}`;
  }

  /** The hash stored at the end of the save file (null if not valid UTF-8). */
  get_current_hash(): string | null {
    this.data.reset_pos();
    if (this.data.length < 32) {
      return null;
    }
    this.data.set_pos(-32);
    try {
      return this.data.read_string(32);
    } catch {
      return null;
    }
  }

  get_new_hash(existing_hash = true): string {
    const salt = this.get_salt();
    this.data.reset_pos();
    let data_to_hash: Uint8Array;
    if (existing_hash) {
      data_to_hash = this.data.read_bytes(this.data.length - 32);
    } else {
      data_to_hash = this.data.read_bytes(this.data.length);
    }
    const salt_bytes = new TextEncoder().encode(salt);
    const salted = new Uint8Array(salt_bytes.length + data_to_hash.length);
    salted.set(salt_bytes, 0);
    salted.set(data_to_hash, salt_bytes.length);
    const hash = new Hash(HashAlgorithm.MD5).get_hash(new Data(salted));
    return hash.to_hex();
  }

  set_hash(add = false): void {
    const hash = this.get_new_hash(!add);
    if (!add) {
      // overwrite the existing trailing 32 byte hash
      this.data.set(this.data.slice(0, this.data.length - 32));
    }
    this.data.write_string(hash, false);
  }

  verify_hash(): boolean {
    const current_hash = this.get_current_hash();
    if (current_hash === null) {
      return false;
    }
    return current_hash === this.get_new_hash();
  }

  load_wrapper(): void {
    try {
      this.load();
    } catch (e) {
      if (!SaveFile.ignore_parse_error) {
        throw new FailedToLoadError(local_key("failed_to_load_save"), e);
      }
      this.parse_error = e;
    }
  }

  set_gv(gv: GameVersion): void {
    this.game_version = gv;
  }

  set_cc(cc: CountryCode): void {
    this.cc = cc;
    this.set_package_name(null);
  }

  set_package_name(package_name: string | null): void {
    this.package_name = package_name;
  }

  private assert_magic(expected: number): void {
    const got = this.data.read_int();
    if (got !== expected) {
      throw new SaveFileInvalid(
        `Expected marker ${expected} but got ${got} at position ${this.data.get_pos() - 4}`,
      );
    }
  }

  /** Load the save file. */
  load(): void {
    let length = 0;
    let length1 = 0;
    let length2 = 0;
    let length3 = 0;
    this.data.reset_pos();
    this.dst_index = 0;
    this.dsts = [];
    this.game_version = new GameVersion(this.data.read_int());
    if (this.game_version.ge(10) || this.not_jp()) {
      this.ub1 = this.data.read_bool();
    }
    this.mute_bgm = this.data.read_bool();
    this.mute_se = this.data.read_bool();
    this.catfood = this.data.read_int();
    this.current_energy = this.data.read_int();
    const year = this.data.read_int();
    this.year = this.data.read_int();
    const month = this.data.read_int();
    this.month = this.data.read_int();
    const day = this.data.read_int();
    this.day = this.data.read_int();
    this.timestamp = this.data.read_double();
    const hour = this.data.read_int();
    const minute = this.data.read_int();
    const second = this.data.read_int();
    this.read_dst();
    this.date = make_date(year, month, day, hour, minute, second);
    this.ui1 = this.data.read_int();
    this.stamp_value_save = this.data.read_int();
    this.ui2 = this.data.read_int();
    this.upgrade_state = this.data.read_int();
    this.xp = this.data.read_int();
    this.tutorial_state = this.data.read_int();
    this.ui3 = this.data.read_int();
    this.koreaSuperiorTreasureState = this.data.read_int();
    this.unlock_popups_11 = this.data.read_int_list(3);
    this.ui5 = this.data.read_int();
    this.unlock_enemy_guide = this.data.read_int();
    this.ui6 = this.data.read_int();
    this.ub0 = this.data.read_bool();
    this.ui7 = this.data.read_int();
    this.cleared_eoc_1 = this.data.read_int();
    this.ui8 = this.data.read_int();
    this.unlocked_ending = this.data.read_int();
    this.lineups = LineUps.read(this.data, this.game_version);
    this.stamp_data = StampData.read(this.data);
    this.story = StoryChapters.read(this.data);
    if (this.game_version.ge(20) && this.game_version.le(25)) {
      this.enemy_guide = this.data.read_int_list(231);
    } else {
      this.enemy_guide = this.data.read_int_list();
    }
    this.cats = Cats.read_unlocked(this.data, this.game_version);
    this.cats.read_upgrade(this.data, this.game_version);
    this.cats.read_current_form(this.data, this.game_version);
    this.special_skills = SpecialSkills.read_upgrades(this.data);
    if (this.game_version.le(25)) {
      this.menu_unlocks = this.data.read_int_list(5);
      this.unlock_popups_0 = this.data.read_int_list(5);
    } else if (this.game_version.eq(26)) {
      this.menu_unlocks = this.data.read_int_list(6);
      this.unlock_popups_0 = this.data.read_int_list(6);
    } else {
      this.menu_unlocks = this.data.read_int_list();
      this.unlock_popups_0 = this.data.read_int_list();
    }
    this.battle_items = BattleItems.read_items(this.data);
    if (this.game_version.le(26)) {
      this.new_dialogs_2 = this.data.read_int_list(17);
    } else {
      this.new_dialogs_2 = this.data.read_int_list();
    }
    this.uil1 = this.data.read_int_list(20);
    this.moneko_bonus = this.data.read_int_list(1);
    this.daily_reward_initialized = this.data.read_int_list(1);
    this.battle_items.read_locked_items(this.data);
    this.read_dst();
    this.date_2 = this.data.read_date();
    this.story.read_treasure_festival(this.data);
    this.read_dst();
    this.date_3 = this.data.read_date();
    if (this.game_version.le(37)) {
      this.ui0 = this.data.read_int();
    }
    this.stage_unlock_cat_value = this.data.read_int();
    this.show_ending_value = this.data.read_int();
    this.chapter_clear_cat_unlock = this.data.read_int();
    this.ui9 = this.data.read_int();
    this.ios_android_month = this.data.read_int();
    this.ui10 = this.data.read_int();
    this.save_data_4_hash = this.data.read_string();
    this.mysale = MySale.read_bonus_hash(this.data);
    this.chara_flags = this.data.read_int_list(2);
    if (this.game_version.le(37)) {
      this.uim1 = this.data.read_int();
      this.ubm1 = this.data.read_bool();
    }
    this.chara_flags_2 = this.data.read_int_list(2);
    this.normal_tickets = this.data.read_int();
    this.rare_tickets = this.data.read_int();
    this.cats.read_gatya_seen(this.data, this.game_version);
    this.special_skills.read_gatya_seen(this.data);
    this.cats.read_storage(this.data, this.game_version);
    this.event_stages = EventChapters.read(this.data, this.game_version);
    this.itf1_ending = this.data.read_int();
    this.continue_flag = this.data.read_int();
    if (this.game_version.ge(20)) {
      this.unlock_popups_8 = this.data.read_int_list(36);
    }
    if (this.game_version.ge(20) && this.game_version.le(25)) {
      this.unit_drops = this.data.read_int_list(110);
    } else if (this.game_version.ge(26)) {
      this.unit_drops = this.data.read_int_list();
    }
    this.gatya = Gatya.read_rare_normal_seed(this.data, this.game_version);
    this.get_event_data = this.data.read_bool();
    this.achievements = this.data.read_bool_list(7);
    this.os_value = this.data.read_int();
    this.read_dst();
    this.date_4 = this.data.read_date();
    this.gatya.read2(this.data);
    if (this.not_jp()) {
      this.player_id = this.data.read_string();
    }
    this.order_ids = this.data.read_string_list();
    if (this.not_jp()) {
      this.g_timestamp = this.data.read_double();
      this.g_servertimestamp = this.data.read_double();
      this.m_gettimesave = this.data.read_double();
      this.usl1 = this.data.read_string_list();
      this.energy_notification = this.data.read_bool();
      this.full_gameversion = this.data.read_int();
    }
    this.lineups.read_2(this.data, this.game_version);
    this.event_stages.read_legend_restrictions(this.data, this.game_version);
    if (this.game_version.le(37)) {
      this.uil2 = this.data.read_int_list(7);
      this.uil3 = this.data.read_int_list(7);
      this.uil4 = this.data.read_int_list(7);
    }
    this.g_timestamp_2 = this.data.read_double();
    this.g_servertimestamp_2 = this.data.read_double();
    this.m_gettimesave_2 = this.data.read_double();
    this.unknown_timestamp = this.data.read_double();
    this.gatya.read_trade_progress(this.data);
    if (this.game_version.le(37)) {
      this.usl2 = this.data.read_string_list();
    }
    if (this.not_jp()) {
      this.m_dGetTimeSave2 = this.data.read_double();
      this.ui11 = 0;
    } else {
      this.ui11 = this.data.read_int();
    }
    if (this.game_version.ge(20) && this.game_version.le(25)) {
      this.ubl1 = this.data.read_bool_list(12);
    } else if (this.game_version.ge(26) && this.game_version.lt(39)) {
      this.ubl1 = this.data.read_bool_list();
    }
    this.cats.read_max_upgrade_levels(this.data, this.game_version);
    this.special_skills.read_max_upgrade_levels(this.data);
    this.user_rank_rewards = UserRankRewards.read(this.data, this.game_version);
    if (!this.not_jp()) {
      this.m_dGetTimeSave2 = this.data.read_double();
    }
    this.cats.read_unlocked_forms(this.data, this.game_version);
    this.transfer_code = this.data.read_string();
    this.confirmation_code = this.data.read_string();
    this.transfer_flag = this.data.read_bool();
    if (this.game_version.ge(20)) {
      this.item_reward_stages = ItemRewardChapters.read(
        this.data,
        this.game_version,
      );
      this.timed_score_stages = TimedScoreChapters.read(
        this.data,
        this.game_version,
      );
      this.inquiry_code = this.data.read_string();
      this.officer_pass = OfficerPass.read(this.data);
      this.has_account = this.data.read_byte();
      this.backup_state = this.data.read_int();
      if (this.not_jp()) {
        this.ub2 = this.data.read_bool();
      }
      this.assert_magic(44);
      this.itf1_complete = this.data.read_int();
      this.story.read_itf_timed_scores(this.data);
      this.title_chapter_bg = this.data.read_int();
      if (this.game_version.gt(26)) {
        this.combo_unlocks = this.data.read_int_list();
      }
      this.combo_unlocked_10k_ur = this.data.read_bool();
      this.assert_magic(45);
    }
    if (this.game_version.ge(21)) {
      this.assert_magic(46);
      this.gatya.read_event_seed(this.data, this.game_version);
      if (this.game_version.lt(34)) {
        this.event_capsules = this.data.read_int_list(100);
        this.event_capsules_counter = this.data.read_int_list(100);
      } else {
        this.event_capsules = this.data.read_int_list();
        this.event_capsules_counter = this.data.read_int_list();
      }
      this.assert_magic(47);
    }
    if (this.game_version.ge(22)) {
      this.assert_magic(48);
    }
    if (this.game_version.ge(23)) {
      if (!this.not_jp()) {
        this.energy_notification = this.data.read_bool();
      }
      this.m_dGetTimeSave3 = this.data.read_double();
      if (this.game_version.lt(26)) {
        this.gatya_seen_lucky_drops = this.data.read_int_list(44);
      } else {
        this.gatya_seen_lucky_drops = this.data.read_int_list();
      }
      this.show_ban_message = this.data.read_bool();
      this.catfood_beginner_purchased = this.data.read_bool_list(3);
      this.next_week_timestamp = this.data.read_double();
      this.catfood_beginner_expired = this.data.read_bool_list(3);
      this.rank_up_sale_value = this.data.read_int();
      this.assert_magic(49);
    }
    if (this.game_version.ge(24)) {
      this.assert_magic(50);
    }
    if (this.game_version.ge(25)) {
      this.assert_magic(51);
    }
    if (this.game_version.ge(26)) {
      this.cats.read_catguide_collected(this.data);
      this.assert_magic(52);
    }
    if (this.game_version.ge(27)) {
      this.time_since_time_check_cumulative = this.data.read_double();
      this.server_timestamp = this.data.read_double();
      this.last_checked_energy_recovery_time = this.data.read_double();
      this.time_since_check = this.data.read_double();
      this.last_checked_expedition_time = this.data.read_double();
      this.catfruit = this.data.read_int_list();
      this.cats.read_fourth_forms(this.data);
      this.cats.read_catseyes_used(this.data);
      this.catseyes = this.data.read_int_list();
      this.catamins = this.data.read_int_list();
      this.gamatoto = Gamatoto.read(this.data);
      this.unlock_popups_6 = this.data.read_bool_list();
      this.ex_stages = ExChapters.read(this.data);
      this.assert_magic(53);
    }
    if (this.game_version.ge(29)) {
      this.gamatoto.read_2(this.data);
      this.assert_magic(54);
      this.item_pack = ItemPack.read(this.data);
      this.assert_magic(54);
    }
    if (this.game_version.ge(30)) {
      this.gamatoto.read_skin(this.data);
      this.platinum_tickets = this.data.read_int();
      this.logins = LoginBonus.read(this.data, this.game_version);
      if (this.game_version.lt(101000)) {
        this.reset_item_reward_flags = this.data.read_bool_list();
      }
      this.reward_remaining_time = this.data.read_double();
      this.last_checked_reward_time = this.data.read_double();
      this.announcements = this.data.read_int_tuple_list(16);
      this.backup_counter = this.data.read_int();
      this.ui12 = this.data.read_int();
      this.ui13 = this.data.read_int();
      this.ui14 = this.data.read_int();
      this.assert_magic(55);
    }
    if (this.game_version.ge(31)) {
      this.ub3 = this.data.read_bool();
      this.item_reward_stages.read_item_obtains(this.data);
      this.gatya.read_stepup(this.data);
      this.backup_frame = this.data.read_int();
      this.assert_magic(56);
    }
    if (this.game_version.ge(32)) {
      this.ub4 = this.data.read_bool();
      this.cats.read_favorites(this.data);
      this.assert_magic(57);
    }
    if (this.game_version.ge(33)) {
      this.dojo = Dojo.read_chapters(this.data);
      this.dojo.read_item_locks(this.data);
      this.assert_magic(58);
    }
    if (this.game_version.ge(34)) {
      this.last_checked_zombie_time = this.data.read_double();
      this.outbreaks = Outbreaks.read_chapters(this.data);
      this.outbreaks.read_2(this.data);
      this.scheme_items = SchemeItems.read(this.data);
    }
    if (this.game_version.ge(35)) {
      this.outbreaks.read_current_outbreaks(this.data, this.game_version);
      this.first_locks = this.data.read_int_bool_dict();
      this.energy_penalty_timestamp = this.data.read_double();
      this.assert_magic(60);
    }
    if (this.game_version.ge(36)) {
      this.cats.read_chara_new_flags(this.data);
      this.shown_maxcollab_mg = this.data.read_bool();
      this.item_pack.read_displayed_packs(this.data);
      this.assert_magic(61);
    }
    if (this.game_version.ge(38)) {
      this.unlock_popups = UnlockPopups.read(this.data);
      this.assert_magic(63);
    }
    if (this.game_version.ge(39)) {
      this.ototo = Ototo.read(this.data);
      this.ototo.read_2(this.data, this.game_version);
      this.last_checked_castle_time = this.data.read_double();
      this.assert_magic(64);
    }
    if (this.game_version.ge(40)) {
      this.beacon_base = BeaconEventListScene.read(this.data);
      this.assert_magic(65);
    }
    if (this.game_version.ge(41)) {
      this.tower = TowerChapters.read(this.data);
      this.missions = Missions.read(this.data, this.game_version);
      this.tower.read_item_obtain_states(this.data);
      this.assert_magic(66);
    }
    if (this.game_version.ge(42)) {
      this.dojo.read_ranking(this.data, this.game_version);
      this.item_pack.read_three_days(this.data);
      this.challenge = ChallengeChapters.read(this.data);
      this.challenge.read_scores(this.data);
      this.challenge.read_popup(this.data);
      this.assert_magic(67);
    }
    if (this.game_version.ge(43)) {
      this.missions.read_weekly_missions(this.data);
      this.dojo.ranking.read_did_win_rewards(this.data);
      this.event_update_flags = this.data.read_bool();
      this.assert_magic(68);
    }
    if (this.game_version.ge(44)) {
      this.event_stages.read_dicts(this.data);
      this.cotc_1_complete = this.data.read_int();
      this.assert_magic(69);
    }
    if (this.game_version.ge(46)) {
      this.gamatoto.read_collab_data(this.data);
      this.assert_magic(71);
    }
    if (this.game_version.lt(90300)) {
      this.map_resets = MapResets.read(this.data);
      this.assert_magic(72);
    }
    if (this.game_version.ge(51)) {
      this.uncanny = UncannyChapters.read(this.data);
      this.assert_magic(76);
    }
    if (this.game_version.ge(77)) {
      this.catamin_stages = UncannyChapters.read(this.data);
      this.lucky_tickets = this.data.read_int_list();
      this.ub5 = this.data.read_bool();
      this.assert_magic(77);
    }
    if (this.game_version.ge(80000)) {
      this.officer_pass.read_gold_pass(this.data, this.game_version);
      this.cats.read_talents(this.data);
      this.np = this.data.read_int();
      this.ub6 = this.data.read_bool();
      this.assert_magic(80000);
    }
    if (this.game_version.ge(80200)) {
      this.ub7 = this.data.read_bool();
      this.leadership = this.data.read_short();
      this.officer_pass.read_cat_data(this.data);
      this.assert_magic(80200);
    }
    if (this.game_version.ge(80300)) {
      this.filibuster_stage_id = this.data.read_byte();
      this.filibuster_stage_enabled = this.data.read_bool();
      this.assert_magic(80300);
    }
    if (this.game_version.ge(80500)) {
      this.stage_ids_10s = this.data.read_int_list();
      this.assert_magic(80500);
    }
    if (this.game_version.ge(80600)) {
      length = this.data.read_short();
      this.uil6 = this.data.read_int_list(length);
      this.legend_quest = LegendQuestChapters.read(this.data);
      this.ush1 = this.data.read_short();
      this.uby1 = this.data.read_byte();
      this.assert_magic(80600);
    }
    if (this.game_version.ge(80700)) {
      length = this.data.read_int();
      this.uiid1 = new Map();
      for (let _i = 0; _i < length; _i++) {
        const key = this.data.read_int();
        const value = this.data.read_int_list();
        this.uiid1.set(key, value);
      }
      this.assert_magic(80700);
    }
    if (this.game_version.ge(100600)) {
      if (this.is_en()) {
        this.uby2 = this.data.read_byte();
        this.assert_magic(100600);
      }
    }
    if (this.game_version.ge(81000)) {
      this.restart_pack = this.data.read_byte();
      this.assert_magic(81000);
    }
    if (this.game_version.ge(90000)) {
      this.medals = Medals.read(this.data);
      this.wildcat_slots = GamblingEvent.read(this.data, this.game_version);
      this.assert_magic(90000);
    }
    if (this.game_version.ge(90100)) {
      this.ush2 = this.data.read_short();
      this.ush3 = this.data.read_short();
      this.ui15 = this.data.read_int();
      this.ud1 = this.data.read_double();
      this.assert_magic(90100);
    }
    if (this.game_version.ge(90300)) {
      length = this.data.read_short();
      this.utl1 = [];
      for (let _i = 0; _i < length; _i++) {
        const i1 = this.data.read_int();
        const i2 = this.data.read_int();
        const i3 = this.data.read_short();
        const i4 = this.data.read_int();
        const i5 = this.data.read_int();
        const i6 = this.data.read_int();
        const i7 = this.data.read_short();
        this.utl1.push([i1, i2, i3, i4, i5, i6, i7]);
      }
      length = this.data.read_short();
      this.uidd1 = this.data.read_int_double_dict(length);
      this.gauntlets = GauntletChapters.read(this.data);
      this.assert_magic(90300);
    }
    if (this.game_version.ge(90400)) {
      this.enigma_clears = GauntletChapters.read(this.data);
      this.enigma = Enigma.read(this.data, this.game_version);
      this.cleared_slots = ClearedSlots.read(this.data);
      this.assert_magic(90400);
    }
    if (this.game_version.ge(90500)) {
      this.collab_gauntlets = GauntletChapters.read(this.data);
      this.ub8 = this.data.read_bool();
      this.ud2 = this.data.read_double();
      this.ud3 = this.data.read_double();
      this.ui16 = this.data.read_int();
      if (this.game_version.ge(100300)) {
        this.uby3 = this.data.read_byte();
        this.ub9 = this.data.read_bool();
        this.ud4 = this.data.read_double();
        this.ud5 = this.data.read_double();
      }
      if (this.game_version.ge(130700)) {
        length = this.data.read_short();
        this.uiid3 = new Map();
        for (let _i = 0; _i < length; _i++) {
          const key = this.data.read_int();
          const value = this.data.read_byte();
          this.uiid3.set(key, value);
        }
        length = this.data.read_short();
        this.uidd2 = new Map();
        for (let _i = 0; _i < length; _i++) {
          const key = this.data.read_int();
          const value = this.data.read_double();
          this.uidd2.set(key, value);
        }
      }
      if (this.game_version.ge(140100)) {
        length = this.data.read_short();
        this.uidd3 = new Map();
        for (let _i = 0; _i < length; _i++) {
          const key = this.data.read_int();
          const value = this.data.read_double();
          this.uidd3.set(key, value);
        }
      }
      this.assert_magic(90500);
    }
    if (this.game_version.ge(90700)) {
      this.talent_orbs = TalentOrbs.read(this.data, this.game_version);
      length = this.data.read_short();
      this.uidiid2 = new Map();
      for (let _i = 0; _i < length; _i++) {
        const key = this.data.read_short();
        const length_2 = this.data.read_byte();
        for (let _j = 0; _j < length_2; _j++) {
          const key2 = this.data.read_byte();
          const value = this.data.read_short();
          let inner = this.uidiid2.get(key);
          if (inner === undefined) {
            inner = new Map<number, number>();
            this.uidiid2.set(key, inner);
          }
          inner.set(key2, value);
        }
        if (length_2 === 0) {
          this.uidiid2.set(key, new Map<number, number>());
        }
      }
      this.ub10 = this.data.read_bool();
      this.assert_magic(90700);
    }
    if (this.game_version.ge(90800)) {
      length = this.data.read_short();
      this.uil7 = this.data.read_int_list(length);
      this.ubl2 = this.data.read_bool_list(10);
      this.assert_magic(90800);
    }
    if (this.game_version.ge(90900)) {
      this.cat_shrine = CatShrine.read(this.data);
      this.ud6 = this.data.read_double();
      this.ud7 = this.data.read_double();
      this.assert_magic(90900);
    }
    if (this.game_version.ge(91000)) {
      this.lineups.read_slot_names(this.data, this.game_version);
      this.assert_magic(91000);
    }
    if (this.game_version.ge(100000)) {
      this.legend_tickets = this.data.read_int();
      length = this.data.read_byte();
      this.uiil1 = [];
      for (let _i = 0; _i < length; _i++) {
        const i1 = this.data.read_byte();
        const i2 = this.data.read_int();
        this.uiil1.push([i1, i2]);
      }
      this.ub11 = this.data.read_bool();
      this.ub12 = this.data.read_bool();
      this.password_refresh_token = this.data.read_string();
      this.ub13 = this.data.read_bool();
      this.uby4 = this.data.read_byte();
      this.uby5 = this.data.read_byte();
      this.ud8 = this.data.read_double();
      this.ud9 = this.data.read_double();
      this.assert_magic(100000);
    }
    if (this.game_version.ge(100100)) {
      this.date_int = this.data.read_int();
      this.assert_magic(100100);
    }
    if (this.game_version.ge(100300)) {
      this.battle_items.read_endless_items(this.data);
      this.assert_magic(100300);
    }
    if (this.game_version.ge(100400)) {
      length = this.data.read_byte();
      this.event_capsules_2 = this.data.read_int_list(length);
      this.two_battle_lines = this.data.read_bool();
      this.assert_magic(100400);
    }
    if (this.game_version.ge(100600)) {
      this.ud10 = this.data.read_double();
      this.platinum_shards = this.data.read_int();
      this.ub15 = this.data.read_bool();
      this.assert_magic(100600);
    }
    if (this.game_version.ge(100700)) {
      this.cat_scratcher = GamblingEvent.read(this.data, this.game_version);
      this.assert_magic(100700);
    }
    if (this.game_version.ge(100900)) {
      this.aku = AkuChapters.read(this.data);
      this.ub16 = this.data.read_bool();
      this.ub17 = this.data.read_bool();
      length = this.data.read_short();
      this.ushdshd2 = new Map();
      for (let _i = 0; _i < length; _i++) {
        const key = this.data.read_short();
        const length_2 = this.data.read_short();
        for (let _j = 0; _j < length_2; _j++) {
          const value = this.data.read_short();
          let inner = this.ushdshd2.get(key);
          if (inner === undefined) {
            inner = [];
            this.ushdshd2.set(key, inner);
          }
          inner.push(value);
        }
        if (length_2 === 0) {
          this.ushdshd2.set(key, []);
        }
      }
      length = this.data.read_short();
      this.ushdd = new Map();
      for (let _i = 0; _i < length; _i++) {
        const key = this.data.read_short();
        const value = this.data.read_double();
        this.ushdd.set(key, value);
      }
      length = this.data.read_short();
      this.ushdd2 = new Map();
      for (let _i = 0; _i < length; _i++) {
        const key = this.data.read_short();
        const value = this.data.read_double();
        this.ushdd2.set(key, value);
      }
      this.ub18 = this.data.read_bool();
      this.assert_magic(100900);
    }
    if (this.game_version.ge(101000)) {
      this.uby6 = this.data.read_byte();
      this.assert_magic(101000);
    }
    if (this.game_version.ge(110000)) {
      length = this.data.read_short();
      this.uidtii = new Map();
      for (let _i = 0; _i < length; _i++) {
        const key = this.data.read_int();
        const value: [number, number] = [
          this.data.read_byte(),
          this.data.read_byte(),
        ];
        this.uidtii.set(key, value);
      }
      this.assert_magic(110000);
    }
    if (this.game_version.ge(110500)) {
      this.behemoth_culling = GauntletChapters.read(this.data);
      this.ub19 = this.data.read_bool();
      this.assert_magic(110500);
    }
    if (this.game_version.ge(110600)) {
      this.ub20 = this.data.read_bool();
      this.assert_magic(110600);
    }
    if (this.game_version.ge(110700)) {
      length = this.data.read_int();
      this.uidtff = new Map();
      for (let _i = 0; _i < length; _i++) {
        const key = this.data.read_int();
        const value: [number, number] = [
          this.data.read_double(),
          this.data.read_double(),
        ];
        this.uidtff.set(key, value);
      }
      if (this.not_jp()) {
        this.ub20 = this.data.read_bool();
      }
      this.assert_magic(110700);
    }
    if (this.game_version.ge(110800)) {
      this.cat_shrine.read_dialogs(this.data);
      this.ub21 = this.data.read_bool();
      this.dojo_3x_speed = this.data.read_bool();
      this.ub22 = this.data.read_bool();
      this.ub23 = this.data.read_bool();
      this.assert_magic(110800);
    }
    if (this.game_version.ge(111000)) {
      this.ui17 = this.data.read_int();
      this.ush4 = this.data.read_short();
      this.uby7 = this.data.read_byte();
      this.uby8 = this.data.read_byte();
      this.ub24 = this.data.read_bool();
      this.uby9 = this.data.read_byte();
      length = this.data.read_byte();
      this.ushl1 = this.data.read_short_list(length);
      length = this.data.read_short();
      this.ushl2 = this.data.read_short_list(length);
      length = this.data.read_short();
      this.ushl3 = this.data.read_short_list(length);
      this.ui18 = this.data.read_int();
      this.ui19 = this.data.read_int();
      this.ui20 = this.data.read_int();
      this.ush5 = this.data.read_short();
      this.ush6 = this.data.read_short();
      this.ush7 = this.data.read_short();
      this.ush8 = this.data.read_short();
      this.uby10 = this.data.read_byte();
      this.ub25 = this.data.read_bool();
      this.ub26 = this.data.read_bool();
      this.ub27 = this.data.read_bool();
      this.ub28 = this.data.read_bool();
      this.ub29 = this.data.read_bool();
      this.ub30 = this.data.read_bool();
      this.uby11 = this.data.read_byte();
      length = this.data.read_short();
      this.ushl4 = this.data.read_short_list(length);
      this.ubl3 = this.data.read_bool_list(14);
      length = this.data.read_byte();
      this.labyrinth_medals = this.data.read_short_list(length);
      this.assert_magic(111000);
    }
    if (this.game_version.ge(120000)) {
      this.zero_legends = ZeroLegendsChapters.read(this.data);
      this.uby12 = this.data.read_byte();
      this.assert_magic(120000);
    }
    if (this.game_version.ge(120100)) {
      length = this.data.read_short();
      this.ushl6 = this.data.read_short_list(length);
      this.assert_magic(120100);
    }
    if (this.game_version.ge(120200)) {
      this.ub31 = this.data.read_bool();
      this.ush9 = this.data.read_short();
      length = this.data.read_byte();
      this.ushshd = new Map();
      for (let _i = 0; _i < length; _i++) {
        const key = this.data.read_short();
        const value = this.data.read_short();
        this.ushshd.set(key, value);
      }
      this.assert_magic(120200);
    }
    if (this.game_version.ge(120400)) {
      this.ud11 = this.data.read_double();
      this.ud12 = this.data.read_double();
      this.assert_magic(120400);
    }
    if (this.game_version.ge(120500)) {
      this.ub32 = this.data.read_bool();
      this.ub33 = this.data.read_bool();
      this.ub34 = this.data.read_bool();
      this.ui21 = this.data.read_int();
      this.golden_cpu_count = this.data.read_byte();
      this.assert_magic(120500);
    }
    if (this.game_version.ge(120600)) {
      this.sound_effects_volume = this.data.read_byte();
      this.background_music_volume = this.data.read_byte();
      this.assert_magic(120600);
    }
    if (
      (this.not_jp() && this.game_version.ge(120700)) ||
      (this.is_jp() && this.game_version.ge(130000))
    ) {
      length = this.data.read_byte();
      this.ustl1 = [];
      for (let _i = 0; _i < length; _i++) {
        const s1 = this.data.read_string();
        const s2 = this.data.read_string();
        this.ustl1.push([s1, s2]);
      }
      if (this.not_jp()) {
        this.assert_magic(120700);
      } else {
        this.assert_magic(130000);
      }
    }
    if (this.game_version.ge(130100)) {
      length = this.data.read_int();
      this.utl3 = [];
      for (let _i = 0; _i < length; _i++) {
        const i1 = this.data.read_int();
        const i2 = this.data.read_long();
        this.utl3.push([i1, i2]);
      }
      this.assert_magic(130100);
    }
    if (this.game_version.ge(130301)) {
      length = this.data.read_int();
      this.ustid1 = new Map();
      for (let _i = 0; _i < length; _i++) {
        const key = this.data.read_string();
        const value_1 = this.data.read_int();
        const value_2 = this.data.read_double();
        this.ustid1.set(key, [value_1, value_2]);
      }
      this.assert_magic(130301);
    }
    if (this.game_version.ge(130400)) {
      this.ud13 = this.data.read_double();
      this.ud14 = this.data.read_double();
      this.assert_magic(130400);
    }
    if (this.game_version.ge(130500)) {
      this.utl4 = [];
      length1 = this.data.read_short();
      for (let _i = 0; _i < length1; _i++) {
        const id = this.data.read_byte();
        length2 = this.data.read_byte();
        const ls2: [number, number, number, number[]][] = [];
        for (let _i = 0; _i < length2; _i++) {
          const v1 = this.data.read_byte();
          const v2 = this.data.read_byte();
          const v3 = this.data.read_byte();
          length3 = this.data.read_short();
          const ls1: number[] = [];
          for (let _i = 0; _i < length3; _i++) {
            const val = this.data.read_short();
            ls1.push(val);
          }
          ls2.push([v1, v2, v3, ls1]);
        }
        this.utl4.push([id, ls2]);
      }
      this.assert_magic(130500);
    }
    if (this.game_version.ge(130600)) {
      this.uby14 = this.data.read_byte();
      if (this.not_jp()) {
        this.ush12 = this.data.read_short();
      }
      this.assert_magic(130600);
    }
    if (this.game_version.ge(130700)) {
      if (this.is_jp()) {
        this.ush12 = this.data.read_short();
      }
      this.ud15 = this.data.read_double();
      this.uby15 = this.data.read_byte();
      this.uby16 = this.data.read_byte();
      this.ush11 = this.data.read_short();
      this.uby17 = this.data.read_byte();
      this.uby18 = this.data.read_byte();
      this.uby19 = this.data.read_byte();
      this.ud16 = this.data.read_double();
      length1 = this.data.read_short();
      this.ushd1 = new Map();
      for (let _i = 0; _i < length1; _i++) {
        const key = this.data.read_short();
        const value = this.data.read_short();
        const value_2 = this.data.read_int();
        length2 = this.data.read_short();
        const data2 = new Map<number, number>();
        for (let _i = 0; _i < length2; _i++) {
          const key2 = this.data.read_short();
          const value3 = this.data.read_short();
          data2.set(key2, value3);
        }
        this.ushd1.set(key, [value, value_2, data2]);
      }
      this.assert_magic(130700);
    }
    if (this.game_version.ge(140000)) {
      this.ui22 = this.data.read_int();
      this.ud17 = this.data.read_double();
      this.uby20 = this.data.read_byte();
      length = this.data.read_byte();
      this.uild1 = new Map();
      for (let _i = 0; _i < length; _i++) {
        const key = this.data.read_int();
        length2 = this.data.read_byte();
        const data3: number[] = [];
        for (let _i = 0; _i < length2; _i++) {
          const value = this.data.read_byte();
          data3.push(value);
        }
        this.uild1.set(key, data3);
      }
      this.dojo_chapters = ZeroLegendsChapters.read(this.data);
      length = this.data.read_short();
      this.uil9 = [];
      for (let _i = 0; _i < length; _i++) {
        this.uil9.push(this.data.read_int());
      }
      this.ub35 = this.data.read_bool();
      this.ud18 = this.data.read_double();
      length = this.data.read_short();
      this.ushd2 = new Map();
      for (let _i = 0; _i < length; _i++) {
        const key = this.data.read_short();
        const value = this.data.read_byte();
        this.ushd2.set(key, value);
      }
      this.assert_magic(140000);
    }
    if (this.game_version.ge(140100) && this.game_version.lt(140500)) {
      this.uby21 = this.data.read_byte();
      this.assert_magic(140100);
    }
    if (this.game_version.ge(140200)) {
      length = this.data.read_byte();
      this.uil10 = [];
      for (let _i = 0; _i < length; _i++) {
        const val_1 = this.data.read_int();
        const val_2 = this.data.read_int();
        const val_3 = this.data.read_bool();
        const val_4 = this.data.read_bool();
        const val_5 = this.data.read_bool();
        const val_6 = this.data.read_int();
        const val_7 = this.data.read_int();
        const val_8 = this.data.read_int();
        const val_9 = this.data.read_bool();
        const val_10 = this.data.read_bool();
        const val_11 = this.data.read_bool();
        let val_12: string | null = null;
        if (this.game_version.ge(140500)) {
          // game seems to read more than just this, may break in the future
          val_12 = this.data.read_string();
        }
        const val_13 = this.data.read_bool();
        this.uil10.push([
          val_1,
          val_2,
          val_3,
          val_4,
          val_5,
          val_6,
          val_7,
          val_8,
          val_9,
          val_10,
          val_11,
          val_12,
          val_13,
        ]);
      }
      length = this.data.read_byte();
      this.uid1 = new Map();
      for (let _i = 0; _i < length; _i++) {
        const key = this.data.read_int();
        const value = this.data.read_double();
        this.uid1.set(key, value);
      }
      this.hundred_million_ticket = this.data.read_int();
      this.assert_magic(140200);
    }
    if (this.game_version.ge(140300)) {
      length = this.data.read_byte();
      this.uil11 = [];
      for (let _i = 0; _i < length; _i++) {
        const val = this.data.read_byte();
        this.uil11.push(val);
      }
      if (this.game_version.ge(150300)) {
        this.ui24 = this.data.read_int();
        this.ub38 = this.data.read_bool();
      }
      if (this.game_version.ge(150500)) {
        this.ub39 = this.data.read_bool();
      }
      this.ub36 = this.data.read_bool();
      length = this.data.read_byte();
      this.treasure_chests = [];
      for (let _i = 0; _i < length; _i++) {
        const value = this.data.read_int();
        this.treasure_chests.push(value);
      }
      this.ui23 = this.data.read_int();
      length = this.data.read_short();
      this.uil13 = [];
      for (let _i = 0; _i < length; _i++) {
        this.uil13.push(this.data.read_int());
      }
      this.ub37 = this.data.read_bool();
      this.assert_magic(140300);
    }
    this.remaining_data = this.data.read_to_end(32);
  }

  save(data: Data): void {
    this.data = data;
    this.dst_index = 0;
    this.data.clear();
    this.data.enable_buffer();
    this.data.write_int(this.game_version.game_version);
    if (this.game_version.ge(10) || this.not_jp()) {
      this.data.write_bool(this.ub1);
    }
    this.data.write_bool(this.mute_bgm);
    this.data.write_bool(this.mute_se);
    this.data.write_int(this.catfood);
    this.data.write_int(this.current_energy);
    this.data.write_int(this.date.getFullYear());
    this.data.write_int(this.year);
    this.data.write_int(this.date.getMonth() + 1);
    this.data.write_int(this.month);
    this.data.write_int(this.date.getDate());
    this.data.write_int(this.day);
    this.data.write_double(this.timestamp);
    this.data.write_int(this.date.getHours());
    this.data.write_int(this.date.getMinutes());
    this.data.write_int(this.date.getSeconds());
    this.write_dst();
    this.data.write_int(this.ui1);
    this.data.write_int(this.stamp_value_save);
    this.data.write_int(this.ui2);
    this.data.write_int(this.upgrade_state);
    this.data.write_int(this.xp);
    this.data.write_int(this.tutorial_state);
    this.data.write_int(this.ui3);
    this.data.write_int(this.koreaSuperiorTreasureState);
    this.data.write_int_list(this.unlock_popups_11, false, 3);
    this.data.write_int(this.ui5);
    this.data.write_int(this.unlock_enemy_guide);
    this.data.write_int(this.ui6);
    this.data.write_bool(this.ub0);
    this.data.write_int(this.ui7);
    this.data.write_int(this.cleared_eoc_1);
    this.data.write_int(this.ui8);
    this.data.write_int(this.unlocked_ending);
    this.lineups.write(this.data, this.game_version);
    this.stamp_data.write(this.data);
    this.story.write(this.data);
    if (this.game_version.ge(20) && this.game_version.le(25)) {
      this.data.write_int_list(this.enemy_guide, false, 231);
    } else {
      this.data.write_int_list(this.enemy_guide);
    }
    this.cats.write_unlocked(this.data, this.game_version);
    this.cats.write_upgrade(this.data, this.game_version);
    this.cats.write_current_form(this.data, this.game_version);
    this.special_skills.write_upgrades(this.data);
    if (this.game_version.le(25)) {
      this.data.write_int_list(this.menu_unlocks, false, 5);
      this.data.write_int_list(this.unlock_popups_0, false, 5);
    } else if (this.game_version.le(26)) {
      this.data.write_int_list(this.menu_unlocks, false, 6);
      this.data.write_int_list(this.unlock_popups_0, false, 6);
    } else {
      this.data.write_int_list(this.menu_unlocks);
      this.data.write_int_list(this.unlock_popups_0);
    }
    this.battle_items.write_items(this.data);
    if (this.game_version.le(26)) {
      this.data.write_int_list(this.new_dialogs_2, false, 17);
    } else {
      this.data.write_int_list(this.new_dialogs_2);
    }
    this.data.write_int_list(this.uil1, false, 20);
    this.data.write_int_list(this.moneko_bonus, false, 1);
    this.data.write_int_list(this.daily_reward_initialized, false, 1);
    this.battle_items.write_locked_items(this.data);
    this.write_dst();
    this.data.write_date(this.date_2);
    this.story.write_treasure_festival(this.data);
    this.write_dst();
    this.data.write_date(this.date_3);
    if (this.game_version.le(37)) {
      this.data.write_int(this.ui0);
    }
    this.data.write_int(this.stage_unlock_cat_value);
    this.data.write_int(this.show_ending_value);
    this.data.write_int(this.chapter_clear_cat_unlock);
    this.data.write_int(this.ui9);
    this.data.write_int(this.ios_android_month);
    this.data.write_int(this.ui10);
    this.data.write_string(this.save_data_4_hash);
    this.mysale.write_bonus_hash(this.data);
    this.data.write_int_list(this.chara_flags, false, 2);
    if (this.game_version.le(37)) {
      this.data.write_int(this.uim1);
      this.data.write_bool(this.ubm1);
    }
    this.data.write_int_list(this.chara_flags_2, false, 2);
    this.data.write_int(this.normal_tickets);
    this.data.write_int(this.rare_tickets);
    this.cats.write_gatya_seen(this.data, this.game_version);
    this.special_skills.write_gatya_seen(this.data);
    this.cats.write_storage(this.data, this.game_version);
    this.event_stages.write(this.data, this.game_version);
    this.data.write_int(this.itf1_ending);
    this.data.write_int(this.continue_flag);
    if (this.game_version.ge(20)) {
      this.data.write_int_list(this.unlock_popups_8, false, 36);
    }
    if (this.game_version.ge(20) && this.game_version.le(25)) {
      this.data.write_int_list(this.unit_drops, false, 110);
    } else if (this.game_version.ge(26)) {
      this.data.write_int_list(this.unit_drops);
    }
    this.gatya.write_rare_normal_seed(this.data);
    this.data.write_bool(this.get_event_data);
    this.data.write_bool_list(this.achievements, false, 7);
    this.data.write_int(this.os_value);
    this.write_dst();
    this.data.write_date(this.date_4);
    this.gatya.write2(this.data);
    if (this.not_jp()) {
      this.data.write_string(this.player_id);
    }
    this.data.write_string_list(this.order_ids);
    if (this.not_jp()) {
      this.data.write_double(this.g_timestamp);
      this.data.write_double(this.g_servertimestamp);
      this.data.write_double(this.m_gettimesave);
      this.data.write_string_list(this.usl1);
      this.data.write_bool(this.energy_notification);
      this.data.write_int(this.full_gameversion);
    }
    this.lineups.write_2(this.data, this.game_version);
    this.event_stages.write_legend_restrictions(this.data, this.game_version);
    if (this.game_version.le(37)) {
      this.data.write_int_list(this.uil2, false, 7);
      this.data.write_int_list(this.uil3, false, 7);
      this.data.write_int_list(this.uil4, false, 7);
    }
    this.data.write_double(this.g_timestamp_2);
    this.data.write_double(this.g_servertimestamp_2);
    this.data.write_double(this.m_gettimesave_2);
    this.data.write_double(this.unknown_timestamp);
    this.gatya.write_trade_progress(this.data);
    if (this.game_version.le(37)) {
      this.data.write_string_list(this.usl2);
    }
    if (this.not_jp()) {
      this.data.write_double(this.m_dGetTimeSave2);
    } else {
      this.data.write_int(this.ui11);
    }
    if (this.game_version.ge(20) && this.game_version.le(25)) {
      this.data.write_bool_list(this.ubl1, false, 12);
    } else if (this.game_version.ge(26) && this.game_version.lt(39)) {
      this.data.write_bool_list(this.ubl1);
    }
    this.cats.write_max_upgrade_levels(this.data, this.game_version);
    this.special_skills.write_max_upgrade_levels(this.data);
    this.user_rank_rewards.write(this.data, this.game_version);
    if (this.is_jp()) {
      this.data.write_double(this.m_dGetTimeSave2);
    }
    this.cats.write_unlocked_forms(this.data, this.game_version);
    this.data.write_string(this.transfer_code);
    this.data.write_string(this.confirmation_code);
    this.data.write_bool(this.transfer_flag);
    if (this.game_version.ge(20)) {
      this.item_reward_stages.write(this.data, this.game_version);
      this.timed_score_stages.write(this.data, this.game_version);
      this.data.write_string(this.inquiry_code);
      this.officer_pass.write(this.data);
      this.data.write_byte(this.has_account);
      this.data.write_int(this.backup_state);
      if (this.not_jp()) {
        this.data.write_bool(this.ub2);
      }
      this.data.write_int(44);
      this.data.write_int(this.itf1_complete);
      this.story.write_itf_timed_scores(this.data);
      this.data.write_int(this.title_chapter_bg);
      if (this.game_version.gt(26)) {
        this.data.write_int_list(this.combo_unlocks);
      }
      this.data.write_bool(this.combo_unlocked_10k_ur);
      this.data.write_int(45);
    }
    if (this.game_version.ge(21)) {
      this.data.write_int(46);
      this.gatya.write_event_seed(this.data);
      if (this.game_version.lt(34)) {
        this.data.write_int_list(this.event_capsules, false, 100);
        this.data.write_int_list(this.event_capsules_counter, false, 100);
      } else {
        this.data.write_int_list(this.event_capsules);
        this.data.write_int_list(this.event_capsules_counter);
      }
      this.data.write_int(47);
    }
    if (this.game_version.ge(22)) {
      this.data.write_int(48);
    }
    if (this.game_version.ge(23)) {
      if (this.is_jp()) {
        this.data.write_bool(this.energy_notification);
      }
      this.data.write_double(this.m_dGetTimeSave3);
      if (this.game_version.lt(26)) {
        this.data.write_int_list(this.gatya_seen_lucky_drops, false, 44);
      } else {
        this.data.write_int_list(this.gatya_seen_lucky_drops);
      }
      this.data.write_bool(this.show_ban_message);
      this.data.write_bool_list(this.catfood_beginner_purchased, false, 3);
      this.data.write_double(this.next_week_timestamp);
      this.data.write_bool_list(this.catfood_beginner_expired, false, 3);
      this.data.write_int(this.rank_up_sale_value);
      this.data.write_int(49);
    }
    if (this.game_version.ge(24)) {
      this.data.write_int(50);
    }
    if (this.game_version.ge(25)) {
      this.data.write_int(51);
    }
    if (this.game_version.ge(26)) {
      this.cats.write_catguide_collected(this.data);
      this.data.write_int(52);
    }
    if (this.game_version.ge(27)) {
      this.data.write_double(this.time_since_time_check_cumulative);
      this.data.write_double(this.server_timestamp);
      this.data.write_double(this.last_checked_energy_recovery_time);
      this.data.write_double(this.time_since_check);
      this.data.write_double(this.last_checked_expedition_time);
      this.data.write_int_list(this.catfruit);
      this.cats.write_fourth_forms(this.data);
      this.cats.write_catseyes_used(this.data);
      this.data.write_int_list(this.catseyes);
      this.data.write_int_list(this.catamins);
      this.gamatoto.write(this.data);
      this.data.write_bool_list(this.unlock_popups_6);
      this.ex_stages.write(this.data);
      this.data.write_int(53);
    }
    if (this.game_version.ge(29)) {
      this.gamatoto.write_2(this.data);
      this.data.write_int(54);
      this.item_pack.write(this.data);
      this.data.write_int(54);
    }
    if (this.game_version.ge(30)) {
      this.gamatoto.write_skin(this.data);
      this.data.write_int(this.platinum_tickets);
      this.logins.write(this.data, this.game_version);
      if (this.game_version.lt(101000)) {
        this.data.write_bool_list(this.reset_item_reward_flags);
      }
      this.data.write_double(this.reward_remaining_time);
      this.data.write_double(this.last_checked_reward_time);
      this.data.write_int_tuple_list(this.announcements, false, 16);
      this.data.write_int(this.backup_counter);
      this.data.write_int(this.ui12);
      this.data.write_int(this.ui13);
      this.data.write_int(this.ui13);
      this.data.write_int(55);
    }
    if (this.game_version.ge(31)) {
      this.data.write_bool(this.ub3);
      this.item_reward_stages.write_item_obtains(this.data);
      this.gatya.write_stepup(this.data);
      this.data.write_int(this.backup_frame);
      this.data.write_int(56);
    }
    if (this.game_version.ge(32)) {
      this.data.write_bool(this.ub4);
      this.cats.write_favorites(this.data);
      this.data.write_int(57);
    }
    if (this.game_version.ge(33)) {
      this.dojo.write_chapters(this.data);
      this.dojo.write_item_locks(this.data);
      this.data.write_int(58);
    }
    if (this.game_version.ge(34)) {
      this.data.write_double(this.last_checked_zombie_time);
      this.outbreaks.write_chapters(this.data);
      this.outbreaks.write_2(this.data);
      this.scheme_items.write(this.data);
    }
    if (this.game_version.ge(35)) {
      this.outbreaks.write_current_outbreaks(this.data, this.game_version);
      this.data.write_int_bool_dict(this.first_locks);
      this.data.write_double(this.energy_penalty_timestamp);
      this.data.write_int(60);
    }
    if (this.game_version.ge(36)) {
      this.cats.write_chara_new_flags(this.data);
      this.data.write_bool(this.shown_maxcollab_mg);
      this.item_pack.write_displayed_packs(this.data);
      this.data.write_int(61);
    }
    if (this.game_version.ge(38)) {
      this.unlock_popups.write(this.data);
      this.data.write_int(63);
    }
    if (this.game_version.ge(39)) {
      this.ototo.write(this.data);
      this.ototo.write_2(this.data, this.game_version);
      this.data.write_double(this.last_checked_castle_time);
      this.data.write_int(64);
    }
    if (this.game_version.ge(40)) {
      this.beacon_base.write(this.data);
      this.data.write_int(65);
    }
    if (this.game_version.ge(41)) {
      this.tower.write(this.data);
      this.missions.write(this.data, this.game_version);
      this.tower.write_item_obtain_states(this.data);
      this.data.write_int(66);
    }
    if (this.game_version.ge(42)) {
      this.dojo.write_ranking(this.data, this.game_version);
      this.item_pack.write_three_days(this.data);
      this.challenge.write(this.data);
      this.challenge.write_scores(this.data);
      this.challenge.write_popup(this.data);
      this.data.write_int(67);
    }
    if (this.game_version.ge(43)) {
      this.missions.write_weekly_missions(this.data);
      this.dojo.ranking.write_did_win_rewards(this.data);
      this.data.write_bool(this.event_update_flags);
      this.data.write_int(68);
    }
    if (this.game_version.ge(44)) {
      this.event_stages.write_dicts(this.data);
      this.data.write_int(this.cotc_1_complete);
      this.data.write_int(69);
    }
    if (this.game_version.ge(46)) {
      this.gamatoto.write_collab_data(this.data);
      this.data.write_int(71);
    }
    if (this.game_version.lt(90300)) {
      this.map_resets.write(this.data);
      this.data.write_int(72);
    }
    if (this.game_version.ge(51)) {
      this.uncanny.write(this.data);
      this.data.write_int(76);
    }
    if (this.game_version.ge(77)) {
      this.catamin_stages.write(this.data);
      this.data.write_int_list(this.lucky_tickets);
      this.data.write_bool(this.ub5);
      this.data.write_int(77);
    }
    if (this.game_version.ge(80000)) {
      this.officer_pass.write_gold_pass(this.data, this.game_version);
      this.cats.write_talents(this.data);
      this.data.write_int(this.np);
      this.data.write_bool(this.ub6);
      this.data.write_int(80000);
    }
    if (this.game_version.ge(80200)) {
      this.data.write_bool(this.ub7);
      this.data.write_short(this.leadership);
      this.officer_pass.write_cat_data(this.data);
      this.data.write_int(80200);
    }
    if (this.game_version.ge(80300)) {
      this.data.write_byte(this.filibuster_stage_id);
      this.data.write_bool(this.filibuster_stage_enabled);
      this.data.write_int(80300);
    }
    if (this.game_version.ge(80500)) {
      this.data.write_int_list(this.stage_ids_10s);
      this.data.write_int(80500);
    }
    if (this.game_version.ge(80600)) {
      this.data.write_short(len(this.uil6));
      this.data.write_int_list(this.uil6, false);
      this.legend_quest.write(this.data);
      this.data.write_short(this.ush1);
      this.data.write_byte(this.uby1);
      this.data.write_int(80600);
    }
    if (this.game_version.ge(80700)) {
      this.data.write_int(len(this.uiid1));
      for (const [key, value] of this.uiid1) {
        this.data.write_int(key);
        this.data.write_int_list(value);
      }
      this.data.write_int(80700);
    }
    if (this.game_version.ge(100600)) {
      if (this.is_en()) {
        this.data.write_byte(this.uby2);
        this.data.write_int(100600);
      }
    }
    if (this.game_version.ge(81000)) {
      this.data.write_byte(this.restart_pack);
      this.data.write_int(81000);
    }
    if (this.game_version.ge(90000)) {
      this.medals.write(this.data);
      this.wildcat_slots.write(this.data, this.game_version);
      this.data.write_int(90000);
    }
    if (this.game_version.ge(90100)) {
      this.data.write_short(this.ush2);
      this.data.write_short(this.ush3);
      this.data.write_int(this.ui15);
      this.data.write_double(this.ud1);
      this.data.write_int(90100);
    }
    if (this.game_version.ge(90300)) {
      this.data.write_short(len(this.utl1));
      for (const tuple_ of this.utl1) {
        const [i1, i2, i3, i4, i5, i6, i7] = pad_tuple7(tuple_);
        this.data.write_int(i1);
        this.data.write_int(i2);
        this.data.write_short(i3);
        this.data.write_int(i4);
        this.data.write_int(i5);
        this.data.write_int(i6);
        this.data.write_short(i7);
      }
      this.data.write_short(len(this.uidd1));
      this.data.write_int_double_dict(this.uidd1, false);
      this.gauntlets.write(this.data);
      this.data.write_int(90300);
    }
    if (this.game_version.ge(90400)) {
      this.enigma_clears.write(this.data);
      this.enigma.write(this.data, this.game_version);
      this.cleared_slots.write(this.data);
      this.data.write_int(90400);
    }
    if (this.game_version.ge(90500)) {
      this.collab_gauntlets.write(this.data);
      this.data.write_bool(this.ub8);
      this.data.write_double(this.ud2);
      this.data.write_double(this.ud3);
      this.data.write_int(this.ui16);
      if (this.game_version.ge(100300)) {
        this.data.write_byte(this.uby3);
        this.data.write_bool(this.ub9);
        this.data.write_double(this.ud4);
        this.data.write_double(this.ud5);
      }
      if (this.game_version.ge(130700)) {
        this.data.write_short(len(this.uiid3));
        for (const [key, value] of this.uiid3) {
          this.data.write_int(key);
          this.data.write_byte(value);
        }
        this.data.write_short(len(this.uidd2));
        for (const [key, value] of this.uidd2) {
          this.data.write_int(key);
          this.data.write_double(value);
        }
      }
      if (this.game_version.ge(140100)) {
        this.data.write_short(len(this.uidd3));
        for (const [key, value] of this.uidd3) {
          this.data.write_int(key);
          this.data.write_double(value);
        }
      }
      this.data.write_int(90500);
    }
    if (this.game_version.ge(90700)) {
      this.talent_orbs.write(this.data, this.game_version);
      this.data.write_short(len(this.uidiid2));
      for (const [key, value] of this.uidiid2) {
        this.data.write_short(key);
        this.data.write_byte(len(value));
        for (const [key2, value2] of value) {
          this.data.write_byte(key2);
          this.data.write_short(value2);
        }
      }
      this.data.write_bool(this.ub10);
      this.data.write_int(90700);
    }
    if (this.game_version.ge(90800)) {
      this.data.write_short(len(this.uil7));
      this.data.write_int_list(this.uil7, false);
      this.data.write_bool_list(this.ubl2, false, 10);
      this.data.write_int(90800);
    }
    if (this.game_version.ge(90900)) {
      this.cat_shrine.write(this.data);
      this.data.write_double(this.ud6);
      this.data.write_double(this.ud7);
      this.data.write_int(90900);
    }
    if (this.game_version.ge(91000)) {
      this.lineups.write_slot_names(this.data, this.game_version);
      this.data.write_int(91000);
    }
    if (this.game_version.ge(100000)) {
      this.data.write_int(this.legend_tickets);
      this.data.write_byte(len(this.uiil1));
      for (const [key, value] of this.uiil1) {
        this.data.write_byte(key);
        this.data.write_int(value);
      }
      this.data.write_bool(this.ub11);
      this.data.write_bool(this.ub12);
      this.data.write_string(this.password_refresh_token);
      this.data.write_bool(this.ub13);
      this.data.write_byte(this.uby4);
      this.data.write_byte(this.uby5);
      this.data.write_double(this.ud8);
      this.data.write_double(this.ud9);
      this.data.write_int(100000);
    }
    if (this.game_version.ge(100100)) {
      this.data.write_int(this.date_int);
      this.data.write_int(100100);
    }
    if (this.game_version.ge(100300)) {
      this.battle_items.write_endless_items(this.data);
      this.data.write_int(100300);
    }
    if (this.game_version.ge(100400)) {
      this.data.write_byte(len(this.event_capsules_2));
      this.data.write_int_list(this.event_capsules_2, false);
      this.data.write_bool(this.two_battle_lines);
      this.data.write_int(100400);
    }
    if (this.game_version.ge(100600)) {
      this.data.write_double(this.ud10);
      this.data.write_int(this.platinum_shards);
      this.data.write_bool(this.ub15);
      this.data.write_int(100600);
    }
    if (this.game_version.ge(100700)) {
      this.cat_scratcher.write(this.data, this.game_version);
      this.data.write_int(100700);
    }
    if (this.game_version.ge(100900)) {
      this.aku.write(this.data);
      this.data.write_bool(this.ub16);
      this.data.write_bool(this.ub17);
      this.data.write_short(len(this.ushdshd2));
      for (const [key, value] of this.ushdshd2) {
        this.data.write_short(key);
        this.data.write_short(len(value));
        for (const item of value) {
          this.data.write_short(item);
        }
      }
      this.data.write_short(len(this.ushdd));
      for (const [key, value] of this.ushdd) {
        this.data.write_short(key);
        this.data.write_double(value);
      }
      this.data.write_short(len(this.ushdd2));
      for (const [key, value] of this.ushdd2) {
        this.data.write_short(key);
        this.data.write_double(value);
      }
      this.data.write_bool(this.ub18);
      this.data.write_int(100900);
    }
    if (this.game_version.ge(101000)) {
      this.data.write_byte(this.uby6);
      this.data.write_int(101000);
    }
    if (this.game_version.ge(110000)) {
      this.data.write_short(len(this.uidtii));
      for (const [key, value] of this.uidtii) {
        this.data.write_int(key);
        this.data.write_byte(value[0]);
        this.data.write_byte(value[1]);
      }
      this.data.write_int(110000);
    }
    if (this.game_version.ge(110500)) {
      this.behemoth_culling.write(this.data);
      this.data.write_bool(this.ub19);
      this.data.write_int(110500);
    }
    if (this.game_version.ge(110600)) {
      this.data.write_bool(this.ub20);
      this.data.write_int(110600);
    }
    if (this.game_version.ge(110700)) {
      this.data.write_int(len(this.uidtff));
      for (const [key, value] of this.uidtff) {
        this.data.write_int(key);
        this.data.write_double(value[0]);
        this.data.write_double(value[1]);
      }
      if (this.not_jp()) {
        this.data.write_bool(this.ub20);
      }
      this.data.write_int(110700);
    }
    if (this.game_version.ge(110800)) {
      this.cat_shrine.write_dialogs(this.data);
      this.data.write_bool(this.ub21);
      this.data.write_bool(this.dojo_3x_speed);
      this.data.write_bool(this.ub22);
      this.data.write_bool(this.ub23);
      this.data.write_int(110800);
    }
    if (this.game_version.ge(111000)) {
      this.data.write_int(this.ui17);
      this.data.write_short(this.ush4);
      this.data.write_byte(this.uby7);
      this.data.write_byte(this.uby8);
      this.data.write_bool(this.ub24);
      this.data.write_byte(this.uby9);
      this.data.write_byte(len(this.ushl1));
      this.data.write_short_list(this.ushl1, false);
      this.data.write_short(len(this.ushl2));
      this.data.write_short_list(this.ushl2, false);
      this.data.write_short(len(this.ushl3));
      this.data.write_short_list(this.ushl3, false);
      this.data.write_int(this.ui18);
      this.data.write_int(this.ui19);
      this.data.write_int(this.ui20);
      this.data.write_short(this.ush5);
      this.data.write_short(this.ush6);
      this.data.write_short(this.ush7);
      this.data.write_short(this.ush8);
      this.data.write_byte(this.uby10);
      this.data.write_bool(this.ub25);
      this.data.write_bool(this.ub26);
      this.data.write_bool(this.ub27);
      this.data.write_bool(this.ub28);
      this.data.write_bool(this.ub29);
      this.data.write_bool(this.ub30);
      this.data.write_byte(this.uby11);
      this.data.write_short(len(this.ushl4));
      this.data.write_short_list(this.ushl4, false);
      this.data.write_bool_list(this.ubl3, false, 14);
      this.data.write_byte(len(this.labyrinth_medals));
      this.data.write_short_list(this.labyrinth_medals, false);
      this.data.write_int(111000);
    }
    if (this.game_version.ge(120000)) {
      this.zero_legends.write(this.data);
      this.data.write_byte(this.uby12);
      this.data.write_int(120000);
    }
    if (this.game_version.ge(120100)) {
      this.data.write_short(len(this.ushl6));
      this.data.write_short_list(this.ushl6, false);
      this.data.write_int(120100);
    }
    if (this.game_version.ge(120200)) {
      this.data.write_bool(this.ub31);
      this.data.write_short(this.ush9);
      this.data.write_byte(len(this.ushshd));
      for (const [key, value] of this.ushshd) {
        this.data.write_short(key);
        this.data.write_short(value);
      }
      this.data.write_int(120200);
    }
    if (this.game_version.ge(120400)) {
      this.data.write_double(this.ud11);
      this.data.write_double(this.ud12);
      this.data.write_int(120400);
    }
    if (this.game_version.ge(120500)) {
      this.data.write_bool(this.ub32);
      this.data.write_bool(this.ub33);
      this.data.write_bool(this.ub34);
      this.data.write_int(this.ui21);
      this.data.write_byte(this.golden_cpu_count);
      this.data.write_int(120500);
    }
    if (this.game_version.ge(120600)) {
      this.data.write_byte(this.sound_effects_volume);
      this.data.write_byte(this.background_music_volume);
      this.data.write_int(120600);
    }
    if (
      (this.not_jp() && this.game_version.ge(120700)) ||
      (this.is_jp() && this.game_version.ge(130000))
    ) {
      this.data.write_byte(len(this.ustl1));
      for (const [str1, str2] of this.ustl1) {
        this.data.write_string(str1);
        this.data.write_string(str2);
      }
      if (this.not_jp()) {
        this.data.write_int(120700);
      } else {
        this.data.write_int(130000);
      }
    }
    if (this.game_version.ge(130100)) {
      this.data.write_int(len(this.utl3));
      for (const [i, long] of this.utl3) {
        this.data.write_int(i);
        this.data.write_long(long);
      }
      this.data.write_int(130100);
    }
    if (this.game_version.ge(130301)) {
      this.data.write_int(len(this.ustid1));
      for (const [key, [v1, v2]] of this.ustid1) {
        this.data.write_string(key);
        this.data.write_int(v1);
        this.data.write_double(v2);
      }
      this.data.write_int(130301);
    }
    if (this.game_version.ge(130400)) {
      this.data.write_double(this.ud13);
      this.data.write_double(this.ud14);
      this.data.write_int(130400);
    }
    if (this.game_version.ge(130500)) {
      this.data.write_short(len(this.utl4));
      for (const [id, ls2] of this.utl4) {
        this.data.write_byte(id);
        this.data.write_byte(len(ls2));
        for (const [v1, v2, v3, ls1] of ls2) {
          this.data.write_byte(v1);
          this.data.write_byte(v2);
          this.data.write_byte(v3);
          this.data.write_short(len(ls1));
          for (const val of ls1) {
            this.data.write_short(val);
          }
        }
      }
      this.data.write_int(130500);
    }
    if (this.game_version.ge(130600)) {
      this.data.write_byte(this.uby14);
      if (this.not_jp()) {
        this.data.write_short(this.ush12);
      }
      this.data.write_int(130600);
    }
    if (this.game_version.ge(130700)) {
      if (this.is_jp()) {
        this.data.write_short(this.ush12);
      }
      this.data.write_double(this.ud15);
      this.data.write_byte(this.uby15);
      this.data.write_byte(this.uby16);
      this.data.write_short(this.ush11);
      this.data.write_byte(this.uby17);
      this.data.write_byte(this.uby18);
      this.data.write_byte(this.uby19);
      this.data.write_double(this.ud16);
      this.data.write_short(len(this.ushd1));
      for (const [key, [value, value_2, data_2]] of this.ushd1) {
        this.data.write_short(key);
        this.data.write_short(value);
        this.data.write_int(value_2);
        this.data.write_short(len(data_2));
        for (const [key2, value3] of data_2) {
          this.data.write_short(key2);
          this.data.write_short(value3);
        }
      }
      this.data.write_int(130700);
    }
    if (this.game_version.ge(140000)) {
      this.data.write_int(this.ui22);
      this.data.write_double(this.ud17);
      this.data.write_byte(this.uby20);
      this.data.write_byte(len(this.uild1));
      for (const [key, value] of this.uild1) {
        this.data.write_int(key);
        this.data.write_byte(len(value));
        for (const val of value) {
          this.data.write_byte(val);
        }
      }
      this.dojo_chapters.write(this.data);
      this.data.write_short(len(this.uil9));
      for (const val of this.uil9) {
        this.data.write_int(val);
      }
      this.data.write_bool(this.ub35);
      this.data.write_double(this.ud18);
      this.data.write_short(len(this.ushd2));
      for (const [key, value] of this.ushd2) {
        this.data.write_short(key);
        this.data.write_byte(value);
      }
      this.data.write_int(140000);
    }
    if (this.game_version.ge(140100) && this.game_version.lt(140500)) {
      this.data.write_byte(this.uby21);
      this.data.write_int(140100);
    }
    if (this.game_version.ge(140200)) {
      this.data.write_byte(len(this.uil10));
      for (const [
        v1,
        v2,
        v3,
        v4,
        v5,
        v6,
        v7,
        v8,
        v9,
        v10,
        v11,
        v12,
        v13,
      ] of this.uil10) {
        this.data.write_int(v1);
        this.data.write_int(v2);
        this.data.write_bool(v3);
        this.data.write_bool(v4);
        this.data.write_bool(v5);
        this.data.write_int(v6);
        this.data.write_int(v7);
        this.data.write_int(v8);
        this.data.write_bool(v9);
        this.data.write_bool(v10);
        this.data.write_bool(v11);
        if (this.game_version.ge(140500)) {
          // game seems to write more than this, may !work with all saves
          this.data.write_string(v12 || "");
        }
        this.data.write_bool(v13);
      }
      this.data.write_byte(len(this.uid1));
      for (const [key, value] of this.uid1) {
        this.data.write_int(key);
        this.data.write_double(value);
      }
      this.data.write_int(this.hundred_million_ticket);
      this.data.write_int(140200);
    }
    if (this.game_version.ge(140300)) {
      this.data.write_byte(len(this.uil11));
      for (const val of this.uil11) {
        this.data.write_byte(val);
      }
      if (this.game_version.ge(150300)) {
        this.data.write_int(this.ui24);
        this.data.write_bool(this.ub38);
      }
      if (this.game_version.ge(150500)) {
        this.data.write_bool(this.ub39);
      }
      this.data.write_bool(this.ub36);
      this.data.write_byte(len(this.treasure_chests));
      for (const val of this.treasure_chests) {
        this.data.write_int(val);
      }
      this.data.write_int(this.ui23);
      this.data.write_short(len(this.uil13));
      for (const val of this.uil13) {
        this.data.write_int(val);
      }
      this.data.write_bool(this.ub37);
      this.data.write_int(140300);
    }
    this.data.write_bytes(this.remaining_data);
    this.data.end_buffer();
  }

  to_data(): Data {
    const dt = new Data();
    this.save_wrapper(dt);
    this.set_hash(true);
    return dt;
  }

  save_wrapper(data: Data): void {
    try {
      this.save(data);
    } catch (e) {
      throw new FailedToSaveError(local_key("failed_to_save_save"), e);
    }
  }

  /** JSON-safe export (bigint -> string, Map -> object). */
  to_dict(): JsonObject {
    return {
      editor_version: EDITOR_VERSION,
      cc: this.cc.get_code(),
      dsts: this.dsts,
      game_version: this.game_version.game_version,
      ub1: this.ub1,
      mute_bgm: this.mute_bgm,
      mute_se: this.mute_se,
      catfood: this.catfood,
      current_energy: this.current_energy,
      year: this.year,
      month: this.month,
      day: this.day,
      timestamp: this.timestamp,
      date: this.date.getTime() / 1000,
      ui1: this.ui1,
      stamp_value_save: this.stamp_value_save,
      ui2: this.ui2,
      upgrade_state: this.upgrade_state,
      xp: this.xp,
      tutorial_state: this.tutorial_state,
      ui3: this.ui3,
      koreaSuperiorTreasureState: this.koreaSuperiorTreasureState,
      unlock_popups_11: this.unlock_popups_11,
      ui5: this.ui5,
      unlock_enemy_guide: this.unlock_enemy_guide,
      ui6: this.ui6,
      ub0: this.ub0,
      ui7: this.ui7,
      cleared_eoc_1: this.cleared_eoc_1,
      ui8: this.ui8,
      unlocked_ending: this.unlocked_ending,
      lineups: this.lineups.serialize(),
      stamp_data: this.stamp_data.serialize(),
      story: this.story.serialize(),
      enemy_guide: this.enemy_guide,
      cats: this.cats.serialize(),
      special_skills: this.special_skills.serialize(),
      menu_unlocks: this.menu_unlocks,
      unlock_popups_0: this.unlock_popups_0,
      battle_items: this.battle_items.serialize(),
      new_dialogs_2: this.new_dialogs_2,
      uil1: this.uil1,
      moneko_bonus: this.moneko_bonus,
      daily_reward_initialized: this.daily_reward_initialized,
      date_2: this.date_2.getTime() / 1000,
      date_3: this.date_3.getTime() / 1000,
      ui0: this.ui0,
      stage_unlock_cat_value: this.stage_unlock_cat_value,
      show_ending_value: this.show_ending_value,
      chapter_clear_cat_unlock: this.chapter_clear_cat_unlock,
      ui9: this.ui9,
      ios_android_month: this.ios_android_month,
      ui10: this.ui10,
      save_data_4_hash: this.save_data_4_hash,
      mysale: this.mysale.serialize(),
      chara_flags: this.chara_flags,
      uim1: this.uim1,
      ubm1: this.ubm1,
      chara_flags_2: this.chara_flags_2,
      normal_tickets: this.normal_tickets,
      rare_tickets: this.rare_tickets,
      event_stages: this.event_stages.serialize(),
      itf1_ending: this.itf1_ending,
      continue_flag: this.continue_flag,
      unlock_popups_8: this.unlock_popups_8,
      unit_drops: this.unit_drops,
      gatya: this.gatya.serialize(),
      get_event_data: this.get_event_data,
      achievements: this.achievements,
      os_value: this.os_value,
      date_4: this.date_4.getTime() / 1000,
      player_id: this.player_id,
      order_ids: this.order_ids,
      g_timestamp: this.g_timestamp,
      g_servertimestamp: this.g_servertimestamp,
      m_gettimesave: this.m_gettimesave,
      usl1: this.usl1,
      energy_notification: this.energy_notification,
      full_gameversion: this.full_gameversion,
      uil2: this.uil2,
      uil3: this.uil3,
      uil4: this.uil4,
      g_timestamp_2: this.g_timestamp_2,
      g_servertimestamp_2: this.g_servertimestamp_2,
      m_gettimesave_2: this.m_gettimesave_2,
      unknown_timestamp: this.unknown_timestamp,
      usl2: this.usl2,
      m_dGetTimeSave2: this.m_dGetTimeSave2,
      ui11: this.ui11,
      ubl1: this.ubl1,
      user_rank_rewards: this.user_rank_rewards.serialize(),
      transfer_code: this.transfer_code,
      confirmation_code: this.confirmation_code,
      transfer_flag: this.transfer_flag,
      item_reward_stages: this.item_reward_stages.serialize(),
      timed_score_stages: this.timed_score_stages.serialize(),
      inquiry_code: this.inquiry_code,
      officer_pass: this.officer_pass.serialize(),
      has_account: this.has_account,
      backup_state: this.backup_state,
      ub2: this.ub2,
      itf1_complete: this.itf1_complete,
      title_chapter_bg: this.title_chapter_bg,
      combo_unlocks: this.combo_unlocks,
      combo_unlocked_10k_ur: this.combo_unlocked_10k_ur,
      event_capsules: this.event_capsules,
      event_capsules_counter: this.event_capsules_counter,
      m_dGetTimeSave3: this.m_dGetTimeSave3,
      gatya_seen_lucky_drops: this.gatya_seen_lucky_drops,
      banned: this.show_ban_message,
      catfood_beginner_purchased: this.catfood_beginner_purchased,
      next_week_timestamp: this.next_week_timestamp,
      catfood_beginner_expired: this.catfood_beginner_expired,
      rank_up_sale_value: this.rank_up_sale_value,
      time_since_time_check_cumulative: this.time_since_time_check_cumulative,
      server_timestamp: this.server_timestamp,
      last_checked_energy_recovery_time: this.last_checked_energy_recovery_time,
      time_since_check: this.time_since_check,
      last_checked_expedition_time: this.last_checked_expedition_time,
      catfruit: this.catfruit,
      catseyes: this.catseyes,
      catamins: this.catamins,
      gamatoto: this.gamatoto.serialize(),
      unlock_popups_6: this.unlock_popups_6,
      ex_stages: this.ex_stages.serialize(),
      item_pack: this.item_pack.serialize(),
      platinum_tickets: this.platinum_tickets,
      logins: this.logins.serialize(),
      reset_item_reward_flags: this.reset_item_reward_flags,
      reward_remaining_time: this.reward_remaining_time,
      last_checked_reward_time: this.last_checked_reward_time,
      announcements: this.announcements,
      backup_counter: this.backup_counter,
      ui12: this.ui12,
      ui13: this.ui13,
      ui14: this.ui14,
      ub3: this.ub3,
      backup_frame: this.backup_frame,
      ub4: this.ub4,
      dojo: this.dojo.serialize(),
      last_checked_zombie_time: this.last_checked_zombie_time,
      outbreaks: this.outbreaks.serialize(),
      scheme_items: this.scheme_items.serialize(),
      first_locks: mapToObject(this.first_locks),
      energy_penalty_timestamp: this.energy_penalty_timestamp,
      shown_maxcollab_mg: this.shown_maxcollab_mg,
      unlock_popups: this.unlock_popups.serialize(),
      ototo: this.ototo.serialize(),
      last_checked_castle_time: this.last_checked_castle_time,
      beacon_base: this.beacon_base.serialize(),
      tower: this.tower.serialize(),
      missions: this.missions.serialize(),
      challenge: this.challenge.serialize(),
      event_update_flags: this.event_update_flags,
      cotc_1_complete: this.cotc_1_complete,
      map_resets: this.map_resets.serialize(),
      uncanny: this.uncanny.serialize(),
      catamin_stages: this.catamin_stages.serialize(),
      lucky_tickets: this.lucky_tickets,
      ub5: this.ub5,
      np: this.np,
      ub6: this.ub6,
      ub7: this.ub7,
      leadership: this.leadership,
      filibuster_stage_id: this.filibuster_stage_id,
      filibuster_stage_enabled: this.filibuster_stage_enabled,
      stage_ids_10s: this.stage_ids_10s,
      uil6: this.uil6,
      legend_quest: this.legend_quest.serialize(),
      ush1: this.ush1,
      uby1: this.uby1,
      uiid1: mapToObject(this.uiid1),
      uby2: this.uby2,
      restart_pack: this.restart_pack,
      medals: this.medals.serialize(),
      wildcat_slots: this.wildcat_slots.serialize(),
      ush2: this.ush2,
      ush3: this.ush3,
      ui15: this.ui15,
      ud1: this.ud1,
      utl1: this.utl1,
      uidd1: mapToObject(this.uidd1),
      gauntlets: this.gauntlets.serialize(),
      enigma_clears: this.enigma_clears.serialize(),
      enigma: this.enigma.serialize(),
      cleared_slots: this.cleared_slots.serialize(),
      collab_gauntlets: this.collab_gauntlets.serialize(),
      ub8: this.ub8,
      ud2: this.ud2,
      ud3: this.ud3,
      ui16: this.ui16,
      uby3: this.uby3,
      ub9: this.ub9,
      ud4: this.ud4,
      ud5: this.ud5,
      uiid3: mapToObject(this.uiid3),
      uidd2: mapToObject(this.uidd2),
      uidd3: mapToObject(this.uidd3),
      talent_orbs: this.talent_orbs.serialize(),
      uidiid2: mapToObject(this.uidiid2, (v) => mapToObject(v)),
      ub10: this.ub10,
      uil7: this.uil7,
      ubl2: this.ubl2,
      cat_shrine: this.cat_shrine.serialize(),
      ud6: this.ud6,
      ud7: this.ud7,
      legend_tickets: this.legend_tickets,
      uiil1: this.uiil1,
      ub11: this.ub11,
      ub12: this.ub12,
      password_refresh_token: this.password_refresh_token,
      ub13: this.ub13,
      uby4: this.uby4,
      uby5: this.uby5,
      ud8: this.ud8,
      ud9: this.ud9,
      date_int: this.date_int,
      event_capsules_2: this.event_capsules_2,
      two_battle_lines: this.two_battle_lines,
      ud10: this.ud10,
      platinum_shards: this.platinum_shards,
      ub15: this.ub15,
      cat_scratcher: this.cat_scratcher.serialize(),
      aku: this.aku.serialize(),
      ub16: this.ub16,
      ub17: this.ub17,
      ushdshd2: mapToObject(this.ushdshd2),
      ushdd: mapToObject(this.ushdd),
      ushdd2: mapToObject(this.ushdd2),
      ub18: this.ub18,
      uby6: this.uby6,
      uidtii: mapToObject(this.uidtii),
      behemoth_culling: this.behemoth_culling.serialize(),
      ub19: this.ub19,
      ub20: this.ub20,
      uidtff: mapToObject(this.uidtff),
      ub21: this.ub21,
      dojo_3x_speed: this.dojo_3x_speed,
      ub22: this.ub22,
      ub23: this.ub23,
      ui17: this.ui17,
      ush4: this.ush4,
      uby7: this.uby7,
      uby8: this.uby8,
      ub24: this.ub24,
      uby9: this.uby9,
      ushl1: this.ushl1,
      ushl2: this.ushl2,
      ushl3: this.ushl3,
      ui18: this.ui18,
      ui19: this.ui19,
      ui20: this.ui20,
      ush5: this.ush5,
      ush6: this.ush6,
      ush7: this.ush7,
      ush8: this.ush8,
      uby10: this.uby10,
      ub25: this.ub25,
      ub26: this.ub26,
      ub27: this.ub27,
      ub28: this.ub28,
      ub29: this.ub29,
      ub30: this.ub30,
      uby11: this.uby11,
      ushl4: this.ushl4,
      ubl3: this.ubl3,
      labyrinth_medals: this.labyrinth_medals,
      zero_legends: this.zero_legends.serialize(),
      uby12: this.uby12,
      ushl6: this.ushl6,
      ub31: this.ub31,
      ush9: this.ush9,
      ushshd: mapToObject(this.ushshd),
      ud11: this.ud11,
      ud12: this.ud12,
      ub32: this.ub32,
      ub33: this.ub33,
      ub34: this.ub34,
      ui21: this.ui21,
      golden_cpu_count: this.golden_cpu_count,
      sound_effects_volume: this.sound_effects_volume,
      background_music_volume: this.background_music_volume,
      ustl1: this.ustl1,
      utl3: this.utl3.map(([i, l]) => [i, l.toString()]),
      ustid1: Object.fromEntries(this.ustid1),
      ud13: this.ud13,
      ud14: this.ud14,
      utl4: this.utl4,
      uby14: this.uby14,
      ush12: this.ush12,
      ud15: this.ud15,
      uby15: this.uby15,
      uby16: this.uby16,
      ush11: this.ush11,
      uby17: this.uby17,
      uby18: this.uby18,
      uby19: this.uby19,
      ud16: this.ud16,
      ushd1: mapToObject(this.ushd1, ([a, b, c]) => [a, b, mapToObject(c)]),
      ui22: this.ui22,
      ud17: this.ud17,
      uby20: this.uby20,
      uild1: mapToObject(this.uild1),
      dojo_chapters: this.dojo_chapters.serialize(),
      uil9: this.uil9,
      ub35: this.ub35,
      ud18: this.ud18,
      ushd2: mapToObject(this.ushd2),
      uby21: this.uby21,
      uil10: this.uil10,
      uid1: mapToObject(this.uid1),
      hundred_million_ticket: this.hundred_million_ticket,
      uil11: this.uil11,
      ub36: this.ub36,
      treasure_chests: this.treasure_chests,
      ui23: this.ui23,
      uil13: this.uil13,
      ub37: this.ub37,
      ub38: this.ub38,
      ub39: this.ub39,
      ui24: this.ui24,
      remaining_data: bytesToBase64(this.remaining_data),
    };
  }

  static from_dict(data: JsonObject, warn = true): SaveFile {
    void warn;
    const cc_code = jget<string | null>(data, "cc", null);
    const cc = cc_code !== null ? new CountryCode(cc_code) : null;
    const save_file = new SaveFile(null, cc);
    save_file.dsts = jget<boolean[]>(data, "dsts", []);
    save_file.game_version = new GameVersion(jget(data, "game_version", 0));
    save_file.ub1 = jget<boolean>(data, "ub1", false);
    save_file.mute_bgm = jget<boolean>(data, "mute_bgm", false);
    save_file.mute_se = jget<boolean>(data, "mute_se", false);
    save_file.catfood = jget<number>(data, "catfood", 0);
    save_file.current_energy = jget<number>(data, "current_energy", 0);
    save_file.year = jget<number>(data, "year", 0);
    save_file.month = jget<number>(data, "month", 0);
    save_file.day = jget<number>(data, "day", 0);
    save_file.timestamp = jget<number>(data, "timestamp", 0);
    save_file.date = new Date(jget(data, "date", 0) * 1000);
    save_file.ui1 = jget<number>(data, "ui1", 0);
    save_file.stamp_value_save = jget<number>(data, "stamp_value_save", 0);
    save_file.ui2 = jget<number>(data, "ui2", 0);
    save_file.upgrade_state = jget<number>(data, "upgrade_state", 0);
    save_file.xp = jget<number>(data, "xp", 0);
    save_file.tutorial_state = jget<number>(data, "tutorial_state", 0);
    save_file.ui3 = jget<number>(data, "ui3", 0);
    save_file.koreaSuperiorTreasureState = jget<number>(
      data,
      "koreaSuperiorTreasureState",
      0,
    );
    save_file.unlock_popups_11 = jget<number[]>(data, "unlock_popups_11", []);
    save_file.ui5 = jget<number>(data, "ui5", 0);
    save_file.unlock_enemy_guide = jget<number>(data, "unlock_enemy_guide", 0);
    save_file.ui6 = jget<number>(data, "ui6", 0);
    save_file.ub0 = jget<boolean>(data, "ub0", false);
    save_file.ui7 = jget<number>(data, "ui7", 0);
    save_file.cleared_eoc_1 = jget<number>(data, "cleared_eoc_1", 0);
    save_file.ui8 = jget<number>(data, "ui8", 0);
    save_file.unlocked_ending = jget<number>(data, "unlocked_ending", 0);
    save_file.lineups = LineUps.deserialize(raw(data, "lineups", {}));
    save_file.stamp_data = StampData.deserialize(raw(data, "stamp_data", {}));
    save_file.story = StoryChapters.deserialize(raw(data, "story", []));
    save_file.enemy_guide = jget<number[]>(data, "enemy_guide", []);
    save_file.cats = Cats.deserialize(raw(data, "cats", {}));
    save_file.special_skills = SpecialSkills.deserialize(
      raw(data, "special_skills", []),
    );
    save_file.menu_unlocks = jget<number[]>(data, "menu_unlocks", []);
    save_file.unlock_popups_0 = jget<number[]>(data, "unlock_popups_0", []);
    save_file.battle_items = BattleItems.deserialize(
      raw(data, "battle_items", {}),
    );
    save_file.new_dialogs_2 = jget<number[]>(data, "new_dialogs_2", []);
    save_file.uil1 = jget<number[]>(data, "uil1", []);
    save_file.moneko_bonus = jget<number[]>(data, "moneko_bonus", []);
    save_file.daily_reward_initialized = jget<number[]>(
      data,
      "daily_reward_initialized",
      [],
    );
    save_file.date_2 = new Date(jget(data, "date_2", 0) * 1000);
    save_file.date_3 = new Date(jget(data, "date_3", 0) * 1000);
    save_file.ui0 = jget<number>(data, "ui0", 0);
    save_file.stage_unlock_cat_value = jget<number>(
      data,
      "stage_unlock_cat_value",
      0,
    );
    save_file.show_ending_value = jget<number>(data, "show_ending_value", 0);
    save_file.chapter_clear_cat_unlock = jget<number>(
      data,
      "chapter_clear_cat_unlock",
      0,
    );
    save_file.ui9 = jget<number>(data, "ui9", 0);
    save_file.ios_android_month = jget<number>(data, "ios_android_month", 0);
    save_file.ui10 = jget<number>(data, "ui10", 0);
    save_file.save_data_4_hash = jget<string>(data, "save_data_4_hash", "");
    save_file.mysale = MySale.deserialize(raw(data, "mysale", {}));
    save_file.chara_flags = jget<number[]>(data, "chara_flags", []);
    save_file.uim1 = jget<number>(data, "uim1", 0);
    save_file.ubm1 = jget<boolean>(data, "ubm1", false);
    save_file.chara_flags_2 = jget<number[]>(data, "chara_flags_2", []);
    save_file.normal_tickets = jget<number>(data, "normal_tickets", 0);
    save_file.rare_tickets = jget<number>(data, "rare_tickets", 0);
    save_file.event_stages = EventChapters.deserialize(
      raw(data, "event_stages", {}),
    );
    save_file.itf1_ending = jget<number>(data, "itf1_ending", 0);
    save_file.continue_flag = jget<number>(data, "continue_flag", 0);
    save_file.unlock_popups_8 = jget<number[]>(data, "unlock_popups_8", []);
    save_file.unit_drops = jget<number[]>(data, "unit_drops", []);
    save_file.gatya = Gatya.deserialize(raw(data, "gatya", {}));
    save_file.get_event_data = jget<boolean>(data, "get_event_data", false);
    save_file.achievements = jget<boolean[]>(data, "achievements", []);
    save_file.os_value = jget<number>(data, "os_value", 0);
    save_file.date_4 = new Date(jget(data, "date_4", 0) * 1000);
    save_file.player_id = jget<string>(data, "player_id", "");
    save_file.order_ids = jget<string[]>(data, "order_ids", []);
    save_file.g_timestamp = jget<number>(data, "g_timestamp", 0);
    save_file.g_servertimestamp = jget<number>(data, "g_servertimestamp", 0);
    save_file.m_gettimesave = jget<number>(data, "m_gettimesave", 0);
    save_file.usl1 = jget<string[]>(data, "usl1", []);
    save_file.energy_notification = jget<boolean>(
      data,
      "energy_notification",
      false,
    );
    save_file.full_gameversion = jget<number>(data, "full_gameversion", 0);
    save_file.uil2 = jget<number[]>(data, "uil2", []);
    save_file.uil3 = jget<number[]>(data, "uil3", []);
    save_file.uil4 = jget<number[]>(data, "uil4", []);
    save_file.g_timestamp_2 = jget<number>(data, "g_timestamp_2", 0);
    save_file.g_servertimestamp_2 = jget<number>(
      data,
      "g_servertimestamp_2",
      0,
    );
    save_file.m_gettimesave_2 = jget<number>(data, "m_gettimesave_2", 0);
    save_file.unknown_timestamp = jget<number>(data, "unknown_timestamp", 0);
    save_file.usl2 = jget<string[]>(data, "usl2", []);
    save_file.m_dGetTimeSave2 = jget<number>(data, "m_dGetTimeSave2", 0);
    save_file.ui11 = jget<number>(data, "ui11", 0);
    save_file.ubl1 = jget<boolean[]>(data, "ubl1", []);
    save_file.user_rank_rewards = UserRankRewards.deserialize(
      raw(data, "user_rank_rewards", []),
    );
    save_file.transfer_code = jget<string>(data, "transfer_code", "");
    save_file.confirmation_code = jget<string>(data, "confirmation_code", "");
    save_file.transfer_flag = jget<boolean>(data, "transfer_flag", false);
    save_file.item_reward_stages = ItemRewardChapters.deserialize(
      raw(data, "item_reward_stages", {}),
    );
    save_file.timed_score_stages = TimedScoreChapters.deserialize(
      raw(data, "timed_score_stages", []),
    );
    save_file.inquiry_code = jget<string>(data, "inquiry_code", "");
    save_file.officer_pass = OfficerPass.deserialize(
      raw(data, "officer_pass", {}),
    );
    save_file.has_account = jget<number>(data, "has_account", 0);
    save_file.backup_state = jget<number>(data, "backup_state", 0);
    save_file.ub2 = jget<boolean>(data, "ub2", false);
    save_file.itf1_complete = jget<number>(data, "itf1_complete", 0);
    save_file.title_chapter_bg = jget<number>(data, "title_chapter_bg", 0);
    save_file.combo_unlocks = jget<number[]>(data, "combo_unlocks", []);
    save_file.combo_unlocked_10k_ur = jget<boolean>(
      data,
      "combo_unlocked_10k_ur",
      false,
    );
    save_file.event_capsules = jget<number[]>(data, "event_capsules", []);
    save_file.event_capsules_counter = jget<number[]>(
      data,
      "event_capsules_counter",
      [],
    );
    save_file.m_dGetTimeSave3 = jget<number>(data, "m_dGetTimeSave3", 0);
    save_file.gatya_seen_lucky_drops = jget<number[]>(
      data,
      "gatya_seen_lucky_drops",
      [],
    );
    save_file.show_ban_message = jget<boolean>(data, "banned", false);
    save_file.catfood_beginner_purchased = jget<boolean[]>(
      data,
      "catfood_beginner_purchased",
      [],
    );
    save_file.next_week_timestamp = jget<number>(
      data,
      "next_week_timestamp",
      0,
    );
    save_file.catfood_beginner_expired = jget<boolean[]>(
      data,
      "catfood_beginner_expired",
      [],
    );
    save_file.rank_up_sale_value = jget<number>(data, "rank_up_sale_value", 0);
    save_file.time_since_time_check_cumulative = jget<number>(
      data,
      "time_since_time_check_cumulative",
      0,
    );
    save_file.server_timestamp = jget<number>(data, "server_timestamp", 0);
    save_file.last_checked_energy_recovery_time = jget<number>(
      data,
      "last_checked_energy_recovery_time",
      0,
    );
    save_file.time_since_check = jget<number>(data, "time_since_check", 0);
    save_file.last_checked_expedition_time = jget<number>(
      data,
      "last_checked_expedition_time",
      0,
    );
    save_file.catfruit = jget<number[]>(data, "catfruit", []);
    save_file.catseyes = jget<number[]>(data, "catseyes", []);
    save_file.catamins = jget<number[]>(data, "catamins", []);
    save_file.gamatoto = Gamatoto.deserialize(raw(data, "gamatoto", {}));
    save_file.unlock_popups_6 = jget<boolean[]>(data, "unlock_popups_6", []);
    save_file.ex_stages = ExChapters.deserialize(raw(data, "ex_stages", []));
    save_file.item_pack = ItemPack.deserialize(raw(data, "item_pack", {}));
    save_file.platinum_tickets = jget<number>(data, "platinum_tickets", 0);
    save_file.logins = LoginBonus.deserialize(raw(data, "logins", {}));
    save_file.reset_item_reward_flags = jget<boolean[]>(
      data,
      "reset_item_reward_flags",
      [],
    );
    save_file.reward_remaining_time = jget<number>(
      data,
      "reward_remaining_time",
      0,
    );
    save_file.last_checked_reward_time = jget<number>(
      data,
      "last_checked_reward_time",
      0,
    );
    save_file.announcements = jget<[number, number][]>(
      data,
      "announcements",
      [],
    );
    save_file.backup_counter = jget<number>(data, "backup_counter", 0);
    save_file.ui12 = jget<number>(data, "ui12", 0);
    save_file.ui13 = jget<number>(data, "ui13", 0);
    save_file.ui14 = jget<number>(data, "ui14", 0);
    save_file.ub3 = jget<boolean>(data, "ub3", false);
    save_file.backup_frame = jget<number>(data, "backup_frame", 0);
    save_file.ub4 = jget<boolean>(data, "ub4", false);
    save_file.dojo = Dojo.deserialize(raw(data, "dojo", {}));
    save_file.last_checked_zombie_time = jget<number>(
      data,
      "last_checked_zombie_time",
      0,
    );
    save_file.outbreaks = Outbreaks.deserialize(raw(data, "outbreaks", {}));
    save_file.scheme_items = SchemeItems.deserialize(
      raw(data, "scheme_items", {}),
    );
    save_file.first_locks = objectToMap(rec<boolean>(data, "first_locks"));
    save_file.energy_penalty_timestamp = jget<number>(
      data,
      "energy_penalty_timestamp",
      0,
    );
    save_file.shown_maxcollab_mg = jget<boolean>(
      data,
      "shown_maxcollab_mg",
      false,
    );
    save_file.unlock_popups = UnlockPopups.deserialize(
      raw(data, "unlock_popups", {}),
    );
    save_file.ototo = Ototo.deserialize(raw(data, "ototo", {}));
    save_file.last_checked_castle_time = jget<number>(
      data,
      "last_checked_castle_time",
      0,
    );
    save_file.beacon_base = BeaconEventListScene.deserialize(
      raw(data, "beacon_base", {}),
    );
    save_file.tower = TowerChapters.deserialize(raw(data, "tower", {}));
    save_file.missions = Missions.deserialize(raw(data, "missions", {}));
    save_file.challenge = ChallengeChapters.deserialize(
      raw(data, "challenge", {}),
    );
    save_file.event_update_flags = jget<boolean>(
      data,
      "event_update_flags",
      false,
    );
    save_file.cotc_1_complete = jget<number>(data, "cotc_1_complete", 0);
    save_file.map_resets = MapResets.deserialize(raw(data, "map_resets", {}));
    save_file.uncanny = UncannyChapters.deserialize(raw(data, "uncanny", {}));
    save_file.catamin_stages = UncannyChapters.deserialize(
      raw(data, "catamin_stages", {}),
    );
    save_file.lucky_tickets = jget<number[]>(data, "lucky_tickets", []);
    save_file.ub5 = jget<boolean>(data, "ub5", false);
    save_file.np = jget<number>(data, "np", 0);
    save_file.ub6 = jget<boolean>(data, "ub6", false);
    save_file.ub7 = jget<boolean>(data, "ub7", false);
    save_file.leadership = jget<number>(data, "leadership", 0);
    save_file.filibuster_stage_id = jget<number>(
      data,
      "filibuster_stage_id",
      0,
    );
    save_file.filibuster_stage_enabled = jget<boolean>(
      data,
      "filibuster_stage_enabled",
      false,
    );
    save_file.stage_ids_10s = jget<number[]>(data, "stage_ids_10s", []);
    save_file.uil6 = jget<number[]>(data, "uil6", []);
    save_file.legend_quest = LegendQuestChapters.deserialize(
      raw(data, "legend_quest", {}),
    );
    save_file.ush1 = jget<number>(data, "ush1", 0);
    save_file.uby1 = jget<number>(data, "uby1", 0);
    save_file.uiid1 = objectToMap(rec<number[]>(data, "uiid1"));
    save_file.uby2 = jget<number>(data, "uby2", 0);
    save_file.restart_pack = jget<number>(data, "restart_pack", 0);
    save_file.medals = Medals.deserialize(raw(data, "medals", {}));
    save_file.wildcat_slots = GamblingEvent.deserialize(
      raw(data, "wildcat_slots", {}),
    );
    save_file.ush2 = jget<number>(data, "ush2", 0);
    save_file.ush3 = jget<number>(data, "ush3", 0);
    save_file.ui15 = jget<number>(data, "ui15", 0);
    save_file.ud1 = jget<number>(data, "ud1", 0);
    save_file.utl1 = jget<
      [number, number, number, number, number, number, number][]
    >(data, "utl1", []);
    save_file.uidd1 = objectToMap(rec<number>(data, "uidd1"));
    save_file.gauntlets = GauntletChapters.deserialize(
      raw(data, "gauntlets", {}),
    );
    save_file.enigma_clears = GauntletChapters.deserialize(
      raw(data, "enigma_clears", {}),
    );
    save_file.enigma = Enigma.deserialize(raw(data, "enigma", {}));
    save_file.cleared_slots = ClearedSlots.deserialize(
      raw(data, "cleared_slots", {}),
    );
    save_file.collab_gauntlets = GauntletChapters.deserialize(
      raw(data, "collab_gauntlets", {}),
    );
    save_file.ub8 = jget<boolean>(data, "ub8", false);
    save_file.ud2 = jget<number>(data, "ud2", 0);
    save_file.ud3 = jget<number>(data, "ud3", 0);
    save_file.ui16 = jget<number>(data, "ui16", 0);
    save_file.uby3 = jget<number>(data, "uby3", 0);
    save_file.ub9 = jget<boolean>(data, "ub9", false);
    save_file.ud4 = jget<number>(data, "ud4", 0);
    save_file.ud5 = jget<number>(data, "ud5", 0);
    save_file.uiid3 = objectToMap(rec<number>(data, "uiid3"));
    save_file.uidd2 = objectToMap(rec<number>(data, "uidd2"));
    save_file.uidd3 = objectToMap(rec<number>(data, "uidd3"));
    save_file.talent_orbs = TalentOrbs.deserialize(
      raw(data, "talent_orbs", {}),
    );
    save_file.uidiid2 = objectToMap(
      rec<Record<string, number>>(data, "uidiid2"),
      (v) => objectToMap(v),
    );
    save_file.ub10 = jget<boolean>(data, "ub10", false);
    save_file.uil7 = jget<number[]>(data, "uil7", []);
    save_file.ubl2 = jget<boolean[]>(data, "ubl2", []);
    save_file.cat_shrine = CatShrine.deserialize(raw(data, "cat_shrine", {}));
    save_file.ud6 = jget<number>(data, "ud6", 0);
    save_file.ud7 = jget<number>(data, "ud7", 0);
    save_file.legend_tickets = jget<number>(data, "legend_tickets", 0);
    save_file.uiil1 = jget<[number, number][]>(data, "uiil1", []);
    save_file.ub11 = jget<boolean>(data, "ub11", false);
    save_file.ub12 = jget<boolean>(data, "ub12", false);
    save_file.password_refresh_token = jget<string>(
      data,
      "password_refresh_token",
      "",
    );
    save_file.ub13 = jget<boolean>(data, "ub13", false);
    save_file.uby4 = jget<number>(data, "uby4", 0);
    save_file.uby5 = jget<number>(data, "uby5", 0);
    save_file.ud8 = jget<number>(data, "ud8", 0);
    save_file.ud9 = jget<number>(data, "ud9", 0);
    save_file.date_int = jget<number>(data, "date_int", 0);
    save_file.event_capsules_2 = jget<number[]>(data, "event_capsules_2", []);
    save_file.two_battle_lines = jget<boolean>(data, "two_battle_lines", false);
    save_file.ud10 = jget<number>(data, "ud10", 0);
    save_file.platinum_shards = jget<number>(data, "platinum_shards", 0);
    save_file.ub15 = jget<boolean>(data, "ub15", false);
    save_file.cat_scratcher = GamblingEvent.deserialize(
      raw(data, "cat_scratcher", {}),
    );
    save_file.aku = AkuChapters.deserialize(raw(data, "aku", {}));
    save_file.ub16 = jget<boolean>(data, "ub16", false);
    save_file.ub17 = jget<boolean>(data, "ub17", false);
    save_file.ushdshd2 = objectToMap(rec<number[]>(data, "ushdshd2"));
    save_file.ushdd = objectToMap(rec<number>(data, "ushdd"));
    save_file.ushdd2 = objectToMap(rec<number>(data, "ushdd2"));
    save_file.ub18 = jget<boolean>(data, "ub18", false);
    save_file.uby6 = jget<number>(data, "uby6", 0);
    save_file.uidtii = objectToMap(rec<[number, number]>(data, "uidtii"));
    save_file.behemoth_culling = GauntletChapters.deserialize(
      raw(data, "behemoth_culling", {}),
    );
    save_file.ub19 = jget<boolean>(data, "ub19", false);
    save_file.ub20 = jget<boolean>(data, "ub20", false);
    save_file.uidtff = objectToMap(rec<[number, number]>(data, "uidtff"));
    save_file.ub21 = jget<boolean>(data, "ub21", false);
    save_file.dojo_3x_speed = jget<boolean>(data, "dojo_3x_speed", false);
    save_file.ub22 = jget<boolean>(data, "ub22", false);
    save_file.ub23 = jget<boolean>(data, "ub23", false);
    save_file.ui17 = jget<number>(data, "ui17", 0);
    save_file.ush4 = jget<number>(data, "ush4", 0);
    save_file.uby7 = jget<number>(data, "uby7", 0);
    save_file.uby8 = jget<number>(data, "uby8", 0);
    save_file.ub24 = jget<boolean>(data, "ub24", false);
    save_file.uby9 = jget<number>(data, "uby9", 0);
    save_file.ushl1 = jget<number[]>(data, "ushl1", []);
    save_file.ushl2 = jget<number[]>(data, "ushl2", []);
    save_file.ushl3 = jget<number[]>(data, "ushl3", []);
    save_file.ui18 = jget<number>(data, "ui18", 0);
    save_file.ui19 = jget<number>(data, "ui19", 0);
    save_file.ui20 = jget<number>(data, "ui20", 0);
    save_file.ush5 = jget<number>(data, "ush5", 0);
    save_file.ush6 = jget<number>(data, "ush6", 0);
    save_file.ush7 = jget<number>(data, "ush7", 0);
    save_file.ush8 = jget<number>(data, "ush8", 0);
    save_file.uby10 = jget<number>(data, "uby10", 0);
    save_file.ub25 = jget<boolean>(data, "ub25", false);
    save_file.ub26 = jget<boolean>(data, "ub26", false);
    save_file.ub27 = jget<boolean>(data, "ub27", false);
    save_file.ub28 = jget<boolean>(data, "ub28", false);
    save_file.ub29 = jget<boolean>(data, "ub29", false);
    save_file.ub30 = jget<boolean>(data, "ub30", false);
    save_file.uby11 = jget<number>(data, "uby11", 0);
    save_file.ushl4 = jget<number[]>(data, "ushl4", []);
    save_file.ubl3 = jget<boolean[]>(data, "ubl3", []);
    save_file.labyrinth_medals = jget<number[]>(data, "labyrinth_medals", []);
    save_file.zero_legends = ZeroLegendsChapters.deserialize(
      raw(data, "zero_legends", []),
    );
    save_file.uby12 = jget<number>(data, "uby12", 0);
    save_file.ushl6 = jget<number[]>(data, "ushl6", []);
    save_file.ub31 = jget<boolean>(data, "ub31", false);
    save_file.ush9 = jget<number>(data, "ush9", 0);
    save_file.ushshd = objectToMap(rec<number>(data, "ushshd"));
    save_file.ud11 = jget<number>(data, "ud11", 0);
    save_file.ud12 = jget<number>(data, "ud12", 0);
    save_file.ub32 = jget<boolean>(data, "ub32", false);
    save_file.ub33 = jget<boolean>(data, "ub33", false);
    save_file.ub34 = jget<boolean>(data, "ub34", false);
    save_file.ui21 = jget<number>(data, "ui21", 0);
    save_file.golden_cpu_count = jget<number>(data, "golden_cpu_count", 0);
    save_file.sound_effects_volume = jget<number>(
      data,
      "sound_effects_volume",
      0,
    );
    save_file.background_music_volume = jget<number>(
      data,
      "background_music_volume",
      0,
    );
    save_file.ustl1 = jget<[string, string][]>(data, "ustl1", []);
    save_file.utl3 = jget<[number, string][]>(data, "utl3", []).map(
      ([i, l]): [number, bigint] => [i, BigInt(l)],
    );
    save_file.ustid1 = new Map(
      Object.entries(rec<[number, number]>(data, "ustid1")),
    );
    save_file.ud13 = jget<number>(data, "ud13", 0);
    save_file.ud14 = jget<number>(data, "ud14", 0);
    save_file.utl4 = jget<[number, [number, number, number, number[]][]][]>(
      data,
      "utl4",
      [],
    );
    save_file.uby14 = jget<number>(data, "uby14", 0);
    save_file.ush12 = jget<number>(data, "ush12", 0);
    save_file.ud15 = jget<number>(data, "ud15", 0);
    save_file.uby15 = jget<number>(data, "uby15", 0);
    save_file.uby16 = jget<number>(data, "uby16", 0);
    save_file.ush11 = jget<number>(data, "ush11", 0);
    save_file.uby17 = jget<number>(data, "uby17", 0);
    save_file.uby18 = jget<number>(data, "uby18", 0);
    save_file.uby19 = jget<number>(data, "uby19", 0);
    save_file.ud16 = jget<number>(data, "ud16", 0);
    save_file.ushd1 = objectToMap(
      rec<[number, number, Record<string, number>]>(data, "ushd1"),
      ([a, b, c]): [number, number, Map<number, number>] => [
        a,
        b,
        objectToMap(c),
      ],
    );
    save_file.ui22 = jget<number>(data, "ui22", 0);
    save_file.ud17 = jget<number>(data, "ud17", 0);
    save_file.uby20 = jget<number>(data, "uby20", 0);
    save_file.uild1 = objectToMap(rec<number[]>(data, "uild1"));
    save_file.dojo_chapters = ZeroLegendsChapters.deserialize(
      raw(data, "dojo_chapters", []),
    );
    save_file.uil9 = jget<number[]>(data, "uil9", []);
    save_file.ub35 = jget<boolean>(data, "ub35", false);
    save_file.ud18 = jget<number>(data, "ud18", 0);
    save_file.ushd2 = objectToMap(rec<number>(data, "ushd2"));
    save_file.uil10 = jget<Uil10Row[]>(data, "uil10", []);
    save_file.uid1 = objectToMap(rec<number>(data, "uid1"));
    save_file.hundred_million_ticket = jget<number>(
      data,
      "hundred_million_ticket",
      0,
    );
    save_file.uil11 = jget<number[]>(data, "uil11", []);
    save_file.ub36 = jget<boolean>(data, "ub36", false);
    save_file.treasure_chests = jget<number[]>(data, "treasure_chests", []);
    save_file.ui23 = jget<number>(data, "ui23", 0);
    save_file.uil13 = jget<number[]>(data, "uil13", []);
    save_file.ub37 = jget<boolean>(data, "ub37", false);
    save_file.ub38 = jget<boolean>(data, "ub38", false);
    save_file.ub39 = jget<boolean>(data, "ub39", false);
    save_file.ui24 = jget<number>(data, "ui24", 0);
    save_file.remaining_data = base64ToBytes(jget(data, "remaining_data", ""));
    return save_file;
  }

  init_save(gv: GameVersion | null = null): void {
    this.dsts = [];
    this.dst_index = 0;
    if (gv === null) {
      gv = new GameVersion(120200);
    }
    this.set_gv(gv);

    this.ubm1 = false;
    this.ubm = false;
    this.ub0 = false;
    this.ub1 = false;
    this.ub2 = false;
    this.ub3 = false;
    this.ub4 = false;
    this.ub5 = false;
    this.ub6 = false;
    this.ub7 = false;
    this.ub8 = false;
    this.ub9 = false;
    this.ub10 = false;
    this.ub11 = false;
    this.ub12 = false;
    this.ub13 = false;
    this.ub15 = false;
    this.ub16 = false;
    this.ub17 = false;
    this.ub18 = false;
    this.ub19 = false;
    this.ub20 = false;
    this.ub21 = false;
    this.ub22 = false;
    this.ub23 = false;
    this.ub24 = false;
    this.ub25 = false;
    this.ub26 = false;
    this.ub27 = false;
    this.ub28 = false;
    this.ub29 = false;
    this.ub30 = false;
    this.ub31 = false;
    this.ub32 = false;
    this.ub33 = false;
    this.ub34 = false;
    this.ub35 = false;
    this.ub36 = false;
    this.ub37 = false;
    this.ub38 = false;
    this.ub39 = false;
    this.mute_bgm = false;
    this.mute_se = false;
    this.get_event_data = false;
    this.energy_notification = false;
    this.transfer_flag = false;
    this.combo_unlocked_10k_ur = false;
    this.show_ban_message = false;
    this.shown_maxcollab_mg = false;
    this.event_update_flags = false;
    this.filibuster_stage_enabled = false;
    this.dojo_3x_speed = false;
    this.two_battle_lines = false;
    this.uim1 = 0;
    this.ui0 = 0;
    this.ui1 = 0;
    this.ui2 = 0;
    this.ui3 = 0;
    this.ui4 = 0;
    this.ui5 = 0;
    this.ui6 = 0;
    this.ui7 = 0;
    this.ui8 = 0;
    this.ui9 = 0;
    this.ui10 = 0;
    this.ui11 = 0;
    this.ui12 = 0;
    this.ui13 = 0;
    this.ui14 = 0;
    this.ui15 = 0;
    this.ui16 = 0;
    this.ui17 = 0;
    this.ui18 = 0;
    this.ui19 = 0;
    this.ui20 = 0;
    this.ui21 = 0;
    this.ui22 = 0;
    this.ui23 = 0;
    this.ui24 = 0;
    this.catfood = 0;
    this.current_energy = 0;
    this.year = 0;
    this.month = 0;
    this.day = 0;
    this.stamp_value_save = 0;
    this.upgrade_state = 0;
    this.xp = 0;
    this.tutorial_state = 0;
    this.koreaSuperiorTreasureState = 0;
    this.unlock_enemy_guide = 0;
    this.cleared_eoc_1 = 0;
    this.unlocked_ending = 0;
    this.stage_unlock_cat_value = 0;
    this.show_ending_value = 0;
    this.chapter_clear_cat_unlock = 0;
    this.ios_android_month = 0;
    this.normal_tickets = 0;
    this.rare_tickets = 0;
    this.itf1_ending = 0;
    this.continue_flag = 0;
    this.os_value = 0;
    this.full_gameversion = 0;
    this.backup_state = 0;
    this.itf1_complete = 0;
    this.title_chapter_bg = 0;
    this.rank_up_sale_value = 0;
    this.platinum_tickets = 0;
    this.backup_counter = 0;
    this.backup_frame = 0;
    this.cotc_1_complete = 0;
    this.np = 0;
    this.legend_tickets = 0;
    this.date_int = 0;
    this.platinum_shards = 0;
    this.sound_effects_volume = 0;
    this.background_music_volume = 0;
    this.hundred_million_ticket = 0;
    this.ud1 = 0;
    this.ud2 = 0;
    this.ud3 = 0;
    this.ud4 = 0;
    this.ud5 = 0;
    this.ud6 = 0;
    this.ud7 = 0;
    this.ud8 = 0;
    this.ud9 = 0;
    this.ud10 = 0;
    this.ud11 = 0;
    this.ud12 = 0;
    this.ud13 = 0;
    this.ud14 = 0;
    this.ud15 = 0;
    this.ud16 = 0;
    this.ud17 = 0;
    this.ud18 = 0;
    this.timestamp = 0;
    this.g_timestamp = 0;
    this.g_servertimestamp = 0;
    this.m_gettimesave = 0;
    this.g_timestamp_2 = 0;
    this.g_servertimestamp_2 = 0;
    this.m_gettimesave_2 = 0;
    this.unknown_timestamp = 0;
    this.m_dGetTimeSave2 = 0;
    this.m_dGetTimeSave3 = 0;
    this.next_week_timestamp = 0;
    this.time_since_time_check_cumulative = 0;
    this.server_timestamp = 0;
    this.last_checked_energy_recovery_time = 0;
    this.time_since_check = 0;
    this.last_checked_expedition_time = 0;
    this.reward_remaining_time = 0;
    this.last_checked_reward_time = 0;
    this.last_checked_zombie_time = 0;
    this.energy_penalty_timestamp = 0;
    this.last_checked_castle_time = 0;
    this.date = new Date(0);
    this.date_2 = new Date(0);
    this.date_3 = new Date(0);
    this.date_4 = new Date(0);
    this.uil1 = filled(0, 20);
    this.uil2 = filled(0, 7);
    this.uil3 = filled(0, 7);
    this.uil4 = filled(0, 7);
    this.stage_ids_10s = [];
    this.uil6 = [];
    this.uil7 = [];
    this.event_capsules_2 = [];
    this.uil9 = [];
    this.uil10 = [];
    this.uil11 = [];
    this.treasure_chests = [];
    this.uil13 = [];
    this.uiil1 = [];
    this.usl1 = [];
    this.usl2 = [];
    this.ustl1 = [];
    if (this.game_version.ge(20) && this.game_version.le(25)) {
      this.ubl1 = filled(false, 12);
    } else {
      this.ubl1 = [];
    }
    this.ubl2 = filled(false, 10);
    this.ubl3 = filled(false, 14);
    this.ushl1 = [];
    this.ushl2 = [];
    this.ushl3 = [];
    this.ushl4 = [];
    this.ushl6 = [];
    this.utl1 = [];
    this.utl3 = [];
    this.utl4 = [];
    this.unlock_popups_11 = filled(0, 3);
    if (this.game_version.ge(20) && this.game_version.le(25)) {
      this.enemy_guide = filled(0, 231);
    } else {
      this.enemy_guide = [];
    }
    if (this.game_version.le(25)) {
      this.menu_unlocks = filled(0, 5);
      this.unlock_popups_0 = filled(0, 5);
    } else if (this.game_version.le(26)) {
      this.menu_unlocks = filled(0, 6);
      this.unlock_popups_0 = filled(0, 6);
    } else {
      this.menu_unlocks = [];
      this.unlock_popups_0 = [];
    }
    if (this.game_version.le(26)) {
      this.new_dialogs_2 = filled(0, 17);
    } else {
      this.new_dialogs_2 = [];
    }
    this.moneko_bonus = filled(0, 1);
    this.daily_reward_initialized = filled(0, 1);
    this.chara_flags = filled(0, 2);
    this.chara_flags_2 = filled(0, 2);
    this.unlock_popups_8 = filled(0, 36);
    if (this.game_version.ge(20) && this.game_version.le(25)) {
      this.unit_drops = filled(0, 10);
    } else {
      this.unit_drops = [];
    }
    this.achievements = filled(false, 7);
    this.order_ids = [];
    this.combo_unlocks = [];
    if (this.game_version.lt(34)) {
      this.event_capsules = filled(0, 100);
      this.event_capsules_counter = filled(0, 100);
    } else {
      this.event_capsules = [];
      this.event_capsules_counter = [];
    }
    if (this.game_version.lt(26)) {
      this.gatya_seen_lucky_drops = filled(0, 44);
    } else {
      this.gatya_seen_lucky_drops = [];
    }
    this.catfood_beginner_purchased = filled(false, 3);
    this.catfood_beginner_expired = filled(false, 3);
    this.catfruit = [];
    this.catseyes = [];
    this.catamins = [];
    this.unlock_popups_6 = [];
    this.reset_item_reward_flags = [];
    this.announcements = times(16, () => [0, 0] as [number, number]);
    this.lucky_tickets = [];
    this.labyrinth_medals = [];
    this.save_data_4_hash = "";
    this.player_id = "";
    this.transfer_code = "";
    this.confirmation_code = "";
    this.inquiry_code = "";
    this.password_refresh_token = "";
    this.uby1 = 0;
    this.uby2 = 0;
    this.uby3 = 0;
    this.uby4 = 0;
    this.uby5 = 0;
    this.uby6 = 0;
    this.uby7 = 0;
    this.uby8 = 0;
    this.uby9 = 0;
    this.uby10 = 0;
    this.uby11 = 0;
    this.uby12 = 0;
    this.golden_cpu_count = 0;
    this.uby14 = 0;
    this.uby15 = 0;
    this.uby16 = 0;
    this.uby17 = 0;
    this.uby18 = 0;
    this.uby19 = 0;
    this.uby20 = 0;
    this.uby21 = 0;
    this.has_account = 0;
    this.filibuster_stage_id = 0;
    this.restart_pack = 0;
    this.ush1 = 0;
    this.ush2 = 0;
    this.ush3 = 0;
    this.ush4 = 0;
    this.ush5 = 0;
    this.ush6 = 0;
    this.ush7 = 0;
    this.ush8 = 0;
    this.ush9 = 0;
    this.ush10 = 0;
    this.ush11 = 0;
    this.ush12 = 0;
    this.leadership = 0;
    this.lineups = LineUps.init(this.game_version);
    this.stamp_data = StampData.init();
    this.story = StoryChapters.init();
    this.cats = Cats.init(this.game_version);
    this.special_skills = SpecialSkills.init();
    this.battle_items = BattleItems.init();
    this.mysale = MySale.init();
    this.event_stages = EventChapters.init(this.game_version);
    this.gatya = Gatya.init();
    this.user_rank_rewards = UserRankRewards.init(this.game_version);
    this.item_reward_stages = ItemRewardChapters.init(this.game_version);
    this.timed_score_stages = TimedScoreChapters.init(this.game_version);
    this.officer_pass = OfficerPass.init();
    this.gamatoto = Gamatoto.init();
    this.ex_stages = ExChapters.init();
    this.item_pack = ItemPack.init();
    this.logins = LoginBonus.init(this.game_version);
    this.dojo = Dojo.init();
    this.outbreaks = Outbreaks.init();
    this.scheme_items = SchemeItems.init();
    this.unlock_popups = UnlockPopups.init();
    this.ototo = Ototo.init(this.game_version);
    this.beacon_base = BeaconEventListScene.init();
    this.tower = TowerChapters.init();
    this.missions = Missions.init();
    this.challenge = ChallengeChapters.init();
    this.map_resets = MapResets.init();
    this.uncanny = UncannyChapters.init();
    this.catamin_stages = UncannyChapters.init();
    this.legend_quest = LegendQuestChapters.init();
    this.medals = Medals.init();
    this.gauntlets = GauntletChapters.init();
    this.enigma_clears = GauntletChapters.init();
    this.enigma = Enigma.init();
    this.cleared_slots = ClearedSlots.init();
    this.collab_gauntlets = GauntletChapters.init();
    this.talent_orbs = TalentOrbs.init();
    this.cat_shrine = CatShrine.init();
    this.aku = AkuChapters.init();
    this.behemoth_culling = GauntletChapters.init();
    this.zero_legends = ZeroLegendsChapters.init();
    this.dojo_chapters = ZeroLegendsChapters.init();
    this.wildcat_slots = GamblingEvent.init();
    this.cat_scratcher = GamblingEvent.init();
    this.uiid1 = new Map();
    this.uidd1 = new Map();
    this.uidiid2 = new Map();
    this.ushdshd2 = new Map();
    this.ushdd = new Map();
    this.ushdd2 = new Map();
    this.uidtii = new Map();
    this.uidtff = new Map();
    this.ushshd = new Map();
    this.ustid1 = new Map();
    this.uiid3 = new Map();
    this.uidd2 = new Map();
    this.uidd3 = new Map();
    this.ushd1 = new Map();
    this.uild1 = new Map();
    this.ushd2 = new Map();
    this.uid1 = new Map();
    this.first_locks = new Map();
    this.remaining_data = new Uint8Array(0);
  }

  is_jp(): boolean {
    return this.cc.equals(CountryCodeType.JP);
  }

  not_jp(): boolean {
    return !this.cc.equals(CountryCodeType.JP);
  }

  is_en(): boolean {
    return this.cc.equals(CountryCodeType.EN);
  }

  should_read_dst(): boolean {
    if (this.is_jp()) {
      return false;
    }
    return this.game_version.ge(49);
  }

  read_dst(): void {
    if (this.should_read_dst()) {
      this.dsts.push(this.data.read_bool());
    }
  }

  write_dst(): void {
    if (this.should_read_dst()) {
      const v = this.dsts[this.dst_index];
      this.data.write_bool(v === undefined ? false : v);
      this.dst_index += 1;
    }
  }

  calculate_user_rank(): number {
    let user_rank = 0;
    for (const cat of this.cats.cats) {
      if (!cat.unlocked) {
        continue;
      }
      user_rank += cat.upgrade.base + 1;
      user_rank += cat.upgrade.plus;
    }

    this.special_skills.skills.forEach((skill, i) => {
      if (i === 1) {
        return;
      }
      user_rank += skill.upgrade.base + 1;
      user_rank += skill.upgrade.plus;
    });

    return user_rank;
  }

  static get_string_identifier(identifier: string): string {
    return `_bcsfe:${identifier}`;
  }

  store_string(identifier: string, string: string, overwrite = true): void {
    const prefix = SaveFile.get_string_identifier(identifier);
    if (overwrite) {
      for (let i = 0; i < this.order_ids.length; i++) {
        if (this.order_ids[i].startsWith(prefix)) {
          this.order_ids[i] = `${prefix}:${string}`;
          return;
        }
      }
    }
    this.order_ids.push(`${prefix}:${string}`);
  }

  get_string(identifier: string): string | null {
    const prefix = SaveFile.get_string_identifier(identifier);
    for (const order of this.order_ids) {
      if (order.startsWith(prefix)) {
        return order.split(":")[2];
      }
    }
    return null;
  }

  get_strings(identifier: string): string[] {
    const prefix = SaveFile.get_string_identifier(identifier);
    const strings: string[] = [];
    for (const order of this.order_ids) {
      if (order.startsWith(prefix)) {
        strings.push(order.split(":")[2]);
      }
    }
    return strings;
  }

  remove_string(identifier: string): void {
    const prefix = SaveFile.get_string_identifier(identifier);
    for (let i = 0; i < this.order_ids.length; i++) {
      if (this.order_ids[i].startsWith(prefix)) {
        this.order_ids.splice(i, 1);
        return;
      }
    }
  }

  remove_strings(identifier: string): void {
    const prefix = SaveFile.get_string_identifier(identifier);
    this.order_ids = this.order_ids.filter(
      (order) => !order.startsWith(prefix),
    );
  }

  store_dict(
    identifier: string,
    dictionary: Record<string, string> | Map<string, string>,
    overwrite = true,
  ): void {
    if (overwrite) {
      this.remove_strings(identifier);
    }
    const entries =
      dictionary instanceof Map ? [...dictionary] : Object.entries(dictionary);
    for (const [key, value] of entries) {
      this.order_ids.push(
        `${SaveFile.get_string_identifier(identifier)}:${key}:${value}`,
      );
    }
  }

  get_dict(identifier: string): Record<string, string> | null {
    const prefix = SaveFile.get_string_identifier(identifier);
    const dictionary: Record<string, string> = {};
    for (const order of this.order_ids) {
      if (order.startsWith(prefix)) {
        const parts = order.split(":");
        dictionary[parts[2]] = parts[3];
      }
    }
    return dictionary;
  }

  remove_dict(identifier: string): void {
    this.remove_strings(identifier);
  }

  unlock_equip_menu(): void {
    this.menu_unlocks[2] = Math.max(this.menu_unlocks[2], 1);
  }

  get_xp(): number {
    return this.xp;
  }

  set_xp(xp: number): void {
    this.xp = xp;
  }

  get_catfood(): number {
    return this.catfood;
  }

  set_catfood(catfood: number): void {
    this.catfood = catfood;
  }

  get_normal_tickets(): number {
    return this.normal_tickets;
  }

  set_normal_tickets(normal_tickets: number): void {
    this.normal_tickets = normal_tickets;
  }

  get_rare_tickets(): number {
    return this.rare_tickets;
  }

  set_rare_tickets(rare_tickets: number): void {
    this.rare_tickets = rare_tickets;
  }

  get_platinum_tickets(): number {
    return this.platinum_tickets;
  }

  set_platinum_tickets(platinum_tickets: number): void {
    this.platinum_tickets = platinum_tickets;
  }

  get_legend_tickets(): number {
    return this.legend_tickets;
  }

  set_legend_tickets(legend_tickets: number): void {
    this.legend_tickets = legend_tickets;
  }

  get_platinum_shards(): number {
    return this.platinum_shards;
  }

  set_platinum_shards(platinum_shards: number): void {
    this.platinum_shards = platinum_shards;
  }

  get_np(): number {
    return this.np;
  }

  set_np(np: number): void {
    this.np = np;
  }

  get_leadership(): number {
    return this.leadership;
  }

  set_leadership(leadership: number): void {
    this.leadership = leadership;
  }

  max_rank_up_sale(): void {
    this.rank_up_sale_value = 0x7fffffff;
  }
}
