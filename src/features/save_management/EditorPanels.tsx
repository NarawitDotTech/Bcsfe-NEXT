"use client";
import { useCallback, useEffect, useState } from "react";
import { Button, Checkbox, Field, Notice, NumberField, Panel, Select, TextInput } from "@/components/ui/primitives";
import { useSave } from "@/components/editor/SaveContext";
import { formatBytes } from "@/components/editor/helpers";
import { core_data } from "@/lib/bcsfe/core/core_data";
import { CONFIG_ENTRIES, ConfigKey, type ConfigEntry, type ConfigValue } from "@/lib/bcsfe/core/io/config";
import { LocalManager, strip_color_tags } from "@/lib/bcsfe/core/locale_handler";
import { MAX_VALUE_DEFAULTS, MaxValueHelper, type MaxValues } from "@/lib/bcsfe/core/max_value_helper";
import { GameDataGetter, type CachedVersion } from "@/lib/bcsfe/core/server/game_data_getter";
import { CountryCode } from "@/lib/bcsfe/core/country_code";
import { GameVersion } from "@/lib/bcsfe/core/game_version";

// ------------------------------------------------------------------ settings

/** Options that are meaningless in a browser even though they are not flagged by the core. */
const HIDDEN_KEYS = new Set<ConfigKey>([ConfigKey.MAX_BACKUPS]);
/** Changing these requires the game data to be prepared again. */
const RELOAD_GAME_DATA = new Set<ConfigKey>([ConfigKey.LOCALE, ConfigKey.FORCE_LANG_GAME_DATA, ConfigKey.GAME_DATA_REPO]);

function describe(entry: ConfigEntry): string {
  const text = strip_color_tags(core_data.local_manager.get_key(entry.desc_key, { current_value: "", default_value: "" }));
  return text.replace(/\s*\(current value:.*$/s, "").replace(/:$/, "").trim();
}

function SettingRow({ entry, onChanged }: { entry: ConfigEntry; onChanged: (key: ConfigKey) => void }) {
  const cfg = core_data.config;
  const value = cfg.get(entry.key);
  const label = strip_color_tags(core_data.local_manager.get_key(entry.label_key));
  const hint = describe(entry);
  const [draft, setDraft] = useState(String(value));
  const set = (v: ConfigValue) => { cfg.set(entry.key, v); onChanged(entry.key); };

  if (entry.key === ConfigKey.LOCALE) {
    return (
      <Field label={label} hint={hint}>
        {(id) => (
          <Select id={id} value={String(value)} onChange={(e) => { set(e.target.value); core_data.reload_locale(); }}>
            {LocalManager.get_locale_names().map(([code, name]) => <option key={code} value={code}>{name}</option>)}
          </Select>
        )}
      </Field>
    );
  }
  if (entry.type === "bool") {
    return <Checkbox label={label} hint={hint} checked={Boolean(value)} onChange={set} />;
  }
  if (entry.type === "int") {
    return <NumberField label={label} hint={hint} value={Number(value)} min={entry.min} max={entry.key === ConfigKey.MAX_REQUEST_TIMEOUT || entry.max === 2147483647 ? undefined : entry.max} onChange={set} />;
  }
  const dirty = draft !== String(value);
  return (
    <Field label={label} hint={hint}>
      {(id) => (
        <div className="flex gap-2">
          <TextInput id={id} value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && dirty && set(draft)} />
          <Button disabled={!dirty} onClick={() => set(draft)}>Apply</Button>
          <Button variant="ghost" disabled={String(value) === String(entry.default)} onClick={() => { setDraft(String(entry.default)); set(entry.default); }}>Reset</Button>
        </div>
      )}
    </Field>
  );
}

export function SettingsPanel() {
  const { loadGameData, notify } = useSave();
  const [, bump] = useState(0);
  const entries = CONFIG_ENTRIES.filter((e) => e.browser_relevant && !HIDDEN_KEYS.has(e.key));
  const onChanged = (key: ConfigKey) => {
    bump((n) => n + 1);
    if (RELOAD_GAME_DATA.has(key)) {
      loadGameData();
      notify("Setting saved. Reloading game data...", "success");
    } else {
      notify("Setting saved", "success");
    }
  };
  return (
    <Panel
      title="Settings"
      description="Stored in this browser only. Most options apply to the next edit; language and game data options reload the game data."
      actions={<Button variant="ghost" onClick={() => { core_data.config.reset(); core_data.reload_locale(); bump((n) => n + 1); loadGameData(); notify("Settings reset to defaults", "success"); }}>Reset all</Button>}
    >
      <div className="grid gap-5 md:grid-cols-2">
        {entries.map((e) => <SettingRow key={e.key} entry={e} onChanged={onChanged} />)}
      </div>
    </Panel>
  );
}

// ------------------------------------------------------------------ max values

