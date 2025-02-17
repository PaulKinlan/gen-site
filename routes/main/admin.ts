import { BaseHandler } from "@makemy/routes/base.ts";
import { Site } from "@makemy/types.ts";
import { db } from "@makemy/core/db.ts";
import { authenticated } from "@makemy/routes/decorators/authenticated.ts";
import { escapeHtml } from "https://deno.land/x/escape/mod.ts";
import { generatePrompt } from "@makemy/routes/main/admin/resources/prompts.ts";
import { clearCacheForSite } from "@makemy/core/cache.ts";
import { getAssetContent } from "@makemy/utils/assets.ts";

const kv = await Deno.openKv();

const template = async (sites: Site[]) => {
  const siteList: string[] = [];
  for (const site of sites) {
    siteList.push(`<tr>
    <td><a href="https://${escapeHtml(
      site.subdomain
    )}.itsmy.blog" target="_blank" class="text-blue-600 hover:text-blue-800 underline">${escapeHtml(
      site.subdomain
    )}.itsmy.blog</a></td>
    <td>${site.prompt?.substring(0, 100) || ""}</td>
    <td class="text-right"><a href="/admin/edit?subdomain=${escapeHtml(
      site.subdomain
    )}" class="text-blue-600 hover:text-blue-800 inline-block">${await getAssetContent(
      "assets/images/edit.svg"
    )}</a>
        <button onclick="deleteSite('${escapeHtml(
          site.subdomain
        )}')" class="text-red-600 hover:text-red-800 inline-block">${await getAssetContent(
      "assets/images/delete.svg"
    )}</button></td>
</tr>`);
  }

  const joinedSiteList = siteList.join("\n");

  return `<!DOCTYPE html>
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
                    <a href="/admin/resources/prompt-logs" class="text-gray-600 hover:text-gray-900">Prompt Logs</a>
                    <a href="/logout" class="text-gray-600 hover:text-gray-900">Logout</a>
                </div>
            </div>
        </div>
    </nav>

    <div class="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8 h-full w-full">
        <div class="px-4 py-6 sm:px-0 h-full">
            <div class="border-4 border-dashed border-gray-200 rounded-lg p-6 flex flex-col h-full">
                <h2 class="text-2xl font-bold mb-6">Create New Site</h2>
                <dialog id="generateNameDialog" class="p-4 rounded-lg shadow-lg backdrop:bg-gray-500/50 w-1/2" aria-labelledby="generateNameDialogLabel" role="dialog" aria-modal="true">
                <h3>Choose a domain for your site</h3>  
                    <form class="space-y-3 flex flex-col grow" method="post">                      
                      <div class="mt-1 flex items-center border border-gray-300 rounded-md shadow-sm px-2 py-2 ">
                        <div class="flex-1 flex">
                            <input type="text" id="subdomain" name="subdomain"
                                class="flex-1 block w-full sm:text-sm"
                                placeholder="Enter a name or generate one" required>
                            <span id="availability-indicator" class="ml-2 hidden">
                                <span id="available" class="text-green-600 hidden">✓</span>
                                <span id="unavailable" class="text-red-600 hidden">✗</span>
                            </span>
                        </div>
                        <button type="button" id="generate-name"
                            class="ml-3 inline-flex items-center px-4 py-2 border border-transparent 
                            text-sm font-medium rounded-md text-white  bg-gray-400 hover:bg-blue-700">
                            ${await getAssetContent(
                              "assets/images/refresh.svg"
                            )}
                        </button>
                      </div>
                      <button type="submit"
                        class="w-full flex justify-center py-2 px-4 border border-transparent 
                        rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 
                        hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 
                        focus:ring-blue-500">
                        Create
                    </button>
                      <input type="hidden" name="prompt" value="">
                      </form>
                </dialog>
                <div>
                <button type="submit"
                    id="createSite"
                    class="w-full flex justify-center py-2 px-4 border border-transparent 
                    rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 
                    hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 
                    focus:ring-blue-500">
                    Create Site
                </button>
            </div>

        <h2 class="text-2xl font-bold mb-6">Your Sites</h2>
    
        <table class="table-fixed">
          <thead>
            <tr>
            <th class="text-left w-1/3">Domain</th>
            <th class="text-left">Prompt</th>
            <th class="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
              ${joinedSiteList}
          </tbody>
        </table>
        </div>
    </div>

    <script>
    let checkNameTimeout;
    let currentSubdomain;


    async function checkNameAvailability(name) {
        const indicator = document.getElementById('availability-indicator');
        const available = document.getElementById('available');
        const unavailable = document.getElementById('unavailable');
        
        if (!name) {
            indicator.classList.add('hidden');
            return;
        }

        // Check if the subdomain would form a valid URL
        try {
            new URL(\`https://\${name}.itsmy.blog\`);
        } catch {
            indicator.classList.remove('hidden');
            available.classList.add('hidden');
            unavailable.classList.remove('hidden');
            return;
        }

        try {
            const response = await fetch(\`/api/check-name?name=\${encodeURIComponent(name)}\`);
            const data = await response.json();
            
            indicator.classList.remove('hidden');
            if (data.available) {
                available.classList.remove('hidden');
                unavailable.classList.add('hidden');
            } else {
                available.classList.add('hidden');
                unavailable.classList.remove('hidden');
            }
        } catch (error) {
            console.error('Error checking name availability:', error);
            indicator.classList.add('hidden');
        }
    }

    document.getElementById('subdomain').addEventListener('input', (e) => {
        clearTimeout(checkNameTimeout);
        checkNameTimeout = setTimeout(() => {
            checkNameAvailability(e.target.value);
        }, 300);
    });

    const createSiteButton = document.getElementById('createSite');
    createSiteButton.addEventListener('click', (e) => {
      e.preventDefault();
      const dialog = document.getElementById('generateNameDialog');
      console.log(dialog);
      dialog.showModal();
      const input = dialog.querySelector('input[name="subdomain"]');
      input.focus();
    });

    document.getElementById('generate-name').addEventListener('click', async () => {
        const response = await fetch('/api/generate-name');
        const { subdomain } = await response.json();
        const input = document.getElementById('subdomain');
        input.value = subdomain;
        checkNameAvailability(subdomain);
    });

    async function deleteSite(subdomain) {
        if (!confirm('Are you sure you want to delete this site? This action cannot be undone.')) {
            return;
        }
        try {
            const response = await fetch(\`/admin?subdomain=\${subdomain}\`, {
                method: 'DELETE',
            });
            if (response.ok) {
                window.location.reload();
            } else {
                const error = await response.text();
                alert('Failed to delete site: ' + error);
            }
        } catch (error) {
            alert('Failed to delete site: ' + error.message);
        }
    }
    </script>
</body>
</html>`;
};

