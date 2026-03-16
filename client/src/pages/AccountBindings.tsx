import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Github, MessageCircle, School, Link2, Unlink, AlertCircle } from "lucide-react";
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

type OAuthProvider = "github" | "qq" | "school";

interface ProviderConfig {
  name: string;
  icon: React.ReactNode;
  color: string;
  description: string;
}

const providerConfigs: Record<OAuthProvider, ProviderConfig> = {
  github: {
    name: "GitHub",
    icon: <Github className="h-5 w-5" />,
    color: "text-gray-900",
    description: "GitHub 账号",
  },
  qq: {
    name: "QQ",
    icon: <MessageCircle className="h-5 w-5" />,
    color: "text-blue-500",
    description: "QQ 账号",
  },
  school: {
    name: "学校统一认证",
    icon: <School className="h-5 w-5" />,
    color: "text-indigo-600",
    description: "学校账号",
  },
};

export default function AccountBindings() {
  const [unbindProvider, setUnbindProvider] = useState<OAuthProvider | null>(null);

  const { data: bindings, isLoading, refetch } = trpc.user.getOAuthBindings.useQuery();
  const unbindMutation = trpc.user.unbindOAuth.useMutation({
    onSuccess: () => {
      toast.success("解绑成功");
      refetch();
      setUnbindProvider(null);
    },
    onError: (error) => {
      toast.error(`解绑失败: ${error.message}`);
    },
  });

  const handleBind = (provider: OAuthProvider) => {
    // 构建授权 URL（带绑定标识）
    const redirectUri = `${window.location.origin}/api/oauth/${provider}/callback`;
    const state = btoa(
      JSON.stringify({
        redirectUri,
        provider,
        action: "bind",
        timestamp: Date.now(),
      })
    );

    window.location.href = `/api/oauth/${provider}/authorize?redirect_uri=${encodeURIComponent(
      redirectUri
    )}&state=${encodeURIComponent(state)}`;
  };

  const handleUnbind = (provider: OAuthProvider) => {
    setUnbindProvider(provider);
  };

  const confirmUnbind = () => {
    if (unbindProvider) {
      unbindMutation.mutate({ provider: unbindProvider });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
          <p className="mt-4 text-gray-600">加载中...</p>
        </div>
      </div>
    );
  }

  const boundProviders = new Set(bindings?.map((b) => b.provider) || []);
  const allProviders: OAuthProvider[] = ["github", "qq", "school"];

  return (
    <div className="container max-w-4xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">账号绑定</h1>
        <p className="text-gray-600 mt-2">管理您的第三方账号绑定，绑定后可使用任意方式登录</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>已绑定账号</CardTitle>
          <CardDescription>您可以使用以下任意账号登录系统</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {bindings && bindings.length > 0 ? (
            bindings.map((binding) => {
              const config = providerConfigs[binding.provider as OAuthProvider];
              return (
                <div
                  key={binding.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className={config.color}>{config.icon}</div>
                    <div>
                      <div className="font-semibold">{config.name}</div>
                      <div className="text-sm text-gray-600">
                        {binding.providerName || binding.providerEmail || "已绑定"}
                      </div>
                      <div className="text-xs text-gray-400 mt-1">
                        最后使用: {binding.lastUsedAt ? new Date(binding.lastUsedAt).toLocaleString() : "从未使用"}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="bg-green-100 text-green-800">
                      <Link2 className="h-3 w-3 mr-1" />
                      已绑定
                    </Badge>
                    {bindings.length > 1 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleUnbind(binding.provider as OAuthProvider)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Unlink className="h-4 w-4 mr-1" />
                        解绑
                      </Button>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-center py-8 text-gray-500">
              <AlertCircle className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <p>暂无绑定账号</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>可绑定账号</CardTitle>
          <CardDescription>绑定更多账号，让登录更便捷</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {allProviders
            .filter((provider) => !boundProviders.has(provider))
            .map((provider) => {
              const config = providerConfigs[provider];
              return (
                <div
                  key={provider}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className={config.color}>{config.icon}</div>
                    <div>
                      <div className="font-semibold">{config.name}</div>
                      <div className="text-sm text-gray-600">{config.description}</div>
                    </div>
                  </div>
                  <Button onClick={() => handleBind(provider)} size="sm">
                    <Link2 className="h-4 w-4 mr-1" />
                    绑定
                  </Button>
                </div>
              );
            })}

          {allProviders.every((p) => boundProviders.has(p)) && (
            <div className="text-center py-8 text-gray-500">
              <p>已绑定所有可用账号</p>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={unbindProvider !== null} onOpenChange={() => setUnbindProvider(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认解绑</AlertDialogTitle>
            <AlertDialogDescription>
              确定要解绑 {unbindProvider && providerConfigs[unbindProvider].name} 账号吗？
              解绑后将无法使用该账号登录系统。
              {bindings && bindings.length === 1 && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
                  <AlertCircle className="h-4 w-4 inline mr-2" />
                  这是您的最后一个绑定账号，解绑后将无法登录系统！
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmUnbind}
              className="bg-red-600 hover:bg-red-700"
              disabled={bindings && bindings.length === 1}
            >
              确认解绑
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
