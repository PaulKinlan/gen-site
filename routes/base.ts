import { RequestHandler } from "@makemy/types.ts";

export class BaseHandler implements RequestHandler {
  async get(req: Request): Promise<Response> {
    throw new Error("Not implemented");
  }

  async post(req: Request): Promise<Response> {
    throw new Error("Not implemented");
  }

  async put(req: Request): Promise<Response> {
    throw new Error("Not implemented");
  }

  async delete(req: Request): Promise<Response> {
    throw new Error("Not implemented");
  }

  async patch(req: Request): Promise<Response> {
    throw new Error("Not implemented");
  }
}
