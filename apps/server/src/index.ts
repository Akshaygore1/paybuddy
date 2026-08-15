import { trpcServer } from "@hono/trpc-server";
import { createContext } from "@tds-nivaran/api/context";
import { appRouter } from "@tds-nivaran/api/routers/index";
import { createAuth, userRoles } from "@tds-nivaran/auth";
import { createDb } from "@tds-nivaran/db";
import { account, session, user } from "@tds-nivaran/db/schema/auth";
import { env } from "@tds-nivaran/env/server";
import {
  cleanupE2EInstitutions,
  cleanupSchema,
  resetE2ETenant,
  resetTenantSchema,
} from "./e2e-operations";
import { APIError } from "better-auth";
import { eq } from "drizzle-orm";
import { Hono, type Context } from "hono";
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

function e2eOperationsDisabled(c: Context) {
  if (env.E2E_OPERATIONS_ENABLED === "true") {
    return null;
  }

  return c.json(
    {
      message: "E2E operational endpoints are disabled",
    },
    404,
  );
}

async function requireAdminSession(c: Context) {
  const currentSession = await auth.api.getSession({
    headers: c.req.raw.headers,
  });

  if (!currentSession) {
    return c.json({ message: "Authentication required" }, 401);
  }
  if (currentSession.user.role !== "admin") {
    return c.json({ message: "Administrator role required" }, 403);
  }

  return null;
}

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
  const existingUser = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, email))
    .get();

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
  const existingUser = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, email))
    .get();

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

app.post("/api/e2e/tenant/reset", async (c) => {
  const disabledResponse = e2eOperationsDisabled(c);
  if (disabledResponse) {
    return disabledResponse;
  }

  const authFailure = await requireAdminSession(c);
  if (authFailure) {
    return authFailure;
  }

  const parsedBody = resetTenantSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsedBody.success) {
    return c.json(
      {
        message: "Invalid E2E tenant reset request",
        issues: parsedBody.error.flatten(),
      },
      400,
    );
  }

  try {
    const institution = await resetE2ETenant(db, auth, c.req.raw.headers, parsedBody.data);
    return c.json({ institution }, 200);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return c.json({ message }, 409);
  }
});

app.post("/api/e2e/institutions/cleanup", async (c) => {
  const disabledResponse = e2eOperationsDisabled(c);
  if (disabledResponse) {
    return disabledResponse;
  }

  const authFailure = await requireAdminSession(c);
  if (authFailure) {
    return authFailure;
  }

  const parsedBody = cleanupSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsedBody.success) {
    return c.json(
      {
        message: "Invalid E2E institution cleanup request",
        issues: parsedBody.error.flatten(),
      },
      400,
    );
  }

  try {
    const result = await cleanupE2EInstitutions(db, parsedBody.data);
    return c.json(result, 200);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return c.json({ message }, 409);
  }
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
