import { BaseHandler } from "../../../routes/base.ts";
import { db } from "../../../db.ts";

export default new (class extends BaseHandler {
  override async get(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const name = url.searchParams.get("name");

    if (!name) {
      return new Response(
        JSON.stringify({ error: "Name parameter is required" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Validate if the subdomain would form a valid URL
    if (!URL.canParse(`https://${name}.itsmy.blog`)) {
      return new Response(
        JSON.stringify({ available: false, error: "Invalid subdomain" }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const site = await db.getSite(name);
    const available = !site;

    return new Response(JSON.stringify({ available, error: null }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }
})();
