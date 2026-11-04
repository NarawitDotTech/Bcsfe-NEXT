/** Port of bcsfe/core/game_version.py */
import type { Data } from "@/lib/bcsfe/core/io/data";

export type GameVersionLike = number | string | GameVersion;

export class GameVersion {
  game_version: number;

  /** @param game_version Game version as an integer, e.g. 120102 for 12.1.2 */
  constructor(game_version: number) {
    this.game_version = game_version;
  }

  to_string(): string {
    const s = String(this.game_version).padStart(6, "0");
    const parts: string[] = [];
    for (let i = 0; i < s.length; i += 2) parts.push(String(parseInt(s.slice(i, i + 2), 10)));
    return parts.join(".");
  }

  get_parts_zfill(): string[] {
    return this.to_string()
      .split(".")
      .map((p) => p.padStart(2, "0"));
  }

  get_parts(): number[] {
    return this.get_parts_zfill().map((p) => parseInt(p, 10));
  }

  format(): string {
    return this.get_parts_zfill().join(".");
  }

  toString(): string {
    return this.to_string();
  }

  valueOf(): number {
    return this.game_version;
  }

  static read(data: Data): GameVersion {
    return new GameVersion(data.read_int());
  }

  write(data: Data): void {
    data.write_int(this.game_version);
  }

  serialize(): { game_version: number } {
    return { game_version: this.game_version };
  }

  static deserialize(game_version: { game_version: number }): GameVersion {
    return new GameVersion(game_version.game_version);
  }

  static from_string(game_version: string): GameVersion {
    const split = game_version.split(".");
    if (split.length === 2) split.push("0");
    let final = "";
    for (const s of split) final += s.padStart(2, "0");
    return new GameVersion(parseInt(final, 10));
  }

  private static num(other: GameVersionLike): number {
    if (other instanceof GameVersion) return other.game_version;
    if (typeof other === "number") return other;
    return GameVersion.from_string(other).game_version;
  }

  eq(other: GameVersionLike): boolean {
    return this.game_version === GameVersion.num(other);
  }
  ne(other: GameVersionLike): boolean {
    return !this.eq(other);
  }
  lt(other: GameVersionLike): boolean {
    return this.game_version < GameVersion.num(other);
  }
  le(other: GameVersionLike): boolean {
    return this.game_version <= GameVersion.num(other);
  }
  gt(other: GameVersionLike): boolean {
    return this.game_version > GameVersion.num(other);
  }
  ge(other: GameVersionLike): boolean {
    return this.game_version >= GameVersion.num(other);
  }

  add(other: GameVersionLike): GameVersion {
    return new GameVersion(this.game_version + GameVersion.num(other));
  }
  sub(other: GameVersionLike): GameVersion {
    return new GameVersion(this.game_version - GameVersion.num(other));
  }
}
