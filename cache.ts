interface CacheEntry {
  content: string;
  timestamp: number;
}

export class Cache {
  private kv: Deno.Kv;
  private TTL: number;
  private PREFIX = "cache:";

  constructor(ttl = 1000 * 60 * 5) {
    // Default 5 minutes
    this.TTL = ttl;
  }

  async init() {
    this.kv = await Deno.openKv();
  }

  async set(key: string, value: string): Promise<void> {
    const entry: CacheEntry = {
      content: value,
      timestamp: Date.now(),
    };
    await this.kv.set([this.PREFIX, key], entry, { expireIn: this.TTL });
  }

  async get(key: string): Promise<string | null> {
    const result = await this.kv.get<CacheEntry>([this.PREFIX, key]);

    if (!result.value) return null;

    if (Date.now() - result.value.timestamp > this.TTL) {
      await this.kv.delete([this.PREFIX, key]);
      return null;
    }

    return result.value.content;
  }
}
