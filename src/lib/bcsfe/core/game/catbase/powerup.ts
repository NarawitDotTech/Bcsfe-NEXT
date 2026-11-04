/** Port of bcsfe/core/game/catbase/powerup.py */
import type { SaveFile } from "@/lib/bcsfe/core/io/save";
import type { Cat, UnitBuy, UnitBuyCatData, UnitLimitCatData } from "@/lib/bcsfe/core/game/catbase/cat";
import type { RankGifts } from "@/lib/bcsfe/core/game/catbase/user_rank_rewards";
import { core_data } from "@/lib/bcsfe/core/core_data";
import { ConfigKey } from "@/lib/bcsfe/core/config";

export class PowerUpHelper {
  unit_limit: UnitLimitCatData | null;
  all_unit_buy: UnitBuy;
  unit_buy: UnitBuyCatData | null;
  rank_gifts: RankGifts;
  max_upgrade_level: number;

  constructor(
    public cat: Cat,
    public save_file: SaveFile,
  ) {
    this.unit_limit = this.save_file.cats.read_unitlimit(this.save_file).get_unit_limit(this.cat.id);
    this.all_unit_buy = this.save_file.cats.read_unitbuy(this.save_file);
    this.unit_buy = this.all_unit_buy.get_unit_buy(this.cat.id);
    this.rank_gifts = this.save_file.user_rank_rewards.read_rank_gifts(this.save_file);
    this.max_upgrade_level = this.get_max_upgrade_level_check();
  }

  get_current_max_level(): number | null {
    if (this.unit_buy === null) return null;
    return Math.min(
      this.unit_buy.original_max_levels[0] + this.max_upgrade_level,
      this.unit_buy.max_upgrade_level_catseye,
    );
  }

  has_strict_upgrade(): boolean {
    return core_data.config.get_bool(ConfigKey.STRICT_UPGRADE);
  }

  get_upgrade_state_check(): number {
    if (!this.has_strict_upgrade()) return 100000;
    return this.save_file.upgrade_state;
  }

  get_user_rank_check(): number {
    if (!this.has_strict_upgrade()) return 1000000;
    return this.save_file.calculate_user_rank();
  }

  private get_max_upgrade_level_check(): number {
    if (this.unit_limit === null) return this.cat.max_upgrade_level.base;

    const rewards = this.save_file.user_rank_rewards;
    this.cat.max_upgrade_level.reset();

    const strict_upgrade = this.has_strict_upgrade();

    for (let reward_id = 0; reward_id < rewards.rewards.length; reward_id++) {
      const rank_gift = this.rank_gifts.get_by_id(reward_id);
      if (rank_gift === null) continue;
      const user_rank_reward = rewards.rewards[reward_id];
      if (!user_rank_reward.claimed && strict_upgrade) continue;
      for (const present of rank_gift.rewards) {
        if (present[0] >= 1000 && present[0] <= 1599) {
          for (const limit of this.unit_limit.values) {
            if (limit === present[0]) this.cat.max_upgrade_level.increment_base(present[1]);
          }
        } else if (present[0] >= 4000 && present[0] <= 4599) {
          for (const limit of this.unit_limit.values) {
            if (limit === present[0]) this.cat.max_upgrade_level.increment_plus(present[1]);
          }
        }
      }
    }

    return this.cat.max_upgrade_level.base;
  }

  can_power_up(): boolean {
    if (this.unit_buy === null) return false;
    const base_level = this.cat.upgrade.get_base();
    const current_max_level = this.get_current_max_level();
    if (current_max_level === null) return false;

    if (
      base_level >= current_max_level ||
      ((this.get_upgrade_state_check() > 1 || base_level === this.unit_buy.unknown_22) &&
        this.get_upgrade_state_check() < 2)
    ) {
      return (
        this.unit_buy.rarity !== 0 &&
        base_level >= this.unit_buy.max_upgrade_level_no_catseye &&
        base_level < this.unit_buy.max_upgrade_level_catseye &&
        base_level < current_max_level
      );
    }
    return true;
  }

  can_use_catseye(): boolean {
    if (this.unit_buy === null) return false;
    const base_level = this.cat.upgrade.get_base();
    return (
      this.unit_buy.rarity !== 0 &&
      base_level >= this.unit_buy.max_upgrade_level_no_catseye &&
      this.unit_buy.max_upgrade_level_no_catseye !== -1 &&
      this.get_user_rank_check() >= 1600
    );
  }

  upgrade_cat(force = false): boolean {
    if (force) {
      this.cat.upgrade_base(this.save_file);
      return true;
    }
    if (this.unit_buy === null) return false;
    const current_max_level = this.get_current_max_level();
    if (current_max_level === null) return false;

    if (this.can_power_up()) {
      this.cat.upgrade_base(this.save_file);
      return true;
    }

    if (this.can_use_catseye() && this.unit_buy.max_upgrade_level_no_catseye <= current_max_level) {
      if (this.cat.upgrade.get_base() < this.unit_buy.max_upgrade_level_catseye) {
        this.cat.upgrade_base(this.save_file);
        this.cat.catseyes_used += 1;
        this.cat.max_upgrade_level.upgrade();
        return true;
      }
      return false;
    }
    return false;
  }

  get_max_max_base_upgrade_level(): number {
    let max_level = 0;
    if (this.all_unit_buy.unit_buy === null) return 90;
    for (const unit_buy of this.all_unit_buy.unit_buy) {
      if (unit_buy.max_upgrade_level_catseye > max_level) max_level = unit_buy.max_upgrade_level_catseye;
    }
    return max_level;
  }

  get_max_max_plus_upgrade_level(): number {
    let max_level = 0;
    if (this.all_unit_buy.unit_buy === null) return 90;
    for (const unit_buy of this.all_unit_buy.unit_buy) {
      if (unit_buy.max_plus_upgrade_level > max_level) max_level = unit_buy.max_plus_upgrade_level;
    }
    return max_level;
  }

  get_max_possible_base(): number {
    if (this.unit_buy === null) return 90;
    return this.unit_buy.max_upgrade_level_catseye;
  }

  get_max_possible_plus(): number {
    if (this.unit_buy === null) return 90;
    return this.unit_buy.max_plus_upgrade_level;
  }

  reset_upgrade(): void {
    this.cat.upgrade.base = 0;
    this.cat.catseyes_used = 0;
  }

  upgrade_by(amount: number): void {
    if (amount === -1) return;
    for (let i = 0; i < amount; i++) {
      const did_upgrade = this.upgrade_cat();
      if (!did_upgrade) break;
    }
  }

  max_upgrade(): void {
    while (this.upgrade_cat()) {
      // keep upgrading
    }
  }
}
