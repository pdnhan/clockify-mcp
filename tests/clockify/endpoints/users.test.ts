import { describe, it, expect } from "vitest";
import { server, http, HttpResponse } from "../../helpers/mockServer.js";
import { createClient } from "../../../src/clockify/client.js";
import { getCurrentUser } from "../../../src/clockify/endpoints/users.js";

const cfg = {
  apiKey: "k",
  baseUrl: "https://api.test/api/v1",
  reportsBaseUrl: "https://reports.test/v1"
};

describe("getCurrentUser", () => {
  it("GETs /user and parses the result", async () => {
    server.use(
      http.get("https://api.test/api/v1/user", () =>
        HttpResponse.json({ id: "u1", email: "a@b", defaultWorkspace: "w1" })
      )
    );
    const client = createClient(cfg);
    const user = await getCurrentUser(client);
    expect(user.id).toBe("u1");
    expect(user.defaultWorkspace).toBe("w1");
  });
});
