import { describe, expect, it } from "vitest";
import { workbenchInset } from "../../src/components/city/city-viewport";

describe("map space follows the real workbench instead of a camera breakpoint", () => {
  it.each([861, 999, 1000, 1440])("reserves an overlaid panel at %ipx", width => {
    expect(workbenchInset({ left: 0, right: width, top: 0, bottom: 900 },
      { left: width - 520, right: width - 20, top: 20, bottom: 880 })).toBe(536);
  });
  it("reserves more after expansion without losing the minimum map viewport", () => {
    const viewport = { left: 0, right: 1440, top: 0, bottom: 900 };
    expect(workbenchInset(viewport, { left: 760, right: 1420, top: 20, bottom: 880 })).toBe(696);
    expect(workbenchInset({ ...viewport, right: 400 }, { left: 0, right: 400, top: 0, bottom: 900 })).toBe(160);
  });
  it("does not reserve a stacked mobile workspace or an absent panel", () => {
    const viewport = { left: 0, right: 390, top: 1000, bottom: 1400 };
    expect(workbenchInset(viewport, { left: 12, right: 378, top: 12, bottom: 980 })).toBe(0);
    expect(workbenchInset(viewport, null)).toBe(0);
  });
});
