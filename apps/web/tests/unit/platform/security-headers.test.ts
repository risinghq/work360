import { describe, expect, it } from "vitest";

import { securityHeaders } from "~/server/platform/http/security-headers";

function directives(csp: string | undefined): Map<string, string> {
  return new Map(
    (csp ?? "").split("; ").map((directive) => {
      const [name = "", ...values] = directive.split(" ");
      return [name, values.join(" ")];
    }),
  );
}

describe("securityHeaders", () => {
  it("allows only same-origin scripts and connections in a build", () => {
    const csp = directives(
      securityHeaders({ development: false })["Content-Security-Policy"],
    );

    expect(csp.get("script-src")).toBe("'self'");
    expect(csp.get("worker-src")).toBe("'self' blob:");
    expect(csp.get("connect-src")).toBe("'self'");
    expect(csp.get("frame-ancestors")).toBe("'none'");
  });

  it("relaxes scripts and drops HSTS in development", () => {
    const headers = securityHeaders({ development: true });

    expect(
      directives(headers["Content-Security-Policy"]).get("script-src"),
    ).toBe("'self' 'unsafe-inline' 'unsafe-eval'");
    expect(headers["Strict-Transport-Security"]).toBeUndefined();
  });

  it("sends HSTS from a build", () => {
    const headers = securityHeaders({ development: false });
    expect(headers["Strict-Transport-Security"]).toContain("max-age=");
  });
});
