/** Port of bcsfe/core/game/map/story.py */
import type { Data } from "@/lib/bcsfe/core/io/data";
import type { SaveFile } from "@/lib/bcsfe/core/io/save";
import { core_data } from "@/lib/bcsfe/core/core_data";
import { CSV, Delimeter } from "@/lib/bcsfe/core/io/bc_csv";
import { filled, range, times } from "@/lib/bcsfe/core/utils";

export interface StorySerializedStage {
  clear_times: number;
  treasure: number;
  itf_timed_score: number;
}

export class Stage {
  clear_times: number;
  treasure: number;
  itf_timed_score: number;

  constructor(clear_times: number) {
    this.clear_times = clear_times;
    this.treasure = 0;
    this.itf_timed_score = 0;
  }

  static init(): Stage {
    return new Stage(0);
  }

  static read_clear_times(stream: Data): Stage {
    return new Stage(stream.read_int());
  }

  read_treasure(stream: Data): void {
    this.treasure = stream.read_int();
  }

  read_itf_timed_score(stream: Data): void {
    this.itf_timed_score = stream.read_int();
  }

  write_clear_times(stream: Data): void {
    stream.write_int(this.clear_times);
  }

  write_treasure(stream: Data): void {
    stream.write_int(this.treasure);
  }

  write_itf_timed_score(stream: Data): void {
    stream.write_int(this.itf_timed_score);
  }

  serialize(): StorySerializedStage {
    return {
      clear_times: this.clear_times,
      treasure: this.treasure,
      itf_timed_score: this.itf_timed_score,
    };
  }

  static deserialize(data: Partial<StorySerializedStage>): Stage {
    const stage = new Stage(data.clear_times ?? 0);
    stage.treasure = data.treasure ?? 0;
    stage.itf_timed_score = data.itf_timed_score ?? 0;
    return stage;
  }

  clear_stage(clear_amount = 1): void {
    this.clear_times = clear_amount;
  }

  unclear_stage(): void {
    this.clear_times = 0;
  }

  is_cleared(): boolean {
    return this.clear_times > 0;
  }

  set_treasure(treasure: number): void {
    this.treasure = treasure;
  }
}

export interface StorySerializedChapter {
  selected_stage: number;
  progress: number;
  stages: StorySerializedStage[];
  time_until_treasure_chance: number;
  treasure_chance_duration: number;
  treasure_chance_value: number;
  treasure_chance_stage_id: number;
  treasure_festival_type: number;
}

export class Chapter {
  selected_stage: number;
  progress: number;
  stages: Stage[];
  time_until_treasure_chance: number;
  treasure_chance_duration: number;
  treasure_chance_value: number;
  treasure_chance_stage_id: number;
  treasure_festival_type: number;

  constructor(selected_stage: number) {
    this.selected_stage = selected_stage;
    this.progress = 0;
    this.stages = times(51, () => Stage.init());
    this.time_until_treasure_chance = 0;
    this.treasure_chance_duration = 0;
    this.treasure_chance_value = 0;
    this.treasure_chance_stage_id = 0;
    this.treasure_festival_type = 0;
  }

  clear_stage(index: number, clear_amount = 1, overwrite_clear_progress = false): void {
    if (overwrite_clear_progress) {
      this.progress = index + 1;
    } else {
      this.progress = Math.max(this.progress, index + 1);
    }
    this.stages[index].clear_stage(clear_amount);
  }

  set_treasure(stage_id: number, treasure: number): void {
    this.stages[stage_id].set_treasure(treasure);
  }

  is_stage_clear(stage_id: number): boolean {
    return this.stages[stage_id].is_cleared();
  }

  static init(): Chapter {
    return new Chapter(0);
  }

  get_treasure_stages(): Stage[] {
    return this.stages.slice(0, 49);
  }

  get_valid_treasure_stages(): Stage[] {
    return this.stages.slice(0, 48);
  }

  static read_selected_stage(stream: Data): Chapter {
    return new Chapter(stream.read_int());
  }

  read_progress(stream: Data): void {
    this.progress = stream.read_int();
  }

  read_clear_times(stream: Data): void {
    const total_stages = 51;
    this.stages = times(total_stages, () => Stage.read_clear_times(stream));
  }

  read_treasure(stream: Data): void {
    for (const stage of this.get_treasure_stages()) stage.read_treasure(stream);
  }

