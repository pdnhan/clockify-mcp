import { describe, it, expect } from "vitest";
import { server, http, HttpResponse } from "../helpers/mockServer.js";
import { createClient } from "../../src/clockify/client.js";
import { createUserCache } from "../../src/lib/userCache.js";
import { tagTools } from "../../src/tools/tags.js";

const cfg = {
  apiKey: "k", workspaceId: "wDefault",
  baseUrl: "https://api.test/api/v1", reportsBaseUrl: "https://reports.test/v1",
  port: 3000, logLevel: "info" as const
};

describe("tagTools", () => {
  it("list_tags falls back to default workspace", async () => {
    server.use(
      http.get("https://api.test/api/v1/workspaces/wDefault/tags", () =>
        HttpResponse.json([{ id: "tg1", name: "client" }])
      )
    );
    const client = createClient(cfg);
    const tools = tagTools({ client, config: cfg, userCache: createUserCache(client) });
    const out = (await tools.list_tags.handler({})) as Array<{ id: string }>;
    expect(out[0]?.id).toBe("tg1");
  });
});
