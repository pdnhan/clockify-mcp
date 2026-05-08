export type Literal = "today" | "yesterday" | "this_week" | "last_week" | "this_month";

const LITERALS = ["today", "yesterday", "this_week", "last_week", "this_month"] as const;

export function isLiteralRange(s: string): s is Literal {
  return (LITERALS as readonly string[]).includes(s);
}

export type Resolver = { tz: string; now?: Date };

export function resolveDateRange(
  input: { start: string; end: string },
  ctx: Resolver
): { start: string; end: string } {
  const now = ctx.now ?? new Date();
  return {
    start: resolveOne(input.start, now, "start"),
    end: resolveOne(input.end, now, "end")
  };
}

function resolveOne(s: string, now: Date, side: "start" | "end"): string {
  if (!isLiteralRange(s)) return s;
  const range = literalRange(s, now);
  return side === "start" ? range.start.toISOString() : range.end.toISOString();
}

function literalRange(lit: Literal, now: Date): { start: Date; end: Date } {
  const day = (d: Date) => {
    const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
    const end = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59, 999));
    return { start, end };
  };
  if (lit === "today") return day(now);
  if (lit === "yesterday") {
    const y = new Date(now);
    y.setUTCDate(y.getUTCDate() - 1);
    return day(y);
  }
  if (lit === "this_week" || lit === "last_week") {
    const weekday = (now.getUTCDay() + 6) % 7; // Mon = 0
    const monday = new Date(now);
    monday.setUTCDate(monday.getUTCDate() - weekday);
    if (lit === "last_week") monday.setUTCDate(monday.getUTCDate() - 7);
    const sunday = new Date(monday);
    sunday.setUTCDate(sunday.getUTCDate() + 6);
    return { start: day(monday).start, end: day(sunday).end };
  }
  // this_month
  const first = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const last = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));
  return { start: day(first).start, end: day(last).end };
}
