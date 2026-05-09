import { describe, it, expect } from "vitest";
import { server, http, HttpResponse } from "../../helpers/mockServer.js";
import { createClient as createHttp } from "../../../src/clockify/client.js";
import { listClients, createClockifyClient } from "../../../src/clockify/endpoints/clients.js";

const cfg = {
  apiKey: "k",
  baseUrl: "https://api.test/api/v1",
  reportsBaseUrl: "https://reports.test/v1"
};

describe("clients", () => {
  it("listClients GETs clients with filters", async () => {
    let url: string | null = null;
    server.use(
      http.get("https://api.test/api/v1/workspaces/w1/clients", ({ request }) => {
        url = request.url;
        return HttpResponse.json([{ id: "c1", name: "Acme" }]);
      })
    );
    const out = await listClients(createHttp(cfg), "w1", { name: "Acme" });
    expect(url).toContain("name=Acme");
    expect(out[0]?.id).toBe("c1");
  });

  it("createClockifyClient POSTs the body", async () => {
    let body: unknown = null;
    server.use(
      http.post("https://api.test/api/v1/workspaces/w1/clients", async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ id: "c2", name: "Beta" });
      })
    );
    const out = await createClockifyClient(createHttp(cfg), "w1", {
      name: "Beta",
      address: "1 St"
    });
    expect(out.id).toBe("c2");
    expect(body).toMatchObject({ name: "Beta", address: "1 St" });
  });
});
