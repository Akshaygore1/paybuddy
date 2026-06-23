import { trpcServer } from "@hono/trpc-server";
import { createContext } from "@paybuddy/api/context";
import { appRouter } from "@paybuddy/api/routers/index";
import { createAuth, userRoles } from "@paybuddy/auth";
import { createDb } from "@paybuddy/db";
import { account, session, user } from "@paybuddy/db/schema/auth";
import { env } from "@paybuddy/env/server";
import { APIError } from "better-auth";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { z } from "zod";

const app = new Hono();
const auth = createAuth();
const db = createDb();

const bootstrapUserSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  email: z.email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: z.enum(userRoles),
});

const bootstrapDeleteUserSchema = z.object({
  email: z.email("Invalid email address"),
});

app.use(logger());
app.use(
  "/*",
  cors({
    origin: env.CORS_ORIGIN,
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization", "x-bootstrap-secret"],
    credentials: true,
  }),
);

app.post("/api/auth/sign-up/email", (c) => {
  return c.json(
    {
      message: "Public registration is disabled",
    },
    403,
  );
});

app.post("/api/bootstrap/users", async (c) => {
  const providedSecret = c.req.header("x-bootstrap-secret");

  if (!providedSecret || providedSecret !== env.BOOTSTRAP_API_SECRET) {
    return c.json(
      {
        message: "Invalid bootstrap secret",
      },
      401,
    );
  }

  const json = await c.req.json().catch(() => null);
  const parsedBody = bootstrapUserSchema.safeParse(json);

  if (!parsedBody.success) {
    return c.json(
      {
        message: "Invalid request body",
        issues: parsedBody.error.flatten(),
      },
      400,
    );
  }

  const { email, name, password, role } = parsedBody.data;
  const existingUser = await db.select({ id: user.id }).from(user).where(eq(user.email, email)).get();

  if (existingUser) {
    return c.json(
      {
        message: "A user with this email already exists",
      },
      409,
    );
  }

  try {
    const result = await auth.api.signUpEmail({
      headers: new Headers({
        origin: env.CORS_ORIGIN,
      }),
      body: {
        email,
        name,
        password,
      },
    });

    const [persistedUser] = await db
      .update(user)
      .set({ role })
      .where(eq(user.id, result.user.id))
      .returning();

    return c.json(
      {
        user: persistedUser ?? { ...result.user, role },
      },
      201,
    );
  } catch (error) {
    if (error instanceof APIError) {
      return Response.json(
        {
          message: error.message,
        },
        {
          status: error.statusCode || 400,
        },
      );
    }

    throw error;
  }
});

app.delete("/api/bootstrap/users", async (c) => {
  const providedSecret = c.req.header("x-bootstrap-secret");

  if (!providedSecret || providedSecret !== env.BOOTSTRAP_API_SECRET) {
    return c.json(
      {
        message: "Invalid bootstrap secret",
      },
      401,
    );
  }

  const json = await c.req.json().catch(() => null);
  const parsedBody = bootstrapDeleteUserSchema.safeParse(json);

  if (!parsedBody.success) {
    return c.json(
      {
        message: "Invalid request body",
        issues: parsedBody.error.flatten(),
      },
      400,
    );
  }

  const { email } = parsedBody.data;
  const existingUser = await db.select({ id: user.id }).from(user).where(eq(user.email, email)).get();

  if (!existingUser) {
    return c.json(
      {
        message: "User not found",
      },
      404,
    );
  }

  await db.delete(session).where(eq(session.userId, existingUser.id));
  await db.delete(account).where(eq(account.userId, existingUser.id));

  const [deletedUser] = await db.delete(user).where(eq(user.id, existingUser.id)).returning();

  return c.json(
    {
      user: deletedUser,
    },
    200,
  );
});

app.on(["POST", "GET"], "/api/auth/*", (c) => auth.handler(c.req.raw));

app.use(
  "/trpc/*",
  trpcServer({
    router: appRouter,
    createContext: (_opts, context) => {
      return createContext({ context });
    },
  }),
);

app.get("/", (c) => {
  return c.text("OK");
});

export default app;
