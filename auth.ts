import { create, verify } from "https://deno.land/x/djwt@v3.0.1/mod.ts";

const key = await crypto.subtle.generateKey(
  { name: "HMAC", hash: "SHA-512" },
  true,
  ["sign", "verify"]
);

export const auth = {
  async createToken(userId: string): Promise<string> {
    return await create({ alg: "HS512", typ: "JWT" }, { sub: userId }, key);
  },

  async hashPassword(password: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hash = await crypto.subtle.digest("SHA-512", data);
    return Array.from(new Uint8Array(hash))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  },

  async verifyToken(token: string): Promise<string | null> {
    try {
      const payload = await verify(token, key);
      return payload.sub as string;
    } catch {
      return null;
    }
  },
};
