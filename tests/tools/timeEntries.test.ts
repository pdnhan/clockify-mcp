import { describe, it, expect } from "vitest";
import { server, http, HttpResponse } from "../helpers/mockServer.js";
import { createClient } from "../../src/clockify/client.js";
import { createUserCache } from "../../src/lib/userCache.js";
import { timeEntryTools } from "../../src/tools/timeEntries.js";

const cfg = {
  apiKey: "k",
  workspaceId: "wDefault",
  baseUrl: "https://api.test/api/v1",
  reportsBaseUrl: "https://reports.test/v1",
  port: 3000,
  logLevel: "info" as const
};

function setup() {
  const client = createClient(cfg);
  return timeEntryTools({ client, config: cfg, userCache: createUserCache(client) });
}

describe("timeEntryTools", () => {
  it("list_time_entries resolves 'today' literal and uses current user", async () => {
    server.use(
      http.get("https://api.test/api/v1/user", () =>
        HttpResponse.json({ id: "u1", defaultWorkspace: "wDefault" })
      ),
      http.get(
        "https://api.test/api/v1/workspaces/wDefault/user/u1/time-entries",
        ({ request }) => {
          const u = new URL(request.url);
          expect(u.searchParams.get("start")).toMatch(/T00:00:00\.000Z$/);
          expect(u.searchParams.get("end")).toMatch(/T23:59:59\.999Z$/);
          return HttpResponse.json([{ id: "e1" }]);
        }
      )
    );
    const out = (await setup().list_time_entries.handler({ start: "today", end: "today" })) as Array<{ id: string }>;
    expect(out[0]?.id).toBe("e1");
  });

  it("create_time_entry passes through fields", async () => {
    server.use(
      http.post("https://api.test/api/v1/workspaces/wDefault/time-entries", async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        expect(body.description).toBe("x");
        expect(body.tagIds).toEqual(["tg1"]);
        return HttpResponse.json({ id: "e1" });
      })
    );
    await setup().create_time_entry.handler({
      description: "x",
      start: "2026-05-07T10:00:00Z",
      end: "2026-05-07T11:00:00Z",
      tags: ["tg1"]
    });
  });

  it("delete_time_entry returns null", async () => {
    server.use(
      http.delete("https://api.test/api/v1/workspaces/wDefault/time-entries/e1", () =>
        new HttpResponse(null, { status: 204 })
      )
    );
    const out = await setup().delete_time_entry.handler({ id: "e1" });
    expect(out).toBeNull();
  });
});
