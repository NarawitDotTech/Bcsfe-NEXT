/** Port of bcsfe/core/crypto.py (synchronous, @noble/hashes) */
import { md5, sha1 } from "@noble/hashes/legacy.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { hmac } from "@noble/hashes/hmac.js";
import { Data } from "@/lib/bcsfe/core/io/data";

export enum HashAlgorithm {
  MD5 = 1,
  SHA1 = 2,
  SHA256 = 3,
}

function algo(a: HashAlgorithm) {
  switch (a) {
    case HashAlgorithm.MD5:
      return md5;
    case HashAlgorithm.SHA1:
      return sha1;
    case HashAlgorithm.SHA256:
      return sha256;
    default:
      throw new Error("Invalid hash algorithm");
  }
}

export class Hash {
  algorithm: HashAlgorithm;
  constructor(algorithm: HashAlgorithm) {
    this.algorithm = algorithm;
  }

  get_hash(data: Data, length: number | null = null): Data {
    const digest = algo(this.algorithm)(data.get_bytes());
    if (length === null) return new Data(digest);
    return new Data(digest.slice(0, length));
  }
}

export class Random {
  static get_bytes(length: number): Uint8Array {
    const out = new Uint8Array(length);
    // getRandomValues is limited to 65536 bytes per call
    for (let i = 0; i < length; i += 65536) {
      crypto.getRandomValues(out.subarray(i, Math.min(length, i + 65536)));
    }
    return out;
  }

  private static from_chars(chars: string, length: number): string {
    const bytes = Random.get_bytes(length);
    let s = "";
    for (let i = 0; i < length; i++) s += chars[bytes[i] % chars.length];
    return s;
  }

  static get_alpha_string(length: number): string {
    return Random.from_chars("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ", length);
  }

  static get_hex_string(length: number): string {
    return Random.from_chars("0123456789abcdef", length);
  }

  static get_digits_string(length: number): string {
    return Random.from_chars("0123456789", length);
  }
}

export class Hmac {
  algorithm: HashAlgorithm;
  constructor(algorithm: HashAlgorithm) {
    this.algorithm = algorithm;
  }

  get_hmac(key: Data, data: Data): Data {
    return new Data(hmac(algo(this.algorithm), key.get_bytes(), data.get_bytes()));
  }
}

export class NyankoSignature {
  inquiry_code: string;
  data: string;

  constructor(inquiry_code: string, data: string) {
    this.inquiry_code = inquiry_code;
    this.data = data;
  }

  generate_signature(): string {
    const random_data = Random.get_hex_string(64);
    const key = this.inquiry_code + random_data;
    const signature = new Hmac(HashAlgorithm.SHA256).get_hmac(new Data(key), new Data(this.data));
    return random_data + signature.to_hex();
  }

  generate_signature_v1(): string {
    const data = this.data + this.data; // repeat data for some reason
    const random_data = Random.get_hex_string(40);
    const key = this.inquiry_code + random_data;
    const signature = new Hmac(HashAlgorithm.SHA1).get_hmac(new Data(key), new Data(data));
    return random_data + signature.to_hex();
  }
}
