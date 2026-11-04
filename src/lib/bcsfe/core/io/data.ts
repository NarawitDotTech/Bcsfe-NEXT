/**
 * Port of bcsfe/core/io/data.py
 *
 * Binary reader / writer used for parsing and serialising Battle Cats save
 * files. Method names intentionally keep the snake_case naming of the Python
 * original so that game-module ports can be translated line-by-line.
 *
 * Conventions:
 *  - 32 bit and smaller integers are JS `number`s.
 *  - 64 bit integers (read_long / read_ulong) are `bigint`s.
 *  - Python `dict[int, X]` is represented as `Map<number, X>` (insertion order
 *    is preserved, unlike plain objects with numeric keys).
 *  - Python `tuple[int, int]` is `[number, number]`.
 */

export type Endianness = "<" | ">";

export type DataLike =
  | Data
  | Uint8Array
  | ArrayBuffer
  | string
  | number
  | boolean
  | null
  | undefined;

const textEncoder = new TextEncoder();
const textDecoderStrict = new TextDecoder("utf-8", { fatal: true });
const textDecoderLoose = new TextDecoder("utf-8");

export function concatBytes(chunks: Uint8Array[]): Uint8Array {
  let total = 0;
  for (const c of chunks) total += c.length;
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    out.set(c, off);
    off += c.length;
  }
  return out;
}

export function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

export function toBytes(data: DataLike): Uint8Array {
  if (data instanceof Data) return data.data;
  if (data instanceof Uint8Array) return data;
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  if (typeof data === "string") return textEncoder.encode(data);
  if (typeof data === "boolean") return textEncoder.encode(data ? "1" : "0");
  if (typeof data === "number") return textEncoder.encode(String(Math.trunc(data)));
  if (data === null || data === undefined) return new Uint8Array(0);
  throw new TypeError(`Unsupported data type: ${typeof data}`);
}

export function hexToBytes(hex: string): Uint8Array {
  const clean = hex.replace(/\s+/g, "");
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.substr(i * 2, 2), 16);
  }
  return out;
}

export function bytesToHex(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += b.toString(16).padStart(2, "0");
  return s;
}

export function bytesToBase64(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin);
}

export function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export enum PaddingType {
  PKCS7 = 1,
  ZERO = 2,
  NONE = 3,
}

export class Data {
  private _data: Uint8Array;
  /** length of valid bytes inside _data (capacity may be larger while writing) */
  private _len: number;
  pos = 0;
  endiness: Endianness = "<";

  constructor(data: DataLike = null) {
    const bytes = toBytes(data);
    this._data = bytes;
    this._len = bytes.length;
  }

  /** The underlying bytes (a view trimmed to the valid length). */
  get data(): Uint8Array {
    if (this._len !== this._data.length) {
      return this._data.subarray(0, this._len);
    }
    return this._data;
  }

  set data(value: Uint8Array) {
    this._data = value;
    this._len = value.length;
  }

  static from_hex(hex: string): Data {
    return new Data(hexToBytes(hex));
  }

  // Buffering is a no-op optimisation in TS: writes are already amortised.
  enable_buffer(): void {}
  end_buffer(): void {}

  set_endiness(endiness: Endianness): void {
    this.endiness = endiness;
  }
  set_little_endiness(): void {
    this.set_endiness("<");
  }
  set_big_endiness(): void {
    this.set_endiness(">");
  }
  private get le(): boolean {
    return this.endiness === "<";
  }

  is_empty(): boolean {
    return this._len === 0;
  }

  copy(): Data {
    return new Data(this.data.slice());
  }

  set_pos(pos: number): void {
    if (pos < 0) pos = this._len + pos;
    this.pos = pos;
  }
  reset_pos(): void {
    this.pos = 0;
  }
  clear(): void {
    this.data = new Uint8Array(0);
    this.pos = 0;
  }
  get_pos(): number {
    return this.pos;
  }
  to_hex(): string {
    return bytesToHex(this.data);
  }
  get length(): number {
    return this._len;
  }
  len(): number {
    return this._len;
  }
  add(other: Data): Data {
    return new Data(concatBytes([this.data, other.data]));
  }
  /** Python `data[i]` */
  get_byte(index: number): number {
    if (index < 0) index += this._len;
    return this._data[index];
  }
  /** Python `data[start:end]` (supports negative indices like Python). */
  slice(start?: number, end?: number): Data {
    return new Data(this.data.slice(start, end));
  }
  equals(other: unknown): boolean {
    return other instanceof Data && bytesEqual(this.data, other.data);
  }
  get_bytes(): Uint8Array {
    return this.data;
  }
  to_bytes(): Uint8Array {
    return this.data;
  }

