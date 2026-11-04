/** Port of bcsfe/core/game/catbase/upgrade.py */
import type { Data } from "@/lib/bcsfe/core/io/data";
import { floordiv } from "@/lib/bcsfe/core/utils";

function randint(a: number, b: number): number {
  return a + Math.floor(Math.random() * (b - a + 1));
}

/** Python int(str); returns null on ValueError */
function pyint(s: string): number | null {
  const t = s.trim();
  if (!/^[+-]?\d+(_\d+)*$/.test(t)) return null;
  return parseInt(t.replace(/_/g, ""), 10);
}

export class Upgrade {
  base_range: [number, number] | null = null;
  plus_range: [number, number] | null = null;

  constructor(
    public plus: number,
    public base: number,
  ) {}

  get_base(): number {
    return this.base + 1;
  }

  get_total(): number {
    return this.get_base() + this.get_plus();
  }

  get_plus(): number {
    return this.plus;
  }

  upgrade(): void {
    this.base += 1;
  }

  increment_base(amount: number): void {
    this.base += amount;
  }

  increment_plus(amount: number): void {
    this.plus += amount;
  }

  get_random_base(max_base: number | null = null): number {
    if (this.base_range === null) return this.base;
    const min_b = Math.min(...this.base_range);
    const max_b = Math.max(...this.base_range);
    let base = randint(min_b, max_b);
    if (max_base !== null) base = Math.min(base, max_base);
    return base;
  }

  get_random_plus(max_plus: number | null = null): number {
    if (this.plus_range === null) return this.plus;
    const min_p = Math.min(...this.plus_range);
    const max_p = Math.max(...this.plus_range);
    let plus = randint(min_p, max_p);
    if (max_plus !== null) plus = Math.min(plus, max_plus);
    return plus;
  }

  static read(stream: Data): Upgrade {
    const plus = stream.read_ushort();
    const base = stream.read_ushort();
    return new Upgrade(plus, base);
  }

  write(stream: Data): void {
    stream.write_ushort(this.plus);
    stream.write_ushort(this.base);
  }

  serialize(): { plus: number; base: number } {
    return { plus: this.plus, base: this.base };
  }

  static init(): Upgrade {
    return new Upgrade(0, 0);
  }

  reset(): void {
    this.plus = 0;
    this.base = 0;
  }

  static deserialize(data: { plus?: number; base?: number }): Upgrade {
    return new Upgrade(data.plus ?? 0, data.base ?? 0);
  }

  /**
   * Pure version of the interactive Python `get_user_upgrade`: takes the raw
   * user input string instead of prompting. Returns [upgrade | null, should_exit].
   * `should_exit` is true when the input equals `quit_text` (if given).
   * An invalid input yields [null, false].
   *
   * Examples: "10+20", "10+", "+20", "10", "5-10+20-30", "max+max".
   * (-1 in base/plus means "no change"; base is stored 0-indexed.)
   */
  static get_user_upgrade(
    usr_input: string,
    max_pos_base: number,
    max_pos_plus: number,
    max_text = "max",
    disable_maxes = false,
    quit_text: string | null = null,
  ): [Upgrade | null, boolean] {
    if (disable_maxes) {
      max_pos_base = 50_000;
      max_pos_plus = 50_000;
    }
    if (quit_text !== null && usr_input === quit_text) return [null, true];

    const parts = usr_input.split("+");
    let base: string;
    let plus: string;
    if (parts.length === 1) {
      base = parts[0];
      plus = "0";
    } else {
      base = parts[0];
      plus = parts[1];
    }

    let min_base: number | null = null;
    let max_base: number | null = null;
    let min_plus: number | null = null;
    let max_plus: number | null = null;

    let base_int: number;
    if (!base) {
      base_int = -1;
    } else {
      const range_parts = base.split("-");
      if (range_parts.length === 1) {
        if (range_parts[0].trim() === max_text) {
          min_base = max_pos_base;
          max_base = max_pos_base;
        } else {
          const v = pyint(range_parts[0]);
          if (v === null) return [null, false];
          min_base = v - 1;
          max_base = min_base;
        }
      } else {
        const a = pyint(range_parts[0]);
        const b = pyint(range_parts[1]);
        if (a === null || b === null) return [null, false];
        min_base = a - 1;
        max_base = b - 1;
      }
      base_int = floordiv(min_base + (max_base as number), 2);
    }

    let plus_int: number;
    if (!plus) {
      plus_int = -1;
    } else {
      const range_parts = plus.split("-");
      if (range_parts.length === 1) {
        if (range_parts[0].trim() === max_text) {
          min_plus = max_pos_plus;
          max_plus = max_pos_plus;
        } else {
          const v = pyint(range_parts[0]);
          if (v === null) return [null, false];
          min_plus = v;
          max_plus = v;
        }
      } else {
        const a = pyint(range_parts[0]);
        const b = pyint(range_parts[1]);
        if (a === null || b === null) return [null, false];
        min_plus = a;
        max_plus = b;
      }
      plus_int = floordiv(min_plus + (max_plus as number), 2);
    }

    const upgrade = new Upgrade(plus_int, base_int);
    upgrade.base_range = [
      Math.max(0, Math.min(min_base || base_int, max_pos_base)),
      Math.max(0, Math.min(max_base || base_int, max_pos_base)),
    ];
    upgrade.plus_range = [
      Math.max(0, Math.min(min_plus || plus_int, max_pos_plus)),
      Math.max(0, Math.min(max_plus || plus_int, max_pos_plus)),
    ];
    return [upgrade, false];
  }

  copy(): Upgrade {
    const upgrade = new Upgrade(this.plus, this.base);
    upgrade.base_range = this.base_range;
    upgrade.plus_range = this.plus_range;
    return upgrade;
  }
}
