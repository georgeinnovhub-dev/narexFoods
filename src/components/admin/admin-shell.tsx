"use client";

/** Dashboard chrome: forest sidebar + sticky header + module router. */

import { useState, type ComponentType } from "react";
import { toast } from "sonner";
import {
  BarChart3,
  Bike,
  ClipboardList,
  ExternalLink,
  HandPlatter,
  LayoutDashboard,
  LogOut,
  MapPin,
  Megaphone,
  Menu as MenuIcon,
  Newspaper,
  Settings,
  UtensilsCrossed,
  Users,
  Wallet,
} from "lucide-react";
import { useAppStore } from "@/store/app-store";
import { useAdmin, type AdminModule } from "@/components/admin/admin-context";
import { initials } from "@/components/admin/admin-utils";
import { OverviewModule } from "@/components/admin/overview-module";
import { OrdersModule } from "@/components/admin/orders-module";
import { QuotesModule } from "@/components/admin/quotes-module";
import { ZonesModule } from "@/components/admin/zones-module";
import { MenuModule } from "@/components/admin/menu-module";
import { PaymentsModule } from "@/components/admin/payments-module";
import { StaffModule } from "@/components/admin/staff-module";
import { DispatchModule } from "@/components/admin/dispatch-module";
import { MarketingModule } from "@/components/admin/marketing-module";
import { ContentModule } from "@/components/admin/content-module";
import { ReportsModule } from "@/components/admin/reports-module";
import { SystemModule } from "@/components/admin/system-module";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { apiSend } from "@/lib/client";

interface NavItem {
  key: AdminModule;
  label: string;
  icon: ComponentType<{ className?: string }>;
  visible: (perms: string[], role: string) => boolean;
}

const NAV: NavItem[] = [
  { key: "overview", label: "Overview", icon: LayoutDashboard, visible: (p) => p.includes("orders.manage") },
  { key: "orders", label: "Orders", icon: ClipboardList, visible: (p) => p.includes("orders.manage") },
  { key: "quotes", label: "Catering Quotes", icon: HandPlatter, visible: (p) => p.includes("catering.manage") },
  { key: "menu", label: "Menu", icon: UtensilsCrossed, visible: (p) => p.includes("menu.manage") },
  { key: "payments", label: "Payments", icon: Wallet, visible: (p) => p.includes("payments.review") },
  { key: "staff", label: "Staff & Roles", icon: Users, visible: (p) => p.includes("staff.manage") },
  { key: "dispatch", label: "Dispatch", icon: Bike, visible: (p, r) => p.includes("dispatch.manage") || r === "Dispatcher" },
  { key: "zones", label: "Delivery Zones", icon: MapPin, visible: (p) => p.includes("zones.manage") },
  { key: "marketing", label: "Marketing", icon: Megaphone, visible: (p) => p.includes("marketing.manage") },
  { key: "content", label: "Website & Blog", icon: Newspaper, visible: (p) => p.includes("content.manage") },
  { key: "reports", label: "Reports", icon: BarChart3, visible: (p) => p.includes("reports.view") },
  { key: "system", label: "System", icon: Settings, visible: (p) => p.includes("settings.manage") || p.includes("audit.view") },
];

const MODULE_TITLES: Record<AdminModule, string> = {
  overview: "Overview",
  orders: "Orders",
  quotes: "Catering Quotes",
  menu: "Menu management",
  payments: "Payments",
  staff: "Staff & roles",
  dispatch: "Dispatch",
  zones: "Delivery Zones",
  marketing: "Marketing",
  content: "Website & blog",
  reports: "Reports",
  system: "System",
};

const MODULE_COMPONENTS: Record<AdminModule, ComponentType> = {
  overview: OverviewModule,
  orders: OrdersModule,
  quotes: QuotesModule,
  menu: MenuModule,
  payments: PaymentsModule,
  staff: StaffModule,
  dispatch: DispatchModule,
  zones: ZonesModule,
  marketing: MarketingModule,
  content: ContentModule,
  reports: ReportsModule,
  system: SystemModule,
};

