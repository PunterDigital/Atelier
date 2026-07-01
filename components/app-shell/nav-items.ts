import {
  Clock,
  FolderKanban,
  Home,
  ReceiptText,
  Settings,
  ShieldCheck,
  TrendingUp,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

// The primary workspace navigation, shared between the desktop sidebar and the
// mobile drawer so both stay in sync.
export const navItems: NavItem[] = [
  { href: "/", label: "Dashboard", icon: Home },
  { href: "/clients", label: "Clients", icon: Users },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/time", label: "Timesheet", icon: Clock },
  { href: "/invoices", label: "Invoices", icon: ReceiptText },
  { href: "/expenses", label: "Expenses", icon: Wallet },
  { href: "/reports", label: "Reports", icon: TrendingUp },
];

// Kept separate because it lives in its own footer section, pinned below the
// primary items in both layouts.
export const settingsNavItem: NavItem = {
  href: "/settings",
  label: "Settings",
  icon: Settings,
};

// Only rendered for platform admins (see app/(app)/layout.tsx) - it leads
// outside this business's scope entirely, into the cross-tenant
// app/system-admin route.
export const systemAdminNavItem: NavItem = {
  href: "/system-admin",
  label: "System Administration",
  icon: ShieldCheck,
};

// Whether a nav item should render as active for the current pathname. The
// dashboard ("/") only matches exactly; everything else matches its subtree.
export function isNavItemActive(href: string, pathname: string): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}
