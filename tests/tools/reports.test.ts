import { describe, it, expect } from "vitest";
import { server, http, HttpResponse } from "../helpers/mockServer.js";
import { createClient } from "../../src/clockify/client.js";
import { createUserCache } from "../../src/lib/userCache.js";
import { reportTools } from "../../src/tools/reports.js";

const cfg = {
  apiKey: "k", workspaceId: "wDefault",
  baseUrl: "https://api.test/api/v1", reportsBaseUrl: "https://reports.test/v1",
  port: 3000, logLevel: "info" as const
};
function setup() {
  const client = createClient(cfg);
  return reportTools({ client, config: cfg, userCache: createUserCache(client) });
}

describe("reportTools", () => {
  it("report_summary resolves date literals and posts to reports host", async () => {
    let body: any = null;
    server.use(
      http.post(
        "https://reports.test/v1/workspaces/wDefault/reports/summary",
        async ({ request }) => {
          body = await request.json();
          return HttpResponse.json({ totals: [], groupOne: [] });
        }
      )
    );
    await setup().report_summary.handler({
      start: "this_week",
      end: "today",
      groups: ["PROJECT"]
    });
    expect(body.dateRangeStart).toMatch(/T00:00:00\.000Z$/);
    expect(body.dateRangeEnd).toMatch(/T23:59:59\.999Z$/);
    expect(body.summaryFilter.groups).toEqual(["PROJECT"]);
  });

  it("report_detailed defaults pagination", async () => {
    let body: any = null;
    server.use(
      http.post(
        "https://reports.test/v1/workspaces/wDefault/reports/detailed",
        async ({ request }) => {
          body = await request.json();
          return HttpResponse.json({});
        }
      )
    );
    await setup().report_detailed.handler({
      start: "2026-05-01T00:00:00Z",
      end: "2026-05-07T23:59:59Z"
    });
    expect(body.detailedFilter.page).toBe(1);
    expect(body.detailedFilter.pageSize).toBe(50);
  });

  it("report_weekly defaults the weekly grouping", async () => {
    let body: any = null;
    server.use(
      http.post(
        "https://reports.test/v1/workspaces/wDefault/reports/weekly",
        async ({ request }) => {
          body = await request.json();
          return HttpResponse.json({});
        }
      )
    );
    await setup().report_weekly.handler({
      start: "this_week",
      end: "this_week"
    });
    expect(body.weeklyFilter).toEqual({ group: "USER", subgroup: "TIME" });
  });

  it("list_shared_reports passes pagination", async () => {
    let url: string | null = null;
    server.use(
      http.get("https://reports.test/v1/workspaces/wDefault/shared-reports", ({ request }) => {
        url = request.url;
        return HttpResponse.json([]);
      })
    );
    await setup().list_shared_reports.handler({ page: 2, pageSize: 25 });
    expect(url).toContain("page=2");
    expect(url).toContain("page-size=25");
  });
});
