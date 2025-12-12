import { useAuth } from "@/_core/hooks/useAuth";
import { useRole } from "@/contexts/RoleContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { Calendar, AlertCircle, Plus, Edit2, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { format } from "date-fns";

export default function BlockedPeriodManage() {
  const { user } = useAuth();
  const { isLabAdmin, isSysAdmin } = useRole();
  const [, setLocation] = useLocation();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    labId: null as number | null,
    deviceId: null as number | null,
    reason: "",
    startDate: "",
    startTime: "",
    endDate: "",
    endTime: "",
    handleExisting: "warn" as "allow" | "warn" | "cancel",
  });

  const { data: labs } = trpc.labRoom.list.useQuery();
  const { data: devices } = trpc.device.list.useQuery();
  const { data: blockedPeriods, isLoading } = trpc.blockedPeriod.list.useQuery({});
  const utils = trpc.useUtils();

  const createMutation = trpc.blockedPeriod.create.useMutation({
    onSuccess: () => {
      toast.success("禁用时段创建成功");
      utils.blockedPeriod.list.invalidate();
      utils.calendar.getLabCalendar.invalidate();
      handleCloseDialog();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const updateMutation = trpc.blockedPeriod.update.useMutation({
    onSuccess: () => {
      toast.success("禁用时段更新成功");
      utils.blockedPeriod.list.invalidate();
      utils.calendar.getLabCalendar.invalidate();
      handleCloseDialog();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  if (!isLabAdmin && !isSysAdmin) {
    setLocation('/');
    return null;
  }

  const handleOpenDialog = (period?: any) => {
    if (period) {
      setEditingId(period.id);
      const startDate = new Date(period.startDate);
      const endDate = new Date(period.endDate);
      setFormData({
        labId: period.labId,
        deviceId: period.deviceId,
        reason: period.reason,
        startDate: format(startDate, 'yyyy-MM-dd'),
        startTime: format(startDate, 'HH:mm'),
        endDate: format(endDate, 'yyyy-MM-dd'),
        endTime: format(endDate, 'HH:mm'),
        handleExisting: period.handleExisting,
      });
    } else {
      setEditingId(null);
      setFormData({
        labId: null,
        deviceId: null,
        reason: "",
        startDate: "",
        startTime: "",
        endDate: "",
        endTime: "",
        handleExisting: "warn",
      });
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingId(null);
  };

  const handleSubmit = () => {
    if (!formData.reason || !formData.startDate || !formData.endDate) {
      toast.error("请填写完整信息");
      return;
    }

    const startDateTime = new Date(`${formData.startDate}T${formData.startTime || '00:00'}`);
    const endDateTime = new Date(`${formData.endDate}T${formData.endTime || '23:59'}`);

    if (endDateTime <= startDateTime) {
      toast.error("结束时间必须晚于开始时间");
      return;
    }

    if (editingId) {
      updateMutation.mutate({
        id: editingId,
        labId: formData.labId,
        deviceId: formData.deviceId,
        reason: formData.reason,
        startDate: startDateTime,
        endDate: endDateTime,
        handleExisting: formData.handleExisting,
      });
    } else {
      createMutation.mutate({
        labId: formData.labId,
        deviceId: formData.deviceId,
        reason: formData.reason,
        startDate: startDateTime,
        endDate: endDateTime,
        handleExisting: formData.handleExisting,
      });
    }
  };

  const handleToggleStatus = (period: any) => {
    updateMutation.mutate({
      id: period.id,
      status: period.status === 'active' ? 'inactive' : 'active',
    });
  };

  const getReasonLabel = (reason: string) => {
    const labels: Record<string, string> = {
      maintenance: '维护',
      vacation: '假期',
      inspection: '检查',
      other: '其他',
    };
    return labels[reason] || reason;
  };

  const getHandleExistingLabel = (handle: string) => {
    const labels: Record<string, string> = {
      allow: '允许',
      warn: '警告',
      cancel: '取消',
    };
    return labels[handle] || handle;
  };

  return (
    <div className="min-h-screen bg-gray-50/50 p-6">
      <div className="max-w-7xl mx-auto">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                <Calendar className="h-6 w-6" />
              </div>
              <div>
                <CardTitle className="text-xl font-bold text-gray-900">禁用时段管理</CardTitle>
                <p className="text-xs text-gray-500 mt-0.5">管理维护期、假期等禁用时段</p>
              </div>
            </div>
            <Button onClick={() => handleOpenDialog()} className="gap-2">
              <Plus className="h-4 w-4" />
              添加禁用时段
            </Button>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-gray-500">加载中...</div>
            ) : blockedPeriods && blockedPeriods.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>实验室/设备</TableHead>
                    <TableHead>原因</TableHead>
                    <TableHead>开始时间</TableHead>
                    <TableHead>结束时间</TableHead>
                    <TableHead>处理方式</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {blockedPeriods.map((period: any) => {
                    const startDate = new Date(period.startDate);
                    const endDate = new Date(period.endDate);
                    const lab = labs?.find((l: any) => l.id === period.labId);
                    const device = devices?.find((d: any) => d.id === period.deviceId);

                    return (
                      <TableRow key={period.id}>
                        <TableCell>
                          <div className="space-y-1">
                            {period.labId ? (
                              <div className="text-sm font-medium">{lab?.name || `实验室 #${period.labId}`}</div>
                            ) : (
                              <Badge variant="outline" className="text-xs">全局</Badge>
                            )}
                            {period.deviceId && (
                              <div className="text-xs text-gray-500">{device?.name || `设备 #${period.deviceId}`}</div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{getReasonLabel(period.reason)}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">{format(startDate, 'yyyy-MM-dd HH:mm')}</div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">{format(endDate, 'yyyy-MM-dd HH:mm')}</div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{getHandleExistingLabel(period.handleExisting)}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={period.status === 'active' ? 'default' : 'secondary'}>
                            {period.status === 'active' ? '启用' : '停用'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenDialog(period)}
                              className="h-8 w-8 p-0"
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleToggleStatus(period)}
                              className="h-8 w-8 p-0"
                            >
                              {period.status === 'active' ? '停用' : '启用'}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-12">
                <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">暂无禁用时段</p>
                <Button onClick={() => handleOpenDialog()} className="mt-4" variant="outline">
                  添加第一个禁用时段
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 创建/编辑对话框 */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingId ? '编辑禁用时段' : '添加禁用时段'}</DialogTitle>
              <DialogDescription>
                {editingId ? '修改禁用时段的设置' : '设置维护期、假期等禁用时段'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>实验室（可选，留空为全局禁用）</Label>
                  <Select
                    value={formData.labId ? String(formData.labId) : "none"}
                    onValueChange={(value) => {
                      const newLabId = value === "none" ? null : Number(value);
                      // 如果清空了实验室，也清空设备
                      setFormData({ 
                        ...formData, 
                        labId: newLabId,
                        deviceId: newLabId ? formData.deviceId : null
                      });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="选择实验室（可选）" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">全局禁用</SelectItem>
                      {labs?.map((lab: any) => (
                        <SelectItem key={lab.id} value={String(lab.id)}>
                          {lab.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>设备（可选）</Label>
                  <Select
                    value={formData.deviceId ? String(formData.deviceId) : "none"}
                    onValueChange={(value) => setFormData({ ...formData, deviceId: value === "none" ? null : Number(value) })}
                    disabled={!formData.labId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="选择设备（可选）" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">不指定设备</SelectItem>
                      {devices?.filter((d: any) => !formData.labId || d.labId === formData.labId).map((device: any) => (
                        <SelectItem key={device.id} value={String(device.id)}>
                          {device.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label>禁用原因 *</Label>
                <Select
                  value={formData.reason}
                  onValueChange={(value) => setFormData({ ...formData, reason: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="选择原因" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="maintenance">维护</SelectItem>
                    <SelectItem value="vacation">假期</SelectItem>
                    <SelectItem value="inspection">检查</SelectItem>
                    <SelectItem value="other">其他</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>开始日期 *</Label>
                  <Input
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  />
                </div>
                <div>
                  <Label>开始时间</Label>
                  <Input
                    type="time"
                    value={formData.startTime}
                    onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>结束日期 *</Label>
                  <Input
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                  />
                </div>
                <div>
                  <Label>结束时间</Label>
                  <Input
                    type="time"
                    value={formData.endTime}
                    onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <Label>处理已有预约的方式</Label>
                <Select
                  value={formData.handleExisting}
                  onValueChange={(value: "allow" | "warn" | "cancel") => setFormData({ ...formData, handleExisting: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="allow">允许（保留已有预约）</SelectItem>
                    <SelectItem value="warn">警告（提示用户）</SelectItem>
                    <SelectItem value="cancel">取消（自动取消已有预约）</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500 mt-1">
                  选择在禁用时段内已有预约的处理方式
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={handleCloseDialog}>取消</Button>
              <Button onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending}>
                {editingId ? '更新' : '创建'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

