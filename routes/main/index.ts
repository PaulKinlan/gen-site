import { BaseHandler } from "@makemy/routes/base.ts";

const HTML = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>makemy.blog - Instantly Create Websites</title>
    <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gray-50">
    <nav class="bg-white shadow-sm">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div class="flex justify-between h-16">
                <div class="flex-shrink-0 flex items-center">
                    <h1 class="text-xl font-bold">makemy.blog</h1>
                </div>
                <div class="flex items-center space-x-4">
                    <a href="/signin" class="text-gray-600 hover:text-gray-900">Sign In</a>
                    <a href="/signup" class="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700">
                        Sign Up
                    </a>
                </div>
            </div>
        </div>
    </nav>

    <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div class="text-center">
            <h2 class="text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl md:text-6xl">
                Instantly Create Websites
            </h2>
            <p class="mt-3 max-w-md mx-auto text-base text-gray-500 sm:text-lg md:mt-5 md:text-xl md:max-w-3xl">
                Build dynamic websites. Just describe what you want, 
                and we'll generate everything - from HTML to CSS to JavaScript.
            </p>
            <div class="mt-5 max-w-md mx-auto sm:flex sm:justify-center md:mt-8">
                <div class="rounded-md shadow">
                    <a href="/signup" class="w-full flex items-center justify-center px-8 py-3 border 
                       border-transparent text-base font-medium rounded-md text-white bg-blue-600 
                       hover:bg-blue-700 md:py-4 md:text-lg md:px-10">
                        Get Started
                    </a>
                </div>
            </div>
        </div>

        <div class="mt-20">
            <h3 class="text-2xl font-bold text-center mb-12">How It Works</h3>
            <div class="grid grid-cols-1 gap-8 sm:grid-cols-3">
                <div class="text-center">
                    <div class="flex items-center justify-center h-12 w-12 rounded-md bg-blue-500 
                         text-white mx-auto">1</div>
                    <h4 class="mt-5 text-lg font-medium">Describe Your Site</h4>
                    <p class="mt-2 text-gray-500">Tell us what kind of website you want to create</p>
                </div>
                <div class="text-center">
                    <div class="flex items-center justify-center h-12 w-12 rounded-md bg-blue-500 
                         text-white mx-auto">2</div>
                    <h4 class="mt-5 text-lg font-medium">AI Generation</h4>
                    <p class="mt-2 text-gray-500">Our AI creates all necessary files and content</p>
                </div>
                <div class="text-center">
                    <div class="flex items-center justify-center h-12 w-12 rounded-md bg-blue-500 
                         text-white mx-auto">3</div>
                    <h4 class="mt-5 text-lg font-medium">Go Live</h4>
                    <p class="mt-2 text-gray-500">Your site is instantly available on your subdomain</p>
                </div>
            </div>
        </div>
    </main>
</body>
</html>`;

export default new (class extends BaseHandler {
  async get(req: Request): Promise<Response> {
    console.log("Request for /");
    return new Response(HTML, {
      headers: {
        "Content-Type": "text/html",
      },
    });
  }
})();
