import { useEffect, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { getLoginUrl } from "@/const";
import {
  CheckCircle2,
  XCircle,
  Loader2,
  Clock,
  MapPin,
  BookOpen,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type CheckinState = "loading" | "locating" | "success" | "error" | "not-logged-in";

export default function CheckinScan() {
  const { user, loading: authLoading } = useAuth();
  const search = useSearch();
  const [, setLocation] = useLocation();
  
  const [state, setState] = useState<CheckinState>("loading");
  const [message, setMessage] = useState("");
  const [checkinResult, setCheckinResult] = useState<{
    status: string;
    courseName?: string;
    labName?: string;
  } | null>(null);

  // 从URL获取token
  const params = new URLSearchParams(search);
  const token = params.get("token");

  // 签到mutation
  const checkinMutation = trpc.classCheckin.studentCheckin.useMutation({
    onSuccess: (data) => {
      setState("success");
      setMessage(data.message);
      setCheckinResult({ status: data.status });
    },
    onError: (err) => {
      setState("error");
      setMessage(err.message);
    },
  });

  // 获取位置并签到
  const doCheckin = async (tkn: string) => {
    setState("locating");
    setMessage("正在获取位置信息...");

    try {
      // 尝试获取位置（用于记录，非必须）
      let latitude: number | undefined;
      let longitude: number | undefined;

      if (navigator.geolocation) {
        try {
          const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: true,
              timeout: 5000,
              maximumAge: 0,
            });
          });
          latitude = pos.coords.latitude;
          longitude = pos.coords.longitude;
        } catch {
          // 获取位置失败，继续签到（位置可选）
          console.log("位置获取失败，继续签到");
        }
      }

      setState("loading");
      setMessage("正在签到...");

      checkinMutation.mutate({
        token: tkn,
        latitude,
        longitude,
      });
    } catch (err: any) {
      setState("error");
      setMessage(err.message || "签到失败");
    }
  };

  // 检查登录状态和token
  useEffect(() => {
    if (authLoading) return;

    if (!token) {
      setState("error");
      setMessage("无效的签到链接");
      return;
    }

    if (!user) {
      setState("not-logged-in");
      return;
    }

    if (user.role !== "student") {
      setState("error");
      setMessage("只有学生可以进行签到");
      return;
    }

    // 开始签到流程
    doCheckin(token);
  }, [authLoading, user, token]);

  // 跳转登录
  const handleLogin = () => {
    // 登录后会自动返回当前页面（浏览器会保留URL）
    window.location.href = getLoginUrl();
  };

  // 返回首页
  const handleGoHome = () => {
    setLocation("/student/checkin");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center pb-2">
          <CardTitle className="text-2xl">课堂签到</CardTitle>
          <CardDescription>扫码签到验证</CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          {/* 加载中 */}
          {(state === "loading" || state === "locating") && (
            <div className="text-center py-8">
              <Loader2 className="h-16 w-16 text-indigo-500 animate-spin mx-auto mb-4" />
              <p className="text-lg text-slate-600">{message || "正在处理..."}</p>
            </div>
          )}

          {/* 未登录 */}
          {state === "not-logged-in" && (
            <div className="text-center py-8 space-y-4">
              <div className="bg-yellow-50 p-4 rounded-full w-20 h-20 mx-auto flex items-center justify-center">
                <AlertTriangle className="h-10 w-10 text-yellow-500" />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-slate-800">请先登录</h3>
                <p className="text-slate-500 mt-2">登录后将自动完成签到</p>
              </div>
              <Button onClick={handleLogin} className="w-full mt-4">
                前往登录
              </Button>
            </div>
          )}

          {/* 签到成功 */}
          {state === "success" && (
            <div className="text-center py-8 space-y-4">
              <div className="bg-green-50 p-4 rounded-full w-20 h-20 mx-auto flex items-center justify-center">
                <CheckCircle2 className="h-10 w-10 text-green-500" />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-green-700">
                  {checkinResult?.status === "late" ? "签到成功（迟到）" : "签到成功"}
                </h3>
                <p className="text-slate-500 mt-2">{message}</p>
              </div>
              {checkinResult?.courseName && (
                <div className="bg-slate-50 rounded-lg p-4 mt-4 space-y-2">
                  <div className="flex items-center justify-center gap-2 text-slate-600">
                    <BookOpen className="h-4 w-4" />
                    <span>{checkinResult.courseName}</span>
                  </div>
                  {checkinResult.labName && (
                    <div className="flex items-center justify-center gap-2 text-slate-500 text-sm">
                      <MapPin className="h-3 w-3" />
                      <span>{checkinResult.labName}</span>
                    </div>
                  )}
                </div>
              )}
              <Button onClick={handleGoHome} variant="outline" className="w-full mt-4">
                查看我的签到记录
              </Button>
            </div>
          )}

          {/* 签到失败 */}
          {state === "error" && (
            <div className="text-center py-8 space-y-4">
              <div className="bg-red-50 p-4 rounded-full w-20 h-20 mx-auto flex items-center justify-center">
                <XCircle className="h-10 w-10 text-red-500" />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-red-700">签到失败</h3>
                <p className="text-slate-500 mt-2">{message}</p>
              </div>
              <div className="space-y-2 mt-4">
                <Button onClick={() => token && doCheckin(token)} variant="default" className="w-full">
                  重试
                </Button>
                <Button onClick={handleGoHome} variant="outline" className="w-full">
                  返回签到页面
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
