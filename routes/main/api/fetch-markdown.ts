import { load } from "npm:cheerio";
import TurndownService from "npm:turndown";
import { BaseHandler } from "@makemy/routes/base.ts";

export default new (class extends BaseHandler {
  override async get(req: Request): Promise<Response> {
    const url = new URL(req.url).searchParams.get("url");
    const response = await fetch(url);
    const turndown = new TurndownService();
    const html = await response.text();
    const $ = load(html);

    const title = $("title").first().text();
    const bodyText = $("body").first().html();

    turndown.addRule("no-style", {
      filter: ["style", "script", "footer", "iframe", "head", "img"],
      replacement: function (content) {
        return "";
      },
    });

    turndown.addRule("no-link", {
      filter: ["a"],
      replacement: function (content) {
        return content;
      },
    });

    const markdown = turndown.turndown(bodyText);
    return new Response(`# ${title}\n\n${markdown}`);
  }
})();
