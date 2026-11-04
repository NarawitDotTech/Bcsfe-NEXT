/** Port of bcsfe/core/server/client_info.py */
import type { CountryCode } from "@/lib/bcsfe/core/country_code";
import type { GameVersion } from "@/lib/bcsfe/core/game_version";
import type { SaveFile } from "@/lib/bcsfe/core/io/save";
import { Random } from "@/lib/bcsfe/core/crypto";

export class ClientInfo {
  cc: CountryCode;
  gv: GameVersion;

  constructor(cc: CountryCode, gv: GameVersion) {
    this.cc = cc;
    this.gv = gv;
  }

  static from_save_file(save_file: SaveFile): ClientInfo {
    return new ClientInfo(save_file.cc, save_file.game_version);
  }

  get_client_info(): Record<string, unknown> {
    const cc = this.cc.get_client_info_code();
    return {
      clientInfo: {
        client: {
          countryCode: cc,
          version: this.gv.game_version,
        },
        device: {
          model: "SM-G955F",
        },
        os: {
          type: "android",
          version: "9",
        },
      },
      nonce: Random.get_hex_string(32),
    };
  }
}
