/** Recent saves, remembered in IndexedDB (best effort: every call tolerates IndexedDB being unavailable). */
const DB_NAME = "bcsfe-web-recent";
const STORE = "saves";
const MAX_RECENT = 5;

export interface RecentSave {
  id: string;
  name: string;
  cc: string;
  gameVersion: string;
  savedAt: number;
  bytes: Uint8Array;
}

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") return reject(new Error("IndexedDB unavailable"));
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: "id" });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise<T>((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const req = fn(t.objectStore(STORE));
    let result: T;
    req.onsuccess = () => { result = req.result; };
    t.oncomplete = () => { db.close(); resolve(result); };
    t.onerror = t.onabort = () => { db.close(); reject(t.error); };
  });
}

export async function listRecent(): Promise<RecentSave[]> {
  try {
    const all = await tx<RecentSave[]>("readonly", (s) => s.getAll());
    return all.sort((a, b) => b.savedAt - a.savedAt);
  } catch {
    return [];
  }
}

export async function rememberSave(entry: Omit<RecentSave, "id" | "savedAt">): Promise<void> {
  try {
    const id = `${entry.cc}:${entry.name}`;
    await tx("readwrite", (s) => s.put({ ...entry, id, savedAt: Date.now() }));
    const all = await listRecent();
    for (const old of all.slice(MAX_RECENT)) await tx("readwrite", (s) => s.delete(old.id));
  } catch {
    /* ignore */
  }
}

export async function forgetRecent(id: string): Promise<void> {
  try {
    await tx("readwrite", (s) => s.delete(id));
  } catch {
    /* ignore */
  }
}
