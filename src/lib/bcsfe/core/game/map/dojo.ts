import { Data } from "@/lib/bcsfe/core/io/data";
import type { GameVersion } from "@/lib/bcsfe/core/game_version";
import { filled, mapToObject, objectToMap } from "@/lib/bcsfe/core/utils";

export class Stage {
  score: number;
  constructor(score: number) {
    this.score = score;
  }

  static init(): Stage {
    return new Stage(0);
  }

  static read(stream: Data): Stage {
    return new Stage(stream.read_int());
  }

  write(stream: Data): void {
    stream.write_int(this.score);
  }

  serialize(): number {
    return this.score;
  }

  static deserialize(data: number): Stage {
    return new Stage(data);
  }
}

export class Chapter {
  stages: Map<number, Stage>;
  constructor(stages: Map<number, Stage>) {
    this.stages = stages;
  }

  get_stage(stage_id: number): Stage {
    let s = this.stages.get(stage_id);
    if (s === undefined) {
      s = Stage.init();
      this.stages.set(stage_id, s);
    }
    return s;
  }

  static init(): Chapter {
    return new Chapter(new Map());
  }

  static read(stream: Data): Chapter {
    const total = stream.read_int();
    const stages = new Map<number, Stage>();
    for (let i = 0; i < total; i++) {
      const stage_id = stream.read_int();
      stages.set(stage_id, Stage.read(stream));
    }
    return new Chapter(stages);
  }

  write(stream: Data): void {
    stream.write_int(this.stages.size);
    for (const [stage_id, stage] of this.stages) {
      stream.write_int(stage_id);
      stage.write(stream);
    }
  }

  serialize(): Record<string, number> {
    return mapToObject(this.stages, (s) => s.serialize());
  }

  static deserialize(data: Record<string, number>): Chapter {
    return new Chapter(objectToMap(data, (s) => Stage.deserialize(s)));
  }
}

export class Chapters {
  chapters: Map<number, Chapter>;
  constructor(chapters: Map<number, Chapter>) {
    this.chapters = chapters;
  }

  get_stage(chapter_id: number, stage_id: number): Stage {
    let c = this.chapters.get(chapter_id);
    if (c === undefined) {
      c = Chapter.init();
      this.chapters.set(chapter_id, c);
    }
    return c.get_stage(stage_id);
  }

  static init(): Chapters {
    return new Chapters(new Map());
  }

  static read(stream: Data): Chapters {
    const total = stream.read_int();
    const chapters = new Map<number, Chapter>();
    for (let i = 0; i < total; i++) {
      const chapter_id = stream.read_int();
      chapters.set(chapter_id, Chapter.read(stream));
    }
    return new Chapters(chapters);
  }

  write(stream: Data): void {
    stream.write_int(this.chapters.size);
    for (const [chapter_id, chapter] of this.chapters) {
      stream.write_int(chapter_id);
      chapter.write(stream);
    }
  }

  serialize(): Record<string, Record<string, number>> {
    return mapToObject(this.chapters, (c) => c.serialize());
  }

  static deserialize(data: Record<string, Record<string, number>>): Chapters {
    return new Chapters(objectToMap(data, (c) => Chapter.deserialize(c)));
  }
}

export class Ranking {
  score: number;
  ranking: number;
  has_submitted: boolean;
  has_completed: boolean;
  has_seen_results: boolean;
  start_date: number;
  end_date: number;
  event_number: number;
  should_show_rank_description: boolean;
  should_show_start_message: boolean;
  submit_error_flag: boolean;
  did_win_rewards = false;
  other: string | null;

  constructor(
    score: number,
    ranking: number,
    has_submitted: boolean,
    has_completed: boolean,
    has_seen_results: boolean,
    start_date: number,
    end_date: number,
    event_number: number,
    should_show_rank_description: boolean,
    should_show_start_message: boolean,
    submit_error_flag: boolean,
    other: string | null,
  ) {
    this.score = score;
    this.ranking = ranking;
    this.has_submitted = has_submitted;
    this.has_completed = has_completed;
    this.has_seen_results = has_seen_results;
    this.start_date = start_date;
    this.end_date = end_date;
    this.event_number = event_number;
    this.should_show_rank_description = should_show_rank_description;
    this.should_show_start_message = should_show_start_message;
    this.submit_error_flag = submit_error_flag;
    this.other = other;
  }

  static init(): Ranking {
    return new Ranking(0, 0, false, false, false, 0, 0, 0, false, false, false, null);
  }

