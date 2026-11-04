/** Port of bcsfe/core/game/map/challenge.py */
import type { Data } from "@/lib/bcsfe/core/io/data";
import type { SaveFile } from "@/lib/bcsfe/core/io/save";
import { Chapters, type ChapterSerialized } from "@/lib/bcsfe/core/game/map/chapters";
import { times } from "@/lib/bcsfe/core/utils";

export class ChallengeChapters {
  chapters: Chapters;
  scores: number[];
  shown_popup: boolean;

  constructor(chapters: Chapters) {
    this.chapters = chapters;
    this.scores = [];
    this.shown_popup = false;
  }

  static init(): ChallengeChapters {
    return new ChallengeChapters(Chapters.init());
  }

  static read(data: Data): ChallengeChapters {
    const ch = Chapters.read(data);
    return new ChallengeChapters(ch);
  }

  write(data: Data): void {
    this.chapters.write(data);
  }

  read_scores(data: Data): void {
    const total_scores = data.read_int();
    this.scores = times(total_scores, () => data.read_int());
  }

  write_scores(data: Data): void {
    data.write_int(this.scores.length);
    for (const score of this.scores) data.write_int(score);
  }

  read_popup(data: Data): void {
    this.shown_popup = data.read_bool();
  }

  write_popup(data: Data): void {
    data.write_bool(this.shown_popup);
  }

  serialize(): { chapters: ChapterSerialized[][]; scores: number[]; shown_popup: boolean } {
    return {
      chapters: this.chapters.serialize(),
      scores: this.scores,
      shown_popup: this.shown_popup,
    };
  }

  static deserialize(data: {
    chapters?: Partial<ChapterSerialized>[][];
    scores?: number[];
    shown_popup?: boolean;
  }): ChallengeChapters {
    const challenge = new ChallengeChapters(Chapters.deserialize(data.chapters ?? []));
    challenge.scores = data.scores ?? [];
    challenge.shown_popup = data.shown_popup ?? false;
    return challenge;
  }

  /** Python version prompts for the score; here the score is a parameter. */
  edit_score(score: number): void {
    if (this.scores.length === 0) {
      this.scores = [0];
    }
    this.scores[0] = score;
    this.shown_popup = true;
    this.chapters.clear_stage(0, 0, 0, 0);
  }
}

/** Python version is interactive; here the new score is a parameter. */
export function edit_challenge_score(save_file: SaveFile, score: number): void {
  save_file.challenge.edit_score(score);
}
