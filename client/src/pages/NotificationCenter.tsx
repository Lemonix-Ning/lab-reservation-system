import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Bell, Check, CheckCheck, Trash2 } from "lucide-react";
import { Link } from "wouter";

/**
 * 通知中心页面
 * 完整的消息列表管理功能
 */
export default function NotificationCenter() {
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const utils = trpc.useUtils();

  // 获取通知列表
  const { data: allNotifications = [], isLoading } = trpc.notification.list.useQuery({ limit: 50 });

  // 过滤通知
  const notifications = filter === "unread" 
    ? allNotifications.filter(n => n.isRead === 0)
    : allNotifications;

  // 未读数量
  const unreadCount = allNotifications.filter(n => n.isRead === 0).length;

  // 标记为已读
  const markRead = trpc.notification.markRead.useMutation({
    onSuccess: () => {
      utils.notification.list.invalidate();
      utils.notification.getUnreadCount.invalidate();
    },
  });

  // 标记全部为已读
  const markAllRead = trpc.notification.markAllRead.useMutation({
    onSuccess: () => {
      utils.notification.list.invalidate();
      utils.notification.getUnreadCount.invalidate();
    },
  });

  // 删除通知
  const deleteNotification = trpc.notification.delete.useMutation({
    onSuccess: () => {
      utils.notification.list.invalidate();
      utils.notification.getUnreadCount.invalidate();
    },
  });

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'reservation_approved':
        return <div className="text-2xl">✅</div>;
      case 'reservation_rejected':
        return <div className="text-2xl">❌</div>;
      case 'reservation_cancelled':
        return <div className="text-2xl">🚫</div>;
      case 'reservation_reminder':
        return <div className="text-2xl">⏰</div>;
      case 'system':
        return <div className="text-2xl">📢</div>;
      default:
        return <div className="text-2xl">📬</div>;
    }
  };

  const getNotificationTypeName = (type: string) => {
    switch (type) {
      case 'reservation_approved':
        return '预约通过';
      case 'reservation_rejected':
        return '预约拒绝';
      case 'reservation_cancelled':
        return '预约取消';
      case 'reservation_reminder':
        return '预约提醒';
      case 'system':
        return '系统通知';
      default:
        return '通知';
    }
  };

  const formatTime = (createdAt: Date) => {
    const date = new Date(createdAt);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      {/* 页面头部 */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Bell className="h-8 w-8 text-blue-600" />
          <div>
            <h1 className="text-3xl font-bold">通知中心</h1>
            <p className="text-sm text-gray-500 mt-1">
              管理您的所有通知消息
            </p>
          </div>
        </div>
        {unreadCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => markAllRead.mutate()}
            disabled={markAllRead.isPending}
          >
            <CheckCheck className="h-4 w-4 mr-2" />
            全部标为已读
          </Button>
        )}
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">全部通知</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{allNotifications.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">未读通知</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{unreadCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">已读通知</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-600">
              {allNotifications.length - unreadCount}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 筛选标签页 */}
      <Tabs value={filter} onValueChange={(v) => setFilter(v as "all" | "unread")} className="mb-4">
        <TabsList>
          <TabsTrigger value="all">
            全部通知 ({allNotifications.length})
          </TabsTrigger>
          <TabsTrigger value="unread">
            未读通知 ({unreadCount})
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* 通知列表 */}
      {isLoading ? (
        <div className="text-center py-12 text-gray-500">加载中...</div>
      ) : notifications.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Bell className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">
              {filter === "unread" ? "没有未读通知" : "暂无通知"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {notifications.map((notification) => (
            <Card
              key={notification.id}
              className={`transition-all hover:shadow-md ${
                notification.isRead === 0 ? 'border-l-4 border-l-blue-500 bg-blue-50/50' : ''
              }`}
            >
              <CardContent className="p-4">
                <div className="flex gap-4">
                  <div className="flex-shrink-0 mt-1">
                    {getNotificationIcon(notification.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-lg">{notification.title}</h3>
                        <Badge variant="secondary" className="text-xs">
                          {getNotificationTypeName(notification.type)}
                        </Badge>
                        {notification.isRead === 0 && (
                          <Badge variant="default" className="text-xs">
                            未读
                          </Badge>
                        )}
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        {notification.isRead === 0 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => markRead.mutate({ id: notification.id })}
                            disabled={markRead.isPending}
                            title="标记为已读"
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteNotification.mutate({ id: notification.id })}
                          disabled={deleteNotification.isPending}
                          title="删除"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <p className="text-gray-700 mb-3 whitespace-pre-wrap">
                      {notification.content}
                    </p>
                    <div className="flex items-center justify-between text-sm text-gray-500">
                      <span>{formatTime(notification.createdAt)}</span>
                      {notification.relatedType === 'reservation' && notification.relatedId && (
                        <Link href="/my-reservations">
                          <Button variant="link" size="sm" className="h-auto p-0 text-blue-600">
                            查看相关预约 →
                          </Button>
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
