import { useMemo, useState, type ElementType } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
  Activity,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  Download,
  FileText,
  Globe,
  Monitor,
  RefreshCw,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  User,
  X,
} from "lucide-react";
import { format } from "date-fns";

export default function AuditLogPage() {
  const [filters, setFilters] = useState({
    type: "all",
    operatorId: "",
    startDate: "",
    endDate: "",
  });
  const [selectedLog, setSelectedLog] = useState<any>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  const { data: logs = [], isLoading, refetch } = trpc.audit.getLogs.useQuery({
    operationType: filters.type && filters.type !== "all" ? filters.type : undefined,
    targetType: undefined,
    startDate: filters.startDate ? new Date(filters.startDate) : undefined,
    endDate: filters.endDate ? new Date(filters.endDate) : undefined,
    limit: 100,
  });

  const operationTypeMap: Record<
    string,
    { label: string; variant: "info" | "approved" | "rejected" | "pending" | "restricted"; icon: ElementType }
  > = {
    reservation_create: { label: "创建预约", variant: "info", icon: Calendar },
    reservation_approve: { label: "审批通过", variant: "approved", icon: ShieldCheck },
    reservation_reject: { label: "拒绝预约", variant: "rejected", icon: ShieldAlert },
    reservation_cancel: { label: "取消预约", variant: "rejected", icon: X },
    violation_record: { label: "违约记录", variant: "rejected", icon: ShieldAlert },
    blacklist_add: { label: "加入黑名单", variant: "restricted", icon: Shield },
    blacklist_remove: { label: "移除黑名单", variant: "approved", icon: ShieldCheck },
    config_update: { label: "系统配置", variant: "pending", icon: Activity },
    course_create: { label: "创建课程", variant: "info", icon: Calendar },
    course_update: { label: "更新课程", variant: "pending", icon: Activity },
    course_delete: { label: "删除课程", variant: "rejected", icon: X },
    course_student_add: { label: "添加学生", variant: "approved", icon: ShieldCheck },
    course_reservation_create: { label: "课程预约", variant: "info", icon: Calendar },
    course_reservation_cancel: { label: "取消课程预约", variant: "rejected", icon: ShieldAlert },
    lab_update: { label: "更新实验室", variant: "pending", icon: Activity },
    rule_update: { label: "更新规则", variant: "pending", icon: Activity },
  };

  const stats = useMemo(
    () => ({
      total: logs.length,
      today: logs.filter((l: any) =>
        l.operatedAt && format(new Date(l.operatedAt), "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd")
      ).length,
      violations: logs.filter((l: any) => l.operationType === "violation_record").length,
      approvals: logs.filter((l: any) => l.operationType?.includes("approve") || l.operationType?.includes("reject")).length,
    }),
    [logs]
  );

  const variantIconClass: Record<typeof operationTypeMap[keyof typeof operationTypeMap]["variant"], string> = {
    info: "text-blue-600",
    approved: "text-green-600",
    rejected: "text-red-600",
    pending: "text-yellow-600",
    restricted: "text-purple-600",
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

  const safeDetails = useMemo(() => {
    if (!selectedLog?.details) return null;
    if (typeof selectedLog.details !== "string") return selectedLog.details;
    try {
      return JSON.parse(selectedLog.details);
    } catch (error) {
      return selectedLog.details;
    }
  }, [selectedLog]);

  return (
    <div className="min-h-screen bg-slate-50/50 p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Shield className="h-6 w-6 text-slate-700" /> 审计日志
          </h1>
          <p className="text-slate-500 text-sm mt-1">监控系统关键操作，追踪安全事件与变更记录。</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2 bg-white">
            <RefreshCw className="h-4 w-4" /> 刷新数据
          </Button>
          <Button variant="outline" size="sm" className="gap-2 bg-white">
            <Download className="h-4 w-4" /> 导出 CSV
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "总日志条数", value: stats.total, icon: FileText, color: "text-blue-600", bg: "bg-blue-50" },
          { label: "今日操作", value: stats.today, icon: Clock, color: "text-purple-600", bg: "bg-purple-50" },
          { label: "违约记录", value: stats.violations, icon: ShieldAlert, color: "text-rose-600", bg: "bg-rose-50" },
          { label: "审批操作", value: stats.approvals, icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50" },
        ].map((stat, idx) => (
          <Card key={idx} className="hover:shadow-md transition-shadow border-slate-200 h-full">
            <CardContent className="p-4 pt-4 flex items-center gap-4 h-full">
              <div className={cn("p-3 rounded-lg shrink-0", stat.bg)}>
                <stat.icon className={cn("h-5 w-5", stat.color)} />
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500">{stat.label}</p>
                <p className="text-2xl font-bold text-slate-900 leading-none mt-1">{stat.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-slate-200 shadow-sm overflow-hidden">
        <div className="border-b border-slate-100 p-4 bg-white flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
          <div className="flex flex-1 flex-col sm:flex-row gap-3 w-full lg:w-auto">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                placeholder="搜索操作员ID、目标ID..."
                className="pl-9 bg-slate-50 border-slate-200 focus:bg-white transition-colors"
                value={filters.operatorId}
                onChange={(e) => setFilters({ ...filters, operatorId: e.target.value })}
              />
            </div>

            <Select value={filters.type} onValueChange={(val) => setFilters({ ...filters, type: val })}>
              <SelectTrigger className="h-10 w-full sm:w-40 rounded-md border-slate-200 bg-slate-50">
                <SelectValue placeholder="所有类型" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">所有类型</SelectItem>
                {Object.entries(operationTypeMap).map(([key, val]) => (
                  <SelectItem key={key} value={key}>
                    {val.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex gap-2 w-full sm:w-auto">
              <Input
                type="date"
                className="w-full sm:w-auto bg-slate-50 border-slate-200"
                value={filters.startDate}
                onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
              />
              <Input
                type="date"
                className="w-full sm:w-auto bg-slate-50 border-slate-200"
                value={filters.endDate}
                onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
              />
            </div>
          </div>

          {(filters.type !== "all" || filters.operatorId || filters.startDate || filters.endDate) && (
            <Button variant="ghost" size="sm" onClick={handleClearFilters} className="text-slate-500 hover:text-red-600">
              <X className="mr-2 h-4 w-4" /> 重置筛选
            </Button>
          )}
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="text-xs text-slate-500 uppercase bg-slate-50/80 border-b border-slate-200">
                <TableHead className="font-medium">操作时间</TableHead>
                <TableHead className="font-medium">操作类型</TableHead>
                <TableHead className="font-medium">操作员</TableHead>
                <TableHead className="font-medium">目标对象</TableHead>
                <TableHead className="font-medium">IP来源</TableHead>
                <TableHead className="font-medium text-right">详情</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-slate-100 bg-white">
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="px-6 py-12 text-center text-slate-500">
                    <RefreshCw className="h-8 w-8 mx-auto animate-spin mb-2 text-slate-300" />
                    加载数据中...
                  </TableCell>
                </TableRow>
              ) : logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="px-6 py-12 text-center text-slate-500 bg-slate-50/30">
                    <div className="flex flex-col items-center justify-center">
                      <Shield className="h-10 w-10 text-slate-200 mb-2" />
                      暂无相关日志记录
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                logs.map((log: any) => {
                  const typeInfo = operationTypeMap[log.operationType] || { label: log.operationType, variant: "info", icon: Activity };
                  const TypeIcon = typeInfo.icon;
                  const operatedAt = log.operatedAt ? new Date(log.operatedAt) : null;

                  return (
                    <TableRow key={log.id} className="hover:bg-slate-50/80 transition-colors">
                      <TableCell className="px-6 py-4 whitespace-nowrap text-slate-600">
                        <div className="flex flex-col">
                          <span className="font-medium text-slate-900">
                            {operatedAt ? format(operatedAt, "HH:mm:ss") : "-"}
                          </span>
                          <span className="text-xs text-slate-400">
                            {operatedAt ? format(operatedAt, "yyyy-MM-dd") : ""}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="px-6 py-4 whitespace-nowrap">
                        <StatusBadge variant={typeInfo.variant} className="gap-1">
                          <TypeIcon className={cn("h-3.5 w-3.5", variantIconClass[typeInfo.variant])} />
                          {typeInfo.label}
                        </StatusBadge>
                      </TableCell>
                      <TableCell className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 text-xs font-bold">
                            {(log.operatorName || "?").slice(0, 1)}
                          </div>
                          <div>
                            <div className="font-medium text-slate-900">{log.operatorName || `用户${log.operatorId || log.operatorUserId || ""}`}</div>
                            <div className="text-xs text-slate-500 font-mono">{log.operatorId || log.operatorUserId || "-"}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className="text-slate-900 font-medium">{log.targetType || "-"}</span>
                          <span className="text-xs text-slate-400 font-mono">{log.targetId || "-"}</span>
                        </div>
                      </TableCell>
                      <TableCell className="px-6 py-4 whitespace-nowrap font-mono text-xs text-slate-500">
                        <div className="flex items-center gap-1.5">
                          <Globe className="h-3 w-3 text-slate-300" />
                          {log.ipAddress || "-"}
                        </div>
                      </TableCell>
                      <TableCell className="px-6 py-4 whitespace-nowrap text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewDetail(log)}
                          className="h-8 w-8 p-0 rounded-full hover:bg-slate-200"
                        >
                          <ChevronRight className="h-4 w-4 text-slate-400" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
        <div className="border-t border-slate-100 p-4 bg-slate-50 text-xs text-slate-500 flex justify-between items-center">
          <span>显示 {logs.length > 0 ? 1 : 0} 到 {logs.length} 条，共 {logs.length} 条记录</span>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" className="h-7 px-2 text-xs" disabled>
              上一页
            </Button>
            <Button variant="outline" size="sm" className="h-7 px-2 text-xs" disabled>
              下一页
            </Button>
          </div>
        </div>
      </Card>

      <Sheet open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <SheetContent className="w-[500px] sm:w-[600px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-slate-500" /> 日志详情
            </SheetTitle>
            <SheetDescription>查看操作的完整信息和详细数据</SheetDescription>
          </SheetHeader>

          {selectedLog && (
            <div className="mt-6 space-y-6">
              <section className="space-y-4">
                <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <Activity className="h-4 w-4 text-blue-500" /> 核心信息
                </h3>
                <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-lg border border-slate-100">
                  <div>
                    <span className="text-xs text-slate-500 block mb-1">操作时间</span>
                    <span className="text-sm font-medium">
                      {selectedLog.operatedAt
                        ? format(new Date(selectedLog.operatedAt), "yyyy-MM-dd HH:mm:ss")
                        : "-"}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 block mb-1">操作类型</span>
                    <StatusBadge variant={operationTypeMap[selectedLog.operationType]?.variant || "info"}>
                      {operationTypeMap[selectedLog.operationType]?.label || selectedLog.operationType}
                    </StatusBadge>
                  </div>
                </div>
              </section>

              <section className="space-y-4">
                <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <User className="h-4 w-4 text-purple-500" /> 主体与对象
                </h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between py-2 border-b border-slate-100">
                    <span className="text-sm text-slate-500">操作员</span>
                    <div className="text-right">
                      <div className="text-sm font-medium text-slate-900">{selectedLog.operatorName || "-"}</div>
                      <div className="text-xs text-slate-400 font-mono">{selectedLog.operatorId || selectedLog.operatorUserId || "-"}</div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-slate-100">
                    <span className="text-sm text-slate-500">目标对象</span>
                    <div className="text-right">
                      <div className="text-sm font-medium text-slate-900 capitalize">{selectedLog.targetType || "-"}</div>
                      <div className="text-xs text-slate-400 font-mono">{selectedLog.targetId || "-"}</div>
                    </div>
                  </div>
                </div>
              </section>

              <section className="space-y-4">
                <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <Monitor className="h-4 w-4 text-emerald-500" /> 环境上下文
                </h3>
                <div className="bg-slate-50 rounded-lg border border-slate-100 divide-y divide-slate-100">
                  <div className="p-3 flex justify-between items-center">
                    <span className="text-xs text-slate-500">IP 地址</span>
                    <span className="text-xs font-mono bg-white px-2 py-1 rounded border shadow-sm">
                      {selectedLog.ipAddress || "-"}
                    </span>
                  </div>
                  <div className="p-3">
                    <span className="text-xs text-slate-500 block mb-1">User Agent</span>
                    <p className="text-xs text-slate-700 font-mono break-all leading-relaxed">
                      {selectedLog.userAgent || "-"}
                    </p>
                  </div>
                </div>
              </section>

              {safeDetails && (
                <section className="space-y-4">
                  <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                    <FileText className="h-4 w-4 text-slate-400" /> 原始数据快照
                  </h3>
                  <div className="relative">
                    <div className="absolute top-2 right-2 text-[10px] text-slate-400 font-mono">JSON</div>
                    <pre className="bg-slate-900 text-slate-50 p-4 rounded-lg text-xs overflow-x-auto font-mono leading-relaxed border border-slate-800 shadow-inner">
                      {typeof safeDetails === "string"
                        ? safeDetails
                        : JSON.stringify(safeDetails, null, 2)}
                    </pre>
                  </div>
                </section>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
