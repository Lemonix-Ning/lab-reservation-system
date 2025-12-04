import { Bell } from "lucide-react";
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { ScrollArea } from "./ui/scroll-area";
import { Badge } from "./ui/badge";
import { Link } from "wouter";

/**
 * 通知铃铛组件
 * 显示在导航栏，点击展开最近的通知列表
 */
export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const utils = trpc.useUtils();

  // 获取未读数量
  const { data: unreadCount = 0 } = trpc.notification.getUnreadCount.useQuery(undefined, {
    refetchInterval: 30000, // 每30秒刷新一次
  });

  // 获取通知列表
  const { data: notifications = [] } = trpc.notification.list.useQuery(
    { limit: 10 },
    { enabled: open }
  );

  // 标记为已读
  const markRead = trpc.notification.markRead.useMutation({
    onSuccess: () => {
      utils.notification.getUnreadCount.invalidate();
      utils.notification.list.invalidate();
    },
  });

  // 标记全部为已读
  const markAllRead = trpc.notification.markAllRead.useMutation({
    onSuccess: () => {
      utils.notification.getUnreadCount.invalidate();
      utils.notification.list.invalidate();
    },
  });

  const handleNotificationClick = (id: number, isRead: number) => {
    if (isRead === 0) {
      markRead.mutate({ id });
    }
  };

  const handleMarkAllRead = () => {
    markAllRead.mutate();
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'reservation_approved':
        return '✅';
      case 'reservation_rejected':
        return '❌';
      case 'reservation_cancelled':
        return '🚫';
      case 'reservation_reminder':
        return '⏰';
      case 'system':
        return '📢';
      default:
        return '📬';
    }
  };

  const formatTime = (createdAt: Date) => {
    const date = new Date(createdAt);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (minutes < 1) return '刚刚';
    if (minutes < 60) return `${minutes}分钟前`;
    if (hours < 24) return `${hours}小时前`;
    if (days < 7) return `${days}天前`;
    return date.toLocaleDateString('zh-CN');
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <div className="flex items-center justify-between px-4 py-2">
          <h3 className="font-semibold text-sm">通知消息</h3>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-auto p-0 text-xs text-blue-600 hover:text-blue-700"
              onClick={handleMarkAllRead}
            >
              全部已读
            </Button>
          )}
        </div>
        <DropdownMenuSeparator />
        
        {notifications.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-gray-500">
            暂无通知
          </div>
        ) : (
          <ScrollArea className="max-h-[400px]">
            {notifications.map((notification) => (
              <DropdownMenuItem
                key={notification.id}
                className={`px-4 py-3 cursor-pointer ${
                  notification.isRead === 0 ? 'bg-blue-50' : ''
                }`}
                onClick={() => handleNotificationClick(notification.id, notification.isRead)}
              >
                <div className="flex gap-3 w-full">
                  <div className="text-xl flex-shrink-0">
                    {getNotificationIcon(notification.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="font-medium text-sm truncate">{notification.title}</h4>
                      {notification.isRead === 0 && (
                        <div className="w-2 h-2 bg-blue-600 rounded-full flex-shrink-0 mt-1" />
                      )}
                    </div>
                    <p className="text-xs text-gray-600 mt-1 line-clamp-2">
                      {notification.content}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      {formatTime(notification.createdAt)}
                    </p>
                  </div>
                </div>
              </DropdownMenuItem>
            ))}
          </ScrollArea>
        )}
        
        <DropdownMenuSeparator />
        <Link href="/notifications">
          <DropdownMenuItem className="text-center justify-center text-sm text-blue-600 cursor-pointer">
            查看全部通知
          </DropdownMenuItem>
        </Link>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
