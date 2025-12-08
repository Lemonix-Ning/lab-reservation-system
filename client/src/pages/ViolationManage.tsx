import { useMemo, useState, type ElementType } from "react";
import {
  AlertTriangle,
  Ban,
  ShieldAlert,
  Trash2,
  UserX,
  Search,
  Clock,
  AlertCircle,
  Gavel,
  History,
  Info,
} from "lucide-react";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

const violationTypeMap: Record<string, { label: string; icon: ElementType; color: string; bg: string }> = {
  no_show: { label: "未签到", icon: UserX, color: "text-rose-600", bg: "bg-rose-50" },
  late_cancel: { label: "迟到取消", icon: Clock, color: "text-amber-600", bg: "bg-amber-50" },
  damage: { label: "设备损坏", icon: ShieldAlert, color: "text-purple-600", bg: "bg-purple-50" },
  other: { label: "违反规则", icon: Ban, color: "text-slate-600", bg: "bg-slate-50" },
};

const restrictionTypeMap: Record<string, string> = {
  time_limit: "禁止预约 (7天)",
  resource_limit: "限制高配设备",
};

export default function ViolationManagePage() {
  const [searchUserId, setSearchUserId] = useState("");
  const [selectedClassId, setSelectedClassId] = useState<string>("all");
  const [selectedBlacklist, setSelectedBlacklist] = useState<any>(null);
  const [isRemoveDialogOpen, setIsRemoveDialogOpen] = useState(false);

  const { data: violations = [], refetch: refetchViolations } = trpc.violation.getAllRecords.useQuery();
  const { data: blacklistData = [], refetch: refetchBlacklist } = trpc.violation.getAllBlacklist.useQuery();
  const { data: classList = [] } = trpc.class.list.useQuery();

  const removeBlacklist = trpc.violation.removeBlacklist.useMutation({
    onSuccess: () => {
      toast.success("移除成功");
      refetchBlacklist();
      setIsRemoveDialogOpen(false);
      setSelectedBlacklist(null);
    },
    onError: (error) => toast.error(error.message),
  });

  const filteredViolations = useMemo(() => {
    let list = violations;
    if (selectedClassId !== "all") {
      list = list.filter((v: any) => `${v.classId ?? ""}` === selectedClassId);
    }
    if (searchUserId) {
      list = list.filter(
        (v: any) => v.userId?.toString().includes(searchUserId) || v.userName?.includes(searchUserId)
      );
    }
    return list;
  }, [violations, searchUserId, selectedClassId]);

  const totalPoints = useMemo(
    () => violations.reduce((sum: number, v: any) => sum + (v.points || 0), 0),
    [violations]
  );

  const filteredBlacklist = useMemo(() => {
    if (selectedClassId === "all") return blacklistData;
    return blacklistData.filter((item: any) => `${item.classId ?? ""}` === selectedClassId);
  }, [blacklistData, selectedClassId]);

  const handleRemoveBlacklist = () => {
    if (!selectedBlacklist) return;
    removeBlacklist.mutate({ userId: selectedBlacklist.userId });
  };

  return (
    <div className="min-h-screen bg-slate-50/50 p-6 space-y-8 font-sans text-slate-900">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
          <Gavel className="h-6 w-6 text-rose-600" /> 违约与黑名单管理
        </h1>
        <p className="text-slate-500 text-sm">维护实验室秩序，管理违规记录及用户处罚状态。</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-l-4 border-l-rose-500 shadow-sm hover:shadow-md transition-all">
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500 mb-1">总违约记录</p>
              <h2 className="text-3xl font-bold text-slate-900">{violations.length}</h2>
              <p className="text-xs text-rose-600 mt-1 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" /> 需关注趋势
              </p>
            </div>
            <div className="h-12 w-12 rounded-full bg-rose-50 flex items-center justify-center">
              <History className="h-6 w-6 text-rose-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-amber-500 shadow-sm hover:shadow-md transition-all">
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500 mb-1">黑名单用户</p>
              <h2 className="text-3xl font-bold text-slate-900">{filteredBlacklist.length}</h2>
              <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                <Ban className="h-3 w-3" /> 限制中
              </p>
            </div>
            <div className="h-12 w-12 rounded-full bg-amber-50 flex items-center justify-center">
              <UserX className="h-6 w-6 text-amber-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500 shadow-sm hover:shadow-md transition-all">
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500 mb-1">总违约积分</p>
              <h2 className="text-3xl font-bold text-slate-900">{totalPoints}</h2>
              <p className="text-xs text-blue-600 mt-1 flex items-center gap-1">
                <Info className="h-3 w-3" /> 累计扣分
              </p>
            </div>
            <div className="h-12 w-12 rounded-full bg-blue-50 flex items-center justify-center">
              <ShieldAlert className="h-6 w-6 text-blue-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {[
          { title: "无故缺席", code: "no_show", points: 5, desc: "预约获批但未到场签到", color: "bg-rose-50 border-rose-100 text-rose-700", icon: UserX },
          { title: "迟到取消", code: "late_cancel", points: 2, desc: "开始前24小时内取消", color: "bg-amber-50 border-amber-100 text-amber-700", icon: Clock },
          { title: "超时占用", code: "timeout", points: 3, desc: "未及时签出归还实验室", color: "bg-orange-50 border-orange-100 text-orange-700", icon: History },
          { title: "其他违规", code: "manual", points: "Custom", desc: "设备损坏或违反管理规定", color: "bg-slate-100 border-slate-200 text-slate-700", icon: AlertTriangle },
        ].map((rule) => (
          <div
            key={rule.code}
            className={cn(
              "p-4 rounded-xl border flex flex-col gap-2 transition-transform hover:scale-[1.02]",
              rule.color
            )}
          >
            <div className="flex justify-between items-start">
              <div className="p-2 bg-white/60 rounded-lg">
                <rule.icon className="h-5 w-5 opacity-80" />
              </div>
              <span className="text-xl font-bold opacity-40">
                {typeof rule.points === "number" ? `-${rule.points}` : "N"}
              </span>
            </div>
            <div>
              <h4 className="font-semibold">{rule.title}</h4>
              <p className="text-xs opacity-80 mt-1 leading-relaxed">{rule.desc}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 items-start">
        <div className="xl:col-span-1 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Ban className="h-5 w-5 text-amber-500" /> 黑名单管理
            </h3>
            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
              {filteredBlacklist.length} 人受限
            </Badge>
          </div>

          <Card className="overflow-hidden border-amber-200/60">
            <div className="divide-y divide-slate-100">
              {filteredBlacklist.length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-sm">暂无黑名单用户</div>
              ) : (
                filteredBlacklist.map((item: any) => (
                  <div key={item.id || item.userId} className="p-4 hover:bg-slate-50 transition-colors group">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold border border-slate-200">
                          {item.userName?.[0] || "?"}
                        </div>
                        <div>
                          <div className="font-semibold text-slate-900">{item.userName || "-"}</div>
                          <div className="text-xs text-slate-500 font-mono">ID: {item.userId}</div>
                        </div>
                      </div>
                      <Badge variant="destructive" className="bg-rose-50 text-rose-600 border-rose-100">
                        积分 {item.totalViolationPoints}
                      </Badge>
                    </div>

                    <div className="space-y-2 mt-3 text-xs">
                      <div className="flex justify-between">
                        <span className="text-slate-500">限制类型</span>
                        <span className="font-medium text-slate-900">
                          {restrictionTypeMap[item.restrictionType] || item.restrictionType || "-"}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">解禁时间</span>
                        <span className="font-medium text-slate-900">
                          {item.restrictedUntil
                            ? format(new Date(item.restrictedUntil), "yyyy-MM-dd", { locale: zhCN })
                            : "-"}
                        </span>
                      </div>
                      <div className="bg-slate-50 p-2 rounded text-slate-600 border border-slate-100">
                        原因: {item.reason || "-"}
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-50 flex justify-end">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-rose-600 hover:bg-rose-50 h-8"
                        onClick={() => {
                          setSelectedBlacklist(item);
                          setIsRemoveDialogOpen(true);
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-1" /> 解除限制
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>

        <div className="xl:col-span-2 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <History className="h-5 w-5 text-slate-500" /> 违约记录
            </h3>
            <div className="flex w-full sm:w-auto gap-3 flex-col sm:flex-row">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="搜索用户姓名或ID..."
                  className="pl-9 h-9"
                  value={searchUserId}
                  onChange={(e) => setSearchUserId(e.target.value)}
                />
              </div>
              <Select value={selectedClassId} onValueChange={setSelectedClassId}>
                <SelectTrigger className="h-9 w-full sm:w-48 bg-white">
                  <SelectValue placeholder="筛选班级" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部班级</SelectItem>
                  {classList.map((cls: any) => (
                    <SelectItem key={cls.id} value={`${cls.id}`}>
                      {cls.name || cls.classNo || `班级${cls.id}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-slate-500 uppercase bg-slate-50/50 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-3 font-medium">用户</th>
                    <th className="px-6 py-3 font-medium">违约类型</th>
                    <th className="px-6 py-3 font-medium">扣分</th>
                    <th className="px-6 py-3 font-medium">详情描述</th>
                    <th className="px-6 py-3 font-medium">记录时间</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {filteredViolations.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                        暂无违约记录
                      </td>
                    </tr>
                  ) : (
                    filteredViolations.map((v: any) => {
                      const type = violationTypeMap[v.violationType] || violationTypeMap.other;
                      const TypeIcon = type.icon;

                      return (
                        <tr key={v.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center text-xs text-slate-600 font-bold">
                                {v.userName?.[0] || "?"}
                              </div>
                              <div>
                                <div className="font-medium text-slate-900">{v.userName || "-"}</div>
                                <div className="text-xs text-slate-400 font-mono">{v.userId}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <Badge className={cn("pl-1.5 pr-2.5 py-1 gap-1.5 border-0", type.bg, type.color)}>
                              <TypeIcon className="h-3.5 w-3.5" />
                              {type.label}
                            </Badge>
                          </td>
                          <td className="px-6 py-4">
                            <span className="font-bold text-rose-600">-{v.points}</span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="max-w-[200px] truncate text-slate-600" title={v.description}>
                              {v.description}
                            </div>
                            {v.reservationId && (
                              <div className="text-xs text-slate-400 font-mono mt-0.5">#{v.reservationId}</div>
                            )}
                          </td>
                          <td className="px-6 py-4 text-slate-500 whitespace-nowrap">
                            {v.createdAt ? format(new Date(v.createdAt), "MM-dd HH:mm", { locale: zhCN }) : "-"}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </div>

      <Dialog open={isRemoveDialogOpen} onOpenChange={setIsRemoveDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">确认解除限制？</DialogTitle>
            <DialogDescription>
              确定要将用户 {selectedBlacklist?.userName} (#{selectedBlacklist?.userId}) 从黑名单中移除吗？移除后该用户将立即恢复正常预约权限。
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 pt-2">
            <Button variant="secondary" className="flex-1" onClick={() => setIsRemoveDialogOpen(false)}>
              取消
            </Button>
            <Button
              className="flex-1 bg-amber-600 hover:bg-amber-700 text-white"
              onClick={handleRemoveBlacklist}
              disabled={removeBlacklist.isPending}
            >
              {removeBlacklist.isPending ? "处理中..." : "确认解除"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
