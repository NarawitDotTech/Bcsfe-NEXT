"use client";
import { useEffect } from "react";
import { useSaveContext } from "@/components/editor/SaveContext";

/** Warns before leaving the page while there are unsaved changes. */
export function UnloadGuard() {
  const { dirty } = useSaveContext();
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);
  return null;
}
