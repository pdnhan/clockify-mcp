import type { Client } from "../clockify/client.js";
import { getCurrentUser } from "../clockify/endpoints/users.js";
import type { User } from "../clockify/types.js";

export type UserCache = { get(): Promise<User> };

export function createUserCache(client: Client): UserCache {
  let pending: Promise<User> | null = null;
  let cached: User | null = null;
  return {
    async get(): Promise<User> {
      if (cached) return cached;
      if (pending) return pending;
      pending = getCurrentUser(client)
        .then((u) => {
          cached = u;
          return u;
        })
        .catch((e) => {
          pending = null;
          throw e;
        });
      return pending;
    }
  };
}
