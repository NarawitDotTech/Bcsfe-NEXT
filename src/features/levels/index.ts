import { createElement } from "react";
import type { FeatureDef } from "@/features/types";
import { strip_color_tags } from "@/lib/bcsfe/core/locale_handler";
import en from "@/lib/bcsfe/files/locales/en.json";
import type { MapTargetKey } from "@/lib/bcsfe/edits/map";
import { ChapterEditor } from "./ChapterEditor";
import { ClearStoryPanel, ItfTimedScoresPanel, OutbreaksPanel, StoryTreasuresPanel } from "./StoryPanels";
import {
  AddEnigmaPanel, AkuChaptersPanel, CataminStagesPanel, ChallengeScorePanel, ClearTutorialPanel, DojoScorePanel,
  FilibusterPanel, UnlockAkuRealmPanel,
} from "./MiscPanels";

/** English label + aliases from the locale file (`a|b|c` = display name followed by aliases). */
function names(key: string): { label: string; aliases: string[] } {
  const raw = ((en as Record<string, unknown>)[key] as string | undefined) ?? key;
  const [label, ...aliases] = raw.split("|").map((s) => strip_color_tags(s).trim());
  return { label, aliases: [key.replace(/_/g, " "), ...aliases] };
}

function def(key: string, component: FeatureDef["component"], extra: Partial<FeatureDef> = {}): FeatureDef {
  const { label, aliases } = names(key);
  return { key, category: "levels", label, component, ...extra, aliases: [...aliases, ...(extra.aliases ?? [])] };
}

function chapters(key: string, target: MapTargetKey, extra: Partial<FeatureDef> = {}, props: { warning?: boolean } = {}): FeatureDef {
  const { label } = names(key);
  const component = () => createElement(ChapterEditor, { target, title: label, ...props });
  component.displayName = `Chapters(${key})`;
  return def(key, component, { needsGameData: true, ...extra });
}

export const features: FeatureDef[] = [
  def("clear_tutorial", ClearTutorialPanel, { aliases: ["tutorial", "skip tutorial"] }),
  def("clear_story", ClearStoryPanel, { needsGameData: true, aliases: ["eoc", "itf", "cotc", "empire of cats", "into the future", "cats of the cosmos"] }),
  def("challenge_score", ChallengeScorePanel),
  def("dojo_score", DojoScorePanel, { aliases: ["ranking dojo"] }),
  def("add_enigma_stages", AddEnigmaPanel, { needsGameData: true, aliases: ["enigma"] }),
  chapters("clear_enigma_stages", "enigma_clears", { aliases: ["enigma"] }),
  def("unlock_aku_realm", UnlockAkuRealmPanel, { aliases: ["aku"] }),
  def("story_treasures", StoryTreasuresPanel, { needsGameData: true, aliases: ["treasure", "treasures"] }),
  def("outbreaks", OutbreaksPanel, { needsGameData: true, aliases: ["zombie", "zombies"] }),
  def("aku_chapters", AkuChaptersPanel, { needsGameData: true, aliases: ["aku realm", "dark emperor"] }),
  def("itf_timed_scores", ItfTimedScoresPanel, { needsGameData: true, aliases: ["timed score", "time score"] }),
  def("filibuster_reclearing", FilibusterPanel, { aliases: ["filibuster", "reclear"] }),
  chapters("sol", "sol", { aliases: ["legend stages", "n"] }),
  chapters("event", "event", { aliases: ["event stages", "s"] }),
  chapters("collab", "collab", { aliases: ["collaboration", "c"] }),
  chapters("gauntlets", "gauntlets"),
  chapters("collab_gauntlets", "collab_gauntlets", { aliases: ["collaboration gauntlets"] }),
  chapters("uncanny", "uncanny", { aliases: ["uncanny legends"] }),
  def("catamin_stages", CataminStagesPanel, { needsGameData: true, aliases: ["catamin"] }),
  chapters("behemoth_culling", "behemoth_culling", { aliases: ["behemoth"] }),
  chapters("legend_quest", "legend_quest"),
  chapters("towers", "towers", { aliases: ["tower"] }),
  chapters("zero_legends", "zero_legends", {}, { warning: true }),
  chapters("dojo_catclaw_championships", "dojo_catclaw_championships", { aliases: ["catclaw", "championships"] }),
];
