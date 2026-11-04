"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button, Field, Notice, Segmented, Select, TextInput, cn } from "@/components/ui/primitives";
import { useSaveContext } from "@/components/editor/SaveContext";
import { errorText, formatBytes, statusText } from "@/components/editor/helpers";
import { forgetRecent, listRecent, rememberSave, type RecentSave } from "@/components/editor/recent";
import { core_data } from "@/lib/bcsfe/core/core_data";
import { CountryCode } from "@/lib/bcsfe/core/country_code";
import { CantDetectSaveCCError, type SaveFile } from "@/lib/bcsfe/core/io/save";
import {
  all_country_codes,
  apply_load_actions,
  new_blank_save,
  parse_game_version,
  save_from_bytes,
  save_from_json,
} from "@/lib/bcsfe/edits/save_management";
import { download_save } from "@/lib/bcsfe/edits/server_cli";

type Source = "file" | "transfer" | "json" | "new";

type LoadError = { message: string; hint?: string; needCc?: { bytes: Uint8Array; name: string } };

const CC_OPTIONS = all_country_codes();

function CcSelect({ id, value, onChange }: { id?: string; value: string; onChange: (v: string) => void }) {
  return (
    <Select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
      {CC_OPTIONS.map((c) => <option key={c.code} value={c.code}>{c.label} ({c.code})</option>)}
    </Select>
  );
}

