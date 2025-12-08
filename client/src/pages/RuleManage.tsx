import { useAuth } from "@/_core/hooks/useAuth";
import { useRole } from "@/contexts/RoleContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { trpc } from "@/lib/trpc";
import { FlaskConical } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Link, useLocation } from "wouter";

export default function RuleManage() {
  const { user } = useAuth();
  const { isLabAdmin, isSysAdmin } = useRole();
  const [, setLocation] = useLocation();
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedRule, setSelectedRule] = useState<any>(null);
  const [ruleValue, setRuleValue] = useState("");
  const [ruleStatus, setRuleStatus] = useState<"enabled" | "disabled">("enabled");

  const { data: rules, isLoading } = trpc.rule.list.useQuery();
  const utils = trpc.useUtils();

  const updateMutation = trpc.rule.update.useMutation({
    onSuccess: () => {
      toast.success("规则更新成功");
      utils.rule.list.invalidate();
      setEditDialogOpen(false);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  if (!isLabAdmin && !isSysAdmin) {
    setLocation('/');
    return null;
  }

  const handleEdit = (rule: any) => {
    setSelectedRule(rule);
    setRuleValue(rule.ruleValue);
    setRuleStatus(rule.status);
    setEditDialogOpen(true);
  };

  const handleUpdate = () => {
    if (!selectedRule) return;
    updateMutation.mutate({
      id: selectedRule.id,
      ruleValue,
      status: ruleStatus,
    });
  };

  return (
    <div className="bg-gray-50">
      <main className="container py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">预约规则配置</h2>
          <p className="text-gray-600">管理系统预约规则和限制</p>
        </div>

        {isLoading ? (
          <div className="text-center py-12">加载中...</div>
        ) : (
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>规则编码</TableHead>
                    <TableHead>规则名称</TableHead>
                    <TableHead>规则值</TableHead>
                    <TableHead>说明</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rules?.map((rule) => (
                    <TableRow key={rule.id}>
                      <TableCell className="font-mono text-sm">{rule.ruleCode}</TableCell>
                      <TableCell>{rule.ruleName}</TableCell>
                      <TableCell className="font-semibold">{rule.ruleValue}</TableCell>
                      <TableCell className="text-sm text-gray-600">{rule.description}</TableCell>
                      <TableCell>
                        <span className={rule.status === 'enabled' ? 'text-green-600' : 'text-gray-600'}>
                          {rule.status === 'enabled' ? '启用' : '停用'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Button size="sm" variant="outline" onClick={() => handleEdit(rule)}>
                          编辑
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="font-semibold text-blue-900 mb-2">规则说明</h3>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• <strong>MAX_PER_DAY</strong>: 每位学生每日最多可预约的次数</li>
            <li>• <strong>MAX_DURATION</strong>: 单次预约的最长时长（小时）</li>
            <li>• <strong>ADVANCE_DAYS</strong>: 必须提前预约的天数</li>
          </ul>
        </div>
      </main>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>编辑规则</DialogTitle>
            <DialogDescription>
              {selectedRule?.ruleName} ({selectedRule?.ruleCode})
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>规则值</Label>
              <Input
                type="text"
                value={ruleValue}
                onChange={(e) => setRuleValue(e.target.value)}
                placeholder="输入规则值"
              />
              <p className="text-xs text-gray-500 mt-1">{selectedRule?.description}</p>
            </div>
            <div>
              <Label>状态</Label>
              <Select value={ruleStatus} onValueChange={(value: "enabled" | "disabled") => setRuleStatus(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="enabled">启用</SelectItem>
                  <SelectItem value="disabled">停用</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleUpdate} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? '保存中...' : '保存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
