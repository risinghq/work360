import type { Plugin } from "vite";

import { SHELL_CACHE_CONTROL } from "./src/server/platform/http/app-shell.ts";
import { securityHeaders } from "./src/server/platform/http/security-headers.ts";

// On Workers the assets binding serves pages and static files without running
// the Worker, so the middleware's headers never reach them. Workers reads these
// two files from the assets directory instead of serving them.
export function workersAssetsPlugin(): Plugin {
  return {
    name: "workers-assets",
    applyToEnvironment: (environment) => environment.name === "client",
    generateBundle() {
      this.emitFile({
        type: "asset",
        fileName: "_headers",
        source: headersFile(securityHeaders({ development: false })),
      });
      this.emitFile({
        type: "asset",
        fileName: ".assetsignore",
        // The bundle analyzer's report is a build diagnostic, not a page.
        source: "analyze-data.md\n",
      });
    },
  };
}

export function headersFile(security: Record<string, string>): string {
  const lines = (headers: Record<string, string>) =>
    Object.entries(headers).map(([name, value]) => `  ${name}: ${value}`);
  return [
    "/*",
    ...lines(security),
    // no-transform also stops Cloudflare compressing, so the bundles under
    // /assets detach it.
    `  Cache-Control: ${SHELL_CACHE_CONTROL}`,
    // Vite content-hashes every file under /assets, so a name never changes
    // content.
    "/assets/*",
    "  ! Cache-Control",
    "  Cache-Control: public, max-age=31536000, immutable",
    "",
  ].join("\n");
}
