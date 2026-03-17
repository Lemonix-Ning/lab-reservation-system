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
import { useRole } from "@/contexts/RoleContext";
import { useState, useEffect } from "react";
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
  Clock,
  MapPin,
  QrCode,
  Settings2,
  Shield,
  User,
  UserCheck,
  UserPlus,
  Link2,
  Trash2,
  LayoutGrid
} from "lucide-react";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from './DashboardLayoutSkeleton';
import { NotificationBell } from './NotificationBell';
import { Button } from "./ui/button";
import { usePermission } from "@/contexts/PermissionContext";

// 菜单项定义，支持基于角色和动态权限的访问控制
// permission: 需要的权限代码（动态权限），undefined 表示只看角色
const menuItems = [
  // 系统管理员专属
  { icon: Home, label: "首页", path: "/", roles: ['sysAdmin'] },
  
  // 所有角色都能访问
  { icon: Calendar, label: "浏览实验室", path: "/labs", roles: ['student', 'teacher', 'labAdmin', 'sysAdmin'] },
  { icon: BookOpen, label: "我的预约", path: "/my-reservations", roles: ['student', 'teacher', 'labAdmin', 'sysAdmin'] },
  { icon: Calendar, label: "日历调度", path: "/calendar", roles: ['student', 'teacher', 'labAdmin', 'sysAdmin'] },
  { icon: User, label: "身份申请", path: "/account/role-request", roles: ['student', 'teacher', 'labAdmin', 'sysAdmin'] },
  
  // 学生权限
  { icon: BookOpen, label: "我的课程", path: "/student/courses", roles: ['student'] },
  { icon: QrCode, label: "课堂签到", path: "/student/checkin", roles: ['student'] },
  
  // 教师权限（可通过动态权限授予其他角色）
  { icon: BookOpen, label: "课程管理", path: "/courses", roles: ['teacher', 'sysAdmin'], permission: 'course:manage' },
  { icon: QrCode, label: "课堂签到", path: "/class-checkin", roles: ['teacher', 'sysAdmin'], permission: 'checkin:teacher' },
  { icon: LayoutGrid, label: "实验室课表", path: "/schedule-board", roles: ['teacher', 'labAdmin', 'sysAdmin'] },
  
  // 实验室管理员 + 系统管理员（可通过动态权限授予教师）
  { icon: Monitor, label: "实验室管理", path: "/admin/labs", roles: ['labAdmin', 'sysAdmin'], permission: 'lab:manage' },
  { icon: Settings, label: "预约审核", path: "/admin/reservations", roles: ['labAdmin', 'sysAdmin'], permission: 'reservation:approve' },
  { icon: Monitor, label: "设备管理", path: "/admin/devices", roles: ['labAdmin', 'sysAdmin'], permission: 'device:manage' },
  { icon: FileText, label: "规则配置", path: "/admin/rules", roles: ['labAdmin', 'sysAdmin'], permission: 'rule:manage' },
  { icon: Clock, label: "开放规则", path: "/admin/opening-rules", roles: ['labAdmin', 'sysAdmin'], permission: 'rule:manage' },
  { icon: Ban, label: "禁用时段", path: "/admin/blocked-periods", roles: ['labAdmin', 'sysAdmin'], permission: 'rule:manage' },
  { icon: MapPin, label: "地理围栏", path: "/admin/geofences", roles: ['labAdmin', 'sysAdmin'], permission: 'geofence:manage' },
  { icon: AlertTriangle, label: "违约管理", path: "/admin/violations", roles: ['labAdmin', 'sysAdmin'], permission: 'violation:manage' },
  { icon: FileSearch, label: "审计日志", path: "/admin/audit-logs", roles: ['labAdmin', 'sysAdmin'], permission: 'audit:view' },
  { icon: TrendingUp, label: "数据统计", path: "/admin/statistics", roles: ['labAdmin', 'sysAdmin'], permission: 'statistics:view' },
  
  // 系统管理员专属
  { icon: ShieldCheck, label: "审批配置", path: "/admin/approval-config", roles: ['sysAdmin'] },
  { icon: UserCheck, label: "身份审核", path: "/admin/role-requests", roles: ['sysAdmin'] },
  { icon: UserPlus, label: "角色白名单", path: "/admin/whitelist", roles: ['sysAdmin'] },
  { icon: Shield, label: "权限管理", path: "/admin/permissions", roles: ['sysAdmin'] },
  { icon: Settings2, label: "系统设置", path: "/admin/settings", roles: ['sysAdmin'], permission: 'system:settings' },
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
  const [enableDemoLogin, setEnableDemoLogin] = useState(false);

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

  // 检查是否启用演示登录
  useEffect(() => {
    fetch("/api/system/demo-login-enabled")
      .then((res) => res.json())
      .then((data) => setEnableDemoLogin(data.enabled || false))
      .catch(() => setEnableDemoLogin(false));
  }, []);

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
    <SidebarProvider
      style={
        {
          "--sidebar-width": `${sidebarWidth}px`,
        } as CSSProperties
      }
    >
      <DashboardLayoutContent setSidebarWidth={setSidebarWidth} enableDemoLogin={enableDemoLogin}>
        {children}
      </DashboardLayoutContent>
    </SidebarProvider>
  );
}

