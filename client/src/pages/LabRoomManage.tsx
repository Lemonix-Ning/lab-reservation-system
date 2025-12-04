import { useAuth } from "@/_core/hooks/useAuth";
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

export default function LabRoomManage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    roomNo: "",
    name: "",
    building: "",
    location: "",
    capacity: 0,
    type: "",
    openTimeStart: "08:00",
    openTimeEnd: "22:00",
    status: "enabled" as "enabled" | "disabled",
    remark: "",
  });

  const { data: labs, isLoading } = trpc.labRoom.list.useQuery();
  const utils = trpc.useUtils();

  const createMutation = trpc.labRoom.create.useMutation({
    onSuccess: () => {
      toast.success("实验室创建成功");
      utils.labRoom.list.invalidate();
      handleCloseDialog();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const updateMutation = trpc.labRoom.update.useMutation({
    onSuccess: () => {
      toast.success("实验室更新成功");
      utils.labRoom.list.invalidate();
      handleCloseDialog();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const deleteMutation = trpc.labRoom.delete.useMutation({
    onSuccess: () => {
      toast.success("实验室删除成功");
      utils.labRoom.list.invalidate();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  if (user?.role !== 'admin') {
    setLocation('/');
    return null;
  }

  const handleOpenDialog = (lab?: any) => {
    if (lab) {
      setEditingId(lab.id);
      setFormData({
        roomNo: lab.roomNo,
        name: lab.name,
        building: lab.building || "",
        location: lab.location || "",
        capacity: lab.capacity || 0,
        type: lab.type || "",
        openTimeStart: lab.openTimeStart || "08:00",
        openTimeEnd: lab.openTimeEnd || "22:00",
        status: lab.status,
        remark: lab.remark || "",
      });
    } else {
      setEditingId(null);
      setFormData({
        roomNo: "",
        name: "",
        building: "",
        location: "",
        capacity: 0,
        type: "",
        openTimeStart: "08:00",
        openTimeEnd: "22:00",
        status: "enabled",
        remark: "",
      });
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingId(null);
  };

  const handleSubmit = () => {
    if (editingId) {
      updateMutation.mutate({ id: editingId, ...formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  return (
    <div className="bg-gray-50">
      <main className="container py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-3xl font-bold text-gray-900 mb-2">实验室管理</h2>
            <p className="text-gray-600">管理所有实验室信息</p>
          </div>
          <Button onClick={() => handleOpenDialog()}>添加实验室</Button>
        </div>

        {isLoading ? (
          <div className="text-center py-12">加载中...</div>
        ) : (
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>编号</TableHead>
                    <TableHead>名称</TableHead>
                    <TableHead>楼宇</TableHead>
                    <TableHead>位置</TableHead>
                    <TableHead>容量</TableHead>
                    <TableHead>类型</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {labs?.map((lab) => (
                    <TableRow key={lab.id}>
                      <TableCell>{lab.roomNo}</TableCell>
                      <TableCell>{lab.name}</TableCell>
                      <TableCell>{lab.building}</TableCell>
                      <TableCell>{lab.location}</TableCell>
                      <TableCell>{lab.capacity}</TableCell>
                      <TableCell>{lab.type}</TableCell>
                      <TableCell>
                        <span className={lab.status === 'enabled' ? 'text-green-600' : 'text-gray-600'}>
                          {lab.status === 'enabled' ? '启用' : '停用'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => handleOpenDialog(lab)}>
                            编辑
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline" 
                            onClick={() => {
                              if (confirm('确定要删除这个实验室吗?')) {
                                deleteMutation.mutate({ id: lab.id });
                              }
                            }}
                          >
                            删除
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </main>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? '编辑实验室' : '添加实验室'}</DialogTitle>
            <DialogDescription>填写实验室基本信息</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>实验室编号</Label>
              <Input value={formData.roomNo} onChange={(e) => setFormData({ ...formData, roomNo: e.target.value })} />
            </div>
            <div>
              <Label>实验室名称</Label>
              <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
            </div>
            <div>
              <Label>所在楼宇</Label>
              <Input value={formData.building} onChange={(e) => setFormData({ ...formData, building: e.target.value })} />
            </div>
            <div>
              <Label>具体位置</Label>
              <Input value={formData.location} onChange={(e) => setFormData({ ...formData, location: e.target.value })} />
            </div>
            <div>
              <Label>容纳人数</Label>
              <Input type="number" value={formData.capacity} onChange={(e) => setFormData({ ...formData, capacity: parseInt(e.target.value) })} />
            </div>
            <div>
              <Label>实验室类型</Label>
              <Input value={formData.type} onChange={(e) => setFormData({ ...formData, type: e.target.value })} placeholder="例如：机房、物理实验室" />
            </div>
            <div>
              <Label>开放开始时间</Label>
              <Input type="time" value={formData.openTimeStart} onChange={(e) => setFormData({ ...formData, openTimeStart: e.target.value })} />
            </div>
            <div>
              <Label>开放结束时间</Label>
              <Input type="time" value={formData.openTimeEnd} onChange={(e) => setFormData({ ...formData, openTimeEnd: e.target.value })} />
            </div>
            <div>
              <Label>状态</Label>
              <Select value={formData.status} onValueChange={(value: "enabled" | "disabled") => setFormData({ ...formData, status: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="enabled">启用</SelectItem>
                  <SelectItem value="disabled">停用</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label>备注</Label>
              <Textarea value={formData.remark} onChange={(e) => setFormData({ ...formData, remark: e.target.value })} />
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
