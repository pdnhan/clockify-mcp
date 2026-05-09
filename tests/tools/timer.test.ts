import { describe, it, expect } from "vitest";
import { server, http, HttpResponse } from "../helpers/mockServer.js";
import { createClient } from "../../src/clockify/client.js";
import { createUserCache } from "../../src/lib/userCache.js";
import { timerTools } from "../../src/tools/timer.js";

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
  const userCache = createUserCache(client);
  return timerTools({ client, config: cfg, userCache });
}

describe("timerTools", () => {
  it("start_timer falls back to default workspace and current user", async () => {
    server.use(
      http.get("https://api.test/api/v1/user", () =>
        HttpResponse.json({ id: "u1", defaultWorkspace: "wDefault" })
      ),
      http.post("https://api.test/api/v1/workspaces/wDefault/time-entries", async ({ request }) => {
        const body = (await request.json()) as { description: string; start: string; end?: string };
        expect(body.description).toBe("hack");
        expect(body.end).toBeUndefined();
        expect(typeof body.start).toBe("string");
        return HttpResponse.json({ id: "e1", description: "hack" });
      })
    );
    const out = (await setup().start_timer.handler({ description: "hack" })) as { id: string };
    expect(out.id).toBe("e1");
  });

  it("start_timer honours workspaceId override", async () => {
    server.use(
      http.post("https://api.test/api/v1/workspaces/wOther/time-entries", () =>
        HttpResponse.json({ id: "e2" })
      )
    );
    const out = (await setup().start_timer.handler({
      description: "x",
      workspaceId: "wOther"
    })) as { id: string };
    expect(out.id).toBe("e2");
  });

  it("get_running_timer returns null when no entry", async () => {
    server.use(
      http.get("https://api.test/api/v1/user", () =>
        HttpResponse.json({ id: "u1", defaultWorkspace: "wDefault" })
      ),
      http.get("https://api.test/api/v1/workspaces/wDefault/user/u1/time-entries", () =>
        HttpResponse.json([])
      )
    );
    const out = await setup().get_running_timer.handler({});
    expect(out).toBeNull();
  });

  it("stop_timer PATCHes user time-entries with end=now", async () => {
    server.use(
      http.get("https://api.test/api/v1/user", () =>
        HttpResponse.json({ id: "u1", defaultWorkspace: "wDefault" })
      ),
      http.patch(
        "https://api.test/api/v1/workspaces/wDefault/user/u1/time-entries",
        async ({ request }) => {
          const body = (await request.json()) as { end: string };
          expect(typeof body.end).toBe("string");
          return HttpResponse.json({ id: "e1" });
        }
      )
    );
    const out = (await setup().stop_timer.handler({})) as { id: string };
    expect(out.id).toBe("e1");
  });
});
