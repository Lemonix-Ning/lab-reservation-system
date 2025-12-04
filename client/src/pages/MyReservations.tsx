import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { format } from "date-fns";
import { FlaskConical } from "lucide-react";
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
