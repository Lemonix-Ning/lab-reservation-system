import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useState } from "react";

export default function GeofenceManage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'labAdmin' || user?.role === 'sysAdmin';
  const { data: geofences, isLoading } = trpc.geofence.list.useQuery({});
  const { data: labs } = trpc.labRoom.list.useQuery();
  const utils = trpc.useUtils();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({
    labId: 0,
    latitude: "",
    longitude: "",
    radius: 100,
    name: "",
    status: "enabled" as "enabled" | "disabled",
  });

  const createMutation = trpc.geofence.create.useMutation({
    onSuccess: () => {
      toast.success("围栏创建成功");
      utils.geofence.list.invalidate();
      setIsDialogOpen(false);
    },
    onError: (e) => toast.error(e.message),
  });
  const updateMutation = trpc.geofence.update.useMutation({
    onSuccess: () => {
      toast.success("围栏更新成功");
      utils.geofence.list.invalidate();
      setIsDialogOpen(false);
    },
    onError: (e) => toast.error(e.message),
  });
  const deleteMutation = trpc.geofence.delete.useMutation({
    onSuccess: () => {
      toast.success("围栏已删除");
      utils.geofence.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  if (!isAdmin) {
    return <div className="p-6 text-gray-500">需要管理员权限</div>;
  }

  const openDialog = (row?: any) => {
    setEditingId(row ? row.id : null);
    if (row) {
      setForm({
        labId: row.labId,
        latitude: String(row.latitude ?? ""),
        longitude: String(row.longitude ?? ""),
        radius: row.radius ?? 100,
        name: row.name ?? "",
        status: row.status ?? "enabled",
      });
    } else {
      setForm({
        labId: labs?.[0]?.id || 0,
        latitude: "",
        longitude: "",
        radius: 100,
        name: "",
        status: "enabled",
      });
    }
    setIsDialogOpen(true);
  };

  const save = () => {
    const payload = {
      labId: form.labId,
      latitude: Number(form.latitude),
      longitude: Number(form.longitude),
      radius: form.radius,
      name: form.name || undefined,
      status: form.status,
    };
    if (editingId) {
      updateMutation.mutate({ id: editingId, ...payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50/50 p-6">
      <div className="max-w-7xl mx-auto">
        <Card>
          <CardHeader className="flex items-center justify-between">
            <CardTitle>实验室地理围栏</CardTitle>
            <Button onClick={() => openDialog()}>添加围栏</Button>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-gray-500">加载中...</div>
            ) : geofences && geofences.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>实验室</TableHead>
                    <TableHead>中心点</TableHead>
                    <TableHead>半径(米)</TableHead>
                    <TableHead>名称</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {geofences.map((g: any) => {
                    const lab = labs?.find((l: any) => l.id === g.labId);
                    return (
                      <TableRow key={g.id}>
                        <TableCell>{lab?.name || `实验室 #${g.labId}`}</TableCell>
                        <TableCell>{g.latitude},{g.longitude}</TableCell>
                        <TableCell>{g.radius}</TableCell>
                        <TableCell>{g.name || '-'}</TableCell>
                        <TableCell>{g.status}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" onClick={() => openDialog(g)}>编辑</Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                if (confirm('确定删除该围栏吗？')) deleteMutation.mutate({ id: g.id });
                              }}
                            >
                              删除
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-8 text-gray-500">暂无围栏</div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? '编辑围栏' : '新增围栏'}</DialogTitle>
            <DialogDescription>配置实验室地理围栏，用于签到校验</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>实验室</Label>
              <select
                className="border rounded h-9 w-full px-2"
                value={form.labId}
                onChange={(e) => setForm({ ...form, labId: Number(e.target.value) })}
              >
                {labs?.map((l: any) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            </div>
            <div>
              <Label>名称</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <Label>纬度</Label>
              <Input value={form.latitude} onChange={(e) => setForm({ ...form, latitude: e.target.value })} />
            </div>
            <div>
              <Label>经度</Label>
              <Input value={form.longitude} onChange={(e) => setForm({ ...form, longitude: e.target.value })} />
            </div>
            <div>
              <Label>半径(米)</Label>
              <Input type="number" value={form.radius} onChange={(e) => setForm({ ...form, radius: Number(e.target.value) })} />
            </div>
            <div>
              <Label>状态</Label>
              <select
                className="border rounded h-9 w-full px-2"
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as any })}
              >
                <option value="enabled">enabled</option>
                <option value="disabled">disabled</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={save} disabled={createMutation.isPending || updateMutation.isPending}>
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
