/** Port of bcsfe/core/game/catbase/user_rank_rewards.py */
import type { Data } from "@/lib/bcsfe/core/io/data";
import type { SaveFile } from "@/lib/bcsfe/core/io/save";
import type { GameVersion } from "@/lib/bcsfe/core/game_version";
import { CSV } from "@/lib/bcsfe/core/io/bc_csv";
import { core_data } from "@/lib/bcsfe/core/core_data";
import { times } from "@/lib/bcsfe/core/utils";

export class RankGift {
  constructor(
    public index: number,
    public threshold: number,
    public rewards: [number, number][],
  ) {}

  get_name(rank_gift_descriptions: RankGiftDescriptions): string | null {
    return rank_gift_descriptions.get_name(this.threshold);
  }
}

export class RankGifts {
  rank_gift: RankGift[] | null;

  constructor(public save_file: SaveFile) {
    this.rank_gift = this.read_rank_gift();
  }

  read_rank_gift(): RankGift[] | null {
    const rank_gift: RankGift[] = [];
    const gdg = core_data.get_game_data_getter(this.save_file);
    const data = gdg.download("DataLocal", "rankGift.csv");
    if (data === null) return null;
    const csv = new CSV(data);
    let i = 0;
    for (const line of csv) {
      const rewards: [number, number][] = [];
      for (let col = 1; col < line.length; col += 2) {
        const value = line.get(col).to_int();
        if (value === -1) break;
        rewards.push([value, line.get(col + 1).to_int()]);
      }
      rank_gift.push(new RankGift(i, line.get(0).to_int(), rewards));
      i++;
    }
    return rank_gift;
  }

  get_rank_gift(user_rank: number): RankGift | null {
    if (this.rank_gift === null) return null;
    for (const rank_gift of this.rank_gift) {
      if (rank_gift.threshold === user_rank) return rank_gift;
    }
    return null;
  }

  get_all_rank_gifts(user_rank: number): RankGift[] | null {
    if (this.rank_gift === null) return null;
    return this.rank_gift.filter((g) => g.threshold <= user_rank);
  }

  get_by_id(id: number): RankGift | null {
    if (this.rank_gift === null) return null;
    if (id >= this.rank_gift.length || id < 0) return null;
    return this.rank_gift[id];
  }

  get_all_unlocked(user_rank: number): RankGift[] | null {
    if (this.rank_gift === null) return null;
    return this.rank_gift.filter((g) => g.threshold <= user_rank);
  }
}

export class RankGiftDescription {
  constructor(
    public index: number,
    public threshold: number,
    public description: string,
  ) {}
}

export class RankGiftDescriptions {
  rank_gift_descriptions: RankGiftDescription[] | null;

  constructor(public save_file: SaveFile) {
    this.rank_gift_descriptions = this.read_rank_gift_descriptions();
  }

  read_rank_gift_descriptions(): RankGiftDescription[] | null {
    const out: RankGiftDescription[] = [];
    const gdg = core_data.get_game_data_getter(this.save_file);
    const data = gdg.download("resLocal", "user_info.tsv");
    if (data === null) return null;
    const csv = new CSV(data, "\t");
    let i = 0;
    for (const line of csv) {
      out.push(new RankGiftDescription(i, line.get(0).to_int(), line.get(1).to_str()));
      i++;
    }
    return out;
  }

  get_name(user_rank: number): string | null {
    if (this.rank_gift_descriptions === null) return null;
    for (const d of this.rank_gift_descriptions) {
      if (d.threshold === user_rank) return d.description;
    }
    return null;
  }
}

export class Reward {
  constructor(public claimed: boolean) {}

  static init(): Reward {
    return new Reward(false);
  }

  static read(stream: Data): Reward {
    return new Reward(stream.read_bool());
  }

  write(stream: Data): void {
    stream.write_bool(this.claimed);
  }

  serialize(): boolean {
    return this.claimed;
  }

  static deserialize(data: boolean): Reward {
    return new Reward(data);
  }
}

/** Claim modes used by the (formerly interactive) edit: 0 = claim, 1 = unclaim, 2 = fix claimed */
export class UserRankRewards {
  rank_gifts: RankGifts | null = null;

