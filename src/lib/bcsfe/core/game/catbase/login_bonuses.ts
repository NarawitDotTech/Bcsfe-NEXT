import type { Data } from "@/lib/bcsfe/core/io/data";
import type { GameVersion } from "@/lib/bcsfe/core/game_version";
import { mapToObject } from "@/lib/bcsfe/core/utils";

export class Login {
  count: number;

  constructor(count: number) {
    this.count = count;
  }

  static init(): Login {
    return new Login(0);
  }

  static read(stream: Data): Login {
    return new Login(stream.read_int());
  }

  write(stream: Data): void {
    stream.write_int(this.count);
  }

  serialize(): number {
    return this.count;
  }

  static deserialize(data: number): Login {
    return new Login(data);
  }
}

export class Logins {
  logins: Login[];

  constructor(logins: Login[]) {
    this.logins = logins;
  }

  static init(): Logins {
    return new Logins([]);
  }

  static read(stream: Data): Logins {
    const total = stream.read_int();
    const logins: Login[] = [];
    for (let i = 0; i < total; i++) logins.push(Login.read(stream));
    return new Logins(logins);
  }

  write(stream: Data): void {
    stream.write_int(this.logins.length);
    for (const login of this.logins) login.write(stream);
  }

  serialize(): number[] {
    return this.logins.map((l) => l.serialize());
  }

  static deserialize(data: number[]): Logins {
    return new Logins(data.map((l) => Login.deserialize(l)));
  }
}

export class LoginSets {
  logins: Logins[];

  constructor(logins: Logins[]) {
    this.logins = logins;
  }

  static init(): LoginSets {
    return new LoginSets([]);
  }

  static read(stream: Data): LoginSets {
    const total = stream.read_int();
    const logins: Logins[] = [];
    for (let i = 0; i < total; i++) logins.push(Logins.read(stream));
    return new LoginSets(logins);
  }

  write(stream: Data): void {
    stream.write_int(this.logins.length);
    for (const login of this.logins) login.write(stream);
  }

  serialize(): number[][] {
    return this.logins.map((l) => l.serialize());
  }

  static deserialize(data: number[][]): LoginSets {
    return new LoginSets(data.map((l) => Logins.deserialize(l)));
  }
}

export class LoginBonus {
  old_logins: LoginSets | null;
  logins: Map<number, Login> | null;

  constructor(old_logins: LoginSets | null = null, logins: Map<number, Login> | null = null) {
    this.old_logins = old_logins;
    this.logins = logins;
  }

  static init(gv: GameVersion): LoginBonus {
    if (gv.lt(80000)) return new LoginBonus(LoginSets.init());
    return new LoginBonus(null, new Map());
  }

  static read(stream: Data, gv: GameVersion): LoginBonus {
    if (gv.lt(80000)) {
      return new LoginBonus(LoginSets.read(stream));
    }
    const total = stream.read_int();
    const logins = new Map<number, Login>();
    for (let i = 0; i < total; i++) {
      const id = stream.read_int();
      logins.set(id, Login.read(stream));
    }
    return new LoginBonus(null, logins);
  }

  write(stream: Data, gv: GameVersion): void {
    if (gv.lt(80000)) {
      (this.old_logins ?? new LoginSets([])).write(stream);
    } else {
      const logins = this.logins ?? new Map<number, Login>();
      stream.write_int(logins.size);
      for (const [id, login] of logins) {
        stream.write_int(id);
        login.write(stream);
      }
    }
  }

  serialize(): Record<string, unknown> {
    if (this.old_logins !== null) return { old_logins: this.old_logins.serialize() };
    if (this.logins !== null)
      return { logins: mapToObject(this.logins, (l) => l.serialize()) };
    return {};
  }

  static deserialize(data: Record<string, unknown>): LoginBonus {
    if ("old_logins" in data) {
      return new LoginBonus(LoginSets.deserialize(data["old_logins"] as number[][]));
    }
    if ("logins" in data) {
      const logins = new Map<number, Login>();
      for (const [id, login] of Object.entries(data["logins"] as Record<string, number>))
        logins.set(Number(id), Login.deserialize(login));
      return new LoginBonus(null, logins);
    }
    return new LoginBonus();
  }

  get_login(id: number): Login | null {
    if (this.logins !== null) return this.logins.get(id) ?? null;
    return null;
  }
}