  read_time_until_treasure_chance(stream: Data): void {
    this.time_until_treasure_chance = stream.read_int();
  }

  read_treasure_chance_duration(stream: Data): void {
    this.treasure_chance_duration = stream.read_int();
  }

  read_treasure_chance_value(stream: Data): void {
    this.treasure_chance_value = stream.read_int();
  }

  read_treasure_chance_stage_id(stream: Data): void {
    this.treasure_chance_stage_id = stream.read_int();
  }

  read_treasure_festival_type(stream: Data): void {
    this.treasure_festival_type = stream.read_int();
  }

  read_itf_timed_scores(stream: Data): void {
    for (const stage of this.stages) stage.read_itf_timed_score(stream);
  }

  write_selected_stage(stream: Data): void {
    stream.write_int(this.selected_stage);
  }

  write_progress(stream: Data): void {
    stream.write_int(this.progress);
  }

  write_clear_times(stream: Data): void {
    for (const stage of this.stages) stage.write_clear_times(stream);
  }

  write_treasure(stream: Data): void {
    for (const stage of this.get_treasure_stages()) stage.write_treasure(stream);
  }

  write_time_until_treasure_chance(stream: Data): void {
    stream.write_int(this.time_until_treasure_chance);
  }

  write_treasure_chance_duration(stream: Data): void {
    stream.write_int(this.treasure_chance_duration);
  }

  write_treasure_chance_value(stream: Data): void {
    stream.write_int(this.treasure_chance_value);
  }

  write_treasure_chance_stage_id(stream: Data): void {
    stream.write_int(this.treasure_chance_stage_id);
  }

  write_treasure_festival_type(stream: Data): void {
    stream.write_int(this.treasure_festival_type);
  }

  write_itf_timed_scores(stream: Data): void {
    for (const stage of this.stages) stage.write_itf_timed_score(stream);
  }

  serialize(): StorySerializedChapter {
    return {
      selected_stage: this.selected_stage,
      progress: this.progress,
      stages: this.stages.map((s) => s.serialize()),
      time_until_treasure_chance: this.time_until_treasure_chance,
      treasure_chance_duration: this.treasure_chance_duration,
      treasure_chance_value: this.treasure_chance_value,
      treasure_chance_stage_id: this.treasure_chance_stage_id,
      treasure_festival_type: this.treasure_festival_type,
    };
  }

  static deserialize(data: Partial<StorySerializedChapter>): Chapter {
    const chapter = new Chapter(data.selected_stage ?? 0);
    chapter.progress = data.progress ?? 0;
    chapter.stages = (data.stages ?? []).map((s) => Stage.deserialize(s));
    chapter.time_until_treasure_chance = data.time_until_treasure_chance ?? 0;
    chapter.treasure_chance_duration = data.treasure_chance_duration ?? 0;
    chapter.treasure_chance_value = data.treasure_chance_value ?? 0;
    chapter.treasure_chance_stage_id = data.treasure_chance_stage_id ?? 0;
    chapter.treasure_festival_type = data.treasure_festival_type ?? 0;
    return chapter;
  }

  apply_progress(progress: number, clear_times: number[] | null = null): void {
    if (clear_times === null) {
      clear_times = filled(1, progress);
    }

    this.progress = progress;
    for (let i = progress + 1; i < 48; i++) {
      this.stages[i].unclear_stage();
    }

    for (let i = 0; i < progress; i++) {
      this.stages[i].clear_stage(clear_times[i]);
    }
  }

  clear_chapter(): void {
    this.apply_progress(48);
  }
}

/** Python random.randrange(start, stop) */
function randrange(start: number, stop: number): number {
  return start + Math.floor(Math.random() * (stop - start));
}

export class StoryChapters {
  chapters: Chapter[];
  constructor(chapters: Chapter[]) {
    this.chapters = chapters;
  }

  get_real_chapters(): Chapter[] {
    const new_chapters: Chapter[] = [];
    this.chapters.forEach((chapter, i) => {
      if (i === 3) return;
      new_chapters.push(chapter);
    });
    return new_chapters;
  }

  clear_stage(
    map: number,
    stage: number,
    clear_amount = 1,
    overwrite_clear_progress = false,
    chapters: Chapter[] | null = null,
  ): void {
    if (chapters === null) {
      chapters = this.chapters;
    }
    chapters[map].clear_stage(stage, clear_amount, overwrite_clear_progress);
  }

