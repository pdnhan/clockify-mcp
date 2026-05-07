// tests/clockify/client.test.ts
import { describe, it, expect } from "vitest";
import { server, http, HttpResponse } from "../helpers/mockServer.js";
import { createClient } from "../../src/clockify/client.js";
import { ClockifyError } from "../../src/lib/errors.js";

const config = {
  apiKey: "test-key",
  baseUrl: "https://api.test/api/v1",
  reportsBaseUrl: "https://reports.test/v1"
};

describe("createClient", () => {
  it("sends X-Api-Key header on every request", async () => {
    let received: string | null = null;
    server.use(
      http.get("https://api.test/api/v1/user", ({ request }) => {
        received = request.headers.get("X-Api-Key");
        return HttpResponse.json({ id: "u1" });
      })
    );
    const client = createClient(config);
    await client.request({ host: "api", method: "GET", path: "/user" });
    expect(received).toBe("test-key");
  });

  it("uses baseUrl when host is 'api'", async () => {
    server.use(
      http.get("https://api.test/api/v1/workspaces", () =>
        HttpResponse.json([{ id: "w1" }])
      )
    );
    const client = createClient(config);
    const out = await client.request<Array<{ id: string }>>({
      host: "api",
      method: "GET",
      path: "/workspaces"
    });
    expect(out).toEqual([{ id: "w1" }]);
  });

  it("uses reportsBaseUrl when host is 'reports'", async () => {
    server.use(
      http.post("https://reports.test/v1/workspaces/w1/reports/summary", () =>
        HttpResponse.json({ totals: [] })
      )
    );
    const client = createClient(config);
    const out = await client.request<{ totals: unknown[] }>({
      host: "reports",
      method: "POST",
      path: "/workspaces/w1/reports/summary",
      body: { dateRangeStart: "2026-05-01T00:00:00Z" }
    });
    expect(out.totals).toEqual([]);
  });

  it("returns the parsed JSON body on 2xx", async () => {
    server.use(
      http.get("https://api.test/api/v1/x", () =>
        HttpResponse.json({ ok: true }, { status: 200 })
      )
    );
    const client = createClient(config);
    const out = await client.request<{ ok: boolean }>({
      host: "api",
      method: "GET",
      path: "/x"
    });
    expect(out).toEqual({ ok: true });
  });

  it("returns null on 204", async () => {
    server.use(
      http.delete("https://api.test/api/v1/x/1", () => new HttpResponse(null, { status: 204 }))
    );
    const client = createClient(config);
    const out = await client.request({
      host: "api",
      method: "DELETE",
      path: "/x/1"
    });
    expect(out).toBeNull();
  });

  it("throws ClockifyError with code+message from a JSON 404", async () => {
    server.use(
      http.get("https://api.test/api/v1/x", () =>
        HttpResponse.json({ code: "NOT_FOUND", message: "nope" }, { status: 404 })
      )
    );
    const client = createClient(config);
    await expect(
      client.request({ host: "api", method: "GET", path: "/x" })
    ).rejects.toMatchObject({ status: 404, code: "NOT_FOUND", message: "nope" });
  });

  it("throws ClockifyError with null code when body is non-JSON", async () => {
    server.use(
      http.get("https://api.test/api/v1/x", () =>
        new HttpResponse("oops", { status: 500 })
      )
    );
    const client = createClient(config);
    const err = await client.request({ host: "api", method: "GET", path: "/x" }).catch(e => e);
    expect(err).toBeInstanceOf(ClockifyError);
    expect((err as ClockifyError).status).toBe(500);
    expect((err as ClockifyError).code).toBeNull();
  });

  it("appends query parameters", async () => {
    let url: string | null = null;
    server.use(
      http.get("https://api.test/api/v1/x", ({ request }) => {
        url = request.url;
        return HttpResponse.json({});
      })
    );
    const client = createClient(config);
    await client.request({
      host: "api",
      method: "GET",
      path: "/x",
      query: { page: 2, name: "foo bar" }
    });
    expect(url).toBe("https://api.test/api/v1/x?page=2&name=foo+bar");
  });

  it("sends JSON body and Content-Type when args.body is set", async () => {
    let ct: string | null = null;
    let payload: unknown = null;
    server.use(
      http.post("https://api.test/api/v1/x", async ({ request }) => {
        ct = request.headers.get("Content-Type");
        payload = await request.json();
        return HttpResponse.json({ ok: true });
      })
    );
    const client = createClient(config);
    await client.request({
      host: "api",
      method: "POST",
      path: "/x",
      body: { a: 1, nested: { b: "two" } }
    });
    expect(ct).toBe("application/json");
    expect(payload).toEqual({ a: 1, nested: { b: "two" } });
  });

  it("omits Content-Type and body when args.body is undefined", async () => {
    let ct: string | null = null;
    let raw: string | null = null;
    server.use(
      http.get("https://api.test/api/v1/x", async ({ request }) => {
        ct = request.headers.get("Content-Type");
        raw = await request.text();
        return HttpResponse.json({ ok: true });
      })
    );
    const client = createClient(config);
    await client.request({ host: "api", method: "GET", path: "/x" });
    expect(ct).toBeNull();
    expect(raw).toBe("");
  });
});
