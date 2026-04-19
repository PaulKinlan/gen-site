import { getCookies } from "@std/http/cookie";
import { db } from "../../core/db.ts";

export function authenticated(options: { redirect: string }) {
  return function (
    target: (req: Request) => Promise<Response>,
    _context: ClassMethodDecoratorContext
  ) {
    async function authenticatedMethod(
      this: unknown,
      ...args: [Request]
    ): Promise<Response> {
      const [req] = args;
      const { auth, session } = getCookies(req.headers);
      const redirectUrl = new URL(req.url);
      redirectUrl.pathname = options.redirect;

      if (!auth) {
        console.log("No auth");
        return Response.redirect(redirectUrl);
      }

      if (!session) {
        console.log("No session");
        return Response.redirect(redirectUrl);
      }

      const userId = await db.getSession(session);

      if (!userId) {
        console.log("No user id for sessions, user could be logged out");
        return Response.redirect(redirectUrl);
      }

      req.extraInformation = {
        userId,
        session,
      };

      return target.call(this, ...args);
    }

    return authenticatedMethod;
  };
}
