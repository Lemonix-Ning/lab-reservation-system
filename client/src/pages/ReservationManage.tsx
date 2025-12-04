import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { format } from "date-fns";
import { FlaskConical } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Link, useLocation } from "wouter";

const statusMap = {
  pending: { label: "待审核", color: "text-yellow-600" },
  approved: { label: "已通过", color: "text-green-600" },
  rejected: { label: "已拒绝", color: "text-red-600" },
  cancelled: { label: "已取消", color: "text-gray-600" },
  completed: { label: "已完成", color: "text-blue-600" },
  violated: { label: "已违约", color: "text-red-900" },
};

export default function ReservationManage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const { data: reservations, isLoading } = trpc.reservation.allList.useQuery();
  const utils = trpc.useUtils();

  const approveMutation = trpc.reservation.approve.useMutation({
    onSuccess: () => {
      toast.success("预约已通过");
      utils.reservation.allList.invalidate();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const rejectMutation = trpc.reservation.reject.useMutation({
    onSuccess: () => {
      toast.success("预约已拒绝");
      utils.reservation.allList.invalidate();
      setRejectDialogOpen(false);
      setRejectReason("");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  if (user?.role !== 'admin') {
    setLocation('/');
    return null;
  }

  const handleReject = () => {
    if (!selectedId || !rejectReason.trim()) {
      toast.error("请填写拒绝原因");
      return;
    }
    rejectMutation.mutate({ id: selectedId, rejectReason });
  };

  return (
    <div className="bg-gray-50">
      <main className="container py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">预约审核</h2>
          <p className="text-gray-600">审核和管理所有预约申请</p>
        </div>

        {isLoading ? (
          <div className="text-center py-12">加载中...</div>
        ) : (
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>实验室</TableHead>
                    <TableHead>预约标题</TableHead>
                    <TableHead>申请人</TableHead>
                    <TableHead>人数</TableHead>
                    <TableHead>开始时间</TableHead>
                    <TableHead>结束时间</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reservations?.map((reservation) => (
                    <TableRow key={reservation.id}>
                      <TableCell>{reservation.labRoom?.name || '未知'}</TableCell>
                      <TableCell>
                        <div>{reservation.title}</div>
                        {reservation.reason && (
                          <div className="text-xs text-gray-500 mt-1">{reservation.reason}</div>
                        )}
                      </TableCell>
                      <TableCell>{reservation.userId}</TableCell>
                      <TableCell>{reservation.peopleCount}</TableCell>
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
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => approveMutation.mutate({ id: reservation.id })}
                              disabled={approveMutation.isPending}
                            >
                              通过
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedId(reservation.id);
                                setRejectDialogOpen(true);
                              }}
                            >
                              拒绝
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </main>

      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>拒绝预约</DialogTitle>
            <DialogDescription>请填写拒绝原因</DialogDescription>
          </DialogHeader>
          <div>
            <Label>拒绝原因</Label>
            <Textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="请说明拒绝的原因..."
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleReject} disabled={rejectMutation.isPending}>
              {rejectMutation.isPending ? '提交中...' : '确认拒绝'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
