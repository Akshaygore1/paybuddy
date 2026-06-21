# How-To Guide

This project is a **full-stack Cloudflare Workers app** built with the [Better-T-Stack](https://github.com/AmanVarshney01/create-better-t-stack). It uses React Router (SPA mode) on the frontend, Hono + tRPC on the backend, Drizzle ORM with Cloudflare D1, and Better Auth for authentication. Infrastructure is managed declaratively by [Alchemy](https://alchemy.run).

---

## Project Structure

```
my-better-t-app/
├── apps/
│   ├── web/                    # React Router SPA frontend (Vite)
│   │   └── src/
│   │       ├── routes/         # Page components (file-based routing)
│   │       ├── components/     # Shared UI components
│   │       ├── lib/            # Client libraries (auth client, etc.)
│   │       └── utils/          # tRPC client setup, etc.
│   └── server/                 # Hono Worker backend
│       └── src/
│           └── index.ts        # Server entrypoint: Hono app + tRPC + auth
├── packages/
│   ├── api/                    # tRPC routers (shared between server & client)
│   │   └── src/
│   │       ├── index.ts        # tRPC init (publicProcedure, protectedProcedure)
│   │       ├── context.ts      # tRPC context (session extraction)
│   │       └── routers/        # Router modules (todo, etc.)
│   ├── auth/                   # Better Auth setup (server-side)
│   │   └── src/index.ts
│   ├── db/                     # Drizzle ORM schema + migrations
│   │   ├── drizzle.config.ts   # Drizzle Kit config (D1 HTTP driver)
│   │   └── src/
│   │       ├── schema/         # Table definitions (auth.ts, todo.ts)
│   │       ├── migrations/     # SQL migration files
│   │       └── index.ts        # createDb() — returns Drizzle D1 instance
│   ├── env/                    # Environment variable schemas (server & web)
│   │   ├── env.d.ts            # Type inference from Alchemy bindings
│   │   └── src/
│   │       ├── server.ts       # Re-exports from cloudflare:workers
│   │       ├── web.ts          # VITE_-prefixed env vars via @t3-oss/env-core
│   │       └── cloudflare-local.ts
│   ├── infra/                  # Alchemy infrastructure definitions
│   │   ├── alchemy.run.ts      # Declares Workers, DB, bindings
│   │   └── .env                # ALCHEMY_PASSWORD
│   ├── ui/                     # shadcn/ui components
│   └── config/                 # Shared TS config (tsconfig.base.json)
├── package.json                # Root workspace config + scripts
├── vite.config.ts              # vite-plus config (lint, format, staged)
└── bts.jsonc                   # Better-T-Stack metadata (don't touch)
```

---

## How to Set Up Locally

**Prerequisites:** [Bun](https://bun.sh) 1.3+

```bash
bun install
```

That's it. The `.env` files are committed with dev defaults so you can run immediately.

---

## How to Run the Dev Server

```bash
bun run dev
```

This runs `vp run -r dev` (vite-plus), which executes the `dev` script in every workspace. Under the hood:

1. `packages/infra` runs `alchemy dev` — this spawns:
   - A **Miniflare 3** instance for the server Worker (port 3000)
   - A **D1 database** stored locally at `.alchemy/miniflare/v3/d1/*.sqlite`
   - Auto-applies any pending migrations
   - Emits the server URL as `VITE_SERVER_URL`
2. `apps/web` runs the Vite dev server (port 5173) with React Router

**Two things start simultaneously:**
| Service | URL | What it runs |
|---------|-----|-------------|
| Web frontend | `http://localhost:5173` | React Router (Vite dev server) |
| API server | `http://localhost:3000` | Hono Worker (Miniflare) |

Or run them individually:

```bash
bun run dev:server    # Just the backend (port 3000)
bun run dev:web       # Just the frontend (port 5173)
```

### Local Environment

| File | Purpose |
|------|---------|
| `apps/server/.env` | Server env: `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `CORS_ORIGIN` |
| `apps/web/.env` | Web env: `VITE_SERVER_URL=http://localhost:3000` |
| `packages/infra/.env` | `ALCHEMY_PASSWORD` (change before deploying) |

The local D1 database lives at `.alchemy/miniflare/v3/d1/` (gitignored).

---

## How to Create a tRPC API

tRPC routers live in `packages/api/src/routers/`.

### 1. Create a router file

```ts
// packages/api/src/routers/items.ts
import { createDb } from "@my-better-t-app/db";
import { z } from "zod";
import { router, publicProcedure, protectedProcedure } from "../index";

export const itemRouter = router({

  // Public — no auth required
  list: publicProcedure.query(async () => {
    const db = createDb();
    return db.select().from(someTable);
  }),

  // Protected — throws UNAUTHORIZED if no session
  create: protectedProcedure
    .input(z.object({ name: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      // ctx.session.user is available
      const db = createDb();
      return db.insert(someTable).values({ name: input.name });
    }),
});
```

### 2. Register it in the app router

```ts
// packages/api/src/routers/index.ts
import { itemRouter } from "./items";

export const appRouter = router({
  healthCheck: publicProcedure.query(() => "OK"),
  item: itemRouter,  // <-- add this
});
```

The `AppRouter` type is automatically inferred and shared with the frontend — no codegen step needed.

### 3. Call it from the frontend

```ts
// In any React component or route
import { trpc } from "~/utils/trpc";

// Query
const { data } = trpc.item.list.useQuery();

// Mutation
const createItem = trpc.item.create.useMutation();
createItem.mutate({ name: "Hello" });
```

The tRPC client setup is in `apps/web/src/utils/trpc.ts`. It uses `httpBatchLink` pointing at `VITE_SERVER_URL/trpc`.

### Procedure Types

| Procedure | Auth Required | Use Case |
|-----------|--------------|----------|
| `publicProcedure` | No | Public data, login, signup |
| `protectedProcedure` | Yes (throws `UNAUTHORIZED`) | User-specific data, mutations |

---

## How to Create a Database Migration

The database uses **Drizzle ORM** with **Cloudflare D1** (SQLite).

### 1. Define your schema

```ts
// packages/db/src/schema/items.ts
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const items = sqliteTable("items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  userId: text("user_id").notNull(),
});
```

Export from the barrel:

```ts
// packages/db/src/schema/index.ts
export * from "./auth";
export * from "./todo";
export * from "./items";
```

### 2. Generate the migration

```bash
bun run db:generate
```

This runs `drizzle-kit generate` (configured in `packages/db/drizzle.config.ts`) which:
- Reads your schema from `packages/db/src/schema/`
- Compares it against the last snapshot in `packages/db/src/migrations/meta/`
- Produces a new SQL file like `0001_floating_ironman.sql`
- Updates the journal in `packages/db/src/migrations/meta/_journal.json`

### 3. Apply the migration

Migrations are applied automatically when you run `bun run dev` or `bun run deploy` — Alchemy picks up any new SQL files in the migrations directory and applies them to the D1 database.

If you need to apply them manually (e.g. to production), use:

```bash
bunx wrangler d1 migrations apply my-better-t-app-db --remote
```

> **Tip:** The migration directory is configured in `packages/infra/alchemy.run.ts`:
> ```ts
> D1Database("database", { migrationsDir: "../../packages/db/src/migrations" })
> ```

---

## How Authentication Works

**Better Auth** handles all auth, configured in `packages/auth/src/index.ts`.

### What's supported

- **Email + password** signup/login
- **GitHub OAuth**
- Cookie-based sessions

### Server side

The Hono server in `apps/server/src/index.ts` delegates auth routes to Better Auth:

```ts
app.on(["POST", "GET"], "/api/auth/*", (c) => createAuth().handler(c.req.raw));
```

All auth endpoints live under `/api/auth/` — signup, signin, signout, session, etc.

### Client side

The web app uses `better-auth/react`:

```ts
// apps/web/src/lib/auth-client.ts
import { createAuthClient } from "better-auth/react";
export const authClient = createAuthClient({ baseURL: env.VITE_SERVER_URL });
```

### Session in tRPC

The tRPC context (`packages/api/src/context.ts`) extracts the session from request headers on every call:

```ts
const session = await createAuth().api.getSession({
  headers: context.req.raw.headers,
});
```

Use `protectedProcedure` to require authentication — it throws `UNAUTHORIZED` if there's no session.

### Auth Tables

Better Auth manages four tables: `user`, `session`, `account` (OAuth links), `verification` (email verification codes). All defined in `packages/db/src/schema/auth.ts`.

---

## How to Deploy

### Prerequisites

1. Change `ALCHEMY_PASSWORD` in `packages/infra/.env` to something secure.
2. Update `apps/server/.env` with production values for `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `CORS_ORIGIN`.
3. Update `apps/web/.env` with production `VITE_SERVER_URL`.
4. Make sure you're logged in to Cloudflare:
   ```bash
   bunx wrangler login
   ```

### Deploy

```bash
bun run deploy
```

This runs `vp run --filter @my-better-t-app/infra deploy` which calls `alchemy deploy`.

Alchemy will:
1. Build the server Worker and web app
2. Provision/update Cloudflare resources (Workers, D1 database, etc.)
3. Upload assets and deploy Workers
4. Apply any pending D1 migrations

### Destroy (tear down)

```bash
bun run destroy
```

This calls `alchemy destroy` to remove all provisioned Cloudflare resources.

---

## Local vs Deployed

| Aspect | Local | Deployed |
|--------|-------|----------|
| **Server runtime** | Miniflare 3 (simulated Workers) | Cloudflare Workers (global network) |
| **Database** | Local `.sqlite` file in `.alchemy/miniflare/` | Cloudflare D1 (serverless SQLite) |
| **Migrations** | Auto-applied on `alchemy dev` | Auto-applied on `alchemy deploy` |
| **Frontend** | Vite dev server (HMR) | Static assets served from Cloudflare |
| **Auth** | Local sessions (stored in local SQLite) | Production sessions in D1 |
| **Infra state** | None (ephemeral) | Managed by Alchemy in Cloudflare |
| **Env vars** | From `.env` files | Set via Alchemy bindings |

### Key difference: cookie handling

The auth config in `packages/auth/src/index.ts` has commented-out settings for production. Before deploying, uncomment:

```ts
// For *.workers.dev domains:
session: {
  cookieCache: { enabled: true, maxAge: 60 },
},

// For custom subdomains:
advanced: {
  crossSubDomainCookies: {
    enabled: true,
    domain: "<your-workers-subdomain>",
  },
},
```

---

## How to Add a New Database Table

1. Create the schema file in `packages/db/src/schema/`
2. Export it from `packages/db/src/schema/index.ts`
3. Run `bun run db:generate` to create the migration
4. Restart dev server (`bun run dev`) to apply it
5. Add tRPC routes in `packages/api/src/routers/` and register in `index.ts`

---

## Code Quality Commands

```bash
bun run check        # Type-check all workspace packages
bun run lint         # Run linter across the project
bun run format       # Auto-format code
```

These run via `vite-plus` (`vp`), configured in the root `vite.config.ts`.

---

## Key Technologies

| Layer | Tech | Role |
|-------|------|------|
| **Frontend** | React Router 7 (SPA) | Pages, routing, components |
| **UI primitives** | shadcn/ui | `packages/ui` — themed components |
| **Backend** | Hono + tRPC | Server, API, type-safe RPC |
| **ORM** | Drizzle | Type-safe SQL (SQLite dialect) |
| **Database** | Cloudflare D1 | Serverless SQLite |
| **Auth** | Better Auth | Sessions, OAuth, email/password |
| **Infra** | Alchemy | Declarative Cloudflare management |
| **Build/tooling** | vite-plus (`vp`) | Unified build, lint, format |
| **Package manager** | Bun | Install, run, workspace management |
