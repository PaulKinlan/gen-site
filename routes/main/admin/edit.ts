import { BaseHandler } from "@makemy/routes/base.ts";
import { Site } from "@makemy/types.ts";
import { db } from "@makemy/core/db.ts";
import { authenticated } from "@makemy/routes/decorators/authenticated.ts";
import { escapeHtml } from "https://deno.land/x/escape/mod.ts";
import { clearCacheForSite } from "@makemy/core/cache.ts";
import { getAssetContent } from "@makemy/utils/assets.ts";
const kv = await Deno.openKv();

const template = async (site: Site | null, error?: string) => `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Edit Site - makemy.blog</title>
    <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gray-50 h-dvh flex flex-col overflow-hidden">
    <nav class="bg-white shadow-sm">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
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

    <dialog id="addImageDialog" class="p-4 rounded-lg shadow-lg backdrop:bg-gray-500/50 w-1/2">
        <div class="mt-1">
            <h3 class="text-lg font-medium">Images</h3>
            <p>Upload images for the tool to use as inspiration.</p>
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
    </dialog>

    <dialog id="deleteImageDialog" class="p-4 rounded-lg shadow-lg backdrop:bg-gray-500/50">
        <div class="space-y-4">
            <h3 class="text-lg font-medium">Delete Image</h3>
            <p>Are you sure you want to delete this image?</p>
            <div class="flex justify-end space-x-2">
                <button class="px-4 py-2 text-gray-600 hover:text-gray-800" onclick="this.closest('dialog').close()">Cancel</button>
                <button id="confirmDeleteImage" class="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600">Delete</button>
            </div>
        </div>
    </dialog>

    <dialog id="addDomainDialog" class="p-4 rounded-lg shadow-lg backdrop:bg-gray-500/50">
        <div class="space-y-4">
            <h3 class="text-lg font-medium">Add Domain</h3>
            <div id="domains-list" class="space-y-2">
            <!-- Domains will be loaded here via JavaScript -->
            </div>
            <input type="text" id="dialogDomain" placeholder="example.com" 
                class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500">
            <div class="mt-4 text-sm text-gray-600">
                <p class="mb-2">To connect your domain:</p>
                <ol class="list-decimal list-inside space-y-1">
                    <li>Add your domain above</li>
                    <li>Create a APEX record pointing to <code>99.83.186.151</code> and <code>75.2.96.173</code></li>
                    <li>Wait for DNS propagation (may take up to 24 hours)</li>
                </ol>
            </div>
            <div class="flex justify-end space-x-2">
                <button class="px-4 py-2 text-gray-600 hover:text-gray-800" onclick="this.closest('dialog').close()">Cancel</button>
                <button id="confirmAddDomain" class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Add</button>
            </div>
        </div>
    </dialog>

    <dialog id="removeDomainDialog" class="p-4 rounded-lg shadow-lg backdrop:bg-gray-500/50">
        <div class="space-y-4">
            <h3 class="text-lg font-medium">Remove Domain</h3>
            <p>Are you sure you want to remove this domain?</p>
            <div class="flex justify-end space-x-2">
                <button class="px-4 py-2 text-gray-600 hover:text-gray-800" onclick="this.closest('dialog').close()">Cancel</button>
                <button id="confirmRemoveDomain" class="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600">Remove</button>
            </div>
        </div>
    </dialog>

    <div class="h-full w-full relative">
        <div class="h-full">
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
            <div class="h-full">
                <!-- iframe to show the site being edited -->
                <iframe id="site-preview" class="w-full h-full border-0" src="https://${escapeHtml(
                  site.subdomain
                )}.itsmy.blog" title="Site Preview"></iframe>
                
                <!-- Floating edit panel -->
                <div class="absolute top-4 right-4 w-1/3 bg-white bg-opacity-95 shadow-lg rounded-lg p-4 max-h-[80vh] overflow-y-auto">
                    <form class="space-y-3 flex flex-col" method="post" id="edit-form">
                    <div class="flex">
                        <h2 class="text-lg font-bold mb-3 flex-row flex flex-1 items-center">
                        Edit Site: 
                        <input type="text" id="subdomain" name="subdomain"
                                class="flex-1 block w-full px-3 py-2 border ml-2 border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                placeholder="Enter a name or generate one" value="${escapeHtml(
                                  site.subdomain
                                )}" required>
                        <span id="availability-indicator" class="ml-1 hidden">
                            <span id="available" class="text-green-600 hidden">✓</span>
                            <span id="unavailable" class="text-red-600 hidden">✗</span>
                        </span>
                        <button type="button" id="generate-name"
                            class="ml-3 inline-flex items-center px-4 py-2 border border-transparent 
                            text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700">
                             ${await getAssetContent(
                               "assets/images/refresh.svg"
                             )}

                        </button>
                        </h2>
                    </div>
                    
                    <div>
                        <label class="text-sm font-medium text-gray-700">
                            Preview URL:
                        </label><a href="https://${escapeHtml(
                          site.subdomain
                        )}.itsmy.blog" target="_blank" 
                               class="text-blue-600 hover:text-blue-800 underline">${escapeHtml(
                                 site.subdomain
                               )}.itsmy.blog/</a>
                    </div>

                    <div class="flex flex-col">
                        <label class="block text-sm font-medium text-gray-700">
                            Site Description
                        </label>
                        <div class="mt-1 flex flex-col relative">
                            <textarea id="prompt" name="prompt" rows="6" required
                                class="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm 
                                focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                placeholder="Describe how your site should be generated...">${escapeHtml(
                                  site.prompt
                                )}</textarea>
                                <div class="flex flex-row absolute bottom-1 left-1">
                                    <button class="cursor-pointer" id="addImageButton">${await getAssetContent(
                                      "assets/images/images.svg"
                                    )}</button>
                                   
                                    <button type="button" id="addDomainButton" >
                                    ${await getAssetContent(
                                      "assets/images/add-domain.svg"
                                    )}
                                </button>
                                </div>
                        </div>
                    </div>

                    <div class="flex justify-between mt-3">
                        <a href="/admin" 
                           class="inline-flex justify-center py-2 px-4 border border-gray-300 shadow-sm text-sm 
                                  font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 
                                  focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                            Cancel
                        </a>
                        <button type="submit" id="save-button"
                            class="inline-flex justify-center py-2 px-4 border border-transparent 
                            rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 
                            hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 
                            focus:ring-blue-500">
                            Save Changes
                        </button>
                    </div>
                    </form>
                </div>
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
    // Toggle panel visibility
    const editPanel = document.querySelector('.absolute.top-4.right-4');
    const minimizeBtn = document.createElement('button');
    minimizeBtn.innerHTML = '−';
    minimizeBtn.className = 'absolute top-2 right-2 w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-gray-700 hover:bg-gray-300 focus:outline-none';
    minimizeBtn.title = 'Minimize panel';
    
    let isPanelMinimized = false;
    const panelContent = document.getElementById('edit-form');
    
    minimizeBtn.addEventListener('click', function() {
        if (isPanelMinimized) {
            panelContent.style.display = 'flex';
            minimizeBtn.innerHTML = '−';
            minimizeBtn.title = 'Minimize panel';
        } else {
            panelContent.style.display = 'none';
            minimizeBtn.innerHTML = '+';
            minimizeBtn.title = 'Expand panel';
        }
        isPanelMinimized = !isPanelMinimized;
    });
    
    editPanel.appendChild(minimizeBtn);
    
    // Handle form submission to reload iframe
    const form = document.getElementById('edit-form');
    const iframe = document.getElementById('site-preview');
    
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const formData = new FormData(form);
        
        try {
            const response = await fetch(window.location.href, {
                method: 'POST',
                body: formData
            });
            
            if (response.ok) {
                // Show a success message
                const successMsg = document.createElement('div');
                successMsg.className = 'fixed top-4 left-1/2 transform -translate-x-1/2 bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded';
                successMsg.innerHTML = 'Changes saved successfully! Reloading preview...';
                document.body.appendChild(successMsg);
                
                // Reload the iframe
                iframe.src = iframe.src;
                
                // Remove success message after 3 seconds
                setTimeout(() => {
                    successMsg.remove();
                }, 3000);
            } else {
                throw new Error('Failed to save changes');
            }
        } catch (error) {
            console.error('Error saving changes:', error);
            alert('Failed to save changes. Please try again.');
        }
    });
    
    const imageGrid = document.getElementById('imageGrid');
    const imageUpload = document.getElementById('imageUpload');
    const addDomainButton = document.getElementById('addDomainButton');
    const addImageButton = document.getElementById('addImageButton');
    const subdomain = document.querySelector('input[name="subdomain"]').value;
    let checkNameTimeout;
    let currentDomainToRemove = '';

    // Load existing images
    async function loadImages() {
        const subdomain = document.getElementById('subdomain').value;
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
        const subdomain = document.getElementById('subdomain').value;

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
        const dialog = document.getElementById('deleteImageDialog');
        const confirmBtn = document.getElementById('confirmDeleteImage');
        const subdomain = document.getElementById('subdomain').value;

        
        const handleDelete = async () => {
            try {
                const response = await fetch(\`/api/user-images?id=\${imageId}&subdomain=\${subdomain}\`, {
                    method: 'DELETE'
                });

                if (!response.ok) throw new Error('Delete failed');
                
                // Reload images after successful deletion
                await loadImages();
                dialog.close();
            } catch (error) {
                console.error('Error deleting image:', error);
                alert('Failed to delete image. Please try again.');
            }
            confirmBtn.removeEventListener('click', handleDelete);
        };

        confirmBtn.addEventListener('click', handleDelete);
        dialog.showModal();
    };

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

    // Initial load
    loadImages();
    loadDomains();

    // Domain management
    async function loadDomains() {
        const domainsList = document.getElementById('domains-list');
        const subdomain = document.getElementById('subdomain').value;
        try {
            console.log('Loading domains for', subdomain);
            const response = await fetch('/admin/domains?subdomain=' + encodeURIComponent(subdomain));
            const { customDomains } = await response.json();
            
            domainsList.innerHTML = customDomains?.length 
                ? customDomains.map(domain => \`
                    <div class="flex justify-between items-center p-2 border rounded">
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

    const showAddImageDialog = function(event) {
        event.preventDefault();
        const dialog = document.getElementById('addImageDialog');
        const confirmBtn = document.getElementById('confirmAddImage');
        const input = document.getElementById('dialogDomain');
        const subdomain = document.getElementById('subdomain').value;

        
        dialog.showModal();
    };

    addImageButton.addEventListener('click', showAddImageDialog);

    const showAddDomainDialog = function() {
        const dialog = document.getElementById('addDomainDialog');
        const confirmBtn = document.getElementById('confirmAddDomain');
        const input = document.getElementById('dialogDomain');
        const subdomain = document.getElementById('subdomain').value;

        
        const handleAdd = async () => {
            const domain = input.value.trim();
            if (!domain) return;
            
            try {
                const response = await fetch('/admin/domains', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ subdomain, domain })
                });
                
                if (!response.ok) throw new Error(await response.text());
                
                input.value = '';
                dialog.close();
                loadDomains();
            } catch (error) {
                alert('Failed to add domain: ' + error.message);
            }
            confirmBtn.removeEventListener('click', handleAdd);
        };

        confirmBtn.addEventListener('click', handleAdd);
        dialog.showModal();
    };

    addDomainButton.addEventListener('click', showAddDomainDialog);

    const removeDomain = async function(host) {
        const dialog = document.getElementById('removeDomainDialog');
        const confirmBtn = document.getElementById('confirmRemoveDomain');
        const subdomain = document.getElementById('subdomain').value;

        currentDomainToRemove = host;
        
        const handleRemove = async () => {
            try {
                const response = await fetch('/admin/domains?subdomain=' + encodeURIComponent(subdomain) + '&host=' + encodeURIComponent(currentDomainToRemove), {
                    method: 'DELETE'
                });
                
                if (!response.ok) throw new Error(await response.text());
                
                dialog.close();
                loadDomains();
            } catch (error) {
                alert('Failed to remove domain: ' + error.message);
            }
            confirmBtn.removeEventListener('click', handleRemove);
        };

        confirmBtn.addEventListener('click', handleRemove);
        dialog.showModal();
    };
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
        await template(null, "You don't have permission to edit this site"),
        {
          status: 403,
          headers: { "Content-Type": "text/html" },
        }
      );
    }

    return new Response(await template(site), {
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

      baseUrl.pathname = "/admin";
      return Response.redirect(baseUrl, 303);
    } catch (error) {
      const site = await db.getSite("");
      return new Response(await template(site, (error as Error).message), {
        status: 400,
        headers: { "Content-Type": "text/html" },
      });
    }
  }
})();
