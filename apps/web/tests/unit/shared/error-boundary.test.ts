// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";

import { reportBoundaryError } from "~/components/feedback/error/boundary-utils";

describe("app error boundary helpers", () => {
  it("reports boundary failures with app-root context", () => {
    const errorLog = vi.fn<(event: string, payload: unknown) => void>();
    const error = new Error("render failed");

    reportBoundaryError({ error: errorLog }, error);

    expect(errorLog).toHaveBeenCalledTimes(1);
    expect(errorLog).toHaveBeenCalledWith(
      "ui_boundary_error",
      expect.objectContaining({
        boundary: "app-root",
        error,
        browser: expect.objectContaining({ path: "/" }),
      }),
    );
  });
});
