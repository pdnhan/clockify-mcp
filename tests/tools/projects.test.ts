import { describe, it, expect } from "vitest";
import { server, http, HttpResponse } from "../helpers/mockServer.js";
import { createClient } from "../../src/clockify/client.js";
import { createUserCache } from "../../src/lib/userCache.js";
import { projectTools } from "../../src/tools/projects.js";

const cfg = {
  apiKey: "k", workspaceId: "wDefault",
  baseUrl: "https://api.test/api/v1", reportsBaseUrl: "https://reports.test/v1",
  port: 3000, logLevel: "info" as const
};
function setup() {
  const client = createClient(cfg);
  return projectTools({ client, config: cfg, userCache: createUserCache(client) });
}

describe("projectTools", () => {
  it("list_projects falls back to default workspace", async () => {
    server.use(
      http.get("https://api.test/api/v1/workspaces/wDefault/projects", () =>
        HttpResponse.json([{ id: "p1", name: "X" }])
      )
    );
    const out = (await setup().list_projects.handler({})) as Array<{ id: string }>;
    expect(out[0]?.id).toBe("p1");
  });

  it("get_project requires id", async () => {
    server.use(
      http.get("https://api.test/api/v1/workspaces/wDefault/projects/p9", () =>
        HttpResponse.json({ id: "p9", name: "Y" })
      )
    );
    const out = (await setup().get_project.handler({ id: "p9" })) as { id: string };
    expect(out.id).toBe("p9");
  });

  it("create_project POSTs the body", async () => {
    server.use(
      http.post("https://api.test/api/v1/workspaces/wDefault/projects", async ({ request }) => {
        const body = await request.json();
        expect(body).toMatchObject({ name: "Z" });
        return HttpResponse.json({ id: "p2", name: "Z" });
      })
    );
    const out = (await setup().create_project.handler({ name: "Z" })) as { id: string };
    expect(out.id).toBe("p2");
  });
});
