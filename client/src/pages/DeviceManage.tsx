import { useAuth } from "@/_core/hooks/useAuth";
import { useRole } from "@/contexts/RoleContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { FlaskConical } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Link, useLocation } from "wouter";

export default function DeviceManage() {
  const { user } = useAuth();
  const { isLabAdmin, isSysAdmin } = useRole();
  const [, setLocation] = useLocation();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    labId: 0,
    deviceNo: "",
    name: "",
    type: "",
    purchaseDate: new Date().toISOString().split('T')[0],
    status: "available" as "available" | "maintenance" | "retired",
    description: "",
  });

  const { data: devices, isLoading } = trpc.device.list.useQuery();
  const { data: labs } = trpc.labRoom.list.useQuery();
  const utils = trpc.useUtils();

  const createMutation = trpc.device.create.useMutation({
    onSuccess: () => {
      toast.success("设备创建成功");
      utils.device.list.invalidate();
      handleCloseDialog();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const updateMutation = trpc.device.update.useMutation({
    onSuccess: () => {
      toast.success("设备更新成功");
      utils.device.list.invalidate();
      handleCloseDialog();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const deleteMutation = trpc.device.delete.useMutation({
    onSuccess: () => {
      toast.success("设备删除成功");
      utils.device.list.invalidate();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  if (!isLabAdmin && !isSysAdmin) {
    setLocation('/');
    return null;
  }

  const handleOpenDialog = (device?: any) => {
    if (device) {
      setEditingId(device.id);
      setFormData({
        labId: device.labId,
        deviceNo: device.deviceNo,
        name: device.name,
        type: device.type || "",
        purchaseDate: device.purchaseDate ? new Date(device.purchaseDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        status: device.status,
        description: device.description || "",
      });
    } else {
      setEditingId(null);
      setFormData({
        labId: 0,
        deviceNo: "",
        name: "",
        type: "",
        purchaseDate: new Date().toISOString().split('T')[0],
        status: "available",
        description: "",
      });
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingId(null);
  };

  const handleSubmit = () => {
    if (!formData.labId || !formData.deviceNo || !formData.name) {
      toast.error("请填写必填项");
      return;
    }
    
    // 处理日期：只在有有效日期字符串时才转换
    let purchaseDateValue: Date | undefined = undefined;
    if (formData.purchaseDate && formData.purchaseDate.trim() !== '') {
      const dateObj = new Date(formData.purchaseDate);
      if (!isNaN(dateObj.getTime())) {
        purchaseDateValue = dateObj;
      }
    }
    
    const submitData = {
      labId: formData.labId,
      deviceNo: formData.deviceNo,
      name: formData.name,
      type: formData.type || undefined,
      purchaseDate: purchaseDateValue,
      status: formData.status,
      description: formData.description || undefined,
    };

    if (editingId) {
      updateMutation.mutate({ id: editingId, ...submitData });
    } else {
      createMutation.mutate(submitData);
    }
  };

  const getLabName = (labId: number) => {
    return labs?.find(l => l.id === labId)?.name || '未知实验室';
  };

  const getStatusDisplay = (status: string) => {
    const statusMap: Record<string, { text: string; color: string }> = {
      available: { text: '可用', color: 'text-green-600' },
      maintenance: { text: '维修中', color: 'text-yellow-600' },
      retired: { text: '报废', color: 'text-red-600' },
    };
    const displayStatus = statusMap[status] || { text: status, color: 'text-gray-600' };
    return <span className={displayStatus.color}>{displayStatus.text}</span>;
  };

  return (
    <div className="bg-gray-50">
      <main className="container py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-3xl font-bold text-gray-900 mb-2">设备管理</h2>
            <p className="text-gray-600">管理所有实验室设备信息</p>
          </div>
          <Button onClick={() => handleOpenDialog()}>添加设备</Button>
        </div>

        {isLoading ? (
          <div className="text-center py-12">加载中...</div>
        ) : (
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>设备编号</TableHead>
                    <TableHead>设备名称</TableHead>
                    <TableHead>设备类型</TableHead>
                    <TableHead>所属实验室</TableHead>
                    <TableHead>购置日期</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {devices && devices.length > 0 ? (
                    devices.map((device) => (
                      <TableRow key={device.id}>
                        <TableCell className="font-medium">{device.deviceNo}</TableCell>
                        <TableCell>{device.name}</TableCell>
                        <TableCell>{device.type || '-'}</TableCell>
                        <TableCell>{getLabName(device.labId)}</TableCell>
                        <TableCell>
                          {device.purchaseDate ? new Date(device.purchaseDate).toLocaleDateString('zh-CN') : '-'}
                        </TableCell>
                        <TableCell>{getStatusDisplay(device.status)}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button 
                              size="sm" 
                              variant="outline" 
                              onClick={() => handleOpenDialog(device)}
                            >
                              编辑
                            </Button>
                            <Button 
                              size="sm" 
                              variant="outline" 
                              onClick={() => {
                                if (confirm('确定要删除这个设备吗?')) {
                                  deleteMutation.mutate({ id: device.id });
                                }
                              }}
                            >
                              删除
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-gray-500 py-8">
                        暂无设备数据
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </main>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? '编辑设备' : '添加设备'}</DialogTitle>
            <DialogDescription>填写设备基本信息</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>所属实验室 *</Label>
              <Select value={String(formData.labId)} onValueChange={(value) => setFormData({ ...formData, labId: parseInt(value) })}>
                <SelectTrigger>
                  <SelectValue placeholder="选择实验室" />
                </SelectTrigger>
                <SelectContent>
                  {labs?.map((lab) => (
                    <SelectItem key={lab.id} value={String(lab.id)}>
                      {lab.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>设备编号 *</Label>
              <Input 
                value={formData.deviceNo} 
                onChange={(e) => setFormData({ ...formData, deviceNo: e.target.value })}
                placeholder="例如：DEV-001"
              />
            </div>
            <div className="col-span-2">
              <Label>设备名称 *</Label>
              <Input 
                value={formData.name} 
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="例如：分光光度计"
              />
            </div>
            <div>
              <Label>设备类型</Label>
              <Input 
                value={formData.type} 
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                placeholder="例如：测量仪器"
              />
            </div>
            <div>
              <Label>购置日期</Label>
              <Input 
                type="date" 
                value={formData.purchaseDate} 
                onChange={(e) => setFormData({ ...formData, purchaseDate: e.target.value })} 
              />
            </div>
            <div>
              <Label>设备状态 *</Label>
              <Select value={formData.status} onValueChange={(value: "available" | "maintenance" | "retired") => setFormData({ ...formData, status: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="available">可用</SelectItem>
                  <SelectItem value="maintenance">维修中</SelectItem>
                  <SelectItem value="retired">报废</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label>设备说明</Label>
              <Textarea 
                value={formData.description} 
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="设备的简要说明和备注信息"
                className="min-h-[100px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog}>取消</Button>
            <Button onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending}>
              {(createMutation.isPending || updateMutation.isPending) ? '保存中...' : '保存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
