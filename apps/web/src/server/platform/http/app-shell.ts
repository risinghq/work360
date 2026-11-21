import { securityHeaders } from "./security-headers";

// no-transform stops Cloudflare injecting its Web Analytics beacon, which the
// CSP would block.
export const SHELL_CACHE_CONTROL =
  "public, max-age=0, must-revalidate, no-transform";

interface Assets {
  fetch(request: Request): Promise<Response>;
}

// Answers a path that no static asset matches. A missing file under /assets/
// belongs to another build. Answering it with the HTML shell would let the
// year of immutable caching on /assets/* keep HTML under a script's name, and
// the page would stay blank in that browser. Every other path is a client
// route, so it gets the shell.
export async function serveAppShell(
  request: Request,
  assets: Assets,
): Promise<Response> {
  const url = new URL(request.url);
  if (url.pathname.startsWith("/assets/")) {
    return new Response(null, {
      status: 404,
      headers: { "Cache-Control": "no-store" },
    });
  }
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response(null, {
      status: 405,
      headers: { Allow: "GET, HEAD" },
    });
  }

  const shell = await assets.fetch(
    new Request(new URL("/", url), { method: request.method }),
  );
  const headers = new Headers(shell.headers);
  for (const [name, value] of Object.entries(
    securityHeaders({ development: false }),
  )) {
    headers.set(name, value);
  }
  headers.set("Cache-Control", SHELL_CACHE_CONTROL);
  return new Response(shell.body, { status: shell.status, headers });
}
