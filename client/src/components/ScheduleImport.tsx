import { useCallback, useRef, useState } from "react";
import { Upload, Download, FileSpreadsheet, CheckCircle2, XCircle, AlertTriangle, Loader2 } from "lucide-react";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

const DAY_MAP: Record<string, number> = {
  "周一": 1, "星期一": 1, "Monday": 1, "Mon": 1, "1": 1,
  "周二": 2, "星期二": 2, "Tuesday": 2, "Tue": 2, "2": 2,
  "周三": 3, "星期三": 3, "Wednesday": 3, "Wed": 3, "3": 3,
  "周四": 4, "星期四": 4, "Thursday": 4, "Thu": 4, "4": 4,
  "周五": 5, "星期五": 5, "Friday": 5, "Fri": 5, "5": 5,
  "周六": 6, "星期六": 6, "Saturday": 6, "Sat": 6, "6": 6,
  "周日": 7, "星期日": 7, "Sunday": 7, "Sun": 7, "7": 7,
};

interface ParsedRow {
  rowIndex: number;
  courseName: string;
  courseNo: string;
  teacherName: string;
  labRoomNo: string;
  dayOfWeek: number;
  startPeriod: number;
  endPeriod: number;
  weekStart: number;
  weekEnd: number;
  weekType: "all" | "odd" | "even";
  error?: string;
}

interface ImportResult {
  row: number;
  success: boolean;
  message: string;
}

function parseDay(val: any): number | null {
  if (!val) return null;
  const s = String(val).trim();
  if (DAY_MAP[s]) return DAY_MAP[s];
  const n = parseInt(s);
  return n >= 1 && n <= 7 ? n : null;
}

function parseWeekType(val: any): "all" | "odd" | "even" {
  if (!val) return "all";
  const s = String(val).trim();
  if (s === "单" || s === "odd" || s === "单周") return "odd";
  if (s === "双" || s === "even" || s === "双周") return "even";
  return "all";
}

