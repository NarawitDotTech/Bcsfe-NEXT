import fs from "node:fs";
import assert from "node:assert/strict";
import { SaveFile } from "@/lib/bcsfe/core/io/save";
import { loadGameDataForSave } from "./node-game-data.ts";
import * as M from "@/lib/bcsfe/edits/map";
import { clear_tutorial } from "@/lib/bcsfe/edits/clear_tutorial";
import { unlock_aku_realm } from "@/lib/bcsfe/edits/aku_realm";

const bytes = new Uint8Array(fs.readFileSync("tests/fixtures/py_en_150500.sav"));
let save = SaveFile.from_bytes(bytes);
const gd = process.env.BCSFE_GAME_DATA ?? "/tmp/claude-0/-home-user-Bcsfe-NEXT/6bd7b2fe-89da-55e7-9504-8ba6327e1d10/scratchpad/dl/en.tar.xz";
console.log("game data files", await loadGameDataForSave(save, gd));

let ok = 0;
function t(name: string, fn: () => void) { fn(); ok++; console.log("ok -", name); }

/* Fixture saves are "fresh" (no map data), so build realistic map structures like a played save has. */
import { times } from "@/lib/bcsfe/core/utils";
import { EventChapterGroup, EventChapters, EventStage } from "@/lib/bcsfe/core/game/map/event";
import { Chapters as CChapters, ChaptersStars as CStars } from "@/lib/bcsfe/core/game/map/chapters";
import { GauntletChapters, ChaptersStars as GStars } from "@/lib/bcsfe/core/game/map/gauntlets";
import { LegendQuestChapters, ChaptersStars as LStars } from "@/lib/bcsfe/core/game/map/legend_quest";
import { ZeroLegendsChapters, ChaptersStars as ZStars, Chapter as ZChapter, Stage as ZStage } from "@/lib/bcsfe/core/game/map/zero_legends";
import { ChaptersStars as AStars, AkuChapters } from "@/lib/bcsfe/core/game/map/aku";
import { Chapter as OChapter, Outbreak } from "@/lib/bcsfe/core/game/map/outbreaks";

function seed(s: SaveFile) {
  const group = () => {
    const g = EventChapterGroup.init(300, 3);
    for (const sub of g.chapters) for (const st of sub.chapters) {
      st.stages = times(4, () => EventStage.init());
    }
    return g;
  };
  s.event_stages = new EventChapters([group(), group(), group()]);
  const gs = () => new GauntletChapters(times(60, () => GStars.init(3, 2)), times(60, () => 0));
  s.gauntlets = gs(); s.collab_gauntlets = gs(); s.behemoth_culling = gs(); s.enigma_clears = gs();
  s.legend_quest = new LegendQuestChapters(times(60, () => LStars.init(3, 2)), times(60, () => 0), times(3, () => 0));
  const cs = () => new CChapters(times(60, () => CStars.init(3, 2)));
  s.uncanny.chapters = cs(); s.catamin_stages.chapters = cs(); s.tower.chapters = cs();
  const zl = () => new ZeroLegendsChapters(times(60, () => new ZStars(0, times(3, () => new ZChapter(0, 0, 0, times(3, () => new ZStage(0)))))));
  s.zero_legends = zl(); s.dojo_chapters = zl();
  s.aku = new AkuChapters([AStars.init(49, 1)]);
  s.outbreaks.chapters = new Map([0, 1, 2, 4, 5, 6].map((id) => [id, new OChapter(id, new Map(times(5, (i) => [i, new Outbreak(false)] as [number, Outbreak])))]));
  s.outbreaks.current_outbreaks = new Map([[0, new OChapter(0, new Map([[0, new Outbreak(true)]]))]]);
}
seed(save);

const reparse = () => { save = SaveFile.from_bytes(save.to_bytes()); };

t("clear tutorial", () => {
  clear_tutorial(save);
  assert.ok(save.tutorial_state >= 1);
  assert.ok(save.story.chapters[0].stages[0].clear_times > 0);
});

