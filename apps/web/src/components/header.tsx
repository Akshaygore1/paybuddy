import { NavLink } from "react-router";

import UserMenu from "./user-menu";

export default function Header() {
  return (
    <aside className="flex border-b border-border bg-card/60 px-4 py-4 md:min-h-svh md:flex-col md:border-b-0 md:border-r">
      <div className="flex w-full items-center justify-between gap-4 md:flex-1 md:flex-col md:items-stretch md:justify-start">
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground">
            Paybuddy
          </p>
          <nav className="flex gap-2 md:flex-col">
            <NavLink
              to="/dashboard"
              end
              className={({ isActive }) =>
                [
                  "rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                ].join(" ")
              }
            >
              Dashboard
            </NavLink>
          </nav>
        </div>
        <div className="md:mt-auto">
          <UserMenu />
        </div>
      </div>
    </aside>
  );
}
