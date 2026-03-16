import { useState } from "react";
import { useRole } from "@/contexts/RoleContext";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import {
  Calendar,
  Clock,
  Plus,
  Trash2,
  Check,
  AlertCircle,
  Settings,
  Save,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

export default function SystemSettings() {
  const { isSysAdmin } = useRole();
  const [isAddSemesterOpen, setIsAddSemesterOpen] = useState(false);
  const [isAddPeriodOpen, setIsAddPeriodOpen] = useState(false);
  const [editingPeriod, setEditingPeriod] = useState<any>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: number; name: string } | null>(null);
  const [deletePeriodConfirm, setDeletePeriodConfirm] = useState<{ id: number; label: string } | null>(null);
  const [semesterForm, setSemesterForm] = useState({
    name: "",
    startDate: "",
    endDate: "",
    weekCount: "18",
  });
  const [periodForm, setPeriodForm] = useState({
    periodNo: "",
    periodName: "",
    startTime: "",
    endTime: "",
  });

  // 权限检查
  if (!isSysAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center space-y-4">
        <div className="bg-red-50 p-6 rounded-full">
          <AlertCircle className="h-12 w-12 text-red-500" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">权限不足</h1>
          <p className="text-slate-500 mt-2">只有系统管理员可以访问此页面</p>
        </div>
      </div>
    );
  }

  // 数据查询
  const { data: semesters = [], refetch: refetchSemesters } = trpc.classCheckin.getAllSemesters.useQuery();
  const { data: periods = [], refetch: refetchPeriods } = trpc.classCheckin.getPeriods.useQuery();
  const { data: currentWeekInfo } = trpc.classCheckin.getCurrentWeek.useQuery();

  // Mutations - 学期
  const createSemester = trpc.classCheckin.createSemester.useMutation({
    onSuccess: () => {
      toast.success("学期创建成功");
      setSemesterForm({ name: "", startDate: "", endDate: "", weekCount: "18" });
      setIsAddSemesterOpen(false);
      refetchSemesters();
    },
    onError: (err) => toast.error(err.message),
  });

  const setCurrentSemester = trpc.classCheckin.setCurrentSemester.useMutation({
    onSuccess: () => {
      toast.success("已设为当前学期");
      refetchSemesters();
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteSemester = trpc.classCheckin.deleteSemester.useMutation({
    onSuccess: () => {
      toast.success("学期已删除");
      setDeleteConfirm(null);
      refetchSemesters();
    },
    onError: (err) => toast.error(err.message),
  });

  // Mutations - 节次时间
  const createPeriod = trpc.classCheckin.createPeriod.useMutation({
    onSuccess: () => {
      toast.success("节次创建成功");
      setPeriodForm({ periodNo: "", periodName: "", startTime: "", endTime: "" });
      setIsAddPeriodOpen(false);
      refetchPeriods();
    },
    onError: (err) => toast.error(err.message),
  });

  const updatePeriod = trpc.classCheckin.updatePeriod.useMutation({
    onSuccess: () => {
      toast.success("节次更新成功");
      setEditingPeriod(null);
      refetchPeriods();
    },
    onError: (err) => toast.error(err.message),
  });

  const deletePeriod = trpc.classCheckin.deletePeriod.useMutation({
    onSuccess: () => {
      toast.success("节次已删除");
      setDeletePeriodConfirm(null);
      refetchPeriods();
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Settings className="h-8 w-8" />
          系统设置
        </h1>
      </div>

      <Tabs defaultValue="semester" className="space-y-4">
        <TabsList>
          <TabsTrigger value="semester" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            学期配置
          </TabsTrigger>
          <TabsTrigger value="periods" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            节次时间
          </TabsTrigger>
        </TabsList>

        {/* 学期配置 */}
        <TabsContent value="semester">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>学期配置</CardTitle>
                <CardDescription>
                  管理学期信息，系统根据学期开始日期自动计算当前周次
                </CardDescription>
              </div>
              <Button onClick={() => setIsAddSemesterOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                添加学期
              </Button>
            </CardHeader>
            <CardContent>
              {/* 当前周次信息 */}
              {currentWeekInfo?.semester && (
                <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 mb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm text-indigo-600">当前学期</div>
                      <div className="text-lg font-semibold text-indigo-800">
                        {currentWeekInfo.semester.semesterName}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-indigo-600">当前周次</div>
                      <div className="text-3xl font-bold text-indigo-800">
                        第 {currentWeekInfo.weekNo} 周
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 学期列表 */}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>学期名称</TableHead>
                    <TableHead>开始日期</TableHead>
                    <TableHead>结束日期</TableHead>
                    <TableHead>周数</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {semesters.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-gray-500 py-8">
                        暂无学期配置，请添加
                      </TableCell>
                    </TableRow>
                  ) : (
                    semesters.map((sem: any) => (
                      <TableRow key={sem.id}>
                        <TableCell className="font-medium">{sem.semesterName}</TableCell>
                        <TableCell>
                          {sem.startDate ? format(new Date(sem.startDate), "yyyy-MM-dd") : "-"}
                        </TableCell>
                        <TableCell>
                          {sem.endDate ? format(new Date(sem.endDate), "yyyy-MM-dd") : "-"}
                        </TableCell>
                        <TableCell>{sem.weekCount || 18} 周</TableCell>
                        <TableCell>
                          {sem.isCurrent ? (
                            <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                              当前学期
                            </span>
                          ) : (
                            <span className="px-2 py-1 bg-gray-100 text-gray-500 rounded-full text-xs">
                              -
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right space-x-2">
                          {!sem.isCurrent && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setCurrentSemester.mutate({ id: sem.id })}
                              disabled={setCurrentSemester.isPending}
                            >
                              <Check className="h-3 w-3 mr-1" />
                              设为当前
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-500 hover:text-red-600 hover:bg-red-50"
                            onClick={() => setDeleteConfirm({ id: sem.id, name: sem.semesterName })}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 节次时间配置 */}
        <TabsContent value="periods">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>节次时间表</CardTitle>
                <CardDescription>
                  学校作息时间配置，用于课程排课和签到时间计算
                </CardDescription>
              </div>
              <Button onClick={() => setIsAddPeriodOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                添加节次
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-20">节次</TableHead>
                    <TableHead>名称</TableHead>
                    <TableHead>开始时间</TableHead>
                    <TableHead>结束时间</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {periods.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-gray-500 py-8">
                        暂无节次配置，请添加
                      </TableCell>
                    </TableRow>
                  ) : (
                    periods.map((p: any) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-bold text-lg">第 {p.periodNo} 节</TableCell>
                        <TableCell>{p.periodName || `第${p.periodNo}节课`}</TableCell>
                        <TableCell className="font-mono">{p.startTime}</TableCell>
                        <TableCell className="font-mono">{p.endTime}</TableCell>
                        <TableCell className="text-right space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setEditingPeriod(p)}
                          >
                            编辑
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-500 hover:text-red-600 hover:bg-red-50"
                            onClick={() => setDeletePeriodConfirm({ id: p.id, label: `第${p.periodNo}节` })}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* 添加学期对话框 */}
      <Dialog open={isAddSemesterOpen} onOpenChange={setIsAddSemesterOpen}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle>添加学期</DialogTitle>
            <DialogDescription>配置新学期的基本信息</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>学期名称 <span className="text-red-500">*</span></Label>
              <Input
                placeholder="例如：2025-2026学年 第2学期"
                value={semesterForm.name}
                onChange={(e) => setSemesterForm({ ...semesterForm, name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>开始日期 <span className="text-red-500">*</span></Label>
                <Input
                  type="date"
                  value={semesterForm.startDate}
                  onChange={(e) => setSemesterForm({ ...semesterForm, startDate: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>结束日期 <span className="text-red-500">*</span></Label>
                <Input
                  type="date"
                  value={semesterForm.endDate}
                  onChange={(e) => setSemesterForm({ ...semesterForm, endDate: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>教学周数</Label>
              <Input
                type="number"
                min={1}
                max={25}
                value={semesterForm.weekCount}
                onChange={(e) => setSemesterForm({ ...semesterForm, weekCount: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddSemesterOpen(false)}>
              取消
            </Button>
            <Button
              onClick={() => {
                createSemester.mutate({
                  name: semesterForm.name,
                  startDate: semesterForm.startDate,
                  endDate: semesterForm.endDate,
                  weekCount: parseInt(semesterForm.weekCount) || 18,
                  isCurrent: semesters.length === 0 ? 1 : 0, // 第一个学期自动设为当前
                });
              }}
              disabled={!semesterForm.name || !semesterForm.startDate || !semesterForm.endDate || createSemester.isPending}
            >
              {createSemester.isPending ? "创建中..." : "创建"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除确认 */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除学期 "{deleteConfirm?.name}" 吗？此操作不可撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => deleteConfirm && deleteSemester.mutate({ id: deleteConfirm.id })}
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 添加节次对话框 */}
      <Dialog open={isAddPeriodOpen} onOpenChange={setIsAddPeriodOpen}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle>添加节次</DialogTitle>
            <DialogDescription>配置新的节次时间</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>节次号 <span className="text-red-500">*</span></Label>
              <Input
                type="number"
                min={1}
                max={12}
                placeholder="例如：1"
                value={periodForm.periodNo}
                onChange={(e) => setPeriodForm({ ...periodForm, periodNo: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>节次名称</Label>
              <Input
                placeholder="例如：第1节"
                value={periodForm.periodName}
                onChange={(e) => setPeriodForm({ ...periodForm, periodName: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>开始时间 <span className="text-red-500">*</span></Label>
                <Input
                  type="time"
                  value={periodForm.startTime}
                  onChange={(e) => setPeriodForm({ ...periodForm, startTime: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>结束时间 <span className="text-red-500">*</span></Label>
                <Input
                  type="time"
                  value={periodForm.endTime}
                  onChange={(e) => setPeriodForm({ ...periodForm, endTime: e.target.value })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddPeriodOpen(false)}>
              取消
            </Button>
            <Button
              onClick={() => {
                createPeriod.mutate({
                  periodNo: parseInt(periodForm.periodNo),
                  periodName: periodForm.periodName || undefined,
                  startTime: periodForm.startTime,
                  endTime: periodForm.endTime,
                });
              }}
              disabled={!periodForm.periodNo || !periodForm.startTime || !periodForm.endTime || createPeriod.isPending}
            >
              {createPeriod.isPending ? "创建中..." : "创建"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 编辑节次对话框 */}
      <Dialog open={!!editingPeriod} onOpenChange={() => setEditingPeriod(null)}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle>编辑节次</DialogTitle>
            <DialogDescription>修改节次时间配置</DialogDescription>
          </DialogHeader>
          {editingPeriod && (
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label>节次号 <span className="text-red-500">*</span></Label>
                <Input
                  type="number"
                  min={1}
                  max={12}
                  value={editingPeriod.periodNo}
                  onChange={(e) => setEditingPeriod({ ...editingPeriod, periodNo: parseInt(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label>节次名称</Label>
                <Input
                  value={editingPeriod.periodName || ""}
                  onChange={(e) => setEditingPeriod({ ...editingPeriod, periodName: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>开始时间 <span className="text-red-500">*</span></Label>
                  <Input
                    type="time"
                    value={editingPeriod.startTime}
                    onChange={(e) => setEditingPeriod({ ...editingPeriod, startTime: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>结束时间 <span className="text-red-500">*</span></Label>
                  <Input
                    type="time"
                    value={editingPeriod.endTime}
                    onChange={(e) => setEditingPeriod({ ...editingPeriod, endTime: e.target.value })}
                  />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingPeriod(null)}>
              取消
            </Button>
            <Button
              onClick={() => {
                updatePeriod.mutate({
                  id: editingPeriod.id,
                  periodNo: editingPeriod.periodNo,
                  periodName: editingPeriod.periodName || undefined,
                  startTime: editingPeriod.startTime,
                  endTime: editingPeriod.endTime,
                });
              }}
              disabled={updatePeriod.isPending}
            >
              {updatePeriod.isPending ? "保存中..." : "保存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除节次确认 */}
      <AlertDialog open={!!deletePeriodConfirm} onOpenChange={() => setDeletePeriodConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除 "{deletePeriodConfirm?.label}" 吗？此操作不可撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => deletePeriodConfirm && deletePeriod.mutate({ id: deletePeriodConfirm.id })}
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
