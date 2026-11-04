/**
 * Browser networking helper: all cross-origin requests (game servers, game data repos) go through the
 * same-origin Next.js route `/api/proxy`, which forwards to an allowlist of hosts.
 *
 * Protocol (client -> /api/proxy?url=<encoded target>):
 *  - HTTP method: GET or POST, same as the real request (anything else is sent as POST with `x-proxy-method`).
 *  - Every request header H is sent as `x-fwd-H` (so browser-forbidden headers like user-agent work).
 *  - Body is forwarded as is.
 * Response: upstream status, body (already decoded by the server), and upstream headers (minus hop-by-hop ones).
 */

export const PROXY_PATH = "/api/proxy";
export const FORWARD_HEADER_PREFIX = "x-fwd-";
export const METHOD_HEADER = "x-proxy-method";

function toHeaders(init?: HeadersInit): Headers {
  return new Headers(init ?? {});
}

export async function fetchViaProxy(url: string, init: RequestInit = {}): Promise<Response> {
  const method = (init.method ?? "GET").toUpperCase();
  const headers = new Headers();
  for (const [k, v] of toHeaders(init.headers).entries()) {
    headers.set(FORWARD_HEADER_PREFIX + k, v);
  }
  let real_method = method;
  if (method !== "GET" && method !== "POST") {
    headers.set(METHOD_HEADER, method);
    real_method = "POST";
  }
  const proxy_url = `${PROXY_PATH}?url=${encodeURIComponent(url)}`;
  return fetch(proxy_url, {
    method: real_method,
    headers,
    body: real_method === "GET" ? undefined : init.body,
    signal: init.signal,
    cache: "no-store",
  });
}

/** fetchViaProxy with a timeout (seconds); returns null on network error / timeout (like RequestHandler). */
export async function fetchViaProxySafe(
  url: string,
  init: RequestInit = {},
  timeout_seconds?: number,
): Promise<Response | null> {
  const ctrl = new AbortController();
  const timer = timeout_seconds ? setTimeout(() => ctrl.abort(), timeout_seconds * 1000) : null;
  try {
    return await fetchViaProxy(url, { ...init, signal: init.signal ?? ctrl.signal });
  } catch {
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}
