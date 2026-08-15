import type { Page, Route } from "@playwright/test";

export type UnrouteFn = () => Promise<void>;

function createTrpcErrorBody(status: number, message: string) {
  const code =
    status === 401
      ? "UNAUTHORIZED"
      : status === 403
        ? "FORBIDDEN"
        : status === 404
          ? "NOT_FOUND"
          : status === 400
            ? "BAD_REQUEST"
            : "INTERNAL_SERVER_ERROR";

  const jsonRpcCode =
    status === 401 ? -32001 : status === 400 ? -32600 : -32603;

  return JSON.stringify([
    {
      error: {
        message,
        code: jsonRpcCode,
        data: {
          code,
          httpStatus: status,
        },
      },
    },
  ]);
}

function createBetterAuthErrorBody(status: number, message: string) {
  return JSON.stringify({
    error: {
      message,
      status,
      statusText: message,
    },
  });
}

export async function simulateServerError(
  page: Page,
  urlPattern: string | RegExp,
  status = 500,
  errorMessage = "Internal server error occurred",
): Promise<UnrouteFn> {
  const handler = async (route: Route) => {
    const url = route.request().url();
    const isTrpc = url.includes("/trpc/");
    const isBetterAuth = url.includes("/api/auth/");

    const body = isTrpc
      ? createTrpcErrorBody(status, errorMessage)
      : isBetterAuth
        ? createBetterAuthErrorBody(status, errorMessage)
        : JSON.stringify({ error: errorMessage, message: errorMessage });

    await route.fulfill({
      status,
      contentType: "application/json",
      body,
    });
  };

  await page.route(urlPattern, handler);
  return async () => {
    await page.unroute(urlPattern, handler).catch(() => {});
  };
}

export async function simulateUnauthorized(
  page: Page,
  urlPattern: string | RegExp,
  errorMessage = "Session expired or unauthorized",
): Promise<UnrouteFn> {
  return simulateServerError(page, urlPattern, 401, errorMessage);
}

export async function simulateValidationFailure(
  page: Page,
  urlPattern: string | RegExp,
  errorMessage = "Invalid input or validation failed on server",
): Promise<UnrouteFn> {
  return simulateServerError(page, urlPattern, 400, errorMessage);
}

export async function simulateNetworkFailure(
  page: Page,
  urlPattern: string | RegExp,
): Promise<UnrouteFn> {
  const handler = async (route: Route) => {
    await route.abort("failed");
  };

  await page.route(urlPattern, handler);
  return async () => {
    await page.unroute(urlPattern, handler).catch(() => {});
  };
}

export async function simulateSlowResponse(
  page: Page,
  urlPattern: string | RegExp,
  delayMs = 1500,
): Promise<UnrouteFn> {
  const handler = async (route: Route) => {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    await route.continue();
  };

  await page.route(urlPattern, handler);
  return async () => {
    await page.unroute(urlPattern, handler).catch(() => {});
  };
}
