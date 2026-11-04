/**
 * Port of bcsfe/core/locale_handler.py
 *
 * Locales are pre-converted from the Python `.properties` files to flat JSON files
 * (see scripts/convert-locales.mjs): `src/lib/bcsfe/files/locales/<lang>.json`.
 * Values are stored exactly as the Python PropertySet parser produced them (before the
 * `\n` / `\t` unescaping done in get_key_recursive). An optional "__metadata" entry holds metadata.json.
 *
 * External (git based) locales are not supported in the browser; use LocalManager.register_locale().
 */
import { core_data } from "@/lib/bcsfe/core/core_data";
import { ConfigKey } from "@/lib/bcsfe/core/io/config";
import en_json from "@/lib/bcsfe/files/locales/en.json";
import tw_json from "@/lib/bcsfe/files/locales/tw.json";
import vi_json from "@/lib/bcsfe/files/locales/vi.json";

export type LocaleParams = Record<string, unknown>;

interface LocaleMetadata {
  authors?: string[];
  name?: string;
}

type RawLocale = Record<string, unknown>;

const LOCALES: Record<string, RawLocale> = {
  en: en_json as RawLocale,
  tw: tw_json as RawLocale,
  vi: vi_json as RawLocale,
};

/** Python str() for the value types that appear as locale params. */
function pystr(v: unknown): string {
  if (v === true) return "True";
  if (v === false) return "False";
  if (v === null || v === undefined) return "None";
  return String(v);
}

function flatten(raw: RawLocale): { props: Map<string, string>; metadata: LocaleMetadata } {
  const props = new Map<string, string>();
  let metadata: LocaleMetadata = {};
  for (const [k, v] of Object.entries(raw)) {
    if (k === "__metadata") metadata = (v ?? {}) as LocaleMetadata;
    else if (typeof v === "string") props.set(k, v);
  }
  return { props, metadata };
}

/** Remove the `<@x>` / `</>` colour tags used in the locale strings (for plain-text UI) and unescape `\\<`. */
export function strip_color_tags(text: string): string {
  return text.replace(/<@\w*>|<\/\w*>/g, "").replace(/\\([<>/])/g, "$1");
}

export class LocalManager {
  locale: string;
  all_properties: Map<string, string> = new Map();
  en_properties: Map<string, string> = new Map();
  authors: string[] = ["fieryhenry"];
  name = "English";

  constructor(locale: string | null = null) {
    this.locale = locale ?? core_data.config.get_str(ConfigKey.LOCALE);
    this.parse();
    if (this.locale === "en") this.en_properties = this.all_properties;
  }

  parse(): void {
    const raw = LOCALES[this.locale] ?? LOCALES["en"];
    const { props, metadata } = flatten(raw);
    this.all_properties = props;
    if (LOCALES[this.locale]) {
      this.authors = metadata.authors || ["fieryhenry"];
      this.name = metadata.name || "English";
    }
    if (this.locale !== "en") {
      this.en_properties = flatten(LOCALES["en"]).props;
    }
  }

  static register_locale(code: string, raw: RawLocale): void {
    LOCALES[code] = raw;
  }

  static get_all_locales(): string[] {
    return Object.keys(LOCALES);
  }

  /** [code, display name] pairs, for a language picker. */
  static get_locale_names(): [string, string][] {
    return Object.keys(LOCALES).map((code) => {
      const { metadata } = flatten(LOCALES[code]);
      return [code, metadata.name || (code === "en" ? "English" : code)];
    });
  }

  static from_config(): LocalManager {
    return new LocalManager(core_data.config.get_str(ConfigKey.LOCALE));
  }

  has_key(key: string): boolean {
    return this.all_properties.has(key) || this.en_properties.has(key);
  }

  get_missing_keys(): [string, string][] {
    const out: [string, string][] = [];
    for (const [k, v] of this.en_properties) if (!this.all_properties.has(k)) out.push([k, v]);
    return out;
  }

  get_extra_keys(): [string, string][] {
    const out: [string, string][] = [];
    for (const [k, v] of this.all_properties) if (!this.en_properties.has(k)) out.push([k, v]);
    return out;
  }

  static get_kwarg_keys(value: string): string[] {
    const keys: string[] = [];
    let kwarg_key = "";
    let in_key = false;
    for (let i = 0; i < value.length; i++) {
      const char = value[i];
      if (char === "{") {
        if (i > 0 && value[i - 1] === "\\") continue;
        in_key = true;
      } else if (char === "}") {
        if (i > 0 && value[i - 1] === "\\") continue;
        in_key = false;
        keys.push(kwarg_key);
        kwarg_key = "";
      } else if (in_key) {
        kwarg_key += char;
      }
    }
    return keys;
  }

  /**
   * Gets a localised string.
   * `params` are the Python kwargs; the special entry `escape: false` maps to Python's `escape=False`.
   */
  get_key(key: string, params: LocaleParams = {}): string {
    const { escape: escape_param, ...kwargs } = params;
    const escape = escape_param === undefined ? true : Boolean(escape_param);
    return this.get_key_impl(key, kwargs, escape);
  }

  private get_key_impl(key: string, kwargs: LocaleParams, escape: boolean): string {
    let text: string;
    try {
      text = this.get_key_recursive(key, kwargs, escape);
    } catch (e) {
      if (e instanceof RangeError) text = key; // Python RecursionError
      else throw e;
    }

    for (const [kwarg_key, kwarg_value] of Object.entries(kwargs)) {
      let value = pystr(kwarg_value);
      if (escape) value = LocalManager.escape_string(value);
      text = text.split("{" + kwarg_key + "}").join(value);
    }

    if (text.includes("$(")) text = this.parse_condition(text, kwargs);
    return text;
  }

