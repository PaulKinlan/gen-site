interface CacheEntry {
  content: string;
  timestamp: number;
}

export type CacheLine = {
  path: string;
  value: CacheEntry;
};

export class Cache {
  private kv?: Deno.Kv;
  private TTL: number;
  private PREFIX = "cache:";

  constructor(ttl = 1000 * 60 * 5) {
    // Default 5 minutes
    this.TTL = ttl;
  }

  async init() {
    this.kv = await Deno.openKv();
  }

  async set(key: string[], value: string): Promise<void> {
    if (!this.kv) {
      throw new Error("Cache not initialized. Call init() first.");
    }
    const entry: CacheEntry = {
      content: "using cache API",
      timestamp: Date.now(),
    };
    await this.kv.set([this.PREFIX, ...key], entry);
  }

  async get(key: string[]): Promise<string | null> {
    if (!this.kv) {
      throw new Error("Cache not initialized. Call init() first.");
    }
    const result = await this.kv.get<CacheLine>([this.PREFIX, ...key]);

    if (!result.value) return null;

    return result.value.value.content;
  }

  async getMatching(origin: string): Promise<CacheLine[] | null> {
    if (!this.kv) {
      throw new Error("Cache not initialized. Call init() first.");
    }
    const iter = await this.kv.list<CacheEntry>({
      prefix: [this.PREFIX, origin],
    });

    if (!iter) return null;

    const matchingResponses: CacheLine[] = [];

    for await (const res of iter) {
      console.log("res", res);
      matchingResponses.push({
        path: res.key.slice(2).join("/"),
        value: res.value,
      });
    }

    console.log(matchingResponses);

    return matchingResponses;
  }

  async delete(key: string): Promise<void> {
    if (!this.kv) {
      throw new Error("Cache not initialized. Call init() first.");
    }
    await this.kv.delete([this.PREFIX, key]);
  }
}
