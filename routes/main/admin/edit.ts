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
    <style>
        /* Add styles for dragging */
        .dragging {
          user-select: none;
          opacity: 0.95;
          transition: none !important;
          z-index: 1000;
        }

        #site-preview {
            position: absolute;
            z-index: -1;
        }

        div:has(#site-preview.loading) {
            /* Initial inset shadow */
      box-shadow: inset 0 2px 8px rgba(0, 0, 0, 0.25), 
                  inset 0 -1px 3px rgba(255, 255, 255, 0.7);
      
      /* Animation for the box-shadow */
      animation: multicolorGlow 10s infinite;
        }

        @keyframes multicolorGlow {
      0% {
        box-shadow: inset 0 2px 8px rgba(0, 0, 0, 0.25), 
                    inset 0 -1px 3px rgba(255, 255, 255, 0.7),
                    inset 0 0 50px rgba(255, 0, 128, 0.4),    /* Pink */
                    inset 0 0 80px rgba(128, 0, 255, 0.2);    /* Purple */
      }
      14% {
        box-shadow: inset 0 2px 8px rgba(0, 0, 0, 0.25), 
                    inset 0 -1px 3px rgba(255, 255, 255, 0.7),
                    inset -30px 0 60px rgba(64, 224, 208, 0.4), /* Turquoise */
                    inset 30px 0 80px rgba(255, 105, 180, 0.3); /* Hot Pink */
      }
      28% {
        box-shadow: inset 0 2px 8px rgba(0, 0, 0, 0.25), 
                    inset 0 -1px 3px rgba(255, 255, 255, 0.7),
                    inset 0 -40px 70px rgba(255, 215, 0, 0.4), /* Gold */
                    inset 0 40px 80px rgba(50, 205, 50, 0.3);  /* Lime Green */
      }
      42% {
        box-shadow: inset 0 2px 8px rgba(0, 0, 0, 0.25), 
                    inset 0 -1px 3px rgba(255, 255, 255, 0.7),
                    inset 40px 0 80px rgba(0, 191, 255, 0.4),  /* Deep Sky Blue */
                    inset -40px 0 70px rgba(255, 69, 0, 0.3);  /* Red-Orange */
      }
      56% {
        box-shadow: inset 0 2px 8px rgba(0, 0, 0, 0.25), 
                    inset 0 -1px 3px rgba(255, 255, 255, 0.7),
                    inset 0 40px 80px rgba(138, 43, 226, 0.4), /* Blue Violet */
                    inset 0 -40px 70px rgba(255, 165, 0, 0.3); /* Orange */
      }
      70% {
        box-shadow: inset 0 2px 8px rgba(0, 0, 0, 0.25), 
                    inset 0 -1px 3px rgba(255, 255, 255, 0.7),
                    inset -40px 0 70px rgba(0, 250, 154, 0.4),  /* Medium Spring Green */
                    inset 40px 0 80px rgba(255, 20, 147, 0.3);  /* Deep Pink */
      }
      84% {
        box-shadow: inset 0 2px 8px rgba(0, 0, 0, 0.25), 
                    inset 0 -1px 3px rgba(255, 255, 255, 0.7),
                    inset 0 -40px 80px rgba(30, 144, 255, 0.4), /* Dodger Blue */
                    inset 0 40px 70px rgba(255, 215, 0, 0.3);   /* Gold */
      }
      100% {
        box-shadow: inset 0 2px 8px rgba(0, 0, 0, 0.25), 
                    inset 0 -1px 3px rgba(255, 255, 255, 0.7),
                    inset 0 0 50px rgba(255, 0, 128, 0.4),      /* Pink */
                    inset 0 0 80px rgba(128, 0, 255, 0.2);      /* Purple */
      }
    }
    
        #edit-panel {
          transition: all 0.1s ease;
        }
    </style>
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
                <div id="edit-panel" class="absolute top-4 right-4 w-1/3 bg-white bg-opacity-95 shadow-lg rounded-lg max-h-[80vh] overflow-y-auto">
                    <!-- Panel header/drag handle -->
                    <div id="panel-handle" class="bg-gray-100 p-2 rounded-t-lg flex justify-between items-center border-b cursor-move">
                        <span class="font-medium text-gray-700">Edit Site</span>
                        <div class="flex space-x-2">
                            <button id="minimize-panel" type="button" class="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-gray-700 hover:bg-gray-300 focus:outline-none">
                                −
                            </button>
                        </div>
                    </div>
                    <form class="space-y-3 flex flex-col p-4" method="post" id="edit-form">
                    <input type="hidden" name="subdomain" value="${escapeHtml(
                      site.subdomain
                    )}">

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
                        <div class="mt-1 flex flex-col px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-white">
                            <textarea id="prompt" name="prompt" rows="6" required
                                class="block w-full "
                                placeholder="Describe how your site should be generated...">${escapeHtml(
                                  site.prompt
                                )}</textarea>
                                <div class="flex flex-row">
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
    // Make the panel draggable
    const editPanel = document.getElementById('edit-panel');
    const panelHandle = document.getElementById('panel-handle');
    const minimizeBtn = document.getElementById('minimize-panel');
    const iframe = document.getElementById('site-preview');

    iframe.addEventListener('load', function() {
        iframe.classList.remove('loading');
    });

    // Generate vibrant RGB colors
    function randomRGB() {
      return \`\${Math.floor(Math.random() * 256)}, \${Math.floor(Math.random() * 256)}, \${Math.floor(Math.random() * 256)}\`;
    }
    
    function fluctuateBoxShadow() {
      // Get dynamic colors
      const color1 = randomRGB();
      const color2 = randomRGB();
      const color3 = randomRGB();
      
      // Calculate random offsets for organic movement
      const time = Date.now();
      const offsetX1 = Math.sin(time / 1200) * 40;
      const offsetY1 = Math.cos(time / 1500) * 30;
      const offsetX2 = Math.sin(time / 1800) * 35;
      const offsetY2 = Math.cos(time / 2000) * 45;
      const offsetX3 = Math.sin(time / 2200) * 50;
      const offsetY3 = Math.cos(time / 1300) * 25;
      
      // Apply multiple shadows with different colors
      const customShadow = \`
        inset 0 2px 8px rgba(0, 0, 0, 0.25), 
        inset 0 -1px 3px rgba(255, 255, 255, 0.7),
        inset \${offsetX1}px \${offsetY1}px 60px rgba(\${color1}, 0.4),
        inset \${offsetX2}px \${offsetY2}px 80px rgba(\${color2}, 0.3),
        inset \${offsetX3}px \${offsetY3}px 70px rgba(\${color3}, 0.35)
     \`;
      
      iframe.parentElement.style.boxShadow = customShadow;

      if(iframe.classList.contains('loading')) {
        requestAnimationFrame(fluctuateBoxShadow);
      }
      else {
        iframe.parentElement.style.boxShadow = ''
      }
    }
    
    let isDragging = false;
    let offsetX, offsetY;
    
    // Prevent iframe from capturing mouse events during drag
    function toggleIframePointerEvents(disable) {
        if (iframe) {
            iframe.style.pointerEvents = disable ? 'none' : 'auto';
        }
    }
    
    // Panel drag functionality - improved for smoother tracking
    if (panelHandle) {
        panelHandle.addEventListener('mousedown', function(e) {
            // Only handle left mouse button
            if (e.button !== 0) return;
            
            e.preventDefault();
            isDragging = true;
            
            // Get the current position of the panel
            if (editPanel) {
                const rect = editPanel.getBoundingClientRect();
                offsetX = e.clientX - rect.left;
                offsetY = e.clientY - rect.top;
                
                // Add a class to indicate dragging state
                editPanel.classList.add('dragging');
                
                // Disable iframe pointer events during drag
                toggleIframePointerEvents(true);
            }
        });
    }
    
    document.addEventListener('mousemove', function(e) {
        if (!isDragging || !editPanel) return;
        
        e.preventDefault();
        
        // Calculate new position, accounting for scroll position
        let x = e.clientX - offsetX;
        let y = e.clientY - offsetY;
        
        // Constrain to viewport
        const panelWidth = editPanel.offsetWidth;
        const panelHeight = editPanel.offsetHeight;
        const maxX = window.innerWidth - panelWidth;
        const maxY = window.innerHeight - panelHeight;
        
        x = Math.max(0, Math.min(x, maxX));
        y = Math.max(0, Math.min(y, maxY));
        
        // Apply new position with fixed positioning to prevent jumping when scrolling
        editPanel.style.left = \`\${x}px\`;
        editPanel.style.top = \`\${y}px\`;
        editPanel.style.position = 'fixed';
        
        // Remove the default positioning classes
        editPanel.classList.remove('right-4');
        editPanel.classList.remove('top-4');
    });
    
    // Handle both mouseup and mouseleave to prevent panel from sticking
    function endDrag() {
        if (isDragging && editPanel) {
            isDragging = false;
            editPanel.classList.remove('dragging');
            toggleIframePointerEvents(false);
        }
    }
    
    document.addEventListener('mouseup', endDrag);
    document.addEventListener('mouseleave', endDrag);
    
    // Prevent dragging from stopping if mouse moves too fast
    document.addEventListener('dragend', endDrag);
    
    // Toggle panel visibility
    if (minimizeBtn) {
        let isPanelMinimized = false;
        const panelContent = document.getElementById('edit-form');
        
        minimizeBtn.addEventListener('click', function() {
            if (panelContent) {
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
            }
        });
    }
    
    // Handle form submission to reload iframe
    const form = document.getElementById('edit-form');
    
    if (form && iframe) {
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
                    iframe.classList.add('loading');
                    iframe.src = iframe.src;
                    fluctuateBoxShadow();
                    
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
    }
    
    const imageGrid = document.getElementById('imageGrid');
    const imageUpload = document.getElementById('imageUpload');
    const addDomainButton = document.getElementById('addDomainButton');
    const addImageButton = document.getElementById('addImageButton');
    const subdomainInput = document.querySelector('input[name="subdomain"]');
    let checkNameTimeout;
    let currentDomainToRemove = '';

    // Load existing images
    async function loadImages() {
        const subdomain = document.getElementById('subdomain')?.value;
        if (!subdomain) return;
        
        try {
            const response = await fetch('/api/user-images?subdomain=' + subdomain);
            if (!response.ok) throw new Error('Failed to load images');
            const images = await response.json();
            
            if (imageGrid) {
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
            }
        } catch (error) {
            console.error('Error loading images:', error);
        }
    }

    // Handle image upload
    if (imageUpload) {
        imageUpload.addEventListener('change', async function(e) {
            const file = e.target.files?.[0];
            const subdomain = document.getElementById('subdomain')?.value;

            if (!file || !subdomain) return;

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
    }

    // Handle image deletion
    window.deleteImage = async function(imageId) {
        if (!event) return;
        event.preventDefault();
        const dialog = document.getElementById('deleteImageDialog');
        const confirmBtn = document.getElementById('confirmDeleteImage');
        const subdomain = document.getElementById('subdomain')?.value;

        if (!dialog || !confirmBtn || !subdomain) return;
        
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
        
        if (!name || !indicator || !available || !unavailable) {
            if (indicator) indicator.classList.add('hidden');
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

    const subdomainElement = document.getElementById('subdomain');
    if (subdomainElement) {
        subdomainElement.addEventListener('input', (e) => {
            clearTimeout(checkNameTimeout);
            checkNameTimeout = setTimeout(() => {
                checkNameAvailability(e.target.value);
            }, 300);
        });
    }

    const generateNameBtn = document.getElementById('generate-name');
    if (generateNameBtn) {
        generateNameBtn.addEventListener('click', async () => {
            const response = await fetch('/api/generate-name');
            const { subdomain } = await response.json();
            const input = document.getElementById('subdomain');
            if (input) {
                input.value = subdomain;
                checkNameAvailability(subdomain);
            }
        });
    }

    // Initial load
    loadImages();
    loadDomains();

    // Domain management
    async function loadDomains() {
        const domainsList = document.getElementById('domains-list');
        const subdomain = document.getElementById('subdomain')?.value;
        
        if (!domainsList || !subdomain) return;
        
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

    if (addImageButton) {
        addImageButton.addEventListener('click', function(event) {
            if (!event) return;
            event.preventDefault();
            const dialog = document.getElementById('addImageDialog');
            if (dialog) dialog.showModal();
        });
    }

    if (addDomainButton) {
        addDomainButton.addEventListener('click', function() {
            const dialog = document.getElementById('addDomainDialog');
            const confirmBtn = document.getElementById('confirmAddDomain');
            const input = document.getElementById('dialogDomain');
            const subdomain = document.getElementById('subdomain')?.value;

            if (!dialog || !confirmBtn || !input || !subdomain) return;
            
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
        });
    }

    window.removeDomain = async function(host) {
        const dialog = document.getElementById('removeDomainDialog');
        const confirmBtn = document.getElementById('confirmRemoveDomain');
        const subdomain = document.getElementById('subdomain')?.value;

        if (!dialog || !confirmBtn || !subdomain || !host) return;

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
