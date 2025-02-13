import { db } from "@makemy/core/db.ts";
import { authenticated } from "@makemy/routes/decorators/authenticated.ts";
import { BaseHandler } from "@makemy/routes/base.ts";
import { PromptLog } from "@makemy/types.ts";
import { escape } from "@std/html/entities";

const template = (logs: PromptLog[]) => `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Prompt Logs - makemy.blog</title>
    <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gray-50">
    <nav class="bg-white shadow-sm">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div class="flex justify-between h-16">
                <div class="flex-shrink-0 flex items-center">
                    <a href="/admin" class="text-xl font-bold">makemy.blog</a>
                </div>
            </div>
        </div>
    </nav>

    <div class="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div class="px-4 py-6 sm:px-0">
            <div class="border-4 border-dashed border-gray-200 rounded-lg p-6">
                <h2 class="text-2xl font-bold mb-6">Prompt Logs</h2>
                
                <div class="overflow-x-auto">
                    <table class="min-w-full divide-y divide-gray-200">
                        <thead class="bg-gray-50">
                            <tr>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Timestamp</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Site</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Prompt</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">System Prompt</th>
                            </tr>
                        </thead>
                        <tbody class="bg-white divide-y divide-gray-200">
                            ${logs
                              .map(
                                (log) => `
                                <tr>
                                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        ${new Date(
                                          log.timestamp
                                        ).toLocaleString()}
                                    </td>
                                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        ${log.site.subdomain}.itsmy.blog
                                    </td>
                                    <td class="px-6 py-4 text-sm text-gray-900">
                                        <div class="max-w-lg overflow-hidden">
                                            <code><pre> ${escape(
                                              log.prompt
                                            )}</pre></code>
                                        </div>
                                    </td>
                                    <td class="px-6 py-4 text-sm text-gray-900">
                                        <div class="max-w-lg overflow-hidden">
                                            <code><pre>${escape(
                                              log.system
                                            )}</pre></code>
                                        </div>
                                    </td>
                                </tr>
                            `
                              )
                              .join("")}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    </div>
</body>
</html>
`;

export default new (class extends BaseHandler {
  @authenticated({ redirect: "/login" })
  override async get(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const subdomain = url.searchParams.get("subdomain") || undefined;

    const logs = await db.getPromptLogs(subdomain);

    return new Response(template(logs), {
      headers: { "Content-Type": "text/html" },
    });
  }
})();
