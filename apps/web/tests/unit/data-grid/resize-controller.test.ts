import { createRoot } from "solid-js";
import { describe, expect, it } from "vitest";

import { createDataGridResizeController } from "~/features/data-grid/hooks/create-resize-controller";

describe("createDataGridResizeController", () => {
  it("updates only from the pointer that started the resize", () => {
    createRoot((dispose) => {
      const resize = createDataGridResizeController();
      resize.begin({
        key: "name",
        pointerId: 3,
        clientX: 100,
        currentWidth: 180,
      });

      resize.update(4, 140);
      expect(resize.columnWidths()).toEqual({});

      resize.update(3, 140);
      expect(resize.columnWidths()).toEqual({ name: 220 });

      resize.complete(4);
      expect(resize.active()).toBe(true);

      resize.complete(3);
      expect(resize.active()).toBe(false);
      dispose();
    });
  });

  it("hands the final width to the owner and drops its override", () => {
    createRoot((dispose) => {
      const resized: Array<[string, number]> = [];
      const resize = createDataGridResizeController((key, width) =>
        resized.push([key, width]),
      );
      resize.begin({
        key: "name",
        pointerId: 1,
        clientX: 100,
        currentWidth: 150,
      });
      resize.update(1, 130);
      resize.complete(1);

      expect(resized).toEqual([["name", 180]]);
      expect(resize.columnWidths()).toEqual({});
      dispose();
    });
  });

  it("enforces the minimum column width", () => {
    createRoot((dispose) => {
      const resize = createDataGridResizeController();
      resize.begin({
        key: "name",
        pointerId: 3,
        clientX: 200,
        currentWidth: 120,
      });

      resize.update(3, 0);
      expect(resize.columnWidths()).toEqual({ name: 80 });
      dispose();
    });
  });
});
