import type { FeatureDef } from "@/features/types";
import { CatfoodPanel, XpPanel, NormalTicketsPanel, RareTicketsPanel, PlatinumTicketsPanel, LegendTicketsPanel,
  PlatinumShardsPanel, NpPanel, LeadershipPanel, HundredMillionTicketsPanel } from "./Scalars";
import { RareTicketTradePanel } from "./RareTicketTrade";
import { BattleItemsPanel, EndlessBattleItemsPanel } from "./BattleItems";
import { CatseyesPanel, CataminsPanel, LabyrinthMedalsPanel, TreasureChestsPanel, CatfruitPanel } from "./Lists";
import { TalentOrbsPanel } from "./TalentOrbs";
import { SchemeItemsPanel } from "./SchemeItems";
import { EventTicketsPanel } from "./EventTickets";
import { ResetGoldenCatCpusPanel } from "./GoldenCpus";

const items = (f: Omit<FeatureDef, "category">): FeatureDef => ({ category: "items", ...f });

export const features: FeatureDef[] = [
  items({ key: "catfood", label: "Cat Food", component: CatfoodPanel, needsGameData: true, description: "Bannable: tracked as a managed item." }),
  items({ key: "xp", label: "XP", component: XpPanel, needsGameData: true }),
  items({ key: "normal_tickets", label: "Normal Tickets", aliases: ["Basic Tickets", "Silver Tickets"], component: NormalTicketsPanel, needsGameData: true }),
  items({ key: "rare_tickets", label: "Rare Tickets", aliases: ["Gold Tickets"], component: RareTicketsPanel, needsGameData: true, description: "Bannable: can switch to the safer rare ticket trade." }),
  items({ key: "rare_ticket_trade", label: "Rare Ticket Trade (Allows for unbannable rare tickets)", aliases: ["rare ticket trade"], component: RareTicketTradePanel }),
  items({ key: "platinum_tickets", label: "Platinum Tickets", component: PlatinumTicketsPanel, needsGameData: true, description: "Bannable: can switch to platinum shards." }),
  items({ key: "legend_tickets", label: "Legend Tickets", component: LegendTicketsPanel, needsGameData: true }),
  items({ key: "platinum_shards", label: "Platinum Shards", component: PlatinumShardsPanel, needsGameData: true }),
  items({ key: "np", label: "NP", component: NpPanel, needsGameData: true }),
  items({ key: "leadership", label: "Leadership", component: LeadershipPanel, needsGameData: true }),
  items({ key: "battle_items", label: "Battle Items", component: BattleItemsPanel, needsGameData: true }),
  items({ key: "battle_items_endless", label: "Endless Battle Items", component: EndlessBattleItemsPanel, needsGameData: true }),
  items({ key: "catseyes", label: "Catseyes", component: CatseyesPanel, needsGameData: true }),
  items({ key: "catfruit", label: "Catfruit / Behemoth Stones", aliases: ["Catfruit", "Behemoth Stones", "Matatabi"], component: CatfruitPanel, needsGameData: true }),
  items({ key: "talent_orbs", label: "Talent Orbs", component: TalentOrbsPanel, needsGameData: true }),
  items({ key: "catamins", label: "Catamins", component: CataminsPanel, needsGameData: true }),
  items({ key: "scheme_items", label: "Scheme Items", component: SchemeItemsPanel, needsGameData: true }),
  items({ key: "labyrinth_medals", label: "Labyrinth Medals", component: LabyrinthMedalsPanel, needsGameData: true }),
  items({ key: "100_million_tickets", label: "100 Million Downloads Tickets", aliases: ["One Hundred Million Downloads Tickets"], component: HundredMillionTicketsPanel, needsGameData: true }),
  items({ key: "event_tickets", label: "Event Tickets / Lucky Tickets", aliases: ["Event Tickets", "Lucky Tickets"], component: EventTicketsPanel, needsGameData: true }),
  items({ key: "treasure_chests", label: "Treasure Chests", component: TreasureChestsPanel, needsGameData: true }),
  items({ key: "reset_golden_cat_cpus", label: "Reset Golden Cat CPU Uses", component: ResetGoldenCatCpusPanel }),
];
