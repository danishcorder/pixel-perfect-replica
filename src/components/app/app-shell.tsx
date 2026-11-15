import { useState, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { Bell, LogIn, LogOut, Menu, Search, Settings, User } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Brand } from "./brand";
import { ROLES, ROLE_KEYS, SETTINGS_NAV, type RoleKey, type NavItem } from "@/lib/roles";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

function useRole(): RoleKey {
  const { pathname } = useLocation();
  return ROLE_KEYS.find((k) => pathname.startsWith(ROLES[k].path)) ?? "institution";
}

function NavLink({ item, onNavigate }: { item: NavItem; onNavigate?: (() => void) | undefined }) {
  const { pathname } = useLocation();
  const Icon = item.icon;
  const base = "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors";
  if (item.soon || !item.to) {
    return (
      <div className={cn(base, "cursor-not-allowed text-sidebar-foreground/45")} title="Coming in a later phase">
        <Icon className="h-4 w-4" /><span className="flex-1">{item.label}</span>
        <span className="rounded bg-sidebar-accent px-1.5 py-0.5 text-[10px] uppercase tracking-wide">Soon</span>
      </div>
    );
  }
  const active = pathname === item.to;
  return (
    <Link to={item.to} onClick={onNavigate} className={cn(base, active ? "bg-sidebar-primary text-sidebar-primary-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground")}>
      <Icon className="h-4 w-4" />{item.label}
    </Link>
  );
}

function SidebarBody({ role, onNavigate }: { role: RoleKey; onNavigate?: (() => void) | undefined }) {
  return (
    <div className="flex h-full flex-col bg-sidebar">
      <div className="flex h-16 items-center px-5"><Brand inverted /></div>
      <div className="px-5 pb-2 text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/60">{ROLES[role].label}</div>
      <nav className="flex-1 space-y-1 px-3">{ROLES[role].nav.map((i) => <NavLink key={i.label} item={i} onNavigate={onNavigate} />)}</nav>
      <div className="space-y-1 border-t border-sidebar-border px-3 py-4"><NavLink item={SETTINGS_NAV} onNavigate={onNavigate} /></div>
    </div>
  );
}

function ProfileMenu() {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  if (loading) return <div className="h-9 w-9 animate-pulse rounded-full bg-muted" />;
  if (!user) return <Button asChild size="sm"><Link to="/auth/login"><LogIn className="h-4 w-4" />Sign in</Link></Button>;
  const name = (user.user_metadata?.["full_name"] as string | undefined) ?? user.email ?? "Account";
  const initials = name.split(/[\s@]/).filter(Boolean).slice(0, 2).map((s) => s[0]?.toUpperCase()).join("");
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="Open profile menu">
          <Avatar className="h-9 w-9"><AvatarFallback className="bg-primary text-primary-foreground text-xs">{initials}</AvatarFallback></Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel><p className="truncate">{name}</p><p className="truncate text-xs font-normal text-muted-foreground">{user.email}</p></DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild><Link to="/app/settings"><User className="h-4 w-4" />Profile</Link></DropdownMenuItem>
        <DropdownMenuItem asChild><Link to="/app/settings"><Settings className="h-4 w-4" />Account settings</Link></DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={async () => { await signOut(); toast.success("Signed out"); navigate({ to: "/" }); }}><LogOut className="h-4 w-4" />Sign out</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const role = useRole();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  return (
    <div className="min-h-screen bg-muted/30">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 lg:block"><SidebarBody role={role} /></aside>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-64 border-0 p-0"><SheetTitle className="sr-only">Navigation</SheetTitle><SidebarBody role={role} onNavigate={() => setOpen(false)} /></SheetContent>
      </Sheet>
      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur sm:px-6">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setOpen(true)} aria-label="Open navigation"><Menu className="h-5 w-5" /></Button>
          <div className="relative hidden max-w-sm flex-1 md:block">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search (available in a later phase)" disabled className="pl-9" />
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Select value={role} onValueChange={(v) => navigate({ to: ROLES[v as RoleKey].path })}>
              <SelectTrigger className="h-9 w-[180px]" aria-label="Preview a role dashboard"><SelectValue /></SelectTrigger>
              <SelectContent>{ROLE_KEYS.map((k) => <SelectItem key={k} value={k}>Preview: {ROLES[k].short}</SelectItem>)}</SelectContent>
            </Select>
            <Button variant="ghost" size="icon" aria-label="Notifications" onClick={() => toast("No notifications yet", { description: "Notifications arrive in a later phase." })}><Bell className="h-5 w-5" /></Button>
            <ProfileMenu />
          </div>
        </header>
        <main className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