  set_treasure(chapter: number, stage: number, treasure: number): void {
    this.chapters[chapter].set_treasure(stage, treasure);
  }

  is_stage_clear(chapter: number, stage: number): boolean {
    return this.chapters[chapter].is_stage_clear(stage);
  }

  static init(): StoryChapters {
    const chapters = times(10, () => Chapter.init());
    return new StoryChapters(chapters);
  }

  static read(stream: Data): StoryChapters {
    const total_chapters = 10;
    const chapters_l = times(total_chapters, () => Chapter.read_selected_stage(stream));
    const chapters = new StoryChapters(chapters_l);
    for (const chapter of chapters.chapters) chapter.read_progress(stream);
    for (const chapter of chapters.chapters) chapter.read_clear_times(stream);
    for (const chapter of chapters.chapters) chapter.read_treasure(stream);
    return chapters;
  }

  read_treasure_festival(stream: Data): void {
    for (const chapter of this.chapters) chapter.read_time_until_treasure_chance(stream);
    for (const chapter of this.chapters) chapter.read_treasure_chance_duration(stream);
    for (const chapter of this.chapters) chapter.read_treasure_chance_value(stream);
    for (const chapter of this.chapters) chapter.read_treasure_chance_stage_id(stream);
    for (const chapter of this.chapters) chapter.read_treasure_festival_type(stream);
  }

  write(stream: Data): void {
    for (const chapter of this.chapters) chapter.write_selected_stage(stream);
    for (const chapter of this.chapters) chapter.write_progress(stream);
    for (const chapter of this.chapters) chapter.write_clear_times(stream);
    for (const chapter of this.chapters) chapter.write_treasure(stream);
  }

  write_treasure_festival(stream: Data): void {
    for (const chapter of this.chapters) chapter.write_time_until_treasure_chance(stream);
    for (const chapter of this.chapters) chapter.write_treasure_chance_duration(stream);
    for (const chapter of this.chapters) chapter.write_treasure_chance_value(stream);
    for (const chapter of this.chapters) chapter.write_treasure_chance_stage_id(stream);
    for (const chapter of this.chapters) chapter.write_treasure_festival_type(stream);
  }

  read_itf_timed_scores(stream: Data): void {
    // 0: eoc 1, 1: eoc 2, 2: eoc 3, 3: _, 4: itf 1, 5: itf 2, 6: itf 3,
    // 7: cotc 1, 8: cotc 2, 9: cotc 3
    this.chapters.forEach((chapter, i) => {
      if (i > 3 && i < 7) chapter.read_itf_timed_scores(stream);
    });
  }

  write_itf_timed_scores(stream: Data): void {
    this.chapters.forEach((chapter, i) => {
      if (i > 3 && i < 7) chapter.write_itf_timed_scores(stream);
    });
  }

  serialize(): StorySerializedChapter[] {
    return this.chapters.map((c) => c.serialize());
  }

  static deserialize(data: Partial<StorySerializedChapter>[]): StoryChapters {
    return new StoryChapters(data.map((c) => Chapter.deserialize(c)));
  }

  static clear_tutorial(save_file: SaveFile): void {
    save_file.tutorial_state = Math.max(save_file.tutorial_state, 1);
    save_file.koreaSuperiorTreasureState = Math.max(save_file.koreaSuperiorTreasureState, 2);
    save_file.ui6 = Math.max(save_file.ui6, 1);
    const new_length = save_file.new_dialogs_2.length;
    if (new_length < 6) {
      save_file.new_dialogs_2.push(...filled(0, 6 - new_length));
    }

    save_file.new_dialogs_2[1] = Math.max(save_file.new_dialogs_2[1], 2);
    save_file.new_dialogs_2[5] = Math.max(save_file.new_dialogs_2[5], 2);
    if (save_file.story.chapters[0].stages[0].clear_times === 0) {
      save_file.story.clear_stage(0, 0);
    }
  }

