/** Port of bcsfe/cli/edits/clear_tutorial.py */
import type { SaveFile } from "@/lib/bcsfe/core/io/save";
import { StoryChapters } from "@/lib/bcsfe/core/game/map/story";

export function clear_tutorial(save: SaveFile): void {
  StoryChapters.clear_tutorial(save);
}
