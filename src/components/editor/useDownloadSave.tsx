"use client";
import { useCallback, useState, type ReactNode } from "react";
import { Button, Modal, Notice } from "@/components/ui/primitives";
import { useSave } from "@/components/editor/SaveContext";
import { downloadBytes, errorText } from "@/components/editor/helpers";
import { rememberSave } from "@/components/editor/recent";
import { managed_item_count, upload_items } from "@/lib/bcsfe/edits/account";

/**
 * Download flow shared by the header button and the "Download save file" panel.
 * Mirrors SaveManagement.save_save: if managed items are pending, offer to upload them first.
 * Returns `download()` and a `dialog` element that must be rendered by the caller.
 */
export function useDownloadSave(): { download: () => void; busy: boolean; dialog: ReactNode } {
  const { save, notify, markClean, commit } = useSave();
  const [asking, setAsking] = useState(0);
  const [busy, setBusy] = useState(false);

  const write = useCallback(() => {
    try {
      const bytes = save.to_bytes();
      downloadBytes(bytes as BlobPart, "SAVE_DATA");
      markClean();
      notify(`Downloaded SAVE_DATA (${bytes.length.toLocaleString()} bytes)`, "success");
      void rememberSave({ name: "SAVE_DATA", cc: save.cc.get_code(), gameVersion: save.game_version.to_string(), bytes });
    } catch (e) {
      notify(`Could not write the save file: ${errorText(e)}`, "danger");
    }
  }, [save, notify, markClean]);

  const download = useCallback(() => {
    const n = managed_item_count(save);
    if (n > 0) setAsking(n);
    else write();
  }, [save, write]);

  const uploadThenWrite = async () => {
    setBusy(true);
    try {
      const r = await upload_items(save, true);
      commit();
      notify(r.ok ? "Managed items uploaded" : "Could not upload managed items; downloading the save anyway", r.ok ? "success" : "warning");
    } catch (e) {
      notify(`Upload failed: ${errorText(e)}`, "danger");
    }
    setBusy(false);
    setAsking(0);
    write();
  };

  const dialog = (
    <Modal
      open={asking > 0}
      title="Upload managed items first?"
      onClose={() => setAsking(0)}
      actions={
        <>
          <Button variant="ghost" onClick={() => setAsking(0)} disabled={busy}>Cancel</Button>
          <Button onClick={() => { setAsking(0); write(); }} disabled={busy}>Download without uploading</Button>
          <Button variant="primary" onClick={uploadThenWrite} disabled={busy}>{busy ? "Uploading..." : "Upload and download"}</Button>
        </>
      }
    >
      <p>
        {asking} managed item change{asking === 1 ? "" : "s"} (catfood, tickets) {asking === 1 ? "has" : "have"} not yet been reported to the
        game server. If you skip this, the game may detect a mismatch and ban the account.
      </p>
      <Notice tone="info">This sends your save and the item changes to the Ponos servers through this app&apos;s proxy.</Notice>
    </Modal>
  );

  return { download, busy, dialog };
}
