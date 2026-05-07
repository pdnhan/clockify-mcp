// tests/lib/errors.test.ts
import { describe, it, expect } from "vitest";
import { ClockifyError, toMcpErrorMessage } from "../../src/lib/errors.js";

describe("ClockifyError", () => {
  it("captures status, code, and message", () => {
    const e = new ClockifyError(404, "RESOURCE_NOT_FOUND", "Project not found");
    expect(e.status).toBe(404);
    expect(e.code).toBe("RESOURCE_NOT_FOUND");
    expect(e.message).toBe("Project not found");
    expect(e instanceof Error).toBe(true);
  });
});

describe("toMcpErrorMessage", () => {
  it("rewrites 401 to an auth-key hint", () => {
    const msg = toMcpErrorMessage(new ClockifyError(401, null, "unauthorized"));
    expect(msg).toMatch(/CLOCKIFY_API_KEY/);
  });

  it("rewrites 403 to an auth-key hint", () => {
    const msg = toMcpErrorMessage(new ClockifyError(403, null, "forbidden"));
    expect(msg).toMatch(/CLOCKIFY_API_KEY/);
  });

  it("preserves the upstream code and message for other errors", () => {
    const msg = toMcpErrorMessage(new ClockifyError(404, "NOT_FOUND", "no such project"));
    expect(msg).toBe("Clockify 404 NOT_FOUND: no such project");
  });

  it("falls back to status only when code is missing", () => {
    const msg = toMcpErrorMessage(new ClockifyError(500, null, "boom"));
    expect(msg).toBe("Clockify 500: boom");
  });
});