t("clear story all chapters", () => {
  M.clear_story(save, [0, 1, 2, 3, 4, 5, 6, 7, 8]);
  for (const c of save.story.get_real_chapters()) {
    assert.equal(c.progress, 48);
    assert.ok(c.stages.slice(0, 48).every((s) => s.clear_times >= 1));
  }
  const names = M.story_chapter_names(save);
  assert.equal(names.length, 9);
  assert.equal(M.story_stage_names(save, 0).length, 48);
});

t("story edit plan (specific stages, clear count, unclear other)", () => {
  assert.ok(M.story_could_unclear(save, 1, [4]));
  M.edit_story_chapters(save, [{ chapter_id: 1, stages: [0, 1, 2, 3, 4], clear_amount: 7, unclear_other_stages: true }]);
  const c = save.story.get_real_chapters()[1];
  assert.equal(c.progress, 5);
  assert.equal(c.stages[2].clear_times, 7);
  assert.equal(c.stages[10].clear_times, 0);
  M.clear_story(save, [1]);
});

t("treasures", () => {
  M.edit_treasures_whole_chapters(save, { chapters: [0, 3, 6], level: 3 });
  assert.ok(save.story.get_real_chapters()[3].get_valid_treasure_stages().every((s) => s.treasure === 3));
  M.edit_treasures_individual_stages(save, [0], [0, 1], 2);
  const opts = M.treasure_level_options(save);
  assert.equal(opts.length, 4);
  const groups = M.treasure_groups(save, 0);
  assert.ok(groups && groups.length > 0, "treasure groups");
  assert.ok(M.edit_treasure_groups(save, 0, new Map([[0, 1]])));
  M.edit_itf_timed_scores(save, [3, 4, 5], 100, 200, null);
  const st = save.story.get_real_chapters()[4].stages[0];
  assert.ok(st.itf_timed_score >= 100 && st.itf_timed_score <= 200);
  M.edit_itf_timed_scores(save, [3], 5, 5, [0, 1]);
  assert.equal(save.story.get_real_chapters()[3].stages[1].itf_timed_score, 5);
});

t("event / sol map clear, unclear, clear counts", () => {
  const sol = M.get_map_target(save, "sol");
  const mo = M.load_map_option(save);
  assert.ok(mo, "map option");
  const maps = M.list_maps(sol);
  assert.ok(maps.length > 10, "sol maps " + maps.length);
  const ids = maps.slice(0, 3).map((m) => m.id);
  const stars = M.get_max_max_stars(sol, mo, ids);
  M.set_progress_all(sol, ids, stars);
  const star0 = save.event_stages.chapters[0].chapters[ids[0]].chapters[0];
  assert.equal(star0.clear_progress, star0.stages.length);
  assert.ok(star0.stages.every((s) => s.clear_amount >= 1));
  const names = sol.map_names();
  const sn = M.get_progress_stage_names(names, ids[1]);
  M.set_progress_to_stage(sol, ids[1], Math.min(2, sn.length - 1), 1);
  M.set_progress_whole(sol, ids[2], 0);
  assert.ok(save.event_stages.chapters[0].chapters[ids[2]].chapters[0].stages.every((s) => s.clear_amount === 0));
  M.set_clear_counts(sol, [{ map: ids[0], star: 0, amount: 9 }, { map: ids[0], star: 0, amount: 4, stages: [0] }]);
  assert.equal(star0.stages[0].clear_amount, 4);
  assert.equal(star0.stages[1].clear_amount, 9);
  const ev = M.get_map_target(save, "event");
  const evmaps = M.list_maps(ev);
  assert.ok(evmaps.length > 0);
  M.set_progress_all(ev, evmaps.slice(0, 2).map((m) => m.id), 1);
  const col = M.get_map_target(save, "collab");
  M.set_progress_all(col, M.list_maps(col).slice(0, 2).map((m) => m.id), 1);
  const ms = M.list_map_stars(sol, mo);
  assert.ok(ms.length >= maps.length);
});

