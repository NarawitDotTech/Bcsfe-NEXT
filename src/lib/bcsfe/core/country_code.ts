/** Port of bcsfe/core/country_code.py */
import { core_data } from "@/lib/bcsfe/core/core_data";
import { ConfigKey } from "@/lib/bcsfe/core/io/config";

export enum CountryCodeType {
  EN = "en",
  JP = "jp",
  KR = "kr",
  TW = "tw",
}

export class CountryCode {
  value: string;

  constructor(cc: string | CountryCodeType | CountryCode) {
    const v = cc instanceof CountryCode ? cc.value : (cc as string);
    this.value = v.toLowerCase();
  }

  get_code(): string {
    return this.value;
  }

  get_client_info_code(): string {
    const code = this.get_code();
    if (code === "jp") return "ja";
    return code;
  }

  get_patching_code(): string {
    const code = this.get_code();
    if (code === "jp") return "";
    return code;
  }

  static from_patching_code(code: string): CountryCode {
    if (code === "") return new CountryCode(CountryCodeType.JP);
    return new CountryCode(code);
  }

  static from_code(code: string): CountryCode {
    return new CountryCode(code);
  }

  static get_all(): CountryCode[] {
    return Object.values(CountryCodeType).map((cc) => new CountryCode(cc));
  }

  static get_all_str(): string[] {
    return CountryCode.get_all().map((cc) => cc.get_code());
  }

  toString(): string {
    return this.get_code();
  }

  copy(): CountryCode {
    return this;
  }

  equals(o: unknown): boolean {
    if (o instanceof CountryCode) return this.get_code() === o.get_code();
    if (typeof o === "string") return this.get_code() === o;
    return false;
  }

  get_cc_lang(): CountryCode {
    if (core_data.config.get_bool(ConfigKey.FORCE_LANG_GAME_DATA)) {
      const locale = core_data.config.get_str(ConfigKey.LOCALE);
      return CountryCode.from_code(locale);
    }
    return this;
  }

  static get_langs(): string[] {
    return ["de", "it", "es", "fr", "th"];
  }

  is_lang(): boolean {
    return CountryCode.get_langs().includes(this.get_code());
  }
}
