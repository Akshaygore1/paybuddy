import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
} from "@paybuddy/ui/components/sidebar";
import {
  ArrowLeftRightIcon,
  LayoutDashboardIcon,
  SettingsIcon,
  WalletCardsIcon,
  WalletIcon,
} from "lucide-react";
import { NavLink, useLocation } from "react-router";

import UserMenu from "./user-menu";

const navigationItems = [
  {
    title: "Dashboard",
    to: "/dashboard",
    icon: LayoutDashboardIcon,
  },
  {
    title: "Transactions",
    to: "/transactions",
    icon: ArrowLeftRightIcon,
  },
  {
    title: "Wallet",
    to: "/wallet",
    icon: WalletIcon,
  },
  {
    title: "Settings",
    to: "/settings",
    icon: SettingsIcon,
  },
];

export default function AppSidebar() {
  const location = useLocation();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="gap-3 p-3">
        <div className="flex items-center gap-3 overflow-hidden group-data-[collapsible=icon]:justify-center">
          <div className="min-w-0 group-data-[collapsible=icon]:hidden">
            <p className="truncate font-semibold tracking-tight">
              Paybuddy Payroll Portal
            </p>
            <p className="truncate text-xs text-sidebar-foreground/70">
              Workspace
            </p>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Overview</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigationItems.map((item) => (
                <SidebarMenuItem key={item.to}>
                  <SidebarMenuButton
                    render={<NavLink to={item.to} end />}
                    isActive={location.pathname === item.to}
                    tooltip={item.title}
                  >
                    <item.icon />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-3 group-data-[collapsible=icon]:hidden">
        <UserMenu />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