type DashboardLayoutContentProps = {
  children: React.ReactNode;
  setSidebarWidth: (width: number) => void;
  enableDemoLogin: boolean;
};

function DashboardLayoutContent({
  children,
  setSidebarWidth,
  enableDemoLogin,
}: DashboardLayoutContentProps) {
  const { user, logout, refresh: refreshUser } = useAuth();
  const { devRole, setDevRole, currentRole, isAdmin } = useRole();
  const [location, setLocation] = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  const { hasPermission } = usePermission();

  // 定期刷新用户信息（每30秒），以便及时获取角色变更
  useEffect(() => {
    const interval = setInterval(() => {
      refreshUser();
    }, 30000); // 30秒

    return () => clearInterval(interval);
  }, [refreshUser]);

  // 根据用户角色和动态权限过滤菜单项
  const filteredMenuItems = menuItems.filter(item => {
    // 首先检查角色
    const hasRole = item.roles.includes(currentRole || 'student');
    if (!hasRole) {
      // 如果角色不匹配但有权限代码，检查是否有动态授权
      if (item.permission && hasPermission(item.permission)) {
        return true;
      }
      return false;
    }
    return true;
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
                    学校实验室预约调度系统
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
            {/* 演示账号快速切换器 */}
            {enableDemoLogin && (() => {
              const accounts = [
                { openId: 'demo-admin', name: '系统管理员', icon: '[管]', color: 'red' },
                { openId: 'demo-labadmin', name: '实验室管理员', icon: '[实]', color: 'purple' },
                { openId: 'demo-teacher-001', name: '教师', icon: '[师]', color: 'blue' },
                { openId: 'demo-student-001', name: '学生', icon: '[生]', color: 'green' },
              ];
              
              return (
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-2 group-data-[collapsible=icon]:hidden">
                  <div className="text-xs text-orange-600 font-semibold mb-2">
                    演示账号快速切换
                  </div>
                  <div className="text-xs text-orange-500 mb-2">
                    当前: {user?.name || user?.openId}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {accounts.map(account => {
                      const isCurrent = user?.openId === account.openId;
                      const colorClasses = {
                        red: isCurrent 
                          ? 'bg-red-100 text-red-800 border-red-300 font-semibold'
                          : 'bg-red-50 text-red-700 hover:bg-red-100 border-red-200',
                        purple: isCurrent
                          ? 'bg-purple-100 text-purple-800 border-purple-300 font-semibold'
                          : 'bg-purple-50 text-purple-700 hover:bg-purple-100 border-purple-200',
                        blue: isCurrent
                          ? 'bg-blue-100 text-blue-800 border-blue-300 font-semibold'
                          : 'bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200',
                        green: isCurrent
                          ? 'bg-green-100 text-green-800 border-green-300 font-semibold'
                          : 'bg-green-50 text-green-700 hover:bg-green-100 border-green-200',
                      };
                      
                      return (
                        <button
                          key={account.openId}
                          onClick={async () => {
                            if (isCurrent) return;
                            // 调用后端 API 切换账号
                            try {
                              const response = await fetch('/api/dev/switch-account', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ openId: account.openId }),
                              });
                              if (response.ok) {
                                window.location.reload();
                              }
                            } catch (error) {
                              console.error('切换账号失败:', error);
                            }
                          }}
                          disabled={isCurrent}
                          className={`w-full px-2 py-1.5 text-xs rounded-md transition-all text-left border ${colorClasses[account.color as keyof typeof colorClasses]} ${isCurrent ? 'cursor-default' : 'cursor-pointer'}`}
                        >
                          {account.icon} {account.name} {isCurrent && '[当前]'}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

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
              <DropdownMenuContent align="end" className="w-56">
                <div className="px-2 py-1.5 text-sm font-semibold">
                  {user?.name || "用户"}
                </div>
                <div className="px-2 py-1 text-xs text-muted-foreground">
                  {user?.email || "未设置邮箱"}
                </div>
                <div className="h-px bg-border my-1" />
                
                <DropdownMenuItem
                  onClick={() => setLocation("/account/profile")}
                  className="cursor-pointer"
                >
                  <User className="mr-2 h-4 w-4" />
                  <span>个人信息</span>
                </DropdownMenuItem>
                
                <DropdownMenuItem
                  onClick={() => setLocation("/account/bindings")}
                  className="cursor-pointer"
                >
                  <Link2 className="mr-2 h-4 w-4" />
                  <span>账号绑定</span>
                </DropdownMenuItem>
                
                <div className="h-px bg-border my-1" />
                
                <DropdownMenuItem
                  onClick={logout}
                  className="cursor-pointer"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>退出登录</span>
                </DropdownMenuItem>
                
                <DropdownMenuItem
                  onClick={() => setLocation("/account/delete")}
                  className="cursor-pointer text-destructive focus:text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  <span>注销账号</span>
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
                  {activeMenuItem?.label ?? "学校实验室预约调度系统"}
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
