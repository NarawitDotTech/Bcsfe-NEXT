/**
 * Port of bcsfe/core/max_value_helper.py
 * There is no bundled data file upstream: the values come from a user config (max_values.json),
 * which in the browser is persisted in localStorage.
 */

export interface MaxValues {
  catfood: number;
  xp: number;
  normal_tickets: number;
  hundred_million_tickets: number;
  rare_tickets: number;
  platinum_tickets: number;
  legend_tickets: number;
  np: number;
  leadership: number;
  battle_items: number;
  catamins: number;
  catseyes: number;
  catfruit_old: number;
  catfruit_new: number;
  base_materials: number;
  labyrinth_medals: number;
  talent_orbs: number;
  treasure_level: number;
  stage_clear_count: number;
  itf_timed_score: number;
  event_tickets: number;
  treasure_chests: number;
}

export const MAX_VALUE_DEFAULTS: MaxValues = {
  catfood: 45000,
  xp: 99999999,
  normal_tickets: 2999,
  hundred_million_tickets: 9999,
  rare_tickets: 299,
  platinum_tickets: 9,
  legend_tickets: 4,
  np: 9999,
  leadership: 9999,
  battle_items: 9999,
  catamins: 9999,
  catseyes: 9999,
  catfruit_old: 128,
  catfruit_new: 998,
  base_materials: 9999,
  labyrinth_medals: 9999,
  talent_orbs: 998,
  treasure_level: 9999,
  stage_clear_count: 9999,
  itf_timed_score: 9999,
  event_tickets: 9999,
  treasure_chests: 9999,
};

const STORAGE_KEY = "bcsfe:max_values";

export class MaxValueHelper implements MaxValues {
  catfood!: number;
  xp!: number;
  normal_tickets!: number;
  hundred_million_tickets!: number;
  rare_tickets!: number;
  platinum_tickets!: number;
  legend_tickets!: number;
  np!: number;
  leadership!: number;
  battle_items!: number;
  catamins!: number;
  catseyes!: number;
  catfruit_old!: number;
  catfruit_new!: number;
  base_materials!: number;
  labyrinth_medals!: number;
  talent_orbs!: number;
  treasure_level!: number;
  stage_clear_count!: number;
  itf_timed_score!: number;
  event_tickets!: number;
  treasure_chests!: number;

  constructor(values: MaxValues) {
    Object.assign(this, values);
  }

  static default(): MaxValueHelper {
    return MaxValueHelper.from_dict({});
  }

  as_dict(): MaxValues {
    const out = {} as Record<string, number>;
    for (const k of Object.keys(MAX_VALUE_DEFAULTS)) out[k] = (this as unknown as Record<string, number>)[k];
    return out as unknown as MaxValues;
  }

  static from_dict(data: Partial<Record<string, unknown>>): MaxValueHelper {
    const out = {} as Record<string, number>;
    for (const [k, def] of Object.entries(MAX_VALUE_DEFAULTS)) {
      const v = data[k];
      out[k] = typeof v === "number" && Number.isFinite(v) ? v : def;
    }
    return new MaxValueHelper(out as unknown as MaxValues);
  }

  private static storage(): Storage | null {
    try {
      return typeof window === "undefined" ? null : window.localStorage;
    } catch {
      return null;
    }
  }

  static from_file(): MaxValueHelper {
    const st = MaxValueHelper.storage();
    if (!st) return MaxValueHelper.default();
    try {
      const raw = st.getItem(STORAGE_KEY);
      if (raw) {
        const parsed: unknown = JSON.parse(raw);
        if (parsed && typeof parsed === "object") {
          return MaxValueHelper.from_dict(parsed as Record<string, unknown>);
        }
      }
    } catch {
      /* fall through to defaults */
    }
    const item = MaxValueHelper.default();
    item.save();
    return item;
  }

  save(): void {
    const st = MaxValueHelper.storage();
    if (!st) return;
    try {
      st.setItem(STORAGE_KEY, JSON.stringify(this.as_dict()));
    } catch {
      /* ignore */
    }
  }
}
