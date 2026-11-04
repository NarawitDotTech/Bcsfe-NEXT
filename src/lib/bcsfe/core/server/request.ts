/** Port of bcsfe/core/server/request.py (async, goes through the CORS proxy) */
import { Data, concatBytes } from "@/lib/bcsfe/core/io/data";
import { fetchViaProxy } from "@/lib/bcsfe/core/net";
import { core_data } from "@/lib/bcsfe/core/core_data";
import { ConfigKey } from "@/lib/bcsfe/core/io/config";

const textEncoder = new TextEncoder();

export class MultiPartFile {
  content: Uint8Array;
  content_type: string;
  filename: string | null;

  constructor(content: Uint8Array, content_type: string, filename: string | null = null) {
    this.content = content;
    this.content_type = content_type;
    this.filename = filename;
  }
}

function randomBoundary(): string {
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  let s = "";
  for (const x of b) s += x.toString(16).padStart(2, "0");
  return s;
}

/**
 * Python `json.dumps(obj, indent=None).replace(" ", "")` equivalent
 * (ensure_ascii=True, spaces removed everywhere - including inside strings).
 */
export function json_dumps_nospace(obj: unknown): string {
  const s = JSON.stringify(obj);
  let out = "";
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c > 0x7e) out += "\\u" + c.toString(16).padStart(4, "0");
    else if (c === 0x20) continue;
    else out += s[i];
  }
  return out;
}

export class MultipartForm {
  data: Map<string, MultiPartFile> = new Map();

  add_key(
    key: string,
    content: Uint8Array,
    content_type: string,
    filename: string | null = null,
  ): void {
    this.data.set(key, new MultiPartFile(content, content_type, filename));
  }

  /** Encode like urllib3.encode_multipart_formdata. Returns [body, content_type_header]. */
  encode(boundary: string = randomBoundary()): [Uint8Array, string] {
    const chunks: Uint8Array[] = [];
    for (const [name, file] of this.data) {
      let disp = `form-data; name="${name}"`;
      if (file.filename !== null) disp += `; filename="${file.filename}"`;
      let head = `--${boundary}\r\nContent-Disposition: ${disp}\r\n`;
      if (file.content_type) head += `Content-Type: ${file.content_type}\r\n`;
      head += "\r\n";
      chunks.push(textEncoder.encode(head));
      chunks.push(file.content);
      chunks.push(textEncoder.encode("\r\n"));
    }
    chunks.push(textEncoder.encode(`--${boundary}--\r\n`));
    return [concatBytes(chunks), `multipart/form-data; boundary=${boundary}`];
  }

  get_all_type(content_type: string): string {
    const dec = new TextDecoder("utf-8");
    let data = "";
    for (const [key, file] of this.data) {
      if (file.content_type === content_type) {
        data += `key: ${key}, data: ${dec.decode(file.content)}\n`;
      }
    }
    return data;
  }
}

export class RequestHandler {
  url: string;
  headers: Record<string, string> | null;
  data: Data;
  form: MultipartForm | null;

  constructor(
    url: string,
    headers: Record<string, string> | null = null,
    data: Data | null = null,
    form: MultipartForm | null = null,
  ) {
    this.url = url;
    this.headers = headers;
    this.data = data ?? new Data();
    this.form = form;
  }

  /** Timeout in seconds. */
  static timeout(): number {
    let tm = core_data.config.get_int(ConfigKey.MAX_REQUEST_TIMEOUT);
    if (tm <= 0) {
      tm = core_data.config.get_default(ConfigKey.MAX_REQUEST_TIMEOUT) as number;
    }
    return tm;
  }

  private async send(
    method: "GET" | "POST",
    no_timeout: boolean,
  ): Promise<Response | null> {
    const headers: Record<string, string> = { ...(this.headers ?? {}) };
    let body: Uint8Array | undefined;
    if (method === "POST") {
      if (this.form !== null) {
        const [b, ct] = this.form.encode();
        body = b;
        headers["content-type"] = ct;
      } else if (this.data.data.length > 0) {
        body = this.data.data;
      }
    }
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (!no_timeout) {
      const secs = RequestHandler.timeout();
      timer = setTimeout(() => controller.abort(), secs * 1000);
    }
    try {
      return await fetchViaProxy(this.url, {
        method,
        headers,
        body: body as unknown as BodyInit | undefined,
        signal: controller.signal,
      });
    } catch {
      return null;
    } finally {
      if (timer !== undefined) clearTimeout(timer);
    }
  }

  async get(_stream: boolean = false, no_timeout: boolean = false): Promise<Response | null> {
    return this.send("GET", no_timeout);
  }

  async post(no_timeout: boolean = false): Promise<Response | null> {
    return this.send("POST", no_timeout);
  }
}
