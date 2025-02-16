import { CacheLine } from "./core/cache.ts";

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
  versionUuid: string;
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
  url: URL;
  previousRequests: CacheLine[];
  importedContext: { url: string; markdown: string }[];
}

export type SupportedContentType =
  | "html"
  | "css"
  | "js"
  | "media"
  | "javascript"
  | "image";

export type UnsupportedContentType = "unsupported";

export interface PromptLog {
  prompt: string;
  system: string;
  site: Site;
  timestamp: Date;
  images?: UserImage[]; // Optional array of images used in the prompt
}

export interface ImageGenerationContext {
  path: string;
  prompt: string;
  style?: string;
  width?: number;
  height?: number;
  alt?: string;
}

export interface UserImage {
  id: string;
  subdomain: string;
  filename: string;
  mimeType: string;
  width?: number;
  height?: number;
  createdAt: Date;
}

export interface ImageResizeOptions {
  width?: number;
  height?: number;
  fit?: "cover" | "contain" | "fill" | "inside" | "outside";
}

declare global {
  // Keep URLPattern declaration at top level
  interface Request {
    extraInformation?: {
      userId: string;
      session: string;
    };
  }
}
