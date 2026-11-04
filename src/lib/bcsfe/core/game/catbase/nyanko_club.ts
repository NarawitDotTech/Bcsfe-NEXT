import type { Data } from "@/lib/bcsfe/core/io/data";
import type { GameVersion } from "@/lib/bcsfe/core/game_version";
import type { SaveFile } from "@/lib/bcsfe/core/io/save";
import { mapToObject, objectToMap } from "@/lib/bcsfe/core/utils";

export class NyankoClub {
  officer_id: number;
  total_renewal_times: number;
  start_date_now: number;
  end_date_now: number;
  start_date_next: number;
  end_date_next: number;
  start_date_total: number;
  end_date_total: number;
  time_error_end: number;
  total_state_updates: number;
  login_bonus_date: number;
  claimed_rewards: Map<number, number>;
  remaing_days_popup: number;
  first_popup_flag: boolean;
  badge_flag: boolean | null;

  constructor(
    officer_id: number,
    total_renewal_times: number,
    start_date_now: number,
    end_date_now: number,
    start_date_next: number,
    end_date_next: number,
    start_date_total: number,
    end_date_total: number,
    time_error_end: number,
    total_state_updates: number,
    login_bonus_date: number,
    claimed_rewards: Map<number, number>,
    remaing_days_popup: number,
    first_popup_flag: boolean,
    badge_flag: boolean | null = null,
  ) {
    this.officer_id = officer_id;
    this.total_renewal_times = total_renewal_times;
    this.start_date_now = start_date_now;
    this.end_date_now = end_date_now;
    this.start_date_next = start_date_next;
    this.end_date_next = end_date_next;
    this.start_date_total = start_date_total;
    this.end_date_total = end_date_total;
    this.time_error_end = time_error_end;
    this.total_state_updates = total_state_updates;
    this.login_bonus_date = login_bonus_date;
    this.claimed_rewards = claimed_rewards;
    this.remaing_days_popup = remaing_days_popup;
    this.first_popup_flag = first_popup_flag;
    this.badge_flag = badge_flag;
  }

  static init(): NyankoClub {
    return new NyankoClub(0, 0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0, 0.0, new Map(), 0.0, false, false);
  }

  static read(data: Data, gv: GameVersion): NyankoClub {
    const officer_id = data.read_int();
    const total_renewal_times = data.read_int();
    const start_date_now = data.read_double();
    const end_date_now = data.read_double();
    const start_date_next = data.read_double();
    const end_date_next = data.read_double();
    const start_date_total = data.read_double();
    const end_date_total = data.read_double();
    const time_error_end = data.read_double();
    const total_state_updates = data.read_int();
    const login_bonus_date = data.read_double();
    const claimed_rewards = data.read_int_int_dict();
    const remaing_days_popup = data.read_double();
    const first_popup_flag = data.read_bool();
    const badge_flag = gv.ge(80100) ? data.read_bool() : null;
    return new NyankoClub(
      officer_id,
      total_renewal_times,
      start_date_now,
      end_date_now,
      start_date_next,
      end_date_next,
      start_date_total,
      end_date_total,
      time_error_end,
      total_state_updates,
      login_bonus_date,
      claimed_rewards,
      remaing_days_popup,
      first_popup_flag,
      badge_flag,
    );
  }

  write(data: Data, gv: GameVersion): void {
    data.write_int(this.officer_id);
    data.write_int(this.total_renewal_times);
    data.write_double(this.start_date_now);
    data.write_double(this.end_date_now);
    data.write_double(this.start_date_next);
    data.write_double(this.end_date_next);
    data.write_double(this.start_date_total);
    data.write_double(this.end_date_total);
    data.write_double(this.time_error_end);
    data.write_int(this.total_state_updates);
    data.write_double(this.login_bonus_date);
    data.write_int_int_dict(this.claimed_rewards);
    data.write_double(this.remaing_days_popup);
    data.write_bool(this.first_popup_flag);
    if (gv.ge(80100)) data.write_bool(this.badge_flag ?? false);
  }

