import { useState } from "react";
import { BaseCard } from "@/components/ui/base-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { AlertTriangle, Ban, ShieldAlert, Trash2, UserX } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";

export default function ViolationManagePage() {
  const [searchUserId, setSearchUserId] = useState("");
  const [selectedBlacklist, setSelectedBlacklist] = useState<any>(null);
  const [isRemoveDialogOpen, setIsRemoveDialogOpen] = useState(false);

  // 查询违约记录 - 管理员查看所有记录
  const { data: violations = [], refetch: refetchViolations } =
    trpc.violation.getAllRecords.useQuery();

  // 查询黑名单 - 查询所有黑名单用户
  const { data: blacklistData = [], refetch: refetchBlacklist } =
    trpc.audit.getLogs.useQuery({
      operationType: "blacklist_add",
      limit: 100,
    });

  // 移除黑名单
  const removeBlacklist = trpc.violation.removeBlacklist.useMutation({
    onSuccess: () => {
      toast.success("移除成功 - 已将用户从黑名单中移除");
      refetchBlacklist();
      setIsRemoveDialogOpen(false);
      setSelectedBlacklist(null);
    },
    onError: (error) => {
      toast.error(`移除失败 - ${error.message}`);
    },
  });

  const handleRemoveBlacklist = () => {
    if (selectedBlacklist) {
      removeBlacklist.mutate({ userId: selectedBlacklist.targetId });
    }
  };

  // 违约类型映射
  const violationTypeMap: Record<string, { label: string; icon: any }> = {
    no_show: { label: "未签到", icon: UserX },
    late_cancel: { label: "迟到取消", icon: AlertTriangle },
    damage: { label: "设备损坏", icon: ShieldAlert },
    违反规则: { label: "违反规则", icon: Ban },
  };

  // 限制类型映射
  const restrictionTypeMap: Record<string, string> = {
    time_limit: "时间限制",
    resource_limit: "资源限制",
  };

  return (
    <div className="p-6 space-y-6 bg-gray-50 min-h-screen">
      {/* 页面标题 */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">违约与黑名单管理</h1>
        <p className="text-sm text-gray-500 mt-1">
          查看违约记录、管理用户黑名单状态
        </p>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <BaseCard className="hover:shadow-md transition-shadow">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-red-100 rounded-lg">
              <AlertTriangle className="h-6 w-6 text-red-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">总违约记录</p>
              <p className="text-3xl font-bold text-gray-900">{violations.length}</p>
            </div>
          </div>
        </BaseCard>

        <BaseCard className="hover:shadow-md transition-shadow">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-amber-100 rounded-lg">
              <Ban className="h-6 w-6 text-amber-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">黑名单用户</p>
              <p className="text-3xl font-bold text-gray-900">{blacklistData.length}</p>
            </div>
          </div>
        </BaseCard>

        <BaseCard className="hover:shadow-md transition-shadow">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-100 rounded-lg">
              <ShieldAlert className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">总违约积分</p>
              <p className="text-3xl font-bold text-gray-900">
                {violations.reduce((sum, v) => sum + (v.points || 0), 0)}
              </p>
            </div>
          </div>
        </BaseCard>
      </div>

      {/* 违约规则说明 */}
      <BaseCard
        title="违约规则说明"
        subtitle="了解如何判定违约以及对应的处罚规则"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 无故缺席 */}
            <div className="border-l-4 border-red-500 pl-4 py-2">
              <h3 className="font-semibold text-red-700 mb-1">无故缺席 (no_show)</h3>
              <p className="text-sm text-gray-600 mb-2">
                用户已获得预约批准，但在预定时间没有签到
              </p>
              <p className="text-sm font-medium text-red-600">违约分：5 分</p>
            </div>

            {/* 迟到取消 */}
            <div className="border-l-4 border-amber-500 pl-4 py-2">
              <h3 className="font-semibold text-amber-700 mb-1">迟到取消 (late_cancel)</h3>
              <p className="text-sm text-gray-600 mb-2">
                用户在预定开始前不足 24 小时取消预约
              </p>
              <p className="text-sm font-medium text-amber-600">违约分：2 分</p>
            </div>

            {/* 超时未签出 */}
            <div className="border-l-4 border-orange-500 pl-4 py-2">
              <h3 className="font-semibold text-orange-700 mb-1">超时未签出 (timeout_checkout)</h3>
              <p className="text-sm text-gray-600 mb-2">
                用户预约超过规定时间后未及时签出实验室
              </p>
              <p className="text-sm font-medium text-orange-600">违约分：3 分</p>
            </div>

            {/* 手动记录 */}
            <div className="border-l-4 border-pink-500 pl-4 py-2">
              <h3 className="font-semibold text-pink-700 mb-1">手动记录 (manual_record)</h3>
              <p className="text-sm text-gray-600 mb-2">
                管理员手动记录的其他违约行为（设备损坏、违反规则等）
              </p>
              <p className="text-sm font-medium text-pink-600">违约分：可自定义</p>
            </div>
          </div>

          {/* 黑名单触发规则 */}
          <div className="mt-6 pt-6 border-t bg-blue-50 p-4 rounded-lg">
            <h4 className="font-semibold text-blue-900 mb-2">黑名单触发规则</h4>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• 累计违约分数 ≥ 10 分时，用户自动进入黑名单</li>
              <li>• 黑名单用户无法创建新的预约请求</li>
              <li>• 默认限制期限为 7 天，超期后自动解除</li>
              <li>• 管理员可手动提前解除或延长限制</li>
            </ul>
          </div>
        </div>
      </BaseCard>

      {/* 违约记录列表 */}
      <BaseCard
        title="违约记录"
        subtitle="查看所有用户的违约记录"
        headerAction={
          <div className="flex gap-2 items-center">
            <Label className="text-xs">用户ID筛选：</Label>
            <Input
              type="number"
              placeholder="输入用户ID"
              value={searchUserId}
              onChange={(e) => setSearchUserId(e.target.value)}
              className="w-32 rounded-lg"
            />
          </div>
        }
      >
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>用户名称</TableHead>
                <TableHead>违约类型</TableHead>
                <TableHead>积分</TableHead>
                <TableHead>描述</TableHead>
                <TableHead>相关预约</TableHead>
                <TableHead>记录时间</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {violations.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-gray-500 py-12">
                    暂无违约记录
                  </TableCell>
                </TableRow>
              ) : (
                violations.map((violation) => {
                  const typeInfo = violationTypeMap[violation.violationType] || {
                    label: violation.violationType,
                    icon: AlertTriangle,
                  };
                  const Icon = typeInfo.icon;

                  return (
                    <TableRow key={violation.id}>
                      <TableCell className="font-medium">{violation.userName || `用户${violation.userId}`}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4 text-red-600" />
                          <span>{typeInfo.label}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <StatusBadge variant="rejected">
                          {violation.points} 分
                        </StatusBadge>
                      </TableCell>
                      <TableCell className="max-w-xs truncate">
                        {violation.description || "-"}
                      </TableCell>
                      <TableCell>
                        {violation.reservationId ? `#${violation.reservationId}` : "-"}
                      </TableCell>
                      <TableCell className="text-sm text-gray-600">
                        {violation.createdAt
                          ? format(new Date(violation.createdAt), "yyyy-MM-dd HH:mm", {
                              locale: zhCN,
                            })
                          : "-"}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </BaseCard>

      {/* 黑名单列表 */}
      <BaseCard
        title="黑名单管理"
        subtitle="管理受限用户的黑名单状态"
        headerAction={
          <StatusBadge variant="restricted">
            {blacklistData.filter((b: any) => b.operationType === "blacklist_add").length} 个活跃限制
          </StatusBadge>
        }
      >
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>用户ID</TableHead>
                <TableHead>操作</TableHead>
                <TableHead>理由</TableHead>
                <TableHead>记录时间</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {blacklistData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-gray-500 py-12">
                    暂无黑名单记录
                  </TableCell>
                </TableRow>
              ) : (
                blacklistData.map((item: any) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.targetId}</TableCell>
                    <TableCell>
                      <StatusBadge variant="restricted">
                        {item.operationType === "blacklist_add" ? "已加入" : "已移除"}
                      </StatusBadge>
                    </TableCell>
                    <TableCell className="max-w-xs truncate">
                      {item.reason || "-"}
                    </TableCell>
                    <TableCell className="text-sm text-gray-600">
                      {item.createdAt
                        ? format(new Date(item.createdAt), "yyyy-MM-dd", {
                            locale: zhCN,
                          })
                        : "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      {item.operationType === "blacklist_add" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedBlacklist(item);
                            setIsRemoveDialogOpen(true);
                          }}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          移除
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </BaseCard>

      {/* 移除确认对话框 */}
      <Dialog open={isRemoveDialogOpen} onOpenChange={setIsRemoveDialogOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              确认移除黑名单
            </DialogTitle>
            <DialogDescription>
              确定要将用户 #{selectedBlacklist?.userId} 从黑名单中移除吗？移除后该用户将恢复正常预约权限。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsRemoveDialogOpen(false)}
              className="rounded-lg"
            >
              取消
            </Button>
            <Button
              onClick={handleRemoveBlacklist}
              disabled={removeBlacklist.isPending}
              className="bg-red-600 hover:bg-red-700 rounded-lg"
            >
              确认移除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
