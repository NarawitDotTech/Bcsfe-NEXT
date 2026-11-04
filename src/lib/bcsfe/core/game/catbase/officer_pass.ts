import type { Data } from "@/lib/bcsfe/core/io/data";
import type { GameVersion } from "@/lib/bcsfe/core/game_version";
import type { SaveFile } from "@/lib/bcsfe/core/io/save";
import { NyankoClub } from "@/lib/bcsfe/core/game/catbase/nyanko_club";

export class OfficerPass {
  play_time: number;
  gold_pass: NyankoClub;
  cat_id: number;
  cat_form: number;

  constructor(play_time: number) {
    this.play_time = play_time;
    this.gold_pass = NyankoClub.init();
    this.cat_id = 0;
    this.cat_form = 0;
  }

  static init(): OfficerPass {
    return new OfficerPass(0);
  }

  static read(data: Data): OfficerPass {
    return new OfficerPass(data.read_int());
  }

  write(data: Data): void {
    if (this.play_time > 2 ** 31 - 1) this.play_time = 2 ** 31 - 1;
    data.write_int(this.play_time);
  }

  read_gold_pass(data: Data, gv: GameVersion): void {
    this.gold_pass = NyankoClub.read(data, gv);
  }

  write_gold_pass(data: Data, gv: GameVersion): void {
    this.gold_pass.write(data, gv);
  }

  read_cat_data(data: Data): void {
    this.cat_id = data.read_short();
    this.cat_form = data.read_short();
  }

  write_cat_data(data: Data): void {
    data.write_short(this.cat_id);
    data.write_short(this.cat_form);
  }

  serialize(): Record<string, unknown> {
    return {
      play_time: this.play_time,
      gold_pass: this.gold_pass.serialize(),
      cat_id: this.cat_id,
      cat_form: this.cat_form,
    };
  }

  static deserialize(data: Record<string, unknown>): OfficerPass {
    const officer_pass = new OfficerPass((data["play_time"] as number | undefined) ?? 0);
    officer_pass.gold_pass = NyankoClub.deserialize(
      (data["gold_pass"] as Record<string, unknown> | undefined) ?? {},
    );
    officer_pass.cat_id = (data["cat_id"] as number | undefined) ?? 0;
    officer_pass.cat_form = (data["cat_form"] as number | undefined) ?? 0;
    return officer_pass;
  }

  reset(save_file: SaveFile): void {
    this.cat_id = 0;
    this.cat_form = 0;
    this.play_time = 0;
    this.gold_pass.remove_gold_pass(save_file);
  }

  /** Python printed "officer_pass_fixed"; printing dropped. */
  static fix_crash(save_file: SaveFile): void {
    save_file.officer_pass.reset(save_file);
  }
}
