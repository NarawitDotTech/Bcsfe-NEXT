import type { FeatureDef } from "@/features/types";
import {
  ConvertRegionPanel,
  ConvertVersionPanel,
  DownloadSavePanel,
  ExportJsonPanel,
  LoadSavePanel,
  UploadSavePanel,
} from "@/features/save_management/SaveFilePanels";
import {
  InquiryCodePanel,
  PasswordRefreshTokenPanel,
  UnbanPanel,
  UploadItemsPanel,
} from "@/features/save_management/AccountPanels";
import { EventGatyaSeedPanel, NormalGatyaSeedPanel, RareGatyaSeedPanel } from "@/features/save_management/GatyaPanels";
import {
  FixGamatotoCrashPanel,
  FixOfficerPassCrashPanel,
  FixOtotoCrashPanel,
  FixTimeErrorsPanel,
  UnlockEquipMenuPanel,
} from "@/features/save_management/FixesPanels";
import { AboutPanel, ManageGameDataPanel, MaxValuesPanel, SettingsPanel } from "@/features/save_management/EditorPanels";

export const features: FeatureDef[] = [
  // save_management
  { key: "save_save", category: "save_management", label: "Download save file", aliases: ["save", "download", "save save", "adb push", "root push", "waydroid"], description: "Download the edited SAVE_DATA file", component: DownloadSavePanel },
  { key: "save_upload", category: "save_management", label: "Upload save to server (transfer codes)", aliases: ["upload", "transfer code", "confirmation code", "get codes"], description: "Get a transfer and confirmation code", component: UploadSavePanel },
  { key: "export_save", category: "save_management", label: "Export save as JSON", aliases: ["export", "json"], component: ExportJsonPanel },
  { key: "load_save", category: "save_management", label: "Load another save", aliases: ["load", "open", "close"], component: LoadSavePanel },
  { key: "convert_region", category: "save_management", label: "Convert country code", aliases: ["convert region", "cc", "en jp kr tw"], component: ConvertRegionPanel },
  { key: "convert_version", category: "save_management", label: "Convert game version", aliases: ["convert version", "gv", "game version"], component: ConvertVersionPanel },
  // account
  { key: "unban_account", category: "account", label: "Unban account / fix save used elsewhere", aliases: ["unban", "banned", "new account", "save used elsewhere"], component: UnbanPanel },
  { key: "upload_items", category: "account", label: "Upload managed items", aliases: ["managed items", "backup"], component: UploadItemsPanel },
  { key: "inquiry_code", category: "account", label: "Inquiry code", aliases: ["account id", "account code"], component: InquiryCodePanel },
  { key: "password_refresh_token", category: "account", label: "Password refresh token", aliases: ["token", "password"], component: PasswordRefreshTokenPanel },
  // gatya
  { key: "rare_gatya_seed", category: "gatya", label: "Rare gacha seed", aliases: ["rare gatya seed", "gacha seed", "gatya"], component: RareGatyaSeedPanel },
  { key: "normal_gatya_seed", category: "gatya", label: "Normal gacha seed", aliases: ["normal gatya seed", "gacha seed", "gatya"], component: NormalGatyaSeedPanel },
  { key: "event_gatya_seed", category: "gatya", label: "Event gacha seed", aliases: ["event gatya seed", "gacha seed", "gatya"], component: EventGatyaSeedPanel },
  // fixes
  { key: "fix_gamatoto_crash", category: "fixes", label: "Fix gamatoto crashing the game", aliases: ["gamatoto crash"], component: FixGamatotoCrashPanel },
  { key: "fix_ototo_crash", category: "fixes", label: "Fix ototo crashing the game", aliases: ["ototo crash", "cannon crash"], component: FixOtotoCrashPanel },
  { key: "fix_time_errors", category: "fixes", label: "Fix time related issues", aliases: ["time errors", "clock", "date"], component: FixTimeErrorsPanel },
  { key: "unlock_equip_menu", category: "fixes", label: "Unlock equip menu", aliases: ["equip", "lineup menu"], component: UnlockEquipMenuPanel },
  { key: "fix_officer_pass_crash", category: "fixes", label: "Fix officer club crashing", aliases: ["officer pass crash", "gold pass crash"], component: FixOfficerPassCrashPanel },
  // editor
  { key: "config", category: "editor", label: "Settings", aliases: ["config", "preferences", "language", "locale", "disable maxes"], component: SettingsPanel },
  { key: "max_values", category: "editor", label: "Maximum values", aliases: ["max values", "limits", "caps"], component: MaxValuesPanel },
  { key: "manage_game_data", category: "editor", label: "Manage game data", aliases: ["game data", "cache", "download game data"], component: ManageGameDataPanel },
  { key: "about", category: "editor", label: "About", aliases: ["credits", "license", "help"], component: AboutPanel },
];
