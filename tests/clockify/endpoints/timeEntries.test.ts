import { describe, it, expect } from "vitest";
import { server, http, HttpResponse } from "../../helpers/mockServer.js";
import { createClient } from "../../../src/clockify/client.js";
import {
  listUserTimeEntries,
  getRunningTimeEntry,
  createTimeEntry,
  updateTimeEntry,
  deleteTimeEntry,
  stopRunningTimer
} from "../../../src/clockify/endpoints/timeEntries.js";

const cfg = {
  apiKey: "k",
  baseUrl: "https://api.test/api/v1",
  reportsBaseUrl: "https://reports.test/v1"
};
const client = createClient(cfg);

describe("time entries", () => {
  it("listUserTimeEntries GETs user time entries with date filters", async () => {
    let url: string | null = null;
    server.use(
      http.get("https://api.test/api/v1/workspaces/w1/user/u1/time-entries", ({ request }) => {
        url = request.url;
        return HttpResponse.json([{ id: "e1" }]);
      })
    );
    await listUserTimeEntries(client, "w1", "u1", {
      start: "2026-05-01T00:00:00Z",
      end: "2026-05-02T00:00:00Z",
      project: "p1",
      page: 1,
      pageSize: 50
    });
    expect(url).toContain("start=2026-05-01T00%3A00%3A00Z");
    expect(url).toContain("end=2026-05-02T00%3A00%3A00Z");
    expect(url).toContain("project=p1");
    expect(url).toContain("page=1");
    expect(url).toContain("page-size=50");
  });

  it("getRunningTimeEntry uses in-progress=true and returns the first entry or null", async () => {
    server.use(
      http.get("https://api.test/api/v1/workspaces/w1/user/u1/time-entries", ({ request }) => {
        expect(new URL(request.url).searchParams.get("in-progress")).toBe("true");
        return HttpResponse.json([{ id: "e1" }]);
      })
    );
    const out = await getRunningTimeEntry(client, "w1", "u1");
    expect(out?.id).toBe("e1");
  });

  it("getRunningTimeEntry returns null when no entry", async () => {
    server.use(
      http.get("https://api.test/api/v1/workspaces/w1/user/u1/time-entries", () =>
        HttpResponse.json([])
      )
    );
    const out = await getRunningTimeEntry(client, "w1", "u1");
    expect(out).toBeNull();
  });

  it("createTimeEntry POSTs the body and returns the parsed entry", async () => {
    let body: unknown = null;
    server.use(
      http.post("https://api.test/api/v1/workspaces/w1/time-entries", async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ id: "e2", description: "x" });
      })
    );
    const out = await createTimeEntry(client, "w1", {
      description: "x",
      start: "2026-05-07T10:00:00Z",
      end: "2026-05-07T11:00:00Z",
      projectId: "p1",
      tagIds: ["tg1"],
      billable: true
    });
    expect(out.id).toBe("e2");
    expect(body).toMatchObject({
      description: "x",
      start: "2026-05-07T10:00:00Z",
      end: "2026-05-07T11:00:00Z",
      projectId: "p1",
      tagIds: ["tg1"],
      billable: true
    });
  });

  it("updateTimeEntry PUTs the body", async () => {
    server.use(
      http.put("https://api.test/api/v1/workspaces/w1/time-entries/e1", async ({ request }) => {
        const body = await request.json();
        expect(body).toMatchObject({ description: "y" });
        return HttpResponse.json({ id: "e1", description: "y" });
      })
    );
    const out = await updateTimeEntry(client, "w1", "e1", { description: "y" });
    expect(out.description).toBe("y");
  });

  it("deleteTimeEntry DELETEs and returns null", async () => {
    server.use(
      http.delete("https://api.test/api/v1/workspaces/w1/time-entries/e1", () =>
        new HttpResponse(null, { status: 204 })
      )
    );
    await expect(deleteTimeEntry(client, "w1", "e1")).resolves.toBeNull();
  });

  it("stopRunningTimer PATCHes user time-entries with end=now", async () => {
    let body: { end?: string } | null = null;
    server.use(
      http.patch(
        "https://api.test/api/v1/workspaces/w1/user/u1/time-entries",
        async ({ request }) => {
          body = (await request.json()) as { end?: string };
          return HttpResponse.json({ id: "e1" });
        }
      )
    );
    const out = await stopRunningTimer(client, "w1", "u1", "2026-05-07T11:00:00Z");
    expect(out.id).toBe("e1");
    expect(body?.end).toBe("2026-05-07T11:00:00Z");
  });
});
