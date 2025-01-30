export interface RequestHandler {
  get(req: Request): Promise<Response>;
  post(req: Request): Promise<Response>;
  put(req: Request): Promise<Response>;
  delete(req: Request): Promise<Response>;
  patch(req: Request): Promise<Response>;
}

export interface User {
  id: string;
  username: string;
  email: string;
  passwordHash: string;
  createdAt: Date;
}

export interface SignupRequest {
  username: string;
  email: string;
  password: string;
}

export interface LoginRequest {
  email: string;
  password: string;
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

export type Route = {
  pattern: URLPattern;
  handler: RequestHandler;
};

export type SupportedContentType = "html" | "css" | "js" | "media";
