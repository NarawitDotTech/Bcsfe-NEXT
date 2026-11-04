"use client";
import { useState } from "react";
import { useLatestVersions } from "@/components/editor/useLatestVersions";
import { GameVersion } from "@/lib/bcsfe/core/game_version";
import { Button, Checkbox, CopyButton, Field, Notice, Panel, Select, TextInput } from "@/components/ui/primitives";
import { useSave } from "@/components/editor/SaveContext";
import { useDownloadSave } from "@/components/editor/useDownloadSave";
import { downloadBytes, errorText } from "@/components/editor/helpers";
import { managed_item_count } from "@/lib/bcsfe/edits/account";
import {
  all_country_codes,
  convert_country_code,
  convert_game_version,
  export_save_json,
  parse_game_version,
  upload_save,
} from "@/lib/bcsfe/edits/save_management";
import { CountryCode } from "@/lib/bcsfe/core/country_code";
import { core_data } from "@/lib/bcsfe/core/core_data";
import { ConfigKey } from "@/lib/bcsfe/core/io/config";
import { useServerStatus } from "@/features/save_management/common";

export function DownloadSavePanel() {
  const { save } = useSave();
  const { download, busy, dialog } = useDownloadSave();
  return (
    <Panel
      title="Download save file"
      description="Writes your edited save as a SAVE_DATA file. Copy it back into the game's data folder (or transfer it by another route) to use it."
      actions={<Button variant="primary" onClick={download} disabled={busy}>Download SAVE_DATA</Button>}
    >
      <p className="text-sm text-muted">
        Country code <b className="text-foreground">{save.cc.get_code()}</b>, game version <b className="text-foreground">{save.game_version.to_string()}</b>.
        Keep a copy of your original file; the editor never overwrites it.
      </p>
      <div>
        <h3 className="text-sm font-semibold">Not available in the browser</h3>
        <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-muted">
          <li>Push the save to a device with adb (with or without rerunning the game)</li>
          <li>Write the save with root access to the game&apos;s storage (with or without rerunning the game)</li>
          <li>Pull or push through Waydroid</li>
        </ul>
        <p className="mt-2 text-sm text-muted">
          A web page cannot reach adb, root storage or other apps on your device. Download the file and copy it over yourself, or use
          &ldquo;Upload save to server&rdquo; to get transfer codes and enter them in the game.
        </p>
      </div>
      {dialog}
    </Panel>
  );
}

export function UploadSavePanel() {
  const { save, commit, notify, version } = useSave();
  const { status, onStatus, clear } = useServerStatus();
  const [busy, setBusy] = useState(false);
  const [codes, setCodes] = useState<[string, string] | null>(null);
  const [failed, setFailed] = useState(false);
  const managed = managed_item_count(save);
  void version;
  const strict = core_data.config.get_bool(ConfigKey.STRICT_BAN_PREVENTION);

  const run = async () => {
    setBusy(true);
    setFailed(false);
    setCodes(null);
    try {
      const r = await upload_save(save, onStatus);
      commit();
      if (r.codes) {
        setCodes(r.codes);
        notify("Save uploaded. Transfer codes ready.", "success");
      } else {
        setFailed(true);
      }
    } catch (e) {
      setFailed(true);
      notify(`Upload failed: ${errorText(e)}`, "danger");
    }
    clear();
    setBusy(false);
  };

  return (
    <Panel
      title="Upload save to server"
      description="Uploads the save to the Battle Cats servers and returns a transfer code and confirmation code you can enter in the game's data transfer screen."
    >
      {strict && <Notice tone="warning">Strict ban prevention is on (Settings): a new account is created before uploading.</Notice>}
      {managed > 0 ? (
        <Notice tone="warning">
          {managed} managed item change{managed === 1 ? "" : "s"} (cat food / tickets) will be reported to the server together with the save,
          as the game itself would. Editing these items can get an account banned; use at your own risk.
        </Notice>
      ) : (
        <p className="text-sm text-muted">No pending managed item changes.</p>
      )}
      <p className="text-sm text-muted">This sends your save to the game servers through this app&apos;s proxy. The edited save in this tab is not changed apart from account details the server hands back.</p>
      <Button variant="primary" onClick={run} disabled={busy}>{busy ? "Uploading..." : "Upload and get codes"}</Button>
      {busy && status && <p role="status" className="text-sm text-muted">{status}</p>}
      {failed && (
        <Notice tone="danger">
          Upload failed. Check your connection and try again; if it keeps failing the account may be banned. Try &ldquo;Unban account&rdquo; first.
          You can still download the save file.
        </Notice>
      )}
      {codes && (
        <div className="space-y-3 rounded-lg border border-border bg-surface-2 p-3">
          {([["Transfer code", codes[0]], ["Confirmation code", codes[1]]] as const).map(([label, value]) => (
            <div key={label} className="flex flex-wrap items-end gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted">{label}</p>
                <p className="break-all font-mono text-lg font-semibold" data-testid={label === "Transfer code" ? "transfer-code" : "confirmation-code"}>{value}</p>
              </div>
              <CopyButton text={value} label={`Copy ${label.toLowerCase()}`} />
            </div>
          ))}
          <p className="text-xs text-muted">Enter both in the game under Menu, Data Transfer, then &ldquo;Load transfer data&rdquo;.</p>
        </div>
      )}
    </Panel>
  );
}