function humanize(key: string): string {
  const s = key.replace(/_/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function MaxValuesPanel() {
  const { notify } = useSave();
  const [, bump] = useState(0);
  const mvm = core_data.max_value_manager as unknown as Record<string, number>;
  const disabled = core_data.config.get_bool(ConfigKey.DISABLE_MAXES);
  return (
    <Panel
      title="Maximum values"
      description="The caps used by the number inputs of other features. Stored in this browser."
      actions={<Button variant="ghost" onClick={() => { const d = MaxValueHelper.default(); d.save(); core_data.max_value_manager = d; bump((n) => n + 1); notify("Maximum values reset to defaults", "success"); }}>Reset to defaults</Button>}
    >
      {disabled && <Notice tone="warning">&ldquo;Disable maximum values&rdquo; is on in Settings, so these caps are currently ignored.</Notice>}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {(Object.keys(MAX_VALUE_DEFAULTS) as (keyof MaxValues)[]).map((k) => (
          <NumberField key={k} label={humanize(k)} value={mvm[k]} min={0} hint={`Default ${MAX_VALUE_DEFAULTS[k].toLocaleString()}`}
            onChange={(v) => { mvm[k] = v; core_data.max_value_manager.save(); bump((n) => n + 1); }} />
        ))}
      </div>
    </Panel>
  );
}

// ------------------------------------------------------------------ game data

export function ManageGameDataPanel() {
  const { save, loadGameData, gameData, notify } = useSave();
  const [cached, setCached] = useState<CachedVersion[] | null>(null);
  const refresh = useCallback(async () => setCached((await GameDataGetter.list_cached_versions()).sort((a, b) => a.cc.localeCompare(b.cc) || GameVersion.from_string(b.version).game_version - GameVersion.from_string(a.version).game_version)), []);
  useEffect(() => { void refresh(); }, [refresh, gameData]);

  const getter = core_data.game_data_getter;
  const current = getter?.version ? `${getter.cc.get_code()} ${getter.version}` : null;
  const del = async (c: CachedVersion) => {
    await GameDataGetter.delete(new CountryCode(c.cc), GameVersion.from_string(c.version));
    notify(`Deleted game data ${c.cc} ${c.version}`, "success");
    await refresh();
  };
  const redownload = async () => {
    if (getter?.version) await GameDataGetter.delete(getter.cc, GameVersion.from_string(getter.version));
    loadGameData();
    notify("Re-downloading game data...", "info");
  };
  const total = (cached ?? []).reduce((n, c) => n + c.size, 0);

  return (
    <Panel
      title="Manage game data"
      description="Game data (cat names, stage lists, max levels, ...) is downloaded once per game version and cached in this browser."
      actions={<Button variant="primary" onClick={redownload} disabled={gameData === "loading"}>Re-download current</Button>}
    >
      <p className="text-sm text-muted">
        Save: <b className="text-foreground">{save.cc.get_code()} {save.game_version.to_string()}</b>
        {current && <> - using <b className="text-foreground">{current}</b></>}
        {" "}- status: {gameData}
      </p>
      {cached === null ? <p className="text-sm text-muted">Reading cache...</p> : cached.length === 0 ? (
        <p className="text-sm text-muted">Nothing cached yet.</p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {cached.map((c) => (
            <li key={`${c.cc}/${c.version}`} className="flex items-center gap-3 px-3 py-2 text-sm">
              <span className="w-8 font-mono uppercase">{c.cc}</span>
              <span className="min-w-0 flex-1">{c.version} <span className="text-muted">- {formatBytes(c.size)}, {new Date(c.saved).toLocaleDateString()}</span></span>
              <Button variant="danger" onClick={() => del(c)}>Delete</Button>
            </li>
          ))}
        </ul>
      )}
      {cached && cached.length > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={async () => { await GameDataGetter.delete_all(); notify("Deleted all cached game data", "success"); await refresh(); }}>Delete all ({formatBytes(total)})</Button>
          <span className="text-xs text-muted">Deleted data is downloaded again the next time it is needed.</span>
        </div>
      )}
    </Panel>
  );
}

// ------------------------------------------------------------------ about

export function AboutPanel() {
  return (
    <Panel title="About BCSFE Web">
      <p className="text-sm">
        BCSFE Web is a browser port of{" "}
        <a className="text-accent underline underline-offset-2" href="https://github.com/fieryhenry/BCSFE-Python" target="_blank" rel="noreferrer">BCSFE-Python</a>{" "}
        by fieryhenry, the Battle Cats save file editor. All save parsing and editing runs locally in your browser; only server features
        (transfer codes, account fixes, game data downloads) make network requests, and they go through this app&apos;s proxy.
      </p>
      <p className="text-sm text-muted">Licensed under the GNU General Public License v3.0 (GPL-3.0), like the original project. Not affiliated with PONOS. Always keep a backup of your original save.</p>
      <p className="text-sm text-muted">Editing cat food, tickets and other account-linked items can get an account banned. Use at your own risk.</p>
    </Panel>
  );
}
