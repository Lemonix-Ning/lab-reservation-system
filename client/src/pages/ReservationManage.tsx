import { useAuth } from "@/_core/hooks/useAuth";
import { useRole } from "@/contexts/RoleContext";
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
  const { isLabAdmin, isSysAdmin } = useRole();
  const [, setLocation] = useLocation();
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);
  const [labFilter, setLabFilter] = useState<number | undefined>(undefined);

  const { data: labs } = trpc.labRoom.list.useQuery();

  const { data: reservationsPage, isLoading } = trpc.reservation.allList.useQuery({ page, pageSize, q: searchText || undefined, status: statusFilter, labId: labFilter });
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

  if (!isLabAdmin && !isSysAdmin) {
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

        <div className="px-4 py-4">
          <div className="flex gap-2 items-center mb-4">
            <input
              className="border rounded px-2 py-1"
              placeholder="搜索标题或理由"
              value={searchText}
              onChange={(e) => { setSearchText(e.target.value); setPage(1); }}
            />
            <select className="border rounded px-2 py-1" value={statusFilter || ''} onChange={(e) => { setStatusFilter(e.target.value || undefined); setPage(1); }}>
              <option value="">全部状态</option>
              <option value="pending">待审核</option>
              <option value="approved">已通过</option>
              <option value="rejected">已拒绝</option>
              <option value="cancelled">已取消</option>
            </select>
            <select className="border rounded px-2 py-1" value={labFilter ?? ''} onChange={(e) => { setLabFilter(e.target.value ? Number(e.target.value) : undefined); setPage(1); }}>
              <option value="">全部实验室</option>
              {labs?.map(l => (<option key={l.id} value={l.id}>{l.name}</option>))}
            </select>
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
                    {reservationsPage?.items.map((reservation: any) => (
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
                          <span className={statusMap[reservation.status as keyof typeof statusMap].color}>
                            {statusMap[reservation.status as keyof typeof statusMap].label}
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

                {/* 分页 */}
                <div className="flex items-center justify-between p-4">
                  <div className="text-sm text-gray-600">共 {reservationsPage?.total ?? 0} 条</div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>上一页</Button>
                    <div className="px-2">第 {page} 页</div>
                    <Button size="sm" variant="outline" disabled={(reservationsPage?.total ?? 0) <= page * pageSize} onClick={() => setPage(p => p + 1)}>下一页</Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
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
