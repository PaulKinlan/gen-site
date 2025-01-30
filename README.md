# Gen Site Specification

A multi-user system that allows users to create and manage their own websites via single description in a prompt.

# Backend

Runtime: Deno / TS
Hosting: Deno Deploy

## Main page

makemy.blog - the main admin UI. There will be a sign up and login page. Once logged in, the user will be able to create a new site.

## Sites / Subdomains (user configured sites)

[subdomain].makemy.blog - each subdomain is a user's configured site. The susbdomain will be the site's unique identifier.

There will be only one request handler for a configured site. It wil generate the required content based on the request URL, configured prompt and any previous content for other content that was generated on previous requests.

For example, when the user goes to [subdomain].makemy.blog/index.html, the server (using Claude Sonnet) will generate the HTML for the index based on the prompt. Subsequent assets such as CSS and JS will be generated based on the requests generated in the HTML (The HTML will be added context).

I.e Prompt:

```
You are an AI content generator that creates web content for the following site:\n\n${siteDescription}`;

  const contextPrompt =
    context.previousRequests.length > 0
      ? `\n\nContext from previous requests:\n${context.previousRequests
          .map((req) => `<file name="${req.path}">\n${req.content}\n</file>`)
          .join("\n\n")}`
      : "";

  const typeSpecificPrompt = getTypeSpecificPrompt(contentType);

  return `${basePrompt}${contextPrompt}\n\n${typeSpecificPrompt}\n\nGenerate ${contentType.toUpperCase()} content for the path "${path}".
```

# Admin Frontend / UI

Language: Typescript
Framework: None.

- The UI will list all the sites that a user creates.
- For each site, there will be single prompt that the user will enter that will describe the entire contents of their site.
- The user will be able to edit the prompt.
- The siten ame will be generated from 3 random words
- The siten ame will be checked against existing names to ensure uniqueness. If there is a clash, the user will be prompted to enter a new prompt (or regenerate)
- The site name can be randomly regenerated
