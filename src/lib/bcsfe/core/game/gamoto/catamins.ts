import type { Data } from "@/lib/bcsfe/core/io/data";

export class Catamin {
  amount: number;

  constructor(amount: number) {
    this.amount = amount;
  }

  static read(stream: Data): Catamin {
    return new Catamin(stream.read_int());
  }

  write(stream: Data): void {
    stream.write_int(this.amount);
  }

  serialize(): number {
    return this.amount;
  }

  static deserialize(data: number): Catamin {
    return new Catamin(data);
  }
}

export class Catamins {
  catamins: Catamin[];

  constructor(catamins: Catamin[]) {
    this.catamins = catamins;
  }

  static read(stream: Data): Catamins {
    const total = stream.read_int();
    const catamins: Catamin[] = [];
    for (let i = 0; i < total; i++) catamins.push(Catamin.read(stream));
    return new Catamins(catamins);
  }

  write(stream: Data): void {
    stream.write_int(this.catamins.length);
    for (const catamin of this.catamins) catamin.write(stream);
  }

  serialize(): number[] {
    return this.catamins.map((c) => c.serialize());
  }

  static deserialize(data: number[]): Catamins {
    return new Catamins(data.map((c) => Catamin.deserialize(c)));
  }
}