  static read(stream: Data, game_version: GameVersion): Ranking {
    const score = stream.read_int();
    const ranking = stream.read_int();
    const has_submitted = stream.read_bool();
    const has_completed = stream.read_bool();
    const has_seen_results = stream.read_bool();
    const start_date = stream.read_int();
    const end_date = stream.read_int();
    const event_number = stream.read_int();
    const should_show_rank_description = stream.read_bool();
    const should_show_start_message = stream.read_bool();
    const submit_error_flag = stream.read_bool();
    let other: string | null = null;
    if (game_version.ge(140500)) {
      other = stream.read_string();
    }
    return new Ranking(
      score,
      ranking,
      has_submitted,
      has_completed,
      has_seen_results,
      start_date,
      end_date,
      event_number,
      should_show_rank_description,
      should_show_start_message,
      submit_error_flag,
      other,
    );
  }

  write(stream: Data, game_version: GameVersion): void {
    stream.write_int(this.score);
    stream.write_int(this.ranking);
    stream.write_bool(this.has_submitted);
    stream.write_bool(this.has_completed);
    stream.write_bool(this.has_seen_results);
    stream.write_int(this.start_date);
    stream.write_int(this.end_date);
    stream.write_int(this.event_number);
    stream.write_bool(this.should_show_rank_description);
    stream.write_bool(this.should_show_start_message);
    stream.write_bool(this.submit_error_flag);
    if (game_version.ge(140500)) {
      stream.write_string(this.other || "");
    }
  }

  read_did_win_rewards(stream: Data): void {
    this.did_win_rewards = stream.read_bool();
  }

  write_did_win_rewards(stream: Data): void {
    stream.write_bool(this.did_win_rewards);
  }

  serialize(): Record<string, unknown> {
    return {
      score: this.score,
      ranking: this.ranking,
      has_submitted: this.has_submitted,
      has_completed: this.has_completed,
      has_seen_results: this.has_seen_results,
      start_date: this.start_date,
      end_date: this.end_date,
      event_number: this.event_number,
      should_show_rank_description: this.should_show_rank_description,
      should_show_start_message: this.should_show_start_message,
      submit_error_flag: this.submit_error_flag,
      did_win_rewards: this.did_win_rewards,
      other: this.other,
    };
  }

  static deserialize(data: Record<string, unknown>): Ranking {
    const g = <T>(k: string, d: T): T => (data[k] === undefined ? d : (data[k] as T));
    const ranking = new Ranking(
      g("score", 0),
      g("ranking", 0),
      g("has_submitted", false),
      g("has_completed", false),
      g("has_seen_results", false),
      g("start_date", 0),
      g("end_date", 0),
      g("event_number", 0),
      g("should_show_rank_description", false),
      g("should_show_start_message", false),
      g("submit_error_flag", false),
      g<string | null>("other", null),
    );
    ranking.did_win_rewards = g("did_win_rewards", false);
    return ranking;
  }
}

export class Dojo {
  chapters: Chapters;
  item_lock_flags = false;
  item_locks: boolean[] = filled(false, 6);
  ranking: Ranking = Ranking.init();

  constructor(chapters: Chapters) {
    this.chapters = chapters;
  }

  static init(): Dojo {
    return new Dojo(Chapters.init());
  }

  static read_chapters(stream: Data): Dojo {
    return new Dojo(Chapters.read(stream));
  }

  write_chapters(stream: Data): void {
    this.chapters.write(stream);
  }

  read_item_locks(stream: Data): void {
    this.item_lock_flags = stream.read_bool();
    this.item_locks = stream.read_bool_list(6);
  }

  write_item_locks(stream: Data): void {
    stream.write_bool(this.item_lock_flags);
    stream.write_bool_list(this.item_locks, false, 6);
  }

  read_ranking(stream: Data, game_version: GameVersion): void {
    this.ranking = Ranking.read(stream, game_version);
  }

  write_ranking(stream: Data, game_version: GameVersion): void {
    this.ranking.write(stream, game_version);
  }

  serialize(): Record<string, unknown> {
    return {
      chapters: this.chapters.serialize(),
      item_locks: this.item_locks,
      item_lock_flags: this.item_lock_flags,
      ranking: this.ranking.serialize(),
    };
  }

  static deserialize(data: Record<string, unknown>): Dojo {
    const chapters = Chapters.deserialize(
      (data["chapters"] as Record<string, Record<string, number>> | undefined) ?? {},
    );
    const dojo = new Dojo(chapters);
    dojo.item_locks = (data["item_locks"] as boolean[] | undefined) ?? [];
    dojo.item_lock_flags = (data["item_lock_flags"] as boolean | undefined) ?? false;
    dojo.ranking = Ranking.deserialize(
      (data["ranking"] as Record<string, unknown> | undefined) ?? {},
    );
    return dojo;
  }

  /** Pure version of Python edit_score(): the interactive prompt is replaced by a parameter. */
  edit_score(score: number): void {
    this.chapters.get_stage(0, 0).score = score;
  }
}