export function AdminShell() {
  const staff = useAppStore((s) => s.staff);
  const setStaff = useAppStore((s) => s.setStaff);
  const navigate = useAppStore((s) => s.navigate);
  const { activeModule: module, setModule } = useAdmin();
  const [mobileOpen, setMobileOpen] = useState(false);

  if (!staff) return null;
  const perms = staff.permissions;
  const role = staff.role;
  const visibleNav = NAV.filter((n) => n.visible(perms, role));
  const ActiveModule = MODULE_COMPONENTS[visibleNav.some((n) => n.key === module) ? module : (visibleNav[0]?.key ?? "overview")];

  async function logout() {
    try {
      await apiSend("/api/auth/logout", "POST");
    } catch {
      // cookie already gone — proceed
    }
    setStaff(null);
    toast.success("Signed out. See you soon.");
  }

  const navList = (
    <nav className="flex flex-1 flex-col gap-1 px-3" aria-label="Admin modules">
      {visibleNav.map((item) => {
        const Icon = item.icon;
        const active = module === item.key;
        return (
          <button
            key={item.key}
            type="button"
            onClick={() => {
              setModule(item.key);
              setMobileOpen(false);
            }}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-colors",
              active ? "bg-[#0F2A20] text-cream shadow-inner" : "text-cream/70 hover:bg-white/5 hover:text-cream"
            )}
          >
            <Icon className={cn("h-4.5 w-4.5 shrink-0", active ? "text-gold" : "text-cream/60")} />
            {item.label}
          </button>
        );
      })}
    </nav>
  );

  const brand = (
    <div className="flex items-center gap-3 px-5 py-5">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gold shadow">
        <UtensilsCrossed className="h-5 w-5 text-forest" aria-hidden="true" />
      </span>
      <div className="leading-tight">
        <p className="font-display text-base font-bold text-cream">NAREX Foods</p>
        <p className="text-[11px] uppercase tracking-widest text-gold/90">Operations Hub</p>
      </div>
    </div>
  );

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-cream">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col bg-forest lg:flex">
        {brand}
        <Separator className="bg-white/10" />
        {navList}
        <div className="px-5 py-4">
          <p className="text-[11px] leading-relaxed text-cream/40">NAREX Foods · Engineered by iDe8 Flow Hub</p>
        </div>
      </aside>

      {/* Mobile sidebar */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-72 border-0 bg-forest p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>Admin navigation</SheetTitle>
          </SheetHeader>
          <div className="flex h-full flex-col">
            {brand}
            <Separator className="bg-white/10" />
            {navList}
            <div className="px-5 py-4">
              <p className="text-[11px] text-cream/40">NAREX Foods · iDe8 Flow Hub</p>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center gap-3 border-b border-border bg-cream px-4 lg:px-6">
          <Button
            variant="outline"
            size="icon"
            className="lg:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation menu"
          >
            <MenuIcon className="h-5 w-5" />
          </Button>
          <h1 className="font-display truncate text-lg font-bold text-forest">{MODULE_TITLES[module]}</h1>
          <div className="ml-auto flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("home")}
              className="hidden border-forest/20 text-forest hover:bg-forest/5 sm:inline-flex"
            >
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
              View storefront
            </Button>
            <Button variant="ghost" size="icon" className="text-forest sm:hidden" onClick={() => navigate("home")} aria-label="View storefront">
              <ExternalLink className="h-4 w-4" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex items-center gap-2 rounded-full border border-border bg-card py-1 pl-1 pr-3 transition-colors hover:bg-accent"
                  aria-label="Account menu"
                >
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-forest text-xs font-semibold text-cream">{initials(staff.name)}</AvatarFallback>
                  </Avatar>
                  <span className="hidden text-left leading-tight md:block">
                    <span className="block max-w-[140px] truncate text-sm font-semibold text-foreground">{staff.name}</span>
                    <span className="block text-[11px] text-muted-foreground">{staff.role}</span>
                  </span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <p className="text-sm font-semibold">{staff.name}</p>
                  <p className="text-xs font-normal text-muted-foreground">{staff.email}</p>
                  <p className="mt-1 text-[11px] font-medium text-gold">{staff.role}</p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate("home")}>
                  <ExternalLink className="h-4 w-4" /> View storefront
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => window.location.reload()}>
                  <LayoutDashboard className="h-4 w-4" /> Reload dashboard
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onClick={logout}>
                  <LogOut className="h-4 w-4" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 lg:p-6" id="admin-main">
          <ActiveModule />
        </main>
      </div>
    </div>
  );
}
