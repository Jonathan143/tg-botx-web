import { describe, expect, it } from "vitest";

import { formatChartLabel } from "./format";

describe("formatChartLabel", () => {
  it("formats UTC instants in the browser's local timezone", () => {
    const value = "2026-08-25T13:00:00Z";
    const parts = new Intl.DateTimeFormat("zh-CN", {
      day: "2-digit",
      hour: "2-digit",
      hour12: false,
      minute: "2-digit",
      month: "2-digit",
    }).formatToParts(new Date(value));
    const part = (type: Intl.DateTimeFormatPartTypes) =>
      parts.find((item) => item.type === type)?.value ?? "";

    expect(formatChartLabel(value, "24h")).toBe(
      `${part("month")}-${part("day")} ${part("hour")}:${part("minute")}`,
    );
  });

  it("keeps daily bucket dates as calendar dates", () => {
    expect(formatChartLabel("2026-08-26", "7d")).toBe("08-26");
    expect(formatChartLabel("2026-08-26", "30d")).toBe("08-26");
  });

  it("returns an unparseable label unchanged", () => {
    expect(formatChartLabel("未知时间", "24h")).toBe("未知时间");
  });
});
