/**
 * Port of bcsfe/core/io/config.py
 *
 * Browser version: values are persisted as JSON in localStorage (when available).
 * The CLI dialog code (edit_*) is not ported; use CONFIG_ENTRIES for building a settings UI.
 */

export enum ConfigKey {
  UPDATE_TO_BETA = "update_to_beta",
  LOCALE = "locale",
  SHOW_MISSING_LOCALE_KEYS = "show_missing_locale_keys",
  DISABLE_MAXES = "disable_maxes",
  MAX_BACKUPS = "max_backups",
  THEME = "theme",
  RESET_CAT_DATA = "reset_cat_data",
  SET_CAT_CURRENT_FORMS = "set_cat_current_forms",
  STRICT_UPGRADE = "strict_upgrade",
  SEPARATE_CAT_EDIT_OPTIONS = "separate_cat_edit_options",
  STRICT_BAN_PREVENTION = "strict_ban_prevention",
  MAX_REQUEST_TIMEOUT = "max_request_timeout",
  GAME_DATA_REPO = "game_data_repo",
  FORCE_LANG_GAME_DATA = "force_lang_game_data",
  CLEAR_TUTORIAL_ON_LOAD = "clear_tutorial_on_load",
  REMOVE_BAN_MESSAGE_ON_LOAD = "remove_ban_message_on_load",
  UNLOCK_CAT_ON_EDIT = "unlock_cat_on_edit",
  USE_FILE_DIALOG = "use_file_dialog",
  ADB_PATH = "adb_path",
  IGNORE_PARSE_ERROR = "ignore_parse_error",
  USE_PKEXEC_WAYDROID = "use_pkexec_waydroid",
}

export type ConfigValue = string | number | boolean;

export const DEFAULT_GAME_DATA_REPO =
  "https://git.battlecatsmodding.org/fieryhenry/BCData/raw/branch/main/metadata.json";
export const ALT_GAME_DATA_REPO = "https://gitlab.com/fieryhenry/bcdata/-/raw/main/metadata.json";

export type ConfigValueType = "bool" | "int" | "string";

export interface ConfigEntry {
  key: ConfigKey;
  type: ConfigValueType;
  default: ConfigValue;
  /** Locale key holding the short title (same as key.value). */
  label_key: string;
  /** Locale key holding the long description (`<key>_desc`). It contains a {{config_value_txt}} placeholder: pass current_value/default_value params. */
  desc_key: string;
  /** Whether this option makes sense in the browser (false for adb / waydroid / tkinter dialog / updater options). */
  browser_relevant: boolean;
  /** For int options: sensible bounds for an input. */
  min?: number;
  max?: number;
}

const BROWSER_IRRELEVANT = new Set<ConfigKey>([
  ConfigKey.UPDATE_TO_BETA,
  ConfigKey.THEME,
  ConfigKey.USE_FILE_DIALOG,
  ConfigKey.ADB_PATH,
  ConfigKey.USE_PKEXEC_WAYDROID,
]);

const STORAGE_KEY = "bcsfe:config";

export class Config {
  config: Map<ConfigKey, ConfigValue | null> = new Map();

  constructor() {
    const stored = Config.load_stored();
    const valid = new Set<string>(Object.values(ConfigKey));
    for (const [k, v] of Object.entries(stored)) {
      if (valid.has(k)) this.config.set(k as ConfigKey, v);
    }
    this.initialize_config();
  }

  private static storage(): Storage | null {
    try {
      if (typeof window === "undefined") return null;
      return window.localStorage;
    } catch {
      return null;
    }
  }