for (const key of ["gauntlets", "collab_gauntlets", "behemoth_culling", "enigma_clears", "uncanny", "catamin_stages",
  "legend_quest", "towers", "zero_legends", "dojo_catclaw_championships"] as const) {
  t(`chapter target ${key}`, () => {
    const tg = M.get_map_target(save, key);
    const mo = M.load_map_option(save);
    const maps = M.list_maps(tg);
    console.log("   maps:", maps.length, "total:", tg.total_maps());
    if (maps.length === 0) return;
    const ids = maps.slice(0, 2).map((m) => m.id);
    const stars = Math.max(1, M.get_max_max_stars(tg, mo, ids));
    M.set_progress_all(tg, ids, stars);
    M.set_clear_counts(tg, [{ map: ids[0], star: 0, amount: 3 }]);
    M.set_progress_whole(tg, ids[0], 0);
    M.set_progress_all(tg, ids, 1);
  });
}

t("catamin clear amounts", () => {
  const maps = M.list_catamin_maps(save);
  assert.ok(maps.length > 0);
  M.set_catamin_clear_amounts(save, new Map([[maps[0].id, 2]]));
  assert.equal(M.get_catamin_clear_amount(save, maps[0].id), 2);
});

t("outbreaks", () => {
  const chs = M.list_outbreak_chapters(save);
  console.log("   outbreak chapters", chs.length);
  assert.ok(chs.length > 0);
  const c = chs[0];
  M.edit_outbreaks(save, new Map([[c.true_id, c.stage_ids]]), true);
  const real = save.outbreaks.get_chapter_from_true_id(c.true_id)!;
  assert.ok([...real.outbreaks.values()].every((o) => o.cleared));
  M.edit_outbreaks(save, new Map([[c.true_id, c.stage_ids]]), false);
  assert.ok([...real.outbreaks.values()].every((o) => !o.cleared));
});

t("aku chapters + unlock", () => {
  const n = M.aku_stage_count(save);
  assert.ok(n > 0);
  M.edit_aku_chapters(save, 3, [1, 2, 3]);
  const c = M.aku_clear_counts(save);
  assert.deepEqual(c.slice(0, 4), [1, 2, 3, 0]);
  assert.ok(M.aku_stage_names(save).length > 0);
  M.edit_aku_chapters(save, 2, 5);
  assert.deepEqual(M.aku_clear_counts(save).slice(0, 3), [5, 5, 0]);
  unlock_aku_realm(save);
  const st = save.event_stages.chapters[1].chapters[255].chapters[0];
  assert.ok(st.stages.every((s) => s.clear_amount >= 1));
});

t("challenge / dojo / filibuster / enigma", () => {
  M.edit_challenge_score(save, 12345);
  assert.equal(save.challenge.scores[0], 12345);
  M.edit_dojo_score(save, 777);
  assert.equal(save.dojo.chapters.get_stage(0, 0).score, 777);
  M.allow_filibuster_stage_reclearing(save);
  assert.equal(save.filibuster_stage_enabled, true);
  assert.ok(save.filibuster_stage_id >= 0 && save.filibuster_stage_id < 48);
  const names = M.list_enigma_names(save);
  console.log("   enigma names", names.length);
  assert.ok(names.length > 1);
  M.add_enigma_stages(save, [names[0].id, names[1].id], true);
  assert.equal(save.enigma.stages.length, 2);
  assert.equal(M.current_enigma_stages(save).length, 2);
  M.add_enigma_stages(save, [names[2]?.id ?? names[0].id], false);
  assert.equal(save.enigma.stages.length, 3);
  M.add_enigma_stages(save, [], true);
  assert.equal(save.enigma.stages.length, 0);
  M.add_enigma_stages(save, [names[0].id], false);
});

t("serialize round trip", () => {
  const before = save.to_bytes();
  reparse();
  const after = save.to_bytes();
  assert.equal(Buffer.compare(Buffer.from(before), Buffer.from(after)), 0, "re-serialise stable");
  assert.equal(save.challenge.scores[0], 12345);
  assert.equal(save.enigma.stages.length, 1);
  assert.equal(save.story.get_real_chapters()[0].progress, 48);
  assert.equal(M.aku_clear_counts(save)[0], 5);
});

console.log(`\nAll ${ok} checks passed`);
