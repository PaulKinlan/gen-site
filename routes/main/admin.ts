import { BaseHandler } from "../base.ts";
import { Site } from "../../types.ts";
import { db } from "../../db.ts";
import { getCookies } from "@std/http/cookie";
import { authenticated } from "../decorators/authenticated.ts";

const template = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Admin Dashboard - makemy.blog</title>
    <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gray-50">
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

    <div class="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div class="px-4 py-6 sm:px-0">
            <div class="border-4 border-dashed border-gray-200 rounded-lg p-6">
                <h2 class="text-2xl font-bold mb-6">Create New Site</h2>
                <form id="create-site-form" class="space-y-6" method="post" enctype="multipart/form-data">
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

                    <div>
                        <label class="block text-sm font-medium text-gray-700">
                            Site Prompt
                        </label>
                        <div class="mt-1">
                            <textarea id="prompt" name="prompt" rows="4" required
                                class="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm 
                                focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                placeholder="Describe how your site should be generated..."></textarea>
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
            </div>
        </div>
    </div>

    <script>
    document.getElementById('generate-name').addEventListener('click', async () => {
        const response = await fetch('/api/generate-name');
        const { subdomain } = await response.json();
        document.getElementById('subdomain').value = subdomain;
    });

    document.getElementById('create-site-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const data = Object.fromEntries(formData);
        
        try {
            const response = await fetch('/api/sites', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            
            if (!response.ok) throw new Error(await response.text());
            window.location.href = '/admin';
        } catch (error) {
            alert(error.message);
        }
    });
    </script>
</body>
</html>`;

export default new (class extends BaseHandler {
  @authenticated({ redirect: "/login" })
  async get(req: Request): Promise<Response> {
    return new Response(template, {
      headers: { "Content-Type": "text/html" },
    });
  }

  async post(req: Request): Promise<Response> {
    // Get the auth cookie.
    const { auth } = getCookies(req.headers);

    console.log(auth);

    // Check if the user is authenticated
    // If the user is not authenticated, redirect to the login page.
    if (!auth) {
      return Response.redirect("/login");
    }

    try {
      const data = await req.json();
      const site: Site = {
        subdomain: data.subdomain,
        prompt: data.prompt,
        userId: req.userId, // Assuming auth middleware sets this
      };

      await db.createSite(site);
      return new Response(JSON.stringify({ success: true }));
    } catch (error) {
      return new Response(error.message, { status: 400 });
    }
  }
})();
