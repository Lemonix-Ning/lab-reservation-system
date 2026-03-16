import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertTriangle, Trash2 } from "lucide-react";
import { toast } from "sonner";
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

export default function AccountDelete() {
  const { user, logout } = useAuth();
  const [confirmText, setConfirmText] = useState("");
  const [understood, setUnderstood] = useState(false);
  const [showDialog, setShowDialog] = useState(false);

  const deleteMutation = trpc.user.deleteMyAccount.useMutation({
    onSuccess: async () => {
      toast.success("账号已注销");
      // 等待一下让用户看到提示
      await new Promise((resolve) => setTimeout(resolve, 1000));
      // 注销并重定向到登录页
      await logout();
    },
    onError: (error) => {
      toast.error(`注销失败: ${error.message}`);
    },
  });

  const handleDelete = () => {
    deleteMutation.mutate();
    setShowDialog(false);
  };

  const canDelete = confirmText === "删除我的账号" && understood;

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
          <p className="mt-4 text-gray-600">加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container max-w-4xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-red-600">注销账号</h1>
        <p className="text-gray-600 mt-2">永久删除您的账号和所有数据</p>
      </div>

      <Card className="border-red-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="h-5 w-5" />
            危险操作
          </CardTitle>
          <CardDescription>
            注销账号后，您的所有数据将被永久删除且无法恢复
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg space-y-3">
            <h3 className="font-semibold text-red-800">注销账号将会：</h3>
            <ul className="list-disc list-inside space-y-2 text-sm text-red-700">
              <li>永久删除您的个人信息</li>
              <li>删除所有预约记录</li>
              <li>删除所有课程和班级数据（如果您是教师）</li>
              <li>解除所有 OAuth 账号绑定</li>
              <li>清除所有审计日志中的关联</li>
              <li>此操作不可撤销</li>
            </ul>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="confirm">
                请输入 <code className="px-2 py-1 bg-gray-100 rounded text-red-600">删除我的账号</code> 以确认
              </Label>
              <Input
                id="confirm"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="删除我的账号"
                className="border-red-200 focus:border-red-400"
              />
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="understood"
                checked={understood}
                onCheckedChange={(checked) => setUnderstood(checked as boolean)}
              />
              <label
                htmlFor="understood"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                我理解此操作不可撤销，并愿意承担所有后果
              </label>
            </div>
          </div>

          <div className="flex gap-4">
            <Button
              variant="outline"
              onClick={() => window.history.back()}
              className="flex-1"
            >
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={() => setShowDialog(true)}
              disabled={!canDelete || deleteMutation.isPending}
              className="flex-1"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              {deleteMutation.isPending ? "注销中..." : "注销账号"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={showDialog} onOpenChange={setShowDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-600">最后确认</AlertDialogTitle>
            <AlertDialogDescription>
              您确定要永久删除账号吗？此操作无法撤销。
              <br />
              <br />
              账号：<strong>{user.name || user.email || user.openId}</strong>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>我再想想</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              确认注销
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
