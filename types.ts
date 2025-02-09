import { CacheLine } from "./cache.ts";

export interface CustomDomain {
  uuid: string;
  host: string;
  status: string;
  tls_certificate_issued: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface Site {
  subdomain: string;
  prompt: string;
  userId: string;
  customDomains?: CustomDomain[];
}

// Using built-in Deno URLPattern types

export interface User {
  id: string;
  username: string;
  email: string;
  passwordHash: string;
  createdAt: Date;
}

export type ValidHTTPMethodForRoute = "get" | "post" | "put" | "delete";

export interface Route {
  pattern: URLPattern;
  handler: {
    [key in ValidHTTPMethodForRoute]: (req: Request) => Promise<Response>;
  };
}

export type RequestHandler = {
  [key in ValidHTTPMethodForRoute]: (req: Request) => Promise<Response>;
};

export interface RequestContext {
  previousRequests: CacheLine[];
}

export type SupportedContentType =
  | "html"
  | "css"
  | "js"
  | "media"
  | "javascript";

declare global {
  // Keep URLPattern declaration at top level
  interface Request {
    extraInformation?: {
      userId: string;
      session: string;
    };
  }
}
