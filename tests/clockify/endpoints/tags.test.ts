import { describe, it, expect } from "vitest";
import { server, http, HttpResponse } from "../../helpers/mockServer.js";
import { createClient } from "../../../src/clockify/client.js";
import { listTags } from "../../../src/clockify/endpoints/tags.js";

const cfg = {
  apiKey: "k",
  baseUrl: "https://api.test/api/v1",
  reportsBaseUrl: "https://reports.test/v1"
};

describe("tags", () => {
  it("listTags GETs tags with filters", async () => {
    let url: string | null = null;
    server.use(
      http.get("https://api.test/api/v1/workspaces/w1/tags", ({ request }) => {
        url = request.url;
        return HttpResponse.json([{ id: "tg1", name: "client" }]);
      })
    );
    const out = await listTags(createClient(cfg), "w1", { name: "client", archived: false });
    expect(url).toContain("name=client");
    expect(url).toContain("archived=false");
    expect(out[0]?.id).toBe("tg1");
  });
});
