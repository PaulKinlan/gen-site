import { Site, User } from "./types.ts";

const kv = await Deno.openKv();

export const db = {
  async getUser(email: string): Promise<User | null> {
    const result = await kv.get(["users", email]);
    return result.value as User | null;
  },

  async getSite(subdomain: string): Promise<Site | null> {
    const result = await kv.get(["sites", subdomain]);
    return result.value as Site | null;
  },

  async createSite(site: Site): Promise<void> {
    await kv.set(["sites", site.subdomain], site);
    await kv.set(["sites_by_user", site.userId, site.subdomain], site);
  },

  async createUser(user: User): Promise<void> {
    const [usernameExists, emailExists] = await Promise.all([
      kv.get(["usernames", user.username]),
      kv.get(["emails", user.email]),
    ]);

    if (usernameExists.value || emailExists.value) {
      throw new Error("Username or email already exists");
    }

    const atomic = kv.atomic();
    atomic
      .set(["users", user.id], user)
      .set(["usernames", user.username], user.id)
      .set(["emails", user.email], user.id);

    await atomic.commit();
  },

  async getUserByEmail(email: string): Promise<User | null> {
    const userId = await kv.get(["emails", email]);
    if (!userId.value) return null;
    const user = await kv.get(["users", userId.value]);
    return user.value as User;
  },
};
