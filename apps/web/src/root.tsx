import { Toaster } from "@paybuddy/ui/components/sonner";
import { QueryClientProvider } from "@tanstack/react-query";

import "./index.css";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@paybuddy/ui/components/sidebar";
import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLocation,
} from "react-router";

import type { Route } from "./+types/root";
import AppSidebar from "./components/app-sidebar";
import Loader from "./components/loader";
import { ThemeProvider } from "./components/theme-provider";
import { queryClient } from "./utils/trpc";

export const links: Route.LinksFunction = () => [];

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body suppressHydrationWarning>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export function HydrateFallback() {
  return (
    <main className="grid min-h-svh place-items-center px-4">
      <Loader />
    </main>
  );
}

export default function App() {
  const location = useLocation();
  const isAuthRoute = location.pathname === "/sign-in";

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider
        attribute="class"
        defaultTheme="light"
        forcedTheme="light"
        disableTransitionOnChange
        enableSystem={false}
        storageKey="vite-ui-theme"
      >
        {isAuthRoute ? (
          <Outlet />
        ) : (
          <SidebarProvider>
            <AppSidebar />
            <SidebarInset>
              <header className="sticky top-0 z-20 flex h-14 items-center border-b border-border/70 bg-background/80 px-4 backdrop-blur">
                <SidebarTrigger />
                <div className="ml-3 min-w-0">
                  <p className="text-sm font-semibold tracking-tight">Paybuddy</p>
                </div>
              </header>
              <div className="min-w-0 flex-1">
                <Outlet />
              </div>
            </SidebarInset>
          </SidebarProvider>
        )}
        <Toaster richColors />
      </ThemeProvider>
      <ReactQueryDevtools position="bottom" buttonPosition="bottom-right" />
    </QueryClientProvider>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = "Oops!";
  let details = "An unexpected error occurred.";
  let stack: string | undefined;
  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "404" : "Error";
    details =
      error.status === 404 ? "The requested page could not be found." : error.statusText || details;
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }
  return (
    <main className="pt-16 p-4 container mx-auto">
      <h1>{message}</h1>
      <p>{details}</p>
      {stack && (
        <pre className="w-full p-4 overflow-x-auto">
          <code>{stack}</code>
        </pre>
      )}
    </main>
  );
}
