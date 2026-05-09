import { describe, it, expect, beforeEach } from "vitest";
import { loadConfig } from "../../src/config.js";

describe("loadConfig", () => {
  beforeEach(() => {
    delete process.env.CLOCKIFY_API_KEY;
    delete process.env.CLOCKIFY_WORKSPACE_ID;
    delete process.env.CLOCKIFY_BASE_URL;
    delete process.env.CLOCKIFY_REPORTS_BASE_URL;
    delete process.env.PORT;
    delete process.env.LOG_LEVEL;
  });

  it("returns parsed config when required vars are set", () => {
    process.env.CLOCKIFY_API_KEY = "k";
    process.env.CLOCKIFY_WORKSPACE_ID = "w";
    const cfg = loadConfig();
    expect(cfg.apiKey).toBe("k");
    expect(cfg.workspaceId).toBe("w");
    expect(cfg.baseUrl).toBe("https://api.clockify.me/api/v1");
    expect(cfg.reportsBaseUrl).toBe("https://reports.api.clockify.me/v1");
    expect(cfg.port).toBe(3000);
    expect(cfg.logLevel).toBe("info");
  });

  it("throws with the missing var name when CLOCKIFY_API_KEY is absent", () => {
    process.env.CLOCKIFY_WORKSPACE_ID = "w";
    expect(() => loadConfig()).toThrow(/CLOCKIFY_API_KEY/);
  });

  it("throws with the missing var name when CLOCKIFY_WORKSPACE_ID is absent", () => {
    process.env.CLOCKIFY_API_KEY = "k";
    expect(() => loadConfig()).toThrow(/CLOCKIFY_WORKSPACE_ID/);
  });

  it("accepts optional overrides", () => {
    process.env.CLOCKIFY_API_KEY = "k";
    process.env.CLOCKIFY_WORKSPACE_ID = "w";
    process.env.CLOCKIFY_BASE_URL = "https://euc1.api.clockify.me/api/v1";
    process.env.PORT = "4000";
    process.env.LOG_LEVEL = "debug";
    const cfg = loadConfig();
    expect(cfg.baseUrl).toBe("https://euc1.api.clockify.me/api/v1");
    expect(cfg.port).toBe(4000);
    expect(cfg.logLevel).toBe("debug");
  });

  it("rejects an invalid LOG_LEVEL", () => {
    process.env.CLOCKIFY_API_KEY = "k";
    process.env.CLOCKIFY_WORKSPACE_ID = "w";
    process.env.LOG_LEVEL = "verbose";
    expect(() => loadConfig()).toThrow(/LOG_LEVEL/);
  });

  it("rejects an invalid CLOCKIFY_BASE_URL", () => {
    process.env.CLOCKIFY_API_KEY = "k";
    process.env.CLOCKIFY_WORKSPACE_ID = "w";
    process.env.CLOCKIFY_BASE_URL = "not-a-url";
    expect(() => loadConfig()).toThrow(/CLOCKIFY_BASE_URL/);
  });

  it("rejects an empty CLOCKIFY_API_KEY", () => {
    process.env.CLOCKIFY_API_KEY = "";
    process.env.CLOCKIFY_WORKSPACE_ID = "w";
    expect(() => loadConfig()).toThrow(/CLOCKIFY_API_KEY/);
  });

  it("accepts PORT=0 (ephemeral binding)", () => {
    process.env.CLOCKIFY_API_KEY = "k";
    process.env.CLOCKIFY_WORKSPACE_ID = "w";
    process.env.PORT = "0";
    const cfg = loadConfig();
    expect(cfg.port).toBe(0);
  });

  it("rejects negative / non-integer / non-numeric PORT values", () => {
    process.env.CLOCKIFY_API_KEY = "k";
    process.env.CLOCKIFY_WORKSPACE_ID = "w";
    for (const bad of ["-1", "3.14", "abc"]) {
      process.env.PORT = bad;
      expect(() => loadConfig(), `PORT=${bad}`).toThrow(/PORT/);
    }
  });
});
