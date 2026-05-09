import { describe, it, expect } from "vitest";
import { server, http, HttpResponse } from "../../helpers/mockServer.js";
import { createClient } from "../../../src/clockify/client.js";
import {
  listProjects, getProject, createProject
} from "../../../src/clockify/endpoints/projects.js";

const cfg = {
  apiKey: "k",
  baseUrl: "https://api.test/api/v1",
  reportsBaseUrl: "https://reports.test/v1"
};

describe("projects", () => {
  it("listProjects sends filters as query params", async () => {
    let url: string | null = null;
    server.use(
      http.get("https://api.test/api/v1/workspaces/w1/projects", ({ request }) => {
        url = request.url;
        return HttpResponse.json([{ id: "p1", name: "X" }]);
      })
    );
    const out = await listProjects(createClient(cfg), "w1", { name: "X", archived: false, page: 2 });
    expect(url).toContain("name=X");
    expect(url).toContain("archived=false");
    expect(url).toContain("page=2");
    expect(out[0]?.id).toBe("p1");
  });

  it("getProject GETs the project by id", async () => {
    server.use(
      http.get("https://api.test/api/v1/workspaces/w1/projects/p1", () =>
        HttpResponse.json({ id: "p1", name: "X" })
      )
    );
    const out = await getProject(createClient(cfg), "w1", "p1");
    expect(out.id).toBe("p1");
  });

  it("createProject POSTs the body", async () => {
    let body: unknown = null;
    server.use(
      http.post("https://api.test/api/v1/workspaces/w1/projects", async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ id: "p2", name: "New" });
      })
    );
    const out = await createProject(createClient(cfg), "w1", {
      name: "New",
      clientId: "c1",
      billable: true
    });
    expect(out.id).toBe("p2");
    expect(body).toMatchObject({ name: "New", clientId: "c1", billable: true });
  });
});
