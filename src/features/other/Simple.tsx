"use client";
import { useMemo, useState } from "react";
import { useSave } from "@/components/editor/SaveContext";
import { Button, Field, Notice, NumberField, Panel, TextInput } from "@/components/ui/primitives";
import {
  get_playtime, reset_gambling_events, set_gold_pass, set_playtime, set_restart_pack, set_unlocked_slots, unlocked_slots_info,
} from "@/lib/bcsfe/edits/other";

export function UnlockedSlots() {
  const { save, version, commit } = useSave();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const info = useMemo(() => unlocked_slots_info(save), [save, version]);
  return (
    <Panel title="Unlocked Slots" description="Number of unlocked equip slots (lineups).">
      <NumberField label="Unlocked slots" value={info.value} max={info.max}
        onChange={(v) => commit((s) => set_unlocked_slots(s, v), `Unlocked ${v} slots`)} />
    </Panel>
  );
}

export function ResetGamblingEvents() {
  const { commit } = useSave();
  return (
    <Panel title="Reset Wildcat Slots and Cat Scratcher Lottery" description="Clears the progress of the Wildcat Slots and the Cat Scratcher lottery events.">
      <Button variant="primary" onClick={() => commit(reset_gambling_events, "Reset wildcat slots and cat scratcher")}>Reset events</Button>
    </Panel>
  );
}

export function RestartPack() {
  const { save, commit } = useSave();
  return (
    <Panel title="Restart Pack" description="Enables the Restart Pack (Returner Mode) offer.">
      <Notice>{save.restart_pack ? "Restart pack is currently enabled." : "Restart pack is currently disabled."}</Notice>
      <Button variant="primary" onClick={() => commit(set_restart_pack, "Enabled the restart pack")}>Enable restart pack</Button>
    </Panel>
  );
}

export function Playtime() {
  const { save, version, commit } = useSave();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const cur = useMemo(() => get_playtime(save), [save, version]);
  const [d, setD] = useState<{ h: number; m: number; s: number } | null>(null);
  const v = d ?? { h: cur.hours, m: cur.minutes, s: cur.seconds };
  return (
    <Panel title="Play Time" description={`Current play time: ${cur.hours}h ${cur.minutes}m ${cur.seconds}s (${cur.frames.toLocaleString()} frames).`}>
      <div className="grid gap-3 sm:grid-cols-3">
        <NumberField label="Hours" value={v.h} max={2 ** 31 - 1} hint=" " onChange={(h) => setD({ ...v, h })} />
        <NumberField label="Minutes" value={v.m} max={2 ** 31 - 1} hint=" " onChange={(m) => setD({ ...v, m })} />
        <NumberField label="Seconds" value={v.s} max={2 ** 31 - 1} hint=" " onChange={(s) => setD({ ...v, s })} />
      </div>
      <Button variant="primary" onClick={() => { commit((s) => set_playtime(s, v.h, v.m, v.s), "Updated play time"); setD(null); }}>Apply</Button>
    </Panel>
  );
}

export function GoldPass() {
  const { save, version, commit } = useSave();
  const [text, setText] = useState("");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const officer = useMemo(() => save.officer_pass.gold_pass.officer_id, [save, version]);
  return (
    <Panel title="Gold Pass / Officer Club" description={officer > 0 ? `Current officer id: ${officer}.` : "No gold pass is currently active."}>
      <Field label="Officer id" hint="Leave blank for a random id, or enter -1 to remove the gold pass.">
        {(id) => <TextInput id={id} inputMode="numeric" value={text} placeholder="random" onChange={(e) => setText(e.target.value)} />}
      </Field>
      <Notice tone="warning">The game may remove the gold pass if the server does not confirm it.</Notice>
      <div className="flex flex-wrap gap-2">
        <Button variant="primary" onClick={() => commit((s) => { set_gold_pass(s, text); }, text.trim() === "-1" ? "Removed the gold pass" : "Applied the gold pass")}>Apply</Button>
        <Button variant="danger" onClick={() => commit((s) => { set_gold_pass(s, "-1"); }, "Removed the gold pass")}>Remove gold pass</Button>
      </div>
    </Panel>
  );
}