function generateTemplate() {
  const wsData = [
    ["课程名称", "课程编号", "教师姓名", "实验室编号", "星期", "开始节次", "结束节次", "起始周", "结束周", "周类型"],
    ["数据结构与算法实验", "CS201", "王教授", "A203", "周一", 3, 4, 1, 18, "全"],
    ["计算机网络实验", "CS302", "刘老师", "B105", "周三", 1, 2, 1, 18, "全"],
    ["机器学习实验", "AI401", "陈教授", "B208", "周五", 1, 2, 1, 16, "单"],
  ];
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  ws["!cols"] = [
    { wch: 22 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 8 },
    { wch: 10 }, { wch: 10 }, { wch: 8 }, { wch: 8 }, { wch: 8 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "排课导入模板");
  XLSX.writeFile(wb, "排课导入模板.xlsx");
}

export default function ScheduleImport({ onSuccess }: { onSuccess?: () => void }) {
  const [open, setOpen] = useState(false);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [autoApprove, setAutoApprove] = useState(true);
  const [importResults, setImportResults] = useState<ImportResult[] | null>(null);
  const [step, setStep] = useState<"upload" | "preview" | "result">("upload");
  const fileRef = useRef<HTMLInputElement>(null);

  const batchImport = trpc.classCheckin.batchImportSchedules.useMutation({
    onSuccess: (data) => {
      setImportResults(data.results);
      setStep("result");
      if (data.successCount > 0) {
        toast.success(`成功导入 ${data.successCount}/${data.totalCount} 条排课`);
        onSuccess?.();
      } else {
        toast.error("所有记录导入失败，请检查数据");
      }
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const reset = useCallback(() => {
    setParsedRows([]);
    setFileName("");
    setImportResults(null);
    setStep("upload");
    if (fileRef.current) fileRef.current.value = "";
  }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setImportResults(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json<any>(ws, { defval: "" });

        const rows: ParsedRow[] = jsonData.map((row: any, idx: number) => {
          const courseName = String(row["课程名称"] || row["courseName"] || row["课程名"] || "").trim();
          const courseNo = String(row["课程编号"] || row["courseNo"] || row["课程"] || "").trim();
          const teacherName = String(row["教师姓名"] || row["teacherName"] || row["教师"] || row["老师"] || "").trim();
          const labRoomNo = String(row["实验室编号"] || row["labRoomNo"] || row["实验室"] || row["教室"] || "").trim();
          const dayOfWeek = parseDay(row["星期"] || row["dayOfWeek"] || row["周几"]);
          const startPeriod = parseInt(row["开始节次"] || row["startPeriod"] || row["起始节"] || "0");
          const endPeriod = parseInt(row["结束节次"] || row["endPeriod"] || row["结束节"] || "0");
          const weekStart = parseInt(row["起始周"] || row["weekStart"] || row["开始周"] || "1") || 1;
          const weekEnd = parseInt(row["结束周"] || row["weekEnd"] || "18") || 18;
          const weekType = parseWeekType(row["周类型"] || row["weekType"] || row["单双周"]);

          let error = "";
          if (!courseNo) error = "缺少课程编号";
          else if (!labRoomNo) error = "缺少实验室编号";
          else if (!dayOfWeek) error = "星期格式错误";
          else if (!startPeriod || startPeriod < 1 || startPeriod > 12) error = "节次范围错误";
          else if (!endPeriod || endPeriod < 1 || endPeriod > 12) error = "节次范围错误";
          else if (startPeriod > endPeriod) error = "开始节次不能大于结束节次";

          return {
            rowIndex: idx + 2,
            courseName,
            courseNo,
            teacherName,
            labRoomNo,
            dayOfWeek: dayOfWeek || 0,
            startPeriod,
            endPeriod,
            weekStart,
            weekEnd,
            weekType,
            error,
          };
        });

        setParsedRows(rows);
        setStep("preview");
      } catch (err) {
        toast.error("文件解析失败，请确认格式正确");
      }
    };
    reader.readAsArrayBuffer(file);
  }, []);

  const handleImport = () => {
    const validRows = parsedRows.filter(r => !r.error);
    if (validRows.length === 0) {
      toast.error("没有可导入的有效数据");
      return;
    }
    batchImport.mutate({
      rows: validRows.map(r => ({
        courseName: r.courseName,
        courseNo: r.courseNo,
        teacherName: r.teacherName,
        labRoomNo: r.labRoomNo,
        dayOfWeek: r.dayOfWeek,
        startPeriod: r.startPeriod,
        endPeriod: r.endPeriod,
        weekStart: r.weekStart,
        weekEnd: r.weekEnd,
        weekType: r.weekType,
      })),
      autoApprove,
    });
  };

  const errorCount = parsedRows.filter(r => r.error).length;
  const validCount = parsedRows.length - errorCount;
  const DAY_NAMES = ["", "周一", "周二", "周三", "周四", "周五", "周六", "周日"];

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Upload className="h-4 w-4" /> Excel 导入排课
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <FileSpreadsheet className="h-5 w-5 text-green-600" />
            批量导入排课
          </DialogTitle>
          <DialogDescription>
            上传 Excel 文件批量导入排课数据，系统将自动检查冲突
          </DialogDescription>
        </DialogHeader>

        {step === "upload" && (
          <div className="space-y-4 py-4">
            <div
              className="border-2 border-dashed rounded-xl p-8 text-center hover:border-blue-400 hover:bg-blue-50/50 transition-colors cursor-pointer"
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="h-10 w-10 mx-auto text-slate-400 mb-3" />
              <p className="text-sm text-slate-600 font-medium">点击或拖拽上传 Excel 文件</p>
              <p className="text-xs text-slate-400 mt-1">支持 .xlsx、.xls、.csv 格式</p>
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>

            <div className="flex items-center justify-between">
              <Button variant="ghost" size="sm" className="text-blue-600 gap-1.5" onClick={generateTemplate}>
                <Download className="h-4 w-4" /> 下载导入模板
              </Button>
              <div className="text-xs text-slate-400">
                必填列：课程编号、实验室编号、星期、开始节次、结束节次；建议填写：课程名称、教师姓名
              </div>
            </div>
          </div>
        )}

        {step === "preview" && (
          <div className="space-y-3 flex-1 min-h-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 text-sm">
                <span className="text-slate-500">文件：{fileName}</span>
                <Badge variant="outline">{parsedRows.length} 行</Badge>
                {errorCount > 0 && (
                  <Badge variant="destructive" className="gap-1">
                    <XCircle className="h-3 w-3" /> {errorCount} 行有错误
                  </Badge>
                )}
                <Badge className="gap-1 bg-green-100 text-green-700 border-green-300" variant="outline">
                  <CheckCircle2 className="h-3 w-3" /> {validCount} 行可导入
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <Switch id="auto-approve" checked={autoApprove} onCheckedChange={setAutoApprove} />
                <Label htmlFor="auto-approve" className="text-sm">自动审批</Label>
              </div>
            </div>

            <ScrollArea className="h-[340px] border rounded-lg">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-slate-50 z-10">
                  <tr className="border-b">
                    <th className="p-2 text-left w-10">#</th>
                    <th className="p-2 text-left">课程名称</th>
                    <th className="p-2 text-left">课程编号</th>
                    <th className="p-2 text-left">教师</th>
                    <th className="p-2 text-left">实验室</th>
                    <th className="p-2 text-left">星期</th>
                    <th className="p-2 text-left">节次</th>
                    <th className="p-2 text-left">周次</th>
                    <th className="p-2 text-left">状态</th>
                  </tr>
                </thead>
                <tbody>
                  {parsedRows.map((row) => (
                    <tr
                      key={row.rowIndex}
                      className={cn(
                        "border-b",
                        row.error ? "bg-red-50" : "hover:bg-slate-50"
                      )}
                    >
                      <td className="p-2 text-slate-400">{row.rowIndex}</td>
                      <td className="p-2 text-xs">{row.courseName || <span className="text-slate-400">-</span>}</td>
                      <td className="p-2 font-mono text-xs">{row.courseNo}</td>
                      <td className="p-2 text-xs">{row.teacherName || <span className="text-slate-400">-</span>}</td>
                      <td className="p-2 font-mono text-xs">{row.labRoomNo}</td>
                      <td className="p-2">{DAY_NAMES[row.dayOfWeek] || "-"}</td>
                      <td className="p-2">{row.startPeriod}-{row.endPeriod}节</td>
                      <td className="p-2">
                        {row.weekStart}-{row.weekEnd}周
                        {row.weekType !== "all" && (
                          <span className="text-xs text-slate-400 ml-1">
                            ({row.weekType === "odd" ? "单" : "双"})
                          </span>
                        )}
                      </td>
                      <td className="p-2">
                        {row.error ? (
                          <span className="text-red-600 text-xs flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3" /> {row.error}
                          </span>
                        ) : (
                          <span className="text-green-600 text-xs">有效</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollArea>

            <DialogFooter className="gap-2">
              <Button variant="ghost" onClick={reset}>重新选择</Button>
              <Button
                onClick={handleImport}
                disabled={validCount === 0 || batchImport.isPending}
                className="gap-2"
              >
                {batchImport.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                导入 {validCount} 条排课
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === "result" && importResults && (
          <div className="space-y-3 flex-1 min-h-0">
            <div className="flex items-center gap-3 text-sm">
              <Badge className="gap-1 bg-green-100 text-green-700 border-green-300" variant="outline">
                <CheckCircle2 className="h-3 w-3" /> {importResults.filter(r => r.success).length} 成功
              </Badge>
              {importResults.filter(r => !r.success).length > 0 && (
                <Badge variant="destructive" className="gap-1">
                  <XCircle className="h-3 w-3" /> {importResults.filter(r => !r.success).length} 失败
                </Badge>
              )}
            </div>

            <ScrollArea className="h-[340px] border rounded-lg">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-slate-50 z-10">
                  <tr className="border-b">
                    <th className="p-2 text-left w-10">行</th>
                    <th className="p-2 text-left">状态</th>
                    <th className="p-2 text-left">信息</th>
                  </tr>
                </thead>
                <tbody>
                  {importResults.map((r) => (
                    <tr key={r.row} className={cn("border-b", !r.success && "bg-red-50")}>
                      <td className="p-2 text-slate-400">{r.row}</td>
                      <td className="p-2">
                        {r.success ? (
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-500" />
                        )}
                      </td>
                      <td className="p-2 text-xs">{r.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollArea>

            <DialogFooter>
              <Button variant="ghost" onClick={reset}>继续导入</Button>
              <Button onClick={() => { setOpen(false); reset(); }}>完成</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