export default new (class extends BaseHandler {
  @authenticated({ redirect: "/login" })
  override async get(req: Request): Promise<Response> {
    const sites = await db.getSites(req.extraInformation?.userId || "");

    return new Response(await template(sites), {
      headers: { "Content-Type": "text/html" },
    });
  }

  @authenticated({ redirect: "/login" })
  override async post(req: Request): Promise<Response> {
    try {
      const data = await req.formData();
      const subdomain = data.get("subdomain")?.toString();
      const prompt = data.get("prompt")?.toString();

      if (!subdomain) {
        throw new Error("Missing required fields");
      }

      // Validate if the subdomain would form a valid URL
      if (!URL.canParse(`https://${subdomain}.itsmy.blog`)) {
        throw new Error("Invalid subdomain");
      }

      const site: Site = {
        subdomain,
        prompt,
        userId: req.extraInformation?.userId || "",
        versionUuid: crypto.randomUUID(),
      };

      await db.createSite(site);

      // We should update the cache.
      await clearCacheForSite(site);

      // Process any @url directives in the prompt
      const urlRegex = /@url\s+(\S+)/g;
      let match;
      while ((match = urlRegex.exec(prompt)) !== null) {
        const url = match[1];
        try {
          // Validate URL
          new URL(url);
          // Store URL and queue task
          await db.addUrlToMonitor(subdomain, url);
          // Instantly enqueue the task, it will be check later
          await kv.enqueue(
            { message: "extract-markdown", site: subdomain, url },
            { delay: 0 }
          );
        } catch (error) {
          console.error(`Invalid URL in prompt: ${url}, ${error}`);
        }
      }

      // regenerate the site so the first load is quicker
      // await kv.enqueue(
      //   { message: "generate-site", site },
      //   { delay: 0 } // 1 hour delay
      // );
      const url = new URL(req.url);
      url.pathname = `/admin/edit`;
      url.searchParams.set("subdomain", subdomain);
      return Response.redirect(url, 303);
    } catch (error) {
      return new Response((error as Error).message, { status: 400 });
    }
  }

  @authenticated({ redirect: "/login" })
  override async delete(req: Request): Promise<Response> {
    try {
      const url = new URL(req.url);
      const subdomain = url.searchParams.get("subdomain");

      if (!subdomain) {
        throw new Error("Missing subdomain");
      }

      await db.deleteSite(subdomain, req.extraInformation?.userId || "");
      return new Response(null, { status: 204 });
    } catch (error) {
      return new Response((error as Error).message, { status: 400 });
    }
  }
})();
