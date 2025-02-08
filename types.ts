import { CacheLine } from "./cache.ts";

export interface Site {
  subdomain: string;
  prompt: string;
  userId: string;
}

declare global {
  // Add URLPattern types for TypeScript
  interface URLPatternInit {
    protocol?: string;
    username?: string;
    password?: string;
    hostname?: string;
    port?: string;
    pathname?: string;
    search?: string;
    hash?: string;
    baseURL?: string;
  }

  interface URLPattern {
    test: (input: string | URL) => boolean;
  }

  var URLPattern: {
    prototype: URLPattern;
    new (init?: URLPatternInit): URLPattern;
  };
}

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
