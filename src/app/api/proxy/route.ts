/**
 * CORS proxy for the Battle Cats save editor.
 * Forwards GET/POST requests to an allowlist of hosts. See src/lib/bcsfe/core/net.ts for the protocol.
 */
import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EXACT_HOSTS = new Set<string>([
  "raw.githubusercontent.com",
  "github.com",
  "objects.githubusercontent.com",
  "release-assets.githubusercontent.com",
  "codeload.github.com",
  "gitlab.com",
  "git.battlecatsmodding.org",
  "git.fyhenry.uk",
  "pypi.org",
  "nyanko-service-data-prd.s3.amazonaws.com",
  // hosts reached through redirects of the above
  "storage.googleapis.com",
]);

const SUFFIX_HOSTS = [".ponosgames.com", ".githubusercontent.com"];

function is_allowed(url: URL): boolean {
  if (url.protocol !== "https:") return false;
  const host = url.hostname.toLowerCase();
  if (EXACT_HOSTS.has(host)) return true;
  return SUFFIX_HOSTS.some((s) => host.endsWith(s)) || host === "ponosgames.com";
}

const FORWARD_PREFIX = "x-fwd-";
// Headers never copied back to the browser.
const SKIP_RESPONSE_HEADERS = new Set([
  "content-encoding",
  "content-length",
  "transfer-encoding",
  "connection",
  "keep-alive",
  "set-cookie",
  "content-security-policy",
  "x-frame-options",
]);
const SKIP_REQUEST_HEADERS = new Set(["host", "content-length", "connection", "accept-encoding"]);
const MAX_REDIRECTS = 5;

async function handle(req: NextRequest): Promise<Response> {
  const target = req.nextUrl.searchParams.get("url");
  if (!target) return new Response("missing url", { status: 400 });
  let url: URL;
  try {
    url = new URL(target);
  } catch {
    return new Response("invalid url", { status: 400 });
  }
  if (!is_allowed(url)) return new Response(`host not allowed: ${url.hostname}`, { status: 403 });

  const method = (req.headers.get("x-proxy-method") ?? req.method).toUpperCase();
  if (method !== "GET" && method !== "POST" && method !== "HEAD") {
    return new Response("method not allowed", { status: 405 });
  }

  const headers = new Headers();
  req.headers.forEach((value, name) => {
    if (!name.startsWith(FORWARD_PREFIX)) return;
    const real = name.slice(FORWARD_PREFIX.length);
    // The game API historically sends the misspelt "accept-enconding"; forward as is. Let fetch negotiate real encoding.
    if (SKIP_REQUEST_HEADERS.has(real)) return;
    headers.set(real, value);
  });

  let body: ArrayBuffer | undefined;
  if (method === "POST") body = await req.arrayBuffer();

  let upstream: Response;
  let current = url;
  try {
    for (let i = 0; ; i++) {
      upstream = await fetch(current, {
        method,
        headers,
        body: method === "POST" ? body : undefined,
        redirect: "manual",
        cache: "no-store",
      });
      const loc = upstream.headers.get("location");
      if (upstream.status >= 300 && upstream.status < 400 && loc && i < MAX_REDIRECTS) {
        const next = new URL(loc, current);
        if (!is_allowed(next)) return new Response(`redirect host not allowed: ${next.hostname}`, { status: 403 });
        current = next;
        // cross-host redirects must not leak credentials
        if (next.host !== url.host) {
          headers.delete("authorization");
          headers.delete("nyanko-signature");
        }
        continue;
      }
      break;
    }
  } catch (e) {
    return new Response(`upstream error: ${e instanceof Error ? e.message : String(e)}`, { status: 502 });
  }

  const out = new Headers();
  upstream.headers.forEach((value, name) => {
    if (!SKIP_RESPONSE_HEADERS.has(name.toLowerCase())) out.set(name, value);
  });
  out.set("x-proxy-final-url", current.toString());
  out.set("cache-control", "no-store");
  const noBody = upstream.status === 204 || upstream.status === 205 || upstream.status === 304 || method === "HEAD";
  const buf = noBody ? null : await upstream.arrayBuffer();
  return new Response(buf, { status: upstream.status, headers: out });
}

export async function GET(req: NextRequest): Promise<Response> {
  return handle(req);
}

export async function POST(req: NextRequest): Promise<Response> {
  return handle(req);
}
