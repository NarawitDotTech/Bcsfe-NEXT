import { strip_color_tags } from "@/lib/bcsfe/core/locale_handler";

/** Human readable message for an unknown error (strips locale colour tags, appends the cause). */
export function errorText(e: unknown): string {
  if (!(e instanceof Error)) return strip_color_tags(String(e));
  let msg = strip_color_tags(e.message).replace(/\s+/g, " ").trim();
  const cause = (e as Error & { cause?: unknown }).cause;
  if (cause instanceof Error && cause.message && !msg.includes(cause.message)) {
    msg += ` (${strip_color_tags(cause.message)})`;
  }
  return msg || e.name;
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

/** Triggers a browser download of `data`. */
export function downloadBytes(data: BlobPart, fileName: string, mime = "application/octet-stream"): void {
  const url = URL.createObjectURL(new Blob([data], { type: mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Frames (30 fps) -> "12h 34m 56s". */
export function formatPlayTime(frames: number): string {
  const total = Math.floor(frames / 30);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${h.toLocaleString()}h ${m}m ${s}s`;
}

/** Status keys emitted by ServerHandler (locale keys) -> readable text. */
export function statusText(key: string): string {
  const MAP: Record<string, string> = {
    getting_password: "Getting password...",
    refreshing_password: "Refreshing password...",
    getting_auth_token: "Getting auth token...",
    retry_auth_token: "Retrying auth token...",
    getting_save_key: "Getting save key...",
    uploading_save_file: "Uploading save file...",
    getting_codes: "Getting transfer codes...",
    no_internet: "No response from the server.",
  };
  return MAP[key] ?? key.replace(/_/g, " ");
}
