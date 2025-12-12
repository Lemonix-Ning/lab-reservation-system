import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { getLoginUrl } from "@/const";
import { useIsMobile } from "@/hooks/useMobile";
import { RoleProvider, useRole } from "@/contexts/RoleContext";
import { 
  BarChart3, 
  Calendar, 
  Settings, 
  FileText, 
  Monitor, 
  BookOpen,
  TrendingUp,
  FlaskConical,
  LogOut, 
  PanelLeft,
  ShieldCheck,
  AlertTriangle,
  FileSearch,
  Home,
  Ban,
  Clock
} from "lucide-react";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from './DashboardLayoutSkeleton';
import { NotificationBell } from './NotificationBell';
import { Button } from "./ui/button";

const menuItems = [
  // 系统管理员权限
  { icon: Home, label: "首页", path: "/", roles: ['sysAdmin'] },
  
  // 所有角色都能访问
  { icon: Calendar, label: "浏览实验室", path: "/labs", roles: ['student', 'teacher', 'labAdmin', 'sysAdmin'] },
  { icon: BookOpen, label: "我的预约", path: "/my-reservations", roles: ['student', 'teacher', 'labAdmin', 'sysAdmin'] },
  { icon: Calendar, label: "日历调度", path: "/calendar", roles: ['student', 'teacher', 'labAdmin', 'sysAdmin'] },
  
  // 学生权限
  { icon: BookOpen, label: "我的课程", path: "/student/courses", roles: ['student'] },
  
  // 教师权限
  { icon: BookOpen, label: "课程管理", path: "/courses", roles: ['teacher', 'sysAdmin'] },
  
  // 实验室管理员权限
  { icon: Monitor, label: "实验室管理", path: "/admin/labs", roles: ['labAdmin', 'sysAdmin'] },
  { icon: Settings, label: "预约审核", path: "/admin/reservations", roles: ['labAdmin', 'sysAdmin'] },
  { icon: FileText, label: "规则配置", path: "/admin/rules", roles: ['labAdmin', 'sysAdmin'] },
  { icon: Clock, label: "开放规则", path: "/admin/opening-rules", roles: ['labAdmin', 'sysAdmin'] },
  { icon: Ban, label: "禁用时段", path: "/admin/blocked-periods", roles: ['labAdmin', 'sysAdmin'] },
  
  // 系统管理员权限（续）
  { icon: ShieldCheck, label: "审批配置", path: "/admin/approval-config", roles: ['sysAdmin'] },
  { icon: AlertTriangle, label: "违约管理", path: "/admin/violations", roles: ['sysAdmin'] },
  { icon: FileSearch, label: "审计日志", path: "/admin/audit-logs", roles: ['sysAdmin'] },
  { icon: TrendingUp, label: "数据统计导航", path: "/admin/statistics", roles: ['sysAdmin'] },
];

const SIDEBAR_WIDTH_KEY = "sidebar-width";
const DEFAULT_WIDTH = 280;
const MIN_WIDTH = 200;
const MAX_WIDTH = 480;

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });
  const { loading, user } = useAuth();

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

  if (loading) {
    return <DashboardLayoutSkeleton />
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-8 p-8 max-w-md w-full">
          <div className="flex flex-col items-center gap-6">
            <h1 className="text-2xl font-semibold tracking-tight text-center">
              Sign in to continue
            </h1>
            <p className="text-sm text-muted-foreground text-center max-w-sm">
              Access to this dashboard requires authentication. Continue to launch the login flow.
            </p>
          </div>
          <Button
            onClick={() => {
              window.location.href = getLoginUrl();
            }}
            size="lg"
            className="w-full shadow-lg hover:shadow-xl transition-all"
          >
            Sign in
          </Button>
        </div>
      </div>
    );
  }

  return (
    <RoleProvider>
      <SidebarProvider
        style={
          {
            "--sidebar-width": `${sidebarWidth}px`,
          } as CSSProperties
        }
      >
        <DashboardLayoutContent setSidebarWidth={setSidebarWidth}>
          {children}
        </DashboardLayoutContent>
      </SidebarProvider>
    </RoleProvider>
  );
}

type DashboardLayoutContentProps = {
  children: React.ReactNode;
  setSidebarWidth: (width: number) => void;
};

