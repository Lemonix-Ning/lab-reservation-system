import { useState } from "react";
import { BaseCard } from "@/components/ui/base-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { trpc } from "@/lib/trpc";
import { Settings, Save, RefreshCw } from "lucide-react";
import { toast } from "sonner";

export default function ApprovalConfigPage() {
  const [selectedLabId, setSelectedLabId] = useState<number | null>(null);
  const [isGlobal, setIsGlobal] = useState(true);

  // 查询实验室列表
  const { data: labs = [] } = trpc.labRoom.list.useQuery();

  // 查询审批配置
  const { data: config, isLoading, refetch } = trpc.approval.getConfigForLab.useQuery(
    { labId: selectedLabId ?? 1 },
    { enabled: !isGlobal || selectedLabId !== null }
  );

  // 更新配置
  const updateConfig = trpc.approval.updateConfig.useMutation({
    onSuccess: () => {
      toast.success("保存成功 - 审批配置已更新");
      refetch();
    },
    onError: (error) => {
      toast.error(`保存失败 - ${error.message}`);
    },
  });

  const [formData, setFormData] = useState({
    name: "",
    enableMultiLevel: 1,
    approvalStages: "[]",
    rescheduleWindowHours: 24,
    maxRescheduleCount: 2,
  });

  const handleSave = () => {
    updateConfig.mutate({
      labId: isGlobal ? null : (selectedLabId ?? null),
      ...formData,
    });
  };

  return (
    <div className="p-6 space-y-6 bg-gray-50 min-h-screen">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">审批配置管理</h1>
          <p className="text-sm text-gray-500 mt-1">
            配置预约审批流程、重新调度规则等参数
          </p>
        </div>
        <Button
          onClick={() => refetch()}
          variant="outline"
          className="gap-2"
        >
          <RefreshCw className="h-4 w-4" />
          刷新
        </Button>
      </div>

      {/* 配置范围选择 */}
      <BaseCard title="配置范围" subtitle="选择全局配置或特定实验室">
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Switch
                checked={isGlobal}
                onCheckedChange={(checked) => {
                  setIsGlobal(checked);
                  if (checked) setSelectedLabId(null);
                }}
              />
              <Label>全局配置（默认）</Label>
            </div>
            {isGlobal && (
              <StatusBadge variant="info">
                适用于所有实验室（除非有特定配置）
              </StatusBadge>
            )}
          </div>

          {!isGlobal && (
            <div className="flex gap-4 items-end">
              <div className="flex-1">
                <Label>选择实验室</Label>
                <Select
                  value={selectedLabId?.toString()}
                  onValueChange={(val) => setSelectedLabId(Number(val))}
                >
                  <SelectTrigger className="rounded-lg">
                    <SelectValue placeholder="请选择实验室" />
                  </SelectTrigger>
                  <SelectContent>
                    {labs.map((lab) => (
                      <SelectItem key={lab.id} value={lab.id.toString()}>
                        {lab.roomNo} - {lab.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </div>
      </BaseCard>

      {/* 审批流程配置 */}
      {(isGlobal || selectedLabId) && (
        <>
          <BaseCard
            title="审批流程"
            subtitle="配置预约需要经过的审批阶段数"
            headerAction={
              <StatusBadge variant={config ? "active" : "info"}>
                {config ? "已配置" : "使用默认"}
              </StatusBadge>
            }
          >
            <div className="space-y-4">
              <div>
                <Label>审批阶段数</Label>
                <Input
                  type="number"
                  min={0}
                  max={3}
                  value={formData.enableMultiLevel}
                  onChange={(e) =>
                    setFormData({ ...formData, enableMultiLevel: Number(e.target.value) })
                  }
                  className="rounded-lg max-w-xs"
                />
                <p className="text-xs text-gray-500 mt-1">
                  0 = 自动通过，1 = 一级审批，2 = 两级审批，3 = 三级审批
                </p>
              </div>
            </div>
          </BaseCard>

          {/* 重新调度规则 */}
          <BaseCard title="重新调度规则" subtitle="配置预约可重新调度的次数和截止时间">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>最大重新调度次数</Label>
                <Input
                  type="number"
                  min={0}
                  max={5}
                  value={formData.maxRescheduleCount}
                  onChange={(e) =>
                    setFormData({ ...formData, maxRescheduleCount: Number(e.target.value) })
                  }
                  className="rounded-lg"
                />
                <p className="text-xs text-gray-500 mt-1">每个预约最多可重新调度的次数</p>
              </div>

              <div>
                <Label>重新调度截止时间（小时）</Label>
                <Input
                  type="number"
                  min={1}
                  max={168}
                  value={formData.rescheduleWindowHours}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      rescheduleWindowHours: Number(e.target.value),
                    })
                  }
                  className="rounded-lg"
                />
                <p className="text-xs text-gray-500 mt-1">
                  距离预约开始时间还有多少小时内不允许重新调度
                </p>
              </div>
            </div>
          </BaseCard>

          {/* 自动取消规则 */}
          <BaseCard title="自动取消规则" subtitle="配置未按时使用的预约自动取消时间">
            <div>
              <Label>未签到自动取消时间（小时）</Label>
              <Input
                type="number"
                min={0}
                max={24}
                value={0}
                onChange={() => {}}
                className="rounded-lg max-w-xs"
                disabled
              />
              <p className="text-xs text-gray-500 mt-1">
                预约开始后多少小时内未签到，系统自动取消并记录违约
              </p>
            </div>
          </BaseCard>

          {/* 保存按钮 */}
          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => {
                setFormData({
                  name: "",
                  enableMultiLevel: 1,
                  approvalStages: "[]",
                  rescheduleWindowHours: 24,
                  maxRescheduleCount: 2,
                });
              }}
              className="rounded-lg"
            >
              重置
            </Button>
            <Button
              onClick={() => {
                updateConfig.mutate({
                  labId: isGlobal ? null : (selectedLabId ?? null),
                  ...formData,
                });
              }}
              disabled={updateConfig.isPending}
              className="bg-blue-600 hover:bg-blue-700 rounded-lg gap-2"
            >
              <Save className="h-4 w-4" />
              保存配置
            </Button>
          </div>
        </>
      )}

      {/* 加载状态 */}
      {isLoading && (
        <BaseCard>
          <div className="text-center py-12 text-gray-500">
            <Settings className="h-12 w-12 mx-auto mb-3 animate-spin text-blue-600" />
            <p>加载配置中...</p>
          </div>
        </BaseCard>
      )}
    </div>
  );
}
