import { BaseHandler } from "../base.ts";
import { Site } from "../../types.ts";
import { db } from "../../db.ts";
import { authenticated } from "../decorators/authenticated.ts";
import { escapeHtml } from "https://deno.land/x/escape/mod.ts";
import { generatePrompt } from "./admin/resources/prompts.ts";

const template = (sites: Site[]) => `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Admin Dashboard - makemy.blog</title>
    <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gray-50 h-dvh flex flex-col">
    <nav class="bg-white shadow-sm">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div class="flex justify-between h-16">
                <div class="flex-shrink-0 flex items-center">
                    <a href="/" class="text-xl font-bold">makemy.blog</a>
                </div>
                <div class="flex items-center space-x-4">
                    <a href="/logout" class="text-gray-600 hover:text-gray-900">Logout</a>
                </div>
            </div>
        </div>
    </nav>

    <div class="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8 h-full w-full">
        <div class="px-4 py-6 sm:px-0 h-full">
            <div class="border-4 border-dashed border-gray-200 rounded-lg p-6 flex flex-col h-full">
                <h2 class="text-2xl font-bold mb-6">Create New Site</h2>
                <form id="create-site-form" class="space-y-3 flex flex-col grow" method="post" enctype="multipart/form-data">
                    <div>
                        <label class="block text-sm font-medium text-gray-700">
                            Site Name
                        </label>
                        <div class="mt-1 flex">
                            <input type="text" id="subdomain" name="subdomain" readonly
                                class="flex-1 block w-full px-3 py-2 border border-gray-300 rounded-md 
                                shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm">
                            <button type="button" id="generate-name"
                                class="ml-3 inline-flex items-center px-4 py-2 border border-transparent 
                                text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700">
                                Generate
                            </button>
                        </div>
                    </div>

                    <div class="flex flex-col grow">
                        <label class="block text-sm font-medium text-gray-700">
                            Site Prompt
                        </label>
                        <div class="mt-1 grow h-full">
                            <textarea id="prompt" name="prompt" rows="4" required
                                class="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm 
                                focus:ring-blue-500 focus:border-blue-500 sm:text-sm grow h-full"
                                placeholder="${escapeHtml(
                                  generatePrompt()
                                )}"></textarea>
                        </div>
                    </div>

                    <div>
                        <button type="submit"
                            class="w-full flex justify-center py-2 px-4 border border-transparent 
                            rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 
                            hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 
                            focus:ring-blue-500">
                            Create Site
                        </button>
                    </div>
                </form>

                <br>
                <hr>
                <br>

                <h2 class="text-2xl font-bold mb-6">Your Sites</h2>

                ${sites
                  .map(
                    (site) => `
                   
                      <div>
                        <div class="mt-1">
                          <div class="flex justify-between items-center">
                            <p><a href="https://${site.subdomain}.itsmy.blog" target="_blank" class="text-blue-600 hover:text-blue-800 underline">${site.subdomain}.itsmy.blog</a></p>
                            <a href="/admin/edit?subdomain=${site.subdomain}" class="text-blue-600 hover:text-blue-800">Edit</a>
                          </div>
                        </div>
                        </div>`
                  )
                  .join("")}
            </div>
        </div>
    </div>

    <script>
    document.getElementById('generate-name').addEventListener('click', async () => {
        const response = await fetch('/api/generate-name');
        const { subdomain } = await response.json();
        document.getElementById('subdomain').value = subdomain;
    });
    </script>
</body>
</html>`;

export default new (class extends BaseHandler {
  @authenticated({ redirect: "/login" })
  async get(req: Request): Promise<Response> {
    const sites = await db.getSites(req.extraInformation?.userId || "");

    return new Response(template(sites), {
      headers: { "Content-Type": "text/html" },
    });
  }

  @authenticated({ redirect: "/login" })
  async post(req: Request): Promise<Response> {
    // Get the auth cookie.
    try {
      const data = await req.formData();
      const subdomain = data.get("subdomain")?.toString();
      const prompt = data.get("prompt")?.toString();

      if (!subdomain || !prompt) {
        throw new Error("Missing required fields");
      }

      const site: Site = {
        subdomain,
        prompt,
        userId: req.extraInformation?.userId || "", // Assuming auth middleware sets this
      };

      await db.createSite(site);
      return Response.redirect(req.url, 303);
    } catch (error) {
      return new Response(error.message, { status: 400 });
    }
  }
})();