  private static load_stored(): Record<string, ConfigValue> {
    const st = Config.storage();
    if (!st) return {};
    try {
      const raw = st.getItem(STORAGE_KEY);
      if (!raw) return {};
      const parsed: unknown = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, ConfigValue>;
      }
    } catch {
      /* ignore corrupt data */
    }
    return {};
  }

  static get_defaults(): Record<ConfigKey, ConfigValue> {
    return {
      [ConfigKey.UPDATE_TO_BETA]: false,
      [ConfigKey.LOCALE]: "en",
      [ConfigKey.SHOW_MISSING_LOCALE_KEYS]: false,
      [ConfigKey.DISABLE_MAXES]: false,
      [ConfigKey.MAX_BACKUPS]: 50,
      [ConfigKey.THEME]: "default",
      [ConfigKey.RESET_CAT_DATA]: true,
      [ConfigKey.SET_CAT_CURRENT_FORMS]: true,
      [ConfigKey.STRICT_UPGRADE]: false,
      [ConfigKey.SEPARATE_CAT_EDIT_OPTIONS]: true,
      [ConfigKey.STRICT_BAN_PREVENTION]: false,
      [ConfigKey.MAX_REQUEST_TIMEOUT]: 30,
      [ConfigKey.GAME_DATA_REPO]: DEFAULT_GAME_DATA_REPO,
      [ConfigKey.FORCE_LANG_GAME_DATA]: false,
      [ConfigKey.CLEAR_TUTORIAL_ON_LOAD]: true,
      [ConfigKey.REMOVE_BAN_MESSAGE_ON_LOAD]: true,
      [ConfigKey.UNLOCK_CAT_ON_EDIT]: true,
      [ConfigKey.USE_FILE_DIALOG]: true,
      [ConfigKey.ADB_PATH]: "adb",
      [ConfigKey.IGNORE_PARSE_ERROR]: false,
      [ConfigKey.USE_PKEXEC_WAYDROID]: true,
    };
  }

  get_default(key: ConfigKey): ConfigValue {
    return Config.get_defaults()[key];
  }

  set_default(key: ConfigKey): ConfigValue {
    const value = this.get_default(key);
    this.config.set(key, value);
    this.save();
    return value;
  }

  initialize_config(): void {
    for (const [key, value] of Object.entries(Config.get_defaults())) {
      if (!this.config.has(key as ConfigKey)) this.config.set(key as ConfigKey, value);
    }
    this.save();
  }

  save(): void {
    const st = Config.storage();
    if (!st) return;
    const obj: Record<string, ConfigValue | null> = {};
    for (const [k, v] of this.config) obj[k] = v;
    try {
      st.setItem(STORAGE_KEY, JSON.stringify(obj));
    } catch {
      /* quota / private mode */
    }
  }

  has(key: ConfigKey): boolean {
    return this.config.has(key);
  }

  get(key: ConfigKey): ConfigValue {
    const value = this.config.get(key);
    if (value === null || value === undefined) return this.set_default(key);
    return value;
  }

  get_game_data_repo(fix_old_repo = true): string {
    if (
      fix_old_repo &&
      [
        "https://raw.githubusercontent.com/fieryhenry/BCData/master/",
        "https://git.fyhenry.uk/henry/BCData/raw/branch/main/info.json",
      ].includes(this.get_str(ConfigKey.GAME_DATA_REPO))
    ) {
      this.set(ConfigKey.GAME_DATA_REPO, this.get_default(ConfigKey.GAME_DATA_REPO));
    }
    return this.get_str(ConfigKey.GAME_DATA_REPO);
  }

  get_str(key: ConfigKey): string {
    const value = this.get(key);
    if (typeof value !== "string") return this.set_default(key) as string;
    return value;
  }

  get_bool(key: ConfigKey): boolean {
    const value = this.get(key);
    if (typeof value !== "boolean") return this.set_default(key) as boolean;
    return value;
  }

  get_int(key: ConfigKey): number {
    const value = this.get(key);
    if (typeof value !== "number" || !Number.isInteger(value)) return this.set_default(key) as number;
    return value;
  }

  reset(): void {
    this.config.clear();
    const st = Config.storage();
    try {
      st?.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    this.initialize_config();
  }

  set(key: ConfigKey, value: ConfigValue): void {
    this.config.set(key, value);
    this.save();
  }

  static get_desc_key(key: ConfigKey): string {
    return key + "_desc";
  }
}

export const CONFIG_ENTRIES: ConfigEntry[] = (() => {
  const defaults = Config.get_defaults();
  return (Object.values(ConfigKey) as ConfigKey[]).map((key) => {
    const def = defaults[key];
    const entry: ConfigEntry = {
      key,
      type: typeof def === "boolean" ? "bool" : typeof def === "number" ? "int" : "string",
      default: def,
      label_key: key,
      desc_key: key + "_desc",
      browser_relevant: !BROWSER_IRRELEVANT.has(key),
    };
    if (key === ConfigKey.MAX_REQUEST_TIMEOUT) {
      entry.min = 1;
      entry.max = 1000;
    } else if (entry.type === "int") {
      entry.min = 0;
      entry.max = 2147483647;
    }
    return entry;
  });
})();
