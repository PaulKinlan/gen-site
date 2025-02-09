import { BaseHandler } from "@makemy/routes/base.ts";
import { extractMarkdown } from "@makemy/utils/extractMarkdown.ts";

export default new (class extends BaseHandler {
  override async get(req: Request): Promise<Response> {
    const url = new URL(req.url).searchParams.get("url");
    const response = await fetch(url);
    const rawText = await response.text();
    const { title, markdown } = extractMarkdown(rawText);
    return new Response(`# ${title}\n\n${markdown}`);
  }
})();
