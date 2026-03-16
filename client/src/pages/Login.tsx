import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Github, MessageCircle, School } from "lucide-react";

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
    color: "bg-gray-900 hover:bg-gray-800",
    description: "使用 GitHub 账号登录",
  },
  qq: {
    name: "QQ",
    icon: <MessageCircle className="h-5 w-5" />,
    color: "bg-blue-500 hover:bg-blue-600",
    description: "使用 QQ 账号登录",
  },
  school: {
    name: "学校统一认证",
    icon: <School className="h-5 w-5" />,
    color: "bg-indigo-600 hover:bg-indigo-700",
    description: "使用学校账号登录",
  },
};

export default function Login() {
  const [availableProviders, setAvailableProviders] = useState<OAuthProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const isDev = import.meta.env.DEV;

  useEffect(() => {
    // 获取可用的 OAuth 提供商
    fetch("/api/oauth/providers")
      .then((res) => res.json())
      .then((data) => {
        setAvailableProviders(data.providers || []);
        setLoading(false);
      })
      .catch((error) => {
        console.error("Failed to fetch OAuth providers:", error);
        // 默认为空，显示错误提示
        setAvailableProviders([]);
        setLoading(false);
      });
  }, []);

  const handleLogin = (provider: OAuthProvider) => {
    // 构建授权 URL
    const redirectUri = `${window.location.origin}/api/oauth/${provider}/callback`;
    const state = btoa(
      JSON.stringify({
        redirectUri,
        provider,
        timestamp: Date.now(),
      })
    );

    // 跳转到授权页面
    window.location.href = `/api/oauth/${provider}/authorize?redirect_uri=${encodeURIComponent(
      redirectUri
    )}&state=${encodeURIComponent(state)}`;
  };

  const handleDevLogin = async (openId: string) => {
    try {
      const response = await fetch('/api/dev/switch-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ openId }),
      });
      
      if (response.ok) {
        window.location.href = '/';
      } else {
        alert('登录失败，请确保演示账号已创建（运行: pnpm seed:demo）');
      }
    } catch (error) {
      console.error('登录失败:', error);
      alert('登录失败');
    }
  };

  const devAccounts = [
    { openId: 'demo-admin', name: '系统管理员', icon: '👑', color: 'bg-red-500 hover:bg-red-600' },
    { openId: 'demo-labadmin', name: '实验室管理员', icon: '🔧', color: 'bg-purple-500 hover:bg-purple-600' },
    { openId: 'demo-teacher-001', name: '教师', icon: '👨‍🏫', color: 'bg-blue-500 hover:bg-blue-600' },
    { openId: 'demo-student-001', name: '学生', icon: '👨‍🎓', color: 'bg-green-500 hover:bg-green-600' },
  ];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
          <p className="mt-4 text-gray-600">加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50 p-4">
      <Card className="w-full max-w-md shadow-xl border-0">
        <CardHeader className="text-center space-y-2 pb-8">
          <div className="mx-auto w-16 h-16 bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl flex items-center justify-center mb-4">
            <School className="h-8 w-8 text-white" />
          </div>
          <CardTitle className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            实验室预约系统
          </CardTitle>
          <CardDescription className="text-base">
            选择一种方式登录系统
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-3">
          {availableProviders.map((provider) => {
            const config = providerConfigs[provider];
            if (!config) return null;
            
            return (
              <Button
                key={provider}
                onClick={() => handleLogin(provider)}
                className={`w-full h-14 text-white ${config.color} transition-all duration-200 hover:scale-[1.02] hover:shadow-lg`}
                size="lg"
              >
                <div className="flex items-center justify-center gap-3">
                  {config.icon}
                  <div className="text-left">
                    <div className="font-semibold">{config.name}</div>
                    <div className="text-xs opacity-90">{config.description}</div>
                  </div>
                </div>
              </Button>
            );
          })}

          {availableProviders.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <p>暂无可用的登录方式</p>
              <p className="text-sm mt-2">请联系管理员配置 OAuth 提供商</p>
            </div>
          )}

          {/* 开发模式：测试账号快速登录 */}
          {isDev && (
            <>
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-orange-200"></div>
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-white px-2 text-orange-600 font-semibold">
                    🛠️ 开发模式 - 演示账号快速登录
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {devAccounts.map((account) => (
                  <Button
                    key={account.openId}
                    onClick={() => handleDevLogin(account.openId)}
                    variant="outline"
                    className={`h-16 text-white ${account.color} border-0 transition-all duration-200 hover:scale-[1.02]`}
                  >
                    <div className="text-center">
                      <div className="text-2xl mb-1">{account.icon}</div>
                      <div className="text-xs font-medium">{account.name}</div>
                    </div>
                  </Button>
                ))}
              </div>

              <div className="text-xs text-orange-600 text-center bg-orange-50 p-2 rounded">
                ⚠️ 演示账号仅在开发环境可用（来源：seed:demo）
              </div>
            </>
          )}
        </CardContent>

        <div className="px-6 pb-6 text-center text-xs text-gray-500">
          <p>登录即表示您同意我们的服务条款和隐私政策</p>
        </div>
      </Card>
    </div>
  );
}
