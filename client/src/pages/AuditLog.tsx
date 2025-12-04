import { useState } from "react";
import { BaseCard } from "@/components/ui/base-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { trpc } from "@/lib/trpc";
import {
  FileText,
  Filter,
  Calendar,
  User,
  Activity,
  RefreshCw,
} from "lucide-react";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";

export default function AuditLogPage() {
  const [filters, setFilters] = useState({
    type: "all",
    operatorId: "",
    startDate: "",
    endDate: "",
  });
  const [selectedLog, setSelectedLog] = useState<any>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // 查询审计日志
  const { data: logs = [], isLoading, refetch } = trpc.audit.getLogs.useQuery({
    operationType: filters.type && filters.type !== "all" ? filters.type : undefined,
    targetType: undefined,
    startDate: filters.startDate ? new Date(filters.startDate) : undefined,
    endDate: filters.endDate ? new Date(filters.endDate) : undefined,
    limit: 100,
  });

  // 操作类型映射
  const operationTypeMap: Record<string, { label: string; variant: any }> = {
    reservation_create: { label: "创建预约", variant: "info" },
    reservation_approve: { label: "审批预约", variant: "approved" },
    reservation_reject: { label: "拒绝预约", variant: "rejected" },
    reservation_cancel: { label: "取消预约", variant: "info" },
    violation_record: { label: "记录违约", variant: "rejected" },
    blacklist_add: { label: "加入黑名单", variant: "restricted" },
    blacklist_remove: { label: "移除黑名单", variant: "approved" },
    config_update: { label: "更新配置", variant: "info" },
  };

  const handleViewDetail = (log: any) => {
    setSelectedLog(log);
    setIsDetailOpen(true);
  };

  const handleClearFilters = () => {
    setFilters({
      type: "all",
      operatorId: "",
      startDate: "",
      endDate: "",
    });
  };

  return (
    <div className="p-6 space-y-6 bg-gray-50 min-h-screen">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">审计日志</h1>
          <p className="text-sm text-gray-500 mt-1">
            查看系统操作记录，确保安全透明
          </p>
        </div>
        <Button
          onClick={() => refetch()}
          variant="outline"
          className="gap-2 rounded-lg"
        >
          <RefreshCw className="h-4 w-4" />
          刷新
        </Button>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <BaseCard className="hover:shadow-md transition-shadow">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-100 rounded-lg">
              <FileText className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">总日志条数</p>
              <p className="text-3xl font-bold text-gray-900">{logs.length}</p>
            </div>
          </div>
        </BaseCard>

        <BaseCard className="hover:shadow-md transition-shadow">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-green-100 rounded-lg">
              <Activity className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">审批操作</p>
              <p className="text-3xl font-bold text-gray-900">
                {logs.filter((l: any) => l.operationType?.includes("approve") || l.operationType?.includes("reject")).length}
              </p>
            </div>
          </div>
        </BaseCard>

        <BaseCard className="hover:shadow-md transition-shadow">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-red-100 rounded-lg">
              <User className="h-6 w-6 text-red-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">违约记录</p>
              <p className="text-3xl font-bold text-gray-900">
                {logs.filter((l: any) => l.operationType === "violation_record").length}
              </p>
            </div>
          </div>
        </BaseCard>

        <BaseCard className="hover:shadow-md transition-shadow">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-purple-100 rounded-lg">
              <Calendar className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">今日操作</p>
              <p className="text-3xl font-bold text-gray-900">
                {logs.filter((l: any) => {
                  if (!l.createdAt) return false;
                  const logDate = format(new Date(l.createdAt), "yyyy-MM-dd");
                  const today = format(new Date(), "yyyy-MM-dd");
                  return logDate === today;
                }).length}
              </p>
            </div>
          </div>
        </BaseCard>
      </div>

      {/* 操作指南 */}
      <BaseCard
        title="审计系统说明"
        subtitle="了解审计日志的记录规则和可用操作"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* 左侧：自动记录的操作 */}
          <div>
            <h4 className="font-semibold text-gray-900 mb-3">✅ 自动记录的操作</h4>
            <ul className="space-y-2 text-sm text-gray-600">
              <li className="flex items-start gap-2">
                <span className="text-blue-600 font-bold">•</span>
                <span><strong>创建预约</strong> - 用户或管理员创建新预约时</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-600 font-bold">•</span>
                <span><strong>审批操作</strong> - 预约被批准或拒绝时</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red-600 font-bold">•</span>
                <span><strong>违约记录</strong> - 管理员手动记录用户违约时</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-600 font-bold">•</span>
                <span><strong>黑名单变更</strong> - 用户进入或移出黑名单时</span>
              </li>
            </ul>
          </div>

          {/* 右侧：日志字段说明 */}
          <div>
            <h4 className="font-semibold text-gray-900 mb-3">📋 日志字段说明</h4>
            <ul className="space-y-2 text-sm text-gray-600">
              <li><strong>时间(operatedAt)</strong> - 操作发生的准确时间</li>
              <li><strong>操作类型</strong> - 具体的操作分类（如创建、批准等）</li>
              <li><strong>操作员名字</strong> - 执行操作的用户名称</li>
              <li><strong>IP地址</strong> - 操作发起的来源 IP</li>
              <li><strong>目标</strong> - 操作涉及的对象（预约、用户等）</li>
            </ul>
          </div>
        </div>
      </BaseCard>

      {/* 筛选器 */}
      <BaseCard
        title="筛选条件"
        subtitle="根据操作类型、操作员、日期范围筛选日志"
        headerAction={
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearFilters}
            className="text-blue-600 hover:bg-blue-50"
          >
            清空筛选
          </Button>
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <Label>操作类型</Label>
            <Select value={filters.type} onValueChange={(val) => setFilters({ ...filters, type: val })}>
              <SelectTrigger className="rounded-lg">
                <SelectValue placeholder="全部类型" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部类型</SelectItem>
                {Object.entries(operationTypeMap).map(([key, val]) => (
                  <SelectItem key={key} value={key}>
                    {val.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>操作员ID</Label>
            <Input
              type="number"
              placeholder="输入操作员ID"
              value={filters.operatorId}
              onChange={(e) => setFilters({ ...filters, operatorId: e.target.value })}
              className="rounded-lg"
            />
          </div>

          <div>
            <Label>开始日期</Label>
            <Input
              type="date"
              value={filters.startDate}
              onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
              className="rounded-lg"
            />
          </div>

          <div>
            <Label>结束日期</Label>
            <Input
              type="date"
              value={filters.endDate}
              onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
              className="rounded-lg"
            />
          </div>
        </div>
      </BaseCard>

      {/* 日志列表 */}
      <BaseCard
        title="操作记录"
        subtitle={`共 ${logs.length} 条记录`}
        headerAction={
          <div className="flex items-center gap-2 text-blue-600">
            <Filter className="h-4 w-4" />
            <span className="text-sm">
              {filters.type !== "all" || filters.operatorId || filters.startDate || filters.endDate
                ? "已筛选"
                : "未筛选"}
            </span>
          </div>
        }
      >
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>时间</TableHead>
                <TableHead>操作类型</TableHead>
                <TableHead>操作员ID</TableHead>
                <TableHead>目标类型</TableHead>
                <TableHead>目标ID</TableHead>
                <TableHead>IP地址</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12">
                    <RefreshCw className="h-8 w-8 mx-auto animate-spin text-blue-600" />
                    <p className="text-gray-500 mt-2">加载中...</p>
                  </TableCell>
                </TableRow>
              ) : logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-gray-500 py-12">
                    暂无审计日志
                  </TableCell>
                </TableRow>
              ) : (
                logs.map((log: any) => {
                  const typeInfo = operationTypeMap[log.operationType] || {
                    label: log.operationType,
                    variant: "info",
                  };

                  return (
                    <TableRow key={log.id} className="hover:bg-gray-50">
                      <TableCell className="text-sm text-gray-600">
                        {log.operatedAt
                          ? format(new Date(log.operatedAt), "MM-dd HH:mm:ss", {
                              locale: zhCN,
                            })
                          : "-"}
                      </TableCell>
                      <TableCell>
                        <StatusBadge variant={typeInfo.variant}>
                          {typeInfo.label}
                        </StatusBadge>
                      </TableCell>
                      <TableCell className="font-medium">{log.operatorName || `用户${log.operatorUserId}`}</TableCell>
                      <TableCell className="text-sm text-gray-600">
                        {log.targetType || "-"}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {log.targetId || "-"}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-gray-500">
                        {log.ipAddress || "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewDetail(log)}
                          className="text-blue-600 hover:bg-blue-50"
                        >
                          查看详情
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </BaseCard>

      {/* 详情侧边栏 */}
      <Sheet open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <SheetContent className="w-[500px] sm:w-[600px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-600" />
              审计日志详情
            </SheetTitle>
            <SheetDescription>
              查看操作的完整信息和详细数据
            </SheetDescription>
          </SheetHeader>

          {selectedLog && (
            <div className="mt-6 space-y-6">
              {/* 基本信息 */}
              <div className="space-y-3">
                <h4 className="font-semibold text-gray-900">基本信息</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">日志ID：</span>
                    <span className="font-mono">{selectedLog.id}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">操作类型：</span>
                    <StatusBadge variant={operationTypeMap[selectedLog.operationType]?.variant || "info"}>
                      {operationTypeMap[selectedLog.operationType]?.label || selectedLog.operationType}
                    </StatusBadge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">操作员ID：</span>
                    <span className="font-medium">{selectedLog.operatorId}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">操作时间：</span>
                    <span>
                      {selectedLog.createdAt
                        ? format(new Date(selectedLog.createdAt), "yyyy-MM-dd HH:mm:ss", {
                            locale: zhCN,
                          })
                        : "-"}
                    </span>
                  </div>
                </div>
              </div>

              {/* 目标信息 */}
              <div className="space-y-3">
                <h4 className="font-semibold text-gray-900">目标信息</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">目标类型：</span>
                    <span>{selectedLog.targetType || "-"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">目标ID：</span>
                    <span className="font-mono">{selectedLog.targetId || "-"}</span>
                  </div>
                </div>
              </div>

              {/* 网络信息 */}
              <div className="space-y-3">
                <h4 className="font-semibold text-gray-900">网络信息</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">IP地址：</span>
                    <span className="font-mono">{selectedLog.ipAddress || "-"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">User Agent：</span>
                    <span className="font-mono text-xs max-w-xs truncate">
                      {selectedLog.userAgent || "-"}
                    </span>
                  </div>
                </div>
              </div>

              {/* 详细数据 */}
              {selectedLog.details && (
                <div className="space-y-3">
                  <h4 className="font-semibold text-gray-900">详细数据</h4>
                  <pre className="bg-gray-50 p-4 rounded-lg text-xs overflow-x-auto border border-gray-200">
                    {JSON.stringify(
                      typeof selectedLog.details === "string"
                        ? JSON.parse(selectedLog.details)
                        : selectedLog.details,
                      null,
                      2
                    )}
                  </pre>
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
