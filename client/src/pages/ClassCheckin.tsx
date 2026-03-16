import { useState, useEffect, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import QRCode from "qrcode";
import {
  AlertCircle,
  Check,
  Clock,
  MapPin,
  Play,
  QrCode,
  RefreshCw,
  Square,
  Users,
  X,
  History,
  ChevronDown,
  UserCheck,
  UserX,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

// 状态徽章
const StatusBadge = ({ status }: { status: string }) => {
  const styles = {
    present: "bg-green-100 text-green-700",
    late: "bg-yellow-100 text-yellow-700",
    absent: "bg-red-100 text-red-700",
    leave: "bg-blue-100 text-blue-700",
    active: "bg-green-100 text-green-700",
    closed: "bg-gray-100 text-gray-500",
  } as const;

  const labels = {
    present: "出勤",
    late: "迟到",
    absent: "缺勤",
    leave: "请假",
    active: "进行中",
    closed: "已结束",
  } as const;

  const style = styles[status as keyof typeof styles] || styles.absent;
  const label = labels[status as keyof typeof labels] || status;

  return (
    <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", style)}>
      {label}
    </span>
  );
};

export default function ClassCheckin() {
  const [selectedCourseId, setSelectedCourseId] = useState<number | null>(null);
  const [isStartDialogOpen, setIsStartDialogOpen] = useState(false);
  const [qrcodeDataUrl, setQrcodeDataUrl] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"checkin" | "history">("checkin");

  // 开启签到表单
  const [startForm, setStartForm] = useState({
    labId: "",
    title: "",
    weekNo: "",
    allowLateMinutes: "15",
    useGeofence: true,
    qrcodeRefreshSeconds: "30",
  });

  // 权限检查由后端API和菜单过滤处理

  // 查询数据
  const { data: courses = [] } = trpc.course.myList.useQuery();
  const { data: labs = [] } = trpc.labRoom.list.useQuery();
  const { data: activeSession, refetch: refetchActiveSession } = trpc.classCheckin.getActiveSession.useQuery(
    { courseId: selectedCourseId! },
    { enabled: !!selectedCourseId, refetchInterval: 5000 }
  );
  const { data: checkinHistory = [] } = trpc.classCheckin.getHistory.useQuery(
    { courseId: selectedCourseId || undefined },
    { enabled: activeTab === "history" }
  );
  const { data: semester } = trpc.classCheckin.getCurrentSemester.useQuery();

  // 计算周次的辅助函数
  const calculateWeekNo = (sessionDate: string | Date) => {
    if (!semester?.startDate) return null;
    const start = new Date(semester.startDate);
    const session = new Date(sessionDate);
    const diffTime = session.getTime() - start.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    const weekNo = Math.floor(diffDays / 7) + 1;
    return weekNo > 0 && weekNo <= (semester.weekCount || 20) ? weekNo : null;
  };

  // Mutations
  const startSession = trpc.classCheckin.startSession.useMutation({
    onSuccess: (data) => {
      toast.success(`签到已开启，共${data.studentCount}名学生`);
      setIsStartDialogOpen(false);
      refetchActiveSession();
      generateQrcode(data.qrcodeToken);
    },
    onError: (err) => toast.error(err.message),
  });

  const closeSession = trpc.classCheckin.closeSession.useMutation({
    onSuccess: () => {
      toast.success("签到已关闭");
      refetchActiveSession();
      setQrcodeDataUrl("");
    },
    onError: (err) => toast.error(err.message),
  });

  const refreshQrcode = trpc.classCheckin.refreshQrcode.useMutation({
    onSuccess: (data) => {
      generateQrcode(data.qrcodeToken);
    },
    onError: (err) => toast.error(err.message),
  });

  const updateAttendance = trpc.classCheckin.updateAttendance.useMutation({
    onSuccess: () => {
      toast.success("出勤状态已更新");
      refetchActiveSession();
    },
    onError: (err) => toast.error(err.message),
  });

  // 生成二维码
  const generateQrcode = async (token: string) => {
    try {
      const url = `${window.location.origin}/checkin?token=${token}`;
      const dataUrl = await QRCode.toDataURL(url, { width: 300, margin: 2 });
      setQrcodeDataUrl(dataUrl);
    } catch (err) {
      console.error("Failed to generate QR code", err);
    }
  };

  // 当有活跃会话时生成二维码
  useEffect(() => {
    if (activeSession?.qrcodeToken) {
      generateQrcode(activeSession.qrcodeToken);
    }
  }, [activeSession?.qrcodeToken]);

  // 自动刷新二维码
  useEffect(() => {
    if (!activeSession || activeSession.status !== "active") return;

    const refreshInterval = (activeSession.qrcodeRefreshSeconds || 30) * 1000;
    const timer = setInterval(() => {
      if (activeSession.id) {
        refreshQrcode.mutate({ sessionId: activeSession.id });
      }
    }, refreshInterval);

    return () => clearInterval(timer);
  }, [activeSession?.id, activeSession?.status, activeSession?.qrcodeRefreshSeconds]);

  // 自动计算并填充当前周次
  useEffect(() => {
    if (isStartDialogOpen && semester?.startDate && !startForm.weekNo) {
      const currentWeekNo = calculateWeekNo(new Date());
      if (currentWeekNo) {
        setStartForm(prev => ({ ...prev, weekNo: currentWeekNo.toString() }));
      }
    }
  }, [isStartDialogOpen, semester?.startDate]);

  // 开启签到
  const handleStartSession = () => {
    if (!selectedCourseId || !startForm.labId) {
      toast.error("请选择课程和实验室");
      return;
    }

    startSession.mutate({
      courseId: selectedCourseId,
      labId: parseInt(startForm.labId),
      title: startForm.title || undefined,
      weekNo: startForm.weekNo ? parseInt(startForm.weekNo) : undefined,
      allowLateMinutes: parseInt(startForm.allowLateMinutes) || 15,
      useGeofence: startForm.useGeofence,
      qrcodeRefreshSeconds: parseInt(startForm.qrcodeRefreshSeconds) || 30,
    });
  };

  // 统计
  const attendanceStats = useMemo(() => {
    if (!activeSession?.attendances) return { present: 0, late: 0, absent: 0, leave: 0, total: 0 };
    const stats = { present: 0, late: 0, absent: 0, leave: 0, total: 0 };
    for (const a of activeSession.attendances) {
      stats.total++;
      if (a.status === "present") stats.present++;
      else if (a.status === "late") stats.late++;
      else if (a.status === "absent") stats.absent++;
      else if (a.status === "leave") stats.leave++;
    }
    return stats;
  }, [activeSession?.attendances]);

  const selectedCourse = courses.find((c: any) => c.id === selectedCourseId);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">课堂签到</h1>
      </div>

      {/* 课程选择 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">选择课程</CardTitle>
        </CardHeader>
        <CardContent>
          <Select
            value={selectedCourseId?.toString() || ""}
            onValueChange={(v) => setSelectedCourseId(v ? parseInt(v) : null)}
          >
            <SelectTrigger className="w-full md:w-80">
              <SelectValue placeholder="请选择课程" />
            </SelectTrigger>
            <SelectContent>
              {courses.map((course: any) => (
                <SelectItem key={course.id} value={course.id.toString()}>
                  {course.name} ({course.courseNo})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {selectedCourseId && (
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
          <TabsList>
            <TabsTrigger value="checkin">
              <QrCode className="h-4 w-4 mr-2" />
              签到管理
            </TabsTrigger>
            <TabsTrigger value="history">
              <History className="h-4 w-4 mr-2" />
              签到历史
            </TabsTrigger>
          </TabsList>

          <TabsContent value="checkin" className="space-y-4 mt-4">
            {/* 活跃签到会话 */}
            {activeSession && activeSession.status === "active" ? (
              <div className="grid gap-4 md:grid-cols-2">
                {/* 二维码卡片 */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <QrCode className="h-5 w-5" />
                      签到二维码
                    </CardTitle>
                    <CardDescription>
                      学生扫描二维码签到，二维码每{activeSession.qrcodeRefreshSeconds || 30}秒自动刷新
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-col items-center space-y-4">
                    {qrcodeDataUrl ? (
                      <>
                        <img src={qrcodeDataUrl} alt="签到二维码" className="w-64 h-64 border rounded-lg" />
                        {/* 显示签到码 */}
                        <div className="w-full bg-blue-50 border-2 border-blue-200 rounded-lg p-4 text-center">
                          <p className="text-sm text-blue-600 mb-2">签到码（学生可手动输入）</p>
                          <p className="text-4xl font-bold text-blue-700 tracking-widest font-mono">
                            {activeSession.qrcodeToken}
                          </p>
                          <p className="text-xs text-blue-500 mt-2">
                            每{activeSession.qrcodeRefreshSeconds || 30}秒自动更新
                          </p>
                        </div>
                      </>
                    ) : (
                      <div className="w-64 h-64 bg-gray-100 rounded-lg flex items-center justify-center">
                        <RefreshCw className="h-8 w-8 text-gray-400 animate-spin" />
                      </div>
                    )}
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => activeSession.id && refreshQrcode.mutate({ sessionId: activeSession.id })}
                        disabled={refreshQrcode.isPending}
                      >
                        <RefreshCw className={cn("h-4 w-4 mr-1", refreshQrcode.isPending && "animate-spin")} />
                        刷新二维码
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => activeSession.id && closeSession.mutate({ sessionId: activeSession.id })}
                        disabled={closeSession.isPending}
                      >
                        <Square className="h-4 w-4 mr-1" />
                        结束签到
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* 出勤统计 */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="h-5 w-5" />
                      实时出勤
                    </CardTitle>
                    <CardDescription>
                      {activeSession.title || selectedCourse?.name} · 第{activeSession.weekNo || (activeSession.sessionDate ? calculateWeekNo(activeSession.sessionDate) : "?")}周
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-4 gap-4 mb-4">
                      <div className="text-center p-3 bg-green-50 rounded-lg">
                        <div className="text-2xl font-bold text-green-600">{attendanceStats.present}</div>
                        <div className="text-xs text-green-600">出勤</div>
                      </div>
                      <div className="text-center p-3 bg-yellow-50 rounded-lg">
                        <div className="text-2xl font-bold text-yellow-600">{attendanceStats.late}</div>
                        <div className="text-xs text-yellow-600">迟到</div>
                      </div>
                      <div className="text-center p-3 bg-red-50 rounded-lg">
                        <div className="text-2xl font-bold text-red-600">{attendanceStats.absent}</div>
                        <div className="text-xs text-red-600">缺勤</div>
                      </div>
                      <div className="text-center p-3 bg-blue-50 rounded-lg">
                        <div className="text-2xl font-bold text-blue-600">{attendanceStats.leave}</div>
                        <div className="text-xs text-blue-600">请假</div>
                      </div>
                    </div>

                    {/* 学生列表 */}
                    <div className="max-h-80 overflow-y-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>学生</TableHead>
                            <TableHead>状态</TableHead>
                            <TableHead>签到时间</TableHead>
                            <TableHead>操作</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {activeSession.attendances?.map((a: any) => (
                            <TableRow key={a.id}>
                              <TableCell>{a.studentName || `学生${a.studentId}`}</TableCell>
                              <TableCell>
                                <StatusBadge status={a.status} />
                              </TableCell>
                              <TableCell className="text-xs text-gray-500">
                                {a.checkinTime
                                  ? format(new Date(a.checkinTime), "HH:mm:ss")
                                  : "-"}
                              </TableCell>
                              <TableCell>
                                <Select
                                  value={a.status}
                                  onValueChange={(v) =>
                                    updateAttendance.mutate({
                                      sessionId: activeSession.id,
                                      studentId: a.studentId,
                                      status: v as any,
                                    })
                                  }
                                >
                                  <SelectTrigger className="h-7 w-20 text-xs">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="present">出勤</SelectItem>
                                    <SelectItem value="late">迟到</SelectItem>
                                    <SelectItem value="absent">缺勤</SelectItem>
                                    <SelectItem value="leave">请假</SelectItem>
                                  </SelectContent>
                                </Select>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : (
              /* 无活跃会话，显示开启按钮 */
              <Card>
                <CardContent className="py-12 text-center">
                  <QrCode className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-700 mb-2">当前没有进行中的签到</h3>
                  <p className="text-gray-500 mb-4">点击下方按钮开启课堂签到</p>
                  <Button onClick={() => setIsStartDialogOpen(true)}>
                    <Play className="h-4 w-4 mr-2" />
                    开启签到
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="history" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>签到历史</CardTitle>
                <CardDescription>查看历史签到记录与统计</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>日期</TableHead>
                      <TableHead>周次</TableHead>
                      <TableHead>课程</TableHead>
                      <TableHead>实验室</TableHead>
                      <TableHead>出勤/迟到/缺勤</TableHead>
                      <TableHead>状态</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {checkinHistory.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-gray-500 py-8">
                          暂无签到记录
                        </TableCell>
                      </TableRow>
                    ) : (
                      checkinHistory.map((h: any) => {
                        const displayWeekNo = h.weekNo || (h.sessionDate ? calculateWeekNo(h.sessionDate) : null);
                        return (
                        <TableRow key={h.id}>
                          <TableCell>
                            {h.sessionDate
                              ? format(new Date(h.sessionDate), "MM-dd", { locale: zhCN })
                              : "-"}
                          </TableCell>
                          <TableCell>第{displayWeekNo || "?"}周</TableCell>
                          <TableCell>{h.courseName}</TableCell>
                          <TableCell>{h.labName}</TableCell>
                          <TableCell>
                            <span className="text-green-600">{h.presentCount || 0}</span>
                            {" / "}
                            <span className="text-yellow-600">{h.lateCount || 0}</span>
                            {" / "}
                            <span className="text-red-600">{h.absentCount || 0}</span>
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={h.status} />
                          </TableCell>
                        </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      {/* 开启签到对话框 */}
      <Dialog open={isStartDialogOpen} onOpenChange={setIsStartDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>开启课堂签到</DialogTitle>
            <DialogDescription>
              为 {selectedCourse?.name} 开启签到，学生可通过扫描二维码或位置签到
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>实验室 *</Label>
              <Select value={startForm.labId} onValueChange={(v) => setStartForm({ ...startForm, labId: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="选择实验室" />
                </SelectTrigger>
                <SelectContent>
                  {labs.map((lab: any) => (
                    <SelectItem key={lab.id} value={lab.id.toString()}>
                      {lab.name} ({lab.roomNo})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>本次课主题（可选）</Label>
              <Input
                value={startForm.title}
                onChange={(e) => setStartForm({ ...startForm, title: e.target.value })}
                placeholder="如：实验1 - 数据结构基础"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>第几周</Label>
                <Input
                  type="number"
                  value={startForm.weekNo}
                  onChange={(e) => setStartForm({ ...startForm, weekNo: e.target.value })}
                  placeholder="如：3"
                />
              </div>
              <div className="space-y-2">
                <Label>迟到阈值（分钟）</Label>
                <Input
                  type="number"
                  value={startForm.allowLateMinutes}
                  onChange={(e) => setStartForm({ ...startForm, allowLateMinutes: e.target.value })}
                />
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="useGeofence"
                checked={startForm.useGeofence}
                onChange={(e) => setStartForm({ ...startForm, useGeofence: e.target.checked })}
                className="rounded"
              />
              <Label htmlFor="useGeofence">启用地理围栏验证（需实验室已配置围栏）</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsStartDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleStartSession} disabled={startSession.isPending}>
              {startSession.isPending ? "开启中..." : "开启签到"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