  static get_chapter_names(
    save_file: SaveFile,
    chapter_ids: number[] | null = null,
  ): string[] | null {
    if (chapter_ids === null) {
      chapter_ids = [0, 1, 2, 3, 4, 5, 6, 7, 8];
    }

    const chapter_names: string[] = [];
    const localizable = core_data.get_localizable(save_file);
    const eoc_name = localizable.get("everyplay_mapname_J");
    const itf_name = localizable.get("everyplay_mapname_W");
    const cotc_name = localizable.get("everyplay_mapname_P");
    if (
      eoc_name === null || eoc_name === undefined ||
      itf_name === null || itf_name === undefined ||
      cotc_name === null || cotc_name === undefined
    ) {
      return null;
    }

    for (const chapter_id of chapter_ids) {
      if (chapter_id < 3) {
        chapter_names.push(eoc_name.replaceAll("%d", String(chapter_id + 1)));
      } else if (chapter_id < 6) {
        chapter_names.push(itf_name.replaceAll("%d", String(chapter_id - 2)));
      } else {
        chapter_names.push(cotc_name.replaceAll("%d", String(chapter_id - 5)));
      }
    }

    return chapter_names;
  }

  /**
   * Pure version of Python edit_chapter_progress (interactive).
   * `progress` and `clear_amounts` are supplied by the caller
   * (clear_amounts defaults to 1 per cleared stage).
   */
  static edit_chapter_progress(
    save_file: SaveFile,
    chapter_id: number,
    progress: number,
    clear_amounts: number[] | null = null,
  ): boolean {
    const chapter = save_file.story.get_real_chapters()[chapter_id];
    const amounts = clear_amounts ?? filled(1, progress);
    chapter.apply_progress(progress, amounts);
    return progress !== 0;
  }

  static convert_stage_id(index: number): number {
    if (index === 46) return 46;
    if (index === 47) return 47;
    index = 45 - index;
    return index;
  }

  /** Pure version of Python edit_stage_clear_count (clear_count is a parameter). */
  static edit_stage_clear_count(
    save_file: SaveFile,
    chapter_id: number,
    stage_id: number,
    clear_count: number,
  ): void {
    const chapter = save_file.story.get_real_chapters()[chapter_id];
    const stage = chapter.stages[stage_id];
    stage.clear_times = clear_count;
  }

  clear_previous_chapters(chapter_id: number): void {
    const chapters = this.get_real_chapters();
    // 0: eoc 1
    // 1: eoc 2 - requires eoc 1
    // 2: eoc 3 - requires eoc 1 + eoc 2
    // 3: itf 1 - requires eoc 1
    // 4: itf 2 - requires eoc 1 + itf 1
    // 5: itf 3 - requires eoc 1 + itf 1 + itf 2
    // 6: cotc 1 - requires eoc 1 + itf 1
    // 7: cotc 2 - requires eoc 1 + itf 1 + cotc 1
    // 8: cotc 3 - requires eoc 1 + itf 1 + cotc 1 + cotc 2
    let required: number[] = [];
    if (chapter_id === 1) required = [0];
    else if (chapter_id === 2) required = [0, 1];
    else if (chapter_id === 3) required = [0];
    else if (chapter_id === 4) required = [0, 3];
    else if (chapter_id === 5) required = [0, 3, 4];
    else if (chapter_id === 6) required = [0, 3];
    else if (chapter_id === 7) required = [0, 3, 6];
    else if (chapter_id === 8) required = [0, 3, 6, 7];
    for (const i of required) chapters[i].clear_chapter();
  }

  /**
   * Pure version of Python edit_chapters (interactive).
   * @param chapter_ids real chapter ids (0..8)
   * @param stages_for stages (0..47, display order) to clear for a chapter id
   * @param clear_amount_for clear amount for a (chapter id, stage)
   * @param unclear_other_stages if true, progress is reset and stages from max(stages) are unset first
   */
  edit_chapters(
    chapter_ids: number[],
    stages_for: (chapter_id: number) => number[],
    clear_amount_for: (chapter_id: number, stage: number) => number = () => 1,
    unclear_other_stages = false,
  ): void {
    const chapters = this.get_real_chapters();
    for (const id of chapter_ids) {
      const stages = stages_for(id);
      if (stages.length === 0) continue;
      if (unclear_other_stages) {
        chapters[id].progress = 0;
        for (let stage = Math.max(...stages); stage < 48; stage++) {
          chapters[id].stages[stage].clear_times = 0;
        }
      }
      for (const stage of stages) {
        this.clear_stage(id, stage, clear_amount_for(id, stage), true, chapters);
      }
    }
  }

