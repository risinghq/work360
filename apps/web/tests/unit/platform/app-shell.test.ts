import { describe, expect, it } from "vitest";

import {
  SHELL_CACHE_CONTROL,
  serveAppShell,
} from "~/server/platform/http/app-shell";

const SHELL = "<!DOCTYPE html><html></html>";

function assets() {
  const requested: string[] = [];
  return {
    requested,
    fetch: async (request: Request) => {
      requested.push(request.url);
      return new Response(SHELL, {
        headers: { "Content-Type": "text/html" },
      });
    },
  };
}

describe("serveAppShell", () => {
  it("answers a missing hashed chunk with an uncached 404", async () => {
    const binding = assets();

    const response = await serveAppShell(
      new Request("https://work360.test/assets/web-OLDHASH.js"),
      binding,
    );

    expect(response.status).toBe(404);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(binding.requested).toEqual([]);
  });

  it("answers a client route with the shell and its headers", async () => {
    const binding = assets();

    const response = await serveAppShell(
      new Request("https://work360.test/companies/42?tab=people"),
      binding,
    );

    expect(response.status).toBe(200);
    expect(await response.text()).toBe(SHELL);
    expect(binding.requested).toEqual(["https://work360.test/"]);
    expect(response.headers.get("Cache-Control")).toBe(SHELL_CACHE_CONTROL);
    expect(response.headers.get("Content-Security-Policy")).toContain(
      "script-src 'self'",
    );
  });
});
