import { Fragment, useEffect, useMemo, useState } from "react";
import { Calendar, ChevronLeft, ChevronRight, Info } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import { useRole } from "@/contexts/RoleContext";
import ScheduleImport from "@/components/ScheduleImport";

const DAY_NAMES = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];

// 课程颜色列表（最多8种，循环使用）
const COURSE_COLORS = [
  { bg: "bg-blue-100", border: "border-blue-300", text: "text-blue-800", header: "bg-blue-500" },
  { bg: "bg-emerald-100", border: "border-emerald-300", text: "text-emerald-800", header: "bg-emerald-500" },
  { bg: "bg-amber-100", border: "border-amber-300", text: "text-amber-800", header: "bg-amber-500" },
  { bg: "bg-purple-100", border: "border-purple-300", text: "text-purple-800", header: "bg-purple-500" },
  { bg: "bg-rose-100", border: "border-rose-300", text: "text-rose-800", header: "bg-rose-500" },
  { bg: "bg-cyan-100", border: "border-cyan-300", text: "text-cyan-800", header: "bg-cyan-500" },
  { bg: "bg-orange-100", border: "border-orange-300", text: "text-orange-800", header: "bg-orange-500" },
  { bg: "bg-indigo-100", border: "border-indigo-300", text: "text-indigo-800", header: "bg-indigo-500" },
];

