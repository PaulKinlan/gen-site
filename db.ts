import { Site, User } from "./types.ts";

const kv = await Deno.openKv();

export const db = {
  async getUser(email: string): Promise<User | null> {
    const result = await kv.get(["users", email]);
    return result.value as User | null;
  },

  async createUser(user: User): Promise<void> {
    await kv.set(["users", user.email], user);
    await kv.set(["users_by_id", user.id], user);
  },

  async getSite(subdomain: string): Promise<Site | null> {
    const result = await kv.get(["sites", subdomain]);
    return result.value as Site | null;
  },

  async createSite(site: Site): Promise<void> {
    await kv.set(["sites", site.subdomain], site);
    await kv.set(["sites_by_user", site.userId, site.subdomain], site);
  },
};