  // ---------------------------------------------------------------- reading

  read_bytes(length: number): Uint8Array {
    const start = Math.min(this.pos, this._len);
    const end = Math.min(this.pos + length, this._len);
    const result = this._data.slice(start, end);
    this.pos += length;
    return result;
  }

  read_to_end(remaining_data = 0): Uint8Array {
    const length = this._len - this.pos - remaining_data;
    return this.read_bytes(length);
  }

  private view(size: number): DataView {
    if (this.pos + size > this._len) {
      const p = this.pos;
      this.pos += size;
      throw new RangeError(
        `Read out of bounds: tried to read ${size} bytes at ${p} (length ${this._len})`,
      );
    }
    const v = new DataView(this._data.buffer, this._data.byteOffset + this.pos, size);
    this.pos += size;
    return v;
  }

  read_int(): number {
    return this.view(4).getInt32(0, this.le);
  }
  read_uint(): number {
    return this.view(4).getUint32(0, this.le);
  }
  read_short(): number {
    return this.view(2).getInt16(0, this.le);
  }
  read_ushort(): number {
    return this.view(2).getUint16(0, this.le);
  }
  read_byte(): number {
    return this.view(1).getInt8(0);
  }
  read_ubyte(): number {
    return this.view(1).getUint8(0);
  }
  read_float(): number {
    return this.view(4).getFloat32(0, this.le);
  }
  read_double(): number {
    return this.view(8).getFloat64(0, this.le);
  }
  read_long(): bigint {
    return this.view(8).getBigInt64(0, this.le);
  }
  read_ulong(): bigint {
    return this.view(8).getBigUint64(0, this.le);
  }
  read_bool(): boolean {
    return this.read_byte() !== 0;
  }

  read_variable_length_int(): number {
    let i = 0;
    for (let n = 0; n < 4; n++) {
      const i3 = i << 7;
      const read = this.read_ubyte();
      i = i3 | (read & 0x7f);
      if ((read & 0x80) === 0) return i;
    }
    return i;
  }

  read_string(length?: number | null): string {
    if (length === undefined || length === null) length = this.read_int();
    const bytes = this.read_bytes(length);
    return textDecoderStrict.decode(bytes);
  }

  read_utf8_string_by_char_length(length?: number | null): string {
    if (length === undefined || length === null) length = this.read_int();
    if (length === 0) return "";
    const buf: number[] = [];
    let result = "";
    for (;;) {
      if (this.pos >= this._len) throw new RangeError("Read out of bounds");
      buf.push(this.read_bytes(1)[0]);
      try {
        result = textDecoderStrict.decode(new Uint8Array(buf));
      } catch {
        continue;
      }
      // Python len() counts code points, not UTF-16 units
      if ([...result].length === length) break;
    }
    return result;
  }

  read_date(): Date {
    const year = this.read_int();
    const month = this.read_int();
    const day = this.read_int();
    const hour = this.read_int();
    const minute = this.read_int();
    const second = this.read_int();
    return new Date(year, month - 1, day, hour, minute, second);
  }

  private read_list<T>(fn: () => T, length?: number | null): T[] {
    if (length === undefined || length === null) length = this.read_int();
    const result: T[] = [];
    for (let i = 0; i < length; i++) result.push(fn());
    return result;
  }

  read_int_list(length?: number | null): number[] {
    return this.read_list(() => this.read_int(), length);
  }
  read_bool_list(length?: number | null): boolean[] {
    return this.read_list(() => this.read_bool(), length);
  }
  read_string_list(length?: number | null): string[] {
    return this.read_list(() => this.read_string(), length);
  }
  read_byte_list(length?: number | null): number[] {
    return this.read_list(() => this.read_byte(), length);
  }
  read_short_list(length?: number | null): number[] {
    return this.read_list(() => this.read_short(), length);
  }
  read_int_tuple(): [number, number] {
    return [this.read_int(), this.read_int()];
  }
  read_int_tuple_list(length?: number | null): [number, number][] {
    return this.read_list(() => this.read_int_tuple(), length);
  }

