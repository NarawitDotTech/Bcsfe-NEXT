/** Small helpers for faithfully translating Python semantics. */

/** Python's floor-modulo (`a % b`), which differs from JS for negatives. */
export function pymod(a: number, b: number): number {
  return ((a % b) + b) % b;
}

/** Python's floor division (`a // b`). */
export function floordiv(a: number, b: number): number {
  return Math.floor(a / b);
}

/** Python range(). */
export function range(start: number, stop?: number, step = 1): number[] {
  if (stop === undefined) {
    stop = start;
    start = 0;
  }
  const out: number[] = [];
  if (step > 0) for (let i = start; i < stop; i += step) out.push(i);
  else for (let i = start; i > stop; i += step) out.push(i);
  return out;
}

/** Python `[value] * n` */
export function filled<T>(value: T, n: number): T[] {
  return Array.from({ length: Math.max(0, n) }, () => value);
}

/** Python `[factory() for _ in range(n)]` */
export function times<T>(n: number, factory: (i: number) => T): T[] {
  return Array.from({ length: Math.max(0, n) }, (_, i) => factory(i));
}

/** Clamp a number into [min, max]. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Convert a Map with numeric keys into a JSON-friendly object. */
export function mapToObject<V, R = V>(
  map: Map<number, V>,
  fn: (v: V) => R = (v) => v as unknown as R,
): Record<string, R> {
  const out: Record<string, R> = {};
  for (const [k, v] of map) out[String(k)] = fn(v);
  return out;
}

/** Inverse of mapToObject. Accepts undefined (returns empty map). */
export function objectToMap<V, R = V>(
  obj: Record<string, V> | undefined | null,
  fn: (v: V) => R = (v) => v as unknown as R,
): Map<number, R> {
  const out = new Map<number, R>();
  if (!obj) return out;
  for (const [k, v] of Object.entries(obj)) out.set(Number(k), fn(v));
  return out;
}
