"use client";
import { useState } from "react";
import { Notice, Segmented } from "@/components/ui/primitives";
import * as bi from "@/lib/bcsfe/edits/basic_items";
import { ScalarEditor, ScalarPanel, useKey } from "./shared";
import { RareTicketTradeBody } from "./RareTicketTrade";
import { Panel } from "@/components/ui/primitives";

export function CatfoodPanel() {
  return <ScalarPanel title="Cat Food" getInfo={bi.get_catfood_info} apply={bi.edit_catfood} warning={() => bi.get_warning("catfood_warning")} />;
}
export function XpPanel() {
  return <ScalarPanel title="XP" getInfo={bi.get_xp_info} apply={bi.edit_xp} />;
}
export function NormalTicketsPanel() {
  return <ScalarPanel title="Normal Tickets" getInfo={bi.get_normal_tickets_info} apply={bi.edit_normal_tickets} />;
}
export function LegendTicketsPanel() {
  return <ScalarPanel title="Legend Tickets" getInfo={bi.get_legend_tickets_info} apply={bi.edit_legend_tickets} warning={() => bi.get_warning("legend_ticket_warning")} />;
}
export function NpPanel() {
  return <ScalarPanel title="NP" getInfo={bi.get_np_info} apply={bi.edit_np} />;
}
export function LeadershipPanel() {
  return <ScalarPanel title="Leadership" getInfo={bi.get_leadership_info} apply={bi.edit_leadership} />;
}
export function HundredMillionTicketsPanel() {
  return <ScalarPanel title="100 Million Downloads Tickets" getInfo={bi.get_hundred_million_ticket_info} apply={bi.edit_100_million_ticket} note={() => bi.get_warning("100_million_warn")} />;
}
export function PlatinumShardsBody() {
  const key = useKey();
  return <ScalarEditor key={key} getInfo={bi.get_platinum_shards_info} apply={bi.edit_platinum_shards}
    note={`Every 10 shards become 1 platinum ticket in game. Shards are capped so tickets plus shards cannot exceed the ticket maximum.`} />;
}
export function PlatinumShardsPanel() {
  return <Panel title="Platinum Shards"><PlatinumShardsBody /></Panel>;
}

type Route = "direct" | "safe";

export function RareTicketsPanel() {
  const key = useKey();
  const [route, setRoute] = useState<Route>("direct");
  return (
    <Panel title="Rare Tickets"
      description="Edit rare tickets directly (can be bannable), or use the rare ticket trade for a much lower ban risk.">
      <Segmented<Route> value={route} onChange={setRoute} options={[
        { value: "direct", label: "Edit directly" },
        { value: "safe", label: `Go to the safer ${bi.locale_name("rare_ticket_trade_l")} feature` },
      ]} />
      {route === "direct"
        ? <ScalarEditor key={key} getInfo={bi.get_rare_tickets_info} apply={bi.edit_rare_tickets} warning={bi.get_warning("rare_ticket_warning")} />
        : <RareTicketTradeBody key={key} />}
    </Panel>
  );
}

export function PlatinumTicketsPanel() {
  const key = useKey();
  const [route, setRoute] = useState<Route>("direct");
  return (
    <Panel title="Platinum Tickets"
      description="Edit platinum tickets directly (can be bannable), or use platinum shards for a much lower ban risk.">
      <Segmented<Route> value={route} onChange={setRoute} options={[
        { value: "direct", label: "Edit directly" },
        { value: "safe", label: `Go to the safer ${bi.locale_name("platinum_shards_l")} feature` },
      ]} />
      {route === "direct"
        ? <ScalarEditor key={key} getInfo={bi.get_platinum_tickets_info} apply={bi.edit_platinum_tickets} warning={bi.get_warning("platinum_ticket_warning")} />
        : <PlatinumShardsBody />}
      {route === "safe" && <Notice>Shards are not tracked as managed items, so they carry a lower ban risk.</Notice>}
    </Panel>
  );
}
