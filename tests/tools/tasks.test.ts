import { describe, it, expect } from "vitest";
import { server, http, HttpResponse } from "../helpers/mockServer.js";
import { createClient } from "../../src/clockify/client.js";
import { createUserCache } from "../../src/lib/userCache.js";
import { taskTools } from "../../src/tools/tasks.js";

const cfg = {
  apiKey: "k", workspaceId: "wDefault",
  baseUrl: "https://api.test/api/v1", reportsBaseUrl: "https://reports.test/v1",
  port: 3000, logLevel: "info" as const
};
function setup() {
  const client = createClient(cfg);
  return taskTools({ client, config: cfg, userCache: createUserCache(client) });
}

describe("taskTools", () => {
  it("list_tasks GETs project tasks", async () => {
    server.use(
      http.get("https://api.test/api/v1/workspaces/wDefault/projects/p1/tasks", () =>
        HttpResponse.json([{ id: "t1", name: "x", projectId: "p1" }])
      )
    );
    const out = (await setup().list_tasks.handler({ projectId: "p1" })) as Array<{ id: string }>;
    expect(out[0]?.id).toBe("t1");
  });

  it("create_task POSTs the body", async () => {
    server.use(
      http.post(
        "https://api.test/api/v1/workspaces/wDefault/projects/p1/tasks",
        async ({ request }) => {
          const body = await request.json();
          expect(body).toMatchObject({ name: "Build" });
          return HttpResponse.json({ id: "t2", name: "Build", projectId: "p1" });
        }
      )
    );
    const out = (await setup().create_task.handler({ projectId: "p1", name: "Build" })) as {
      id: string;
    };
    expect(out.id).toBe("t2");
  });
});
