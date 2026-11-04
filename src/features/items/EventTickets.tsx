"use client";
import { useEffect, useState } from "react";
import { Button, Notice, NumberGrid, Panel } from "@/components/ui/primitives";
import { useSave } from "@/components/editor/SaveContext";
import { edit_event_tickets, load_event_tickets, type EventTicketsResult } from "@/lib/bcsfe/edits/event_tickets";
import { useKey } from "./shared";

function Body() {
  const { save, commit } = useSave();
  const [result, setResult] = useState<EventTicketsResult | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [values, setValues] = useState<number[]>([]);

  useEffect(() => {
    let live = true;
    setResult(null);
    load_event_tickets(save).then((r) => {
      if (!live) return;
      setResult(r);
      if (r.ok) setValues(r.entries.map((e) => e.value));
    }).catch(() => live && setResult({ ok: false, error: "download_failed" }));
    return () => { live = false; };
  }, [save, attempt]);

  if (result === null) return <Notice>Downloading gacha event data…</Notice>;
  if (!result.ok) {
    return (
      <div className="space-y-3">
        <Notice tone="danger">
          {result.error === "no_game_data"
            ? "Gacha option data is missing from the game data."
            : "Failed to download gacha event data. Check your connection and try again."}
        </Notice>
        <Button onClick={() => setAttempt((a) => a + 1)}>Retry</Button>
      </div>
    );
  }
  if (result.entries.length === 0) return <Notice>No event tickets are available in the current event data.</Notice>;
  const changed = values.some((v, i) => v !== result.entries[i].value);
  return (
    <div className="space-y-4">
      <NumberGrid
        rows={result.entries.map((e, i) => ({ key: i, label: e.label, value: values[i] ?? e.value, max: result.max }))}
        onChange={(k, v) => setValues((cur) => cur.map((x, i) => (i === k ? v : x)))} />
      <div className="flex flex-wrap gap-2">
        <Button variant="primary" disabled={!changed}
          onClick={() => { commit((s) => edit_event_tickets(s, result.entries, values), "Event tickets updated"); setAttempt((a) => a + 1); }}>
          Apply
        </Button>
        <Button onClick={() => setValues(values.map(() => result.max))}>Set all to max</Button>
      </div>
    </div>
  );
}

export function EventTicketsPanel() {
  const key = useKey();
  return (
    <Panel title="Event Tickets / Lucky Tickets" description="Lists tickets for gacha events from the live event server.">
      <Body key={key} />
    </Panel>
  );
}
