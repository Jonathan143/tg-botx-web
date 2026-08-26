import {
  ActivityIcon,
  ArrowLeftIcon,
  BotIcon,
  ClipboardListIcon,
  FileTextIcon,
  LayoutDashboardIcon,
  LogOutIcon,
  MoonIcon,
  SettingsIcon,
  SunIcon,
} from "lucide-react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "@/components/auth-provider";
import { useTheme } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { toast } from "@/components/ui/toast";

const navigation = [
  { path: "/", label: "仪表盘", icon: LayoutDashboardIcon },
  { path: "/tasks", label: "任务", icon: ClipboardListIcon },
  { path: "/runs", label: "执行记录", icon: ActivityIcon },
  { path: "/accounts", label: "Telegram 账号", icon: BotIcon },
  { path: "/logs", label: "运行日志", icon: FileTextIcon },
  { path: "/settings", label: "设置", icon: SettingsIcon },
];

function AppSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuth();

  const handleLogout = async () => {
    try {
      await logout();
      navigate("/unlock", { replace: true });
    } catch (error) {
      toast.add({
        type: "error",
        title: "退出失败",
        description: error instanceof Error ? error.message : "请稍后重试。",
      });
    }
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" tooltip="TG Bot 管理后台">
              <span className="flex size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                <BotIcon />
              </span>
              <span className="flex min-w-0 flex-col text-left group-data-[collapsible=icon]:hidden">
                <span className="truncate font-semibold">TG Bot</span>
                <span className="truncate text-xs text-muted-foreground">管理控制台</span>
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>管理</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigation.map((item) => (
                <SidebarMenuItem key={item.path}>
                  <SidebarMenuButton
                    render={<NavLink to={item.path} />}
                    isActive={
                      item.path === "/"
                        ? location.pathname === "/"
                        : location.pathname.startsWith(item.path)
                    }
                    tooltip={item.label}
                  >
                    <item.icon />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={handleLogout} tooltip="退出当前浏览器">
              <LogOutIcon />
              <span>退出当前浏览器</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

function Header() {
  const location = useLocation();
  const { theme, setTheme } = useTheme();
  const activeNavigationItem = navigation.find((item) =>
    item.path === "/" ? location.pathname === "/" : location.pathname.startsWith(item.path),
  );
  const title = activeNavigationItem?.label ?? "管理后台";
  const parentPath =
    activeNavigationItem &&
    activeNavigationItem.path !== "/" &&
    location.pathname !== activeNavigationItem.path
      ? activeNavigationItem.path
      : null;

  return (
    <header className="sticky top-0 z-9 flex h-14 shrink-0 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur supports-backdrop-filter:bg-background/80">
      <SidebarTrigger />
      {parentPath ? (
        <Button
          variant="ghost"
          size="icon-sm"
          render={<Link to={parentPath} />}
          nativeButton={false}
          aria-label={`返回${title}列表`}
        >
          <ArrowLeftIcon />
        </Button>
      ) : null}
      <span className="min-w-0 flex-1 truncate text-sm font-medium">{title}</span>
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label="切换主题" />}>
          {theme === "dark" ? <MoonIcon /> : <SunIcon />}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuGroup>
            <DropdownMenuItem onClick={() => setTheme("light")}>浅色</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTheme("dark")}>深色</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTheme("system")}>跟随系统</DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}

export function AppShell() {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <Header />
        <main className="flex min-w-0 flex-1 flex-col gap-6 p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
