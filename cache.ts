export class Cache {
  private store = new Map<string, { content: string; timestamp: number }>();
  private TTL = 1000 * 60 * 5; // 5 minutes

  set(key: string, value: string): void {
    this.store.set(key, { content: value, timestamp: Date.now() });
  }

  get(key: string): string | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > this.TTL) {
      this.store.delete(key);
      return null;
    }
    return entry.content;
  }
}
