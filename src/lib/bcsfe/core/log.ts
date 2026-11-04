/** Port of bcsfe/core/log.py: console + in-memory ring buffer. */

export type LogLevel = "DEBUG" | "INFO" | "WARNING" | "ERROR";

export interface LogEntry {
  level: LogLevel;
  time: string;
  message: string;
}

export class Logger {
  static readonly MAX_ENTRIES = 1000;
  entries: LogEntry[] = [];
  enabled = true;
  echo_to_console = true;

  is_log_enabled(): boolean {
    return this.enabled;
  }

  get_time(): string {
    const d = new Date();
    const p = (n: number) => String(n).padStart(2, "0");
    return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
  }

  private push(level: LogLevel, message: string): void {
    if (!this.enabled) return;
    this.entries.push({ level, time: this.get_time(), message });
    if (this.entries.length > Logger.MAX_ENTRIES) {
      this.entries.splice(0, this.entries.length - Logger.MAX_ENTRIES);
    }
    if (this.echo_to_console) {
      const line = `[${level}]::${this.get_time()} - ${message}`;
      if (level === "ERROR") console.error(line);
      else if (level === "WARNING") console.warn(line);
      else if (level === "DEBUG") console.debug(line);
      else console.info(line);
    }
  }

  log_debug(message: string): void {
    this.push("DEBUG", message);
  }
  log_info(message: string): void {
    this.push("INFO", message);
  }
  log_warning(message: string): void {
    this.push("WARNING", message);
  }
  log_error(message: string): void {
    this.push("ERROR", message);
  }

  log_exception(exception: unknown, extra_msg = ""): void {
    const err = exception instanceof Error ? exception : new Error(String(exception));
    this.log_error(`${extra_msg}: ${err.name}: ${err.message}\n${err.stack ?? ""}`);
  }

  log_no_file_found(file_name: string): void {
    this.log_warning(`Could not find ${file_name}`);
  }

  static get_traceback(): string {
    return new Error().stack ?? "";
  }

  /** Whole log as text (for a "download log" button). */
  get_text(): string {
    return this.entries.map((e) => `[${e.level}]::${e.time} - ${e.message}`).join("\n");
  }

  clear(): void {
    this.entries = [];
  }
}
