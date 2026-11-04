"use client";
import { useMemo, useState } from "react";
import { useSave } from "@/components/editor/SaveContext";
import { Button, MultiSelect, Notice, Panel, Segmented } from "@/components/ui/primitives";
import {
  apply_medals, apply_rank_rewards, edit_missions, fix_claimed_rewards, medal_options, mission_options, rank_reward_options,
  type MissionClaim, type RankRewardChoice,
} from "@/lib/bcsfe/edits/other";

export function UserRankRewards() {
  const { save, version, commit } = useSave();
  const [choice, setChoice] = useState<RankRewardChoice | "fix_claimed">("claim");
  const [sel, setSel] = useState<Set<number>>(new Set());
  const opts = useMemo(
    // eslint-disable-next-line react-hooks/exhaustive-deps
    () => (choice === "fix_claimed" ? null : rank_reward_options(save, choice)), [save, version, choice]);
  return (
    <Panel title="Claim User Rank Rewards" description="Marks rewards as claimed or unclaimed (does not give the items).">
      <Segmented value={choice} onChange={(c) => { setChoice(c); setSel(new Set()); }}
        options={[{ value: "claim", label: "Claim" }, { value: "unclaim", label: "Unclaim" }, { value: "fix_claimed", label: "Fix claimed" }]} />
      {choice === "fix_claimed" ? (
        <>
          <Notice>Unclaims every reward whose rank requirement is above your current user rank.</Notice>
          <Button variant="primary" onClick={() => commit((s) => { fix_claimed_rewards(s); }, "Fixed claimed user rank rewards")}>Fix claimed rewards</Button>
        </>
      ) : opts === null ? (
        <Notice tone="warning">Rank reward data is unavailable (game data missing).</Notice>
      ) : opts.rank_gifts.length === 0 ? (
        <Notice>No rewards to {choice}.</Notice>
      ) : (
        <>
          <MultiSelect showIds={false} items={opts.rank_gifts.map((g, i) => ({ id: i, label: opts.descriptions[i] }))} selected={sel} onChange={setSel} />
          <Button variant="primary" disabled={sel.size === 0}
            onClick={() => { commit((s) => apply_rank_rewards(s, opts.rank_gifts, [...sel], choice), `${choice === "claim" ? "Claimed" : "Unclaimed"} ${sel.size} rewards`); setSel(new Set()); }}>
            {choice === "claim" ? "Claim rewards" : "Unclaim rewards"}
          </Button>
        </>
      )}
    </Panel>
  );
}

export function Medals() {
  const { save, version, commit } = useSave();
  const [add, setAdd] = useState(true);
  const [sel, setSel] = useState<Set<number>>(new Set());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const opts = useMemo(() => medal_options(save, add), [save, version, add]);
  return (
    <Panel title="Meow Medals" description="Add medals you do not own, or remove owned medals.">
      <Segmented value={add ? "add" : "remove"} onChange={(v) => { setAdd(v === "add"); setSel(new Set()); }}
        options={[{ value: "add", label: "Add medals" }, { value: "remove", label: "Remove medals" }]} />
      {opts.length === 0 ? <Notice>No medals to {add ? "add" : "remove"} (or medal names are unavailable).</Notice> : (
        <MultiSelect items={opts.map((o) => ({ id: o.id, label: o.label }))} selected={sel} onChange={setSel} />
      )}
      <Button variant="primary" disabled={sel.size === 0}
        onClick={() => { commit((s) => apply_medals(s, [...sel], add), `${add ? "Added" : "Removed"} ${sel.size} medals`); setSel(new Set()); }}>
        {add ? "Add medals" : "Remove medals"}
      </Button>
    </Panel>
  );
}

const STATE: Record<number, string> = { 0: "incomplete", 2: "complete", 4: "claimed" };

export function Missions() {
  const { save, version, commit } = useSave();
  const [claim, setClaim] = useState<MissionClaim>("complete_claim");
  const [sel, setSel] = useState<Set<number>>(new Set());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const opts = useMemo(() => mission_options(save), [save, version]);
  if (opts === null) return <Notice tone="warning">Mission data is unavailable (game data missing).</Notice>;
  return (
    <Panel title="Catnip Challenges / Missions" description="Only missions present in your save are listed.">
      <Segmented value={claim} onChange={setClaim} options={[
        { value: "complete_reward", label: "Complete (don't claim)" },
        { value: "complete_claim", label: "Complete and claim" },
        { value: "uncomplete", label: "Uncomplete" },
      ]} />
      <MultiSelect items={opts.map((o) => ({ id: o.id, label: o.label, detail: STATE[o.state] ?? `state ${o.state}` }))} selected={sel} onChange={setSel} />
      <Button variant="primary" disabled={sel.size === 0}
        onClick={() => { commit((s) => edit_missions(s, [...sel], claim), `Edited ${sel.size} missions`); setSel(new Set()); }}>Apply</Button>
    </Panel>
  );
}
