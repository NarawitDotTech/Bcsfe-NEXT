"use client";
import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button, Modal, cn } from "@/components/ui/primitives";
import { useSaveContext } from "@/components/editor/SaveContext";
import { useDownloadSave } from "@/components/editor/useDownloadSave";
import { Sidebar } from "@/components/editor/Sidebar";
import { Overview } from "@/components/editor/Overview";
import { PanelHost } from "@/components/editor/PanelHost";
import { getFeature } from "@/components/editor/features";

export function EditorLayout() {
  const { save, fileName, dirty, setSave } = useSaveContext();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const selectedKey = params.get("f");
  const feature = getFeature(selectedKey);
  const [drawer, setDrawer] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const { download, dialog } = useDownloadSave();

  const select = useCallback((key: string | null) => {
    router.push(key ? `${pathname}?f=${encodeURIComponent(key)}` : pathname, { scroll: false });
    setDrawer(false);
    window.scrollTo({ top: 0 });
  }, [router, pathname]);

  const close = useCallback(() => {
    setConfirmClose(false);
    setSave(null);
    router.replace(pathname, { scroll: false });
  }, [setSave, router, pathname]);

  // Panels (e.g. "Load another save") ask to close through a window event.
  useEffect(() => {
    const h = () => (dirty ? setConfirmClose(true) : close());
    window.addEventListener("bcsfe:close-save", h);
    return () => window.removeEventListener("bcsfe:close-save", h);
  }, [dirty, close]);

  useEffect(() => {
    if (!drawer) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && setDrawer(false);
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [drawer]);

  useEffect(() => { document.title = feature ? `${feature.label} - BCSFE Web` : "BCSFE Web"; }, [feature]);

  if (!save) return null;
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 border-b border-border bg-surface/95 backdrop-blur">
        <div className="flex h-14 items-center gap-2 px-3 sm:gap-3 sm:px-4">
          <Button variant="ghost" className="md:hidden" aria-label="Open feature list" aria-expanded={drawer} onClick={() => setDrawer(true)}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><path d="M4 6h16M4 12h16M4 18h16" /></svg>
          </Button>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="font-semibold">BCSFE Web</span>
              <span className="hidden truncate text-sm text-muted sm:inline" title={fileName ?? undefined}>{fileName}</span>
            </div>
            <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted">
              <span className="rounded bg-surface-2 px-1.5 py-0.5 font-mono uppercase">{save.cc.get_code()}</span>
              <span>v{save.game_version.to_string()}</span>
              <span className={cn("inline-flex items-center gap-1", dirty ? "text-warning" : "text-muted")}>
                <span className={cn("size-1.5 rounded-full", dirty ? "bg-warning" : "bg-success")} aria-hidden />
                {dirty ? "Unsaved changes" : "No changes"}
              </span>
            </p>
          </div>
          <Button variant="primary" onClick={download}><span>Download<span className="hidden sm:inline"> save</span></span></Button>
          <Button onClick={() => (dirty ? setConfirmClose(true) : close())}><span>Close<span className="hidden sm:inline"> save</span></span></Button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {drawer && <div className="fixed inset-0 z-40 bg-black/50 md:hidden" onClick={() => setDrawer(false)} aria-hidden />}
        <aside
          className={cn(
            "z-50 w-72 flex-none border-r border-border bg-surface",
            "fixed inset-y-0 left-0 transition-transform md:sticky md:top-[3.5rem] md:z-auto md:h-[calc(100dvh-3.5rem)] md:translate-x-0",
            drawer ? "translate-x-0" : "-translate-x-full",
          )}
          aria-hidden={undefined}
        >
          <div className="flex items-center justify-between border-b border-border px-3 py-2 md:hidden">
            <span className="font-semibold">Features</span>
            <Button variant="ghost" aria-label="Close feature list" onClick={() => setDrawer(false)}>Close</Button>
          </div>
          <div className="h-[calc(100%-3rem)] md:h-full"><Sidebar selected={feature?.key ?? null} onSelect={select} /></div>
        </aside>

        <main className="min-w-0 flex-1 px-3 py-4 sm:px-6 sm:py-6" id="main">
          <div className="mx-auto max-w-4xl">
            {selectedKey && !feature && (
              <p className="mb-4 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning">
                Unknown feature &ldquo;{selectedKey}&rdquo;. Showing the overview instead.
              </p>
            )}
            {feature ? <PanelHost key={feature.key} feature={feature} /> : <Overview onOpen={select} />}
          </div>
        </main>
      </div>
      {dialog}
      <Modal
        open={confirmClose}
        title="Close without downloading?"
        onClose={() => setConfirmClose(false)}
        actions={
          <>
            <Button variant="ghost" onClick={() => setConfirmClose(false)}>Keep editing</Button>
            <Button variant="danger" onClick={close}>Discard changes and close</Button>
          </>
        }
      >
        <p>You have unsaved changes. Download the save first if you want to keep them.</p>
      </Modal>
    </div>
  );
}
