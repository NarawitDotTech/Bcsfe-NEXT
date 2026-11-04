"use client";
import { useSaveContext } from "@/components/editor/SaveContext";
import { cn } from "@/components/ui/primitives";

export function Toasts() {
  const { messages, dismiss } = useSaveContext();
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col items-center gap-2 p-4 sm:items-end">
      {messages.map((m) => (
        <div
          key={m.id}
          role={m.tone === "danger" ? "alert" : "status"}
          className={cn(
            "pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-lg border bg-surface px-3 py-2 text-sm shadow-lg",
            m.tone === "info" && "border-border",
            m.tone === "success" && "border-success/60",
            m.tone === "warning" && "border-warning/60",
            m.tone === "danger" && "border-danger/60",
          )}
        >
          <span className={cn(
            "mt-1.5 size-2 flex-none rounded-full",
            m.tone === "info" && "bg-muted", m.tone === "success" && "bg-success",
            m.tone === "warning" && "bg-warning", m.tone === "danger" && "bg-danger",
          )} aria-hidden />
          <span className="min-w-0 flex-1 break-words">{m.message}</span>
          <button type="button" onClick={() => dismiss(m.id)} aria-label="Dismiss message"
            className="-m-1 rounded p-1 text-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-accent">
            <span aria-hidden>&times;</span>
          </button>
        </div>
      ))}
    </div>
  );
}
