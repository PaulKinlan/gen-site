import { BaseHandler } from "@makemy/routes/base.ts";
import { Site } from "@makemy/types.ts";
import { db } from "@makemy/core/db.ts";
import { authenticated } from "@makemy/routes/decorators/authenticated.ts";
import { escapeHtml } from "https://deno.land/x/escape/mod.ts";
import { clearCacheForSite } from "@makemy/core/cache.ts";

const kv = await Deno.openKv();

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

                    <div class="space-y-4">
                        <label class="block text-sm font-medium text-gray-700">
                            Images
                        </label>
                        <div class="mt-1">
                            <div class="flex flex-wrap gap-4" id="imageGrid">
                                <!-- Images will be loaded here via JavaScript -->
                            </div>
                            <div class="mt-4">
                                <label class="inline-flex items-center px-4 py-2 border border-gray-300 
                                            shadow-sm text-sm font-medium rounded-md text-gray-700 
                                            bg-white hover:bg-gray-50 cursor-pointer">
                                    <input type="file" accept="image/*" id="imageUpload" class="hidden">
                                    Upload Image
                                </label>
                            </div>
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
<script>
document.addEventListener('DOMContentLoaded', function() {
    const imageGrid = document.getElementById('imageGrid');
    const imageUpload = document.getElementById('imageUpload');
    const subdomain = document.querySelector('input[name="subdomain"]').value;

    // Load existing images
    async function loadImages() {
        try {
            const response = await fetch('/api/user-images?subdomain=' + subdomain);
            if (!response.ok) throw new Error('Failed to load images');
            const images = await response.json();
            
            imageGrid.innerHTML = images.map(image => \`
                <div class="relative group" data-image-id="\${image.id}">
                    <img src="/api/user-images?id=\${image.id}&subdomain=\${subdomain}&w=150" 
                         alt="\${image.filename}"
                         class="w-[150px] h-[150px] object-cover rounded-lg border border-gray-200">
                    <button onclick="deleteImage('\${image.id}')"
                            class="absolute top-2 right-2 hidden group-hover:block p-1 
                                   bg-red-500 text-white rounded-full hover:bg-red-600">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                                  d="M6 18L18 6M6 6l12 12"></path>
                        </svg>
                    </button>
                </div>
            \`).join('');
        } catch (error) {
            console.error('Error loading images:', error);
        }
    }

    // Handle image upload
    imageUpload.addEventListener('change', async function(e) {
        const file = e.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('image', file);
        formData.append('subdomain', subdomain);

        try {
            const response = await fetch('/api/user-images', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) throw new Error('Upload failed');
            
            // Reload images after successful upload
            await loadImages();
            
            // Clear the file input
            imageUpload.value = '';
        } catch (error) {
            console.error('Error uploading image:', error);
            alert('Failed to upload image. Please try again.');
        }
    });

    // Handle image deletion
    window.deleteImage = async function(imageId) {
        event.preventDefault(); 
        if (!confirm('Are you sure you want to delete this image?')) return;

        try {
            const response = await fetch(\`/api/user-images?id=\${imageId}&subdomain=\${subdomain}\`, {
                method: 'DELETE'
            });

            if (!response.ok) throw new Error('Delete failed');
            
            // Reload images after successful deletion
            await loadImages();
        } catch (error) {
            console.error('Error deleting image:', error);
            alert('Failed to delete image. Please try again.');
        }
    };

    // Initial load
    loadImages();
});
</script>
</body>
</html>`;

export default new (class extends BaseHandler {
  @authenticated({ redirect: "/login" })
  override async get(req: Request): Promise<Response> {
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
  override async post(req: Request): Promise<Response> {
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
        versionUuid: crypto.randomUUID(),
      };

      await db.createSite(site); // This will overwrite the existing site

      // We should update the cache so that old assets aren't served
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
          // Instantly check
          await kv.enqueue(
            { message: "extract-markdown", site: subdomain, url },
            { delay: 0 } // 1 hour delay
          );
        } catch (urlError) {
          console.error(`Invalid URL in prompt: ${url}, ${urlError}`);
        }
      }

      // regenerate the site so the first load is quicker
      // await kv.enqueue(
      //   { message: "generate-site", site },
      //   { delay: 0 } // 1 hour delay
      // );

      baseUrl.pathname = "/admin";
      return Response.redirect(baseUrl, 303);
    } catch (error) {
      const site = await db.getSite("");
      return new Response(template(site, (error as Error).message), {
        status: 400,
        headers: { "Content-Type": "text/html" },
      });
    }
  }
})();
