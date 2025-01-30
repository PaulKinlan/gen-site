import { create, verify } from "https://deno.land/x/djwt@v3.0.1/mod.ts";
import { db } from "./db.ts";

const key = await crypto.subtle.generateKey(
  { name: "HMAC", hash: "SHA-512" },
  true,
  ["sign", "verify"]
);

export const auth = {
  async createToken(userId: string): Promise<string> {
    return await create({ alg: "HS512", typ: "JWT" }, { sub: userId }, key);
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