export function Landing() {
  const { setSave, notify } = useSaveContext();
  const [source, setSource] = useState<Source>("file");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<LoadError | null>(null);
  const [dragging, setDragging] = useState(false);
  const [recent, setRecent] = useState<RecentSave[]>([]);

  // file / cc retry
  const [ccChoice, setCcChoice] = useState("en");
  // transfer
  const [transfer, setTransfer] = useState("");
  const [confirm, setConfirm] = useState("");
  const [transferCc, setTransferCc] = useState("en");
  // new save
  const [newCc, setNewCc] = useState("en");
  const [newGv, setNewGv] = useState("15.5.0");

  const fileRef = useRef<HTMLInputElement>(null);
  const jsonRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let alive = true;
    listRecent().then((r) => alive && setRecent(r));
    return () => { alive = false; };
  }, []);

  const complete = useCallback((save: SaveFile, name: string, bytes?: Uint8Array) => {
    core_data.init_data();
    apply_load_actions(save);
    setSave(save, name);
    notify(`Loaded ${name} (${save.cc.get_code()}, ${save.game_version.to_string()})`, "success");
    let raw = bytes;
    if (!raw) {
      try { raw = save.to_bytes(); } catch { raw = undefined; }
    }
    if (raw) void rememberSave({ name, cc: save.cc.get_code(), gameVersion: save.game_version.to_string(), bytes: raw });
  }, [setSave, notify]);

  const loadBytes = useCallback((bytes: Uint8Array, name: string, cc: CountryCode | null) => {
    try {
      const save = save_from_bytes(bytes, cc);
      complete(save, name, bytes);
    } catch (e) {
      if (e instanceof CantDetectSaveCCError) {
        setError({
          message: "Could not detect the country code of this save file.",
          hint: "Pick the version of the game this save came from and try again. If no choice works, the file is probably not a Battle Cats SAVE_DATA file or is corrupted.",
          needCc: { bytes, name },
        });
      } else {
        setError({
          message: `Could not read this save file: ${errorText(e)}`,
          hint: cc
            ? "The country code you chose may be wrong. Try another one."
            : "Make sure this is an unmodified SAVE_DATA file. You can enable \"Ignore parse error\" in Settings after loading any save to try loading damaged files.",
        });
      }
    }
  }, [complete]);

  const readFile = async (file: File) => {
    setError(null);
    setBusy(true);
    setStatus(`Reading ${file.name}...`);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      if (bytes.length === 0) {
        setError({ message: "This file is empty." });
      } else if (file.name.toLowerCase().endsWith(".json") || bytes[0] === 0x7b) {
        loadJsonText(new TextDecoder().decode(bytes), file.name);
      } else {
        loadBytes(bytes, file.name, null);
      }
    } catch (e) {
      setError({ message: `Could not open the file: ${errorText(e)}` });
    }
    setBusy(false);
    setStatus(null);
  };

  const loadJsonText = (text: string, name: string) => {
    try {
      complete(save_from_json(text), name);
    } catch (e) {
      setError({
        message: e instanceof SyntaxError
          ? "This file is not valid JSON. Is it really an export from this editor?"
          : `Could not import the JSON: ${errorText(e)}`,
        hint: "Only JSON files exported with \"Export save as JSON\" can be imported.",
      });
    }
  };

  const submitTransfer = async () => {
    setError(null);
    setBusy(true);
    setStatus("Contacting the server...");
    try {
      const r = await download_save(transfer.trim(), confirm.trim(), new CountryCode(transferCc), (k) => setStatus(statusText(k)));
      if (r.ok) complete(r.save_file, `transfer-${transfer.trim()}`, r.save_bytes);
      else if (r.error === "no_internet") {
        setError({
          message: "Could not reach the game server.",
          hint: "Check your internet connection and try again. The request goes through this app's proxy, so the app itself must be online too.",
        });
      } else {
        setError({
          message: "The server rejected the transfer code or confirmation code.",
          hint: r.jp_tw_mixup
            ? "Check both codes carefully. Codes from the Taiwanese game must be loaded with country code tw, not jp."
            : "Check both codes and the country code. Transfer codes expire and can only be used a limited number of times.",
        });
      }
    } catch (e) {
      setError({ message: `Download failed: ${errorText(e)}` });
    }
    setBusy(false);
    setStatus(null);
  };

  const submitNew = () => {
    setError(null);
    const gv = parse_game_version(newGv);
    if (!gv) {
      setError({ message: "Invalid game version.", hint: "Use the format 15.5.0 (major.minor.patch)." });
      return;
    }
    try {
      complete(new_blank_save(new CountryCode(newCc), gv), `new-${newCc}-${gv.to_string()}`);
    } catch (e) {
      setError({ message: `Could not create a new save: ${errorText(e)}` });
    }
  };

  const openRecent = (r: RecentSave) => {
    setError(null);
    loadBytes(r.bytes.slice(), r.name, null);
  };

  const dropHandlers = {
    onDragOver: (e: React.DragEvent) => { e.preventDefault(); setDragging(true); },
    onDragLeave: () => setDragging(false),
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const f = e.dataTransfer.files?.[0];
      if (f) void readFile(f);
    },
  };

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col gap-6 px-4 py-8 sm:py-14">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">BCSFE Web</h1>
        <p className="text-muted">
          Edit your Battle Cats save file in the browser. A web port of{" "}
          <a className="text-accent underline underline-offset-2" href="https://github.com/fieryhenry/BCSFE-Python" target="_blank" rel="noreferrer">BCSFE-Python</a>.
        </p>
      </header>

      <Notice tone="info">
        Your save is parsed and edited locally in this browser tab. Nothing is uploaded unless you use a server feature
        (transfer codes, account fixes, game data downloads), and those requests go through this app&apos;s own proxy.
      </Notice>

      <section className="space-y-4 rounded-xl border border-border bg-surface p-4 sm:p-5" aria-labelledby="load-title">
        <h2 id="load-title" className="text-lg font-semibold">Load a save</h2>
        <div className="-mx-1 overflow-x-auto px-1">
          <Segmented<Source> value={source} onChange={(s) => { setSource(s); setError(null); }} options={[
            { value: "file", label: "File" },
            { value: "transfer", label: "Transfer code" },
            { value: "json", label: "JSON export" },
            { value: "new", label: "New save" },
          ]} />
        </div>

        {source === "file" && (
          <div
            {...dropHandlers}
            className={cn(
              "flex flex-col items-center gap-3 rounded-lg border-2 border-dashed px-4 py-8 text-center",
              dragging ? "border-accent bg-accent/5" : "border-border",
            )}
          >
            <p className="text-sm">Drop your <code className="rounded bg-surface-2 px-1 font-mono">SAVE_DATA</code> file here, or choose it.</p>
            <input
              ref={fileRef} id="save-file-input" type="file" className="sr-only" tabIndex={-1} disabled={busy}
              aria-label="Save file"
              onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void readFile(f); }}
            />
            <Button variant="primary" disabled={busy} onClick={() => fileRef.current?.click()}>Choose save file</Button>
            <p className="max-w-md text-xs text-muted">
              Any file name works. The country code is detected automatically. You can also drop a JSON export here.
            </p>
          </div>
        )}

        {source === "transfer" && (
          <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); void submitTransfer(); }}>
            <Field label="Transfer code" hint="The code shown in the game under Data Transfer.">
              {(id) => <TextInput id={id} value={transfer} onChange={(e) => setTransfer(e.target.value)} autoComplete="off" spellCheck={false} required />}
            </Field>
            <Field label="Confirmation code" hint="The 4 digit PIN shown next to the transfer code.">
              {(id) => <TextInput id={id} value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" spellCheck={false} required />}
            </Field>
            <Field label="Country code">{(id) => <CcSelect id={id} value={transferCc} onChange={setTransferCc} />}</Field>
            <Button type="submit" variant="primary" disabled={busy || !transfer.trim() || !confirm.trim()}>
              {busy ? "Downloading..." : "Download save"}
            </Button>
          </form>
        )}

        {source === "json" && (
          <div className="space-y-3">
            <p className="text-sm text-muted">Import a JSON file previously exported from this editor (or BCSFE-Python).</p>
            <input ref={jsonRef} type="file" accept=".json,application/json" className="sr-only" tabIndex={-1} aria-label="JSON export file" disabled={busy}
              onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void readFile(f); }} />
            <Button variant="primary" disabled={busy} onClick={() => jsonRef.current?.click()}>Choose JSON file</Button>
          </div>
        )}

        {source === "new" && (
          <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); submitNew(); }}>
            <Notice tone="warning">
              Many features will not work with a generated save. Load it in the game once, then bring it back here.
            </Notice>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Country code">{(id) => <CcSelect id={id} value={newCc} onChange={setNewCc} />}</Field>
              <Field label="Game version" hint="e.g. 15.5.0">
                {(id) => <TextInput id={id} value={newGv} onChange={(e) => setNewGv(e.target.value)} inputMode="decimal" />}
              </Field>
            </div>
            <Button type="submit" variant="primary" disabled={busy}>Create new save</Button>
          </form>
        )}

        {busy && status && <p role="status" className="text-sm text-muted">{status}</p>}

        {error && (
          <div className="space-y-3">
            <Notice tone="danger">
              <p className="font-medium">{error.message}</p>
              {error.hint && <p className="mt-1 opacity-90">{error.hint}</p>}
            </Notice>
            {error.needCc && (
              <div className="flex flex-wrap items-end gap-2">
                <div className="min-w-40 flex-1">
                  <Field label="Country code of this save">{(id) => <CcSelect id={id} value={ccChoice} onChange={setCcChoice} />}</Field>
                </div>
                <Button variant="primary" onClick={() => { const n = error.needCc!; setError(null); loadBytes(n.bytes, n.name, new CountryCode(ccChoice)); }}>
                  Retry with this country code
                </Button>
              </div>
            )}
          </div>
        )}
      </section>

      {recent.length > 0 && (
        <section className="space-y-2" aria-labelledby="recent-title">
          <h2 id="recent-title" className="text-sm font-semibold uppercase tracking-wide text-muted">Recent saves on this device</h2>
          <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
            {recent.map((r) => (
              <li key={r.id} className="flex items-center gap-3 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{r.name}</p>
                  <p className="text-xs text-muted">{r.cc} - {r.gameVersion} - {formatBytes(r.bytes.length)} - {new Date(r.savedAt).toLocaleString()}</p>
                </div>
                <Button onClick={() => openRecent(r)} disabled={busy}>Open</Button>
                <Button variant="ghost" aria-label={`Forget ${r.name}`} onClick={async () => { await forgetRecent(r.id); setRecent(await listRecent()); }}>Forget</Button>
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted">Stored only in this browser (IndexedDB). Forget them on shared computers.</p>
        </section>
      )}

      <footer className="mt-auto pt-4 text-xs text-muted">
        Unofficial fan tool, GPL-3.0. Based on BCSFE-Python by fieryhenry. Always keep a backup of your original save.
      </footer>
    </main>
  );
}
