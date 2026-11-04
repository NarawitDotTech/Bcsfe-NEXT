/** Pure edit logic for the "other" feature group. */
import type { SaveFile } from "@/lib/bcsfe/core/io/save";
import { core_data } from "@/lib/bcsfe/core/core_data";
import { ConfigKey } from "@/lib/bcsfe/core/io/config";
import { GamblingEvent } from "@/lib/bcsfe/core/game/catbase/gambling";
import { PlayTime } from "@/lib/bcsfe/core/game/catbase/playtime";
import { NyankoClub } from "@/lib/bcsfe/core/game/catbase/nyanko_club";
import { Medals } from "@/lib/bcsfe/core/game/catbase/medals";
import { Missions } from "@/lib/bcsfe/core/game/catbase/mission";
import { Reward, type RankGift } from "@/lib/bcsfe/core/game/catbase/user_rank_rewards";

export function unlocked_slots_info(save: SaveFile): { value: number; max: number } {
  const max = save.lineups.slot_names_length;
  return { value: save.lineups.unlocked_slots, max: core_data.config.get_bool(ConfigKey.DISABLE_MAXES) ? 127 : max };
}
export function set_unlocked_slots(save: SaveFile, value: number): void {
  save.lineups.unlocked_slots = Math.max(0, Math.min(value, unlocked_slots_info(save).max));
}

export function reset_gambling_events(save: SaveFile): void {
  GamblingEvent.reset_events(save);
}

/** BasicItems.set_restart_pack */
export function set_restart_pack(save: SaveFile): void {
  save.restart_pack = 1;
}

export function get_playtime(save: SaveFile): { hours: number; minutes: number; seconds: number; frames: number } {
  const p = new PlayTime(save.officer_pass.play_time);
  return { hours: p.hours, minutes: p.just_minutes, seconds: p.just_seconds, frames: p.frames };
}
export function set_playtime(save: SaveFile, hours: number, minutes: number, seconds: number): void {
  const c = (n: number) => Math.max(0, Math.min(Math.trunc(n) || 0, 2 ** 31 - 1));
  const p = PlayTime.from_hours_mins_secs(c(hours), c(minutes), c(seconds));
  save.officer_pass.play_time = p.frames;
}

/** Blank = random, "-1" = remove. Returns applied officer id (-1 = removed). */
export function set_gold_pass(save: SaveFile, input: string): number {
  return NyankoClub.edit_gold_pass(save, input);
}

// ---- medals ----
export function medal_options(save: SaveFile, add: boolean): { id: number; label: string }[] {
  return Medals.get_medals_to_choose_from(save, add).map(([id, label]) => ({ id, label }));
}
export function apply_medals(save: SaveFile, ids: number[], add: boolean): void {
  Medals.apply_medal_selection(save, ids, add);
}

// ---- missions ----
export type MissionClaim = "complete_reward" | "complete_claim" | "uncomplete";
export function mission_options(save: SaveFile): { id: number; label: string; state: number }[] | null {
  const o = Missions.get_mission_options(save);
  if (o === null) return null;
  return o.mission_ids.map((id, i) => ({ id, label: o.options[i], state: save.missions.clear_states.get(id) ?? 0 }));
}
/** `ids` are mission ids (not option indexes). */
export function edit_missions(save: SaveFile, ids: number[], claim: MissionClaim): void {
  const o = Missions.get_mission_options(save);
  if (o === null) return;
  const idx = ids.map((id) => o.mission_ids.indexOf(id)).filter((i) => i >= 0);
  Missions.edit_missions(save, idx, claim === "complete_reward" ? 0 : claim === "complete_claim" ? 1 : 2);
}

// ---- user rank rewards ----
export type RankRewardChoice = "claim" | "unclaim";

/**
 * Saves written by older game versions can hold fewer reward flags than rankGift.csv has rows
 * (Python would IndexError). Temporarily pad with unclaimed rewards; `keep` makes the padding permanent.
 */
function with_padded_rewards<T>(save: SaveFile, keep: boolean, fn: () => T): T {
  const rewards = save.user_rank_rewards.rewards;
  const original = rewards.length;
  const gifts = core_data.get_rank_gifts(save).rank_gift ?? [];
  const needed = gifts.reduce((m, g) => Math.max(m, g.index + 1), 0);
  while (rewards.length < needed) rewards.push(Reward.init());
  try {
    return fn();
  } finally {
    if (!keep) rewards.length = original;
  }
}

export function rank_reward_options(
  save: SaveFile,
  choice: RankRewardChoice,
): { rank_gifts: RankGift[]; descriptions: string[] } | null {
  return with_padded_rewards(save, false, () =>
    save.user_rank_rewards.get_selectable_rank_gifts(save, choice === "claim" ? 0 : 1));
}
export function apply_rank_rewards(save: SaveFile, gifts: RankGift[], picked: number[], choice: RankRewardChoice): void {
  with_padded_rewards(save, true, () => save.user_rank_rewards.apply_claim(gifts, picked, choice === "claim" ? 0 : 1));
}
export function fix_claimed_rewards(save: SaveFile): boolean {
  return with_padded_rewards(save, false, () => save.user_rank_rewards.fix_claimed(save));
}
