import { describe, it, expect, vi } from "vitest";
import { createUserCache } from "../../src/lib/userCache.js";
import type { User } from "../../src/clockify/types.js";
import type { Client } from "../../src/clockify/client.js";

function fakeClient(user: User): { client: Client; calls: { n: number } } {
  const calls = { n: 0 };
  const client: Client = {
    async request() {
      calls.n += 1;
      return user as unknown;
    }
  };
  return { client, calls };
}

describe("createUserCache", () => {
  it("fetches the user once and caches subsequent calls", async () => {
    const { client, calls } = fakeClient({ id: "u1" });
    const cache = createUserCache(client);
    expect((await cache.get()).id).toBe("u1");
    expect((await cache.get()).id).toBe("u1");
    expect(calls.n).toBe(1);
  });

  it("dedupes concurrent first calls", async () => {
    const { client, calls } = fakeClient({ id: "u1" });
    const cache = createUserCache(client);
    await Promise.all([cache.get(), cache.get(), cache.get()]);
    expect(calls.n).toBe(1);
  });

  it("re-fetches if the first call rejected", async () => {
    let n = 0;
    const client: Client = {
      async request() {
        n += 1;
        if (n === 1) throw new Error("boom");
        return { id: "u1" } as unknown;
      }
    };
    const cache = createUserCache(client);
    await expect(cache.get()).rejects.toThrow("boom");
    expect((await cache.get()).id).toBe("u1");
    expect(n).toBe(2);
  });
});