  parse_condition(text: string, kwargs: LocaleParams): string {
    let counter = 0;
    let final_text = "";
    let in_expression = false;
    let expression_text = "";
    let count_down = 0;
    while (counter < text.length) {
      const char = text[counter];
      if (counter === text.length - 1) {
        final_text += char;
        break;
      }
      const next_char = text[counter + 1];
      if (char === "\\") {
        final_text += next_char;
        counter += 2;
        continue;
      }
      if (char === "$" && next_char === "(") {
        count_down = 0;
        in_expression = true;
      } else if (char === "/" && next_char === "$") {
        count_down = 2;
        in_expression = false;
        if (expression_text.length < 3) {
          counter += 1;
          continue;
        }
        const new_expression_text = expression_text.slice(2, -1);
        expression_text = "";
        const parts = new_expression_text.split(":");
        if (parts.length < 2) {
          counter += 1;
          continue;
        }
        const keyword = parts[0].trim();
        const expression = parts[1].trim();
        const conditions = expression.split("$,");
        let str = "";
        for (let i = 0; i < conditions.length; i++) {
          const condition = conditions[i].trim();
          if (!condition) continue;
          if (i === conditions.length - 1) {
            str = condition;
            break;
          }
          const condition_parts = condition.split("($");
          if (condition_parts.length < 2) continue;
          const logic = condition_parts[0].trim();
          let word = condition_parts[1].trim();
          if (!word) continue;
          word = word.slice(0, -1);
          const value = kwargs[keyword];
          if (value === undefined || value === null) continue;
          let equality: string | null = null;
          if (logic.startsWith("==")) equality = "==";
          else if (logic.startsWith("!=")) equality = "!=";
          else if (logic.startsWith(">=")) equality = ">=";
          else if (logic.startsWith("<=")) equality = "<=";
          else if (logic.startsWith(">")) equality = ">";
          else if (logic.startsWith("<")) equality = "<";
          if (equality === null) continue;
          const logic_parts = logic.split(equality);
          if (logic_parts.length < 2) continue;
          const logic_str = logic_parts[1].trim();

          let logic_value: string | number = logic_str;
          if (typeof value === "number") {
            if (!/^\d+$/.test(logic_str)) continue;
            logic_value = parseInt(logic_str, 10);
          }

          const cmp_value: unknown = typeof value === "number" ? value : value;
          if (equality === "==") {
            if (logic_value === cmp_value) {
              str = word;
              break;
            }
          } else if (equality === "!=") {
            if (logic_value !== cmp_value) {
              str = word;
              break;
            }
          }

          if (typeof logic_value === "number" && !str) {
            const v = value as number;
            if (equality === ">") {
              if (logic_value > v) {
                str = word;
                break;
              }
            } else if (equality === ">=") {
              if (logic_value >= v) {
                str = word;
                break;
              }
            } else if (equality === "<") {
              if (logic_value < v) {
                str = word;
                break;
              }
            } else if (equality === "<=") {
              if (logic_value <= v) {
                str = word;
                break;
              }
            }
          }
        }
        final_text += str;
      }

      if (in_expression) {
        expression_text += char;
      } else if (count_down <= 0) {
        final_text += char;
      } else {
        count_down -= 1;
      }
      counter += 1;
    }
    return final_text;
  }

  static get_special_chars(): string[] {
    return ["<", ">", "/"];
  }

  static escape_string(str: string): string {
    for (const char of LocalManager.get_special_chars()) str = str.split(char).join("\\" + char);
    return str;
  }

  get_key_recursive(
    key: string,
    kwargs: LocaleParams,
    escape = true,
    properties: Map<string, string> | null = null,
  ): string {
    const props = properties ?? this.all_properties;
    let raw = props.get(key);
    if (raw === undefined) raw = this.en_properties.get(key);
    if (raw === undefined) raw = key;
    let value = raw.split("\\n").join("\n").split("\\t").join("\t");
    if (!value.includes("{{")) return value;
    let char_index = 0;
    while (char_index < value.length) {
      if (value[char_index] === "{" && value[char_index + 1] === "{") {
        let key_name = "";
        char_index += 2;
        while (char_index < value.length && value[char_index] !== "}") {
          key_name += value[char_index];
          char_index += 1;
        }
        if (key_name !== key) {
          value = value
            .split("{{" + key_name + "}}")
            .join(this.get_key_impl(key_name, kwargs, escape));
        }
      }
      char_index += 1;
    }
    return value;
  }

  /** Aliases are separated by `|` (a `\|` is a literal pipe). */
  static get_all_aliases(value: string): string[] {
    if (!value.includes("|")) return [value];
    let i = 0;
    const aliases: string[] = [];
    while (i < value.length) {
      const char = value[i];
      const prev_char = i > 0 ? value[i - 1] : "";
      if (char === "|" && prev_char !== "\\") {
        aliases.push(value.slice(0, i));
        value = value.slice(i + 1);
        i = 0;
      }
      i += 1;
    }
    aliases.push(value);
    return aliases;
  }
}

/** Python `core.localize(key, escape, **kwargs)` */
export function localize(key: string, params: LocaleParams = {}): string {
  return core_data.local_manager.get_key(key, params);
}

/** Python `core.localize_no_alias` */
export function localize_no_alias(key: string, params: LocaleParams = {}): string {
  return LocalManager.get_all_aliases(core_data.local_manager.get_key(key, params))[0];
}
