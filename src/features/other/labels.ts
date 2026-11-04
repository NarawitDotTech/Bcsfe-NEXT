import { core_data } from "@/lib/bcsfe/core/core_data";
import { LocalManager, strip_color_tags } from "@/lib/bcsfe/core/locale_handler";

/** English label (first alias) for a locale key, colour tags stripped. */
export function L(key: string, fallback = key): string {
  try {
    return strip_color_tags(LocalManager.get_all_aliases(core_data.local_manager.get_key(key))[0]);
  } catch {
    return fallback;
  }
}
export function aliasesOf(key: string): string[] {
  try {
    return LocalManager.get_all_aliases(core_data.local_manager.get_key(key)).slice(1).map(strip_color_tags);
  } catch {
    return [];
  }
}