  static clear_story(save_file: SaveFile, chapter_ids: number[] = range(9)): void {
    save_file.story.edit_chapters(chapter_ids, () => range(48));
  }

  static get_chapter_type_from_index(index: number): number {
    if (index < 3) return 0;
    if (index < 6) return 1;
    return 2;
  }

  /** Pure: set the same treasure level for every valid stage of the given real chapters. */
  static edit_treasures_whole_chapters(
    save_file: SaveFile,
    chapters: number[],
    treasure_level: number,
  ): void {
    for (const chapter_id of chapters) {
      const chapter = save_file.story.get_real_chapters()[chapter_id];
      for (const stage of chapter.get_valid_treasure_stages()) {
        stage.set_treasure(treasure_level);
      }
    }
  }

  /** Pure: set treasure level for display-order stage ids (converted via convert_stage_id). */
  static edit_treasures_individual_stages(
    save_file: SaveFile,
    chapters: number[],
    stage_ids: number[],
    treasure_level: number,
  ): void {
    for (const chapter_id of chapters) {
      const chapter = save_file.story.get_real_chapters()[chapter_id];
      for (const stage_id of stage_ids) {
        const real_stage_id = StoryChapters.convert_stage_id(stage_id);
        chapter.set_treasure(real_stage_id, treasure_level);
      }
    }
  }

  /** Pure: per treasure group levels (Map<group id, level>). */
  static edit_treasure_group_ind(
    treasure_group_data: number[][],
    chapter: Chapter,
    group_levels: Map<number, number>,
  ): void {
    for (const [treasure_group_id, treasure_level] of group_levels) {
      const treasure_group = treasure_group_data[treasure_group_id];
      for (const stage_id of treasure_group) chapter.set_treasure(stage_id, treasure_level);
    }
  }

  /** Pure: same treasure level for all selected treasure groups. */
  static edit_treasure_group_many(
    treasure_group_data: number[][],
    chapter: Chapter,
    selected_treasure_groups: number[],
    treasure_level: number,
  ): void {
    for (const treasure_group_id of selected_treasure_groups) {
      const treasure_group = treasure_group_data[treasure_group_id];
      for (const stage_id of treasure_group) chapter.set_treasure(stage_id, treasure_level);
    }
  }

  /**
   * Pure version of Python itf_timed_score_input: parses "a-b" (or "a") into [min, max + 1]
   * for use with random range. Returns null if the input is invalid
   * (Python would re-prompt).
   */
  static itf_timed_score_input(inp: string): [number, number] | null {
    const idx = inp.indexOf("-");
    const parts = idx === -1 ? [inp] : [inp.slice(0, idx), inp.slice(idx + 1)];
    const parts_i: number[] = [];
    for (const part of parts) {
      if (!/^\d+$/.test(part)) return null;
      let score = parseInt(part, 10);
      const mx = Math.min(core_data.max_value_manager.itf_timed_score, 2147483647);
      score = Math.min(Math.max(score, 0), mx);
      parts_i.push(score);
    }
    return [Math.min(...parts_i), Math.max(...parts_i) + 1];
  }

  /**
   * Pure: assign random itf timed scores in [score[0], score[1]) to stages.
   * `stage_ids` null means all valid treasure stages (whole chapter).
   */
  static edit_itf_timed_scores(
    save_file: SaveFile,
    chapters: number[],
    score: [number, number],
    stage_ids: number[] | null = null,
  ): void {
    for (const chapter_id of chapters) {
      const chapter = save_file.story.get_real_chapters()[chapter_id];
      if (stage_ids === null) {
        for (const stage of chapter.get_valid_treasure_stages()) {
          stage.itf_timed_score = randrange(score[0], score[1]);
        }
      } else {
        for (const stage_id of stage_ids) {
          chapter.stages[stage_id].itf_timed_score = randrange(score[0], score[1]);
        }
      }
    }
  }
}

export class StageNames {
  save_file: SaveFile;
  chapter: string;
  max_stages: number;
  stage_names: string[] | null;

  constructor(save_file: SaveFile, chapter: string, max_stages = 48) {
    this.save_file = save_file;
    this.chapter = chapter;
    this.max_stages = max_stages;
    this.stage_names = this.get_stage_names();
  }

