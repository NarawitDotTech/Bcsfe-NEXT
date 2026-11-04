"use client";
import { useState } from "react";
import { Button, Checkbox, Field, Notice, Panel, TextInput } from "@/components/ui/primitives";
import { useSave } from "@/components/editor/SaveContext";
import { errorText } from "@/components/editor/helpers";
import { managed_item_count, set_inquiry_code, set_password_refresh_token, unban_account, upload_items } from "@/lib/bcsfe/edits/account";
import { useServerStatus } from "@/features/save_management/common";

export function UnbanPanel() {
  const { save, commit, notify } = useSave();
  const { status, onStatus, clear } = useServerStatus();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<boolean | null>(null);
  const run = async () => {
    setBusy(true);
    setResult(null);
    try {
      const ok = await unban_account(save, onStatus);
      commit();
      setResult(ok);
      notify(ok ? "Account unbanned" : "Failed to unban account", ok ? "success" : "danger");
    } catch (e) {
      setResult(false);
      notify(`Failed: ${errorText(e)}`, "danger");
    }
    clear();
    setBusy(false);
  };
  return (
    <Panel
      title="Unban account / fix &ldquo;save used elsewhere&rdquo;"
      description="Creates a brand new account on the server (new inquiry code, password and auth token) and attaches this save to it."
    >
      <p className="text-sm text-muted">Current inquiry code: <span className="font-mono text-foreground">{save.inquiry_code || "(none)"}</span></p>
      <Notice tone="info">This contacts the game servers through this app&apos;s proxy. Download the edited save afterwards so the new account details are kept.</Notice>
      <Button variant="primary" onClick={run} disabled={busy}>{busy ? "Working..." : "Create new account"}</Button>
      {busy && status && <p role="status" className="text-sm text-muted">{status}</p>}
      {result === true && <Notice tone="success">Account unbanned. New inquiry code: <span className="font-mono">{save.inquiry_code}</span></Notice>}
      {result === false && <Notice tone="danger">Failed to unban the account. Check your internet connection and try again.</Notice>}
    </Panel>
  );
}

export function UploadItemsPanel() {
  const { save, commit, notify, version } = useSave();
  const { status, onStatus, clear } = useServerStatus();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<boolean | null>(null);
  void version;
  const count = managed_item_count(save);
  const run = async () => {
    setBusy(true);
    setResult(null);
    try {
      const r = await upload_items(save, true, onStatus);
      commit();
      setResult(r.ok);
      notify(r.ok ? "Managed items uploaded" : "Failed to upload managed items", r.ok ? "success" : "danger");
    } catch (e) {
      setResult(false);
      notify(`Failed: ${errorText(e)}`, "danger");
    }
    clear();
    setBusy(false);
  };
  return (
    <Panel
      title="Upload managed items to server"
      description="Reports changes to cat food and tickets (&ldquo;managed items&rdquo;) to the server so the game does not see an unexplained jump."
    >
      <p className="text-sm">{count > 0 ? `${count} managed item change${count === 1 ? "" : "s"} pending.` : "No managed item changes are pending."}</p>
      <p className="text-sm text-muted">The save itself is uploaded as well. With strict ban prevention enabled (Settings) a new account is created first.</p>
      <Button variant="primary" onClick={run} disabled={busy}>{busy ? "Uploading..." : "Upload managed items"}</Button>
      {busy && status && <p role="status" className="text-sm text-muted">{status}</p>}
      {result === true && <Notice tone="success">Managed items uploaded.</Notice>}
      {result === false && <Notice tone="danger">Failed to upload managed items. Check your connection and try again.</Notice>}
    </Panel>
  );
}

function RiskyTextEdit({ title, description, label, warning, initial, apply }: {
  title: string; description: string; label: string; warning: string; initial: string; apply: (value: string) => void;
}) {
  const { commit } = useSave();
  const [ack, setAck] = useState(false);
  const [value, setValue] = useState(initial);
  return (
    <Panel title={title} description={description}>
      <Notice tone="warning">{warning}</Notice>
      <Checkbox checked={ack} onChange={setAck} label="I understand the risk and want to continue" />
      <Field label={label}>
        {(id) => <TextInput id={id} value={value} onChange={(e) => setValue(e.target.value)} disabled={!ack} spellCheck={false} autoComplete="off" />}
      </Field>
      <Button variant="primary" disabled={!ack || value === initial} onClick={() => commit(() => apply(value), `${label} updated`)}>Apply</Button>
    </Panel>
  );
}

export function InquiryCodePanel() {
  const { save } = useSave();
  return (
    <RiskyTextEdit
      key={save.inquiry_code}
      title="Inquiry code" label="Inquiry code" initial={save.inquiry_code}
      description="The account id the game uses to talk to the server."
      warning="Editing your inquiry code can make your account unplayable. Use at your own risk."
      apply={(v) => set_inquiry_code(save, v)}
    />
  );
}

export function PasswordRefreshTokenPanel() {
  const { save } = useSave();
  return (
    <RiskyTextEdit
      key={save.password_refresh_token}
      title="Password refresh token" label="Password refresh token" initial={save.password_refresh_token}
      description="Token the game uses to renew its server password."
      warning="Editing your password refresh token can make your account unplayable. Use at your own risk. The length is not validated."
      apply={(v) => set_password_refresh_token(save, v)}
    />
  );
}
