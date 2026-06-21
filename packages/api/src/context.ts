import { createAuth } from "@paybuddy/auth";
import type { Context as HonoContext } from "hono";

export type CreateContextOptions = {
  context: HonoContext;
};

export async function createContext({ context }: CreateContextOptions) {
  const session = await createAuth().api.getSession({
    headers: context.req.raw.headers,
  });
  return {
    auth: null,
    headers: context.req.raw.headers,
    session,
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
