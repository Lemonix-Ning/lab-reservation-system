import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy, ExternalLink } from "lucide-react";
import { toast } from "sonner";

export default function OAuthDebug() {
  const [callbackUrl, setCallbackUrl] = useState("");
  const [authorizeUrl, setAuthorizeUrl] = useState("");

  useEffect(() => {
    const origin = window.location.origin;
    const githubCallback = `${origin}/api/oauth/github/callback`;
    const githubAuthorize = `${origin}/api/oauth/github/authorize`;
    
    setCallbackUrl(githubCallback);
    setAuthorizeUrl(githubAuthorize);
  }, []);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("已复制到剪贴板");
  };

  return (
    <div className="container max-w-4xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">OAuth 配置调试</h1>
        <p className="text-gray-600 mt-2">检查 OAuth 回调地址配置</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>GitHub OAuth 配置</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-semibold text-gray-700">
              当前服务器地址
            </label>
            <div className="mt-2 p-3 bg-gray-50 rounded-lg font-mono text-sm">
              {window.location.origin}
            </div>
          </div>

          <div>
            <label className="text-sm font-semibold text-gray-700">
              GitHub OAuth App 回调地址（Authorization callback URL）
            </label>
            <div className="mt-2 flex items-center gap-2">
              <div className="flex-1 p-3 bg-blue-50 border border-blue-200 rounded-lg font-mono text-sm">
                {callbackUrl}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyToClipboard(callbackUrl)}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <p className="mt-2 text-sm text-gray-600">
              请在 GitHub OAuth App 设置中将此地址设置为 Authorization callback URL
            </p>
          </div>

          <div>
            <label className="text-sm font-semibold text-gray-700">
              授权地址（用于测试）
            </label>
            <div className="mt-2 flex items-center gap-2">
              <div className="flex-1 p-3 bg-gray-50 rounded-lg font-mono text-sm break-all">
                {authorizeUrl}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(authorizeUrl, "_blank")}
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="pt-4 border-t">
            <h3 className="font-semibold mb-2">配置步骤：</h3>
            <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
              <li>访问 <a href="https://github.com/settings/developers" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">GitHub Developer Settings</a></li>
              <li>找到你的 OAuth App 并点击编辑</li>
              <li>将上面的回调地址复制到 "Authorization callback URL" 字段</li>
              <li>保存更改</li>
              <li>返回 <a href="/login" className="text-blue-600 hover:underline">登录页面</a> 重试</li>
            </ol>
          </div>

          <div className="pt-4 border-t">
            <h3 className="font-semibold mb-2">环境变量检查：</h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-gray-600">VITE_SERVER_ORIGIN:</span>
                <code className="px-2 py-1 bg-gray-100 rounded">
                  {import.meta.env.VITE_SERVER_ORIGIN || "未设置"}
                </code>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-gray-600">VITE_APP_ID:</span>
                <code className="px-2 py-1 bg-gray-100 rounded">
                  {import.meta.env.VITE_APP_ID || "未设置"}
                </code>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>常见问题</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div>
            <h4 className="font-semibold mb-1">错误：redirect_uri is not associated with this application</h4>
            <p className="text-gray-600">
              这表示 GitHub OAuth App 的回调地址配置与实际请求的地址不匹配。
              请确保上面显示的回调地址与 GitHub 设置中的完全一致。
            </p>
          </div>

          <div>
            <h4 className="font-semibold mb-1">端口号不匹配</h4>
            <p className="text-gray-600">
              如果你的服务器运行在 3001 或其他端口，请更新 GitHub OAuth App 的回调地址。
              当前检测到的端口是：<code className="px-1 py-0.5 bg-gray-100 rounded">{window.location.port || "80"}</code>
            </p>
          </div>

          <div>
            <h4 className="font-semibold mb-1">开发环境 vs 生产环境</h4>
            <p className="text-gray-600">
              开发环境使用 HTTP + localhost，生产环境必须使用 HTTPS。
              你可能需要为不同环境创建不同的 OAuth App。
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