  private read_dict<V>(
    readKey: () => number,
    readValue: () => V,
    length?: number | null,
  ): Map<number, V> {
    if (length === undefined || length === null) length = this.read_int();
    const result = new Map<number, V>();
    for (let i = 0; i < length; i++) {
      const key = readKey();
      const value = readValue();
      result.set(key, value);
    }
    return result;
  }

  read_int_bool_dict(length?: number | null): Map<number, boolean> {
    return this.read_dict(() => this.read_int(), () => this.read_bool(), length);
  }
  read_int_int_dict(length?: number | null): Map<number, number> {
    return this.read_dict(() => this.read_int(), () => this.read_int(), length);
  }
  read_int_double_dict(length?: number | null): Map<number, number> {
    return this.read_dict(() => this.read_int(), () => this.read_double(), length);
  }
  read_short_bool_dict(length?: number | null): Map<number, boolean> {
    return this.read_dict(() => this.read_short(), () => this.read_bool(), length);
  }

  // ---------------------------------------------------------------- writing

  private ensureCapacity(extra: number): void {
    const needed = this.pos + extra;
    if (needed <= this._data.length) return;
    let cap = Math.max(64, this._data.length * 2);
    while (cap < needed) cap *= 2;
    const next = new Uint8Array(cap);
    next.set(this._data.subarray(0, this._len));
    this._data = next;
  }

  /**
   * Python's write_bytes appends to the end of the data and advances pos.
   * Writers in this codebase always start from an empty Data, so pos == len.
   */
  write_bytes(data: Uint8Array): void {
    this.pos = this._len;
    this.ensureCapacity(data.length);
    this._data.set(data, this._len);
    this._len += data.length;
    this.pos = this._len;
  }

  private writeView(size: number, fn: (v: DataView) => void): void {
    this.pos = this._len;
    this.ensureCapacity(size);
    fn(new DataView(this._data.buffer, this._data.byteOffset + this._len, size));
    this._len += size;
    this.pos = this._len;
  }

  private static checkInt(value: number, min: number, max: number, name: string): number {
    const v = Math.trunc(Number(value));
    if (!Number.isFinite(v) || v < min || v > max) {
      throw new RangeError(`${name} value out of range: ${value}`);
    }
    return v;
  }

  write_int(value: number): void {
    const v = Data.checkInt(value, -0x80000000, 0x7fffffff, "int");
    this.writeView(4, (dv) => dv.setInt32(0, v, this.le));
  }
  write_uint(value: number): void {
    const v = Data.checkInt(value, 0, 0xffffffff, "uint");
    this.writeView(4, (dv) => dv.setUint32(0, v, this.le));
  }
  write_short(value: number): void {
    const v = Data.checkInt(value, -0x8000, 0x7fff, "short");
    this.writeView(2, (dv) => dv.setInt16(0, v, this.le));
  }
  write_ushort(value: number): void {
    const v = Data.checkInt(value, 0, 0xffff, "ushort");
    this.writeView(2, (dv) => dv.setUint16(0, v, this.le));
  }
  write_byte(value: number): void {
    const v = Data.checkInt(value, -0x80, 0x7f, "byte");
    this.writeView(1, (dv) => dv.setInt8(0, v));
  }
  write_ubyte(value: number): void {
    const v = Data.checkInt(value, 0, 0xff, "ubyte");
    this.writeView(1, (dv) => dv.setUint8(0, v));
  }
  write_float(value: number): void {
    this.writeView(4, (dv) => dv.setFloat32(0, value, this.le));
  }
  write_double(value: number): void {
    this.writeView(8, (dv) => dv.setFloat64(0, value, this.le));
  }
  write_long(value: bigint | number): void {
    const v = BigInt.asIntN(64, BigInt(value));
    this.writeView(8, (dv) => dv.setBigInt64(0, v, this.le));
  }
  write_ulong(value: bigint | number): void {
    const v = BigInt.asUintN(64, BigInt(value));
    this.writeView(8, (dv) => dv.setBigUint64(0, v, this.le));
  }
  write_bool(value: boolean | number): void {
    this.write_byte(value ? 1 : 0);
  }

