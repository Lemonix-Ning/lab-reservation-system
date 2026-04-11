import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, Clock, ShieldCheck } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

const roleLabels: Record<string, string> = {
  student: "学生",
  teacher: "教师",
  labAdmin: "实验室管理员",
  sysAdmin: "系统管理员",
};

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  pending: { label: "待审核", color: "bg-yellow-100 text-yellow-800", icon: Clock },
  approved: { label: "已通过", color: "bg-green-100 text-green-800", icon: CheckCircle },
  rejected: { label: "已拒绝", color: "bg-red-100 text-red-800", icon: XCircle },
};

export default function RoleRequestReview() {
  const utils = trpc.useUtils();
  const [activeTab, setActiveTab] = useState<"pending" | "approved" | "rejected">("pending");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [reviewAction, setReviewAction] = useState<"approve" | "reject">("approve");
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [comment, setComment] = useState("");

  const { data: pending = [], isLoading: pendingLoading } = trpc.roleRequest.getPending.useQuery();
  const { data: approved = [], isLoading: approvedLoading } = trpc.roleRequest.getAll.useQuery(
    { status: "approved" },
    { enabled: activeTab === "approved" }
  );
  const { data: rejected = [], isLoading: rejectedLoading } = trpc.roleRequest.getAll.useQuery(
    { status: "rejected" },
    { enabled: activeTab === "rejected" }
  );

  const reviewMutation = trpc.roleRequest.review.useMutation({
    onSuccess: () => {
      toast.success(reviewAction === "approve" ? "已通过申请" : "已拒绝申请");
      utils.roleRequest.getPending.invalidate();
      utils.roleRequest.getAll.invalidate();
      // 刷新用户列表，以便管理员看到角色变化
      utils.user.getAll.invalidate();
      setDialogOpen(false);
      setSelectedRequest(null);
      setComment("");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const data = useMemo(() => {
    if (activeTab === "pending") return pending;
    if (activeTab === "approved") return approved;
    return rejected;
  }, [activeTab, pending, approved, rejected]);

  const isLoading =
    (activeTab === "pending" && pendingLoading) ||
    (activeTab === "approved" && approvedLoading) ||
    (activeTab === "rejected" && rejectedLoading);

  const openReviewDialog = (request: any, action: "approve" | "reject") => {
    setSelectedRequest(request);
    setReviewAction(action);
    setComment("");
    setDialogOpen(true);
  };

  const handleConfirm = () => {
    if (!selectedRequest) return;
    reviewMutation.mutate({
      requestId: selectedRequest.id,
      approved: reviewAction === "approve",
      comment: comment || undefined,
    });
  };

  return (
    <div className="bg-gray-50 min-h-screen">
      <main className="container py-8">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <ShieldCheck className="h-8 w-8 text-indigo-600" />
            <h2 className="text-3xl font-bold text-gray-900">身份审核</h2>
          </div>
          <p className="text-gray-600">审核用户的身份升级申请</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>申请列表</CardTitle>
            <CardDescription>
              待审核、已通过与已拒绝的历史记录
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
              <TabsList>
                <TabsTrigger value="pending">待审核</TabsTrigger>
                <TabsTrigger value="approved">已通过</TabsTrigger>
                <TabsTrigger value="rejected">已拒绝</TabsTrigger>
              </TabsList>

              <TabsContent value={activeTab} className="mt-4">
                {isLoading ? (
                  <div className="text-center py-8 text-gray-500">加载中...</div>
                ) : data.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">暂无记录</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>申请人</TableHead>
                        <TableHead>目标角色</TableHead>
                        <TableHead>部门</TableHead>
                        <TableHead>工号</TableHead>
                        <TableHead>申请时间</TableHead>
                        <TableHead>状态</TableHead>
                        <TableHead className="text-right">操作</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.map((item: any) => {
                        const config = statusConfig[item.status];
                        const Icon = config.icon;
                        return (
                          <TableRow key={item.id}>
                            <TableCell>
                              <div className="font-medium">{item.user?.name || "-"}</div>
                              <div className="text-xs text-gray-500">{item.user?.email || "-"}</div>
                            </TableCell>
                            <TableCell>{roleLabels[item.requestedRole]}</TableCell>
                            <TableCell>{item.department || "-"}</TableCell>
                            <TableCell>{item.employeeNo || "-"}</TableCell>
                            <TableCell>{format(new Date(item.createdAt), "yyyy-MM-dd HH:mm")}</TableCell>
                            <TableCell>
                              <Badge className={config.color}>
                                <Icon className="h-3 w-3 mr-1" />
                                {config.label}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              {item.status === "pending" ? (
                                <div className="flex justify-end gap-2">
                                  <Button size="sm" onClick={() => openReviewDialog(item, "approve")}>通过</Button>
                                  <Button size="sm" variant="destructive" onClick={() => openReviewDialog(item, "reject")}>拒绝</Button>
                                </div>
                              ) : (
                                <span className="text-sm text-gray-500">已处理</span>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </main>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{reviewAction === "approve" ? "通过申请" : "拒绝申请"}</DialogTitle>
            <DialogDescription>
              {reviewAction === "approve" ? "确认通过该申请？" : "请填写拒绝原因（可选）"}
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="审核意见（可选）"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>取消</Button>
            <Button onClick={handleConfirm} disabled={reviewMutation.isPending}>
              {reviewMutation.isPending ? "处理中..." : "确认"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
