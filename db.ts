import { Site, User } from "./types.ts";

const kv = await Deno.openKv();

export const db = {
  async setSession(userId: string, sessionId: string): Promise<void> {
    await kv.set(["sessions", sessionId], userId, {
      expireIn: 1000 * 60 * 60 * 24, // 24 hours timeout
    });

    return;
  },

  async getSession(sessionId: string): Promise<string | null> {
    const result = await kv.get(["sessions", sessionId]);
    return result.value as string | null;
  },

  async getSite(subdomain: string): Promise<Site | null> {
    const result = await kv.get(["sites", subdomain]);
    return result.value as Site | null;
  },

  async getSites(userId: string): Promise<Site[]> {
    const result = await kv.list({ prefix: ["sites_by_user", userId] });
    const sites: Site[] = [];
    for await (const res of result) {
      sites.push(res.value);
    }
    return sites;
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

  async getUserById(id: string): Promise<User | null> {
    const result = await kv.get(["users", id]);
    return result.value as User | null;
  },

  async getUserByUsername(username: string): Promise<User | null> {
    const userId = await kv.get(["usernames", username]);
    if (!userId.value) return null;
    const user = await kv.get(["users", userId.value]);
    return user.value as User;
  },

  async getUserByEmail(email: string): Promise<User | null> {
    const userId = await kv.get(["emails", email]);
    if (!userId.value) return null;
    const user = await kv.get(["users", userId.value]);
    return user.value as User;
  },
};