  write_variable_length_int(value: number): void {
    // Uses bigint to mirror Python's arbitrary precision shifting
    let v = BigInt(Math.trunc(value));
    let i2 = 0n;
    let i3 = 0n;
    while (v >= 128n) {
      i2 |= ((v & 0x7fn) | 0x8000n) << (i3 * 8n);
      i3 += 1n;
      v >>= 7n;
    }
    const i4 = i2 | (v << (i3 * 8n));
    const i5 = i3 + 1n;
    for (let i6 = 0n; i6 < i5; i6++) {
      this.write_ubyte(Number((i4 >> ((i5 - i6 - 1n) * 8n)) & 0xffn));
    }
  }

  write_string(value: string, write_length = true): void {
    const bytes = textEncoder.encode(value);
    if (write_length) this.write_int(bytes.length);
    this.write_bytes(bytes);
  }

  write_date(date: Date): void {
    this.write_int(date.getFullYear());
    this.write_int(date.getMonth() + 1);
    this.write_int(date.getDate());
    this.write_int(date.getHours());
    this.write_int(date.getMinutes());
    this.write_int(date.getSeconds());
  }

  write_list<T>(
    value: T[],
    writer: (item: T) => void,
    empty_value: T,
    write_length = true,
    length: number | null = null,
  ): void {
    if (length === null || length === undefined) length = value.length;
    if (write_length) this.write_int(length);
    let items = value;
    if (length > value.length) {
      // NOTE: Python mutates the passed list here (value += [...]).
      for (let i = value.length; i < length; i++) value.push(empty_value);
      items = value;
    } else if (length < value.length) {
      items = value.slice(0, length);
    }
    for (const item of items) writer(item);
  }

  write_int_list(value: number[], write_length = true, length: number | null = null): void {
    this.write_list(value, (v) => this.write_int(v), 0, write_length, length);
  }
  write_bool_list(value: boolean[], write_length = true, length: number | null = null): void {
    this.write_list(value, (v) => this.write_bool(v), false, write_length, length);
  }
  write_string_list(value: string[], write_length = true, length: number | null = null): void {
    this.write_list(value, (v) => this.write_string(v), "", write_length, length);
  }
  write_byte_list(value: number[], write_length = true, length: number | null = null): void {
    this.write_list(value, (v) => this.write_byte(v), 0, write_length, length);
  }
  write_short_list(value: number[], write_length = true, length: number | null = null): void {
    this.write_list(value, (v) => this.write_short(v), 0, write_length, length);
  }
  write_int_tuple(value: [number, number]): void {
    this.write_int(value[0]);
    this.write_int(value[1]);
  }
  write_int_tuple_list(
    value: [number, number][],
    write_length = true,
    length: number | null = null,
  ): void {
    this.write_list(value, (v) => this.write_int_tuple(v), [0, 0] as [number, number], write_length, length);
  }

  write_int_bool_dict(value: Map<number, boolean>, write_length = true): void {
    if (write_length) this.write_int(value.size);
    for (const [k, v] of value) {
      this.write_int(k);
      this.write_bool(v);
    }
  }
  write_int_int_dict(value: Map<number, number>, write_length = true): void {
    if (write_length) this.write_int(value.size);
    for (const [k, v] of value) {
      this.write_int(k);
      this.write_int(v);
    }
  }
  write_int_double_dict(value: Map<number, number>, write_length = true): void {
    if (write_length) this.write_int(value.size);
    for (const [k, v] of value) {
      this.write_int(k);
      this.write_double(v);
    }
  }
  write_short_bool_dict(value: Map<number, boolean>, write_length = true): void {
    if (write_length) this.write_int(value.size);
    for (const [k, v] of value) {
      this.write_short(k);
      this.write_bool(v);
    }
  }

  // ----------------------------------------------------------------- misc

  unpad_pkcs7(): Data | null {
    if (this._len === 0) return null;
    const d = this.data;
    const pad = d[d.length - 1];
    if (pad > d.length || pad === 0) return null;
    for (let i = d.length - pad; i < d.length; i++) if (d[i] !== pad) return null;
    return new Data(d.slice(0, d.length - pad));
  }