  get_file_name(): string {
    if (/^\d+$/.test(this.chapter)) {
      return `StageName${this.chapter}_${core_data.get_lang(this.save_file)}.csv`;
    }
    return `StageName_${this.chapter}_${core_data.get_lang(this.save_file)}.csv`;
  }

  get_stage_names(): string[] | null {
    const file_name = this.get_file_name();
    const gdg = core_data.get_game_data_getter(this.save_file);
    const file = gdg.download("resLocal", file_name);
    if (file === null || file === undefined) return null;
    const csv = new CSV(file, Delimeter.from_country_code_res(this.save_file.cc));
    const stage_names: string[] = [];
    if (/^\d+$/.test(this.chapter)) {
      for (const row of csv) stage_names.push(row.get(0).to_str());
    } else {
      for (const row of csv) {
        for (let i = 0; i < row.length; i++) stage_names.push(row.get(i).to_str());
      }
    }
    return stage_names.slice(0, this.max_stages);
  }

  get_stage_name(stage_id: number): string | null {
    if (this.stage_names === null) return null;
    return this.stage_names[stage_id];
  }
}

export class TreasureText {
  save_file: SaveFile;
  treasure_text: string[] | null;

  constructor(save_file: SaveFile) {
    this.save_file = save_file;
    this.treasure_text = this.get_treasure_text();
  }

  get_tt_file_name(): string {
    return `Treasure2_${core_data.get_lang(this.save_file)}.csv`;
  }

  get_treasure_text(): string[] | null {
    const file_name = this.get_tt_file_name();
    const gdg = core_data.get_game_data_getter(this.save_file);
    const file = gdg.download("resLocal", file_name);
    if (file === null || file === undefined) return null;
    const csv = new CSV(file, Delimeter.from_country_code_res(this.save_file.cc));
    const treasure_text: string[] = [];
    for (const row of csv) treasure_text.push(row.get(0).to_str());
    return treasure_text;
  }
}

export class TreasureGroupData {
  save_file: SaveFile;
  chapter_type: number;
  treasure_group_data: number[][] | null;

  constructor(save_file: SaveFile, chapter_type: number) {
    this.save_file = save_file;
    this.chapter_type = chapter_type;
    this.treasure_group_data = this.get_treasure_group_data();
  }

  get_tgd_file_name(): string {
    if (this.chapter_type === 0) return "treasureData0.csv";
    if (this.chapter_type === 1) return "treasureData1.csv";
    if (this.chapter_type === 2) return "treasureData2_0.csv";
    return "";
  }

  get_treasure_group_data(): number[][] | null {
    const gdg = core_data.get_game_data_getter(this.save_file);
    const file = gdg.download("DataLocal", this.get_tgd_file_name());
    if (file === null || file === undefined) return null;
    const csv = new CSV(file);
    const treasure_group_data: number[][] = [];
    for (const row of csv.lines.slice(11, 22)) {
      const values: number[] = [];
      for (let i = 0; i < row.length; i++) {
        const v = row.get(i).to_int();
        if (v !== -1) values.push(v);
      }
      treasure_group_data.push(values);
    }
    return treasure_group_data;
  }
}

export class TreasureGroupNames {
  save_file: SaveFile;
  chapter_type: number;
  treasure_group_names: string[] | null;

  constructor(save_file: SaveFile, chapter_type: number) {
    this.save_file = save_file;
    this.chapter_type = chapter_type;
    this.treasure_group_names = this.get_treasure_group_names();
  }

  get_tgn_file_name(): string {
    const lang = core_data.get_lang(this.save_file);
    if (this.chapter_type === 0) return `Treasure3_0_${lang}.csv`;
    if (this.chapter_type === 1) return `Treasure3_1_${lang}.csv`;
    if (this.chapter_type === 2) return `Treasure3_2_0_${lang}.csv`;
    return "";
  }

  get_treasure_group_names(): string[] | null {
    const gdg = core_data.get_game_data_getter(this.save_file);
    const file = gdg.download("resLocal", this.get_tgn_file_name());
    if (file === null || file === undefined) return null;
    const csv = new CSV(file, Delimeter.from_country_code_res(this.save_file.cc));
    const treasure_group_names: string[] = [];
    for (const row of csv) treasure_group_names.push(row.get(0).to_str());
    return treasure_group_names;
  }
}
