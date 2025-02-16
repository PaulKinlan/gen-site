/// <reference lib="deno.unstable" />
import {
  Site,
  User,
  CustomDomain,
  ImageGenerationContext,
  PromptLog,
  UserImage,
} from "../types.ts";

const kv = await Deno.openKv();

type UrlsForSite = {
  [subdomain: string]: string[];
};
export const db = {
  async logPrompt(
    prompt: string,
    system: string,
    site: Site,
    images?: UserImage[]
  ): Promise<void> {
    const key = ["prompt_log", site.subdomain, Date.now().toString()];
    const log: PromptLog = {
      prompt,
      system,
      site,
      timestamp: new Date(),
      images,
    };

    await kv.set(key, log, {
      expireIn: 30 * 24 * 60 * 60 * 1000, // 30 days
    });
  },

  async getPromptLogs(subdomain?: string): Promise<PromptLog[]> {
    const prefix = subdomain ? ["prompt_log", subdomain] : ["prompt_log"];
    const logs: PromptLog[] = [];

    for await (const entry of kv.list<PromptLog>({ prefix })) {
      logs.push(entry.value);
    }

    return logs.sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  },

  async setSession(userId: string, sessionId: string): Promise<void> {
    await kv.set(["sessions", sessionId], userId, {
      expireIn: 1000 * 60 * 60 * 24, // 24 hours timeout
    });

    return;
  },

  async getSession(sessionId: string): Promise<string | null> {
    const result = await kv.get<string>(["sessions", sessionId]);
    return result.value;
  },

  async getSite(subdomain: string): Promise<Site | null> {
    const result = await kv.get<Site>(["sites", subdomain]);
    return result.value;
  },

  async getSites(userId: string): Promise<Site[]> {
    const result = await kv.list<Site>({ prefix: ["sites_by_user", userId] });
    const sites: Site[] = [];
    for await (const res of result) {
      sites.push(res.value as Site);
    }
    return sites;
  },

  async createSite(site: Site): Promise<void> {
    await kv.set(["sites", site.subdomain], site);
    await kv.set(["sites_by_user", site.userId, site.subdomain], site);

    // If custom domains exist, create domain mappings
    if (site.customDomains) {
      const atomic = kv.atomic();
      for (const domain of site.customDomains) {
        atomic.set(["domains", domain.host], site.subdomain);
      }
      await atomic.commit();
    }
  },

  async addCustomDomain(
    subdomain: string,
    domain: CustomDomain
  ): Promise<void> {
    const site = await this.getSite(subdomain);
    if (!site) throw new Error("Site not found");

    site.customDomains = site.customDomains || [];
    site.customDomains.push(domain);

    const atomic = kv.atomic();
    atomic
      .set(["sites", subdomain], site)
      .set(["sites_by_user", site.userId, subdomain], site)
      .set(["domains", domain.host], subdomain);

    await atomic.commit();
  },

  async addUrlToMonitor(subdomain: string, url: string) {
    const site = await this.getSite(subdomain);
    if (!site) throw new Error("Site not found");

    // URLs that we parse MUST be locked to the site to stop people trying to sneak out data from another user.

    let result = await kv.get<string[]>(["sites_urls", subdomain]);
    let urls = result.value || [];

    const urlSet = new Set(urls);
    urlSet.add(url);
    const uniqueUrls = Array.from(urlSet);

    await kv.set(["sites_urls", subdomain], uniqueUrls);
  },

  async addSiteImageInformation(
    subdomain: string,
    context: ImageGenerationContext
  ) {
    const site = await this.getSite(subdomain);
    if (!site) throw new Error("Site not found");

    await kv.set(["sites_images", subdomain, context.path], context);
  },

  async getSiteImageInformation(
    subdomain: string,
    path: string
  ): Promise<ImageGenerationContext | null> {
    const site = await this.getSite(subdomain);
    if (!site) throw new Error("Site not found");

    return (await kv.get(["sites_images", subdomain, path]))
      .value as ImageGenerationContext;
  },

  async getAllUrlsToMonitor(): Promise<UrlsForSite> {
    const result = await kv.list<string[]>({ prefix: ["sites_urls"] });

    const results: UrlsForSite = {};

    for await (const res of result) {
      if (res.key.length > 2) {
        console.log("Invalid key", res.key);
        await kv.delete(res.key);
        continue;
      }
      results[res.key[1] as string] = res.value;
    }

    return results || [];
  },

  async removeUrlToMonitor(subdomain: string, url: string): Promise<void> {
    let result = await kv.get<string[]>(["sites_urls", subdomain]);
    const urls = result.value || [];

    const uniqueUrls = urls.filter((u) => u == url);

    if (uniqueUrls.length === 0) {
      await kv.delete(["sites_urls", subdomain]);
    } else {
      await kv.set(["sites_urls", subdomain], uniqueUrls);
    }
  },

  async getAllExtractedMarkdown(
    subdomain: string
  ): Promise<{ url: string; markdown: string }[]> {
    const result = await kv.list<string>({
      prefix: ["sites_extracted_markdown", subdomain],
    });

    const results: { url: string; markdown: string }[] = [];

    for await (const res of result) {
      results.push({ url: res.key[2] as string, markdown: res.value });
    }

    return results;
  },

  async getExtractedMarkdown(
    subdomain: string,
    url: string
  ): Promise<string | null> {
    const result = await kv.get<string>([
      "sites_extracted_markdown",
      subdomain,
      url,
    ]);
    return result.value;
  },

  async setExtractedMarkdown(subdomain: string, url: string, markdown: string) {
    await kv.set(["sites_extracted_markdown", subdomain, url], markdown);
    return;
  },

  async removeCustomDomain(subdomain: string, host: string): Promise<void> {
    const site = await this.getSite(subdomain);
    if (!site) throw new Error("Site not found");
    if (!site.customDomains) return;

    site.customDomains = site.customDomains.filter((d) => d.host !== host);

    const atomic = kv.atomic();
    atomic
      .set(["sites", subdomain], site)
      .set(["sites_by_user", site.userId, subdomain], site)
      .delete(["domains", host]);

    await atomic.commit();
  },

  async getSiteByDomain(host: string): Promise<Site | null> {
    const subdomain = await kv.get<string>(["domains", host]);
    if (!subdomain.value) return null;
    return this.getSite(subdomain.value);
  },

  async deleteSite(subdomain: string, userId: string): Promise<void> {
    const site = await this.getSite(subdomain);
    if (!site || site.userId !== userId) {
      throw new Error("Site not found or unauthorized");
    }

    // Also delete any custom domain mappings
    if (site.customDomains) {
      const atomic = kv.atomic();
      for (const domain of site.customDomains) {
        atomic.delete(["domains", domain.host]);
      }
      atomic
        .delete(["sites", subdomain])
        .delete(["sites_urls", subdomain])
        .delete(["sites_by_user", userId, subdomain]);
      await atomic.commit();
    } else {
      const atomic = kv.atomic();
      atomic
        .delete(["sites", subdomain])
        .delete(["sites_urls", subdomain])
        .delete(["sites_by_user", userId, subdomain]);
      await atomic.commit();
    }
  },

  async createUser(user: User): Promise<void> {
    const [usernameExists, emailExists] = await Promise.all([
      kv.get<string>(["usernames", user.username]),
      kv.get<string>(["emails", user.email]),
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
    const result = await kv.get<User>(["users", id]);
    return result.value;
  },

  async getUserByUsername(username: string): Promise<User | null> {
    const userId = await kv.get<string>(["usernames", username]);
    if (!userId.value) return null;
    const user = await kv.get<User>(["users", userId.value]);
    return user.value;
  },

  async getUserByEmail(email: string): Promise<User | null> {
    const userId = await kv.get<string>(["emails", email]);
    if (!userId.value) return null;
    const user = await kv.get<User>(["users", userId.value]);
    return user.value;
  },

  // User Images
  async saveUserImage(image: UserImage): Promise<void> {
    await kv.set(["user_images", image.subdomain, image.id], image);
  },

  async getUserImage(
    subdomain: string,
    imageId: string
  ): Promise<UserImage | null> {
    const result = await kv.get<UserImage>(["user_images", subdomain, imageId]);
    return result.value;
  },

  async getUserImages(subdomain: string): Promise<UserImage[]> {
    const images: UserImage[] = [];
    const iter = kv.list<UserImage>({
      prefix: ["user_images", subdomain],
    });
    for await (const entry of iter) {
      images.push(entry.value);
    }
    return images.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  },

  async deleteUserImage(subdomain: string, imageId: string): Promise<void> {
    const image = await this.getUserImage(subdomain, imageId);
    if (!image) return;

    const atomic = kv.atomic();
    atomic.delete(["user_images", subdomain, imageId]);
    await atomic.commit();
  },
};
