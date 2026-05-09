import { describe, it, expect } from "vitest";
import { server, http, HttpResponse } from "../../helpers/mockServer.js";
import { createClient } from "../../../src/clockify/client.js";
import { listWorkspaces } from "../../../src/clockify/endpoints/workspaces.js";

const cfg = {
  apiKey: "k",
  baseUrl: "https://api.test/api/v1",
  reportsBaseUrl: "https://reports.test/v1"
};

describe("listWorkspaces", () => {
  it("GETs /workspaces and parses an array", async () => {
    server.use(
      http.get("https://api.test/api/v1/workspaces", () =>
        HttpResponse.json([
          { id: "w1", name: "Acme" },
          { id: "w2", name: "Beta" }
        ])
      )
    );
    const client = createClient(cfg);
    const out = await listWorkspaces(client);
    expect(out).toHaveLength(2);
    expect(out[0]?.id).toBe("w1");
  });
});
