'use client';

import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { trpc } from "@/lib/trpc";
import { Clock, Plus, Edit2, Settings, AlertCircle } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

const DAYS_OF_WEEK = [
  { value: 0, label: '周日', isWorkday: false },
  { value: 1, label: '周一', isWorkday: true },
  { value: 2, label: '周二', isWorkday: true },
  { value: 3, label: '周三', isWorkday: true },
  { value: 4, label: '周四', isWorkday: true },
  { value: 5, label: '周五', isWorkday: true },
  { value: 6, label: '周六', isWorkday: false },
];

export default function OpeningRuleManage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [selectedLabId, setSelectedLabId] = useState<number | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<any>(null);
  const [formData, setFormData] = useState({
    dayOfWeek: 1,
    openTime: '08:00',
    closeTime: '22:00',
    isWorkday: 1,
  });

  const { data: labs } = trpc.labRoom.list.useQuery();
  const { data: rules, isLoading, refetch } = trpc.openingRule.getForLab.useQuery({ 
    labId: selectedLabId || undefined 
  });
  const utils = trpc.useUtils();

  const upsertMutation = trpc.openingRule.upsert.useMutation({
    onSuccess: () => {
      toast.success("开放规则保存成功");
      refetch();
      handleCloseDialog();
    },
    onError: (error) => {
      toast.error(error.message || "保存失败");
    },
  });

  // 权限检查由后端API和菜单过滤处理

  const handleOpenDialog = (rule?: any, dayOfWeek?: number) => {
    if (rule) {
      setEditingRule(rule);
      setFormData({
        dayOfWeek: rule.dayOfWeek,
        openTime: rule.openTime,
        closeTime: rule.closeTime,
        isWorkday: rule.isWorkday,
      });
    } else {
      setEditingRule(null);
      setFormData({
        dayOfWeek: dayOfWeek ?? 1,
        openTime: '08:00',
        closeTime: '22:00',
        isWorkday: DAYS_OF_WEEK.find(d => d.value === (dayOfWeek ?? 1))?.isWorkday ? 1 : 0,
      });
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingRule(null);
    setFormData({
      dayOfWeek: 1,
      openTime: '08:00',
      closeTime: '22:00',
      isWorkday: 1,
    });
  };

  const handleSubmit = () => {
    if (!formData.openTime || !formData.closeTime) {
      toast.error("请填写完整的开放时间");
      return;
    }

    if (formData.openTime >= formData.closeTime) {
      toast.error("开放时间必须早于关闭时间");
      return;
    }

    upsertMutation.mutate({
      id: editingRule?.id,
      labId: selectedLabId,
      dayOfWeek: formData.dayOfWeek,
      openTime: formData.openTime,
      closeTime: formData.closeTime,
      isWorkday: formData.isWorkday,
    });
  };

  const handleToggleStatus = async (rule: any) => {
    upsertMutation.mutate({
      id: rule.id,
      labId: rule.labId,
      dayOfWeek: rule.dayOfWeek,
      openTime: rule.openTime,
      closeTime: rule.closeTime,
      isWorkday: rule.isWorkday,
      status: rule.status === 'enabled' ? 'disabled' : 'enabled',
    });
  };

  // 创建规则映射表，方便查找
  const rulesMap = new Map<number, any>();
  rules?.forEach((rule: any) => {
    rulesMap.set(rule.dayOfWeek, rule);
  });

  return (
    <div className="min-h-screen bg-gray-50/50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* 页面标题 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">开放规则管理</h1>
            <p className="text-sm text-gray-500 mt-1">配置实验室的开放时间规则（工作日/周末）</p>
          </div>
          <div className="flex items-center gap-3">
            <Select 
              value={selectedLabId ? String(selectedLabId) : 'global'} 
              onValueChange={(val) => setSelectedLabId(val === 'global' ? null : Number(val))}
            >
              <SelectTrigger className="w-48">
                <SelectValue placeholder="选择实验室" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="global">全局规则</SelectItem>
                {labs?.map((lab: any) => (
                  <SelectItem key={lab.id} value={String(lab.id)}>{lab.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* 说明卡片 */}
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
              <div className="text-sm text-blue-800">
                <p className="font-medium mb-1">规则说明：</p>
                <ul className="list-disc list-inside space-y-1 text-blue-700">
                  <li>全局规则：适用于所有未配置特定规则的实验室</li>
                  <li>实验室特定规则：优先于全局规则，仅适用于该实验室</li>
                  <li>工作日规则：周一至周五的开放时间配置</li>
                  <li>周末规则：周六和周日的开放时间配置</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 规则列表 */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-indigo-600" />
                开放时间规则
                {selectedLabId && (
                  <Badge variant="outline" className="ml-2">
                    {labs?.find((l: any) => l.id === selectedLabId)?.name}
                  </Badge>
                )}
                {!selectedLabId && (
                  <Badge variant="outline" className="ml-2">全局规则</Badge>
                )}
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-gray-500">加载中...</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>星期</TableHead>
                    <TableHead>类型</TableHead>
                    <TableHead>开放时间</TableHead>
                    <TableHead>关闭时间</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {DAYS_OF_WEEK.map((day) => {
                    const rule = rulesMap.get(day.value);
                    return (
                      <TableRow key={day.value}>
                        <TableCell className="font-medium">{day.label}</TableCell>
                        <TableCell>
                          <Badge variant={day.isWorkday ? "default" : "secondary"}>
                            {day.isWorkday ? '工作日' : '周末'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {rule ? rule.openTime : <span className="text-gray-400">未配置</span>}
                        </TableCell>
                        <TableCell>
                          {rule ? rule.closeTime : <span className="text-gray-400">未配置</span>}
                        </TableCell>
                        <TableCell>
                          {rule ? (
                            <div className="flex items-center gap-2">
                              <Switch
                                checked={rule.status === 'enabled'}
                                onCheckedChange={() => handleToggleStatus(rule)}
                              />
                              <Badge variant={rule.status === 'enabled' ? 'default' : 'secondary'}>
                                {rule.status === 'enabled' ? '启用' : '禁用'}
                              </Badge>
                            </div>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            {rule ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleOpenDialog(rule)}
                              >
                                <Edit2 className="w-4 h-4 mr-1" />
                                编辑
                              </Button>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleOpenDialog(undefined, day.value)}
                              >
                                <Plus className="w-4 h-4 mr-1" />
                                添加
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}

            {rules && rules.length === 0 && !isLoading && (
              <div className="text-center py-8 text-gray-500">
                <p>当前没有配置开放规则</p>
                <p className="text-sm mt-1">点击"添加"按钮为每一天配置开放时间</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 编辑对话框 */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {editingRule ? '编辑开放规则' : '添加开放规则'}
            </DialogTitle>
            <DialogDescription>
              {selectedLabId 
                ? `为 ${labs?.find((l: any) => l.id === selectedLabId)?.name} 配置开放时间`
                : '配置全局开放时间规则'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>星期</Label>
              <Select
                value={String(formData.dayOfWeek)}
                onValueChange={(val) => {
                  const dayValue = Number(val);
                  const day = DAYS_OF_WEEK.find(d => d.value === dayValue);
                  setFormData({
                    ...formData,
                    dayOfWeek: dayValue,
                    isWorkday: day?.isWorkday ? 1 : 0,
                  });
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DAYS_OF_WEEK.map((day) => (
                    <SelectItem key={day.value} value={String(day.value)}>
                      {day.label} ({day.isWorkday ? '工作日' : '周末'})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>开放时间</Label>
                <Input
                  type="time"
                  value={formData.openTime}
                  onChange={(e) => setFormData({ ...formData, openTime: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>关闭时间</Label>
                <Input
                  type="time"
                  value={formData.closeTime}
                  onChange={(e) => setFormData({ ...formData, closeTime: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>类型</Label>
              <Select
                value={String(formData.isWorkday)}
                onValueChange={(val) => setFormData({ ...formData, isWorkday: Number(val) })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">工作日</SelectItem>
                  <SelectItem value="0">周末</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog}>
              取消
            </Button>
            <Button onClick={handleSubmit} disabled={upsertMutation.isPending}>
              {upsertMutation.isPending ? '保存中...' : '保存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

