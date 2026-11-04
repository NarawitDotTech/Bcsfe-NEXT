"use client";
import { useState } from "react";
import { Button, Notice, NumberField, Panel } from "@/components/ui/primitives";
import { useSave } from "@/components/editor/SaveContext";
import { get_rare_ticket_trade_max, rare_ticket_trade } from "@/lib/bcsfe/edits/rare_ticket_trade";
import { useKey } from "./shared";

const ERRORS = {
  maxed: "You already have the maximum amount of rare tickets. Use some before running this feature.",
  storage_full: "You don't have enough space in your cat storage. Free 1 storage slot first.",
  invalid_amount: "Enter a valid amount.",
} as const;

export function RareTicketTradeBody() {
  const { save, commit, notify } = useSave();
  const max = get_rare_ticket_trade_max(save);
  const [amount, setAmount] = useState(Math.min(max, 1));
  const [done, setDone] = useState<number | null>(null);
  if (max === 0) return <Notice tone="danger">{ERRORS.maxed}</Notice>;
  return (
    <div className="space-y-4">
      <Notice>
        Adds a ticket trade to your cat storage. After applying, open the cat storage in game, press &quot;Use all&quot; and then
        &quot;Trade for Ticket&quot; to receive the tickets. This avoids directly editing rare tickets.
      </Notice>
      <NumberField label="Rare tickets to add" value={amount} min={1} max={max}
        hint={`Current ${save.rare_tickets} · max addable ${max}`} onChange={setAmount} />
      <Button variant="primary" disabled={amount < 1}
        onClick={() => {
          const res = rare_ticket_trade(save, amount);
          if (!res.ok) { notify(ERRORS[res.error], "danger"); return; }
          commit(undefined, `Prepared a trade for ${res.added} rare tickets. Trade them in the cat storage.`);
          setDone(res.added);
        }}>Apply</Button>
      {done !== null && <Notice tone="success">Successfully gave {done} rare tickets. Now enter the cat storage, press &quot;Use all&quot; and then &quot;Trade for Ticket&quot;.</Notice>}
    </div>
  );
}

export function RareTicketTradePanel() {
  const key = useKey();
  return (
    <Panel title="Rare Ticket Trade" description="Allows for unbannable rare tickets.">
      <RareTicketTradeBody key={key} />
    </Panel>
  );
}
