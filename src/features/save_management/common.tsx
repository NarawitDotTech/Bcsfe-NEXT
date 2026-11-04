"use client";
import { useCallback, useState } from "react";
import { statusText } from "@/components/editor/helpers";

/** Tracks the status line emitted by long running server operations. */
export function useServerStatus() {
  const [status, setStatus] = useState<string | null>(null);
  const onStatus = useCallback((key: string) => setStatus(statusText(key)), []);
  return { status, onStatus, clear: () => setStatus(null) };
}
