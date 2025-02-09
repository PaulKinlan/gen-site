import TurndownService from "npm:turndown";
import { load } from "cheerio";

export function extractMarkdown(html: string) {
  const turndown = new TurndownService();
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
  return { title, markdown };
}
