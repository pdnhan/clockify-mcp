import { describe, it, expect } from "vitest";
import { server, http, HttpResponse } from "../../helpers/mockServer.js";
import { createClient } from "../../../src/clockify/client.js";
import {
  reportSummary,
  reportDetailed,
  reportWeekly,
  listSharedReports
} from "../../../src/clockify/endpoints/reports.js";

const cfg = {
  apiKey: "k",
  baseUrl: "https://api.test/api/v1",
  reportsBaseUrl: "https://reports.test/v1"
};
const client = createClient(cfg);

describe("reports", () => {
  it("reportSummary POSTs to the reports host with grouping", async () => {
    let body: any = null;
    server.use(
      http.post("https://reports.test/v1/workspaces/w1/reports/summary", async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ totals: [{ totalTime: 3600 }], groupOne: [] });
      })
    );
    const out = await reportSummary(client, "w1", {
      start: "2026-05-01T00:00:00Z",
      end: "2026-05-07T23:59:59Z",
      groups: ["PROJECT", "USER"],
      users: ["u1"],
      projects: ["p1"]
    });
    expect(body.dateRangeStart).toBe("2026-05-01T00:00:00Z");
    expect(body.dateRangeEnd).toBe("2026-05-07T23:59:59Z");
    expect(body.summaryFilter.groups).toEqual(["PROJECT", "USER"]);
    expect(body.users.ids).toEqual(["u1"]);
    expect(body.projects.ids).toEqual(["p1"]);
    expect(body.exportType).toBe("JSON");
    expect((out as any).totals[0].totalTime).toBe(3600);
  });

  it("reportDetailed POSTs with detailedFilter pagination", async () => {
    let body: any = null;
    server.use(
      http.post("https://reports.test/v1/workspaces/w1/reports/detailed", async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ timeentries: [], totals: [] });
      })
    );
    await reportDetailed(client, "w1", {
      start: "2026-05-01T00:00:00Z",
      end: "2026-05-07T23:59:59Z",
      page: 2,
      pageSize: 100,
      sortColumn: "DATE"
    });
    expect(body.detailedFilter.page).toBe(2);
    expect(body.detailedFilter.pageSize).toBe(100);
    expect(body.detailedFilter.sortColumn).toBe("DATE");
  });

  it("reportWeekly POSTs with weekly grouping", async () => {
    let body: any = null;
    server.use(
      http.post("https://reports.test/v1/workspaces/w1/reports/weekly", async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ totals: [], weekly: [] });
      })
    );
    await reportWeekly(client, "w1", {
      start: "2026-05-04T00:00:00Z",
      end: "2026-05-10T23:59:59Z",
      weeklyFilter: { group: "USER", subgroup: "TIME" }
    });
    expect(body.weeklyFilter).toEqual({ group: "USER", subgroup: "TIME" });
  });

  it("listSharedReports GETs the shared-reports endpoint", async () => {
    let url: string | null = null;
    server.use(
      http.get("https://reports.test/v1/workspaces/w1/shared-reports", ({ request }) => {
        url = request.url;
        return HttpResponse.json([]);
      })
    );
    await listSharedReports(client, "w1", { page: 1, pageSize: 10 });
    expect(url).toContain("page=1");
    expect(url).toContain("page-size=10");
  });
});
