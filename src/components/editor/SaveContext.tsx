"use client";
/**
 * Holds the currently loaded SaveFile. SaveFile is a mutable class instance;
 * after mutating it, panels MUST call `commit()` so the UI re-renders and the
 * save is marked dirty.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { SaveFile } from "@/lib/bcsfe/core/io/save";
import { core_data } from "@/lib/bcsfe/core/core_data";
import type { GameDataProgress } from "@/lib/bcsfe/core/server/game_data_getter";

export type GameDataState = "idle" | "loading" | "ready" | "error";

export type SaveContextValue = {
  save: SaveFile | null;
  /** Bumped on every commit; use as a dependency to recompute derived data. */
  version: number;
  dirty: boolean;
  fileName: string | null;
  gameData: GameDataState;
  gameDataError: string | null;
  /** Latest progress event of the running game data preparation (null when idle / done). */
  gameDataProgress: GameDataProgress | null;
  /** (Re)starts preparing game data for the current save (resets core_data caches first). */
  loadGameData: () => void;
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
  const [gameDataProgress, setGameDataProgress] = useState<GameDataProgress | null>(null);
  const saveRef = useRef<SaveFile | null>(null);
  const [messages, setMessages] = useState<SaveContextValue["messages"]>([]);

  const notify = useCallback<SaveContextValue["notify"]>((message, tone = "info") => {
    const id = Date.now() + Math.random();
    setMessages((m) => [...m.slice(-3), { id, message, tone }]);
    setTimeout(() => setMessages((m) => m.filter((x) => x.id !== id)), 5000);
  }, []);

  const setSave = useCallback((s: SaveFile | null, name: string | null = null) => {
    saveRef.current = s;
    setSaveState(s);
    setFileName(name);
    setDirty(false);
    setVersion((v) => v + 1);
  }, []);

  const commit = useCallback<SaveContextValue["commit"]>((mutate, message) => {
    const s = saveRef.current;
    if (s && mutate) {
      try {
        mutate(s);
      } catch (e) {
        notify(e instanceof Error ? e.message : String(e), "danger");
        setVersion((v) => v + 1);
        return;
      }
    }
    setDirty(true);
    setVersion((v) => v + 1);
    if (message) notify(message, "success");
  }, [notify]);

  const runId = useRef(0);
  const startedFor = useRef<SaveFile | null>(null);

  const loadGameData = useCallback(() => {
    const s = saveRef.current;
    const id = ++runId.current;
    if (!s) {
      setGameDataState("idle");
      setGameDataError(null);
      setGameDataProgress(null);
      return;
    }
    startedFor.current = s;
    core_data.reset();
    setGameDataState("loading");
    setGameDataError(null);
    setGameDataProgress({ stage: "metadata", message: "Starting" });
    core_data
      .prepare_game_data(s, (p) => {
        if (id === runId.current) setGameDataProgress(p);
      })
      .then((ok) => {
        if (id !== runId.current) return;
        if (ok) {
          setGameDataState("ready");
          setGameDataError(null);
        } else {
          setGameDataState("error");
          setGameDataError(core_data.game_data_getter?.last_error ?? "Could not load game data.");
        }
        setGameDataProgress(null);
      })
      .catch((e: unknown) => {
        if (id !== runId.current) return;
        setGameDataState("error");
        setGameDataError(e instanceof Error ? e.message : String(e));
        setGameDataProgress(null);
      });
  }, []);

  // Start loading game data whenever a different save is loaded; cancel when it is closed.
  useEffect(() => {
    saveRef.current = save;
    if (save === null) {
      startedFor.current = null;
      loadGameData();
    } else if (startedFor.current !== save) {
      loadGameData();
    }
  }, [save, loadGameData]);

  const value = useMemo<SaveContextValue>(() => ({
    save, version, dirty, fileName, gameData, gameDataError, gameDataProgress, loadGameData, setSave, commit,
    markClean: () => setDirty(false),
    setGameData: (st, err = null) => { setGameDataState(st); setGameDataError(err); },
    notify, messages, dismiss: (id) => setMessages((m) => m.filter((x) => x.id !== id)),
  }), [save, version, dirty, fileName, gameData, gameDataError, gameDataProgress, loadGameData, setSave, commit, notify, messages]);

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
