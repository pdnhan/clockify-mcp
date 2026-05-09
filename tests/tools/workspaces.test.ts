import { describe, it, expect } from "vitest";
import { workspacesTools } from "../../src/tools/workspaces.js";
import type { ToolContext } from "../../src/tools/index.js";
import type { Client } from "../../src/clockify/client.js";

function ctx(client: Client): ToolContext {
  return {
    client,
    config: {
      apiKey: "k",
      workspaceId: "wDefault",
      baseUrl: "https://api.test/api/v1",
      reportsBaseUrl: "https://reports.test/v1",
      port: 3000,
      logLevel: "info"
    },
    userCache: { async get() { return { id: "u1", defaultWorkspace: "wDefault" }; } }
  };
}

describe("workspacesTools", () => {
  it("get_current_user returns the cached user", async () => {
    const client: Client = { async request() { throw new Error("should not call"); } };
    const tools = workspacesTools(ctx(client));
    const out = await tools.get_current_user.handler({});
    expect(out).toEqual({ id: "u1", defaultWorkspace: "wDefault" });
  });

  it("list_workspaces calls the endpoint", async () => {
    let called = false;
    const client: Client = {
      async request(args) {
        called = true;
        expect(args.path).toBe("/workspaces");
        return [{ id: "w1", name: "Acme" }];
      }
    };
    const tools = workspacesTools(ctx(client));
    const out = (await tools.list_workspaces.handler({})) as Array<{ id: string }>;
    expect(called).toBe(true);
    expect(out[0]?.id).toBe("w1");
  });
});
