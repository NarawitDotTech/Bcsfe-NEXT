import type { SaveFile } from "@/lib/bcsfe/core/io/save";
import { floordiv, pymod } from "@/lib/bcsfe/core/utils";

export class PlayTime {
  frames: number;

  constructor(frames: number) {
    this.frames = frames;
  }

  static get_fps(): number {
    return 30;
  }

  get seconds(): number {
    return floordiv(this.frames, PlayTime.get_fps());
  }
  get minutes(): number {
    return floordiv(this.seconds, 60);
  }
  get hours(): number {
    return floordiv(this.minutes, 60);
  }
  get just_seconds(): number {
    return pymod(this.seconds, 60);
  }
  get just_minutes(): number {
    return pymod(this.minutes, 60);
  }
  get just_hours(): number {
    return pymod(this.hours, 60);
  }

  static from_hours(hours: number): PlayTime {
    return new PlayTime(hours * 60 * 60 * PlayTime.get_fps());
  }
  static from_minutes(minutes: number): PlayTime {
    return new PlayTime(minutes * 60 * PlayTime.get_fps());
  }
  static from_seconds(seconds: number): PlayTime {
    return new PlayTime(seconds * PlayTime.get_fps());
  }
  static from_hours_mins_secs(hours: number, minutes: number, seconds: number): PlayTime {
    return PlayTime.from_hours(hours)
      .add(PlayTime.from_minutes(minutes))
      .add(PlayTime.from_seconds(seconds));
  }

  /** Python __add__ */
  add(other: PlayTime): PlayTime {
    return new PlayTime(this.frames + other.frames);
  }
}

/**
 * Pure version of the interactive Python `edit(save_file)`: sets the play time
 * from hours/minutes/seconds (the CLI prompts were dropped). Returns the new PlayTime.
 */
export function edit(save_file: SaveFile, hours: number, minutes: number, seconds: number): PlayTime {
  const play_time = PlayTime.from_hours_mins_secs(hours, minutes, seconds);
  save_file.officer_pass.play_time = play_time.frames;
  return play_time;
}