  serialize(): Record<string, unknown> {
    return {
      officer_id: this.officer_id,
      total_renewal_times: this.total_renewal_times,
      start_date_now: this.start_date_now,
      end_date_now: this.end_date_now,
      start_date_next: this.start_date_next,
      end_date_next: this.end_date_next,
      start_date_total: this.start_date_total,
      end_date_total: this.end_date_total,
      time_error_end: this.time_error_end,
      total_state_updates: this.total_state_updates,
      login_bonus_date: this.login_bonus_date,
      claimed_rewards: mapToObject(this.claimed_rewards),
      remaing_days_popup: this.remaing_days_popup,
      first_popup_flag: this.first_popup_flag,
      badge_flag: this.badge_flag,
    };
  }

  static deserialize(data: Record<string, unknown>): NyankoClub {
    const n = (k: string, d: number) => (data[k] as number | undefined) ?? d;
    return new NyankoClub(
      n("officer_id", 0),
      n("total_renewal_times", 0),
      n("start_date_now", 0.0),
      n("end_date_now", 0.0),
      n("start_date_next", 0.0),
      n("end_date_next", 0.0),
      n("start_date_total", 0.0),
      n("end_date_total", 0.0),
      n("time_error_end", 0.0),
      n("total_state_updates", 0),
      n("login_bonus_date", 0.0),
      objectToMap(data["claimed_rewards"] as Record<string, number> | undefined),
      n("remaing_days_popup", 0.0),
      (data["first_popup_flag"] as boolean | undefined) ?? false,
      (data["badge_flag"] as boolean | undefined) ?? false,
    );
  }

  get_gold_pass(officer_id: number, total_days: number, save_file: SaveFile): void {
    this.officer_id = officer_id;
    const start_date_now = Math.floor(Date.now() / 1000);
    const end_date_now = start_date_now + total_days * 86400;
    const end_date_total = start_date_now + total_days * 2 * 86400;

    this.total_renewal_times = 2;
    this.start_date_now = start_date_now;
    this.end_date_now = end_date_now;

    this.start_date_next = end_date_now;
    this.end_date_next = end_date_total;

    this.start_date_total = start_date_now;
    this.end_date_total = end_date_total;

    this.time_error_end = start_date_now;

    this.total_state_updates = 2;

    this.login_bonus_date = end_date_now;

    this.remaing_days_popup = 0.0;
    this.first_popup_flag = true;
    this.badge_flag = false;

    const login = save_file.logins.get_login(5100);
    if (login !== null) login.count = 0;

    this.claimed_rewards = new Map();
  }

  remove_gold_pass(save_file: SaveFile): void {
    this.officer_id = -1;
    this.total_renewal_times = 0;
    this.start_date_now = 0.0;
    this.end_date_now = 0.0;
    this.start_date_next = 0.0;
    this.end_date_next = 0.0;
    this.start_date_total = 0.0;
    this.end_date_total = 0.0;
    this.time_error_end = 0.0;
    this.total_state_updates = 0;
    this.login_bonus_date = 0.0;
    this.remaing_days_popup = 0.0;
    this.first_popup_flag = false;
    this.badge_flag = false;

    const login = save_file.logins.get_login(5100);
    if (login !== null) login.count = 0;

    this.claimed_rewards = new Map();
  }

  static get_random_officer_id(): number {
    return 1 + Math.floor(Math.random() * (2 ** 16 - 1));
  }

  /**
   * Pure version of the interactive Python `edit_gold_pass`. `officer_id_input` is the
   * raw text the user would have typed (empty/invalid -> random id, "-1" -> remove).
   * Returns the officer id applied (-1 when removed).
   */
  static edit_gold_pass(save_file: SaveFile, officer_id_input: string | number = ""): number {
    const club = save_file.officer_pass.gold_pass;
    const text = String(officer_id_input).trim();
    let officer_id: number;
    if (!text) {
      officer_id = NyankoClub.get_random_officer_id();
      officer_id = Math.min(Math.max(officer_id, 0), 2 ** 31 - 1);
    } else if (text === "-1") {
      officer_id = -1;
    } else {
      officer_id = /^[+-]?\d+$/.test(text) ? parseInt(text, 10) : NyankoClub.get_random_officer_id();
      officer_id = Math.min(Math.max(officer_id, 0), 2 ** 31 - 1);
    }

    if (officer_id === -1) club.remove_gold_pass(save_file);
    else club.get_gold_pass(officer_id, 30, save_file);
    return officer_id;
  }
}
