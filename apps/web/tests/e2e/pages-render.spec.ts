import { ROUTE_MANIFEST } from "~/domain/auth/access/route-manifest";

import { expect, test } from "./fixtures";
import { ROSTER } from "./roster";

const PAGES = Object.keys(ROUTE_MANIFEST);

// A page that reads a pending query outside a tracking scope renders fine in
// unit tests and on a soft navigation from a warm cache, and fails only on a
// hard load. So every page is loaded cold, as each role that may open it.
test.describe("every page renders on a hard load", () => {
  // One role's sweep is a cold load of every page, about 25s alone and over a
  // minute beside the rest of the suite.
  test.setTimeout(240_000);

  for (const user of ROSTER) {
    test(`as ${user.key}`, async ({ signInAs }) => {
      const page = await signInAs(user.key);
      const failed: string[] = [];

      for (const path of PAGES) {
        await page.goto(path);
        await page.waitForLoadState("networkidle");

        // A page the role may not open redirects; its landing page is covered
        // under its own path.
        if (new URL(page.url()).pathname !== path) {
          continue;
        }

        const boundary = page.getByRole("alert").filter({
          hasText: "No se pudo mostrar esta página",
        });

        if ((await boundary.count()) > 0) {
          failed.push(`${path}: ${await boundary.innerText()}`);
        }
      }

      expect(failed).toEqual([]);
    });
  }
});
