import { auth } from "@makemy/utils/auth.ts";
import { db } from "@makemy/core/db.ts";
import { BaseHandler } from "@makemy/routes/base.ts";
import { setCookie } from "@std/http/cookie";
import path from "npm:path";

const getTemplate = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Sign In - makemy.blog</title>
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
                    <a href="/signup" class="text-gray-600 hover:text-gray-900">Sign Up</a>
                </div>
            </div>
        </div>
    </nav>

    <div class="min-h-screen flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div class="sm:mx-auto sm:w-full sm:max-w-md">
            <h2 class="mt-6 text-center text-3xl font-extrabold text-gray-900">
                Sign in to your account
            </h2>
        </div>

        <div class="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
            <div class="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
                <form id="signin-form" class="space-y-6" method="post" enctype="multipart/form-data">
                    <div>
                        <label for="username" class="block text-sm font-medium text-gray-700">
                            Username
                        </label>
                        <div class="mt-1">
                            <input id="username" name="username" type="text" required
                                class="appearance-none block w-full px-3 py-2 border border-gray-300 
                                rounded-md shadow-sm placeholder-gray-400 focus:outline-none 
                                focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                autocomplete="username">
                        </div>
                    </div>

                    <div>
                        <label for="password" class="block text-sm font-medium text-gray-700">
                            Password
                        </label>
                        <div class="mt-1">
                            <input id="password" name="password" type="password" required
                                class="appearance-none block w-full px-3 py-2 border border-gray-300 
                                rounded-md shadow-sm placeholder-gray-400 focus:outline-none 
                                focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                autocomplete="current-password">
                        </div>
                    </div>

                    <div>
                        <button type="submit"
                            class="w-full flex justify-center py-2 px-4 border border-transparent 
                            rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 
                            hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 
                            focus:ring-blue-500">
                            Sign in
                        </button>
                    </div>
                </form>
            </div>
        </div>
    </div>
</body>
</html>`;

export default new (class extends BaseHandler {
  async get(req: Request): Promise<Response> {
    return new Response(getTemplate, {
      status: 200,
      headers: { "Content-Type": "text/html" },
    });
  }
  async post(req: Request): Promise<Response> {
    const url = new URL(req.url);
    url.pathname = "/admin";
    const adminUrl = url.toString();
    // Check to see if the credentials are correct.
    const formData = await req.formData();
    console.log(formData);
    const username = formData.get("username");
    const password = formData.get("password");

    console.log(username);

    const user = await db.getUserByUsername(username as string);
    const submittedPasswordHash = await auth.hashPassword(password as string);

    console.log(user);

    if (user?.passwordHash != submittedPasswordHash) {
      return new Response("Invalid credentials", { status: 401 });
    }

    const token = await auth.createToken(user.id);

    const response = new Response(null, {
      status: 301,
      headers: {
        Location: adminUrl,
      },
    });

    // Set the auth cookie.
    setCookie(response.headers, {
      name: "auth",
      value: token,
      path: "/",
      httpOnly: true,
      SameSite: "Strict",
    });

    const sessionId = crypto.randomUUID();
    await db.setSession(user.id, sessionId);

    setCookie(response.headers, {
      name: "session",
      value: sessionId,
      path: "/",
      httpOnly: true,
      SameSite: "Strict",
    });

    return response;
  }
})();
