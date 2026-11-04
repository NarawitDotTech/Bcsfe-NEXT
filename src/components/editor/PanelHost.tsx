"use client";
import { Component, useState, type ErrorInfo, type ReactNode } from "react";
import { Button, Notice, Panel, ProgressBar } from "@/components/ui/primitives";
import { useSaveContext } from "@/components/editor/SaveContext";
import { errorText, formatBytes } from "@/components/editor/helpers";
import type { FeatureDef } from "@/features/types";
import { core_data } from "@/lib/bcsfe/core/core_data";

class Boundary extends Component<
  { children: ReactNode; onReload: () => void; label: string },
  { error: Error | null }
> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    core_data.logger.log_exception(error, `Panel "${this.props.label}" crashed\n${info.componentStack ?? ""}`);
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <Panel title={`${this.props.label} failed to render`} description="The rest of the editor is unaffected, and your save was not changed by this error.">
        <Notice tone="danger">{errorText(this.state.error)}</Notice>
        <Button variant="primary" onClick={() => { this.setState({ error: null }); this.props.onReload(); }}>Reload panel</Button>
      </Panel>
    );
  }
}

const STAGE_LABEL: Record<string, string> = {
  metadata: "Fetching game data index",
  cache: "Reading cached game data",
  download: "Downloading game data",
  decompress: "Decompressing",
  extract: "Unpacking",
  done: "Done",
  error: "Error",
};

export function GameDataStatus({ compact = false }: { compact?: boolean }) {
  const { gameData, gameDataProgress: p, gameDataError, loadGameData } = useSaveContext();
  if (gameData === "ready") return compact ? <span className="text-success">Game data ready</span> : null;
  if (gameData === "error") {
    return (
      <div className="space-y-3">
        <Notice tone="danger">
          Could not load game data: {gameDataError ?? "unknown error"}. Check your internet connection (game data is downloaded once,
          then cached in this browser) and try again.
        </Notice>
        <Button variant="primary" onClick={loadGameData}>Retry download</Button>
      </div>
    );
  }
  const frac = p?.total && p.loaded !== undefined ? p.loaded / p.total : null;
  const text = p ? `${STAGE_LABEL[p.stage] ?? p.stage}${p.loaded !== undefined ? ` - ${formatBytes(p.loaded)}${p.total ? ` / ${formatBytes(p.total)}` : ""}` : ""}` : "Preparing...";
  if (compact) return <span className="text-muted">Game data: {text}</span>;
  return (
    <div className="space-y-2" role="status">
      <p className="text-sm">{text}</p>
      <ProgressBar value={frac} label="Game data progress" />
    </div>
  );
}

export function PanelHost({ feature }: { feature: FeatureDef }) {
  const { gameData } = useSaveContext();
  const [nonce, setNonce] = useState(0);
  const Comp = feature.component;
  const needs = feature.needsGameData && gameData !== "ready";
  return (
    <div className="space-y-4">
      {needs ? (
        <Panel title={feature.label} description="This feature needs the game data for your save's version (names, max levels, ...).">
          <GameDataStatus />
        </Panel>
      ) : (
        <Boundary key={`${feature.key}:${nonce}`} label={feature.label} onReload={() => setNonce((n) => n + 1)}>
          <Comp />
        </Boundary>
      )}
    </div>
  );
}
