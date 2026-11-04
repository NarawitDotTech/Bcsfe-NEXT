import type { FeatureDef } from "@/features/types";
import { L, aliasesOf } from "./labels";
import { GoldPass, Playtime, ResetGamblingEvents, RestartPack, UnlockedSlots } from "./Simple";
import EnemyGuide from "./EnemyGuide";
import { Medals, Missions, UserRankRewards } from "./Selections";

const def = (key: string, component: FeatureDef["component"], extra: Partial<FeatureDef> = {}): FeatureDef => ({
  key, category: "other", label: L(key), aliases: aliasesOf(key), component, ...extra,
});

export const features: FeatureDef[] = [
  def("unlocked_slots", UnlockedSlots),
  def("reset_gambling_events", ResetGamblingEvents),
  def("restart_pack", RestartPack),
  def("playtime", Playtime),
  def("enemy_guide", EnemyGuide, { needsGameData: true }),
  def("user_rank_rewards", UserRankRewards, { needsGameData: true }),
  def("gold_pass", GoldPass),
  def("medals", Medals, { needsGameData: true }),
  def("missions", Missions, { needsGameData: true }),
];
