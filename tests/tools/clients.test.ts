import { describe, it, expect } from "vitest";
import { server, http, HttpResponse } from "../helpers/mockServer.js";
import { createClient } from "../../src/clockify/client.js";
import { createUserCache } from "../../src/lib/userCache.js";
import { clientTools } from "../../src/tools/clients.js";

const cfg = {
  apiKey: "k", workspaceId: "wDefault",
  baseUrl: "https://api.test/api/v1", reportsBaseUrl: "https://reports.test/v1",
  port: 3000, logLevel: "info" as const
};

describe("clientTools", () => {
  it("list_clients GETs default workspace clients", async () => {
    server.use(
      http.get("https://api.test/api/v1/workspaces/wDefault/clients", () =>
        HttpResponse.json([{ id: "c1", name: "Acme" }])
      )
    );
    const client = createClient(cfg);
    const tools = clientTools({ client, config: cfg, userCache: createUserCache(client) });
    const out = (await tools.list_clients.handler({})) as Array<{ id: string }>;
    expect(out[0]?.id).toBe("c1");
  });

  it("create_client POSTs the body", async () => {
    server.use(
      http.post("https://api.test/api/v1/workspaces/wDefault/clients", async ({ request }) => {
        const body = await request.json();
        expect(body).toMatchObject({ name: "Beta" });
        return HttpResponse.json({ id: "c2", name: "Beta" });
      })
    );
    const client = createClient(cfg);
    const tools = clientTools({ client, config: cfg, userCache: createUserCache(client) });
    const out = (await tools.create_client.handler({ name: "Beta" })) as { id: string };
    expect(out.id).toBe("c2");
  });
});