export default function ScheduleBoard() {
  const [labFilter, setLabFilter] = useState<string>("all");
  const [currentWeek, setCurrentWeek] = useState(1);
  const { currentRole } = useRole();
  const utils = trpc.useUtils();

  const { data: periods = [] } = trpc.classCheckin.getPeriods.useQuery();
  const { data: semester } = trpc.classCheckin.getCurrentSemester.useQuery();
  // 始终获取全部排课，前端按 labFilter 过滤
  const { data: allSchedules = [] } = trpc.classCheckin.getScheduleBoard.useQuery({});
  
  const isAdmin = currentRole === "sysAdmin" || currentRole === "labAdmin";

  // 从排课数据中提取有课的实验室（去重 + 排序）
  const scheduledLabs = useMemo(() => {
    const map = new Map<number, { id: number; name: string; roomNo: string }>();
    for (const s of allSchedules as any[]) {
      if (!map.has(s.labId)) {
        map.set(s.labId, { id: s.labId, name: s.labName, roomNo: s.labRoomNo });
      }
    }
    return Array.from(map.values()).sort((a, b) => a.roomNo.localeCompare(b.roomNo));
  }, [allSchedules]);

  // 按选中的实验室过滤
  const schedules = useMemo(() => {
    if (labFilter === "all") return allSchedules;
    const labId = parseInt(labFilter);
    return (allSchedules as any[]).filter((s: any) => s.labId === labId);
  }, [allSchedules, labFilter]);

  // 当前学期第几周
  const computedCurrentWeek = useMemo(() => {
    if (!semester?.startDate) return 1;
    const now = new Date();
    const start = new Date(semester.startDate);
    const diff = now.getTime() - start.getTime();
    const week = Math.ceil(diff / (7 * 24 * 60 * 60 * 1000));
    return Math.max(1, Math.min(week, semester.weekCount || 20));
  }, [semester]);

  // 初始化到当前周（semester 加载后同步）
  useEffect(() => { setCurrentWeek(computedCurrentWeek); }, [computedCurrentWeek]);

  // 过滤当前周的排课
  const weekSchedules = useMemo(() => {
    return schedules.filter((s: any) => {
      if (currentWeek < (s.startWeek || 1) || currentWeek > (s.endWeek || 20)) return false;
      if (s.weekType === "odd" && currentWeek % 2 === 0) return false;
      if (s.weekType === "even" && currentWeek % 2 !== 0) return false;
      return true;
    });
  }, [schedules, currentWeek]);

  // 课程 → 颜色 映射
  const courseColorMap = useMemo(() => {
    const map = new Map<number, typeof COURSE_COLORS[0]>();
    const courseIds = Array.from(new Set(schedules.map((s: any) => s.courseId)));
    courseIds.forEach((id, idx) => {
      map.set(id as number, COURSE_COLORS[idx % COURSE_COLORS.length]);
    });
    return map;
  }, [schedules]);

  // 节次列表（1-12）
  const periodList = useMemo(() => {
    if (periods.length > 0) return periods;
    // 备用默认值
    return Array.from({ length: 12 }, (_, i) => ({
      periodNo: i + 1,
      periodName: `第${i + 1}节`,
      startTime: "",
      endTime: "",
    }));
  }, [periods]);

  // 构建格子数据 [dayOfWeek-periodNo] => schedule[]（去重：只含 startPeriod 匹配的）
  const gridData = useMemo(() => {
    const grid: Record<string, any[]> = {};
    for (const s of weekSchedules as any[]) {
      for (let p = s.startPeriod; p <= s.endPeriod; p++) {
        const key = `${s.dayOfWeek}-${p}`;
        if (!grid[key]) grid[key] = [];
        grid[key].push(s);
      }
    }
    return grid;
  }, [weekSchedules]);

  const isSingleLab = labFilter !== "all";

  // 单实验室模式：rowSpan 合并（一个时间段只有一门课）
  const spanData = useMemo(() => {
    if (!isSingleLab) return { spans: {} as Record<string, { schedule: any; rowSpan: number }>, hidden: new Set<string>() };

    const spans: Record<string, { schedule: any; rowSpan: number }> = {};
    const hidden = new Set<string>();

    for (const s of weekSchedules as any[]) {
      const startKey = `${s.dayOfWeek}-${s.startPeriod}`;
      const rowSpan = s.endPeriod - s.startPeriod + 1;
      if (!spans[startKey]) {
        spans[startKey] = { schedule: s, rowSpan };
      }
      for (let p = s.startPeriod + 1; p <= s.endPeriod; p++) {
        hidden.add(`${s.dayOfWeek}-${p}`);
      }
    }

    return { spans, hidden };
  }, [weekSchedules, isSingleLab]);

  // 全部实验室模式：每个起始节次的排课列表（去重：只在 startPeriod 显示）
  const cellStartSchedules = useMemo(() => {
    if (isSingleLab) return {} as Record<string, any[]>;
    const map: Record<string, any[]> = {};
    for (const s of weekSchedules as any[]) {
      const key = `${s.dayOfWeek}-${s.startPeriod}`;
      if (!map[key]) map[key] = [];
      // 去重（按 schedule id）
      if (!map[key].some((x: any) => x.id === s.id)) {
        map[key].push(s);
      }
    }
    return map;
  }, [weekSchedules, isSingleLab]);

  // 计算本周日期范围
  const weekDateRange = useMemo(() => {
    if (!semester?.startDate) return "";
    const start = new Date(semester.startDate);
    const weekStart = new Date(start.getTime() + (currentWeek - 1) * 7 * 24 * 60 * 60 * 1000);
    const weekEnd = new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000);
    const fmt = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`;
    return `${fmt(weekStart)} - ${fmt(weekEnd)}`;
  }, [semester, currentWeek]);

  const totalWeeks = semester?.weekCount || 20;

  return (
    <div className="min-h-screen bg-slate-50/50 p-6 space-y-6 font-sans">
      {/* 头部 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Calendar className="h-6 w-6 text-blue-600" /> 实验室课表
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            {semester?.semesterName || "当前学期"} · 共 {totalWeeks} 周
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <Select value={labFilter} onValueChange={setLabFilter}>
            <SelectTrigger className="w-[180px] bg-white">
              <SelectValue placeholder="全部实验室" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部实验室</SelectItem>
              {scheduledLabs.map((lab) => (
                <SelectItem key={lab.id} value={`${lab.id}`}>{lab.name}（{lab.roomNo}）</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {isAdmin && (
            <ScheduleImport onSuccess={() => utils.classCheckin.getScheduleBoard.invalidate()} />
          )}
        </div>
      </div>

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
          {weekDateRange && (
            <span className="text-sm text-slate-500">{weekDateRange}</span>
          )}
        </div>
        <Button
          variant="ghost" size="sm"
          disabled={currentWeek >= totalWeeks}
          onClick={() => setCurrentWeek(w => Math.min(totalWeeks, w + 1))}
        >
          下一周 <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>

      {/* 课表主体 */}
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse min-w-[800px]">
              <thead>
                <tr>
                  <th className="w-[80px] bg-slate-100 border-b border-r p-2 text-xs text-slate-500 font-medium sticky left-0 z-10">
                    节次
                  </th>
                  {[1, 2, 3, 4, 5].map((day) => (
                    <th
                      key={day}
                      className="bg-slate-100 border-b border-r p-2 text-center text-sm font-semibold text-slate-700 min-w-[140px]"
                    >
                      {DAY_NAMES[day - 1]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {periodList.map((period: any) => {
                  // 午间分隔
                  const showMorningBreak = period.periodNo === 5;
                  const showEveningBreak = period.periodNo === 9;
                  
                  return (
                    <Fragment key={period.periodNo}>
                      {showMorningBreak && (
                        <tr key="break-noon">
                          <td colSpan={6} className="bg-amber-50/60 text-center text-xs text-amber-600 py-1.5 border-b font-medium">
                            — 午 休 —
                          </td>
                        </tr>
                      )}
                      {showEveningBreak && (
                        <tr key="break-evening">
                          <td colSpan={6} className="bg-indigo-50/60 text-center text-xs text-indigo-600 py-1.5 border-b font-medium">
                            — 晚 间 —
                          </td>
                        </tr>
                      )}
                      <tr key={period.periodNo}>
                        {/* 节次标签 */}
                        <td className="border-b border-r p-2 bg-slate-50 sticky left-0 z-10">
                          <div className="text-center">
                            <div className="text-xs font-medium text-slate-700">{period.periodName}</div>
                            {period.startTime && (
                              <div className="text-[10px] text-slate-400 mt-0.5">
                                {period.startTime}-{period.endTime}
                              </div>
                            )}
                          </div>
                        </td>
                        {/* 周一到周五 */}
                        {[1, 2, 3, 4, 5].map((day) => {
                          const cellKey = `${day}-${period.periodNo}`;

                          // ═══ 单实验室模式：rowSpan 合并 ═══
                          if (isSingleLab) {
                            if (spanData.hidden.has(cellKey)) return null;
                            const spanInfo = spanData.spans[cellKey];
                            if (spanInfo) {
                              const { schedule: s, rowSpan } = spanInfo;
                              const color = courseColorMap.get(s.courseId) || COURSE_COLORS[0];
                              return (
                                <td key={cellKey} rowSpan={rowSpan} className="border-b border-r p-1 align-top">
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <div className={cn("rounded-lg border p-2 h-full cursor-pointer transition-all hover:shadow-md", color.bg, color.border)}>
                                        <div className={cn("font-semibold text-xs leading-tight line-clamp-2", color.text)}>{s.courseName}</div>
                                        <div className="text-[10px] text-slate-500 mt-1 space-y-0.5">
                                          <div>{s.teacherName}</div>
                                          <div>{s.labName || s.labRoomNo}</div>
                                          {s.startWeek && s.endWeek && (
                                            <div className="text-slate-400">
                                              {s.startWeek}-{s.endWeek}周{s.weekType === "odd" ? " (单)" : s.weekType === "even" ? " (双)" : ""}
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    </TooltipTrigger>
                                    <TooltipContent side="right" className="max-w-xs">
                                      <div className="space-y-1 text-sm">
                                        <p className="font-bold">{s.courseName} ({s.courseNo})</p>
                                        <p>教师：{s.teacherName}</p>
                                        <p>实验室：{s.labName} ({s.labRoomNo})</p>
                                        <p>节次：第{s.startPeriod}-{s.endPeriod}节</p>
                                        <p>周次：{s.startWeek}-{s.endWeek}周</p>
                                      </div>
                                    </TooltipContent>
                                  </Tooltip>
                                </td>
                              );
                            }
                            return <td key={cellKey} className="border-b border-r p-1 h-[60px]" />;
                          }

                          // ═══ 全部实验室模式：堆叠展示所有实验室 ═══
                          const cellItems = gridData[cellKey] || [];
                          // 去重（同一个 schedule 只展示一次，取 startPeriod 的）
                          const uniqueItems: any[] = [];
                          const seenIds = new Set<number>();
                          for (const s of cellItems) {
                            if (seenIds.has(s.id)) continue;
                            seenIds.add(s.id);
                            uniqueItems.push(s);
                          }

                          if (uniqueItems.length === 0) {
                            return <td key={cellKey} className="border-b border-r p-1 h-[60px]" />;
                          }

                          // 判断这个格子是否是某课程的"延续"部分（非起始节次）
                          const isStart = (s: any) => s.startPeriod === period.periodNo;
                          const startItems = uniqueItems.filter(isStart);
                          const continuedItems = uniqueItems.filter(s => !isStart(s));

                          return (
                            <td key={cellKey} className="border-b border-r p-0.5 align-top">
                              <div className="flex flex-col gap-0.5 h-full">
                                {startItems.map((s: any) => {
                                  const color = courseColorMap.get(s.courseId) || COURSE_COLORS[0];
                                  const span = s.endPeriod - s.startPeriod + 1;
                                  return (
                                    <Tooltip key={s.id}>
                                      <TooltipTrigger asChild>
                                        <div className={cn(
                                          "rounded-md border px-1.5 py-1 cursor-pointer transition-all hover:shadow-md",
                                          color.bg, color.border
                                        )}>
                                          <div className={cn("font-semibold text-[11px] leading-tight truncate", color.text)}>
                                            {s.courseName}
                                            <span className="font-normal text-slate-500 ml-0.5">({s.teacherName})</span>
                                          </div>
                                          <div className="text-[10px] text-slate-500 truncate">
                                            {s.labName || s.labRoomNo}
                                            {span > 1 && <span className="text-slate-400 ml-1">({span}节)</span>}
                                          </div>
                                        </div>
                                      </TooltipTrigger>
                                      <TooltipContent side="right" className="max-w-xs">
                                        <div className="space-y-1 text-sm">
                                          <p className="font-bold">{s.courseName} ({s.courseNo})</p>
                                          <p>教师：{s.teacherName}</p>
                                          <p>实验室：{s.labName} ({s.labRoomNo})</p>
                                          <p>节次：第{s.startPeriod}-{s.endPeriod}节</p>
                                          <p>周次：{s.startWeek}-{s.endWeek}周</p>
                                        </div>
                                      </TooltipContent>
                                    </Tooltip>
                                  );
                                })}
                                {/* 延续的课程用细条显示 */}
                                {continuedItems.map((s: any) => {
                                  const color = courseColorMap.get(s.courseId) || COURSE_COLORS[0];
                                  return (
                                    <div key={`cont-${s.id}`} className={cn(
                                      "rounded-sm border px-1.5 py-0.5 text-[10px] truncate",
                                      color.bg, color.border, color.text, "opacity-60"
                                    )}>
                                      {s.courseName}({s.teacherName}) · {s.labName}
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

      {/* 底部图例 */}
      <div className="flex items-start gap-4 flex-wrap bg-white rounded-xl border p-4">
        <div className="flex items-center gap-1.5 text-sm text-slate-600">
          <Info className="h-4 w-4" /> 课程图例：
        </div>
        <div className="flex flex-wrap gap-2">
          {Array.from(courseColorMap.entries()).map(([courseId, color]) => {
            const schedule = schedules.find((s: any) => s.courseId === courseId);
            if (!schedule) return null;
            return (
              <Badge
                key={courseId}
                variant="outline"
                className={cn("text-xs gap-1", color.bg, color.border, color.text)}
              >
                <span className={cn("inline-block w-2 h-2 rounded-full", color.header)} />
                {(schedule as any).courseName}（{(schedule as any).teacherName}）
              </Badge>
            );
          })}
        </div>
        <div className="ml-auto text-xs text-slate-400">
          本周共 {weekSchedules.length} 节课
        </div>
      </div>
    </div>
  );
}
