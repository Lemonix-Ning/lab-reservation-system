import { useState, useEffect } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import {
  AlertCircle,
  Check,
  Clock,
  MapPin,
  QrCode,
  Loader2,
  BookOpen,
  History,
  CheckCircle2,
  KeyRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

// 状态徽章
const StatusBadge = ({ status }: { status: string }) => {
  const styles = {
    present: "bg-green-100 text-green-700",
    late: "bg-yellow-100 text-yellow-700",
    absent: "bg-red-100 text-red-700",
    leave: "bg-blue-100 text-blue-700",
  } as const;

  const labels = {
    present: "出勤",
    late: "迟到",
    absent: "缺勤",
    leave: "请假",
  } as const;

  const style = styles[status as keyof typeof styles] || styles.absent;
  const label = labels[status as keyof typeof labels] || status;

  return (
    <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", style)}>
      {label}
    </span>
  );
};

export default function StudentCheckin() {
  const { user } = useAuth();
  const [selectedCourseId, setSelectedCourseId] = useState<number | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [isTokenDialogOpen, setIsTokenDialogOpen] = useState(false);
  const [tokenInput, setTokenInput] = useState("");

  // 权限检查
  if (user?.role !== "student") {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center space-y-4">
        <div className="bg-red-50 p-6 rounded-full">
          <AlertCircle className="h-12 w-12 text-red-500" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">权限不足</h1>
          <p className="text-slate-500 mt-2">只有学生可以使用此页面</p>
        </div>
      </div>
    );
  }

  // 查询数据
  const { data: activeCheckins = [], refetch: refetchActive } = trpc.classCheckin.getActiveCheckins.useQuery(
    undefined,
    { refetchInterval: 10000 }
  );
  const { data: courses = [] } = trpc.course.enrolledCourses.useQuery();
  const { data: myAttendance = [] } = trpc.classCheckin.getMyAttendance.useQuery(
    { courseId: selectedCourseId! },
    { enabled: !!selectedCourseId }
  );

  // Mutations
  const geofenceCheckin = trpc.classCheckin.studentGeofenceCheckin.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      refetchActive();
    },
    onError: (err) => toast.error(err.message),
  });

  const tokenCheckin = trpc.classCheckin.studentCheckin.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      setIsTokenDialogOpen(false);
      setTokenInput("");
      refetchActive();
    },
    onError: (err) => toast.error(err.message),
  });

  // 获取当前位置
  const getLocation = (): Promise<{ lat: number; lng: number }> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("浏览器不支持定位"));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        (err) => reject(new Error(`定位失败: ${err.message}`)),
        { enableHighAccuracy: true, timeout: 10000 }
      );
    });
  };

  // 位置签到
  const handleGeofenceCheckin = async (sessionId: number) => {
    setIsLocating(true);
    try {
      const loc = await getLocation();
      setLocation(loc);
      geofenceCheckin.mutate({
        sessionId,
        latitude: loc.lat,
        longitude: loc.lng,
      });
    } catch (err: any) {
      toast.error(err.message || "定位失败");
    } finally {
      setIsLocating(false);
    }
  };

  // 签到码签到
  const handleTokenCheckin = () => {
    if (!tokenInput.trim()) {
      toast.error("请输入签到码");
      return;
    }
    tokenCheckin.mutate({ token: tokenInput.trim() });
  };

  // 统计出勤
  const attendanceStats = (() => {
    const stats = { present: 0, late: 0, absent: 0, leave: 0, total: 0 };
    for (const a of myAttendance) {
      stats.total++;
      if (a.status === "present") stats.present++;
      else if (a.status === "late") stats.late++;
      else if (a.status === "absent") stats.absent++;
      else if (a.status === "leave") stats.leave++;
    }
    return stats;
  })();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">课程签到</h1>
      </div>

      {/* 当前可签到的课程 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5 text-green-600" />
            当前可签到
          </CardTitle>
          <CardDescription>教师开启签到后，您可以在这里进行签到</CardDescription>
        </CardHeader>
        <CardContent>
          {activeCheckins.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Clock className="h-12 w-12 text-gray-300 mx-auto mb-2" />
              <p>暂无进行中的签到</p>
              <p className="text-sm text-gray-400 mt-1">请等待教师开启签到</p>
            </div>
          ) : (
            <div className="space-y-3">
              {activeCheckins.map((item: any) => (
                <div
                  key={item.sessionId}
                  className={cn(
                    "p-4 border rounded-lg",
                    item.hasCheckedIn ? "bg-green-50 border-green-200" : "bg-white"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium">{item.courseName}</h4>
                      <div className="text-sm text-gray-500 flex items-center gap-2 mt-1">
                        <MapPin className="h-3 w-3" />
                        {item.labName}
                        <span>·</span>
                        <Clock className="h-3 w-3" />
                        {item.startedAt
                          ? format(new Date(item.startedAt), "HH:mm", { locale: zhCN })
                          : "-"}
                        开始
                      </div>
                      {item.title && (
                        <div className="text-sm text-gray-600 mt-1">{item.title}</div>
                      )}
                    </div>
                    <div>
                      {item.hasCheckedIn ? (
                        <div className="flex items-center gap-2 text-green-600">
                          <CheckCircle2 className="h-5 w-5" />
                          <span>已签到</span>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            onClick={() => setIsTokenDialogOpen(true)}
                          >
                            <KeyRound className="h-4 w-4 mr-2" />
                            输入签到码
                          </Button>
                          <Button
                            onClick={() => handleGeofenceCheckin(item.sessionId)}
                            disabled={isLocating || geofenceCheckin.isPending}
                          >
                            {isLocating || geofenceCheckin.isPending ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                定位中...
                              </>
                            ) : (
                              <>
                                <MapPin className="h-4 w-4 mr-2" />
                                位置签到
                              </>
                            )}
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 我的出勤记录 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            我的出勤记录
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <Select
              value={selectedCourseId?.toString() || ""}
              onValueChange={(v) => setSelectedCourseId(v ? parseInt(v) : null)}
            >
              <SelectTrigger className="w-full md:w-80">
                <SelectValue placeholder="选择课程查看出勤记录" />
              </SelectTrigger>
              <SelectContent>
                {courses.map((course: any) => (
                  <SelectItem key={course.id} value={course.id.toString()}>
                    {course.name} ({course.courseNo})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedCourseId && (
            <>
              {/* 统计卡片 */}
              <div className="grid grid-cols-4 gap-3 mb-4">
                <div className="text-center p-3 bg-green-50 rounded-lg">
                  <div className="text-xl font-bold text-green-600">{attendanceStats.present}</div>
                  <div className="text-xs text-green-600">出勤</div>
                </div>
                <div className="text-center p-3 bg-yellow-50 rounded-lg">
                  <div className="text-xl font-bold text-yellow-600">{attendanceStats.late}</div>
                  <div className="text-xs text-yellow-600">迟到</div>
                </div>
                <div className="text-center p-3 bg-red-50 rounded-lg">
                  <div className="text-xl font-bold text-red-600">{attendanceStats.absent}</div>
                  <div className="text-xs text-red-600">缺勤</div>
                </div>
                <div className="text-center p-3 bg-blue-50 rounded-lg">
                  <div className="text-xl font-bold text-blue-600">{attendanceStats.leave}</div>
                  <div className="text-xs text-blue-600">请假</div>
                </div>
              </div>

              {/* 详细记录 */}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>日期</TableHead>
                    <TableHead>周次</TableHead>
                    <TableHead>主题</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>签到时间</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {myAttendance.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-gray-500 py-8">
                        暂无出勤记录
                      </TableCell>
                    </TableRow>
                  ) : (
                    myAttendance.map((a: any) => (
                      <TableRow key={a.id}>
                        <TableCell>
                          {a.sessionDate
                            ? format(new Date(a.sessionDate), "MM-dd", { locale: zhCN })
                            : "-"}
                        </TableCell>
                        <TableCell>第{a.weekNo || "?"}周</TableCell>
                        <TableCell className="text-gray-600">{a.title || "-"}</TableCell>
                        <TableCell>
                          <StatusBadge status={a.status} />
                        </TableCell>
                        <TableCell className="text-xs text-gray-500">
                          {a.checkinTime
                            ? format(new Date(a.checkinTime), "HH:mm:ss")
                            : "-"}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </>
          )}
        </CardContent>
      </Card>

      {/* 输入签到码对话框 */}
      <Dialog open={isTokenDialogOpen} onOpenChange={setIsTokenDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>输入签到码</DialogTitle>
            <DialogDescription>
              请输入教师提供的6位数字签到码
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>签到码</Label>
              <Input
                placeholder="例如: 123456"
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleTokenCheckin()}
                maxLength={6}
                className="text-center text-2xl font-mono tracking-widest"
              />
              <p className="text-xs text-gray-500">
                提示：签到码为6位数字，显示在教师的二维码下方
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsTokenDialogOpen(false)}>
              取消
            </Button>
            <Button
              onClick={handleTokenCheckin}
              disabled={tokenCheckin.isPending || !tokenInput.trim()}
            >
              {tokenCheckin.isPending ? "签到中..." : "确认签到"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
