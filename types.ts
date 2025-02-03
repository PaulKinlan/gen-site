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

export interface Route {
  pattern: URLPattern;
  handler: {
    get(req: Request): Promise<Response>;
    post?(req: Request): Promise<Response>;
    put?(req: Request): Promise<Response>;
    delete?(req: Request): Promise<Response>;
  };
}

export interface RequestContext {
  previousRequests: {
    path: string;
    content: string;
  }[];
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