function DashboardLayoutContent({
  children,
  setSidebarWidth,
}: DashboardLayoutContentProps) {
  const { user, logout } = useAuth();
  const { devRole, setDevRole, currentRole, isAdmin } = useRole();
  const [location, setLocation] = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  // 根据用户角色过滤菜单项
  const filteredMenuItems = menuItems.filter(item => {
    return item.roles.includes(currentRole || 'student');
  });

  const activeMenuItem = filteredMenuItems.find(item => item.path === location);

  useEffect(() => {
    if (isCollapsed) {
      setIsResizing(false);
    }
  }, [isCollapsed]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;

      const sidebarLeft = sidebarRef.current?.getBoundingClientRect().left ?? 0;
      const newWidth = e.clientX - sidebarLeft;
      if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) {
        setSidebarWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, setSidebarWidth]);

  return (
    <>
      <div className="relative" ref={sidebarRef}>
        <Sidebar
          collapsible="icon"
          className="border-r-0"
          disableTransition={isResizing}
        >
          <SidebarHeader className="h-16 justify-center">
            <div className="flex items-center gap-3 px-2 transition-all w-full">
              <button
                onClick={toggleSidebar}
                className="h-8 w-8 flex items-center justify-center hover:bg-accent rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring shrink-0"
                aria-label="Toggle navigation"
              >
                <PanelLeft className="h-4 w-4 text-muted-foreground" />
              </button>
              {!isCollapsed ? (
                <div className="flex items-center gap-2 min-w-0">
                  <FlaskConical className="h-4 w-4 text-blue-600 shrink-0" />
                  <span className="font-semibold tracking-tight truncate text-sm">
                    实验室预约管理系统
                  </span>
                </div>
              ) : null}
            </div>
          </SidebarHeader>

          <SidebarContent className="gap-0">
            <SidebarMenu className="px-2 py-1">
              {filteredMenuItems.map(item => {
                const isActive = location === item.path;
                return (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton
                      isActive={isActive}
                      onClick={() => setLocation(item.path)}
                      tooltip={item.label}
                      className={`h-10 transition-all font-normal`}
                    >
                      <item.icon
                        className={`h-4 w-4 ${isActive ? "text-primary" : ""}`}
                      />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarContent>

          <SidebarFooter className="p-3 space-y-3">
            {/* 开发模式角色切换器 */}
            {import.meta.env.DEV && (
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-2 group-data-[collapsible=icon]:hidden">
                <div className="text-xs text-orange-600 font-semibold mb-2">🛠️ 开发模式</div>
                <div className="flex flex-col gap-1.5">
                  {/* 快速切换身份 */}
                  <button
                    onClick={() => {
                      const redirectUri = encodeURIComponent("http://localhost:3000/api/oauth/callback");
                      window.location.href = `http://localhost:4000/oauth/authorize?redirect_uri=${redirectUri}&openid=sysadmin-001&name=系统管理员&email=sysadmin@example.com&role=sysAdmin`;
                    }}
                    className="w-full px-2 py-1.5 text-xs rounded-md transition-all text-left bg-red-50 text-red-700 hover:bg-red-100 border border-red-200"
                  >
                    👑 系统管理员
                  </button>
                  <button
                    onClick={() => {
                      const redirectUri = encodeURIComponent("http://localhost:3000/api/oauth/callback");
                      window.location.href = `http://localhost:4000/oauth/authorize?redirect_uri=${redirectUri}&openid=labadmin-001&name=实验室管理员&email=labadmin@example.com&role=labAdmin`;
                    }}
                    className="w-full px-2 py-1.5 text-xs rounded-md transition-all text-left bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200"
                  >
                    🔧 实验室管理员
                  </button>
                  <button
                    onClick={() => {
                      const redirectUri = encodeURIComponent("http://localhost:3000/api/oauth/callback");
                      window.location.href = `http://localhost:4000/oauth/authorize?redirect_uri=${redirectUri}&openid=teacher-001&name=教师&email=teacher@example.com&role=teacher`;
                    }}
                    className="w-full px-2 py-1.5 text-xs rounded-md transition-all text-left bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200"
                  >
                    👨‍🏫 教师
                  </button>
                  <button
                    onClick={() => {
                      const redirectUri = encodeURIComponent("http://localhost:3000/api/oauth/callback");
                      window.location.href = `http://localhost:4000/oauth/authorize?redirect_uri=${redirectUri}&openid=student-001&name=学生&email=student@example.com&role=student`;
                    }}
                    className="w-full px-2 py-1.5 text-xs rounded-md transition-all text-left bg-green-50 text-green-700 hover:bg-green-100 border border-green-200"
                  >
                    👨‍🎓 学生
                  </button>
                </div>
              </div>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 rounded-lg px-1 py-1 hover:bg-accent/50 transition-colors w-full text-left group-data-[collapsible=icon]:justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <Avatar className="h-9 w-9 border shrink-0">
                    <AvatarFallback className="text-xs font-medium">
                      {user?.name?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
                    <p className="text-sm font-medium truncate leading-none">
                      {user?.name || "-"}
                    </p>
                    <p className="text-xs text-muted-foreground truncate mt-1.5">
                      {user?.email || "-"}
                    </p>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem
                  onClick={logout}
                  className="cursor-pointer text-destructive focus:text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Sign out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </Sidebar>
        <div
          className={`absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-primary/20 transition-colors ${isCollapsed ? "hidden" : ""}`}
          onMouseDown={() => {
            if (isCollapsed) return;
            setIsResizing(true);
          }}
          style={{ zIndex: 50 }}
        />
      </div>

      <SidebarInset>
        <div className="flex border-b h-14 items-center justify-between bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:backdrop-blur sticky top-0 z-40">
          <div className="flex items-center gap-2">
            {isMobile && <SidebarTrigger className="h-9 w-9 rounded-lg bg-background" />}
            <div className="flex items-center gap-3">
              <div className="flex flex-col gap-1">
                <span className="tracking-tight text-foreground font-semibold">
                  {activeMenuItem?.label ?? "实验室预约管理系统"}
                </span>
              </div>
            </div>
          </div>
          <NotificationBell />
        </div>
        <main className="flex-1 p-4">{children}</main>
      </SidebarInset>
    </>
  );
}