export function ExportJsonPanel() {
  const { save, notify } = useSave();
  return (
    <Panel
      title="Export save as JSON"
      description="Writes the whole save as a readable JSON file. It can be imported again from the start screen (JSON export)."
      actions={
        <Button variant="primary" onClick={() => {
          try {
            downloadBytes(export_save_json(save), "save_data.json", "application/json");
            notify("Exported save_data.json", "success");
          } catch (e) {
            notify(`Export failed: ${errorText(e)}`, "danger");
          }
        }}>Export JSON</Button>
      }
    >
      <p className="text-sm text-muted">JSON exports are not game-readable save files; use &ldquo;Download save file&rdquo; to get a SAVE_DATA file.</p>
    </Panel>
  );
}

export function LoadSavePanel() {
  const { dirty } = useSave();
  return (
    <Panel title="Load another save" description="Closes this save and returns to the start screen, where you can open a file, use transfer codes, import JSON or create a new save.">
      {dirty && <Notice tone="warning">You have unsaved changes. You will be asked to confirm before they are discarded.</Notice>}
      <Button variant="primary" onClick={() => window.dispatchEvent(new Event("bcsfe:close-save"))}>Close save and load another</Button>
    </Panel>
  );
}

export function ConvertRegionPanel() {
  const { save, commit, notify, loadGameData } = useSave();
  const { status, onStatus, clear } = useServerStatus();
  const ccs = all_country_codes();
  const [target, setTarget] = useState(() => ccs.find((c) => c.code !== save.cc.get_code())?.code ?? "en");
  const [createAccount, setCreateAccount] = useState(true);
  const [busy, setBusy] = useState(false);
  const same = target === save.cc.get_code();

  const run = async () => {
    setBusy(true);
    try {
      const r = await convert_country_code(save, new CountryCode(target), createAccount, onStatus);
      commit();
      loadGameData();
      if (r.account_created === false) notify(`Country code set to ${target}, but creating a new account failed. Try "Unban account" later.`, "warning");
      else notify(`Country code set to ${target}`, "success");
    } catch (e) {
      notify(`Could not convert: ${errorText(e)}`, "danger");
    }
    clear();
    setBusy(false);
  };

  return (
    <Panel title="Convert country code" description={`Current country code: ${save.cc.get_code()}. Changes which game version (en, jp, kr, tw) the save is for.`}>
      <Notice tone="warning">
        This may cause issues with your save. Bugs and crashes are expected. If you report a bug, mention that you used this feature. Afterwards open the cat base /
        upgrade menu in the game so it can fix up the save.
      </Notice>
      <Field label="New country code">
        {(id) => (
          <Select id={id} value={target} onChange={(e) => setTarget(e.target.value)}>
            {ccs.map((c) => <option key={c.code} value={c.code}>{c.label} ({c.code})</option>)}
          </Select>
        )}
      </Field>
      <Checkbox
        checked={createAccount} onChange={setCreateAccount}
        label="Create a new account on the server (recommended)"
        hint="A save from one region cannot be used with the other region's account, so BCSFE-Python creates a new inquiry code. Untick if you are offline; the save may then be rejected by the game."
      />
      <Button variant="primary" onClick={run} disabled={busy || same}>{busy ? "Converting..." : "Convert country code"}</Button>
      {same && <p className="text-xs text-muted">Pick a different country code.</p>}
      {busy && status && <p role="status" className="text-sm text-muted">{status}</p>}
    </Panel>
  );
}

export function ConvertVersionPanel() {
  const { save, commit, loadGameData } = useSave();
  const [text, setText] = useState(save.game_version.to_string());
  const gv = parse_game_version(text);
  const [touched, setTouched] = useState(false);
  const { versions } = useLatestVersions();
  const latestText = versions?.[save.cc.get_code()] ?? null;
  const latest = latestText ? GameVersion.from_string(latestText) : null;
  const apply = (v: GameVersion) => {
    commit((s) => convert_game_version(s, v), `Game version set to ${v.to_string()}`);
    setText(v.to_string());
    loadGameData();
  };
  return (
    <Panel title="Convert game version" description={`Current game version: ${save.game_version.to_string()}. Only changes the version number the editor writes into the save.`}>
      <Notice tone="warning">
        This may cause issues with your save. Bugs and crashes are expected. Open the cat base / upgrade menu in the game afterwards so it can make the necessary changes.
      </Notice>
      {latest && (
        <Notice tone={latest.gt(save.game_version) ? "warning" : "success"}>
          Latest {save.cc.get_code().toUpperCase()} game version: <span className="font-mono">{latest.to_string()}</span>
          {latest.gt(save.game_version) ? " — this save is older." : latest.eq(save.game_version) ? " — this save is up to date." : " — this save is newer than the latest known release."}
          {!latest.eq(save.game_version) && <> <Button className="ml-2" onClick={() => apply(latest)}>Set to {latest.to_string()}</Button></>}
        </Notice>
      )}
      <Field label="Game version" hint="e.g. 15.6.1" error={touched && !gv ? "Enter a version like 15.6.1" : undefined}>
        {(id) => (
          <TextInput id={id} value={text} onChange={(e) => setText(e.target.value)} onBlur={() => setTouched(true)}
            inputMode="decimal" aria-invalid={touched && !gv} />
        )}
      </Field>
      <Button
        variant="primary" disabled={!gv || gv.eq(save.game_version)}
        onClick={() => {
          if (gv) apply(gv);
        }}
      >Convert game version</Button>
    </Panel>
  );
}