  /** Python bytes.split(sep, maxsplit) */
  split(separator: DataLike, maxsplit = -1): Data[] {
    const sep = toBytes(separator);
    const d = this.data;
    const out: Data[] = [];
    let start = 0;
    let splits = 0;
    if (sep.length === 0) throw new Error("empty separator");
    for (let i = 0; i <= d.length - sep.length; ) {
      if (maxsplit >= 0 && splits >= maxsplit) break;
      let match = true;
      for (let j = 0; j < sep.length; j++) {
        if (d[i + j] !== sep[j]) {
          match = false;
          break;
        }
      }
      if (match) {
        out.push(new Data(d.slice(start, i)));
        i += sep.length;
        start = i;
        splits++;
      } else {
        i++;
      }
    }
    out.push(new Data(d.slice(start)));
    return out;
  }

  to_int(): number {
    const s = this.to_str().trim();
    if (!/^[+-]?\d+$/.test(s.replace(/_/g, ""))) return 0;
    const n = parseInt(s.replace(/_/g, ""), 10);
    return Number.isNaN(n) ? 0 : n;
  }
  to_int_little(): number {
    let n = 0n;
    const d = this.data;
    for (let i = d.length - 1; i >= 0; i--) n = (n << 8n) | BigInt(d[i]);
    return Number(n);
  }
  to_str(): string {
    try {
      return textDecoderStrict.decode(this.data);
    } catch {
      return "";
    }
  }
  /** Lenient decode (replacement chars on invalid UTF-8). */
  to_str_lossy(): string {
    return textDecoderLoose.decode(this.data);
  }
  to_bool(): boolean {
    return this.to_int() !== 0;
  }
  toString(): string {
    return this.to_str();
  }

  static int_list_data_list(int_list: number[]): Data[] {
    return int_list.map((i) => new Data(String(i)));
  }
  static string_list_data_list(string_list: unknown[]): Data[] {
    return string_list.map((s) => new Data(String(s)));
  }
  static data_list_int_list(data_list: Data[]): number[] {
    return data_list.map((d) => d.to_int());
  }
  static data_list_string_list(data_list: Data[]): string[] {
    return data_list.map((d) => d.to_str());
  }

  static from_many(others: Data[], joiner: Data | null = null): Data {
    if (joiner === null) return new Data(concatBytes(others.map((o) => o.data)));
    const parts: Uint8Array[] = [];
    others.forEach((o, i) => {
      if (i > 0) parts.push(joiner.data);
      parts.push(o.data);
    });
    return new Data(concatBytes(parts));
  }

  static from_int_list(int_list: number[], endianess: "little" | "big"): Data {
    const out = new Uint8Array(int_list.length * 4);
    const dv = new DataView(out.buffer);
    int_list.forEach((v, i) => dv.setUint32(i * 4, v >>> 0, endianess === "little"));
    return new Data(out);
  }

  /** Python bytes.strip() (ASCII whitespace) */
  strip(): Data {
    const d = this.data;
    const ws = (b: number) => b === 0x20 || (b >= 0x09 && b <= 0x0d);
    let s = 0;
    let e = d.length;
    while (s < e && ws(d[s])) s++;
    while (e > s && ws(d[e - 1])) e--;
    return new Data(d.slice(s, e));
  }

  replace(old_data: Data, new_data: Data): Data {
    const parts = this.split(old_data);
    return Data.from_many(parts, new_data);
  }

  set(value: DataLike): void {
    this.data = toBytes(value).slice();
  }

  to_base_64(): string {
    return bytesToBase64(this.data);
  }
  static from_base_64(s: string): Data {
    return new Data(base64ToBytes(s));
  }

  /** Python bytes.find */
  search(search_data: Data, start = 0): number {
    const d = this.data;
    const s = search_data.data;
    outer: for (let i = start; i <= d.length - s.length; i++) {
      for (let j = 0; j < s.length; j++) if (d[i + j] !== s[j]) continue outer;
      return i;
    }
    return -1;
  }

  add_line(line: DataLike = null): Data {
    const l = toBytes(line);
    this.write_bytes(l);
    this.write_bytes(new Uint8Array([0x0d, 0x0a]));
    return this;
  }
}

export class PaddedInt {
  constructor(
    public value: number,
    public size: number,
  ) {}
  valueOf(): number {
    return this.value;
  }
  toString(): string {
    return String(this.value).padStart(this.size, "0");
  }
  to_str(): string {
    return this.toString();
  }
}
