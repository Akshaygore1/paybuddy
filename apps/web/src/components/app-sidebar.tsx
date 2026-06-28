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
  Building2Icon,
  BriefcaseBusinessIcon,
  LayoutDashboardIcon,
  ReceiptIndianRupeeIcon,
  WalletCardsIcon,
} from "lucide-react";
import * as React from "react";
import { NavLink, useLocation } from "react-router";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@paybuddy/ui/components/select";

import { authClient } from "@/lib/auth-client";
import {
  financialYearOptions,
  getFinancialYearLabel,
  readSelectedFinancialYearStart,
  writeSelectedFinancialYearStart,
  type FinancialYearStart,
} from "@/lib/financial-year";

import UserMenu from "./user-menu";

const navigationItems = [
  {
    title: "Dashboard",
    to: "/dashboard",
    icon: LayoutDashboardIcon,
  },
  {
    title: "Employee",
    to: "/employee",
    icon: WalletCardsIcon,
  },
  {
    title: "Employee Setup",
    to: "/institution-settings",
    icon: BriefcaseBusinessIcon,
  },
  {
    title: "Payroll",
    to: "/payroll",
    icon: ReceiptIndianRupeeIcon,
  },
];

export default function AppSidebar() {
  const location = useLocation();
  const { data: session } = authClient.useSession();
  const [financialYearStart, setFinancialYearStart] =
    React.useState<FinancialYearStart>(() => readSelectedFinancialYearStart());
  const visibleNavigationItems = (() => {
    if (session?.user.role === "admin") {
      return [
        navigationItems[0],
        {
          title: "Institution",
          to: "/institutions",
          icon: Building2Icon,
        },
      ];
    }

    return navigationItems;
  })();

  function updateFinancialYear(value: string | null) {
    const nextFinancialYearStart = Number(value) as FinancialYearStart;

    if (!financialYearOptions.includes(nextFinancialYearStart)) {
      return;
    }

    setFinancialYearStart(nextFinancialYearStart);
    writeSelectedFinancialYearStart(nextFinancialYearStart);
  }

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
              {visibleNavigationItems.map((item) => (
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
        {session?.user.role === "user" ? (
          <>
            <SidebarSeparator />
            <SidebarGroup className="group-data-[collapsible=icon]:hidden">
              <SidebarGroupLabel>Financial Year</SidebarGroupLabel>
              <SidebarGroupContent className="px-2">
                <Select
                  value={String(financialYearStart)}
                  onValueChange={updateFinancialYear}
                >
                  <SelectTrigger aria-label="Select financial year">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {financialYearOptions.map((yearStart) => (
                        <SelectItem key={yearStart} value={String(yearStart)}>
                          {getFinancialYearLabel(yearStart)}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        ) : null}
      </SidebarContent>
      <SidebarFooter className="p-3 group-data-[collapsible=icon]:hidden">
        <UserMenu />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
