import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Clock, MapPin, Users, ChevronRight, LayoutGrid, ChevronLeft } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Fragment, useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";

export default function StudentCourses() {
  const { user } = useAuth();
  const [selectedCourse, setSelectedCourse] = useState<any>(null);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);

  // 检查是否是学生
  if (user?.role !== 'student') {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600">权限不足</h1>
          <p className="text-gray-600 mt-2">只有学生可以查看此页面</p>
        </div>
      </div>
    );
  }

  // 查询学生的课程列表
  const { data: courses = [], isLoading, error } = trpc.course.list.useQuery();

  // 排课数据（课表用）
  const { data: allSchedules = [] } = trpc.classCheckin.getScheduleBoard.useQuery({});
  const { data: periods = [] } = trpc.classCheckin.getPeriods.useQuery();
  const { data: semester } = trpc.classCheckin.getCurrentSemester.useQuery();

  // 当前周次
  const computedCurrentWeek = useMemo(() => {
    if (!semester?.startDate) return 1;
    const now = new Date();
    const start = new Date(semester.startDate);
    const diff = now.getTime() - start.getTime();
    const week = Math.ceil(diff / (7 * 24 * 60 * 60 * 1000));
    return Math.max(1, Math.min(week, semester.weekCount || 20));
  }, [semester]);

  const [currentWeek, setCurrentWeek] = useState(1);
  useEffect(() => { setCurrentWeek(computedCurrentWeek); }, [computedCurrentWeek]);
  const totalWeeks = semester?.weekCount || 20;

  // 过滤只属于我选的课的排课
  const myCourseIds = useMemo(() => new Set(courses.map((c: any) => c.id)), [courses]);
  const mySchedules = useMemo(() =>
    allSchedules.filter((s: any) => myCourseIds.has(s.courseId)),
    [allSchedules, myCourseIds]
  );

  // 按当前周过滤
  const weekSchedules = useMemo(() => {
    return mySchedules.filter((s: any) => {
      if (currentWeek < (s.startWeek || 1) || currentWeek > (s.endWeek || 20)) return false;
      if (s.weekType === "odd" && currentWeek % 2 === 0) return false;
      if (s.weekType === "even" && currentWeek % 2 !== 0) return false;
      return true;
    });
  }, [mySchedules, currentWeek]);

  // 查询课程预约（实验室时间）
  const { data: courseReservations = {} } = trpc.courseReservation.getByCourse.useQuery(
    { courseId: selectedCourse?.id || 0 },
    { enabled: !!selectedCourse }
  );

  const handleViewDetails = (course: any) => {
    setSelectedCourse(course);
    setIsDetailDialogOpen(true);
  };

  const formatDateTime = (dateString?: string) => {
    if (!dateString) return '-';
    try {
      const date = new Date(dateString);
      return date.toLocaleString('zh-CN');
    } catch {
      return dateString;
    }
  };

  const DAY_NAMES = ["周一", "周二", "周三", "周四", "周五"];
  const COURSE_COLORS = [
    { bg: "bg-blue-100", border: "border-blue-300", text: "text-blue-800" },
    { bg: "bg-emerald-100", border: "border-emerald-300", text: "text-emerald-800" },
    { bg: "bg-amber-100", border: "border-amber-300", text: "text-amber-800" },
    { bg: "bg-purple-100", border: "border-purple-300", text: "text-purple-800" },
    { bg: "bg-rose-100", border: "border-rose-300", text: "text-rose-800" },
    { bg: "bg-cyan-100", border: "border-cyan-300", text: "text-cyan-800" },
    { bg: "bg-orange-100", border: "border-orange-300", text: "text-orange-800" },
    { bg: "bg-indigo-100", border: "border-indigo-300", text: "text-indigo-800" },
  ];

  const courseColorMap = useMemo(() => {
    const map = new Map<number, typeof COURSE_COLORS[0]>();
    const ids = Array.from(new Set(mySchedules.map((s: any) => s.courseId)));
    ids.forEach((id, idx) => map.set(id as number, COURSE_COLORS[idx % COURSE_COLORS.length]));
    return map;
  }, [mySchedules]);

  const periodList = useMemo(() => {
    if (periods.length > 0) return periods as any[];
    return Array.from({ length: 12 }, (_, i) => ({
      periodNo: i + 1, periodName: `第${i + 1}节`, startTime: "", endTime: "",
    }));
  }, [periods]);

  // span 计算 → 改为 gridData（学生可能同时选了不同实验室的课）
  const gridData = useMemo(() => {
    const grid: Record<string, any[]> = {};
    for (const s of weekSchedules as any[]) {
      for (let p = s.startPeriod; p <= s.endPeriod; p++) {
        const key = `${s.dayOfWeek}-${p}`;
        if (!grid[key]) grid[key] = [];
        if (!grid[key].some((x: any) => x.id === s.id)) grid[key].push(s);
      }
    }
    return grid;
  }, [weekSchedules]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">我的课程</h1>
        <div className="text-sm text-gray-500">
          共选修 {courses.length} 门课程
        </div>
      </div>

      <Tabs defaultValue="list">
        <TabsList>
          <TabsTrigger value="list" className="gap-1.5">
            <BookOpen className="h-4 w-4" /> 课程列表
          </TabsTrigger>
          <TabsTrigger value="schedule" className="gap-1.5">
            <LayoutGrid className="h-4 w-4" /> 我的课表
          </TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="mt-4">
      {isLoading ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-gray-500 text-center py-8">加载课程中...</p>
          </CardContent>
        </Card>
      ) : error ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-red-500 text-center py-8">
              加载失败：{error.message}
            </p>
          </CardContent>
        </Card>
      ) : courses.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <BookOpen className="h-12 w-12 text-gray-300 mx-auto mb-2" />
              <p className="text-gray-500">暂无选修课程</p>
              <p className="text-sm text-gray-400 mt-1">请联系教师进行课程选择</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {courses.map((course: any) => (
            <Card 
              key={course.id} 
              className="hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => handleViewDetails(course)}
            >
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">{course.name}</CardTitle>
                <p className="text-sm text-gray-500">{course.courseNo}</p>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Users className="h-4 w-4" />
                  <span>教师：{course.teacherName || '-'}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Clock className="h-4 w-4" />
                  <span>学期：{course.semester || '-'}</span>
                </div>
                <div className="pt-2">
                  <Button 
                    variant="outline" 
                    className="w-full text-xs"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleViewDetails(course);
                    }}
                  >
                    查看详情
                    <ChevronRight className="h-3 w-3 ml-1" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* 课程详情对话框 */}
      <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedCourse?.name}</DialogTitle>
            <DialogDescription>
              课程编号：{selectedCourse?.courseNo}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">教师</p>
                <p className="font-medium">{selectedCourse?.teacherName || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">学期</p>
                <p className="font-medium">{selectedCourse?.semester || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">状态</p>
                <p className="font-medium capitalize">
                  {selectedCourse?.status === 'active' ? '活跃' : '已归档'}
                </p>
              </div>
            </div>

            {/* 实验室预约时间 */}
            <div className="border-t pt-4">
              <h3 className="font-semibold mb-3">实验室预约</h3>
              {Array.isArray(courseReservations) && courseReservations.length > 0 ? (
                <div className="space-y-2">
                  {courseReservations.map((reservation: any) => (
                    <div key={reservation.id} className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg">
                      <MapPin className="h-4 w-4 text-blue-600 mt-1 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="font-medium text-sm">{reservation.title}</p>
                        {reservation.labRoom && (
                          <p className="text-xs text-blue-700 mt-1">
                            <MapPin className="h-3.5 w-3.5 text-blue-700 inline-block mr-1 -mt-0.5" />
                            {reservation.labRoom.name}
                            {reservation.labRoom.location && ` - ${reservation.labRoom.location}`}
                          </p>
                        )}
                        <p className="text-xs text-gray-600 mt-1">
                          {formatDateTime(reservation.startTime)} 至 {formatDateTime(reservation.endTime)}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          状态：<span className="capitalize">{reservation.status}</span>
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500 text-center py-4">暂无实验室预约</p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
        </TabsContent>

        {/* 我的课表 Tab */}
        <TabsContent value="schedule" className="mt-4 space-y-4">
          {/* 周数导航 */}
          <div className="flex items-center justify-between bg-white rounded-xl border px-4 py-3">
            <Button
              variant="ghost" size="sm"
              disabled={currentWeek <= 1}
              onClick={() => setCurrentWeek(w => Math.max(1, w - 1))}
            >
              <ChevronLeft className="h-4 w-4 mr-1" /> 上一周
            </Button>
            <div className="flex items-center gap-3">
              <Select value={`${currentWeek}`} onValueChange={(v) => setCurrentWeek(parseInt(v))}>
                <SelectTrigger className="w-[180px] border-0 shadow-none text-center font-bold text-lg">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: totalWeeks }, (_, i) => (
                    <SelectItem key={i + 1} value={`${i + 1}`}>
                      第 {i + 1} 周{i + 1 === computedCurrentWeek ? " (本周)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              variant="ghost" size="sm"
              disabled={currentWeek >= totalWeeks}
              onClick={() => setCurrentWeek(w => Math.min(totalWeeks, w + 1))}
            >
              下一周 <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>

          {/* 课表网格 */}
          {weekSchedules.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-8">
                  <LayoutGrid className="h-12 w-12 text-gray-300 mx-auto mb-2" />
                  <p className="text-gray-500">本周没有实验课</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="overflow-hidden">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse min-w-[700px]">
                    <thead>
                      <tr>
                        <th className="w-[72px] bg-slate-100 border-b border-r p-2 text-xs text-slate-500 font-medium">节次</th>
                        {DAY_NAMES.map((day, idx) => (
                          <th key={idx} className="bg-slate-100 border-b border-r p-2 text-center text-sm font-semibold text-slate-700 min-w-[120px]">
                            {day}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {periodList.map((period: any) => {
                        const showNoon = period.periodNo === 5;
                        const showEvening = period.periodNo === 9;
                        return (
                          <Fragment key={period.periodNo}>
                            {showNoon && (
                              <tr key="noon">
                                <td colSpan={6} className="bg-amber-50/60 text-center text-xs text-amber-600 py-1 border-b font-medium">— 午 休 —</td>
                              </tr>
                            )}
                            {showEvening && (
                              <tr key="evening">
                                <td colSpan={6} className="bg-indigo-50/60 text-center text-xs text-indigo-600 py-1 border-b font-medium">— 晚 间 —</td>
                              </tr>
                            )}
                            <tr key={period.periodNo}>
                              <td className="border-b border-r p-1.5 bg-slate-50 text-center">
                                <div className="text-xs font-medium text-slate-700">{period.periodName}</div>
                                {period.startTime && (
                                  <div className="text-[10px] text-slate-400">{period.startTime}</div>
                                )}
                              </td>
                              {[1, 2, 3, 4, 5].map((day) => {
                                const key = `${day}-${period.periodNo}`;
                                const cellItems = gridData[key] || [];
                                if (cellItems.length === 0) {
                                  return <td key={key} className="border-b border-r p-1 h-[52px]" />;
                                }
                                // 区分起始和延续
                                const startItems = cellItems.filter((s: any) => s.startPeriod === period.periodNo);
                                const contItems = cellItems.filter((s: any) => s.startPeriod !== period.periodNo);
                                return (
                                  <td key={key} className="border-b border-r p-0.5 align-top">
                                    <div className="flex flex-col gap-0.5">
                                      {startItems.map((s: any) => {
                                        const color = courseColorMap.get(s.courseId) || COURSE_COLORS[0];
                                        const span = s.endPeriod - s.startPeriod + 1;
                                        return (
                                          <Tooltip key={s.id}>
                                            <TooltipTrigger asChild>
                                              <div className={cn("rounded-md border px-1.5 py-1", color.bg, color.border)}>
                                                <div className={cn("font-semibold text-[11px] leading-tight truncate", color.text)}>{s.courseName}</div>
                                                <div className="text-[10px] text-slate-500 truncate flex items-center gap-0.5">
                                                  <MapPin className="h-3 w-3 flex-shrink-0" />{s.labName || s.labRoomNo}
                                                  {span > 1 && <span className="text-slate-400 ml-1">({span}节)</span>}
                                                </div>
                                              </div>
                                            </TooltipTrigger>
                                            <TooltipContent side="right" className="max-w-xs">
                                              <div className="space-y-1 text-sm">
                                                <p className="font-bold">{s.courseName}</p>
                                                <p>教师：{s.teacherName}</p>
                                                <p>实验室：{s.labName} ({s.labRoomNo})</p>
                                                <p>节次：第{s.startPeriod}-{s.endPeriod}节</p>
                                                <p>周次：{s.startWeek}-{s.endWeek}周</p>
                                              </div>
                                            </TooltipContent>
                                          </Tooltip>
                                        );
                                      })}
                                      {contItems.map((s: any) => {
                                        const color = courseColorMap.get(s.courseId) || COURSE_COLORS[0];
                                        return (
                                          <div key={`c-${s.id}`} className={cn(
                                            "rounded-sm border px-1 py-0.5 text-[10px] truncate opacity-60",
                                            color.bg, color.border, color.text
                                          )}>
                                            {s.courseName}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </td>
                                );
                              })}
                            </tr>
                          </Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* 课程图例 */}
          {weekSchedules.length > 0 && (
            <div className="flex items-center gap-3 flex-wrap text-sm bg-white rounded-xl border p-3">
              <span className="text-slate-500">本周 {weekSchedules.length} 节课：</span>
              {Array.from(courseColorMap.entries()).map(([courseId, color]) => {
                const s = mySchedules.find((s: any) => s.courseId === courseId);
                if (!s) return null;
                return (
                  <Badge key={courseId} variant="outline" className={cn("text-xs", color.bg, color.border, color.text)}>
                    {(s as any).courseName}
                  </Badge>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
