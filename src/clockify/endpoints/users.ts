import type { Client } from "../client.js";
import { UserSchema, type User } from "../types.js";

export async function getCurrentUser(client: Client): Promise<User> {
  const data = await client.request({ host: "api", method: "GET", path: "/user" });
  return UserSchema.parse(data);
}
