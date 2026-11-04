"use client";
import { Button, Notice, Panel } from "@/components/ui/primitives";
import { useSave } from "@/components/editor/SaveContext";
import type { SaveFile } from "@/lib/bcsfe/core/io/save";
import {
  fix_gamatoto_crash,
  fix_officer_pass_crash,
  fix_ototo_crash,
  fix_time_errors,
  unlock_equip_menu,
} from "@/lib/bcsfe/edits/fixes";

function FixPanel({ title, description, button, success, note, run }: {
  title: string; description: string; button: string; success: string; note?: string; run: (s: SaveFile) => void;
}) {
  const { commit } = useSave();
  return (
    <Panel title={title} description={description}>
      {note && <Notice tone="warning">{note}</Notice>}
      <Button variant="primary" onClick={() => commit(run, success)}>{button}</Button>
    </Panel>
  );
}

export const FixGamatotoCrashPanel = () => (
  <FixPanel title="Fix gamatoto from crashing the game" description="Resets the gamatoto skin to a valid value (2)."
    button="Apply fix" success="Fixed gamatoto from crashing the game" run={fix_gamatoto_crash} />
);
export const FixOtotoCrashPanel = () => (
  <FixPanel title="Fix ototo from crashing the game" description="Replaces the ototo cannon data with fresh defaults for your game version. Cannon levels are reset."
    button="Apply fix" success="Fixed ototo from crashing the game" run={fix_ototo_crash} />
);
export const FixTimeErrorsPanel = () => (
  <FixPanel title="Fix time related issues" description="Sets the save's gacha date, timestamp and energy penalty timestamp to the current time."
    note="Your device time on both devices (this one and the one running the game) must be correct for this to work."
    button="Apply fix" success="Fixed time related issues" run={fix_time_errors} />
);
export const UnlockEquipMenuPanel = () => (
  <FixPanel title="Unlock equip menu" description="Unlocks the equip menu in the cat base without having to reach the required stage."
    button="Unlock equip menu" success="Equip menu unlocked" run={unlock_equip_menu} />
);
export const FixOfficerPassCrashPanel = () => (
  <FixPanel title="Fix officer club crashing" description="Resets the officer pass: cat, form and play time are cleared and any gold pass is removed."
    button="Apply fix" success="Fixed the officer club from crashing" run={fix_officer_pass_crash} />
);
