import { describe, expect, it } from "vitest";
import { formatRelativeDays, daysSinceToday } from "../src/shared/utils.js";

describe("conversation calendar age", () => {
  const now = new Date(2026, 8, 5, 0, 5);
  it("uses calendar boundaries rather than a 24 hour duration", () => {
    expect(formatRelativeDays(new Date(2026, 8, 5).getTime(), now)).toBe("今天");
    expect(formatRelativeDays(new Date(2026, 8, 4, 23, 59).getTime(), now)).toBe("1天");
    expect(formatRelativeDays(new Date(2026, 7, 17).getTime(), now)).toBe("19天");
    expect(daysSinceToday(new Date(2025, 11, 31), new Date(2026, 0, 1))).toBe(1);
  });
  it("handles missing, invalid and future timestamps", () => {
    expect(formatRelativeDays(undefined, now)).toBe("");
    expect(formatRelativeDays("invalid", now)).toBe("");
    expect(formatRelativeDays(new Date(2026, 8, 6), now)).toBe("今天");
  });
});
