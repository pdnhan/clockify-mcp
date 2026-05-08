// tests/lib/dates.test.ts
import { describe, it, expect } from "vitest";
import { resolveDateRange, isLiteralRange } from "../../src/lib/dates.js";

const TZ = "UTC";
const NOW = new Date("2026-05-07T14:30:00Z"); // Thursday

describe("resolveDateRange", () => {
  it("passes ISO strings through unchanged", () => {
    const r = resolveDateRange(
      { start: "2026-05-01T00:00:00Z", end: "2026-05-02T00:00:00Z" },
      { tz: TZ, now: NOW }
    );
    expect(r.start).toBe("2026-05-01T00:00:00Z");
    expect(r.end).toBe("2026-05-02T00:00:00Z");
  });

  it("expands 'today' to the full UTC day", () => {
    const r = resolveDateRange({ start: "today", end: "today" }, { tz: TZ, now: NOW });
    expect(r.start).toBe("2026-05-07T00:00:00.000Z");
    expect(r.end).toBe("2026-05-07T23:59:59.999Z");
  });

  it("expands 'yesterday' to the previous full UTC day", () => {
    const r = resolveDateRange({ start: "yesterday", end: "yesterday" }, { tz: TZ, now: NOW });
    expect(r.start).toBe("2026-05-06T00:00:00.000Z");
    expect(r.end).toBe("2026-05-06T23:59:59.999Z");
  });

  it("expands 'this_week' Monday→Sunday", () => {
    const r = resolveDateRange({ start: "this_week", end: "this_week" }, { tz: TZ, now: NOW });
    expect(r.start).toBe("2026-05-04T00:00:00.000Z"); // Mon
    expect(r.end).toBe("2026-05-10T23:59:59.999Z");   // Sun
  });

  it("expands 'last_week' to previous Mon→Sun", () => {
    const r = resolveDateRange({ start: "last_week", end: "last_week" }, { tz: TZ, now: NOW });
    expect(r.start).toBe("2026-04-27T00:00:00.000Z");
    expect(r.end).toBe("2026-05-03T23:59:59.999Z");
  });

  it("expands 'this_month' to first→last day", () => {
    const r = resolveDateRange({ start: "this_month", end: "this_month" }, { tz: TZ, now: NOW });
    expect(r.start).toBe("2026-05-01T00:00:00.000Z");
    expect(r.end).toBe("2026-05-31T23:59:59.999Z");
  });

  it("supports mixing a literal start and an ISO end", () => {
    const r = resolveDateRange(
      { start: "this_week", end: "2026-05-07T12:00:00Z" },
      { tz: TZ, now: NOW }
    );
    expect(r.start).toBe("2026-05-04T00:00:00.000Z");
    expect(r.end).toBe("2026-05-07T12:00:00Z");
  });
});

describe("isLiteralRange", () => {
  it("recognises supported literals", () => {
    expect(isLiteralRange("today")).toBe(true);
    expect(isLiteralRange("this_month")).toBe(true);
  });
  it("rejects ISO strings and unknown literals", () => {
    expect(isLiteralRange("2026-05-07")).toBe(false);
    expect(isLiteralRange("next_week")).toBe(false);
  });
});
