/** Port of bcsfe/core/io/bc_csv.py */
import { Data } from "@/lib/bcsfe/core/io/data";
import type { CountryCode } from "@/lib/bcsfe/core/country_code";
import { CountryCodeType } from "@/lib/bcsfe/core/country_code";

export enum DelimeterType {
  COMMA = ",",
  TAB = "\t",
  PIPE = "|",
}

export class Delimeter {
  delimiter: DelimeterType;

  constructor(de: DelimeterType | string | Delimeter = DelimeterType.COMMA) {
    if (de instanceof Delimeter) {
      this.delimiter = de.delimiter;
    } else {
      const values = Object.values(DelimeterType) as string[];
      if (!values.includes(de)) throw new Error(`${JSON.stringify(de)} is not a valid DelimeterType`);
      this.delimiter = de as DelimeterType;
    }
  }

  static from_country_code_res(cc: CountryCode): Delimeter {
    if (cc.get_cc_lang().equals(CountryCodeType.JP)) return new Delimeter(DelimeterType.COMMA);
    return new Delimeter(DelimeterType.PIPE);
  }

  toString(): string {
    return this.delimiter;
  }
}

export class Cell {
  data: Data;
  constructor(dt: Data) {
    this.data = dt;
  }
  to_str(): string {
    return this.data.to_str();
  }
  to_int(): number {
    return this.data.to_int();
  }
  to_bool(): boolean {
    return this.data.to_bool();
  }
  toString(): string {
    return this.data.to_str();
  }
}

export class Row {
  cells: Cell[];
  index = 0;

  constructor(cells: Cell[]) {
    this.cells = cells;
  }

  /** Python `row[i]`: out of range gives an empty cell. Negative indexes count from the end. */
  get(index: number): Cell {
    const i = index < 0 ? this.cells.length + index : index;
    const c = this.cells[i];
    return c === undefined ? new Cell(new Data("")) : c;
  }

  /** Python `row[a:b]` */
  slice(start?: number, end?: number): Row {
    return new Row(this.cells.slice(start, end));
  }

  get length(): number {
    return this.cells.length;
  }

  static from_list(dt: Data[]): Row {
    return new Row(dt.map((d) => new Cell(d)));
  }

  /** Like Python `iter(row)`: resets the cursor used by next(). */
  [Symbol.iterator](): Iterator<Cell> {
    this.index = 0;
    return this.cells[Symbol.iterator]();
  }

  next(): Cell {
    if (this.index >= this.cells.length) throw new Error("StopIteration");
    this.index += 1;
    return this.cells[this.index - 1];
  }

  next_opt(): Cell | null {
    if (this.done()) return null;
    return this.next();
  }

  done(): boolean {
    return this.index >= this.cells.length;
  }

  next_int(): number {
    return this.next().to_int();
  }
  next_str(): string {
    return this.next().to_str();
  }
  next_bool(): boolean {
    return this.next().to_bool();
  }
  next_int_opt(): number | null {
    return this.next_opt()?.to_int() ?? null;
  }
  next_str_opt(): string | null {
    return this.next_opt()?.to_str() ?? null;
  }
  next_bool_opt(): boolean | null {
    return this.next_opt()?.to_bool() ?? null;
  }

  to_str_list(): string[] {
    return this.cells.map((c) => c.to_str());
  }
  to_int_list(): number[] {
    return this.cells.map((c) => c.to_int());
  }
}

/** Python str.splitlines() */
function splitlines(s: string): string[] {
  const parts = s.split(/\r\n|[\n\r\v\f\x1c-\x1e\x85\u2028\u2029]/);
  if (parts.length > 0 && parts[parts.length - 1] === "") parts.pop();
  return parts;
}

/** Minimal equivalent of Python csv.reader for a single line (quotechar '"', doublequote). */
function parse_csv_line(line: string, delim: string): string[] {
  if (line === "") return [];
  const out: string[] = [];
  let field = "";
  let i = 0;
  let in_quotes = false;
  while (i < line.length) {
    const ch = line[i];
    if (in_quotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        in_quotes = false;
      } else {
        field += ch;
      }
    } else if (ch === '"' && field === "") {
      in_quotes = true;
    } else if (ch === delim) {
      out.push(field);
      field = "";
    } else {
      field += ch;
    }
    i++;
  }
  out.push(field);
  return out;
}

export class CSV {
  file_data: Data;
  delimiter: Delimeter | string;
  remove_comments: boolean;
  remove_empty: boolean;
  index = 0;
  lines: Row[] = [];

  constructor(
    file_data: Data,
    delimiter: Delimeter | string = new Delimeter(DelimeterType.COMMA),
    remove_padding = false,
    remove_comments = true,
    remove_empty = true,
  ) {
    this.file_data = file_data;
    if (remove_padding) {
      const data = this.file_data.unpad_pkcs7();
      if (data !== null) this.file_data = data;
    }
    this.delimiter = delimiter;
    this.remove_comments = remove_comments;
    this.remove_empty = remove_empty;
    this.parse();
  }

  parse(): void {
    const delim = String(this.delimiter);
    const text = this.file_data.to_str_lossy();
    this.lines = [];
    for (const raw of splitlines(text)) {
      const row0 = parse_csv_line(raw, delim);
      let full_row = row0.join(delim);
      if (this.remove_comments) full_row = full_row.split("//")[0];
      const row = full_row.split(delim);
      const new_row: Data[] = [];
      for (let item of row) {
        item = item.trim();
        if (item || !this.remove_empty) new_row.push(new Data(item));
      }
      if (new_row.length > 0 || !this.remove_empty) this.lines.push(Row.from_list(new_row));
    }
  }

  get_row(index: number): Row {
    const i = index < 0 ? this.lines.length + index : index;
    return this.lines[i] ?? new Row([]);
  }

  /** Python `csv[i]` */
  get(index: number): Row {
    return this.get_row(index);
  }

  get length(): number {
    return this.lines.length;
  }

  add_line(line: unknown[] | unknown): void {
    const arr = Array.isArray(line) ? line : [line];
    this.lines.push(Row.from_list(arr.map((item) => new Data(String(item)))));
  }

  set_line(index: number, line: unknown[]): void {
    const row = Row.from_list(line.map((item) => new Data(item as string)));
    if (index >= 0 && index < this.lines.length) this.lines[index] = row;
    else this.lines.push(row);
  }

  to_data(): Data {
    const out: string[] = [];
    for (const line of this.lines) {
      line.cells.forEach((item, i) => {
        out.push(item.toString());
        if (i !== line.length - 1) out.push(String(this.delimiter));
      });
      out.push("\r\n");
    }
    return new Data(out.join(""));
  }

  read_line(): Row | null {
    const line = this.lines[this.index];
    if (line === undefined) return null;
    this.index += 1;
    return line;
  }

  reset_index(): void {
    this.index = 0;
  }

  has_line(): boolean {
    return this.index < this.lines.length;
  }

  /** Like Python, iteration continues from the current index (call reset_index() to restart). */
  [Symbol.iterator](): Iterator<Row> {
    return {
      next: (): IteratorResult<Row> => {
        const line = this.read_line();
        if (line === null) return { done: true, value: undefined };
        return { done: false, value: line };
      },
    };
  }

  extend(length: number, sub_length = 0): void {
    for (let i = 0; i < length; i++) {
      if (sub_length === 0) this.lines.push(Row.from_list([]));
      else this.lines.push(Row.from_list(Array.from({ length: sub_length }, () => new Data(""))));
    }
  }
}
