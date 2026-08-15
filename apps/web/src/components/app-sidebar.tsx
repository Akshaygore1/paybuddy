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
} from "@tds-nivaran/ui/components/sidebar";
import {
  Building2Icon,
  BriefcaseBusinessIcon,
  FileTextIcon,
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
} from "@tds-nivaran/ui/components/select";

import { authClient } from "@/lib/auth-client";
import {
  getPayrollFinancialYearLabel,
  isPayrollFinancialYearStart,
  payrollFinancialYearStartValues,
} from "@tds-nivaran/api/payroll-financial-year";
import {
  getSelectedFinancialYearStart,
  setSelectedFinancialYearStart,
  subscribeSelectedFinancialYear,
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
  {
    title: "Reports",
    to: "/reports",
    icon: FileTextIcon,
  },
];

export default function AppSidebar() {
  const location = useLocation();
  const { data: session } = authClient.useSession();
  const financialYearStart = React.useSyncExternalStore(
    subscribeSelectedFinancialYear,
    getSelectedFinancialYearStart,
    getSelectedFinancialYearStart,
  );
  const visibleNavigationItems = (() => {
    if (session?.user.role === "admin") {
      return [
        navigationItems[0],
        {
          title: "Institution",
          to: "/institutions",
          icon: Building2Icon,
        },
        {
          title: "Manage Custom Fields",
          to: "/admin/custom-fields",
          icon: BriefcaseBusinessIcon,
        },
        navigationItems[4],
      ];
    }

    return navigationItems;
  })();

  function updateFinancialYear(value: string | null) {
    const nextFinancialYearStart = Number(value);

    if (!isPayrollFinancialYearStart(nextFinancialYearStart)) {
      return;
    }

    setSelectedFinancialYearStart(nextFinancialYearStart);
  }

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="gap-3 p-3">
        <div className="flex items-center gap-3 overflow-hidden group-data-[collapsible=icon]:justify-center">
          <div className="min-w-0 group-data-[collapsible=icon]:hidden">
            <p className="truncate font-semibold tracking-tight">TDS Nivaran Payroll Portal</p>
            <p className="truncate text-xs text-sidebar-foreground/70">Workspace</p>
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
        {session ? (
          <>
            <SidebarSeparator />
            <SidebarGroup className="group-data-[collapsible=icon]:hidden">
              <SidebarGroupLabel>Financial Year</SidebarGroupLabel>
              <SidebarGroupContent className="px-2">
                <Select value={String(financialYearStart)} onValueChange={updateFinancialYear}>
                  <SelectTrigger aria-label="Select financial year">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {payrollFinancialYearStartValues.map((yearStart) => (
                        <SelectItem key={yearStart} value={String(yearStart)}>
                          {getPayrollFinancialYearLabel(yearStart)}
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