  constructor(public rewards: Reward[]) {}

  read_rank_gifts(save_file: SaveFile): RankGifts {
    if (this.rank_gifts === null) this.rank_gifts = new RankGifts(save_file);
    return this.rank_gifts;
  }

  static init(gv: GameVersion): UserRankRewards {
    const total = gv.ge(30) ? 0 : 50;
    return new UserRankRewards(times(total, () => Reward.init()));
  }

  static read(stream: Data, gv: GameVersion): UserRankRewards {
    const total = gv.ge(30) ? stream.read_int() : 50;
    const rewards: Reward[] = [];
    for (let i = 0; i < total; i++) rewards.push(Reward.read(stream));
    return new UserRankRewards(rewards);
  }

  write(stream: Data, gv: GameVersion): void {
    if (gv.ge(30)) stream.write_int(this.rewards.length);
    for (const reward of this.rewards) reward.write(stream);
  }

  serialize(): boolean[] {
    return this.rewards.map((r) => r.serialize());
  }

  static deserialize(data: boolean[]): UserRankRewards {
    return new UserRankRewards(data.map((r) => Reward.deserialize(r)));
  }

  set_claimed(index: number, claimed: boolean): void {
    this.rewards[index].claimed = claimed;
  }

  /** Choice 2 of the Python `edit`: unclaim every reward above the user's current rank. */
  fix_claimed(save_file: SaveFile): boolean {
    const rank_gifts = core_data.get_rank_gifts(save_file);
    if (rank_gifts.rank_gift === null) return false;
    const user_rank = save_file.calculate_user_rank();
    for (const rank_gift of rank_gifts.rank_gift) {
      const reward = this.rewards[rank_gift.index];
      if (rank_gift.threshold > user_rank) reward.claimed = false;
    }
    return true;
  }

  /**
   * Non-interactive part of the Python `edit` for claim_choice 0 (claim) / 1 (unclaim):
   * returns the selectable rank gifts (sorted by threshold) together with display
   * descriptions (HTML tags stripped), or null on missing data.
   * `ur_string_fn(description, rank)` formats the final label (defaults to "description (rank)").
   */
  get_selectable_rank_gifts(
    save_file: SaveFile,
    claim_choice: number,
    ur_string_fn: (description: string, rank: number) => string = (d, r) =>
      core_data.local_manager.get_key("ur_string", { description: d, rank: r }),
  ): { rank_gifts: RankGift[]; descriptions: string[] } | null {
    const rank_gifts = core_data.get_rank_gifts(save_file);
    if (rank_gifts.rank_gift === null) return null;
    const user_rank = save_file.calculate_user_rank();
    const descriptions = core_data.get_rank_gift_descriptions(save_file);

    const sorted = rank_gifts.rank_gift.slice();
    sorted.sort((a, b) => a.threshold - b.threshold);

    const selected: RankGift[] = [];
    for (const rank_gift of sorted) {
      const reward = this.rewards[rank_gift.index];
      if (reward.claimed && claim_choice === 0) continue;
      if (!reward.claimed && claim_choice === 1) continue;
      if (rank_gift.threshold > user_rank) continue;
      selected.push(rank_gift);
    }

    const selected_descriptions: string[] = [];
    for (const rank_gift of selected) {
      const name = rank_gift.get_name(descriptions);
      if (name === null) return null;
      let description = name.split("<br>").join(" ");
      // remove span tags (faithful to the Python, which searches ">" from index 0)
      let start = description.indexOf("<");
      while (start !== -1) {
        const end = description.indexOf(">");
        description = description.slice(0, start) + description.slice(end + 1);
        start = description.indexOf("<");
      }
      selected_descriptions.push(ur_string_fn(description, rank_gift.threshold));
    }
    return { rank_gifts: selected, descriptions: selected_descriptions };
  }

  /** Apply the selection (indexes into the list from get_selectable_rank_gifts). */
  apply_claim(selected_rank_gifts: RankGift[], ids: number[], claim_choice: number): void {
    for (const id of ids) {
      this.set_claimed(selected_rank_gifts[id].index, claim_choice === 0);
    }
  }
}
