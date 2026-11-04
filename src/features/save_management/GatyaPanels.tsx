"use client";
import { NumberField, Panel } from "@/components/ui/primitives";
import { useSave } from "@/components/editor/SaveContext";
import { get_gatya_seed, set_gatya_seed, U32_MAX, type GatyaSeedKind } from "@/lib/bcsfe/edits/account";

const TEXT: Record<GatyaSeedKind, { title: string; description: string }> = {
  rare: { title: "Rare gacha seed", description: "Seed of the random generator used by rare gacha. The same seed on the same banner gives the same results." },
  normal: { title: "Normal gacha seed", description: "Seed of the random generator used by the normal (cat ticket / XP) gacha." },
  event: { title: "Event gacha seed", description: "Seed of the random generator used by event gacha." },
};

function SeedPanel({ kind }: { kind: GatyaSeedKind }) {
  const { save, commit, version } = useSave();
  void version;
  return (
    <Panel title={TEXT[kind].title} description={TEXT[kind].description}>
      <NumberField
        label="Seed" value={get_gatya_seed(save, kind)} min={0} max={U32_MAX} hint="Unsigned 32 bit integer (0 to 4,294,967,295)"
        onChange={(v) => commit((s) => set_gatya_seed(s, kind, v), `${TEXT[kind].title} set to ${v}`)}
      />
    </Panel>
  );
}

export const RareGatyaSeedPanel = () => <SeedPanel kind="rare" />;
export const NormalGatyaSeedPanel = () => <SeedPanel kind="normal" />;
export const EventGatyaSeedPanel = () => <SeedPanel kind="event" />;
