import { afterEach, expect, it, vi } from "vitest";
import { loadCustomThemes } from "../src/modules/appearance/domain/load-custom.js";
import { getTheme, registerTheme, unregisterTheme } from "../src/modules/appearance/domain/registry.js";

afterEach(() => {
  unregisterTheme("everforest", { force: true });
  vi.restoreAllMocks();
});

it("repeated app initialization preserves restored theme settings without errors", () => {
  const error = vi.spyOn(console, "error");
  loadCustomThemes();
  registerTheme({ ...getTheme("everforest"), label: "My restored theme" }, { replace: true });
  expect(loadCustomThemes()).toContain("everforest");
  expect(getTheme("everforest").label).toBe("My restored theme");
  expect(error).not.toHaveBeenCalled();
});

it("registers the bundled theme again after the registry is cleared", () => {
  loadCustomThemes();
  unregisterTheme("everforest", { force: true });
  expect(loadCustomThemes()).toContain("everforest");
  expect(getTheme("everforest")).not.toBeNull();
});
