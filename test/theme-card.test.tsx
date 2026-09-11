import { describe, expect, it } from "vitest";
import { themeCardTokens } from "../src/modules/appearance/ui/ThemeCard";
import { DARK_TOKENS, LIGHT_TOKENS } from "../src/modules/appearance/domain/base-themes.js";

describe("Theme card palette matches the applied theme", () => {
  it("uses each theme's current-scheme effort colors instead of the static preview", () => {
    const entry = { id: "custom", label: "Custom", tokens: {
      light: { "--effort-accent-2": "#123456", "--effort-max-accent": "#654321" },
      dark: { "--effort-accent-2": "#abcdef", "--effort-max-accent": "#fedcba" }
    } };
    expect(themeCardTokens(entry, "light")["--effort-max-accent"]).toBe("#654321");
    const dark = themeCardTokens(entry, "dark");
    expect(dark["--effort-accent-2"]).toBe("#abcdef");
    expect(dark["--effort-max-accent"]).toBe("#fedcba");
  });

  it("honors fixed-scheme imported themes", () => {
    const entry = { id: "night", label: "Night", fixedScheme: "dark", tokens: { dark: { "--canvas-mid": "#112233" } } };
    const tokens = themeCardTokens(entry, "light");
    expect(tokens["--canvas-mid"]).toBe("#112233");
    expect(tokens["--effort-max-accent"]).toBe(DARK_TOKENS["--effort-max-accent"]);
  });

  it("falls back within the selected scheme without borrowing another scheme's overrides", () => {
    const entry = { id: "partial", label: "Partial", tokens: { light: { "--effort-max-accent": "#112233" } } };
    expect(themeCardTokens(entry, "dark")["--effort-max-accent"]).toBe(DARK_TOKENS["--effort-max-accent"]);
    expect(themeCardTokens({ id: "empty", label: "Empty" }, "light")["--canvas-mid"]).toBe(LIGHT_TOKENS["--canvas-mid"]);
  });
});
