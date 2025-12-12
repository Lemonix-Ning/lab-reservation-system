import React, { useState, useEffect, useMemo } from "react";
import {
  Settings,
  Save,
  RefreshCw,
  GitCommit,
  ArrowRight,
  CheckCircle2,
  Clock,
  AlertCircle,
  Building2,
  Globe,
  LayoutTemplate,
  RotateCcw,
  CalendarClock
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

// --- Helper Utilities ---
const cn = (...classes: (string | undefined | null | false)[]) => classes.filter(Boolean).join(' ');

// --- Visual Components ---
const ApprovalFlowVisualizer = ({ stages }: { stages: number }) => {
  return (
    <div className="flex items-center gap-2 w-full overflow-x-auto py-4 px-2">
      {/* Start Node */}
      <div className="flex flex-col items-center gap-2 min-w-[80px]">
        <div className="h-10 w-10 rounded-full bg-slate-100 border-2 border-slate-200 flex items-center justify-center text-slate-500">
          <Clock className="h-5 w-5" />
        </div>
        <span className="text-xs font-medium text-slate-500">提交申请</span>
      </div>

      {/* Dynamic Stages */}
      {stages === 0 ? (
        <>
          <ArrowRight className="h-5 w-5 text-emerald-400 shrink-0" />
          <div className="flex flex-col items-center gap-2 min-w-[80px]">
            <div className="h-10 w-10 rounded-full bg-emerald-50 border-2 border-emerald-200 flex items-center justify-center text-emerald-600 shadow-sm">
               <CheckCircle2 className="h-5 w-5" />
            </div>
            <span className="text-xs font-medium text-emerald-600">自动通过</span>
          </div>
        </>
      ) : (
        Array.from({ length: stages }).map((_, idx) => (
          <React.Fragment key={idx}>
            <ArrowRight className="h-5 w-5 text-slate-300 shrink-0" />
            <div className="flex flex-col items-center gap-2 min-w-[80px]">
              <div className="h-10 w-10 rounded-full bg-white border-2 border-indigo-200 flex items-center justify-center text-indigo-600 shadow-sm relative group cursor-help">
                <span className="font-bold">{idx + 1}</span>
                <span className="absolute -top-1 -right-1 flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-indigo-500"></span>
                </span>
              </div>
              <span className="text-xs font-medium text-slate-700">{`第 ${idx + 1} 级`}</span>
            </div>
          </React.Fragment>
        ))
      )}

      {/* End Node */}
      {stages > 0 && (
        <>
          <ArrowRight className="h-5 w-5 text-slate-300 shrink-0" />
          <div className="flex flex-col items-center gap-2 min-w-[80px]">
            <div className="h-10 w-10 rounded-full bg-emerald-50 border-2 border-emerald-200 flex items-center justify-center text-emerald-600 shadow-sm">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <span className="text-xs font-medium text-emerald-600">流程结束</span>
          </div>
        </>
      )}
    </div>
  );
};

export default function ApprovalConfigPage() {
  const [selectedLabId, setSelectedLabId] = useState<number | null>(null);
  const [isGlobal, setIsGlobal] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const { data: labs = [] } = trpc.labRoom.list.useQuery();
  // Ensure hook is called with a stable dependency or handles changes correctly
  const { data: config, isLoading, refetch } = trpc.approval.getConfigForLab.useQuery({ 
    labId: selectedLabId ?? 1 
  });

  const DEFAULT_CONFIG = useMemo(() => ({
    name: "",
    enableMultiLevel: 1,
    approvalStages: "[]",
    rescheduleWindowHours: 24,
    maxRescheduleCount: 2,
    autoCancelHours: 1,
  }), []);

  const [formData, setFormData] = useState(DEFAULT_CONFIG);

  // Sync form data with fetched config
  useEffect(() => {
    if (config) {
      // Fix: Add a check to prevent unnecessary state updates if data hasn't changed
      // This breaks the potential infinite loop if the object reference is unstable
      setFormData(prev => {
        const configData = {
          name: config.name || "",
          enableMultiLevel: config.enableMultiLevel || 1,
          approvalStages: config.approvalStages || "[]",
          rescheduleWindowHours: config.rescheduleWindowHours ?? 24,
          maxRescheduleCount: config.maxRescheduleCount ?? 2,
          autoCancelHours: Number(config.autoCancelHours) || 1,
        };
        if (JSON.stringify(prev) !== JSON.stringify(configData)) {
          return configData;
        }
        return prev;
      });
    }
  }, [config]);

  const updateConfig = trpc.approval.updateConfig.useMutation({
    onSuccess: () => {
      setIsSaving(false);
      toast.success("保存成功 - 审批配置已更新");
      refetch();
    },
    onError: (error: any) => {
      setIsSaving(false);
      toast.error(`保存失败 - ${error.message}`);
    }
  });

  const handleSave = () => {
    setIsSaving(true);
    updateConfig.mutate({
      labId: isGlobal ? null : (selectedLabId ?? null),
      ...formData,
    } as any);
  };

  return (
    <div className="min-h-screen bg-slate-50/50 p-6 space-y-8 font-sans text-slate-900">
      
      {/* 1. Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Settings className="h-6 w-6 text-indigo-600" />
            审批配置管理
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            自定义预约审批流程、调整规则及自动化设置。
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2 bg-white">
            <RefreshCw className="h-4 w-4" />
            重置更改
          </Button>
          <Button onClick={handleSave} disabled={isSaving} className="gap-2">
            {isSaving ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            保存配置
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        
        {/* Left Column: Scope & Approval Flow */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* 2. Configuration Scope */}
          <Card className={cn("transition-all duration-300", isGlobal ? "border-indigo-200 shadow-indigo-50" : "border-slate-200")}>
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <h3 className="font-semibold text-lg flex items-center gap-2">
                    <Globe className={cn("h-5 w-5", isGlobal ? "text-indigo-600" : "text-slate-400")} />
                    配置生效范围
                  </h3>
                  <p className="text-sm text-slate-500">
                    选择配置是应用于所有实验室还是特定房间
                  </p>
                </div>
                <div className="flex items-center gap-3 bg-slate-50 p-1.5 rounded-lg border">
                  <button 
                    onClick={() => { setIsGlobal(true); setSelectedLabId(null); }}
                    className={cn(
                      "px-3 py-1.5 text-sm font-medium rounded-md transition-all",
                      isGlobal ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-900"
                    )}
                  >
                    全局默认
                  </button>
                  <button 
                    onClick={() => { setIsGlobal(false); if(!selectedLabId) setSelectedLabId(labs[0]?.id); }}
                    className={cn(
                      "px-3 py-1.5 text-sm font-medium rounded-md transition-all",
                      !isGlobal ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-900"
                    )}
                  >
                    特定实验室
                  </button>
                </div>
              </div>
            </CardHeader>
            
            {!isGlobal && (
              <CardContent className="pt-0 border-t border-slate-100/50">
                 <div className="mt-4 animate-in slide-in-from-top-2 duration-200">
                   <Label className="mb-2 block">选择目标实验室</Label>
                   <div className="relative">
                      <select 
                        className="w-full h-10 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        value={selectedLabId || ""}
                        onChange={(e) => setSelectedLabId(Number(e.target.value))}
                      >
                        {labs.map((lab: any) => (
                          <option key={lab.id} value={lab.id}>{lab.roomNo} - {lab.name}</option>
                        ))}
                      </select>
                      <Building2 className="absolute right-3 top-2.5 h-5 w-5 text-slate-400 pointer-events-none" />
                   </div>
                 </div>
              </CardContent>
            )}
          </Card>

          {/* 3. Approval Flow Config */}
          <Card>
            <CardHeader>
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <GitCommit className="h-5 w-5 text-slate-600" />
                审批流程设计
              </h3>
              <p className="text-sm text-slate-500">定义预约申请需要经过的审核节点</p>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                 <div className="space-y-2">
                    <Label>审批层级数</Label>
                    <input 
                      type="number" 
                      min={0} 
                      max={3} 
                      value={formData.enableMultiLevel}
                      onChange={(e: any) => setFormData({...formData, enableMultiLevel: Math.min(3, Math.max(0, Number(e.target.value)))})}
                      onWheel={(e: any) => {
                        e.preventDefault();
                        e.currentTarget.blur();
                      }}
                      className="w-full h-10 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-mono text-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                 </div>
                 <div className="text-xs text-slate-500 space-y-1 bg-slate-50 p-3 rounded-lg border border-slate-100">
                    <p className="flex items-center gap-2"><span className="w-4 text-center font-bold">0</span> 自动通过（无审批节点）</p>
                    <p className="flex items-center gap-2"><span className="w-4 text-center font-bold">1</span> 单级审批（实验室管理员）</p>
                    <p className="flex items-center gap-2"><span className="w-4 text-center font-bold">2</span> 两级审批（教师/院系 → 管理员）</p>
                    <p className="flex items-center gap-2"><span className="w-4 text-center font-bold">3</span> 三级审批（教师 → 院系 → 管理员）</p>
                 </div>

                 {/* Visualizer */}
                 <div className="bg-slate-50 rounded-xl border border-dashed border-slate-200 p-4 space-y-3">
                    <Label className="block text-slate-400 text-xs uppercase tracking-wider">流程预览</Label>
                    <ApprovalFlowVisualizer stages={formData.enableMultiLevel} />
                 </div>
              </div>
              
              {/* 课程预约特殊说明 */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2 mt-4">
                <h4 className="text-xs font-semibold text-blue-900 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  课程预约特殊说明
                </h4>
                <p className="text-xs text-blue-800 leading-relaxed">
                  对于教师发起的<strong>课程预约</strong>：教师作为发起人，其"同意"已隐含在发起预约的动作中。
                  因此，实际审批流程从配置的<strong>第一级</strong>开始。
                </p>
                <p className="text-xs text-blue-700 bg-blue-100 px-3 py-2 rounded border border-blue-200">
                  示例：如配置为"两级审批（教师 → 管理员）"，课程预约将直接进入"管理员审批"阶段。
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Rules */}
        <div className="space-y-6">
          
          {/* 4. Reschedule Rules */}
          <Card>
             <CardHeader className="pb-4">
               <h3 className="font-semibold text-lg flex items-center gap-2">
                 <CalendarClock className="h-5 w-5 text-slate-600" />
                 调度规则
               </h3>
             </CardHeader>
             <CardContent className="space-y-5">
               <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <Label>最大修改次数</Label>
                    <span className="text-xs font-mono bg-slate-100 px-2 py-0.5 rounded text-slate-600">{formData.maxRescheduleCount} 次</span>
                  </div>
                  <input 
                    type="range" 
                    min="0" 
                    max="5" 
                    step="1"
                    value={formData.maxRescheduleCount}
                    onChange={(e) => setFormData({...formData, maxRescheduleCount: Number(e.target.value)})}
                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                  />
                  <p className="text-xs text-slate-400">允许学生修改预约时间或实验室的次数限制。</p>
               </div>

               <div className="space-y-2 pt-2 border-t border-slate-100">
                  <Label>修改截止窗口 (小时)</Label>
                  <div className="relative">
                    <Input 
                      type="number" 
                      min={0}
                      value={formData.rescheduleWindowHours}
                      onChange={(e: any) => setFormData({...formData, rescheduleWindowHours: Number(e.target.value)})}
                      className="pr-12"
                    />
                    <span className="absolute right-3 top-2.5 text-xs text-slate-400">小时前</span>
                  </div>
                  <p className="text-xs text-slate-400">预约开始前多少小时内禁止修改。</p>
               </div>
             </CardContent>
          </Card>

          {/* 5. Automation Rules */}
          <Card>
             <CardHeader className="pb-4">
               <h3 className="font-semibold text-lg flex items-center gap-2">
                 <RotateCcw className="h-5 w-5 text-slate-600" />
                 自动化
               </h3>
             </CardHeader>
             <CardContent className="space-y-5">
               <div className="space-y-3">
                  <div className="flex items-center justify-between">
                     <Label>超时未签到自动取消</Label>
                     <Switch 
                       checked={formData.autoCancelHours > 0} 
                       onCheckedChange={(c: boolean) => setFormData({...formData, autoCancelHours: c ? 1 : 0})}
                     />
                  </div>
                  
                  {formData.autoCancelHours > 0 && (
                    <div className="bg-amber-50 p-3 rounded-lg border border-amber-100 animate-in fade-in slide-in-from-top-1">
                      <div className="flex items-center gap-2 mb-2">
                        <AlertCircle className="h-4 w-4 text-amber-600" />
                        <span className="text-xs font-semibold text-amber-700">配置超时时间</span>
                      </div>
                      <div className="relative">
                        <Input 
                           type="number" 
                           min={0.5}
                           step={0.5}
                           value={formData.autoCancelHours}
                           onChange={(e: any) => setFormData({...formData, autoCancelHours: Number(e.target.value)})}
                           className="bg-white border-amber-200 focus:ring-amber-500 pr-12 h-8 text-xs"
                        />
                        <span className="absolute right-3 top-2 text-xs text-slate-400">小时</span>
                      </div>
                    </div>
                  )}
               </div>
               
               <div className="bg-indigo-50 rounded-lg p-3">
                  <h4 className="text-xs font-bold text-indigo-800 mb-1 flex items-center gap-1">
                    <LayoutTemplate className="h-3 w-3" />
                    配置摘要
                  </h4>
                  <p className="text-[10px] text-indigo-600 leading-relaxed">
                    当前规则适用于 {isGlobal ? "所有未单独配置的实验室" : `实验室 #${selectedLabId}`}。
                    审批流程共 {formData.enableMultiLevel} 级{formData.autoCancelHours > 0 ? `，超时 ${formData.autoCancelHours} 小时自动取消` : ""}。
                  </p>
               </div>
             </CardContent>
          </Card>

        </div>
      </div>
    </div>
  );
}
