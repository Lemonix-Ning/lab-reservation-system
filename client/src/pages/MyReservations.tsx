import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { format } from "date-fns";
import { FlaskConical, ShieldCheck, ShieldAlert, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Link } from "wouter";

const statusMap = {
  pending: { label: "待审核", color: "text-yellow-600" },
  approved: { label: "已通过", color: "text-green-600" },
  rejected: { label: "已拒绝", color: "text-red-600" },
  cancelled: { label: "已取消", color: "text-gray-600" },
  completed: { label: "已完成", color: "text-blue-600" },
  violated: { label: "已违约", color: "text-red-900" },
};

export default function MyReservations() {
  const { user, isAuthenticated } = useAuth();
  const { data: reservations, isLoading } = trpc.reservation.myList.useQuery();
  const { data: violationPoints } = trpc.violation.getTotalPoints.useQuery();
  const { data: blacklistStatus } = trpc.violation.isBlacklisted.useQuery();
  const { data: myViolations = [] } = trpc.violation.getRecords.useQuery();
  const utils = trpc.useUtils();
  
  const cancelReservation = trpc.reservation.cancel.useMutation({
    onSuccess: () => {
      toast.success("预约已取消");
      utils.reservation.myList.invalidate();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });
  const checkin = trpc.reservation.checkin.useMutation({
    onSuccess: () => {
      toast.success("签到成功");
      utils.reservation.myList.invalidate();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });
  const checkout = trpc.reservation.checkout.useMutation({
    onSuccess: () => {
      toast.success("签退成功");
      utils.reservation.myList.invalidate();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleCheckin = async (id: number) => {
    if (!navigator.geolocation) {
      checkin.mutate({ id, method: "manual" });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        checkin.mutate({ id, method: "geofence", latitude, longitude, deviceInfo: window.navigator.userAgent });
      },
      () => {
        checkin.mutate({ id, method: "manual", deviceInfo: window.navigator.userAgent });
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 10000 }
    );
  };

  const handleCheckout = (id: number) => {
    checkout.mutate({ id });
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-96">
          <CardHeader>
            <CardTitle>需要登录</CardTitle>
            <CardDescription>请先登录后再查看预约记录</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <a href={getLoginUrl()}>登录</a>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="bg-gray-50">
      {/* 主内容 */}
      <main className="container py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">我的预约</h2>
          <p className="text-gray-600">查看和管理您的所有预约记录</p>
        </div>

        {/* 信用状态卡片 */}
        {(() => {
          const points = violationPoints?.totalPoints ?? 0;
          const isBlacklisted = blacklistStatus?.isBlacklisted ?? false;
          const creditScore = Math.max(0, 100 - points * 10); // 100分满分，每违约分扣10
          const level = isBlacklisted ? 'danger' : points >= 5 ? 'warning' : 'good';
          const colors = {
            good: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', icon: ShieldCheck, label: '信用良好' },
            warning: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', icon: AlertTriangle, label: '信用预警' },
            danger: { bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-700', icon: ShieldAlert, label: '已被限制' },
          }[level];
          const Icon = colors.icon;

          return (
            <div className={`mb-6 rounded-xl border ${colors.border} ${colors.bg} p-4`}>
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-3">
                  <div className={`h-10 w-10 rounded-full flex items-center justify-center ${colors.bg}`}>
                    <Icon className={`h-5 w-5 ${colors.text}`} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`font-bold ${colors.text}`}>{colors.label}</span>
                      <span className="text-2xl font-bold text-slate-900">{creditScore}</span>
                      <span className="text-sm text-slate-500">/100</span>
                    </div>
                    <p className="text-xs text-slate-500">
                      累计违约 {points} 分 · {myViolations.length} 条记录
                      {isBlacklisted && blacklistStatus?.record?.restrictedUntil && (
                        <span className="text-rose-600 font-medium ml-2">
                          · 限制至 {format(new Date(blacklistStatus.record.restrictedUntil), "yyyy-MM-dd")}
                        </span>
                      )}
                    </p>
                  </div>
                </div>
                {points > 0 && (
                  <div className="text-xs text-slate-500 space-y-0.5">
                    {myViolations.slice(0, 2).map((v: any) => (
                      <div key={v.id} className="flex items-center gap-2">
                        <span className="text-rose-500">-{v.points}</span>
                        <span>{v.violationType === 'no_show' ? '未签到' : v.violationType === 'late_cancel' ? '迟到取消' : v.violationType === 'timeout_checkout' ? '超时占用' : '其他'}</span>
                        {v.recordedAt && <span className="text-slate-400">{format(new Date(v.recordedAt), "MM-dd")}</span>}
                      </div>
                    ))}
                    {myViolations.length > 2 && <div className="text-slate-400">还有 {myViolations.length - 2} 条...</div>}
                  </div>
                )}
              </div>
              {isBlacklisted && (
                <div className="mt-3 p-2 rounded-lg bg-rose-100/50 border border-rose-200 text-sm text-rose-700">
                  ⚠️ 您的预约权限已被限制。在限制解除前无法提交新的预约申请。请遵守实验室管理规定。
                </div>
              )}
            </div>
          );
        })()}

        {isLoading ? (
          <div className="text-center py-12">加载中...</div>
        ) : reservations && reservations.length > 0 ? (
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>实验室</TableHead>
                    <TableHead>预约标题</TableHead>
                    <TableHead>开始时间</TableHead>
                    <TableHead>结束时间</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>签到情况</TableHead>
                    <TableHead>操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reservations.map((reservation) => (
                    <TableRow key={reservation.id}>
                      <TableCell>{reservation.labRoom?.name || '未知'}</TableCell>
                      <TableCell>{reservation.title}</TableCell>
                      <TableCell>
                        {format(new Date(reservation.startTime), "yyyy-MM-dd HH:mm")}
                      </TableCell>
                      <TableCell>
                        {format(new Date(reservation.endTime), "yyyy-MM-dd HH:mm")}
                      </TableCell>
                      <TableCell>
                        <span className={statusMap[reservation.status].color}>
                          {statusMap[reservation.status].label}
                        </span>
                        {reservation.status === 'rejected' && reservation.rejectReason && (
                          <div className="text-xs text-gray-500 mt-1">
                            原因: {reservation.rejectReason}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {reservation.checkinTime ? (
                          <div className="text-xs space-y-1">
                            <div className={reservation.checkinMethod === 'geofence' ? 'text-green-600' : 'text-yellow-600'}>
                              {reservation.checkinMethod === 'geofence' && '📍 '}
                              {reservation.checkinMethod === 'manual' && '✋ '}
                              {reservation.checkinMethod === 'qrcode' && '📱 '}
                              签到 {format(new Date(reservation.checkinTime), "HH:mm")}
                            </div>
                            <div className="text-gray-400">
                              {reservation.checkinMethod === 'geofence' ? '位置验证' : 
                               reservation.checkinMethod === 'manual' ? '手动签到' :
                               reservation.checkinMethod === 'qrcode' ? '扫码签到' : '其他'}
                            </div>
                            {reservation.checkoutTime && (
                              <div className="text-blue-600">
                                签退 {format(new Date(reservation.checkoutTime), "HH:mm")}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-400 text-xs">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {reservation.status === 'pending' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => cancelReservation.mutate({ id: reservation.id })}
                            disabled={cancelReservation.isPending}
                          >
                            取消
                          </Button>
                        )}
                        {/* 签到按钮：已批准且未签到时显示 */}
                        {reservation.status === 'approved' && !reservation.checkinTime && (
                          <Button
                            size="sm"
                            onClick={() => handleCheckin(reservation.id)}
                            disabled={checkin.isPending}
                          >
                            签到
                          </Button>
                        )}
                        {/* 签退按钮：已签到但未签退时显示 */}
                        {reservation.status === 'approved' && reservation.checkinTime && !reservation.checkoutTime && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleCheckout(reservation.id)}
                            disabled={checkout.isPending}
                          >
                            签退
                          </Button>
                        )}
                        {/* 已完成状态 */}
                        {(reservation.status === 'completed' || (reservation.status === 'approved' && reservation.checkinTime && reservation.checkoutTime)) && (
                          <span className="text-xs text-gray-400">已完成</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="py-12 text-center text-gray-500">
              暂无预约记录
              <div className="mt-4">
                <Link href="/labs">
                  <Button>去预约</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
