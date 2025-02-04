import { BaseHandler } from "../../base.ts";
import { Site } from "../../../types.ts";
import { db } from "../../../db.ts";
import { authenticated } from "../../decorators/authenticated.ts";
import { escapeHtml } from "https://deno.land/x/escape/mod.ts";

const template = (site: Site | null, error?: string) => `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Edit Site - makemy.blog</title>
    <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gray-50 h-dvh flex flex-col">
    <nav class="bg-white shadow-sm">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8>
            <div class="flex justify-between h-16">
                <div class="flex-shrink-0 flex items-center">
                    <a href="/admin" class="text-xl font-bold">makemy.blog</a>
                </div>
                <div class="flex items-center space-x-4">
                    <a href="/logout" class="text-gray-600 hover:text-gray-900">Logout</a>
                </div>
            </div>
        </div>
    </nav>

    <div class="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8 h-full w-full">
        <div class="px-4 py-6 sm:px-0 h-full">
            ${
              error
                ? `<div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
                <span class="block sm:inline">${escapeHtml(error)}</span>
            </div>`
                : ""
            }
            
            ${
              site
                ? `
            <div class="border-4 border-dashed border-gray-200 rounded-lg p-6 flex flex-col h-full">
                <h2 class="text-2xl font-bold mb-6">Edit Site: ${escapeHtml(
                  site.subdomain
                )}</h2>
                <form class="space-y-3 flex flex-col grow" method="post">
                    <input type="hidden" name="subdomain" value="${escapeHtml(
                      site.subdomain
                    )}">
                    
                    <div>
                        <label class="block text-sm font-medium text-gray-700">
                            Preview URL
                        </label>
                        <div class="mt-1">
                            <a href="https://${escapeHtml(
                              site.subdomain
                            )}.itsmy.blog" target="_blank" 
                               class="text-blue-600 hover:text-blue-800 underline">
                                ${escapeHtml(site.subdomain)}.itsmy.blog
                            </a>
                        </div>
                    </div>

                    <div class="flex flex-col grow h-full">
                        <label class="block text-sm font-medium text-gray-700">
                            Site Prompt
                        </label>
                        <div class="mt-1 flex flex-col grow h-full">
                            <textarea id="prompt" name="prompt" rows="4" required
                                class="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm 
                                focus:ring-blue-500 focus:border-blue-500 sm:text-sm grow h-full"
                                placeholder="Describe how your site should be generated...">${escapeHtml(
                                  site.prompt
                                )}</textarea>
                        </div>
                    </div>

                    <div class="flex justify-between">
                        <a href="/admin" 
                           class="inline-flex justify-center py-2 px-4 border border-gray-300 shadow-sm text-sm 
                                  font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 
                                  focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                            Cancel
                        </a>
                        <button type="submit"
                            class="inline-flex justify-center py-2 px-4 border border-transparent 
                            rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 
                            hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 
                            focus:ring-blue-500">
                            Save Changes
                        </button>
                    </div>
                </form>
            </div>
            `
                : `
            <div class="text-center py-12">
                <h3 class="text-xl text-gray-900">Site not found</h3>
                <div class="mt-6">
                    <a href="/admin" class="text-blue-600 hover:text-blue-800">Return to Admin Dashboard</a>
                </div>
            </div>
            `
            }
        </div>
    </div>
</body>
</html>`;

export default new (class extends BaseHandler {
  @authenticated({ redirect: "/login" })
  async get(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const subdomain = url.searchParams.get("subdomain");

    if (!subdomain) {
      return Response.redirect("/admin", 302);
    }

    const site = await db.getSite(subdomain);

    // Verify the site belongs to the user
    if (site && site.userId !== req.extraInformation?.userId) {
      return new Response(
        template(null, "You don't have permission to edit this site"),
        {
          status: 403,
          headers: { "Content-Type": "text/html" },
        }
      );
    }

    return new Response(template(site), {
      headers: { "Content-Type": "text/html" },
    });
  }

  @authenticated({ redirect: "/login" })
  async post(req: Request): Promise<Response> {
    const baseUrl = new URL(req.url);
    let data: FormData | null = null;
    try {
      data = await req.formData();
      const subdomain = data.get("subdomain")?.toString();
      const prompt = data.get("prompt")?.toString();

      if (!subdomain || !prompt) {
        throw new Error("Missing required fields");
      }

      const existingSite = await db.getSite(subdomain);

      if (!existingSite) {
        throw new Error("Site not found");
      }

      if (existingSite.userId !== req.extraInformation?.userId) {
        throw new Error("You don't have permission to edit this site");
      }

      const site: Site = {
        ...existingSite,
        prompt: prompt.toString(),
      };

      await db.createSite(site); // This will overwrite the existing site
      baseUrl.pathname = "/admin";
      return Response.redirect(baseUrl, 303);
    } catch (error) {
      const site = await db.getSite("");
      return new Response(template(site, error.message), {
        status: 400,
        headers: { "Content-Type": "text/html" },
      });
    }
  }
})();
