import { db } from "../../../db.ts";
import { BaseHandler } from "../../base.ts";
import { generate } from "random-words";

const generateUniqueName = async (): Promise<string> => {
  let subdomain;
  do {
    const threeWords = generate(3);
    subdomain = threeWords.join("-");
  } while (await db.getSite(subdomain));
  return subdomain;
};

export default new (class extends BaseHandler {
  async get(req: Request): Promise<Response> {
    const subdomain = await generateUniqueName();
    return new Response(JSON.stringify({ subdomain }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }
})();
