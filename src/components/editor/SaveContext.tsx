"use client";
/**
 * Holds the currently loaded SaveFile. SaveFile is a mutable class instance;
 * after mutating it, panels MUST call `commit()` so the UI re-renders and the
 * save is marked dirty.
 */
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { SaveFile } from "@/lib/bcsfe/core/io/save";

export type GameDataState = "idle" | "loading" | "ready" | "error";

export type SaveContextValue = {
  save: SaveFile | null;
  /** Bumped on every commit; use as a dependency to recompute derived data. */
  version: number;
  dirty: boolean;
  fileName: string | null;
  gameData: GameDataState;
  gameDataError: string | null;
  setSave: (save: SaveFile | null, fileName?: string | null) => void;
  /** Optionally runs a mutation, then re-renders and marks the save dirty. */
  commit: (mutate?: (save: SaveFile) => void, message?: string) => void;
  markClean: () => void;
  setGameData: (state: GameDataState, error?: string | null) => void;
  /** Toast-style status messages. */
  notify: (message: string, tone?: "info" | "success" | "warning" | "danger") => void;
  messages: { id: number; message: string; tone: "info" | "success" | "warning" | "danger" }[];
  dismiss: (id: number) => void;
};

const Ctx = createContext<SaveContextValue | null>(null);

export function SaveProvider({ children }: { children: ReactNode }) {
  const [save, setSaveState] = useState<SaveFile | null>(null);
  const [version, setVersion] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [gameData, setGameDataState] = useState<GameDataState>("idle");
  const [gameDataError, setGameDataError] = useState<string | null>(null);
  const [messages, setMessages] = useState<SaveContextValue["messages"]>([]);

  const notify = useCallback<SaveContextValue["notify"]>((message, tone = "info") => {
    const id = Date.now() + Math.random();
    setMessages((m) => [...m.slice(-3), { id, message, tone }]);
    setTimeout(() => setMessages((m) => m.filter((x) => x.id !== id)), 5000);
  }, []);

  const setSave = useCallback((s: SaveFile | null, name: string | null = null) => {
    setSaveState(s);
    setFileName(name);
    setDirty(false);
    setVersion((v) => v + 1);
  }, []);

  const commit = useCallback<SaveContextValue["commit"]>((mutate, message) => {
    setSaveState((s) => {
      if (s && mutate) mutate(s);
      return s;
    });
    setDirty(true);
    setVersion((v) => v + 1);
    if (message) notify(message, "success");
  }, [notify]);

  const value = useMemo<SaveContextValue>(() => ({
    save, version, dirty, fileName, gameData, gameDataError, setSave, commit,
    markClean: () => setDirty(false),
    setGameData: (st, err = null) => { setGameDataState(st); setGameDataError(err); },
    notify, messages, dismiss: (id) => setMessages((m) => m.filter((x) => x.id !== id)),
  }), [save, version, dirty, fileName, gameData, gameDataError, setSave, commit, notify, messages]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSaveContext(): SaveContextValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useSaveContext must be used inside <SaveProvider>");
  return v;
}

/** For feature panels: the save is guaranteed loaded when a panel renders. */
export function useSave(): SaveContextValue & { save: SaveFile } {
  const v = useSaveContext();
  if (!v.save) throw new Error("No save loaded");
  return v as SaveContextValue & { save: SaveFile };
}
