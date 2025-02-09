import { BaseHandler } from "@makemy/routes/base.ts";
import { Site } from "@makemy/types.ts";
import { db, kv } from "@makemy/core/db.ts";
import { authenticated } from "@makemy/routes/decorators/authenticated.ts";
import { escapeHtml } from "https://deno.land/x/escape/mod.ts";
import { generatePrompt } from "@makemy/routes/main/admin/resources/prompts.ts";

const template = (sites: Site[]) => {
  const siteList = sites
    .map(
      (site) => `
    <div>
      <div class="mt-1">
        <div class="flex justify-between items-center">
          <p><a href="https://${site.subdomain}.itsmy.blog" target="_blank" class="text-blue-600 hover:text-blue-800 underline">${site.subdomain}.itsmy.blog</a></p>
          <div class="flex gap-4">
            <a href="/admin/edit?subdomain=${site.subdomain}" class="text-blue-600 hover:text-blue-800">Edit</a>
            <button onclick="manageDomains('${site.subdomain}')" class="text-blue-600 hover:text-blue-800">Domains</button>
            <button onclick="deleteSite('${site.subdomain}')" class="text-red-600 hover:text-red-800">Delete</button>
          </div>
        </div>
      </div>
    </div>
  `
    )
    .join("");

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
                            <div class="flex-1 flex items-center">
                                <input type="text" id="subdomain" name="subdomain"
                                    class="flex-1 block w-full px-3 py-2 border border-gray-300 rounded-md 
                                    shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                    placeholder="Enter a name or generate one">
                                <span id="availability-indicator" class="ml-2 hidden">
                                    <span id="available" class="text-green-600 hidden">✓</span>
                                    <span id="unavailable" class="text-red-600 hidden">✗</span>
                                </span>
                            </div>
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

                ${siteList}
            </div>
        </div>
    </div>

    <!-- Domain Management Modal -->
    <div id="domain-modal" class="fixed inset-0 bg-gray-500 bg-opacity-75 hidden">
      <div class="flex min-h-full items-center justify-center">
        <div class="bg-white rounded-lg p-6 max-w-2xl w-full">
          <div class="flex justify-between items-center mb-4">
            <h3 class="text-xl font-bold">Manage Custom Domains</h3>
            <button onclick="closeDomainModal()" class="text-gray-500 hover:text-gray-700">&times;</button>
          </div>
          
          <div id="domains-list" class="mb-4">
            <!-- Domains will be listed here -->
          </div>

          <form id="add-domain-form" class="mb-4">
            <div class="flex gap-2">
              <input type="text" id="new-domain" placeholder="example.com" 
                class="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500">
              <button type="submit" 
                class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
                Add Domain
              </button>
            </div>
          </form>

          <div class="text-sm text-gray-600">
            <p class="mb-2">To connect your domain:</p>
            <ol class="list-decimal list-inside space-y-1">
              <li>Add your domain above</li>
              <li>Create a APEX record pointing to <code>99.83.186.151</code> and <code>75.2.96.173.</code></li>
              <li>Wait for DNS propagation (may take up to 24 hours)</li>
            </ol>
          </div>
        </div>
      </div>
    </div>

    <script>
    let checkNameTimeout;
    let currentSubdomain;

    async function manageDomains(subdomain) {
      currentSubdomain = subdomain;
      const modal = document.getElementById('domain-modal');
      const domainsList = document.getElementById('domains-list');
      modal.classList.remove('hidden');
      
      // Fetch and display domains
      try {
        const response = await fetch(\`/admin/domains?subdomain=\${subdomain}\`);
        const { customDomains } = await response.json();
        
        domainsList.innerHTML = customDomains?.length 
          ? customDomains.map(domain => \`
              <div class="flex justify-between items-center p-2 border-b">
                <div>
                  <p class="font-medium">\${domain.host}</p>
                  <p class="text-sm text-gray-500">Status: \${domain.status}</p>
                </div>
                <button onclick="removeDomain('\${domain.host}')" 
                  class="text-red-600 hover:text-red-800">Remove</button>
              </div>
            \`).join('')
          : '<p class="text-gray-500">No custom domains configured</p>';
      } catch (error) {
        console.error('Error fetching domains:', error);
        domainsList.innerHTML = '<p class="text-red-500">Failed to load domains</p>';
      }
    }

    function closeDomainModal() {
      document.getElementById('domain-modal').classList.add('hidden');
      currentSubdomain = null;
    }

    document.getElementById('add-domain-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const input = document.getElementById('new-domain');
      const domain = input.value.trim();
      
      if (!domain) return;
      
      try {
        const response = await fetch('/admin/domains', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subdomain: currentSubdomain, domain })
        });
        
        if (!response.ok) throw new Error(await response.text());
        
        input.value = '';
        manageDomains(currentSubdomain); // Refresh the list
      } catch (error) {
        alert('Failed to add domain: ' + error.message);
      }
    });

    async function removeDomain(host) {
      if (!confirm('Are you sure you want to remove this domain?')) return;
      
      try {
        const response = await fetch(\`/admin/domains?subdomain=\${currentSubdomain}&host=\${host}\`, {
          method: 'DELETE'
        });
        
        if (!response.ok) throw new Error(await response.text());
        
        manageDomains(currentSubdomain); // Refresh the list
      } catch (error) {
        alert('Failed to remove domain: ' + error.message);
      }
    }

    
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

    return new Response(template(sites), {
      headers: { "Content-Type": "text/html" },
    });
  }

  @authenticated({ redirect: "/login" })
  override async post(req: Request): Promise<Response> {
    try {
      const data = await req.formData();
      const subdomain = data.get("subdomain")?.toString();
      const prompt = data.get("prompt")?.toString();

      if (!subdomain || !prompt) {
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
      };

      await db.createSite(site);

      // Process any @url directives in the prompt
      const urlRegex = /@url\s+(\S+)/g;
      let match;
      while ((match = urlRegex.exec(prompt)) !== null) {
        const url = match[1];
        try {
          // Validate URL
          new URL(url);
          // Store URL and queue task
          await db.addUrlToMontior(subdomain, url, prompt);
          // Instantly enqueue the task, it will be check later
          await kv.enqueue({ site: subdomain, url }, { delay: 0 });
        } catch (error) {
          console.error(`Invalid URL in prompt: ${url}`);
        }
      }
      return Response.redirect(req.url, 303);
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
