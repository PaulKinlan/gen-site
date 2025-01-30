export interface User {
  id: string;
  email: string;
  passwordHash: string;
}

export interface Site {
  subdomain: string;
  prompt: string;
  userId: string;
}

export interface RequestContext {
  previousRequests: {
    path: string;
    content: string;
  }[];
}
export type SupportedContentType = "html" | "css" | "js" | "media";
