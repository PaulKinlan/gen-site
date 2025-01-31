import { auth } from "../../auth.ts";
import { db } from "../../db.ts";
import { User } from "../../types.ts";
import { BaseHandler } from "../base.ts";
import { getCookies, setCookie } from "@std/http/cookie";

const getTemplate = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Sign Up - makemy.blog</title>
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
                    <a href="/signin" class="text-gray-600 hover:text-gray-900">Sign In</a>
                </div>
            </div>
        </div>
    </nav>

    <div class="min-h-screen flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div class="sm:mx-auto sm:w-full sm:max-w-md">
            <h2 class="mt-6 text-center text-3xl font-extrabold text-gray-900">
                Create your account
            </h2>
        </div>

        <div class="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
            <div class="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
                <form id="signup-form" class="space-y-6" enctype="multipart/form-data" method="post">
                    <div>
                        <label for="username" class="block text-sm font-medium text-gray-700">
                            Username
                        </label>
                        <div class="mt-1">
                            <input id="username" name="username" type="text" required
                                class="appearance-none block w-full px-3 py-2 border border-gray-300 
                                rounded-md shadow-sm placeholder-gray-400 focus:outline-none 
                                focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                pattern="[a-zA-Z0-9_]{3,20}"
                                title="3-20 characters, letters, numbers and underscore"
                                autocomplete="username">
                        </div>
                    </div>

                    <div>
                        <label for="email" class="block text-sm font-medium text-gray-700">
                            Email
                        </label>
                        <div class="mt-1">
                            <input id="email" name="email" type="email" required
                                class="appearance-none block w-full px-3 py-2 border border-gray-300 
                                rounded-md shadow-sm placeholder-gray-400 focus:outline-none 
                                focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                autocomplete="email">
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
                                minlength="8"
                                pattern="(?=.*\\d)(?=.*[a-z])(?=.*[A-Z]).{8,}"
                                title="Must contain at least one number, one uppercase and lowercase letter, and at least 8 characters"
                                autocomplete="new-password">
                        </div>
                    </div>

                    <div>
                        <label for="confirmPassword" class="block text-sm font-medium text-gray-700">
                            Confirm Password
                        </label>
                        <div class="mt-1">
                            <input id="confirmPassword" name="confirmPassword" type="password" required
                                class="appearance-none block w-full px-3 py-2 border border-gray-300 
                                rounded-md shadow-sm placeholder-gray-400 focus:outline-none 
                                focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                autocomplete="new-password">
                        </div>
                    </div>

                    <div>
                        <button type="submit"
                            class="w-full flex justify-center py-2 px-4 border border-transparent 
                            rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 
                            hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 
                            focus:ring-blue-500">
                            Sign up
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
    try {
      const data = await req.formData();

      const requiredFields = ["username", "email", "password"];
      for (const field of requiredFields) {
        if (!data.has(field)) {
          throw new Error(`Missing required field: ${field}`);
        }
      }

      const user: User = {
        id: crypto.randomUUID(),
        username: (data.get("username") as string) || "",
        email: (data.get("email") as string) || "",
        passwordHash: await auth.hashPassword(data.get("password") as string),
        createdAt: new Date(),
      };

      await db.createUser(user);
      const token = await auth.createToken(user.id);

      const response = new Response(null, {
        status: 301,
        headers: {
          Location: adminUrl,
        },
      });

      // Sign the user in by setting the token in a cookie
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
    } catch (error) {
      return new Response(error.message, {
        status: 400,
      });
    }
  }
})();
