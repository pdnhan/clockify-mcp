import { describe, it, expect } from "vitest";
import { server, http, HttpResponse } from "../../helpers/mockServer.js";
import { createClient } from "../../../src/clockify/client.js";
import { listTasks, createTask } from "../../../src/clockify/endpoints/tasks.js";

const cfg = {
  apiKey: "k",
  baseUrl: "https://api.test/api/v1",
  reportsBaseUrl: "https://reports.test/v1"
};

describe("tasks", () => {
  it("listTasks GETs the tasks endpoint with filters", async () => {
    let url: string | null = null;
    server.use(
      http.get(
        "https://api.test/api/v1/workspaces/w1/projects/p1/tasks",
        ({ request }) => {
          url = request.url;
          return HttpResponse.json([{ id: "t1", name: "x", projectId: "p1" }]);
        }
      )
    );
    await listTasks(createClient(cfg), "w1", "p1", { name: "x", status: "ACTIVE" });
    expect(url).toContain("name=x");
    expect(url).toContain("status=ACTIVE");
  });

  it("createTask POSTs the body", async () => {
    let body: unknown = null;
    server.use(
      http.post(
        "https://api.test/api/v1/workspaces/w1/projects/p1/tasks",
        async ({ request }) => {
          body = await request.json();
          return HttpResponse.json({ id: "t1", name: "Build", projectId: "p1" });
        }
      )
    );
    const out = await createTask(createClient(cfg), "w1", "p1", {
      name: "Build",
      assigneeIds: ["u1"]
    });
    expect(out.id).toBe("t1");
    expect(body).toMatchObject({ name: "Build", assigneeIds: ["u1"] });
  });
});
