import { BaseHandler } from "@makemy/routes/base.ts";
import { authenticated } from "@makemy/routes/decorators/authenticated.ts";
import { db } from "@makemy/core/db.ts";
import { CustomDomain } from "@makemy/types.ts";

const SAAS_DOMAINS_API_KEY = Deno.env.get("SAAS_DOMAINS_API_KEY");
const ACCOUNT_UUID = Deno.env.get("SAAS_DOMAINS_ACCOUNT_UUID");
const UPSTREAM_UUID = Deno.env.get("SAAS_DOMAINS_UPSTREAM_UUID");

if (!SAAS_DOMAINS_API_KEY || !ACCOUNT_UUID || !UPSTREAM_UUID) {
  console.error("Missing required SaaS Custom Domains configuration");
}

async function createCustomDomain(host: string): Promise<CustomDomain> {
  const response = await fetch(
    `https://app.saascustomdomains.com/api/v1/accounts/${ACCOUNT_UUID}/upstreams/${UPSTREAM_UUID}/custom_domains`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SAAS_DOMAINS_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ host }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create custom domain: ${error}`);
  }

  const data = await response.json();
  return {
    uuid: data.uuid,
    host: data.host,
    status: data.status,
    tls_certificate_issued: data.tls_certificate_issued,
    created_at: new Date(data.created_at),
    updated_at: new Date(data.updated_at),
  };
}

async function deleteCustomDomain(domainUuid: string): Promise<void> {
  const response = await fetch(
    `https://app.saascustomdomains.com/api/v1/accounts/${ACCOUNT_UUID}/upstreams/${UPSTREAM_UUID}/custom_domains/${domainUuid}`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${SAAS_DOMAINS_API_KEY}`,
      },
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to delete custom domain: ${error}`);
  }
}

class DomainsHandler extends BaseHandler {
  @authenticated({ redirect: "/login" })
  override async get(req: Request): Promise<Response> {
    try {
      const url = new URL(req.url);
      const subdomain = url.searchParams.get("subdomain");

      if (!subdomain) {
        throw new Error("Missing subdomain parameter");
      }

      const site = await db.getSite(subdomain);
      if (!site || site.userId !== req.extraInformation?.userId) {
        throw new Error("Site not found or unauthorized");
      }

      return new Response(
        JSON.stringify({ customDomains: site.customDomains || [] }),
        {
          headers: { "Content-Type": "application/json" },
        }
      );
    } catch (error) {
      return new Response((error as Error).message, { status: 400 });
    }
  }

  @authenticated({ redirect: "/login" })
  override async post(req: Request): Promise<Response> {
    try {
      const { subdomain, domain } = await req.json();

      if (!subdomain || !domain) {
        throw new Error("Missing required fields");
      }

      const site = await db.getSite(subdomain);
      if (!site || site.userId !== req.extraInformation?.userId) {
        throw new Error("Site not found or unauthorized");
      }

      // Create domain in SaaS Custom Domains
      const customDomain = await createCustomDomain(domain);

      // Add domain to site
      await db.addCustomDomain(subdomain, customDomain);

      return new Response(JSON.stringify(customDomain), {
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      return new Response((error as Error).message, { status: 400 });
    }
  }

  @authenticated({ redirect: "/login" })
  override async delete(req: Request): Promise<Response> {
    try {
      const url = new URL(req.url);
      const subdomain = url.searchParams.get("subdomain");
      const host = url.searchParams.get("host");

      if (!subdomain || !host) {
        throw new Error("Missing required parameters");
      }

      const site = await db.getSite(subdomain);
      if (!site || site.userId !== req.extraInformation?.userId) {
        throw new Error("Site not found or unauthorized");
      }

      const domain = site.customDomains?.find((d) => d.host === host);
      if (!domain) {
        throw new Error("Domain not found");
      }

      // Delete domain from SaaS Custom Domains
      await deleteCustomDomain(domain.uuid);

      // Remove domain from site
      await db.removeCustomDomain(subdomain, host);

      return new Response(null, { status: 204 });
    } catch (error) {
      return new Response((error as Error).message, { status: 400 });
    }
  }
}

export default new DomainsHandler();
