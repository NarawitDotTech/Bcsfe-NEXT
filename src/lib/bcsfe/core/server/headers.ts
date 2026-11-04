/** Port of bcsfe/core/server/headers.py */
import type { SaveFile } from "@/lib/bcsfe/core/io/save";
import { NyankoSignature } from "@/lib/bcsfe/core/crypto";

export class AccountHeaders {
  save_file: SaveFile;
  data: string;

  constructor(save_file: SaveFile, data: string) {
    this.save_file = save_file;
    this.data = data;
  }

  get_headers(): Record<string, string> {
    return AccountHeaders.get_headers_static(this.save_file.inquiry_code, this.data);
  }

  static get_headers_static(iq: string, data: string): Record<string, string> {
    return {
      "accept-enconding": "gzip",
      connection: "keep-alive",
      "content-type": "application/json",
      "nyanko-signature": new NyankoSignature(iq, data).generate_signature(),
      "nyanko-timestamp": String(Math.floor(Date.now() / 1000)),
      "nyanko-signature-version": "1",
      "nyanko-signature-algorithm": "HMACSHA256",
      "user-agent": "Dalvik/2.1.0 (Linux; U; Android 9; SM-G955F Build/N2G48B)",
    };
  }
}
