"use client";
import { useMemo } from "react";
import { Button, Notice, Panel } from "@/components/ui/primitives";
import { useLatestVersions } from "@/components/editor/useLatestVersions";
import { GameVersion } from "@/lib/bcsfe/core/game_version";
import { useSave } from "@/components/editor/SaveContext";
import { formatPlayTime } from "@/components/editor/helpers";
import { GameDataStatus } from "@/components/editor/PanelHost";
import { FEATURES } from "@/components/editor/features";
import { CATEGORY_LABELS, CATEGORY_ORDER } from "@/features/types";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-lg border border-border bg-surface-2 px-3 py-2">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="truncate text-base font-semibold tabular-nums" title={value}>{value}</dd>
    </div>
  );
}

export function Overview({ onOpen }: { onOpen: (key: string) => void }) {
  const { save, version, gameData } = useSave();
  const { versions: latestVersions } = useLatestVersions();
  const latestText = latestVersions?.[save.cc.get_code()];
  const outdated = latestText ? GameVersion.from_string(latestText).gt(save.game_version) : false;
  const stats = useMemo(() => {
    let rank = "-";
    try { rank = save.calculate_user_rank().toLocaleString(); } catch { /* partially loaded save */ }
    const n = (v: number) => v.toLocaleString();
    return [
      ["Cat food", n(save.catfood)],
      ["XP", n(save.xp)],
      ["Normal tickets", n(save.normal_tickets)],
      ["Rare tickets", n(save.rare_tickets)],
      ["Platinum tickets", n(save.platinum_tickets)],
      ["Legend tickets", n(save.legend_tickets)],
      ["User rank", rank],
      ["Play time", formatPlayTime(save.officer_pass.play_time)],
      ["Inquiry code", save.inquiry_code || "-"],
      ["Game version", save.game_version.to_string()],
      ["Country code", save.cc.get_code()],
    ] as [string, string][];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [save, version]);

  const groups = CATEGORY_ORDER.map((c) => ({ c, items: FEATURES.filter((f) => f.category === c) })).filter((g) => g.items.length);

  return (
    <div className="space-y-4">
      {outdated && (
        <Notice tone="warning">
          This save is version {save.game_version.to_string()}; the latest {save.cc.get_code().toUpperCase()} release is {latestText}.
          {" "}<Button className="ml-1" onClick={() => onOpen("convert_version")}>Update game version</Button>
        </Notice>
      )}
      <Panel title="Save overview" description="Pick a feature from the list to start editing. Changes stay in this tab until you download the save.">
        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {stats.map(([l, v]) => <Stat key={l} label={l} value={v} />)}
        </dl>
        {gameData !== "ready" && <GameDataStatus />}
      </Panel>
      <Panel title="Features">
        <div className="grid gap-4 sm:grid-cols-2">
          {groups.map((g) => (
            <div key={g.c} className="space-y-1">
              <h3 className="text-sm font-semibold">{CATEGORY_LABELS[g.c]}</h3>
              <ul className="flex flex-wrap gap-x-3 gap-y-1 text-sm">
                {g.items.map((f) => (
                  <li key={f.key}>
                    <button type="button" onClick={() => onOpen(f.key)} className="rounded text-accent underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-accent">
                      {f.label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
